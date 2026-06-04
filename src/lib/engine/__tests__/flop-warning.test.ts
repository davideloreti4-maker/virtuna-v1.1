/**
 * Plan 01-05 Task 0 — flop-warning.ts boundary tests.
 *
 * Extracted verbatim from stage11-counterfactuals.test.ts describe block
 * "maybeAppendLikelyFlopWarning — 4 boundary fixtures (COUNTER LIKELY_FLOP)".
 * stage11-counterfactuals.test.ts retains only the runStage11Counterfactuals tests
 * (which travel with the module to _dormant/).
 *
 * 4 boundary tests:
 *   1 — adds warning when score < 30 AND confidence > 0.70
 *   2 — does NOT add warning when score >= 30 AND confidence > 0.70
 *   3 — does NOT add warning when score < 30 AND confidence <= 0.70
 *   4 — does NOT add warning when score >= 30 AND confidence <= 0.70
 */
import { describe, it, expect } from "vitest";
import { maybeAppendLikelyFlopWarning } from "../flop-warning";
import type { PredictionResult } from "../types";

// =====================================================
// PredictionResult minimal factory (same shape as stage11-counterfactuals.test.ts)
// =====================================================

function makeFakePredictionResult(
  overrides?: Partial<PredictionResult>,
): PredictionResult {
  return {
    overall_score: 45,
    confidence: 0.65,
    confidence_label: "MEDIUM",
    behavioral_predictions: {
      completion_pct: 45,
      completion_percentile: "top 50%",
      share_pct: 2.1,
      share_percentile: "top 50%",
      comment_pct: 1.5,
      comment_percentile: "top 50%",
      save_pct: 1.8,
      save_percentile: "top 50%",
    },
    feature_vector: {
      hookScore: 6,
      completionPull: 5,
      rewatchPotential: 5,
      shareTrigger: 5,
      emotionalCharge: 5,
      visualProductionQuality: null,
      hookVisualImpact: null,
      pacingScore: null,
      transitionQuality: null,
      hookEffectiveness: 6,
      retentionStrength: 5,
      shareability: 4,
      commentProvocation: 3,
      saveWorthiness: 4,
      trendAlignment: 5,
      originality: 5,
      ruleScore: 55,
      trendScore: 30,
      audioTrendingMatch: null,
      captionScore: 4,
      hashtagRelevance: 0.5,
      hashtagCount: 3,
      durationSeconds: 45,
      hasVideo: false,
    },
    reasoning: "Test reasoning.",
    warnings: [],
    predicted_engagement: {
      views: 10000,
      likes: 500,
      shares: 100,
      comments: 50,
      saves: 30,
    },
    factors: [],
    suggestions: [],
    rule_score: 55,
    trend_score: 30,
    gemini_score: 65,
    behavioral_score: 45,
    ml_score: 50,
    score_weights: {
      behavioral: 0.40,
      gemini: 0.35,
      ml: 0,
      rules: 0,
      trends: 0.10,
      audio: 0.05,
      platform_fit: 0.05,
      retrieval: 0,
    },
    latency_ms: 1500,
    cost_cents: 5,
    engine_version: "13.0.0",
    gemini_model: "gemini-3.1-pro-preview",
    deepseek_model: "deepseek-chat",
    input_mode: "text",
    has_video: false,
    signal_availability: {
      behavioral: true,
      gemini: true,
      ml: false,
      rules: false,
      trends: true,
      content_type: true,
      niche: true,
      gemini_hook: true,
      gemini_body: true,
      gemini_cta: true,
      personas: true,
      audio: false,
      retrieval: false,
    },
    persona_behavioral_aggregate: {
      completion_pct: 52,
      completion_percentile: "top 45%",
      share_pct: 2.5,
      share_percentile: "top 40%",
      comment_pct: 1.8,
      comment_percentile: "top 45%",
      save_pct: 2.0,
      save_percentile: "top 40%",
    },
    persona_simulation_results: [],
    retrieval_score: null,
    retrieval_evidence: [],
    anti_virality_gated: false,
    ...overrides,
  };
}

// =====================================================
// Tests (verbatim from stage11-counterfactuals.test.ts Test 8)
// =====================================================

describe("maybeAppendLikelyFlopWarning — 4 boundary fixtures (COUNTER LIKELY_FLOP)", () => {
  it("adds warning when score < 30 AND confidence > 0.70", () => {
    const result = makeFakePredictionResult({
      overall_score: 25,
      confidence: 0.75,
      warnings: [],
    });
    maybeAppendLikelyFlopWarning(result);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("LIKELY_FLOP");
  });

  it("does NOT add warning when score >= 30 AND confidence > 0.70", () => {
    const result = makeFakePredictionResult({
      overall_score: 30,
      confidence: 0.75,
      warnings: [],
    });
    maybeAppendLikelyFlopWarning(result);
    expect(result.warnings.length).toBe(0);
  });

  it("does NOT add warning when score < 30 AND confidence <= 0.70", () => {
    const result = makeFakePredictionResult({
      overall_score: 25,
      confidence: 0.70,
      warnings: [],
    });
    maybeAppendLikelyFlopWarning(result);
    expect(result.warnings.length).toBe(0);
  });

  it("does NOT add warning when score >= 30 AND confidence <= 0.70", () => {
    const result = makeFakePredictionResult({
      overall_score: 85,
      confidence: 0.65,
      warnings: [],
    });
    maybeAppendLikelyFlopWarning(result);
    expect(result.warnings.length).toBe(0);
  });
});
