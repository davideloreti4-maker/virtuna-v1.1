/**
 * Shared mock data factories for engine test files.
 *
 * Each factory returns a valid, type-safe default object.
 * Pass `Partial<T>` overrides to customize specific fields.
 */

import type {
  GeminiAnalysis,
  DeepSeekReasoning,
  RuleScoreResult,
  TrendEnrichment,
  ContentPayload,
  FeatureVector,
} from "../types";
import type { PipelineResult } from "../pipeline";

// =====================================================
// makeGeminiAnalysis
// =====================================================

export function makeGeminiAnalysis(
  overrides?: Partial<GeminiAnalysis>
): GeminiAnalysis {
  return {
    factors: [
      {
        name: "Scroll-Stop Power",
        score: 7,
        rationale: "Strong opening hook grabs attention immediately",
        improvement_tip: "Add a visual surprise in the first frame",
      },
      {
        name: "Completion Pull",
        score: 7,
        rationale: "Narrative arc keeps viewers engaged through the end",
        improvement_tip: "Tease the payoff earlier to reduce drop-off",
      },
      {
        name: "Rewatch Potential",
        score: 7,
        rationale: "Layered content rewards multiple viewings",
        improvement_tip: "Add a hidden detail viewers might miss first time",
      },
      {
        name: "Share Trigger",
        score: 7,
        rationale: "Relatable content that viewers want to share with friends",
        improvement_tip: "End with a call-to-action that prompts tagging",
      },
      {
        name: "Emotional Charge",
        score: 7,
        rationale: "Content evokes strong positive emotional response",
        improvement_tip: "Amplify the emotional peak with music sync",
      },
    ],
    overall_impression:
      "Well-crafted content with strong engagement potential across key metrics",
    content_summary:
      "Test content analyzing viral potential with trending hashtags",
    ...overrides,
  };
}

// =====================================================
// makeDeepSeekReasoning
// =====================================================

export function makeDeepSeekReasoning(
  overrides?: Partial<DeepSeekReasoning>
): DeepSeekReasoning {
  return {
    behavioral_predictions: {
      completion_pct: 68,
      completion_percentile: "top 35%",
      share_pct: 4.2,
      share_percentile: "top 25%",
      comment_pct: 2.8,
      comment_percentile: "top 30%",
      save_pct: 3.5,
      save_percentile: "top 20%",
    },
    component_scores: {
      hook_effectiveness: 7,
      retention_strength: 7,
      shareability: 7,
      comment_provocation: 7,
      save_worthiness: 7,
      trend_alignment: 7,
      originality: 7,
    },
    suggestions: [
      {
        text: "Add a pattern interrupt at the 3-second mark to boost retention",
        priority: "high",
        category: "hook",
      },
    ],
    warnings: [],
    confidence: "medium",
    ...overrides,
  };
}

// =====================================================
// makeRuleScoreResult
// =====================================================

export function makeRuleScoreResult(
  overrides?: Partial<RuleScoreResult>
): RuleScoreResult {
  return {
    rule_score: 55,
    matched_rules: [
      {
        rule_id: "rule-001",
        rule_name: "Hashtag Optimization",
        score: 8,
        max_score: 10,
        tier: "regex",
      },
    ],
    ...overrides,
  };
}

// =====================================================
// makeTrendEnrichment
// =====================================================

export function makeTrendEnrichment(
  overrides?: Partial<TrendEnrichment>
): TrendEnrichment {
  return {
    trend_score: 30,
    matched_trends: [
      {
        sound_name: "Original Sound - Test",
        velocity_score: 45,
        trend_phase: "rising",
      },
    ],
    trend_context: "Moderate trend alignment with rising audio patterns",
    hashtag_relevance: 0.5,
    ...overrides,
  };
}

// =====================================================
// makeContentPayload
// =====================================================

export function makeContentPayload(
  overrides?: Partial<ContentPayload>
): ContentPayload {
  return {
    content_text: "Test content #viral",
    content_type: "video",
    input_mode: "text",
    video_url: null,
    hashtags: ["#viral"],
    duration_hint: null,
    niche: null,
    creator_handle: null,
    society_id: null,
    ...overrides,
  };
}

// =====================================================
// makeFeatureVector
// =====================================================

export function makeFeatureVector(
  overrides?: Partial<FeatureVector>
): FeatureVector {
  return {
    // Gemini factor scores (0-10)
    hookScore: 7,
    completionPull: 7,
    rewatchPotential: 7,
    shareTrigger: 7,
    emotionalCharge: 7,

    // Gemini video signals (null when no video)
    visualProductionQuality: null,
    hookVisualImpact: null,
    pacingScore: null,
    transitionQuality: null,

    // DeepSeek component scores (0-10)
    hookEffectiveness: 6,
    retentionStrength: 6,
    shareability: 6,
    commentProvocation: 6,
    saveWorthiness: 6,
    trendAlignment: 6,
    originality: 6,

    // Rules engine (0-100)
    ruleScore: 55,

    // Trend signals (0-100)
    trendScore: 30,

    // Audio
    audioTrendingMatch: null,

    // Caption/Hashtag signals
    captionScore: 6,
    hashtagRelevance: 0.5,
    hashtagCount: 1,

    // Content metadata
    durationSeconds: null,
    hasVideo: false,
    ...overrides,
  };
}

// =====================================================
// makePipelineResult
// =====================================================

export function makePipelineResult(
  overrides?: Partial<PipelineResult>
): PipelineResult {
  return {
    payload: makeContentPayload(),
    geminiResult: {
      analysis: makeGeminiAnalysis(),
      cost_cents: 0.5,
    },
    creatorContext: {
      found: false,
      follower_count: null,
      avg_views: null,
      engagement_rate: null,
      niche: null,
      posting_frequency: null,
      platform_averages: {
        avg_views: 50000,
        avg_engagement_rate: 0.06,
        avg_share_rate: 0.008,
        avg_comment_rate: 0.005,
      },
    },
    ruleResult: makeRuleScoreResult(),
    trendEnrichment: makeTrendEnrichment(),
    deepseekResult: {
      reasoning: makeDeepSeekReasoning(),
      cost_cents: 0.3,
    },
    audioResult: null,
    requestId: "test-req-123",
    timings: [
      { stage: "validate", duration_ms: 5 },
      { stage: "normalize", duration_ms: 10 },
      { stage: "gemini_analysis", duration_ms: 800 },
      { stage: "deepseek_reasoning", duration_ms: 600 },
    ],
    total_duration_ms: 1500,
    warnings: [],
    ...overrides,
  };
}
