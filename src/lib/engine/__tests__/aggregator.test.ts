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
import { makePipelineResult, makeGeminiAnalysis } from "./factories";
import { getPlattParameters, applyPlattScaling } from "../calibration";
import { predictWithML } from "../ml";
import type { PersonaBehavioralAggregate, PersonaSimulationResult } from "../types";

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
      content_type: false, // Phase 4 (D-20) — does NOT participate in weight math
      niche: false,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
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
      content_type: false,
      niche: false,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
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
      content_type: false,
      niche: false,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
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
      content_type: false,
      niche: false,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
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
      content_type: false,
      niche: false,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
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
        content_type: false,
        niche: false,
        gemini_hook: false,
        gemini_body: false,
        gemini_cta: false,
        personas: false,
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
      { behavioral: true, gemini: true, ml: false, rules: false, trends: true, content_type: false, niche: false, gemini_hook: false, gemini_body: false, gemini_cta: false },
      { behavioral: false, gemini: true, ml: true, rules: false, trends: false, content_type: true, niche: true, gemini_hook: false, gemini_body: false, gemini_cta: false },
      { behavioral: true, gemini: false, ml: true, rules: true, trends: false, content_type: false, niche: false, gemini_hook: false, gemini_body: false, gemini_cta: false },
      { behavioral: false, gemini: false, ml: true, rules: true, trends: true, content_type: true, niche: false, gemini_hook: false, gemini_body: false, gemini_cta: false },
      { behavioral: true, gemini: true, ml: true, rules: false, trends: false, content_type: false, niche: true, gemini_hook: false, gemini_body: false, gemini_cta: false },
      { behavioral: true, gemini: true, ml: false, rules: false, trends: true, content_type: false, niche: false, personas: false },
      { behavioral: false, gemini: true, ml: true, rules: false, trends: false, content_type: true, niche: true, personas: true },
      { behavioral: true, gemini: false, ml: true, rules: true, trends: false, content_type: false, niche: false, personas: false },
      { behavioral: false, gemini: false, ml: true, rules: true, trends: true, content_type: true, niche: false, personas: true },
      { behavioral: true, gemini: true, ml: true, rules: false, trends: false, content_type: false, niche: true, personas: false },
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
        video_url: null,
        video_storage_path: "test-user/video.mp4",
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

// =====================================================
// Phase 3 — provenance + stub invocations
// =====================================================

describe("Phase 3 — provenance + stub invocations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(predictWithML).mockResolvedValue(50);
    vi.mocked(getPlattParameters).mockResolvedValue(null);
    vi.mocked(applyPlattScaling).mockImplementation(
      (score: number, _params: unknown) => score
    );
  });

  it("returns signal_availability populated from internal computation (PIPE-07)", async () => {
    const result = await aggregateScores(makePipelineResult());
    expect(result.signal_availability).toBeDefined();
    expect(typeof result.signal_availability.behavioral).toBe("boolean");
    expect(typeof result.signal_availability.gemini).toBe("boolean");
    expect(typeof result.signal_availability.ml).toBe("boolean");
    expect(typeof result.signal_availability.rules).toBe("boolean");
    expect(typeof result.signal_availability.trends).toBe("boolean");
  });

  it("re-exports ENGINE_VERSION from ./version (back-compat — PIPE-08)", async () => {
    const { ENGINE_VERSION } = await import("../aggregator");
    const { ENGINE_VERSION: viaVersion } = await import("../version");
    expect(ENGINE_VERSION).toBe(viaVersion);
    expect(ENGINE_VERSION).toBe("3.0.0-dev");
  });

  it("PredictionResult.engine_version reads from ./version module", async () => {
    const result = await aggregateScores(makePipelineResult());
    expect(result.engine_version).toBe("3.0.0-dev");
  });

  it("invokes Stage 10 + Stage 11 stubs with onStageEvent forwarding (PIPE-09)", async () => {
    const events: string[] = [];
    await aggregateScores(makePipelineResult(), (e) => {
      if (e.type === "stage_start" || e.type === "stage_end") {
        if ("stage" in e && e.stage) events.push(e.stage);
      }
    });
    expect(events).toContain("stage_10_critique");
    expect(events).toContain("stage_11_counterfactuals");
  });

  it("overall_score is unchanged for identical input (PIPE-06 math invariance)", async () => {
    const a = await aggregateScores(makePipelineResult());
    const b = await aggregateScores(makePipelineResult());
    expect(a.overall_score).toBe(b.overall_score);
    expect(a.confidence).toBe(b.confidence);
    expect(a.gemini_score).toBe(b.gemini_score);
    expect(a.behavioral_score).toBe(b.behavioral_score);
  });

  it("signal_availability.behavioral=true when deepseekResult present", async () => {
    const result = await aggregateScores(makePipelineResult());
    expect(result.signal_availability.behavioral).toBe(true);
  });

  it("signal_availability.behavioral=false when deepseekResult is null", async () => {
    const result = await aggregateScores(
      makePipelineResult({ deepseekResult: null })
    );
    expect(result.signal_availability.behavioral).toBe(false);
  });

  it("calling aggregateScores without onStageEvent works (backwards-compat)", async () => {
    // Existing callers don't pass the second arg — must still work
    const result = await aggregateScores(makePipelineResult());
    expect(result).toBeDefined();
    expect(result.overall_score).toBeGreaterThanOrEqual(0);
  });
});

