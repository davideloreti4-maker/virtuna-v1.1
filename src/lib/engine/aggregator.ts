import type {
  AudioPerceptualResult,
  BehavioralPredictions,
  ConfidenceLevel,
  ContentTypeSlug,
  CtaSegmentResult,
  Factor,
  FeatureVector,
  GeminiVideoSignals,
  PersonaBehavioralAggregate,
  PlatformFitResult,
  PredictedEngagement,
  PredictionResult,
  RuleScoreResult,
  SignalAvailability,
  Suggestion,
  TrendEnrichment,
} from "./types";
import type { PipelineResult } from "./pipeline";
import type { StageEventCallback } from "./events";
import { GEMINI_MODEL } from "./gemini";
import { DEEPSEEK_MODEL } from "./deepseek";
import { predictWithML, featureVectorToMLInput } from "./ml";
import { getPlattParameters, applyPlattScaling, type PlattParameters } from "./calibration";
import { ENGINE_VERSION } from "./version";
import { runStage10Critique, applyCritiqueAdjustment } from "./stage10-critique";
import { runStage11Counterfactuals, maybeAppendLikelyFlopWarning } from "./stage11-counterfactuals";
import { applyContentTypeWeights } from "./wave0/content-type-weights";
import { computeAudioPerceptualScore } from "./audio-perceptual";

/** Re-export ENGINE_VERSION for back-compat — existing consumers `import { ENGINE_VERSION } from "./aggregator"` keep working. */
export { ENGINE_VERSION };

// =====================================================
// v2 Score Weights — config-driven for maintainability
// =====================================================

// D-16 (Phase 13) — re-tuned for video-mode reality.
// Sources: CONTEXT D-14 (rules=0), D-15 (retrieval=0), D-16 (redistribution).
// Audio weight 0.05 per CONTEXT D-16 conditional on trending_sounds population (D-32).
// See .planning/phases/13-.../13-01-SUMMARY.md for trending_sounds count + decision.
// trending_sounds table: 0 rows (2026-05-22). User decision: audio=0.05 (conservative
// weight; audio_perceptual_score from Gemini is real but fingerprint match contributes 0).
// Exported for test introspection (aggregator-audio.test.ts, aggregator.test.ts).
export const SCORE_WEIGHTS = {
  behavioral:   0.40,  // primary CoT, video-aware via Wave 2 input
  gemini:       0.35,  // drives Stage 11 too; video understanding is core
  audio:        0.05,  // D-32 — audio_perceptual_score real; fingerprint match 0 (trending_sounds empty); user decision 2026-05-22
  trends:       0.10,  // audio-fingerprint based, video-derived
  platform_fit: 0.05,  // video-derived from Wave 4
  ml:           0,     // disabled — Phase 10
  retrieval:    0,     // disabled this phase — D-15 (corpus caption-derived)
  rules:        0,     // disabled this phase — D-14 (all regex rules operate on caption text)
} as const;

// PATTERNS Critical Cross-File Constraint #1 (Phase 8) + #3 (Phase 4 + Phase 6):
// selectWeights() must iterate ONLY weight-bearing SCORE_WEIGHTS keys.
// - Phase 4 widened SignalAvailability with content_type + niche provenance keys
//   (D-20) — those do NOT participate in weight math (provenance only).
// - Phase 6 (D-G1) adds `audio` (weight-bearing) but does NOT add `audio_fingerprint`
//   (provenance only; the fingerprint boost is folded into audio_score before the
//   weighted average, so audio_fingerprint must NOT have its own slot in the math).
// - Phase 8 added `retrieval` as a weight-bearing key — MUST be in this tuple
//   (skipping it silently drops the new 0.05 slot in the filter below).
export const SCORE_WEIGHT_KEYS = ["behavioral", "gemini", "ml", "rules", "trends", "audio", "retrieval", "platform_fit"] as const;
type ScoreWeightKey = (typeof SCORE_WEIGHT_KEYS)[number];

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
 * Select weights based on which signal sources are available.
 * When a source is missing, its weight is redistributed proportionally
 * to the remaining sources so weights always sum to ~1.0.
 *
 * Exported for benchmarking and testing.
 */
