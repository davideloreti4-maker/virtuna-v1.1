import type {
  BehavioralPredictions,
  ConfidenceLevel,
  ContentTypeSlug,
  CtaSegmentResult,
  Factor,
  FeatureVector,
  GeminiVideoSignals,
  PersonaBehavioralAggregate,
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
import { runStage10Critique } from "./stage10-critique";
import { runStage11Counterfactuals } from "./stage11-counterfactuals";
import { applyContentTypeWeights } from "./wave0/content-type-weights";

/** Re-export ENGINE_VERSION for back-compat — existing consumers `import { ENGINE_VERSION } from "./aggregator"` keep working. */
export { ENGINE_VERSION };

// =====================================================
// v2 Score Weights — config-driven for maintainability
// =====================================================

const SCORE_WEIGHTS = {
  behavioral: 0.35,
  gemini: 0.25,
  ml: 0.15,
  rules: 0.15,
  trends: 0.10,
} as const;

// PATTERNS Critical Cross-File Constraint #3:
// selectWeights() must iterate ONLY known SCORE_WEIGHTS keys. Phase 4 widened
// SignalAvailability with content_type + niche provenance keys (D-20) — those
// must NOT participate in weight redistribution math.
const SCORE_WEIGHT_KEYS = ["behavioral", "gemini", "ml", "rules", "trends"] as const;
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
): { behavioral: number; gemini: number; ml: number; rules: number; trends: number } {
  // Filter Object.entries to ONLY known SCORE_WEIGHTS keys. Phase 4+ extensions
  // that add provenance keys to SignalAvailability (content_type, niche, future
  // audio/retrieval/hook_decomp) MUST NOT participate in the weight math.
  // PATTERNS Critical Cross-File Constraint #3.
  const filtered = (Object.entries(availability) as Array<[string, boolean]>)
    .filter(([key]) => (SCORE_WEIGHT_KEYS as readonly string[]).includes(key)) as Array<
    [ScoreWeightKey, boolean]
  >;

  const available = filtered.filter(([, v]) => v);
  const missing = filtered.filter(([, v]) => !v);

  // All sources available — use base weights exactly
  if (missing.length === 0) return { ...SCORE_WEIGHTS };

  // Redistribute missing weight proportionally to available sources
  const missingWeight = missing.reduce(
    (sum, [key]) => sum + SCORE_WEIGHTS[key], 0
  );
  const availableWeight = available.reduce(
    (sum, [key]) => sum + SCORE_WEIGHTS[key], 0
  );

  // Each available source gets its base weight + proportional share of missing weight
  const result = { behavioral: 0, gemini: 0, ml: 0, rules: 0, trends: 0 };
  for (const [key, isAvailable] of filtered) {
    if (isAvailable) {
      result[key] = SCORE_WEIGHTS[key] + (SCORE_WEIGHTS[key] / availableWeight) * missingWeight;
    }
    // Missing sources get weight 0
  }

  // Round to avoid floating point noise, ensure they sum to ~1
  const total = Object.values(result).reduce((a, b) => a + b, 0);
  if (total === 0) return result; // All sources unavailable — return all zeros
  for (const key of Object.keys(result) as ScoreWeightKey[]) {
    result[key] = Math.round((result[key] / total) * 1000) / 1000;
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

    // Audio — best trending sound match score (0-1, null if no match)
    audioTrendingMatch: trendEnrichment.matched_trends.length > 0
      ? Math.min(1, Math.max(...trendEnrichment.matched_trends.map(t => t.velocity_score)) / 100)
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
 */
export interface AggregateScoresOptions {
  behavioralSource?: "deepseek" | "personas";
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
  // ML prediction (async — loads model from Supabase Storage on cold start)
  // -------------------------------------------------
  const feature_vector = assembleFeatureVector(pipelineResult, adjustedVideoSignals);
  const mlFeatures = featureVectorToMLInput(feature_vector);
  const mlScore = await predictWithML(mlFeatures);
  const mlAvailable = mlScore !== null;

  // -------------------------------------------------
  // RULE-04: Determine signal availability from pipeline result
  // -------------------------------------------------
  const availability: SignalAvailability = {
    behavioral: deepseekResult !== null,
    // Placeholder — overwritten below after per-segment availability is resolved.
    // HARD-03 fallback (factors.some(score > 0)) kicks in only when signalAvailability undefined.
    gemini: false,
    ml: mlAvailable,
    rules:
      ruleResult.matched_rules.length > 0 &&
      !pipelineResult.warnings.some((w) =>
        w.includes("Rule scoring unavailable")
      ),
    trends:
      trendEnrichment.matched_trends.length > 0 &&
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
  // Overall score (dynamic weighted combination)
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
          trendEnrichment.trend_score * weights.trends
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
    trend_score: trendEnrichment.trend_score,
    gemini_score,
    behavioral_score,
    ml_score: mlScore ?? 0,
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
  };

  // -------------------------------------------------
  // Stage 10 + Stage 11 — no-op stubs in Phase 3; Phase 9 fills with real logic.
  // Both are awaited but their results are NOT yet attached to PredictionResult.
  // Future phases will extend PredictionResult schema to carry CritiqueResult + CounterfactualResult.
  // -------------------------------------------------
  await runStage10Critique(result, onStageEvent);
  await runStage11Counterfactuals(result, onStageEvent);

  return result;
}
