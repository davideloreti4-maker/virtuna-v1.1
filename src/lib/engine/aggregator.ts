import type {
  AudioPerceptualResult,
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
import { computeAudioPerceptualScore } from "./audio-perceptual";

/** Re-export ENGINE_VERSION for back-compat — existing consumers `import { ENGINE_VERSION } from "./aggregator"` keep working. */
export { ENGINE_VERSION };

// =====================================================
// v2 Score Weights — config-driven for maintainability
// =====================================================

// Phase 6 (D-G1) — audio: 0.07 = middle of 0.05-0.10 range per CONTEXT D-G1.
// Phase 10 ML audit retunes against corpus benchmark. Raw weights now sum to 1.07;
// selectWeights normalizes BOTH branches (all-available + redistribution) so the
// returned weights always sum to ~1.0 — the weighted-average math in aggregateScores
// expects that contract. Exported for test introspection (aggregator-audio.test.ts).
export const SCORE_WEIGHTS = {
  behavioral: 0.35,
  gemini: 0.25,
  ml: 0.15,
  rules: 0.15,
  trends: 0.10,
  audio: 0.07, // Phase 6 (D-G1) — weight-bearing
} as const;

// PATTERNS Critical Cross-File Constraint #3:
// selectWeights() must iterate ONLY known SCORE_WEIGHTS keys. Phase 4 widened
// SignalAvailability with content_type + niche provenance keys (D-20) — those
// must NOT participate in weight redistribution math. Phase 6 (D-G1) adds
// `audio` (weight-bearing) but does NOT add `audio_fingerprint` (provenance only;
// the fingerprint boost is folded into audio_score before the weighted average,
// so audio_fingerprint must NOT have its own slot in the math).
export const SCORE_WEIGHT_KEYS = ["behavioral", "gemini", "ml", "rules", "trends", "audio"] as const;
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
): { behavioral: number; gemini: number; ml: number; rules: number; trends: number; audio?: number } {
  // Filter Object.entries to ONLY known SCORE_WEIGHTS keys. Phase 4+ extensions
  // that add provenance keys to SignalAvailability (content_type, niche, future
  // retrieval/hook_decomp) MUST NOT participate in the weight math.
  // PATTERNS Critical Cross-File Constraint #3.
  // Phase 6 (D-G1): `audio` IS in SCORE_WEIGHT_KEYS (weight-bearing);
  // `audio_fingerprint` is NOT (provenance only — the fingerprint boost folds into
  // audio_score before the weighted average, so it must not get its own slot here).
  //
  // BACK-COMPAT: SignalAvailability.audio is `.optional()` (Phase 6 declared the
  // field to preserve compile against pre-Phase-6 construction sites). When the
  // caller passes a legacy 5-key availability object that LACKS the `audio` field
  // entirely, we treat audio as "not in the math at all" — preserving the legacy
  // 5-signal base weights (0.35/0.25/0.15/0.15/0.1, sum=1.0). When the caller
  // passes the new 6-key shape, audio fully participates.
  const audioInInput = Object.prototype.hasOwnProperty.call(availability, "audio");
  const activeKeys = audioInInput
    ? SCORE_WEIGHT_KEYS
    : (SCORE_WEIGHT_KEYS.filter((k) => k !== "audio") as readonly ScoreWeightKey[]);

  const filtered = (Object.entries(availability) as Array<[string, boolean]>)
    .filter(([key]) => (activeKeys as readonly string[]).includes(key)) as Array<
    [ScoreWeightKey, boolean]
  >;

  const available = filtered.filter(([, v]) => v);
  const missing = filtered.filter(([, v]) => !v);

  // Phase 6 (D-G1) normalization contract — see SCORE_WEIGHTS comment above.
  // Raw weights for the 6-key path sum to 1.07; the 5-key legacy path sums to 1.0.
  // The downstream weighted-average math in aggregateScores expects weights to sum
  // to ~1.0 to keep overall_score in [0, 100]. Therefore BOTH branches (all-available
  // + redistribution) normalize via `weight / total * 1000` rounding pass below.
  type WeightsOut = {
    behavioral: number;
    gemini: number;
    ml: number;
    rules: number;
    trends: number;
    audio?: number;
  };
  const initWeights = (): WeightsOut => {
    const w: WeightsOut = { behavioral: 0, gemini: 0, ml: 0, rules: 0, trends: 0 };
    if (audioInInput) w.audio = 0;
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

  // Each available source gets its base weight + proportional share of missing weight
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

function assembleFeatureVector(
  pipelineResult: PipelineResult,
  adjustedVideoSignals?: GeminiVideoSignals | null,
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
  // -------------------------------------------------
  const wave0 = pipelineResult.wave0Result;
  const contentTypeSlug = wave0.content_type?.type ?? null;
  const rawVideoSignals = geminiResult.analysis.video_signals ?? null;
  const adjustedVideoSignals =
    rawVideoSignals && contentTypeSlug !== null
      ? applyContentTypeWeights(rawVideoSignals, contentTypeSlug)
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
      effectiveTrendEnrichment.matched_trends.length > 0 &&
      !pipelineResult.warnings.some((w) =>
        w.includes("Trend enrichment unavailable")
      ),
    // Phase 4 D-20: provenance flags surfaced from Wave 0 detector outcomes.
    // Persisted to analysis_results.signal_availability JSONB; do NOT participate
    // in selectWeights math (filtered out by SCORE_WEIGHT_KEYS).
    content_type: pipelineResult.wave0Result.content_type !== null,
    niche: pipelineResult.wave0Result.niche !== null,
    // Phase 6 (D-G1) — weight-bearing (handles Plan 03's .optional() undefined case).
    audio: audioSignals != null,
    // Phase 6 (D-G1) — provenance only (filtered out of SCORE_WEIGHT_KEYS).
    audio_fingerprint: audioFingerprintResult !== null,
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
          gemini_score * weights.gemini +
          (mlScore ?? 0) * weights.ml +
          ruleResult.rule_score * weights.rules +
          effectiveTrendEnrichment.trend_score * weights.trends +
          audio_score * (weights.audio ?? 0)
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
