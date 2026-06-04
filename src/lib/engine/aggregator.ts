import type {
  AudioFingerprintResult,
  AudioPerceptualResult,
  ConfidenceLevel,
  ContentTypeSlug,
  CtaSegmentResult,
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
import type { EmotionArcPoint } from "./qwen/schemas";
import type { HookDecomposition } from "./types";
import type { PipelineResult } from "./pipeline";
import type { StageEventCallback } from "./events";
import { QWEN_OMNI_MODEL as GEMINI_MODEL } from "./qwen/client";
import { QWEN_REASONING_MODEL as DEEPSEEK_MODEL } from "./qwen/client";
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

const log = createLogger({ module: "aggregator" });

/** Re-export ENGINE_VERSION for back-compat — existing consumers `import { ENGINE_VERSION } from "./aggregator"` keep working. */
export { ENGINE_VERSION };

// =====================================================
// v2 Score Weights — config-driven for maintainability
// =====================================================

// Plan 04 (R9) — blend reduced to behavioral + gemini only (dead keys removed).
// Dead keys: ml=0, rules=0, trends=0.10 (trend_score always 0 post-Plan03 strip),
// audio=0.05, retrieval=0, platform_fit=0.05. Removing trends 0.10 redistribution
// produces a small upward score nudge (honesty correction per RESEARCH Pitfall 6);
// measured in Plan 06. applyCtaPenalty KEPT (modifies live gemini term — not a dead key,
// Pitfall 7 / Open Q1).
// Exported for test introspection (aggregator.test.ts, aggregator-audio.test.ts).
export const SCORE_WEIGHTS = {
  behavioral: 0.40,  // primary CoT, video-aware via Wave 2 input
  gemini:     0.35,  // video understanding; CTA penalty applied before blend
} as const;

// Plan 04 (R9) — SCORE_WEIGHT_KEYS reduced to the two live signals. Dead keys
// (ml, rules, trends, audio, retrieval, platform_fit) removed. selectWeights
// iterates ONLY these keys; all SignalAvailability provenance fields (content_type,
// niche, gemini_hook, etc.) continue to NOT participate in weight math.
export const SCORE_WEIGHT_KEYS = ["behavioral", "gemini"] as const;

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
// Signal Availability & Dynamic Weight Selection (RULE-04)
// =====================================================
// SignalAvailability interface lives in ./types (Phase 3 — D-07).
// Aggregator computes the values; route layer persists them via PredictionResult.

/**
 * Select weights for the behavioral + gemini 2-key blend.
 * When a source is missing its weight redistributes to the remaining source
 * so weights always sum to ~1.0. Dead keys (ml, rules, trends, audio,
 * retrieval, platform_fit) removed in Plan 04 (R9).
 *
 * Exported for benchmarking and testing.
 */
export function selectWeights(
  availability: SignalAvailability
): {
  behavioral: number;
  gemini: number;
} {
  const behavioralOn = availability.behavioral;
  const geminiOn = availability.gemini;

  // Both sources available — normalize base weights (0.40 + 0.35 = 0.75).
  if (behavioralOn && geminiOn) {
    const baseSum = SCORE_WEIGHTS.behavioral + SCORE_WEIGHTS.gemini;
    return {
      behavioral: Math.round((SCORE_WEIGHTS.behavioral / baseSum) * 1000) / 1000,
      gemini:     Math.round((SCORE_WEIGHTS.gemini     / baseSum) * 1000) / 1000,
    };
  }

  // One source missing — full weight goes to the available source.
  if (behavioralOn && !geminiOn) return { behavioral: 1, gemini: 0 };
  if (!behavioralOn && geminiOn) return { behavioral: 0, gemini: 1 };

  // Both unavailable — all zeros.
  return { behavioral: 0, gemini: 0 };
}

// =====================================================
// Confidence Calculation
// =====================================================

/**
 * Calculate numeric confidence (0-1) based on:
 * 1. Signal availability (0-0.6) — how much data we have
 * 2. Model agreement (0-0.4) — do the Qwen omni (vision) and reasoning signals agree on direction
 *
 * RULE-04: Penalizes confidence when rules/trends signals are missing.
 */
function calculateConfidence(
  geminiScore: number,
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
  const geminiDirection = geminiScore - 50;
  const behavioralDirection = behavioralScore - 50;
  let agreement: number;

  if (
    (geminiDirection >= 0 && behavioralDirection >= 0) ||
    (geminiDirection < 0 && behavioralDirection < 0)
  ) {
    // Same sign — both models agree on direction
    agreement = 0.4;
  } else if (Math.abs(geminiDirection - behavioralDirection) <= 15) {
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
    gemini.factors.find((f) => f.name === name);

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
 * Phase 7 D-14 (lightweight A/B eval). Default "deepseek" → production read.
 * Phase 10 owns the eventual production swap based on D-14 corpus evidence.
 * Phase 13 D-01 / D-18 — Plan 03 pipeline.ts uploads video once at entry,
 * threads fileUri through here. Plan 02 leaves this optional; Plan 03 callsite
 * supplies real values.
 */
export interface AggregateScoresOptions {
  behavioralSource?: "deepseek" | "personas";
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

  // -------------------------------------------------
  // Phase 6 D-F3 — single source of truth for matched_trends.
  //
  // When the audio_fingerprint stage matched a sound, trends.ts (Plan 06-05)
  // skipped its Jaro-Winkler caption ↔ sound_name fallback loop. We synthesize
  // an equivalent matched_trends entry from the fingerprint result so downstream
  // consumers (signal_availability.trends, assembleFeatureVector fallback path)
  // see a unified view. NEVER mutate the input pipelineResult — derive a fresh
  // TrendEnrichment shape for aggregator-local use.
  // -------------------------------------------------
  const enrichedMatchedTrends =
    audioFingerprintResult !== null && trendEnrichment.matched_trends.length === 0
      ? [
          ...trendEnrichment.matched_trends,
          {
            sound_name: audioFingerprintResult.sound_name,
            velocity_score: audioFingerprintResult.velocity_score,
            trend_phase: audioFingerprintResult.trend_phase,
          },
        ]
      : trendEnrichment.matched_trends;

  const effectiveTrendEnrichment: TrendEnrichment = {
    ...trendEnrichment,
    matched_trends: enrichedMatchedTrends,
  };

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
  // ML prediction (async — loads model from Supabase Storage on cold start)
  // -------------------------------------------------
  // Phase 6 D-F3: feed effectiveTrendEnrichment so FeatureVector.audioTrendingMatch
  // sees the synthesized matched_trends entry on fallback. assembleFeatureVector
  // reads pipelineResult.audioFingerprintResult independently for the priority
  // source (D-G4); the trend_enrichment slot is the fallback source-of-data.
  // Plan 03: trendEnrichment removed from PipelineResult; pass pipelineResult directly.
  // effectiveTrendEnrichment is already the fallback default (always empty) now.
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
  // Signal availability — behavioral + gemini (the two blend keys).
  // All other keys (ml, rules, trends, audio, retrieval, platform_fit) removed
  // from the blend in Plan 04 (R9). Provenance flags (content_type, niche,
  // gemini_hook/body/cta, personas, audio, audio_fingerprint, retrieval,
  // platform_fit, pass2_timeline) are preserved on the struct so they continue
  // to be persisted to analysis_results.signal_availability JSONB and surfaced
  // in the UI; they simply no longer participate in selectWeights math.
  // -------------------------------------------------
  const availability: SignalAvailability = {
    behavioral: deepseekResult !== null,
    // Placeholder — overwritten below after per-segment availability is resolved.
    // HARD-03 fallback (factors.some(score > 0)) kicks in only when signalAvailability undefined.
    gemini: false,
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
    pass2_timeline: pipelineResult.pass2Outcome?.pass2_aggregate_built ?? false,
  };

  // Phase 5 D-12: derived `gemini` key.
  // - Segmented path (signalAvailability present): gemini = hook || body || cta.
  // - Legacy text + tiktok_url paths (signalAvailability undefined): HARD-03 fallback —
  //   the value is `true` when at least one Gemini factor scored > 0.
  availability.gemini = pipelineResult.geminiResult.signalAvailability
    ? availability.gemini_hook || availability.gemini_body || availability.gemini_cta
    : geminiResult.analysis.factors.some((f) => f.score > 0);

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
  // Gemini score (0.35 base weight → ≈46.7% normalized post-strip)
  // Source: Gemini's 5 factor scores, each 0-10
  // -------------------------------------------------
  const geminiAvg =
    gemini.factors.reduce((sum, f) => sum + f.score, 0) /
    gemini.factors.length;
  const gemini_score = Math.round(geminiAvg * 10); // Normalize to 0-100

  // -------------------------------------------------
  // Phase 5 D-06: Apply CTA penalty to gemini_score.
  // Reads wave0Result.content_type.type (Phase 4) × geminiResult.analysis.cta_segment
  // (Phase 5 mergeSegments). Pure function — does NOT modify SCORE_WEIGHTS or
  // selectWeights (those stay stable per Phase 4 Cross-File Constraint #3).
  //
  // Two separate values flow downstream:
  //   - `gemini_score` (UNCHANGED here) → exposed on PredictionResult.gemini_score
  //     so the M2 UI breakdown card shows the model's raw Gemini average.
  //   - `ctaPenaltyApplied_gemini_score` → feeds raw_overall_score below so the
  //     final number reflects the CTA-expectation penalty for tutorial/b_roll content.
  // -------------------------------------------------
  const widenedGemini = gemini as typeof gemini & { cta_segment?: CtaSegmentResult | null };
  const ctaPenaltyApplied_gemini_score = applyCtaPenalty(
    gemini_score,
    contentTypeSlug,
    widenedGemini.cta_segment ?? null,
  );
  // Phase 5 IN-03: emit a pipeline_warning breadcrumb when the CTA penalty
  // actually fired. Keeps applyCtaPenalty pure (no side-effects) by computing
  // the delta and routing the event through the aggregator's onStageEvent
  // channel. Phase 10 ML audit (CONTEXT D-06) needs the penalty firing rate
  // for magnitude calibration — without this breadcrumb, the only evidence
  // is reconstructing it from `gemini_score` vs `overall_score` deltas, which
  // is fragile across rule/trend/ml interactions.
  if (ctaPenaltyApplied_gemini_score < gemini_score) {
    const penaltyDelta = gemini_score - ctaPenaltyApplied_gemini_score;
    onStageEvent?.({
      type: "pipeline_warning",
      stage: "cta_penalty_applied",
      message: `CTA penalty fired: ${penaltyDelta} points deducted from gemini_score (content_type=${contentTypeSlug}, cta_present=false). Pre-penalty=${gemini_score}, post-penalty=${ctaPenaltyApplied_gemini_score}.`,
    });
  }

  // -------------------------------------------------
  // Overall score — behavioral + gemini blend (Plan 04, R9).
  // Dead terms (ml, rules, trends, audio, retrieval, platform_fit) removed.
  // applyCtaPenalty applied to gemini before the blend (D-06, Pitfall 7 KEPT).
  // -------------------------------------------------
  const raw_overall_score = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        behavioral_score * weights.behavioral +
          ctaPenaltyApplied_gemini_score * weights.gemini // Phase 5 D-06 — CTA penalty flows here
      )
    )
  );

  // Platt calibration was dropped 2026-05-24 — uncalibrated raw score is the
  // user-facing score. See .planning/phases/15-.../15-DISCUSSION-LOG.md (text-mode
  // eval + corpus-vs-production shape mismatch made the calibration premise unsound).
  const overall_score = raw_overall_score;

  // -------------------------------------------------
  // Confidence (with signal availability penalties)
  // -------------------------------------------------
  const hasVideo = payload.input_mode !== "text";
  let conf = calculateConfidence(
    gemini_score,
    behavioral_score,
    ruleResult,
    effectiveTrendEnrichment,
    hasVideo,
    deepseek?.confidence ?? "low",
    availability
  );

  // HARD-03: Override confidence to LOW when both LLM providers failed.
  // calculateConfidence() incorrectly yields MEDIUM here because both
  // zero-scores produce the same direction (-50), triggering the
  // "models agree" branch (agreement = 0.4). In reality, two zeros
  // agreeing is meaningless — force LOW to reflect actual data quality.
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
  // -------------------------------------------------
  const factors: Factor[] = gemini.factors.map((f, i) => ({
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
  // Behavioral predictions (single source of truth for result + engagement)
  // Phase 7 D-08 + D-14: production read is unchanged (default behavioralSource "deepseek").
  // The optional "personas" override is the eval-harness A/B substrate; production callers
  // never pass this option, so default behavior matches pre-Phase-7 byte-for-byte.
  // -------------------------------------------------
  const behavioralSource = options?.behavioralSource ?? "deepseek";
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

  const behavioral_predictions =
    behavioralSource === "personas" && pipelineResult.personaBehavioralAggregate !== null
      ? pipelineResult.personaBehavioralAggregate
      : (deepseek?.behavioral_predictions ?? FALLBACK_BEHAVIORAL);

  // predicted_engagement removed (Plan 02, D1.1, R9): engagement jitter derivation deleted.
  // Field set null below; UI card already null-guarded (Plan 01 reverify #5 confirmed).
  // Will be regrounded in Plan 05.

  // -------------------------------------------------
  // Phase 3 (Plan 08) — Pass 2 timeline → heatmap + weighted_* fields.
  // Only runs when pass2_aggregate_built=true AND segments are present.
  // Pass 1 fallback: heatmap=null, weighted_*=null.
  // -------------------------------------------------
  const pass2Outcome = pipelineResult.pass2Outcome;
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

  if (pass2Outcome?.pass2_aggregate_built && omniSegments && omniSegments.length > 0) {
    // Resolve persona weights (default mix unless niche override exists).
    // Phase 3 Plan 08: niche primary_slug from wave0Result (may be null → default mix).
    const { weights: personaWeights, source: weightsSource } = resolveWeights(
      DEFAULT_PERSONA_WEIGHT_CONFIG,
      { niche: pipelineResult.wave0Result.niche?.primary_slug ?? undefined },
    );
    // Build retention curve scalars (D-12)
    const curveResult = buildWeightedCurve(pass2Outcome.pass2Results, omniSegments, personaWeights);
    weighted_completion_pct = curveResult.weighted_completion_pct;
    weighted_top_dropoff_t  = curveResult.weighted_top_dropoff_t;
    weighted_hook_score     = curveResult.weighted_hook_score;
    // Assemble full HeatmapPayload (D-13) — WR-07: pass curveResult to avoid
    // a second buildWeightedCurve call inside assembleHeatmapPayload.
    heatmap = assembleHeatmapPayload(pass2Outcome.pass2Results, omniSegments, personaWeights, weightsSource, curveResult);
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
    warnings,
    predicted_engagement: null, // Plan 02 D1.1: sine-jitter fabrication deleted; field null until Plan 05 regrounding
    factors,
    suggestions,
    rule_score: ruleResult.rule_score,   // retained in type; ruleResult always fallback 50 (Plan 03 strip)
    trend_score: effectiveTrendEnrichment.trend_score, // retained in type; always 0 (Plan 03 strip)
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
    // score_weights: 2-key blend (Plan 04 R9). Dead keys set to 0 for back-compat with
    // PredictionResult.score_weights type (types.ts still includes ml/rules/trends).
    score_weights: { ...weights, ml: 0, rules: 0, trends: 0 },
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