export function selectWeights(
  availability: SignalAvailability
): {
  behavioral: number;
  gemini: number;
  ml: number;
  rules: number;
  trends: number;
  audio?: number;
  retrieval?: number;
  platform_fit?: number;
} {
  // Filter Object.entries to ONLY known SCORE_WEIGHTS keys. Phase 4+ extensions
  // that add provenance keys to SignalAvailability (content_type, niche, future
  // hook_decomp) MUST NOT participate in the weight math.
  // PATTERNS Critical Cross-File Constraints #1 (Phase 8) + #3 (Phase 4 + Phase 6).
  // - Phase 6 (D-G1): `audio` IS in SCORE_WEIGHT_KEYS (weight-bearing);
  //   `audio_fingerprint` is NOT (provenance only — the fingerprint boost folds into
  //   audio_score before the weighted average, so it must not get its own slot here).
  // - Phase 8 (D-03b): `retrieval` IS in SCORE_WEIGHT_KEYS (weight-bearing).
  //
  // BACK-COMPAT: SignalAvailability.audio and SignalAvailability.retrieval are both
  // `.optional()` (Phase 6 + Phase 8 declared them optionally to preserve compile
  // against pre-Phase-6/Phase-8 construction sites). When the caller passes a legacy
  // availability object that LACKS one or both of those keys, we treat the missing
  // signal as "not in the math at all" — preserving the legacy base-weight semantics
  // for those callers. When the caller passes the new full shape, every key participates.
  const audioInInput = Object.prototype.hasOwnProperty.call(availability, "audio");
  const retrievalInInput = Object.prototype.hasOwnProperty.call(availability, "retrieval");
  const platformFitInInput = Object.prototype.hasOwnProperty.call(availability, "platform_fit");
  const activeKeys = (SCORE_WEIGHT_KEYS.filter(
    (k) => (k !== "audio" || audioInInput) && (k !== "retrieval" || retrievalInInput) && (k !== "platform_fit" || platformFitInInput),
  ) as readonly ScoreWeightKey[]);

  const filtered = (Object.entries(availability) as Array<[string, boolean]>)
    .filter(([key]) => (activeKeys as readonly string[]).includes(key)) as Array<
    [ScoreWeightKey, boolean]
  >;

  const available = filtered.filter(([, v]) => v);
  const missing = filtered.filter(([, v]) => !v);

  // Phase 6 (D-G1) + Phase 8 (D-03b) normalization contract — see SCORE_WEIGHTS comment above.
  // Raw weights for the 7-key path sum to 1.12; 6-key (no retrieval) sums to 1.07; 5-key
  // legacy path sums to 1.0. The downstream weighted-average math in aggregateScores
  // expects weights to sum to ~1.0 to keep overall_score in [0, 100]. Therefore BOTH
  // branches (all-available + redistribution) normalize via `weight / total * 1000`
  // rounding pass below. The Phase 8 D-03b matrix (behavioral=0.33, gemini=0.24, ml=0.14,
  // rules=0.14, trends=0.10, retrieval=0.05) is the deterministic output of this
  // normalization step applied to the 6-key path (without audio) — i.e., the values
  // tests in Phase 8 assert against.
  type WeightsOut = {
    behavioral: number;
    gemini: number;
    ml: number;
    rules: number;
    trends: number;
    audio?: number;
    retrieval?: number;
    platform_fit?: number;
  };
  const initWeights = (): WeightsOut => {
    const w: WeightsOut = { behavioral: 0, gemini: 0, ml: 0, rules: 0, trends: 0 };
    if (audioInInput) w.audio = 0;
    if (retrievalInInput) w.retrieval = 0;
    if (platformFitInInput) w.platform_fit = 0;
    return w;
  };

  // All sources available — use base weights (normalized below).
  if (missing.length === 0) {
    const baseSum = activeKeys.reduce((s, k) => s + SCORE_WEIGHTS[k], 0);
    const normalized = initWeights();
    for (const key of activeKeys) {
      normalized[key] = Math.round((SCORE_WEIGHTS[key] / baseSum) * 1000) / 1000;
    }
    return normalized;
  }

  // Redistribute missing weight proportionally to available sources
  const missingWeight = missing.reduce(
    (sum, [key]) => sum + SCORE_WEIGHTS[key], 0
  );
  const availableWeight = available.reduce(
    (sum, [key]) => sum + SCORE_WEIGHTS[key], 0
  );

  // Each available source gets its base weight + proportional share of missing weight.
  // initWeights() seeds the audio + retrieval slots only when the caller provided them
  // (back-compat per Phase 6 + Phase 8 .optional() flags).
  const result = initWeights();
  for (const [key, isAvailable] of filtered) {
    if (isAvailable) {
      result[key] = SCORE_WEIGHTS[key] + (SCORE_WEIGHTS[key] / availableWeight) * missingWeight;
    }
    // Missing sources get weight 0
  }

  // Round to avoid floating point noise, ensure they sum to ~1
  const total = Object.values(result).reduce(
    (a: number, b: number | undefined) => a + (b ?? 0),
    0,
  );
  if (total === 0) return result; // All sources unavailable — return all zeros
  for (const key of activeKeys) {
    const v = result[key] ?? 0;
    result[key] = Math.round((v / total) * 1000) / 1000;
  }

  return result;
}

