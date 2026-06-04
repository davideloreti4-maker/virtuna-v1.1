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
  CounterfactualResult,
  CounterfactualSuggestionItem,
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
    video_storage_path: null,
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
      // Phase 2 (D-19) — 9-card profile fields (all null in the default factory).
      // WR-03: required-but-nullable on CreatorContext — tsc --noEmit fails without them.
      target_platforms: null,
      niche_primary: null,
      niche_sub: null,
      target_audience: null,
      primary_goal: null,
      creator_stage: null,
      content_style: null,
      cuts_per_second: null,
      reference_creators: null,
      past_wins: null,
      past_flops: null,
      time_of_day_aware: null,
      pain_points: null,
    },
    // Plan 03: trendEnrichment removed from PipelineResult.
    deepseekResult: {
      reasoning: makeDeepSeekReasoning(),
      cost_cents: 0.3,
    },
    // Phase 3 — Wave 0/3 stub outputs (Phase 4/7 fill with real logic)
    wave0Result: { content_type: null, niche: null },
    wave3Result: [],
    // NEW Phase 7 (Pitfall 9, A11) — default null preserves "no aggregate" semantics
    // for all existing aggregator.test.ts and pipeline.test.ts callers.
    personaBehavioralAggregate: null,
    // Phase 7 CR-01 — default 0 preserves byte-identical cost behavior for tests that don't
    // exercise Wave 3. Tests asserting on Wave 3 cost should pass an override (e.g.,
    // { wave3CostCents: 1.25 }).
    wave3CostCents: 0,
    // Phase 8 — Wave 1 retrieval sibling default (graceful empty unless overridden)
    retrievalResult: {
      evidence: [],
      score: null,
      availability: false,
      cost_cents: 0,
    },
    // Plan 03: platformFitResult removed from PipelineResult.
    // Phase 3 (Plan 08) — Pass 2 outcome default (null = text mode / no segments)
    pass2Outcome: null,
    // Phase 3 (Plan 08) — Omni segments default (undefined = text mode, no video segments)
    segments: undefined,
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

// =====================================================
// makeCounterfactualResult — Phase 13 Plan 02 (D-05)
// =====================================================

/**
 * Factory for the Phase 13 discriminated-union CounterfactualResult.
 * Defaults to "low" band with 3 fix suggestions.
 * Pass band + suggestion overrides for mid/high tests.
 */
export function makeCounterfactualResult(
  band: "low" | "mid" | "high" = "low",
  overrides?: Partial<CounterfactualResult>,
): CounterfactualResult {
  const baseSuggestionItem = (
    type: CounterfactualSuggestionItem["type"],
    i: number,
  ): CounterfactualSuggestionItem => ({
    type,
    headline: `${type === "fix" ? "Fix" : type === "stretch" ? "Stretch" : "Strength"} suggestion ${i + 1}`,
    detail: `Detailed explanation of the ${type} suggestion ${i + 1} with specific expected impact.`,
    timestamp_ms: i * 1000,
    signal_anchor: `signal_${i + 1}`,
  });

  let suggestions: CounterfactualSuggestionItem[];
  switch (band) {
    case "low":
      suggestions = [0, 1, 2].map((i) => baseSuggestionItem("fix", i));
      break;
    case "mid":
      suggestions = [
        baseSuggestionItem("fix", 0),
        baseSuggestionItem("fix", 1),
        baseSuggestionItem("reinforcement", 2),
      ];
      break;
    case "high":
      suggestions = [
        baseSuggestionItem("stretch", 0),
        baseSuggestionItem("reinforcement", 1),
        baseSuggestionItem("reinforcement", 2),
      ];
      break;
  }

  return {
    band,
    suggestions,
    ...overrides,
  };
}
