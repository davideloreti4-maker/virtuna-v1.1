import type {
  ConfidenceLevel,
  Factor,
  FeatureVector,
  PredictionResult,
  RuleScoreResult,
  Suggestion,
  TrendEnrichment,
} from "./types";
import type { PipelineResult } from "./pipeline";
import { GEMINI_MODEL } from "./gemini";
import { DEEPSEEK_MODEL } from "./deepseek";

export const ENGINE_VERSION = "2.1.0";

// =====================================================
// v2 Score Weights — config-driven for maintainability
// =====================================================

const SCORE_WEIGHTS = {
  behavioral: 0.45,
  gemini: 0.25,
  rules: 0.20,
  trends: 0.10,
} as const;

// =====================================================
// Signal Availability & Dynamic Weight Selection (RULE-04)
// =====================================================

interface SignalAvailability {
  behavioral: boolean; // DeepSeek produced component scores
  gemini: boolean;     // Gemini produced factor scores (always true — critical stage)
  rules: boolean;      // Rule scoring produced real matches (not default fallback)
  trends: boolean;     // Trend enrichment found matches (not default fallback)
}

/**
 * Select weights based on which signal sources are available.
 * When a source is missing, its weight is redistributed proportionally
 * to the remaining sources so weights always sum to ~1.0.
 *
 * Exported for benchmarking and testing.
 */