// =====================================================
// Confidence Calculation
// =====================================================

/**
 * Calculate numeric confidence (0-1) based on:
 * 1. Signal availability (0-0.6) — how much data we have
 * 2. Model agreement (0-0.4) — do Gemini and DeepSeek agree on direction
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

  // RULE-04: Confidence penalty for missing signals
  if (!availability.rules) signal -= 0.05;
  if (!availability.trends) signal -= 0.05;

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
  const { payload, geminiResult, deepseekResult, ruleResult, trendEnrichment } =
    pipelineResult;
  const gemini = geminiResult.analysis;
  const deepseek = deepseekResult?.reasoning;
  // Phase 6 D-G4 — fingerprint cosine takes priority over the Jaro-Winkler-derived score.
  const audioFingerprintResult = pipelineResult.audioFingerprintResult;

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

// =====================================================
// Predicted Engagement Generation (RES-2)
// =====================================================

/**
 * Generate realistic predicted engagement numbers from the viral score
 * and behavioral predictions. Numbers are intentionally non-round to feel
 * authentic (e.g., 12.4K not 12,000).
 *
 * Base view range: 5K-500K scaled by overall_score.
 * Engagement rates derived from behavioral_predictions percentages.
 */
function computePredictedEngagement(
  overallScore: number,
  behavioral: { share_pct: number; comment_pct: number; save_pct: number; completion_pct: number },
): PredictedEngagement {
  // Deterministic jitter from score (avoids true randomness for reproducibility)
  const jitter = (seed: number) => {
    const x = Math.sin(seed * 12.9898 + overallScore * 78.233) * 43758.5453;
    return x - Math.floor(x); // 0-1
  };

  // Base views: exponential curve from score (low scores get ~5K, high scores get ~200K+)
  const scoreNorm = overallScore / 100;
  const baseViews = Math.round(
    5000 + (scoreNorm ** 2.2) * 450000 * (0.8 + jitter(1) * 0.4)
  );

  // Like rate: 3-12% of views, influenced by score
  const likeRate = 0.03 + scoreNorm * 0.09 + jitter(2) * 0.02;
  const likes = Math.round(baseViews * likeRate);

  // Comment rate: from behavioral prediction (0.5-3% typical)
  const commentRate = Math.max(0.005, (behavioral.comment_pct / 100) * (0.6 + jitter(3) * 0.3));
  const comments = Math.round(baseViews * commentRate);

  // Share rate: from behavioral prediction (0.2-2% typical)
  const shareRate = Math.max(0.002, (behavioral.share_pct / 100) * (0.5 + jitter(4) * 0.3));
  const shares = Math.round(baseViews * shareRate);

  // Save rate: from behavioral prediction (0.5-4% typical)
  const saveRate = Math.max(0.005, (behavioral.save_pct / 100) * (0.7 + jitter(5) * 0.3));
  const saves = Math.round(baseViews * saveRate);

  return { likes, comments, shares, saves, views: baseViews };
}

