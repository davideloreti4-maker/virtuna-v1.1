import { describe, it, expect, vi, beforeEach } from "vitest";

// =====================================================
// Mocks — external dependencies imported transitively by aggregator.ts
// =====================================================

vi.mock("@/lib/logger", () => ({
  createLogger: () => {
    const stub = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: () => stub,
    };
    return stub;
  },
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  createCache: () => ({
    get: vi.fn(() => null),
    set: vi.fn(),
    invalidate: vi.fn(),
  }),
}));

// =====================================================
// Mocks — direct dependencies of aggregator.ts
// =====================================================

vi.mock("../ml", () => ({
  predictWithML: vi.fn().mockResolvedValue(50),
  featureVectorToMLInput: vi.fn().mockReturnValue(Array(15).fill(0.5)),
}));

vi.mock("../calibration", () => ({
  getPlattParameters: vi.fn().mockResolvedValue(null),
  applyPlattScaling: vi.fn((score: number, _params: unknown) => score),
}));

vi.mock("../gemini", () => ({
  GEMINI_MODEL: "gemini-test",
}));

vi.mock("../deepseek", () => ({
  DEEPSEEK_MODEL: "deepseek-test",
}));

// =====================================================
// Imports (after mocks)
// =====================================================

import { selectWeights, aggregateScores } from "../aggregator";
import { makePipelineResult } from "./factories";
import { getPlattParameters, applyPlattScaling } from "../calibration";
import { predictWithML } from "../ml";

// =====================================================
// selectWeights tests
// =====================================================

describe("selectWeights", () => {
  it("returns base weights when all signals are available", () => {
    const weights = selectWeights({
      behavioral: true,
      gemini: true,
      ml: true,
      rules: true,
      trends: true,
    });

    expect(weights).toEqual({
      behavioral: 0.35,
      gemini: 0.25,
      ml: 0.15,
      rules: 0.15,
      trends: 0.1,
    });
  });

  it("redistributes weight when ML is unavailable", () => {
    const weights = selectWeights({
      behavioral: true,
      gemini: true,
      ml: false,
      rules: true,
      trends: true,
    });

    expect(weights.ml).toBe(0);
    expect(weights.behavioral).toBeGreaterThan(0.35);
    expect(weights.gemini).toBeGreaterThan(0.25);
    expect(weights.rules).toBeGreaterThan(0.15);
    expect(weights.trends).toBeGreaterThan(0.1);

    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 2);
  });

  it("redistributes weight when behavioral is unavailable", () => {
    const weights = selectWeights({
      behavioral: false,
      gemini: true,
      ml: true,
      rules: true,
      trends: true,
    });

    expect(weights.behavioral).toBe(0);

    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 2);
  });

  it("redistributes weight when behavioral + ML are both unavailable", () => {
    const weights = selectWeights({
      behavioral: false,
      gemini: true,
      ml: false,
      rules: true,
      trends: true,
    });

    expect(weights.behavioral).toBe(0);
    expect(weights.ml).toBe(0);
    expect(weights.gemini).toBeGreaterThan(0.25);
    expect(weights.rules).toBeGreaterThan(0.15);
    expect(weights.trends).toBeGreaterThan(0.1);

    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 2);
  });

  it("assigns ~1.0 to the sole remaining source when only gemini available", () => {
    const weights = selectWeights({
      behavioral: false,
      gemini: true,
      ml: false,
      rules: false,
      trends: false,
    });

    expect(weights.gemini).toBeCloseTo(1, 2);
    expect(weights.behavioral).toBe(0);
    expect(weights.ml).toBe(0);
    expect(weights.rules).toBe(0);
    expect(weights.trends).toBe(0);
  });

  it("returns all zeros when all sources are unavailable and does not throw", () => {
    expect(() => {
      const weights = selectWeights({
        behavioral: false,
        gemini: false,
        ml: false,
        rules: false,
        trends: false,
      });

      // All weights should be 0 (no sources to redistribute to)
      expect(weights.behavioral).toBe(0);
      expect(weights.gemini).toBe(0);
      expect(weights.ml).toBe(0);
      expect(weights.rules).toBe(0);
      expect(weights.trends).toBe(0);
    }).not.toThrow();
  });

  it("always sums to ~1.0 for any combination of available signals (except all-false)", () => {
    const combos = [
      { behavioral: true, gemini: true, ml: false, rules: false, trends: true },
      { behavioral: false, gemini: true, ml: true, rules: false, trends: false },
      { behavioral: true, gemini: false, ml: true, rules: true, trends: false },
      { behavioral: false, gemini: false, ml: true, rules: true, trends: true },
      { behavioral: true, gemini: true, ml: true, rules: false, trends: false },
    ];

    for (const combo of combos) {
      const weights = selectWeights(combo);
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 2);
    }
  });
});

