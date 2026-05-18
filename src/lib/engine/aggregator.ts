import type {
  ConfidenceLevel,
  Factor,
  FeatureVector,
  GeminiVideoSignals,
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
  behavioral: 0.33, // Phase 8 D-03b: was 0.35; redistributed × 0.95 to make room for retrieval
  gemini:     0.24, // Phase 8 D-03b: was 0.25
  ml:         0.14, // Phase 8 D-03b: was 0.15
  rules:      0.14, // Phase 8 D-03b: was 0.15
  trends:     0.10, // Phase 8 D-03b: was 0.10 (0.10 × 0.95 = 0.095 → rounds to 0.10 per locked matrix)
  retrieval:  0.05, // NEW Phase 8 D-03b — Plan 10 calibration will tune
} as const;

// PATTERNS Critical Cross-File Constraint #1 (Phase 8) + #3 (Phase 4):
// selectWeights() must iterate ONLY weight-bearing SCORE_WEIGHTS keys.
// - Phase 4 widened SignalAvailability with content_type + niche provenance keys
//   (D-20) — those do NOT participate in weight math (provenance only).
// - Phase 8 added retrieval as a weight-bearing key — MUST be in this tuple
//   (skipping it silently drops the new 0.05 slot in the filter at line 67).
const SCORE_WEIGHT_KEYS = ["behavioral", "gemini", "ml", "rules", "trends", "retrieval"] as const;
type ScoreWeightKey = (typeof SCORE_WEIGHT_KEYS)[number];

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
): { behavioral: number; gemini: number; ml: number; rules: number; trends: number; retrieval: number } {
  // Filter Object.entries to ONLY weight-bearing SCORE_WEIGHTS keys.
  // - Phase 4+ provenance keys (content_type, niche) do NOT participate in math.
  // - Phase 8 added 'retrieval' to the tuple — it IS weight-bearing.
  // PATTERNS Critical Cross-File Constraints #1 (Phase 8) + #3 (Phase 4).
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

  // Each available source gets its base weight + proportional share of missing weight.
  // Phase 8 — retrieval slot added.
  const result = { behavioral: 0, gemini: 0, ml: 0, rules: 0, trends: 0, retrieval: 0 };
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

function assembleFeatureVector(
  pipelineResult: PipelineResult,
  adjustedVideoSignals?: GeminiVideoSignals | null,
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

// =====================================================
// Score Aggregation
// =====================================================

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
  // -------------------------------------------------
  const wave0 = pipelineResult.wave0Result;
  const contentTypeSlug = wave0.content_type?.type ?? null;
  const rawVideoSignals = geminiResult.analysis.video_signals ?? null;
  const adjustedVideoSignals =
    rawVideoSignals && contentTypeSlug !== null
      ? applyContentTypeWeights(rawVideoSignals, contentTypeSlug)
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
    gemini: geminiResult.analysis.factors.some((f) => f.score > 0), // HARD-03: false when all factors are 0 (fallback)
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
    // Phase 8 D-10: retrieval signal — IS weight-bearing (included in
    // SCORE_WEIGHT_KEYS). True when ≥1 match survived hierarchical relaxation
    // AND D-04b min_corpus_size gate passed (i.e., retrievalResult.score is non-null).
    retrieval: pipelineResult.retrievalResult.availability,
  };

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
  // Overall score (dynamic weighted combination)
  // -------------------------------------------------
  const raw_overall_score = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        behavioral_score * weights.behavioral +
          gemini_score * weights.gemini +
          (mlScore ?? 0) * weights.ml +
          ruleResult.rule_score * weights.rules +
          trendEnrichment.trend_score * weights.trends +
          // Phase 8 D-03: retrievalResult.score is in [0,1] — scale by 100 to match
          // the [0,100] range of the other terms before applying the weight.
          // ?? 0 makes the term null-safe when retrieval is unavailable.
          ((pipelineResult.retrievalResult.score ?? 0) * 100) * weights.retrieval
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
  // -------------------------------------------------
  const cost_cents =
    Math.round(
      (geminiResult.cost_cents + (deepseekResult?.cost_cents ?? 0)) * 10000
    ) / 10000;

  // -------------------------------------------------
  // Behavioral predictions (single source of truth for result + engagement)
  // -------------------------------------------------
  const behavioral_predictions = deepseek?.behavioral_predictions ?? {
    completion_pct: 0,
    completion_percentile: "N/A",
    share_pct: 0,
    share_percentile: "N/A",
    comment_pct: 0,
    comment_percentile: "N/A",
    save_pct: 0,
    save_percentile: "N/A",
  };

  // -------------------------------------------------
  // Predicted Engagement (RES-2)
  // -------------------------------------------------
  const predicted_engagement = computePredictedEngagement(
    overall_score,
    behavioral_predictions,
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
    // Phase 8 D-11 — retrieval signal output. Persisted to
    // analysis_results.retrieval_score (NUMERIC(5,4) nullable) and
    // analysis_results.retrieval_evidence (JSONB). M2 renders evidence in
    // the "similar videos" panel without further DB joins (D-02).
    retrieval_score: pipelineResult.retrievalResult.score,
    retrieval_evidence: pipelineResult.retrievalResult.evidence,
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