/**
 * WR-01 fix: convert PersonaBehavioralAggregate intent scores (0-100) into
 * BehavioralPredictions percentage-of-views units (typical 0.2-5%) before feeding
 * `computePredictedEngagement`. Without this conversion, persona share_pct=75 (intent
 * "75 out of 100 intent strength") would be interpreted as "75% of views share" — a
 * 15-20× inflation.
 *
 * Scaling factor 0.05 derived from DeepSeek's empirical output ranges (share/save 0.5-5%,
 * comment 0.5-3%) anchored at intent=100 → view-rate=5%. Phase 10 may revise after
 * corpus-calibrated mapping is available.
 *
 * `completion_pct` is in identical units (0-100 percent watched) on both sides, so it
 * passes through unchanged.
 */
const PERSONA_INTENT_TO_VIEW_RATE = 0.05;
function rescalePersonaIntentToViewRate(
  aggregate: PersonaBehavioralAggregate,
): BehavioralPredictions {
  return {
    completion_pct: aggregate.completion_pct,
    completion_percentile: aggregate.completion_percentile,
    share_pct: aggregate.share_pct * PERSONA_INTENT_TO_VIEW_RATE,
    share_percentile: aggregate.share_percentile,
    comment_pct: aggregate.comment_pct * PERSONA_INTENT_TO_VIEW_RATE,
    comment_percentile: aggregate.comment_percentile,
    save_pct: aggregate.save_pct * PERSONA_INTENT_TO_VIEW_RATE,
    save_percentile: aggregate.save_percentile,
  };
}

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
}

