import type {
  AudioFingerprintResult,
  AudioPerceptualResult,
  ConfidenceLevel,
  ContentTypeSlug,
  CtaSegmentResult,
  EngagementRange,
  Factor,
  FeatureVector,
  GeminiAudioSignals,
  GeminiVideoSignals,
  PredictionResult,
  RuleScoreResult,
  SignalAvailability,
  Suggestion,
  TrendEnrichment,
  VerbatimPayload,
} from "./types";
import type { CreatorContext } from "./creator";
import type { EmotionArcPoint } from "./qwen/schemas";
import type { HookDecomposition } from "./types";
import type { PipelineResult } from "./pipeline";
import type { StageEventCallback } from "./events";
import { QWEN_OMNI_MODEL as GEMINI_MODEL } from "./qwen/client";
// Apollo's persisted model label must reflect the Apollo model (QWEN_APOLLO_MODEL),
// not the shared reasoning constant — they diverged 2026-06-11 (Apollo → qwen3.7-plus).
import { QWEN_APOLLO_MODEL as DEEPSEEK_MODEL } from "./qwen/client";
// ml.ts call removed (Plan 02, R9): ml predict + feature-vector-to-ml-input no longer called here.
// ml.ts moves to _dormant/ in Plan 05. SCORE_WEIGHT_KEYS ml key retained until Plan 04 blend cut.
// Phase 1 (R1.9, Plan 06 T3 B4) — anti-virality gating helper. Wires
// ANTI_VIRALITY_THRESHOLD into a real consumer; eliminates the dead-code
// threshold per checker B4. Gating is computed AFTER confidence calibration
// (calculateConfidence + HARD-03 + Stage 10 critique adjustment) so the
// boolean reflects the final confidence value the UI consumes.
// isAntiViralityGated kept for pre-Phase-3 callers (still used in maybeAppendLikelyFlopWarning indirectly)
// isAntiViralityGatedFull: Phase 3 dual-trigger replacement used in aggregateScores.
import { isAntiViralityGatedFull } from "./anti-virality";
// Phase 3 (Plan 08) — Pass 2 timeline weighted aggregator + persona weights.
// buildWeightedCurve + assembleHeatmapPayload consume pass2Results + segments.
// resolveWeights provides the persona weight config (default mix when no override).
import { buildWeightedCurve, assembleHeatmapPayload } from "./wave3/weighted-aggregator";
import { resolveWeights, DEFAULT_PERSONA_WEIGHT_CONFIG } from "./persona-weights";
import type { HeatmapPayload } from "./types";
// Phase 1 (R6.1, D-13, D-15, Pitfall #5) — optimal post window niche aggregate
// lookup. computeOptimalPostWindow is called BEFORE Stage 10/11 so the field
// is on the assembled PredictionResult when critique + counterfactuals run.
// Non-fatal: null on Supabase error, FALLBACK_POST_WINDOW on unknown niche.
import { computeOptimalPostWindow, type OptimalPostWindow } from "./optimal-post";
import { createServiceClient } from "@/lib/supabase/service";
import { ENGINE_VERSION } from "./version";
import { runStage10Critique, applyCritiqueAdjustment } from "./stage10-critique";
// Plan 01-05 Task 0: maybeAppendLikelyFlopWarning extracted from stage11-counterfactuals.ts
// to flop-warning.ts (kept module). stage11-counterfactuals.ts moves to _dormant/ in Task 1.
import { maybeAppendLikelyFlopWarning } from "./flop-warning";
import { applyContentTypeWeights } from "./wave0/content-type-weights";
import { computeAudioPerceptualScore } from "./audio-perceptual";
import { createLogger } from "@/lib/logger";
// Plan 04-03: "fold" behavioralSource branch — aggregatePersonaResults receives the fold-adapted
// PersonaSimulationResult[] to produce the behavioral aggregate (D-11: function unchanged).
import { aggregatePersonaResults } from "./wave3/aggregator";

const log = createLogger({ module: "aggregator" });

/** Re-export ENGINE_VERSION for back-compat — existing consumers `import { ENGINE_VERSION } from "./aggregator"` keep working. */
export { ENGINE_VERSION };

// =====================================================
// v2 Score Weights — config-driven for maintainability
// =====================================================

// Plan 03-04 (D-04) — blend rewired to behavioral + apollo (Apollo composite replaces gemini).
// gemini term retired from blend (now provenance only for UI/back-compat).
// applyCtaPenalty on gemini dropped (gemini left the blend; CTA surfaces as Apollo §2.4 critique).
// apollo weight value kept at 0.35 (RESEARCH:230) to preserve 53.3/46.7 renorm split —
// satisfies STATE.md "derivation structurally unchanged" determinism band.
// Exported for test introspection (aggregator.test.ts, aggregator-audio.test.ts).
export const SCORE_WEIGHTS = {
  behavioral: 0.40,  // primary CoT, video-aware via Wave 2 input
  apollo:     0.35,  // Apollo knowledge-grounded composite (D-04, replaces gemini term)
} as const;

// Plan 03-04 (D-04) — SCORE_WEIGHT_KEYS updated to two live signals: behavioral + apollo.
// Dead keys (ml, rules, trends, audio, retrieval, platform_fit, gemini) removed.
// selectWeights iterates ONLY these keys; all SignalAvailability provenance fields
// (gemini, content_type, niche, gemini_hook, etc.) continue to NOT participate in weight math.
export const SCORE_WEIGHT_KEYS = ["behavioral", "apollo"] as const;

// =====================================================
// Phase 5 D-06: CTA Penalty Matrix
// =====================================================
// Content-type-aware CTA penalty applied to `gemini_score` (0-100 scale).
// When the CTA segment reports `cta_present=false` AND the Wave 0 content_type is one
// that conventionally requires a CTA (tutorial, b_roll), deduct points from the
// gemini contribution to overall_score.
//
// Magnitude interpretation: CONTEXT D-06 reads "tutorial: -0.5 score units / b_roll:
// -0.3 score units". The gemini_score in this aggregator is on 0-100. We interpret
// "0.5 score units" as 5 points on the 0-100 scale (and 0.3 → 3 points). Rationale:
// gemini_score = round(avg(factor scores 0-10) * 10) → 0-100; the D-06 deductions are
// intended as sub-score nudges, not 0.5%-of-100 cosmetic adjustments. Phase 10 ML
// audit revisits the magnitude.
//
// All other content types (talking_head, vlog, comedy, slideshow, action, other)
// are neutral — CTA is optional or not expected for those formats.
//
// When `cta_present=true`: NO penalty applied. Claude's Discretion to "blend strength
// into score" is deferred to a future plan — Plan 03 surfaces strength as a separate
// sub-signal (via PredictionResult.factors / hook_decomposition) for the M2 UI to
// consume, rather than mixing it into the raw_overall_score math.
//
// Phase 5 CR-04: typed as Partial<Record<ContentTypeSlug, number>> so future
// enum widening (add a new content type) is a COMPILE error if a penalty entry
// is intended but the slug typo'd. Absent slugs return undefined → 0 penalty.
const CTA_PENALTY_POINTS: Partial<Record<ContentTypeSlug, number>> = {
  tutorial: 5,
  b_roll: 3,
  // talking_head, vlog, comedy, slideshow, action, other → absent from table → 0 penalty
};

/**
 * D-06: Penalize gemini_score when CTA is expected (tutorial / b_roll) but absent.
 * Pure function; clamps result to [0, 100].
 *
 * Authority:
 *   - geminiResult.analysis.cta_segment (Phase 5 — populated by Plan 02 mergeSegments)
 *   - pipelineResult.wave0Result.content_type.type (Phase 4 — populated by Wave 0 detector)
 *
 * No-op paths (return geminiScore unchanged):
 *   - cta_present=true → strength blending deferred per Claude's Discretion
 *   - contentTypeSlug=null → Wave 0 failure path (don't penalize unknown content types)
 *   - cta_segment=null/undefined → provenance already redistributes via gemini_cta=false
 *
 * Phase 5 CR-04: parameter narrowed from `string | null` to `ContentTypeSlug | null`.
 * Future Wave 0 enum widening that adds a new slug becomes a COMPILE error in callers
 * (e.g., aggregator.ts:530-534) instead of silently bypassing the penalty matrix.
 */