// =====================================================
// Phase 4 — Wave 0 aggregator integration (Plan 04-03 Task 3)
// =====================================================

describe("Phase 4 — Wave 0 aggregator integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(predictWithML).mockResolvedValue(50);
    vi.mocked(getPlattParameters).mockResolvedValue(null);
    vi.mocked(applyPlattScaling).mockImplementation(
      (score: number, _params: unknown) => score
    );
  });

  it("selectWeights regression: 5-key availability all-true → unchanged base weights", () => {
    const weights = selectWeights({
      behavioral: true,
      gemini: true,
      ml: true,
      rules: true,
      trends: true,
      content_type: false, // new keys present but irrelevant
      niche: false,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
    });
    expect(weights).toEqual({
      behavioral: 0.35,
      gemini: 0.25,
      ml: 0.15,
      rules: 0.15,
      trends: 0.1,
    });
  });

  it("selectWeights ignores content_type + niche keys (Critical Cross-File Constraint #3)", () => {
    const weightsWithNew = selectWeights({
      behavioral: true,
      gemini: true,
      ml: true,
      rules: true,
      trends: true,
      content_type: true,
      niche: true,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
    });
    const weightsWithoutNew = selectWeights({
      behavioral: true,
      gemini: true,
      ml: true,
      rules: true,
      trends: true,
      content_type: false,
      niche: false,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
    });
    expect(weightsWithNew).toEqual(weightsWithoutNew);
    const sum = Object.values(weightsWithNew).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 3);
  });

  it("selectWeights redistribution still works with new keys present (1 missing)", () => {
    const weights = selectWeights({
      behavioral: false,
      gemini: true,
      ml: true,
      rules: true,
      trends: true,
      content_type: true,
      niche: true,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
    });
    // 2-decimal precision matches existing "always sums to ~1.0" test convention
    // (rounding step inside selectWeights can introduce ±0.001 floating drift).
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 2);
    expect(weights.behavioral).toBe(0);
  });

  it("signal_availability.content_type set to true when wave0Result.content_type is non-null", async () => {
    const pipeline = makePipelineResult({
      wave0Result: {
        content_type: { type: "talking_head", confidence: 0.85 },
        niche: null,
      },
    });
    const result = await aggregateScores(pipeline);
    expect(result.signal_availability.content_type).toBe(true);
    expect(result.signal_availability.niche).toBe(false);
  });

  it("signal_availability.niche set to true when wave0Result.niche is non-null", async () => {
    const pipeline = makePipelineResult({
      wave0Result: {
        content_type: null,
        niche: {
          primary: "beauty",
          sub: "skincare",
          micro: null,
          confidence: 0.8,
          source: "ai",
        },
      },
    });
    const result = await aggregateScores(pipeline);
    expect(result.signal_availability.niche).toBe(true);
    expect(result.signal_availability.content_type).toBe(false);
  });

  it("feature_vector uses content-type-adjusted video signals when content_type present (D-12 slideshow halves pacing)", async () => {
    const pipeline = makePipelineResult({
      wave0Result: {
        content_type: { type: "slideshow", confidence: 0.9 },
        niche: null,
      },
      geminiResult: {
        analysis: makeGeminiAnalysis({
          video_signals: {
            visual_production_quality: 8,
            hook_visual_impact: 8,
            pacing_score: 8,
            transition_quality: 8,
          },
        }),
        cost_cents: 0.5,
      },
    });
    const result = await aggregateScores(pipeline);
    // slideshow matrix: pacing multiplier 0.5 → 8 × 0.5 = 4
    expect(result.feature_vector.pacingScore).toBeCloseTo(4, 1);
    // slideshow matrix: visual_production_quality multiplier 0.8 → 8 × 0.8 = 6.4
    expect(result.feature_vector.visualProductionQuality).toBeCloseTo(6.4, 1);
  });

  it("feature_vector uses raw video signals when content_type is null (Wave 0 failure / no video)", async () => {
    const pipeline = makePipelineResult({
      wave0Result: { content_type: null, niche: null },
      geminiResult: {
        analysis: makeGeminiAnalysis({
          video_signals: {
            visual_production_quality: 7,
            hook_visual_impact: 7,
            pacing_score: 7,
            transition_quality: 7,
          },
        }),
        cost_cents: 0.5,
      },
    });
    const result = await aggregateScores(pipeline);
    expect(result.feature_vector.pacingScore).toBe(7);
    expect(result.feature_vector.visualProductionQuality).toBe(7);
  });

  it("matrix application does not mutate the original geminiResult.video_signals (defensive)", async () => {
    const originalSignals = {
      visual_production_quality: 8,
      hook_visual_impact: 8,
      pacing_score: 8,
      transition_quality: 8,
    };
    const pipeline = makePipelineResult({
      wave0Result: {
        content_type: { type: "action", confidence: 0.9 },
        niche: null,
      },
      geminiResult: {
        analysis: makeGeminiAnalysis({ video_signals: { ...originalSignals } }),
        cost_cents: 0.5,
      },
    });
    await aggregateScores(pipeline);
    // Original geminiResult.video_signals must remain unmodified after aggregateScores.
    expect(pipeline.geminiResult.analysis.video_signals).toEqual(originalSignals);
  });
});