export function selectWeights(
  availability: SignalAvailability
): { behavioral: number; gemini: number; rules: number; trends: number } {
  const available = Object.entries(availability).filter(([, v]) => v);
  const missing = Object.entries(availability).filter(([, v]) => !v);

  // All sources available — use base weights exactly
  if (missing.length === 0) return { ...SCORE_WEIGHTS };

  // Redistribute missing weight proportionally to available sources
  const missingWeight = missing.reduce(
    (sum, [key]) => sum + SCORE_WEIGHTS[key as keyof typeof SCORE_WEIGHTS], 0
  );
  const availableWeight = available.reduce(
    (sum, [key]) => sum + SCORE_WEIGHTS[key as keyof typeof SCORE_WEIGHTS], 0
  );

  // Each available source gets its base weight + proportional share of missing weight
  const result = { behavioral: 0, gemini: 0, rules: 0, trends: 0 };
  for (const [key, isAvailable] of Object.entries(availability)) {
    const k = key as keyof typeof SCORE_WEIGHTS;
    if (isAvailable) {
      result[k] = SCORE_WEIGHTS[k] + (SCORE_WEIGHTS[k] / availableWeight) * missingWeight;
    }
    // Missing sources get weight 0
  }

  // Round to avoid floating point noise, ensure they sum to ~1
  const total = Object.values(result).reduce((a, b) => a + b, 0);
  for (const key of Object.keys(result) as (keyof typeof result)[]) {
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

function assembleFeatureVector(pipelineResult: PipelineResult): FeatureVector {
  const { payload, geminiResult, deepseekResult, ruleResult, trendEnrichment } =
    pipelineResult;
  const gemini = geminiResult.analysis;
  const deepseek = deepseekResult?.reasoning;

  // Helper to find a Gemini factor by name
  const findFactor = (name: string) =>
    gemini.factors.find((f) => f.name === name);

  return {
    // Gemini factors (0-10)
    hookScore: findFactor("Scroll-Stop Power")?.score ?? 0,
    completionPull: findFactor("Completion Pull")?.score ?? 0,
    rewatchPotential: findFactor("Rewatch Potential")?.score ?? 0,
    shareTrigger: findFactor("Share Trigger")?.score ?? 0,
    emotionalCharge: findFactor("Emotional Charge")?.score ?? 0,

    // Video signals (null if no video)
    visualProductionQuality:
      gemini.video_signals?.visual_production_quality ?? null,
    hookVisualImpact: gemini.video_signals?.hook_visual_impact ?? null,
    pacingScore: gemini.video_signals?.pacing_score ?? null,
    transitionQuality: gemini.video_signals?.transition_quality ?? null,

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
// Score Aggregation
// =====================================================

/**
 * Aggregate all pipeline stage outputs into a PredictionResult.
 *
 * v2 formula: behavioral 45% + gemini 25% + rules 20% + trends 10%
 * RULE-04: Dynamic weight selection adapts when signals are missing.
 *
 * Takes the full PipelineResult from runPredictionPipeline()
 * and returns a complete PredictionResult.
 */
export function aggregateScores(
  pipelineResult: PipelineResult
): PredictionResult {
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
  // RULE-04: Determine signal availability from pipeline result
  // -------------------------------------------------
  const availability: SignalAvailability = {
    behavioral: deepseekResult !== null,
    gemini: true, // Always true — critical stage, pipeline throws if it fails
    rules: ruleResult.matched_rules.length > 0
      && !pipelineResult.warnings.some(w => w.includes('Rule scoring unavailable')),
    trends: trendEnrichment.matched_trends.length > 0
      && !pipelineResult.warnings.some(w => w.includes('Trend enrichment unavailable')),
  };

  const weights = selectWeights(availability);

  // -------------------------------------------------
  // Behavioral score (45% base weight)
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
  const overall_score = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        behavioral_score * weights.behavioral +
          gemini_score * weights.gemini +
          ruleResult.rule_score * weights.rules +
          trendEnrichment.trend_score * weights.trends
      )
    )
  );

  // -------------------------------------------------
  // Confidence (with signal availability penalties)
  // -------------------------------------------------
  const hasVideo = payload.input_mode !== "text";
  const conf = calculateConfidence(
    gemini_score,
    behavioral_score,
    ruleResult,
    trendEnrichment,
    hasVideo,
    deepseek?.confidence ?? "low",
    availability
  );

  // -------------------------------------------------
  // Warnings (from DeepSeek + weight redistribution + low confidence)
  // -------------------------------------------------
  const warnings: string[] = [...(deepseek?.warnings ?? [])];

  // RULE-04: Warn when weights are redistributed
  if (Object.entries(availability).some(([, v]) => !v)) {
    const missingSources = Object.entries(availability)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    warnings.push(`Weights redistributed — missing signals: ${missingSources.join(', ')}`);
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
  // FeatureVector
  // -------------------------------------------------
  const feature_vector = assembleFeatureVector(pipelineResult);

  // -------------------------------------------------
  // Cost tracking
  // -------------------------------------------------
  const cost_cents =
    Math.round(
      (geminiResult.cost_cents + (deepseekResult?.cost_cents ?? 0)) * 10000
    ) / 10000;

  // -------------------------------------------------
  // Assemble PredictionResult
  // -------------------------------------------------
  return {
    overall_score,
    confidence: conf.confidence,
    confidence_label: conf.confidence_label,
    behavioral_predictions:
      deepseek?.behavioral_predictions ?? {
        completion_pct: 0,
        completion_percentile: "N/A",
        share_pct: 0,
        share_percentile: "N/A",
        comment_pct: 0,
        comment_percentile: "N/A",
        save_pct: 0,
        save_percentile: "N/A",
      },
    feature_vector,
    reasoning: deepseek?.reasoning_summary ?? "",
    warnings,
    factors,
    suggestions,
    rule_score: ruleResult.rule_score,
    trend_score: trendEnrichment.trend_score,
    gemini_score,
    behavioral_score,
    score_weights: weights, // Actual weights used (may differ from BASE if signals missing)
    latency_ms: pipelineResult.total_duration_ms,
    cost_cents,
    engine_version: ENGINE_VERSION,
    gemini_model: GEMINI_MODEL,
    deepseek_model: deepseekResult ? DEEPSEEK_MODEL : null,
    input_mode: pipelineResult.payload.input_mode,
    has_video: hasVideo,
  };
}