export function applyCtaPenalty(
  geminiScore: number,
  contentTypeSlug: ContentTypeSlug | null,
  ctaSegment: CtaSegmentResult | null | undefined,
): number {
  if (!ctaSegment) return geminiScore;
  if (ctaSegment.cta_present) return geminiScore;
  if (contentTypeSlug === null) return geminiScore;
  const penalty = CTA_PENALTY_POINTS[contentTypeSlug] ?? 0;
  return Math.max(0, Math.min(100, geminiScore - penalty));
}

// =====================================================
// R11 Engagement Range — grounded estimate (Plan 05-02)
// =====================================================
// Pure function: follower_count × quality read (overall_score) → EngagementRange | null.
// No jitter, no sine — deterministic formula (R9/D-01 honesty).
// null when follower_count is absent (no fabricated number).
// =====================================================

/**
 * Compute a grounded engagement range anchored to the creator's real follower_count
 * × Apollo+fold quality read (overall_score 0–100).
 *
 * Design principles (R11, D-05, D-06):
 *   - Range (lo, hi), never a false-precise point — virality is fat-tailed.
 *   - Width widens when quality is low (more uncertainty) — honest fat-tail.
 *   - Higher quality (overall_score) shifts the range upward (quality multiplier).
 *   - Returns null when follower_count is absent — no fabrication (R9).
 *   - Pure, deterministic, no LLM call, no side effects (R7/R6 preserved).
 *
 * Formula:
 *   anchor        = follower_count (real creator baseline)
 *   quality_ratio = overall_score / 100                              (0–1 quality read)
 *   reach_factor  = quality_ratio² × 0.20 + 0.005                   (0.5%–20.5% reach)
 *   mid_estimate  = anchor × reach_factor
 *   uncertainty   = (1 - quality_ratio)² × 0.25 + 0.02              (2%–27% of followers)
 *   half_width    = max(mid_estimate × 0.5, anchor × uncertainty)    (floor on absolute width)
 *   lo            = max(0, round(mid_estimate - half_width))
 *   hi            = round(mid_estimate + half_width)
 *
 * The uncertainty term is anchored to follower_count so low-quality ranges are WIDER
 * in absolute terms even when mid_estimate is tiny (fat-tailed honesty).
 *
 * Confidence is the quality_ratio (0–1) — higher quality = more confident estimate.
 * Clamped: lo ≥ 0, hi > lo (minimum gap enforced).
 */
export function computeEngagementRange(
  creatorContext: Pick<CreatorContext, "follower_count">,
  overall_score: number,
): EngagementRange | null {
  // R9 honesty: return null when no creator baseline exists. follower_count <= 0
  // is treated as "no baseline" — a 0-follower count yields a nonsense 0–1 range
  // that violates R9, so it must suppress the estimate just like null/undefined.
  if (
    creatorContext.follower_count === null ||
    creatorContext.follower_count === undefined ||
    creatorContext.follower_count <= 0
  ) {
    return null;
  }

  const followerCount = creatorContext.follower_count;
  // Clamp overall_score to 0–100 (post-parse clamp idiom — untrusted upstream).
  const score = Math.min(100, Math.max(0, overall_score));
  const quality_ratio = score / 100; // 0–1

  // Reach factor: quadratic so low scores give near-zero reach, high scores give up to ~20%.
  // Range: quality_ratio=0 → 0.5% reach; quality_ratio=1 → 20.5% reach.
  const reach_factor = quality_ratio * quality_ratio * 0.20 + 0.005;
  const mid_estimate = followerCount * reach_factor;

  // Uncertainty anchored to follower_count (not mid_estimate) so width is large at low quality.
  // quality_ratio=0 → uncertainty = 0.25+0.02 = 0.27 (27% of followers)
  // quality_ratio=1 → uncertainty = 0+0.02    = 0.02  (2% of followers)
  const uncertainty = (1 - quality_ratio) * (1 - quality_ratio) * 0.25 + 0.02;
  // half_width: take the larger of relative-to-midpoint or absolute-to-followers.
  // This ensures low-quality ranges remain wide even when mid_estimate is tiny.
  const half_width = Math.max(mid_estimate * 0.5, followerCount * uncertainty);

  const lo = Math.max(0, Math.round(mid_estimate - half_width));
  let hi = Math.round(mid_estimate + half_width);

  // Ensure lo < hi (strict range — D-06).
  if (hi <= lo) {
    hi = lo + 1;
  }

  const confidence = quality_ratio;

  return {
    lo,
    hi,
    confidence,
    basis: "follower-tier × quality read",
  };
}

// =====================================================
// Signal Availability & Dynamic Weight Selection (RULE-04)
// =====================================================
// SignalAvailability interface lives in ./types (Phase 3 — D-07).
// Aggregator computes the values; route layer persists them via PredictionResult.

/**
 * Select weights for the behavioral + apollo 2-key blend (Plan 03-04, D-04).
 * When a source is missing its weight redistributes to the remaining source
 * so weights always sum to ~1.0. Dead keys (ml, rules, trends, audio,
 * retrieval, platform_fit, gemini) removed from blend.
 *
 * apollo availability = availability.apollo (deepseekResult non-null + composite_score present).
 * gemini stays in SignalAvailability as a provenance-only flag (NOT read here).
 *
 * Exported for benchmarking and testing.
 */
export function selectWeights(
  availability: SignalAvailability
): {
  behavioral: number;
  apollo: number;
} {
  const behavioralOn = availability.behavioral;
  const apolloOn = availability.apollo ?? availability.behavioral; // apollo available iff deepseek ran (same signal)

  // Both sources available — normalize base weights (0.40 + 0.35 = 0.75).
  if (behavioralOn && apolloOn) {
    const baseSum = SCORE_WEIGHTS.behavioral + SCORE_WEIGHTS.apollo;
    return {
      behavioral: Math.round((SCORE_WEIGHTS.behavioral / baseSum) * 1000) / 1000,
      apollo:     Math.round((SCORE_WEIGHTS.apollo     / baseSum) * 1000) / 1000,
    };
  }

  // One source missing — full weight goes to the available source.
  if (behavioralOn && !apolloOn) return { behavioral: 1, apollo: 0 };
  if (!behavioralOn && apolloOn) return { behavioral: 0, apollo: 1 };

  // Both unavailable — all zeros.
  return { behavioral: 0, apollo: 0 };
}

// =====================================================
// Confidence Calculation
// =====================================================

/**
 * Calculate numeric confidence (0-1) based on:
 * 1. Signal availability (0-0.6) — how much data we have
 * 2. Model agreement (0-0.4) — do Apollo composite and behavioral signals agree on direction
 *
 * Plan 03-04 (D-04): replaces gemini-vs-behavioral agreement check with
 * Apollo-composite-vs-behavioral direction agreement. Gemini term retired from blend.
 * HARD-03 LOW floor on dual failure preserved.
 */