/**
 * Aggregate all pipeline stage outputs into a PredictionResult.
 *
 * v2 formula: behavioral 35% + gemini 25% + ml 15% + rules 15% + trends 10%
 * RULE-04: Dynamic weight selection adapts when signals are missing.
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
    ruleResult,
    trendEnrichment,
  } = pipelineResult;

  const gemini = geminiResult.analysis;
  const deepseek = deepseekResult?.reasoning ?? null;
  // Phase 6 (D-A4) — fingerprint result from Wave 1 audio_fingerprint stage.
  const audioFingerprintResult = pipelineResult.audioFingerprintResult;

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
  let audio_score = 0;
  let audioPerceptualResult: AudioPerceptualResult | null = null;
  if (audioSignals) {
    audioPerceptualResult = computeAudioPerceptualScore(
      audioSignals,
      contentTypeSlug,
    );
    audio_perceptual_score = audioPerceptualResult.audio_perceptual_score;
    // D-G2 trend_phase boost mapping (LOCKED — pass through verbatim).
    const TREND_PHASE_BOOST: Record<string, number> = {
      emerging: 15,
      rising: 10,
      peak: 5,
      declining: -5,
    };
    const boost =
      audioFingerprintResult?.trend_phase != null
        ? TREND_PHASE_BOOST[audioFingerprintResult.trend_phase] ?? 0
        : 0;
    audio_score = Math.max(0, Math.min(100, audio_perceptual_score + boost));
  }

  // Phase 6 (Note 7 / Q4 RESOLVED) — verbatim Gemini-emitted audio_description
  // for downstream persistence into analysis_results.audio_description. The
  // calling layer (route.ts buildInsertRow) plucks this field into the insert
  // payload. Null when audio_signals absent.
  const audio_description = audioSignals?.audio_description ?? null;

  // -------------------------------------------------
  // ML prediction (async — loads model from Supabase Storage on cold start)
  // -------------------------------------------------
  // Phase 6 D-F3: feed effectiveTrendEnrichment so FeatureVector.audioTrendingMatch
  // sees the synthesized matched_trends entry on fallback. assembleFeatureVector
  // reads pipelineResult.audioFingerprintResult independently for the priority
  // source (D-G4); the trend_enrichment slot is the fallback source-of-data.
  const featureVectorInput: PipelineResult = {
    ...pipelineResult,
    trendEnrichment: effectiveTrendEnrichment,
  };
  const feature_vector = assembleFeatureVector(
    featureVectorInput,
    adjustedVideoSignals,
  );
  const mlFeatures = featureVectorToMLInput(feature_vector);
  const mlScore = await predictWithML(mlFeatures);

  // -------------------------------------------------
  // RULE-04: Determine signal availability from pipeline result
  // -------------------------------------------------
  const availability: SignalAvailability = {
    behavioral: deepseekResult !== null,
    // Placeholder — overwritten below after per-segment availability is resolved.
    // HARD-03 fallback (factors.some(score > 0)) kicks in only when signalAvailability undefined.
    gemini: false,
    ml: false, // D-05: disabled after Phase 10 audit — ml model uses engagement features not available at prediction time
    rules:
      ruleResult.matched_rules.length > 0 &&
      !pipelineResult.warnings.some((w) =>
        w.includes("Rule scoring unavailable")
      ),
    trends:
      effectiveTrendEnrichment.matched_trends.length > 0 &&
      !pipelineResult.warnings.some((w) =>
        w.includes("Trend enrichment unavailable")
      ),
    // Phase 4 D-20: provenance flags surfaced from Wave 0 detector outcomes.
    // Persisted to analysis_results.signal_availability JSONB; do NOT participate
    // in selectWeights math (filtered out by SCORE_WEIGHT_KEYS).
    content_type: pipelineResult.wave0Result.content_type !== null,
    niche: pipelineResult.wave0Result.niche !== null,
    // Phase 5 D-12 — per-segment provenance from analyzeVideoSegmented.
    // `?? false` fallback handles legacy callers (text mode / eval harness) AND
    // historical JSONB rows that pre-date the segment keys (RESEARCH line 475).
    // SCORE_WEIGHT_KEYS still excludes these per Phase 4 Cross-File Constraint #3.
    gemini_hook: pipelineResult.geminiResult.signalAvailability?.gemini_hook ?? false,
    gemini_body: pipelineResult.geminiResult.signalAvailability?.gemini_body ?? false,
    gemini_cta:  pipelineResult.geminiResult.signalAvailability?.gemini_cta  ?? false,
    // Phase 7 D-15: personas provenance flag. Set true when ≥7-of-10 personas succeeded
    // (i.e., pipelineResult.personaBehavioralAggregate !== null). Persisted to
    // analysis_results.signal_availability JSONB; does NOT participate in selectWeights math
    // (filtered out by SCORE_WEIGHT_KEYS per PATTERNS Critical Cross-File Constraint #3).
    personas: pipelineResult.personaBehavioralAggregate !== null,
    // Phase 6 (D-G1) — weight-bearing (handles Plan 03's .optional() undefined case).
    audio: audioSignals != null,
    // Phase 6 (D-G1) — provenance only (filtered out of SCORE_WEIGHT_KEYS).
    audio_fingerprint: audioFingerprintResult !== null,
    // Phase 8 D-10: retrieval signal — IS weight-bearing (included in
    // SCORE_WEIGHT_KEYS). True when ≥1 match survived hierarchical relaxation
    // AND D-04b min_corpus_size gate passed (i.e., retrievalResult.score is non-null).
    retrieval: pipelineResult.retrievalResult.availability,
    // Phase 9 D-07: platform_fit — IS weight-bearing (included in SCORE_WEIGHT_KEYS).
    // True when Plan 09-07's pipeline platformFitResult is non-null and non-empty.
    // Uses widened pipeline cast until PipelineResult inherits the feeder interface.
    platform_fit: ((pipelineResult as PipelineResult & { platformFitResult: PlatformFitResult[] | null }).platformFitResult?.length ?? 0) > 0,
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
  // Behavioral score (35% base weight)
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
  // Gemini score (25% base weight)
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
  // Phase 9 (D-03): mean platform fit score across all scored platforms.
  // platformFitResult comes from Plan 09-07's pipeline extension (typed via
  // widenedPipeline cast until PipelineResult inherits PipelinePlatformFitFields).
  // Mean of 0 when null/empty → term drops out via weights.platform_fit ?? 0.
  // -------------------------------------------------
  const widenedPipeline = pipelineResult as PipelineResult & { platformFitResult: PlatformFitResult[] | null };
  const platformFitScores = widenedPipeline.platformFitResult ?? null;
  const platformFitMeanScore = platformFitScores && platformFitScores.length > 0
    ? platformFitScores.reduce((sum, p) => sum + p.fit_score, 0) / platformFitScores.length
    : 0;

  // -------------------------------------------------
  // Overall score (dynamic weighted combination)
  // Phase 6 (D-G1): audio_score is folded in when signal_availability.audio = true.
  // When audio is absent, weights.audio = 0 (selectWeights redistributes the 0.07
  // share across the other available signals), so the audio term contributes 0.
  // -------------------------------------------------
  const raw_overall_score = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        behavioral_score * weights.behavioral +
          ctaPenaltyApplied_gemini_score * weights.gemini + // Phase 5 D-06 — penalty flows here
          (mlScore ?? 0) * weights.ml +
          ruleResult.rule_score * weights.rules +
          effectiveTrendEnrichment.trend_score * weights.trends +
          audio_score * (weights.audio ?? 0) +
          // Phase 8 D-03: retrievalResult.score is in [0,1] — scale by 100 to match
          // the [0,100] range of the other terms before applying the weight.
          // ?? 0 makes the term null-safe when retrieval is unavailable.
          ((pipelineResult.retrievalResult.score ?? 0) * 100) * (weights.retrieval ?? 0) +
          // Phase 9 (D-07): platformFitMeanScore is in [0,100] (from fit_score 0-100).
          // ?? 0 makes the term null-safe when platform_fit is unavailable.
          platformFitMeanScore * (weights.platform_fit ?? 0)
      )
    )
  );

  // -------------------------------------------------
  // Platt Calibration (CAL-01: conditional application)
  // -------------------------------------------------
  let plattParams: PlattParameters | null = null;
  try {
    plattParams = await getPlattParameters();
  } catch {
    // Calibration lookup failed — proceed uncalibrated
    plattParams = null;
  }
  const overall_score = applyPlattScaling(raw_overall_score, plattParams);
  const is_calibrated = plattParams !== null;

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

  // HARD-03: Explicit dual-failure warning
  if (!availability.gemini && !availability.behavioral) {
    warnings.push(
      "Both LLM providers failed — result based on rules and trends only"
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

  // -------------------------------------------------
  // Predicted Engagement (RES-2)
  // WR-01: PersonaBehavioralAggregate.share_pct / comment_pct / save_pct are top-3-weighted
  // INTENT SCORES (0-100), whereas DeepSeek's share_pct / comment_pct / save_pct are
  // PERCENTAGES OF VIEWS (typical 0.2-5%). Without conversion, `computePredictedEngagement`
  // would treat persona share_pct=75 as "75/100 = 0.75 of views share" → 37-60% share rate,
  // ~15-20× inflated. Convert intent scores into view-rate units before feeding the
  // engagement math, but keep `behavioral_predictions` output unchanged (downstream
  // consumers reading the persona aggregate get the documented intent scores).
  // Conversion factor 0.05: intent 100 → 5% view rate, intent 50 → 2.5% view rate.
  // This matches DeepSeek's typical upper-bound output range and is documented in
  // WR-01 fix notes; Phase 10 may revise after corpus calibration.
  // `completion_pct` is already in the same units on both sides (0-100 percent watched),
  // so it is passed through unchanged.
  // -------------------------------------------------
  const engagementBehavioral =
    behavioralSource === "personas" && pipelineResult.personaBehavioralAggregate !== null
      ? rescalePersonaIntentToViewRate(pipelineResult.personaBehavioralAggregate)
      : behavioral_predictions;

  const predicted_engagement = computePredictedEngagement(
    overall_score,
    engagementBehavioral,
  );

  // -------------------------------------------------
  // Assemble PredictionResult
  // -------------------------------------------------
  const result: PredictionResult = {
    overall_score,
    confidence: conf.confidence,
    confidence_label: conf.confidence_label,
    is_calibrated,
    behavioral_predictions,
    feature_vector,
    reasoning: "", // DeepSeek reasoning text — not exposed in current schema
    warnings,
    predicted_engagement,
    factors,
    suggestions,
    rule_score: ruleResult.rule_score,
    trend_score: effectiveTrendEnrichment.trend_score,
    gemini_score,
    behavioral_score,
    ml_score: mlScore ?? 0,
    // Phase 6 (D-G3) — pre-boost audio_perceptual_score. The fingerprint boost
    // is folded into audio_score (internal) before the weighted sum; consumers
    // who want the perceptual baseline read this field directly.
    audio_perceptual_score,
    // Phase 6 (D-G1) — full fingerprint match record or null.
    audio_fingerprint: audioFingerprintResult,
    // Phase 6 (Note 7 / Q4 RESOLVED) — verbatim audio_description for
    // persistence into analysis_results.audio_description (route.ts pluck).
    audio_description,
    score_weights: weights, // Actual weights used (may differ from BASE if signals missing)
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
    // Phase 9 D-07 — platform_fit signal output. Pipeline passes per-platform
    // results (Plan 09-07) — array widened via cast until PipelineResult inherits
    // the feeder interface. The first result is the primary (highest-fit) platform.
    // Plan 09-07 will align the PredictionResult type to match the pipeline shape.
    platform_fit: widenedPipeline.platformFitResult?.[0] ?? null,
  };

  // -------------------------------------------------
  // Phase 9 — Stage 10: Self-critique pass (grading aggregator output for consistency).
  // Runs AFTER aggregateScores populates overall_score/confidence. The critique adjusts
  // confidence downward (clamped to [-0.20, 0]) via applyCritiqueAdjustment.
  // Stage 10 result is surfaced in PredictionResult.critique.
  // -------------------------------------------------
  const critiqueResult = await runStage10Critique(result, onStageEvent);
  if (critiqueResult) {
    result.confidence = applyCritiqueAdjustment(result.confidence, critiqueResult);
  }
  result.critique = critiqueResult;

  // -------------------------------------------------
  // Phase 13 — Stage 11: Always-on counterfactual suggestions (D-04 — no score skip).
  // Runs AFTER critique so maybeAppendLikelyFlopWarning uses POST-CRITIQUE confidence
  // (Pitfall 7 ordering invariant).
  // D-01 / D-06 / D-18 — Stage 11 receives videoContext from options (Plan 03 threads
  // real values; Plan 02 default = null).
  // -------------------------------------------------
  const counterfactualResult = await runStage11Counterfactuals(
    result,
    options?.videoContext ?? null,
    onStageEvent,
  );
  if (counterfactualResult) {
    result.counterfactuals = counterfactualResult;
  }

  // Pure-TS LIKELY_FLOP check — uses POST-CRITIQUE confidence per Pitfall 7.
  maybeAppendLikelyFlopWarning(result);

  return result;
}