// =====================================================
// Phase 7 — aggregateScores widening (Plan 07-03)
// Personas signal_availability flag + optional behavioralSource override.
// =====================================================

describe("aggregateScores Phase 7 widening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(predictWithML).mockResolvedValue(50);
    vi.mocked(getPlattParameters).mockResolvedValue(null);
    vi.mocked(applyPlattScaling).mockImplementation(
      (score: number, _params: unknown) => score
    );
  });

  const samplePersonaAggregate: PersonaBehavioralAggregate = {
    completion_pct: 99.5,
    completion_percentile: "top 10%",
    share_pct: 75,
    share_percentile: "top 25%",
    comment_pct: 60,
    comment_percentile: "top 25%",
    save_pct: 80,
    save_percentile: "top 10%",
  };

  const samplePersonaResults: PersonaSimulationResult[] = [
    {
      persona_id: "fyp-saver-beauty",
      archetype: "saver",
      slot_type: "fyp",
      niche: "beauty",
      scroll_past_second: 5,
      watch_through_pct: 80,
      comment_intent: 20,
      share_intent: 30,
      save_intent: 70,
      reasoning: "test saver reaction",
    },
    {
      persona_id: "fyp-lurker-beauty",
      archetype: "lurker",
      slot_type: "fyp",
      niche: "beauty",
      scroll_past_second: 30,
      watch_through_pct: 95,
      comment_intent: 5,
      share_intent: 10,
      save_intent: 20,
      reasoning: "test lurker reaction",
    },
  ];

  it("Test 1 (D-08): default (no third arg) reads deepseek.behavioral_predictions", async () => {
    const pipelineResult = makePipelineResult();
    const result = await aggregateScores(pipelineResult);
    // The makePipelineResult factory sets deepseekResult.reasoning.behavioral_predictions —
    // assert the result's behavioral_predictions matches that source (not the persona aggregate).
    expect(result.behavioral_predictions).toEqual(
      pipelineResult.deepseekResult!.reasoning.behavioral_predictions,
    );
  });

  it("Test 2 (D-15): signal_availability.personas is false when personaBehavioralAggregate is null", async () => {
    const pipelineResult = makePipelineResult({ personaBehavioralAggregate: null });
    const result = await aggregateScores(pipelineResult);
    expect(result.signal_availability.personas).toBe(false);
  });

  it("Test 3 (D-15): signal_availability.personas is true when personaBehavioralAggregate is non-null", async () => {
    const pipelineResult = makePipelineResult({
      personaBehavioralAggregate: samplePersonaAggregate,
    });
    const result = await aggregateScores(pipelineResult);
    expect(result.signal_availability.personas).toBe(true);
  });

  it("Test 4 (D-14): behavioralSource='personas' with non-null aggregate substitutes the source", async () => {
    const pipelineResult = makePipelineResult({
      personaBehavioralAggregate: samplePersonaAggregate,
    });
    const result = await aggregateScores(pipelineResult, undefined, {
      behavioralSource: "personas",
    });
    expect(result.behavioral_predictions.completion_pct).toBe(99.5);
    expect(result.behavioral_predictions).toEqual(samplePersonaAggregate);
  });

  it("Test 5 (D-14 fallback): behavioralSource='personas' with null aggregate falls back to deepseek", async () => {
    const pipelineResult = makePipelineResult({ personaBehavioralAggregate: null });
    const result = await aggregateScores(pipelineResult, undefined, {
      behavioralSource: "personas",
    });
    expect(result.behavioral_predictions).toEqual(
      pipelineResult.deepseekResult!.reasoning.behavioral_predictions,
    );
  });

  it("Test 6 (Pitfall 10): explicit 'deepseek' source equals default behavior", async () => {
    const pipelineResult = makePipelineResult({
      personaBehavioralAggregate: samplePersonaAggregate,
    });
    const defaultResult = await aggregateScores(pipelineResult);
    const explicitResult = await aggregateScores(pipelineResult, undefined, {
      behavioralSource: "deepseek",
    });
    expect(explicitResult.behavioral_predictions).toEqual(defaultResult.behavioral_predictions);
  });

  it("Test 7 (PERSONA-11 + D-09): persona_simulation_results persisted from pipelineResult.wave3Result", async () => {
    const pipelineResult = makePipelineResult({
      wave3Result: samplePersonaResults,
      personaBehavioralAggregate: samplePersonaAggregate,
    });
    const result = await aggregateScores(pipelineResult);
    expect(result.persona_simulation_results).toEqual(samplePersonaResults);
    expect(result.persona_simulation_results.length).toBe(2);
  });

  it("Test 8 (D-20): persona_behavioral_aggregate field exposed on PredictionResult", async () => {
    const pipelineResult = makePipelineResult({
      personaBehavioralAggregate: samplePersonaAggregate,
    });
    const result = await aggregateScores(pipelineResult);
    expect(result.persona_behavioral_aggregate).toEqual(samplePersonaAggregate);
  });
});