function calculateConfidence(
  apolloScore: number,  // Plan 03-04: Apollo composite_score (0-100) replaces geminiScore
  behavioralScore: number,
  ruleResult: RuleScoreResult,
  trendEnrichment: TrendEnrichment,
  hasVideo: boolean,
  deepseekConfidence: "high" | "medium" | "low",
  availability: SignalAvailability
): { confidence: number; confidence_label: ConfidenceLevel } {
  // Signal availability component (0-0.6)
  let signal = 0.2; // Base: always have text
  if (hasVideo) signal += 0.1;
  if (trendEnrichment.matched_trends.length > 0) signal += 0.1;
  if (ruleResult.matched_rules.length >= 3) signal += 0.1;
  if (deepseekConfidence === "high") signal += 0.1;
  else if (deepseekConfidence === "medium") signal += 0.05;

  // Plan 01 (WR-01, R5/R9): rules + trends were removed from the engine BY DESIGN.
  // Penalizing confidence for their absence would dishonestly depress every prediction
  // for signals we deliberately deleted, so the former RULE-04 -0.05/-0.05 penalty is
  // gone. `availability.rules`/`.trends` remain as provenance flags only.
  void availability;

  // Model agreement component (0-0.4)
  // Plan 03-04 (D-04): Apollo-composite-vs-behavioral direction agreement (replaces gemini agreement).
  const apolloDirection = apolloScore - 50;
  const behavioralDirection = behavioralScore - 50;
  let agreement: number;

  if (
    (apolloDirection >= 0 && behavioralDirection >= 0) ||
    (apolloDirection < 0 && behavioralDirection < 0)
  ) {
    // Same sign — Apollo and behavioral agree on direction
    agreement = 0.4;
  } else if (Math.abs(apolloDirection - behavioralDirection) <= 15) {
    // Different signs but close together
    agreement = 0.2;
  } else {
    // Different signs and far apart
    agreement = 0.0;
  }

  const confidence = Math.min(1, Math.max(0, signal + agreement));
  const confidence_label: ConfidenceLevel =
    confidence >= 0.7 ? "HIGH" : confidence >= 0.4 ? "MEDIUM" : "LOW";

  return { confidence, confidence_label };
}

// =====================================================
// FeatureVector Assembly
// =====================================================

// CR-03: video_signals fields may be `null` per-field when a segment failed
// (mergeSegments null-fills with structural 0, the aggregator degrades those
// to null based on signalAvailability before this function runs).
type VideoSignalsPartial = {
  visual_production_quality: number | null;
  hook_visual_impact: number | null;
  pacing_score: number | null;
  transition_quality: number | null;
};

function assembleFeatureVector(
  pipelineResult: PipelineResult,
  adjustedVideoSignals?: GeminiVideoSignals | VideoSignalsPartial | null,
): FeatureVector {
  const { payload, geminiResult, deepseekResult } =
    pipelineResult;
  // Plan 03 strip: ruleResult + audioFingerprintResult + trendEnrichment removed from pipeline; use fallback defaults.
  const ruleResult: import("./types").RuleScoreResult = { rule_score: 50, matched_rules: [] };
  const trendEnrichment: import("./types").TrendEnrichment = { trend_score: 0, matched_trends: [], trend_context: "", hashtag_relevance: 0 };
  const gemini = geminiResult.analysis;
  const deepseek = deepseekResult?.reasoning;
  // Phase 6 D-G4 — fingerprint cosine takes priority over the Jaro-Winkler-derived score.
  // Plan 03: audio fingerprint stage removed; always null. Cast prevents TypeScript narrowing to never.
  const audioFingerprintResult = null as AudioFingerprintResult | null;

  // Helper to find a Gemini factor by name
  const findFactor = (name: string) =>
    gemini.factors?.find((f) => f.name === name);

  // Phase 4 D-12 + D-19: use content-type-adjusted video signals when provided;
  // fall back to raw video_signals (Wave 0 failure or no video).
  const videoSignals = adjustedVideoSignals ?? gemini.video_signals ?? null;

  return {
    // Gemini factors (0-10)
    hookScore: findFactor("Scroll-Stop Power")?.score ?? 0,
    completionPull: findFactor("Completion Pull")?.score ?? 0,
    rewatchPotential: findFactor("Rewatch Potential")?.score ?? 0,
    shareTrigger: findFactor("Share Trigger")?.score ?? 0,
    emotionalCharge: findFactor("Emotional Charge")?.score ?? 0,

    // Video signals (null if no video) — Phase 4: read from `videoSignals` so
    // content-type weight matrix flows into FeatureVector → ML score.
    visualProductionQuality: videoSignals?.visual_production_quality ?? null,
    hookVisualImpact: videoSignals?.hook_visual_impact ?? null,
    pacingScore: videoSignals?.pacing_score ?? null,
    transitionQuality: videoSignals?.transition_quality ?? null,

    // DeepSeek component scores (0-10)
    hookEffectiveness: deepseek?.component_scores.hook_effectiveness ?? 0,
    retentionStrength: deepseek?.component_scores.retention_strength ?? 0,
    shareability: deepseek?.component_scores.shareability ?? 0,
    commentProvocation: deepseek?.component_scores.comment_provocation ?? 0,
    saveWorthiness: deepseek?.component_scores.save_worthiness ?? 0,
    trendAlignment: deepseek?.component_scores.trend_alignment ?? 0,
    originality: deepseek?.component_scores.originality ?? 0,

    // Rules and trends
    ruleScore: ruleResult.rule_score,
    trendScore: trendEnrichment.trend_score,

    // Audio — best trending sound match score (0-1, null if no match).
    // Phase 6 (D-G4): fingerprint cosine takes priority over the Jaro-Winkler
    // velocity-derived score. ML feature_vector shape is unchanged (still 0-1)
    // so the swap is opaque to the ML feature assembler — only the source-of-data
    // changes when a fingerprint match is available.
    audioTrendingMatch:
      audioFingerprintResult?.similarity != null
        ? audioFingerprintResult.similarity
        : trendEnrichment.matched_trends.length > 0
          ? Math.min(
              1,
              Math.max(...trendEnrichment.matched_trends.map((t) => t.velocity_score)) / 100,
            )
          : null,

    // Caption/Hashtag
    captionScore: 0, // Not yet implemented — future enhancement
    hashtagRelevance: trendEnrichment.hashtag_relevance ?? 0,
    hashtagCount: payload.hashtags.length,

    // Content metadata
    durationSeconds: payload.duration_hint,
    hasVideo: payload.input_mode !== "text",
  };
}

// Fabricated engagement jitter (D1.1, R9) deleted (Plan 02): sine-jitter view/like/comment/share/save
// estimation functions removed. predicted_engagement field is null — UI card null-guarded (Plan 01 reverify #5).
// PredictedEngagement type + UI shell are retained per D1.3; field will be regrounded in Plan 05.

// =====================================================
// Score Aggregation
// =====================================================

/**
 * Phase 7 D-14 (lightweight A/B eval). Default: fold (Phase 4 Plan 05 — fold is sole path).
 * Pass "deepseek" to force-use DeepSeek behavioral predictions (eval harness back-compat).
 * "personas" option removed — 10-pass deleted (Phase 4 Plan 05).
 */
export interface AggregateScoresOptions {
  behavioralSource?: "deepseek" | "fold";
  // D-01 / D-18 — Plan 03 pipeline.ts uploads video once at entry, threads fileUri through here.
  // Plan 02 leaves this optional with null default; Plan 03 callsite supplies real values.
  videoContext?: { fileUri: string; mimeType: string } | null;
  /**
   * Retained for back-compat. Stage 11 call removed (Plan 02); this flag is now a no-op.
   * counterfactuals is always null after Plan 02 until Plan 05 regrounding.
   */
  deferCounterfactuals?: boolean;
}

/**
 * Aggregate all pipeline stage outputs into a PredictionResult.
 *
 * Post-strip formula (Plan 01, R9): behavioral 0.40 + gemini 0.35, renormalized to the
 * two live signals (≈53.3% / 46.7%). The dead v2 sources (ml/rules/trends/audio/retrieval/
 * platform_fit) were removed from the blend and dormanted.
 * RULE-04: Dynamic weight selection adapts when a live signal is missing.
 *
 * Takes the full PipelineResult from runPredictionPipeline()
 * and returns a complete PredictionResult.
 */