// =====================================================
// aggregateScores tests
// =====================================================

describe("aggregateScores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock behaviors
    vi.mocked(predictWithML).mockResolvedValue(50);
    vi.mocked(getPlattParameters).mockResolvedValue(null);
    vi.mocked(applyPlattScaling).mockImplementation(
      (score: number, _params: unknown) => score
    );
  });

  it("returns valid result with all signals (happy path)", async () => {
    const result = await aggregateScores(makePipelineResult());

    expect(result.overall_score).toBeGreaterThanOrEqual(0);
    expect(result.overall_score).toBeLessThanOrEqual(100);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(["HIGH", "MEDIUM", "LOW"]).toContain(result.confidence_label);
    expect(result.gemini_score).toBeGreaterThan(0);
    expect(result.behavioral_score).toBeGreaterThan(0);
    expect(result.ml_score).toBe(50); // mocked
    expect(result.engine_version).toBeDefined();
    expect(result.score_weights).toHaveProperty("behavioral");
    expect(result.score_weights).toHaveProperty("gemini");
    expect(result.score_weights).toHaveProperty("ml");
    expect(result.score_weights).toHaveProperty("rules");
    expect(result.score_weights).toHaveProperty("trends");
  });

  it("clamps overall_score to 0-100 range", async () => {
    // Test upper bound: mock ML to return 200 (above max)
    vi.mocked(predictWithML).mockResolvedValue(200);
    const highPipeline = makePipelineResult({
      geminiResult: {
        analysis: {
          factors: [
            { name: "Scroll-Stop Power", score: 10, rationale: "x", improvement_tip: "x" },
            { name: "Completion Pull", score: 10, rationale: "x", improvement_tip: "x" },
            { name: "Rewatch Potential", score: 10, rationale: "x", improvement_tip: "x" },
            { name: "Share Trigger", score: 10, rationale: "x", improvement_tip: "x" },
            { name: "Emotional Charge", score: 10, rationale: "x", improvement_tip: "x" },
          ],
          overall_impression: "Perfect",
          content_summary: "Perfect content",
        },
        cost_cents: 0.5,
      },
    });
    const highResult = await aggregateScores(highPipeline);
    expect(highResult.overall_score).toBeLessThanOrEqual(100);

    // Test lower bound: all zeros
    vi.mocked(predictWithML).mockResolvedValue(0);
    const lowPipeline = makePipelineResult({
      geminiResult: {
        analysis: {
          factors: [
            { name: "Scroll-Stop Power", score: 0, rationale: "x", improvement_tip: "x" },
            { name: "Completion Pull", score: 0, rationale: "x", improvement_tip: "x" },
            { name: "Rewatch Potential", score: 0, rationale: "x", improvement_tip: "x" },
            { name: "Share Trigger", score: 0, rationale: "x", improvement_tip: "x" },
            { name: "Emotional Charge", score: 0, rationale: "x", improvement_tip: "x" },
          ],
          overall_impression: "None",
          content_summary: "No content",
        },
        cost_cents: 0.5,
      },
      deepseekResult: null,
      ruleResult: { rule_score: 0, matched_rules: [] },
      trendEnrichment: {
        trend_score: 0,
        matched_trends: [],
        trend_context: "No trends",
        hashtag_relevance: 0,
      },
    });
    const lowResult = await aggregateScores(lowPipeline);
    expect(lowResult.overall_score).toBeGreaterThanOrEqual(0);
  });

  it("returns is_calibrated=false when no Platt params available", async () => {
    vi.mocked(getPlattParameters).mockResolvedValue(null);
    const result = await aggregateScores(makePipelineResult());
    expect(result.is_calibrated).toBe(false);
  });

  it("returns is_calibrated=true when Platt params are available", async () => {
    const mockParams = { a: -1, b: 0, fittedAt: "2026-01-01", sampleCount: 100 };
    vi.mocked(getPlattParameters).mockResolvedValue(mockParams);
    vi.mocked(applyPlattScaling).mockReturnValue(55);

    const result = await aggregateScores(makePipelineResult());
    expect(result.is_calibrated).toBe(true);
  });

  it("assembles feature_vector with all expected keys", async () => {
    const result = await aggregateScores(makePipelineResult());

    const fv = result.feature_vector;
    expect(fv).toHaveProperty("hookScore");
    expect(fv).toHaveProperty("completionPull");
    expect(fv).toHaveProperty("rewatchPotential");
    expect(fv).toHaveProperty("shareTrigger");
    expect(fv).toHaveProperty("emotionalCharge");
    expect(fv).toHaveProperty("hookEffectiveness");
    expect(fv).toHaveProperty("retentionStrength");
    expect(fv).toHaveProperty("shareability");
    expect(fv).toHaveProperty("commentProvocation");
    expect(fv).toHaveProperty("saveWorthiness");
    expect(fv).toHaveProperty("trendAlignment");
    expect(fv).toHaveProperty("originality");
    expect(fv).toHaveProperty("ruleScore");
    expect(fv).toHaveProperty("trendScore");
    expect(fv).toHaveProperty("hashtagCount");
    expect(fv).toHaveProperty("hasVideo");
  });

  it("handles DeepSeek null (behavioral unavailable)", async () => {
    const pipeline = makePipelineResult({ deepseekResult: null });
    const result = await aggregateScores(pipeline);

    expect(result.behavioral_score).toBe(0);
    expect(result.score_weights.behavioral).toBe(0);
    expect(result.warnings.some((w) => w.includes("missing signals") && w.includes("behavioral"))).toBe(true);
  });

  it("maps confidence_label correctly based on confidence thresholds", async () => {
    // HIGH confidence: all signals available, video mode, matched trends/rules, high agreement
    // With all signals scoring 7, both gemini and behavioral > 50, they agree -> agreement = 0.4
    // signal ~= 0.2 (base) + 0.1 (video) + 0.1 (trends) + 0.1 (3+ rules) + 0.05 (medium deepseek) = 0.55
    // total = 0.55 + 0.4 = 0.95 -> HIGH
    const highPipeline = makePipelineResult({
      payload: {
        content_text: "Test #viral #trending #fyp",
        content_type: "video",
        input_mode: "video_upload",
        video_url: "https://example.com/video.mp4",
        hashtags: ["#viral", "#trending", "#fyp"],
        duration_hint: 30,
        niche: null,
        creator_handle: null,
        society_id: null,
      },
      ruleResult: {
        rule_score: 70,
        matched_rules: [
          { rule_id: "r1", rule_name: "Rule 1", score: 8, max_score: 10, tier: "regex" as const },
          { rule_id: "r2", rule_name: "Rule 2", score: 7, max_score: 10, tier: "regex" as const },
          { rule_id: "r3", rule_name: "Rule 3", score: 9, max_score: 10, tier: "semantic" as const },
        ],
      },
    });
    const highResult = await aggregateScores(highPipeline);
    expect(highResult.confidence_label).toBe("HIGH");

    // LOW confidence: minimal signals, no video, no trends, no rules, models disagree
    // behavioral=0 (null deepseek), gemini_score = 70 (above 50), no agreement term possible
    // signal ~= 0.2 (base) - 0.05 (no rules) - 0.05 (no trends) + 0 (no deepseek conf) = 0.1
    // agreement: geminiDirection=70-50=20 > 0, behavioralDirection=0-50=-50 < 0, |20-(-50)|=70 > 15 -> 0
    // total = 0.1 -> LOW
    vi.mocked(predictWithML).mockResolvedValue(null);
    const lowPipeline = makePipelineResult({
      deepseekResult: null,
      ruleResult: { rule_score: 0, matched_rules: [] },
      trendEnrichment: {
        trend_score: 0,
        matched_trends: [],
        trend_context: "No trends",
        hashtag_relevance: 0,
      },
      warnings: [],
    });
    const lowResult = await aggregateScores(lowPipeline);
    expect(lowResult.confidence_label).toBe("LOW");
  });
});