export async function aggregateScores(
  pipelineResult: PipelineResult,
  onStageEvent?: StageEventCallback,
  options?: AggregateScoresOptions,
): Promise<PredictionResult> {
  const {
    payload,
    geminiResult,
    deepseekResult,
  } = pipelineResult;

  const gemini = geminiResult.analysis;
  const deepseek = deepseekResult?.reasoning ?? null;
  // Plan 03 strip: ruleResult + audioFingerprintResult + trendEnrichment removed from pipeline; use fallback defaults.
  const ruleResult: import("./types").RuleScoreResult = { rule_score: 50, matched_rules: [] };
  const trendEnrichment: TrendEnrichment = { trend_score: 0, matched_trends: [], trend_context: "", hashtag_relevance: 0 };
  // Plan 03: audio fingerprint stage removed; always null. Cast prevents TypeScript narrowing to never.
  const audioFingerprintResult = null as AudioFingerprintResult | null;

  // -------------------------------------------------
  // Phase 4 D-12 + D-19 (RESEARCH Topic #5 locked interpretation):
  // Apply content-type weight matrix to Gemini video_signals BEFORE
  // assembleFeatureVector consumes them. The adjusted signals flow into
  // FeatureVector → ML score (the locked matrix targets the feature_vector
  // route, NOT the gemini_score math over gemini.factors[]).
  // Null content_type uses the `other` matrix row (1.0× passthrough) —
  // preserves Wave 0 failure / no-video behavior.
  //
  // CR-03: When a segment fails, mergeSegments null-fills the corresponding
  // video_signals fields with structural `0` (preserves the existing
  // GeminiVideoSignalsSchema's `number` (non-nullable) contract). The
  // aggregator MUST NOT pass those structural zeros through the content-type
  // weight matrix — `0 × multiplier` is still 0 and reads as a real "zero
  // production quality" score downstream in the ML feature vector. We
  // degrade the affected fields to `null` HERE, before any weight math,
  // using the per-segment availability flags as ground truth (the structural
  // zeros from mergeSegments are intentionally indistinguishable from real
  // 0-scores at the schema level — signalAvailability is the truth).
  // -------------------------------------------------
  const wave0 = pipelineResult.wave0Result;
  const contentTypeSlug = wave0.content_type?.type ?? null;
  const segAvailability = pipelineResult.geminiResult.signalAvailability;
  const baseVideoSignals = geminiResult.analysis.video_signals ?? null;
  // CR-03: Strip structural zeros from failed segments so they do NOT feed
  // applyContentTypeWeights → FeatureVector. The cast targets the
  // FeatureVector consumer (types.ts:27-30) which IS nullable; the
  // applyContentTypeWeights branch below skips when fields are null.
  const rawVideoSignals: (GeminiVideoSignals & {
    visual_production_quality: number | null;
    hook_visual_impact: number | null;
    pacing_score: number | null;
    transition_quality: number | null;
  }) | null = (() => {
    if (!baseVideoSignals) return null;
    if (!segAvailability) return baseVideoSignals;
    const out: {
      visual_production_quality: number | null;
      hook_visual_impact: number | null;
      pacing_score: number | null;
      transition_quality: number | null;
    } = {
      visual_production_quality: baseVideoSignals.visual_production_quality,
      hook_visual_impact: baseVideoSignals.hook_visual_impact,
      pacing_score: baseVideoSignals.pacing_score,
      transition_quality: baseVideoSignals.transition_quality,
    };
    // Body segment owns visual_production_quality + pacing_score + transition_quality.
    if (!segAvailability.gemini_body) {
      out.visual_production_quality = null;
      out.pacing_score = null;
      out.transition_quality = null;
    }
    // Hook segment owns hook_visual_impact (= hook_decomposition.visual_stop_power passthrough).
    if (!segAvailability.gemini_hook) {
      out.hook_visual_impact = null;
    }
    return out as GeminiVideoSignals & typeof out;
  })();
  // Only call applyContentTypeWeights when ALL four fields are present numbers
  // (the helper expects GeminiVideoSignals — all-number — by contract). If
  // any are null, skip the weight matrix and pass through directly — the
  // FeatureVector consumer (assembleFeatureVector below) is null-safe.
  const allFieldsNumeric =
    rawVideoSignals !== null &&
    typeof rawVideoSignals.visual_production_quality === "number" &&
    typeof rawVideoSignals.hook_visual_impact === "number" &&
    typeof rawVideoSignals.pacing_score === "number" &&
    typeof rawVideoSignals.transition_quality === "number";
  const adjustedVideoSignals =
    rawVideoSignals && allFieldsNumeric && contentTypeSlug !== null
      ? applyContentTypeWeights(rawVideoSignals as GeminiVideoSignals, contentTypeSlug)
      : rawVideoSignals;

  // T4.4 (2026-06-07): the Phase-6 enrichedMatchedTrends/effectiveTrendEnrichment block
  // was deleted — it synthesized a matched_trends entry from the audio-fingerprint result,
  // but the fingerprint stage was stripped (Plan 03) so audioFingerprintResult is now a
  // hardcoded null in this scope. The `audioFingerprintResult !== null` guard was therefore
  // always false → effectiveTrendEnrichment was byte-identical to the empty trendEnrichment
  // fallback on every run. Downstream refs (calculateConfidence, result.trend_score) now read
  // `trendEnrichment` directly.

  // -------------------------------------------------
  // Phase 6 (D-G3, D-G2) — audio signal computation.
  //   audio_perceptual_score = formula(content-type, audio_signals)        [0-100, BEFORE boost]
  //   audio_fingerprint_boost = trend_phase delta                          [+15 emerging .. -5 declining]
  //   audio_score = clamp(audio_perceptual_score + boost, 0, 100)          [internal to weighted sum]
  // PredictionResult.audio_perceptual_score holds the PRE-boost value
  // (per D-G3) so consumers can inspect the perceptual baseline separately.
  // -------------------------------------------------
  const audioSignals = gemini.audio_signals; // GeminiAudioSignals | undefined (Plan 03 .optional())
  let audio_perceptual_score = 0;
  // audio_score removed from blend in Plan 04 (R9). audio_perceptual_score still
  // surfaced on PredictionResult (D-G3) so consumers can read the perceptual baseline.
  let audioPerceptualResult: AudioPerceptualResult | null = null;
  if (audioSignals) {
    audioPerceptualResult = computeAudioPerceptualScore(
      audioSignals,
      contentTypeSlug,
    );
    audio_perceptual_score = audioPerceptualResult.audio_perceptual_score;
  }

  // Phase 6 (Note 7 / Q4 RESOLVED) — verbatim Gemini-emitted audio_description
  // for downstream persistence into analysis_results.audio_description. The
  // calling layer (route.ts buildInsertRow) plucks this field into the insert
  // payload. Null when audio_signals absent.
  const audio_description = audioSignals?.audio_description ?? null;

  // Phase 1 (R1.7) — emotion_arc pluck from Omni Plus output. Non-fatal per
  // Pitfall #5 (inserted BEFORE result assembly so Stage 10/11 critique +
  // counterfactuals see the populated field). Backward compat: when Omni omits
  // the field (existing responses, slideshow/text mode) emotion_arc is null and
  // the downstream P3 emotion-arc panel renders empty state.
  let emotion_arc: EmotionArcPoint[] | null = null;
  try {
    const arcRaw = (geminiResult.analysis as unknown as {
      emotion_arc?: EmotionArcPoint[];
    })?.emotion_arc;
    if (Array.isArray(arcRaw) && arcRaw.length > 0) emotion_arc = arcRaw;
  } catch {
    emotion_arc = null; // non-fatal
  }

  // Phase 2 (R1) — verbatim pluck (hook + per-segment). Non-fatal like emotion_arc.
  // hook: hook_verbatim off geminiResult.analysis (rides the `as` cast like emotion_arc).
  // segments: derived from omniSegments (= pipelineResult.segments, normalizeSegments output).
  //   Each SegmentGrid now carries spoken_text/on_screen_text (Plan 01 SegmentSchema extension).
  //   Derived AFTER omniSegments is set (:866) — see pass2Outcome block below.
  let verbatim: VerbatimPayload | null = null;
  try {
    const hookRaw = (geminiResult.analysis as unknown as {
      hook_verbatim?: { spoken_words?: string | null; on_screen_text?: string | null };
    })?.hook_verbatim;
    const hook = hookRaw ? {
      spoken_words: hookRaw.spoken_words ?? null,
      on_screen_text: hookRaw.on_screen_text ?? null,
    } : undefined;

    // Per-segment verbatim will be derived below from omniSegments after :866.
    // Temporarily store hook only; segments merged in below.
    if (hook) verbatim = { hook };
  } catch {
    verbatim = null; // non-fatal
  }

  // Phase 2 (Quick 260528-nqx) — hook_decomposition pluck from Gemini analysis.
  // Wave 1 hook-segment analysis emits this on geminiResult.analysis per the
  // GeminiVideoAnalysisSchema (gemini/schemas.ts:85). pipeline.ts:874 already
  // reads .watermark_detected off the same field; we now surface the full
  // decomposition into PredictionResult so HookDecompNode renders real data
  // instead of falling back to COPY.HOOK_DECOMP_UNAVAILABLE. Non-fatal:
  // matches the emotion_arc Pitfall #5 ordering — populated BEFORE Stage 10/11
  // so critique + counterfactuals see the field.
  let hook_decomposition: HookDecomposition | null = null;
  try {
    const raw = (geminiResult.analysis as { hook_decomposition?: HookDecomposition | null }).hook_decomposition;
    if (raw && typeof raw === "object") hook_decomposition = raw;
  } catch {
    hook_decomposition = null; // non-fatal
  }

  // Content-craft signals (board "Content craft" frame). The Omni Wave-1 analysis
  // emits these on geminiResult.analysis but the aggregator historically consumed
  // them only for scoring (video_signals → audio_perceptual; cta_segment → factors)
  // and dropped them from PredictionResult. Surface them verbatim so the analyze
  // route can stash them into variants.craft. Non-fatal, read defensively — these
  // are absent on text/tiktok_url fallback paths. Populated BEFORE Stage 10/11
  // (matches hook_decomposition / emotion_arc ordering).
  const craftGemini = geminiResult.analysis as typeof geminiResult.analysis & {
    video_signals?: GeminiVideoSignals | null;
    audio_signals?: GeminiAudioSignals | null;
    cta_segment?: CtaSegmentResult | null;
    overall_impression?: string;
    content_summary?: string;
  };
  const craft_video_signals = craftGemini.video_signals ?? null;
  const craft_cta_segment = craftGemini.cta_segment ?? null;
  const craft_audio_signals = craftGemini.audio_signals ?? null;
  const craft_overall_impression = craftGemini.overall_impression ?? undefined;
  const craft_content_summary = craftGemini.content_summary ?? undefined;

  // Phase 1 (R6.1, D-13, D-15, Pitfall #5) — optimal_post_window lookup. Inserted
  // BEFORE result assembly so Stage 10/11 critique + counterfactuals see the
  // field on the assembled PredictionResult. Non-fatal — null on Supabase error,
  // FALLBACK_POST_WINDOW on unknown niche.
  //
  // Source niche: pipelineResult.payload.niche (ContentPayload.niche is string|null).
  // `_creator` is unused in P1 per D-12 — passing null until M2-II promotes the
  // creator-aware override path.
  let optimal_post_window: OptimalPostWindow | null = null;
  {
    // board-fix #1: per-stage timing to locate the ~121s post-pipeline tail.
    const t = performance.now();
    try {
      const serviceClient = createServiceClient();
      const nicheValue = pipelineResult.payload.niche ?? null;
      optimal_post_window = await computeOptimalPostWindow(
        serviceClient,
        nicheValue,
        null,
      );
    } catch {
      optimal_post_window = null; // non-fatal per D-15
    }
    log.info("stage_timing", {
      stage: "optimal_post_window",
      ms: Math.round(performance.now() - t),
    });
  }

  // -------------------------------------------------
  // FeatureVector assembly (persisted; read by the learning loop + board niche/duration).
  // -------------------------------------------------
  // Plan 03: trendEnrichment was removed from PipelineResult; pass pipelineResult directly.
  // The trend/fingerprint enrichment that used to feed FeatureVector.audioTrendingMatch is
  // gone (T4.4) — the fallback is always the empty trendEnrichment now.
  const featureVectorInput: PipelineResult = {
    ...pipelineResult,
  };
  const feature_vector = assembleFeatureVector(
    featureVectorInput,
    adjustedVideoSignals,
  );
  // ml call removed (Plan 02, R9): ml.ts moves to _dormant/ in Plan 05.
  // SCORE_WEIGHT_KEYS ml key removed in Plan 04 blend cut.

  // -------------------------------------------------
  // Signal availability — behavioral + apollo (the two blend keys post-Plan-03-04 D-04).
  // gemini retired from blend; remains as provenance flag for JSONB/UI.
  // All other keys (ml, rules, trends, audio, retrieval, platform_fit) removed
  // from the blend in Plan 04 (R9). Provenance flags (content_type, niche,
  // gemini_hook/body/cta, personas, audio, audio_fingerprint, retrieval,
  // platform_fit, pass2_timeline) are preserved on the struct so they continue
  // to be persisted to analysis_results.signal_availability JSONB and surfaced
  // in the UI; they simply no longer participate in selectWeights math.
  // -------------------------------------------------
  const availability: SignalAvailability = {
    behavioral: deepseekResult !== null,
    // Plan 03-04 (D-04): apollo availability = deepseekResult non-null (composite_score present).
    // Same source as behavioral; exposed separately for JSONB provenance.
    apollo: deepseekResult !== null,
    // Placeholder — overwritten below after per-segment availability is resolved.
    // HARD-03 fallback (factors.some(score > 0)) kicks in only when signalAvailability undefined.
    gemini: false, // PROVENANCE ONLY after D-04 (Omni video signal fired). NOT a blend key.
    // Provenance flags — NOT weight-bearing (not in SCORE_WEIGHT_KEYS after Plan 04 blend cut).
    // Retained for JSONB persistence and UI surfacing.
    ml:     false, // Plan 04 (R9): removed from blend. Provenance only.
    rules:  false, // Plan 04 (R9): removed from blend. Provenance only.
    trends: false, // Plan 04 (R9): removed from blend. Provenance only.
    content_type: pipelineResult.wave0Result.content_type !== null,
    niche: pipelineResult.wave0Result.niche !== null,
    gemini_hook: pipelineResult.geminiResult.signalAvailability?.gemini_hook ?? false,
    gemini_body: pipelineResult.geminiResult.signalAvailability?.gemini_body ?? false,
    gemini_cta:  pipelineResult.geminiResult.signalAvailability?.gemini_cta  ?? false,
    personas: pipelineResult.personaBehavioralAggregate !== null,
    audio: audioSignals != null,
    audio_fingerprint: audioFingerprintResult !== null,
    retrieval: pipelineResult.retrievalResult.availability,
    // Plan 04: platform_fit key removed from blend — provenance only, preserved for JSONB.
    platform_fit: false,
    pass2_timeline: pipelineResult.foldOutcome?.fold_success ?? false,
  };

  // Phase 5 D-12: derived `gemini` provenance key (PROVENANCE ONLY, not blend after D-04).
  // - Segmented path (signalAvailability present): gemini = hook || body || cta.
  // - Legacy text + tiktok_url paths (signalAvailability undefined): HARD-03 fallback —
  //   the value is `true` when at least one Gemini factor scored > 0.
  availability.gemini = pipelineResult.geminiResult.signalAvailability
    ? availability.gemini_hook || availability.gemini_body || availability.gemini_cta
    : (geminiResult.analysis.factors?.some((f) => f.score > 0) ?? false);

  const weights = selectWeights(availability);

  // -------------------------------------------------
  // Behavioral score (0.40 base weight → ≈53.3% normalized post-strip)
  // Source: DeepSeek's 7 component scores, each 0-10
  // -------------------------------------------------
  const cs = deepseek?.component_scores;
  const behavioralAvg = cs
    ? (cs.hook_effectiveness +
        cs.retention_strength +
        cs.shareability +
        cs.comment_provocation +
        cs.save_worthiness +
        cs.trend_alignment +
        cs.originality) /
      7
    : 0;
  const behavioral_score = Math.round(behavioralAvg * 10); // Normalize to 0-100

  // -------------------------------------------------
  // Gemini score — D-R1 (2026-06-11): the Read is a pure sensor and no longer scores, so on
  // video there are NO factors → gemini_score is null. Kept nullable on PredictionResult for
  // legacy/text rows + permalink back-compat (don't migrate the column away). The confidence
  // basis that used to lean on it (stage10 signal-agreement) re-bases on apollo-vs-fold in plan
  // 01-04 (F22/F34); until then stage10 skips the check when gemini_score is null.
  // -------------------------------------------------
  const gemini_score =
    gemini.factors && gemini.factors.length > 0
      ? Math.round((gemini.factors.reduce((sum, f) => sum + f.score, 0) / gemini.factors.length) * 10)
      : null;

  // -------------------------------------------------
  // Apollo score (Plan 03-04, D-04) — replaces gemini term in the blend.
  // Source: deepseekResult.reasoning.composite_score (Apollo §4 output, 0-100).
  // Falls back to 0 when deepseek is unavailable (behavioral gets full weight via selectWeights).
  // applyCtaPenalty dropped (Open Q2): gemini left the blend; CTA surfaces as Apollo §2.4 critique.
  // -------------------------------------------------
  const apollo_score = deepseek?.composite_score ?? 0;

  // -------------------------------------------------
  // Fold audience score (T1.1, 2026-06-06) — the SIMULATED-AUDIENCE half of the score.
  // Until now `overall_score` was one Apollo call graded twice (behavioral_score = avg of
  // Apollo's component_scores; apollo_score = same call's composite). The fold — the real
  // 10-archetype audience sim (qwen3.5-omni-plus + video) — drove the heatmap + behavioral
  // predictions but was STRUCTURALLY EXCLUDED from the headline number. This folds it in.
  //
  // fold_audience_score (0-100) = retention-dominant blend of the persona aggregate:
  //   0.50·completion (watch-through, the #1 virality signal) + 0.25·share (reach/algo)
  //   + 0.15·save (value) + 0.10·comment (engagement). All fields are 0-100 population/
  //   top-3-weighted intents from aggregatePersonaResults (wave3/aggregator.ts).
  // -------------------------------------------------
  const foldAgg = pipelineResult.personaBehavioralAggregate;
  const foldOn = (pipelineResult.foldOutcome?.fold_success ?? false) && foldAgg !== null;
  const fold_audience_score = foldOn
    ? Math.round(
        0.50 * foldAgg!.completion_pct +
          0.25 * foldAgg!.share_pct +
          0.15 * foldAgg!.save_pct +
          0.10 * foldAgg!.comment_pct,
      )
    : 0;

  // -------------------------------------------------
  // Overall score — TRUE ensemble: expert read (Apollo composite) × simulated audience (fold).
  // - video + both signals: 0.5·apollo + 0.5·fold_audience (the real ensemble).
  // - no fold (text/tiktok_url mode): fall back to the prior Apollo-only blend
  //   (behavioral_score·w.beh + apollo_score·w.apollo) — byte-identical to pre-T1.1 text mode.
  // - apollo failed but fold ok: fold drives 100% (don't halve a valid audience read).
  // - both dead: 0 (T1.5 will null this into an "unavailable" state — out of scope here).
  // Dead terms (ml/rules/trends/audio/retrieval/platform_fit/gemini) remain removed.
  // -------------------------------------------------
  const apolloOn = deepseek != null; // apollo_score + behavioral_score valid
  const raw_overall_score = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        apolloOn && foldOn
          ? 0.5 * apollo_score + 0.5 * fold_audience_score
          : apolloOn
            ? behavioral_score * weights.behavioral + apollo_score * weights.apollo
            : foldOn
              ? fold_audience_score
              : 0,
      ),
    ),
  );

  // Platt calibration was dropped 2026-05-24 — uncalibrated raw score is the
  // user-facing score. See .planning/phases/15-.../15-DISCUSSION-LOG.md (text-mode
  // eval + corpus-vs-production shape mismatch made the calibration premise unsound).
  const overall_score = raw_overall_score;

  // -------------------------------------------------
  // T1.5 — degradation honesty. When BOTH core signals died (no usable Omni gemini
  // provenance AND DeepSeek/Apollo failed), overall_score above collapses to 0 with
  // zeroed weights — indistinguishable from a confident "will flop" verdict. Flag it so
  // the UI renders a distinct "couldn't analyze" state instead of presenting the 0 as a
  // real score. Same dual-failure condition the HARD-03 confidence floor + warning use
  // below. `availability.gemini` is resolved above (segmented OR factor-fallback path).
  // -------------------------------------------------
  const analysis_unavailable = !availability.gemini && !availability.behavioral;

  // -------------------------------------------------
  // Confidence (with signal availability penalties)
  // -------------------------------------------------
  const hasVideo = payload.input_mode !== "text";
  let conf = calculateConfidence(
    apollo_score, // Plan 03-04 (D-04): Apollo composite-vs-behavioral agreement (replaces gemini)
    behavioral_score,
    ruleResult,
    trendEnrichment,
    hasVideo,
    deepseek?.confidence ?? "low",
    availability
  );

  // HARD-03: Override confidence to LOW when both LLM providers failed.
  // calculateConfidence() incorrectly yields MEDIUM here because both
  // zero-scores produce the same direction (-50), triggering the
  // "models agree" branch (agreement = 0.4). In reality, two zeros
  // agreeing is meaningless — force LOW to reflect actual data quality.
  // Plan 03-04 (D-04): dual failure = Omni (gemini provenance) AND DeepSeek (behavioral/apollo) both failed.
  if (!availability.gemini && !availability.behavioral) {
    conf = { confidence: 0.2, confidence_label: "LOW" };
  }

  // -------------------------------------------------
  // Warnings (from DeepSeek + weight redistribution + low confidence)
  // -------------------------------------------------
  const warnings: string[] = [...(deepseek?.warnings ?? [])];

  // RULE-04: Warn when weights are redistributed.
  // Phase 4: filter to SCORE_WEIGHT_KEYS so that the new content_type/niche
  // provenance keys (which do NOT participate in weight math) don't trigger
  // spurious "weights redistributed" warnings.
  const weightingEntries = (
    Object.entries(availability) as Array<[string, boolean]>
  ).filter(([key]) => (SCORE_WEIGHT_KEYS as readonly string[]).includes(key));
  if (weightingEntries.some(([, v]) => !v)) {
    const missingSources = weightingEntries
      .filter(([, v]) => !v)
      .map(([k]) => k);
    warnings.push(
      `Weights redistributed — missing signals: ${missingSources.join(", ")}`
    );
  }

  // HARD-03: Explicit dual-failure warning. Post-strip (Plan 01) rules + trends are
  // gone, so when both LLM signals fail there is no model signal left at all.
  if (!availability.gemini && !availability.behavioral) {
    warnings.push(
      "Both LLM providers failed — this result is unreliable and should not be trusted"
    );
  }

  if (conf.confidence < 0.4) {
    warnings.push("Low confidence \u2014 limited signal data");
  }

  // -------------------------------------------------
  // Factors (from Gemini — v2 shape with rationale/improvement_tip)
  // D-R1 (2026-06-11): the Read no longer emits factors on video → empty array. Board re-sources
  // "What drives it" off Apollo dimensions (Phase 2, F32). Text/legacy rows still carry factors.
  // -------------------------------------------------
  const factors: Factor[] = (gemini.factors ?? []).map((f, i) => ({
    id: `factor-${i + 1}`,
    name: f.name,
    score: f.score,
    max_score: 10,
    rationale: f.rationale,
    improvement_tip: f.improvement_tip,
  }));

  // -------------------------------------------------
  // Suggestions (from DeepSeek)
  // -------------------------------------------------
  const suggestions: Suggestion[] = (deepseek?.suggestions ?? []).map(
    (s, i) => ({
      id: `suggestion-${i + 1}`,
      ...s,
    })
  );

  // -------------------------------------------------
  // Cost tracking
  // CR-01: include Wave 3 (multi-persona) cost so eval-runner cost-cap math operates on
  // the true total spend. The pipeline surfaces `wave3CostCents` from Wave 3's orchestrator;
  // without folding it here, every prediction silently under-reports cost by ~0.5-2.5 cents
  // and the eval-runner cap (`prediction.cost_cents > cap`) never sees Wave 3 spend.
  // -------------------------------------------------
  const cost_cents =
    Math.round(
      (geminiResult.cost_cents
        + (deepseekResult?.cost_cents ?? 0)
        + pipelineResult.wave3CostCents) * 10000
    ) / 10000;

  // -------------------------------------------------
  // Behavioral predictions — fold is the sole audience-sim source (Phase 4 Plan 05).
  // "personas" option removed (10-pass deleted). "deepseek" override still accepted
  // for eval harness back-compat (pass behavioralSource:"deepseek" to skip fold).
  // Priority: fold (when succeeded) → deepseek.behavioral_predictions → FALLBACK_BEHAVIORAL.
  // -------------------------------------------------
  const behavioralSource = options?.behavioralSource ?? "fold";
  const FALLBACK_BEHAVIORAL = {
    completion_pct: 0,
    completion_percentile: "N/A",
    share_pct: 0,
    share_percentile: "N/A",
    comment_pct: 0,
    comment_percentile: "N/A",
    save_pct: 0,
    save_percentile: "N/A",
  } as const;

  // Fold path: derive behavioral aggregate from fold-adapted PersonaSimulationResult[].
  // aggregatePersonaResults is called here (not pre-aggregated on PipelineResult) to keep
  // fold.ts free of aggregator coupling. When fold failed → deepseek fallback → FALLBACK.
  // Callers that explicitly pass behavioralSource:"deepseek" bypass fold (eval back-compat).
  const behavioral_predictions = (() => {
    if (behavioralSource !== "deepseek" && pipelineResult.foldOutcome?.fold_success) {
      const { aggregate } = aggregatePersonaResults(pipelineResult.foldOutcome.personaSimResults);
      if (aggregate !== null) return aggregate;
    }
    return deepseek?.behavioral_predictions ?? FALLBACK_BEHAVIORAL;
  })();

  // predicted_engagement removed (Plan 02, D1.1, R9): engagement jitter derivation deleted.
  // Field set null below; UI card already null-guarded (Plan 01 reverify #5 confirmed).
  // Will be regrounded in Plan 05.

  // -------------------------------------------------
  // Heatmap + weighted_* fields — sourced from fold (Phase 4 Plan 05).
  // pass2Outcome always null (10-pass deleted). Fold provides pass2Results via adapter.
  // Falls through to heatmap=null / weighted_*=null when fold failed or no segments.
  // -------------------------------------------------
  const omniSegments = pipelineResult.segments;

  // Phase 2 (R1) — derive verbatim.segments from omniSegments now that they are available.
  // Each SegmentGrid carries spoken_text/on_screen_text (Plan 01 SegmentSchema extension).
  // D-02: spoken_text null for silence; D-04.2: [inaudible] preserved as string, never coerced.
  // Synthetic fallback segments (buildFixedBuckets) legitimately have null verbatim — no invented text.
  if (omniSegments && omniSegments.length > 0) {
    try {
      const verbatimSegments = omniSegments.map((seg, i) => {
        const s = seg as unknown as {
          idx?: number;
          spoken_text?: string | null;
          on_screen_text?: string | null;
        };
        return {
          idx: s.idx ?? i,
          spoken_text: s.spoken_text ?? null,
          on_screen_text: s.on_screen_text ?? null,
        };
      });

      // Only populate verbatim.segments when any segment carries non-null text.
      // (All-null segments array = video with no speech/on-screen text = verbatim stays null/hook-only)
      const hasAnyText = verbatimSegments.some(
        (s) => s.spoken_text !== null || s.on_screen_text !== null,
      );

      if (hasAnyText) {
        verbatim = verbatim
          ? { ...verbatim, segments: verbatimSegments }
          : { segments: verbatimSegments };
      }
    } catch {
      // non-fatal — verbatim stays as-is (hook-only or null)
    }
  }

  let heatmap: HeatmapPayload | null = null;
  let weighted_completion_pct: number | null = null;
  let weighted_top_dropoff_t: number | null = null;
  let weighted_hook_score: number | null = null;

  // Phase 4 Plan 05: heatmap always sourced from fold (10-pass deleted).
  // D-11/D-12: buildWeightedCurve + assembleHeatmapPayload unchanged; only input source changed.
  const heatmapPass2Results =
    pipelineResult.foldOutcome?.fold_success
      ? pipelineResult.foldOutcome.pass2Results
      : null;

  const heatmapAggregateBuilt =
    pipelineResult.foldOutcome?.fold_success === true && (heatmapPass2Results?.length ?? 0) > 0;

  if (heatmapAggregateBuilt && heatmapPass2Results && heatmapPass2Results.length > 0 && omniSegments && omniSegments.length > 0) {
    // Resolve persona weights (default mix unless niche override exists).
    // Phase 3 Plan 08: niche primary_slug from wave0Result (may be null → default mix).
    const { weights: personaWeights, source: weightsSource } = resolveWeights(
      DEFAULT_PERSONA_WEIGHT_CONFIG,
      { niche: pipelineResult.wave0Result.niche?.primary_slug ?? undefined },
    );
    // Build retention curve scalars (D-12)
    const curveResult = buildWeightedCurve(heatmapPass2Results, omniSegments, personaWeights);
    weighted_completion_pct = curveResult.weighted_completion_pct;
    weighted_top_dropoff_t  = curveResult.weighted_top_dropoff_t;
    weighted_hook_score     = curveResult.weighted_hook_score;
    // Assemble full HeatmapPayload (D-13) — WR-07: pass curveResult to avoid
    // a second buildWeightedCurve call inside assembleHeatmapPayload.
    heatmap = assembleHeatmapPayload(heatmapPass2Results, omniSegments, personaWeights, weightsSource, curveResult);
  }

  // -------------------------------------------------
  // Phase 3 (Plan 08) — isAntiViralityGatedFull: dual-trigger OR logic.
  // Replaces isAntiViralityGated(confidence) initial value; re-applied POST-critique below.
  // -------------------------------------------------
  const avGateFull = isAntiViralityGatedFull(conf.confidence, heatmap);

  // -------------------------------------------------
  // Assemble PredictionResult
  // -------------------------------------------------
  const result: PredictionResult = {
    overall_score,
    confidence: conf.confidence,
    confidence_label: conf.confidence_label,
    behavioral_predictions,
    feature_vector,
    reasoning: "", // DeepSeek reasoning text — not exposed in current schema
    // Plan 03-04 (D-04): Apollo §4 output surfaced for variants.apollo persist (route.ts).
    // Null when deepseek unavailable (circuit breaker open or failed).
    apollo_reasoning: deepseek && deepseek.rewrites && deepseek.dimensions && deepseek.composite_score !== undefined
      ? {
          rewrites: deepseek.rewrites,
          dimensions: deepseek.dimensions,
          composite_score: deepseek.composite_score,
          // IN-02: ceiling_capper is the highest-leverage insight and the
          // insight-hero's intended LEAD — it was being dropped here, so the
          // frame always fell back to confidence_scope. platform_note carries the
          // watermark/cross-post warning. Both are part of the §4 contract.
          // `|| undefined` (not `?? ""`): keep the optional contract honest — an
          // empty capper degrades to absent so the hero falls back to confidence_scope,
          // never persists a falsy-but-present "" that a strict consumer could misread.
          ceiling_capper: deepseek.ceiling_capper || undefined,
          confidence_scope: deepseek.confidence_scope ?? "",
          platform_note: deepseek.platform_note,
        }
      : null,
    warnings,
    // R11 (Plan 05-02): grounded range = follower_count × quality read. Null when no creator baseline (R9).
    // LIVE-RESULTS-ONLY this phase — NOT persisted (no DB column, no buildInsertRow entry, no route.ts change).
    // Permalink reload correctly shows no range (live in-memory result only; persistence deferred, D-06).
    predicted_engagement: computeEngagementRange(pipelineResult.creatorContext, overall_score) ?? null,
    factors,
    suggestions,
    rule_score: ruleResult.rule_score,   // retained in type; ruleResult always fallback 50 (Plan 03 strip)
    trend_score: trendEnrichment.trend_score, // retained in type; always 0 (Plan 03 strip)
    gemini_score,
    behavioral_score,
    ml_score: 0, // Plan 04 (R9): ml key removed from blend; field retained in type for back-compat
    // Phase 6 (D-G3) — pre-boost audio_perceptual_score. The fingerprint boost
    // is folded into audio_score (internal) before the weighted sum; consumers
    // who want the perceptual baseline read this field directly.
    audio_perceptual_score,
    // Phase 6 (D-G1) — full fingerprint match record or null.
    audio_fingerprint: audioFingerprintResult,
    // Phase 6 (Note 7 / Q4 RESOLVED) — verbatim audio_description for
    // persistence into analysis_results.audio_description (route.ts pluck).
    audio_description,
    // Phase 1 (R1.7) — emotion arc timeline plucked from Omni Plus output above.
    // Null when video absent or Qwen omitted the field; non-fatal per Pitfall #5.
    emotion_arc,
    // Phase 2 (R1) — verbatim transcription (hook + per-segment) from Omni.
    // Null when video absent, no speech/on-screen text, or Qwen omitted the fields.
    // Non-fatal: absence doesn't break the pipeline.
    verbatim,
    // Phase 2 (Quick 260528-nqx) — hook_decomposition surfaced from Gemini analysis.
    hook_decomposition,
    // Content-craft signals for the board "Content craft" frame. Surfaced here so
    // the analyze route persists them into variants.craft (no DB column / migration).
    video_signals: craft_video_signals,
    cta_segment: craft_cta_segment,
    audio_signals: craft_audio_signals,
    overall_impression: craft_overall_impression,
    content_summary: craft_content_summary,
    // Phase 1 (R1.9, B4) + Phase 3 (Plan 08) — anti-virality gate.
    // Initial value computed from PRE-Stage-10 confidence (post-Platt + post-HARD-03).
    // Phase 3: uses dual-trigger isAntiViralityGatedFull (avGateFull computed above).
    // Re-evaluated POST-critique below (Pitfall 7 ordering invariant).
    anti_virality_gated: avGateFull.gated,
    // T1.5 — degradation honesty flag (computed above from the dual-failure condition).
    // Not adjusted post-critique: it reflects raw signal availability, not confidence.
    analysis_unavailable,
    // Phase 3 (Plan 08) — reason + dropoff indices from dual-trigger gate.
    // null when not gated or when heatmap absent (confidence-only path).
    anti_virality_reason: avGateFull.reason,
    dropoff_segment_indices: avGateFull.dropoff_segment_indices,
    // Phase 3 (Plan 08) — heatmap + weighted retention metrics. Null when Pass 2
    // below SUCCESS_THRESHOLD or text/tiktok_url mode (no segments).
    heatmap,
    weighted_completion_pct,
    weighted_top_dropoff_t,
    weighted_hook_score,
    // Phase 1 (R6.1, D-13) — optimal_post_window plucked from niche_post_windows
    // above (BEFORE Stage 10/11 per Pitfall #5). null on Supabase error,
    // FALLBACK on unknown niche, OptimalPostWindow with source='niche' on hit.
    optimal_post_window,
    // score_weights: behavioral + apollo blend (Plan 03-04, D-04). Dead keys set to 0 for back-compat.
    // gemini: 0 marks it retired from blend (provenance only). apollo is the new live term.
    score_weights: { ...weights, ml: 0, rules: 0, trends: 0, gemini: 0 },
    latency_ms: pipelineResult.total_duration_ms,
    cost_cents,
    engine_version: ENGINE_VERSION,
    gemini_model: GEMINI_MODEL,
    deepseek_model: deepseekResult ? DEEPSEEK_MODEL : null,
    input_mode: pipelineResult.payload.input_mode,
    has_video: hasVideo,
    signal_availability: availability, // Phase 3 — provenance surfaced for route to persist
    // Phase 7 — persona_behavioral_aggregate surfaced from pipelineResult so downstream
    // consumers (route persistence, audience-viz in M2) get the canonical aggregate.
    // persona_simulation_results carries per-persona detail used by M2's retention curve
    // (scroll_past_second, watch_through_pct per persona) — see PERSONA-11.
    persona_behavioral_aggregate: pipelineResult.personaBehavioralAggregate ?? null,
    persona_simulation_results: pipelineResult.wave3Result,
    // Phase 8 D-11 — retrieval signal output. Persisted to
    // analysis_results.retrieval_score (NUMERIC(5,4) nullable) and
    // analysis_results.retrieval_evidence (JSONB). M2 renders evidence in
    // the "similar videos" panel without further DB joins (D-02).
    retrieval_score: pipelineResult.retrievalResult.score,
    retrieval_evidence: pipelineResult.retrievalResult.evidence,
    // Plan 04 (R9): platform_fit key removed from blend; field set null.
    // platform_fit module moves to _dormant/ in Plan 05; field retained in type for back-compat.
    platform_fit: null,
  };

  // -------------------------------------------------
  // Phase 9 — Stage 10: Self-critique pass (grading aggregator output for consistency).
  // Runs AFTER aggregateScores populates overall_score/confidence. The critique adjusts
  // confidence downward (clamped to [-0.20, 0]) via applyCritiqueAdjustment.
  // Stage 10 result is surfaced in PredictionResult.critique.
  // -------------------------------------------------
  // Stage 10 (critique) and Stage 11 (counterfactuals) are independent LLM calls
  // — run them CONCURRENTLY to halve the post-pipeline tail (previously ~serial
  // 45-60s + 30s). Stage 11 reads pre-critique confidence purely as prompt
  // context; its suggestion band is score-based (overall_score, unchanged by
  // critique), so the small critique delta does not change the output. The
  // LIKELY_FLOP check below still runs on POST-critique confidence, and the
  // anti-virality gate is still recomputed from post-critique confidence —
  // Pitfall 7 ordering invariant preserved.
  // board-fix #1: time stage10.
  // Stage 11 slot removed (Plan 02, R9): stage11 call deleted from Promise.all;
  // counterfactuals stays null. stage11-counterfactuals.ts moves to _dormant/ in Plan 05.
  // Stage 10 (deterministic TS, sub-ms) is KEPT — owns the final score/confidence/gate (Plan 04 scope).
  // deferCounterfactuals option kept in AggregateScoresOptions for back-compat but no longer used.
  const tStages = performance.now();
  const critiqueResult = await (async () => {
    const t = performance.now();
    const r = await runStage10Critique(result, onStageEvent);
    log.info("stage_timing", { stage: "stage10_critique", ms: Math.round(performance.now() - t) });
    return r;
  })();
  const counterfactualResult = null; // stage11 removed (Plan 02)
  log.info("stage_timing", { stage: "stage10_wall", ms: Math.round(performance.now() - tStages) });

  if (critiqueResult) {
    result.confidence = applyCritiqueAdjustment(result.confidence, critiqueResult);
    // Phase 1 (R1.9, B4) + Phase 3 (Plan 08) — re-evaluate anti-virality gate AFTER critique
    // adjustment so the UI flag matches the final (POST-CRITIQUE) confidence
    // value displayed to the user. Aligns with `maybeAppendLikelyFlopWarning`
    // which also reads POST-CRITIQUE confidence (Pitfall 7 ordering invariant).
    // Phase 3: uses isAntiViralityGatedFull to preserve heatmap dual-trigger.
    const postCritiqueAvGate = isAntiViralityGatedFull(result.confidence, result.heatmap ?? null);
    result.anti_virality_gated = postCritiqueAvGate.gated;
    result.anti_virality_reason = postCritiqueAvGate.reason;
    result.dropoff_segment_indices = postCritiqueAvGate.dropoff_segment_indices;
  }
  result.critique = critiqueResult;

  if (counterfactualResult) {
    result.counterfactuals = counterfactualResult;
  }

  // Pure-TS LIKELY_FLOP check — uses POST-CRITIQUE confidence per Pitfall 7.
  maybeAppendLikelyFlopWarning(result);

  return result;
}
