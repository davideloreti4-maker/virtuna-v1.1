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

vi.mock("../gemini", () => ({
  GEMINI_MODEL: "gemini-test",
}));

vi.mock("../deepseek", () => ({
  DEEPSEEK_MODEL: "deepseek-test",
  // isCircuitOpen=true short-circuits Stage 11 (which makes the network call). Stage 10
  // is now deterministic TS (no LLM, ignores the breaker) and always runs.
  isCircuitOpen: vi.fn(() => true),
}));

// Phase 13 Plan 02: Stage 11 rebuilt to use Gemini (not DeepSeek).
// Mock to prevent real GoogleGenAI calls during aggregator unit tests.
// Emits stage_start + stage_end events so PIPE-09 event emission test passes.
vi.mock("../stage11-counterfactuals", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../stage11-counterfactuals")>();
  return {
    ...orig,
    runStage11Counterfactuals: vi.fn().mockImplementation(
      async (
        _result: unknown,
        _videoContext: unknown,
        onEvent?: (e: { type: string; stage: string; wave: string; timestamp_ms?: number; duration_ms?: number; cost_cents?: number; ok?: boolean }) => void,
      ) => {
        const ts = performance.now();
        onEvent?.({ type: "stage_start", stage: "stage_11_counterfactuals", wave: "post", timestamp_ms: ts });
        onEvent?.({ type: "stage_end", stage: "stage_11_counterfactuals", wave: "post", duration_ms: 1, cost_cents: 0, ok: true });
        return null;
      },
    ),
  };
});

// Phase 3 (Plan 08) — hoisted mock factories for weighted-aggregator + persona-weights + anti-virality.
// These must be declared BEFORE vi.mock() calls so closures capture them correctly.
const {
  mockBuildWeightedCurve,
  mockAssembleHeatmapPayload,
  mockIsAntiViralityGatedFull,
  mockResolveWeights,
} = vi.hoisted(() => {
  const sampleHeatmap = {
    segments: [
      { idx: 0, t_start: 0, t_end: 3, label: "hook", is_hook_zone: true, keyframe_uri: null },
      { idx: 1, t_start: 3, t_end: 6, label: "body", is_hook_zone: false, keyframe_uri: null },
    ],
    personas: [],
    weighted_curve: [0.9, 0.7],
    weights: { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
    weights_source: "default" as const,
  };
  return {
    mockBuildWeightedCurve: vi.fn(() => ({
      weighted_curve: [0.9, 0.7],
      weighted_completion_pct: 0.8,
      weighted_top_dropoff_t: 3,
      weighted_hook_score: 0.9,
    })),
    mockAssembleHeatmapPayload: vi.fn(() => sampleHeatmap),
    mockIsAntiViralityGatedFull: vi.fn((_confidence: number, _heatmap: unknown): {
      gated: boolean;
      reason: "confidence" | "timeline_pattern" | "both" | null;
      dropoff_segment_indices: number[];
    } => ({
      gated: false,
      reason: null,
      dropoff_segment_indices: [],
    })),
    mockResolveWeights: vi.fn(() => ({
      weights: { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
      source: "default" as const,
    })),
  };
});

vi.mock("../wave3/weighted-aggregator", () => ({
  buildWeightedCurve: mockBuildWeightedCurve,
  assembleHeatmapPayload: mockAssembleHeatmapPayload,
  DEFAULT_WEIGHTS: { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
}));

vi.mock("../persona-weights", () => ({
  resolveWeights: mockResolveWeights,
  DEFAULT_PERSONA_WEIGHT_CONFIG: {},
  normalizeWeights: vi.fn((w: unknown) => w),
}));

vi.mock("../anti-virality", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../anti-virality")>();
  return {
    ...orig,
    isAntiViralityGatedFull: mockIsAntiViralityGatedFull,
  };
});

// =====================================================
// Imports (after mocks)
// =====================================================

import { selectWeights, aggregateScores } from "../aggregator";
import { makePipelineResult, makeGeminiAnalysis } from "./factories";
import { predictWithML } from "../ml";
import type { PersonaBehavioralAggregate, PersonaSimulationResult, SegmentGrid, HookDecomposition } from "../types";
import type { EmotionArcPoint } from "../qwen/schemas";

// =====================================================
// selectWeights tests
// =====================================================

describe("selectWeights", () => {
  it("returns base weights when all signals are available (D-16 Phase 13 normalized values)", () => {
    // D-16 weights: behavioral=0.40, gemini=0.35, audio=0.05, trends=0.10, platform_fit=0.05, ml=0, retrieval=0, rules=0
    // This test call does NOT include audio/platform_fit — activeKeys: behavioral, gemini, ml, rules, trends, retrieval
    // Base sum for active keys: 0.40 + 0.35 + 0 + 0 + 0.10 + 0 = 0.85
    // Normalized: behavioral=0.40/0.85≈0.471, gemini=0.35/0.85≈0.412, trends=0.10/0.85≈0.118, ml=0, rules=0, retrieval=0
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
      retrieval: true, // D-15: retrieval weight=0 in D-16; contributes 0 to sum
    });

    // D-16 Phase 13: ml=0, rules=0, retrieval=0 → raw sum 0.85 (behavioral 0.40 + gemini 0.35 + trends 0.10)
    expect(weights.behavioral).toBeCloseTo(0.471, 2);
    expect(weights.gemini).toBeCloseTo(0.412, 2);
    expect(weights.ml).toBe(0);
    expect(weights.rules).toBe(0);
    expect(weights.trends).toBeCloseTo(0.118, 2);
    expect(weights.retrieval).toBe(0);
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 2);
  });

  it("redistributes weight when ML is unavailable (D-16: ml=0 already; no redistribution change)", () => {
    // D-16: ml=0 in SCORE_WEIGHTS, rules=0 in SCORE_WEIGHTS — no behavioral weight for ml/rules.
    // When ml=false in availability and ml=0 in weights, there is nothing to redistribute.
    // behavioral and gemini receive the full normalized non-zero weight share.
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
      retrieval: true,
    });

    expect(weights.ml).toBe(0);
    // D-16: rules=0 in SCORE_WEIGHTS, so rules weight stays 0 even when rules=true in availability
    expect(weights.rules).toBe(0);
    // behavioral and gemini are the primary weight-bearing signals; they dominate
    expect(weights.behavioral).toBeGreaterThan(0.33);
    expect(weights.gemini).toBeGreaterThan(0.24);
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
      retrieval: true,
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
      retrieval: true,
    });

    expect(weights.behavioral).toBe(0);
    expect(weights.ml).toBe(0);
    // D-16: rules=0 in SCORE_WEIGHTS
    expect(weights.rules).toBe(0);
    expect(weights.gemini).toBeGreaterThan(0.24);
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
      retrieval: false,
    });

    expect(weights.gemini).toBeCloseTo(1, 2);
    expect(weights.behavioral).toBe(0);
    expect(weights.ml).toBe(0);
    expect(weights.rules).toBe(0);
    expect(weights.trends).toBe(0);
    expect(weights.retrieval).toBe(0);
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
        retrieval: false,
      });

      // All weights should be 0 (no sources to redistribute to)
      expect(weights.behavioral).toBe(0);
      expect(weights.gemini).toBe(0);
      expect(weights.ml).toBe(0);
      expect(weights.rules).toBe(0);
      expect(weights.trends).toBe(0);
      expect(weights.retrieval).toBe(0);
    }).not.toThrow();
  });

  it("always sums to ~1.0 for any combination of available signals (except all-false)", () => {
    const combos = [
      { behavioral: true, gemini: true, ml: false, rules: false, trends: true, content_type: false, niche: false, gemini_hook: false, gemini_body: false, gemini_cta: false, personas: false, retrieval: true },
      { behavioral: false, gemini: true, ml: true, rules: false, trends: false, content_type: true, niche: true, gemini_hook: false, gemini_body: false, gemini_cta: false, personas: false, retrieval: false },
      { behavioral: true, gemini: false, ml: true, rules: true, trends: false, content_type: false, niche: false, gemini_hook: false, gemini_body: false, gemini_cta: false, personas: false, retrieval: true },
      { behavioral: false, gemini: false, ml: true, rules: true, trends: true, content_type: true, niche: false, gemini_hook: false, gemini_body: false, gemini_cta: false, personas: false, retrieval: false },
      { behavioral: true, gemini: true, ml: true, rules: false, trends: false, content_type: false, niche: true, gemini_hook: false, gemini_body: false, gemini_cta: false, personas: false, retrieval: true },
      { behavioral: true, gemini: true, ml: false, rules: false, trends: true, content_type: false, niche: false, personas: false, gemini_hook: false, gemini_body: false, gemini_cta: false, retrieval: true },
      { behavioral: false, gemini: true, ml: true, rules: false, trends: false, content_type: true, niche: true, personas: true, gemini_hook: false, gemini_body: false, gemini_cta: false, retrieval: false },
      { behavioral: true, gemini: false, ml: true, rules: true, trends: false, content_type: false, niche: false, personas: false, gemini_hook: false, gemini_body: false, gemini_cta: false, retrieval: true },
      { behavioral: false, gemini: false, ml: true, rules: true, trends: true, content_type: true, niche: false, personas: true, gemini_hook: false, gemini_body: false, gemini_cta: false, retrieval: false },
      { behavioral: true, gemini: true, ml: true, rules: false, trends: false, content_type: false, niche: true, personas: false, gemini_hook: false, gemini_body: false, gemini_cta: false, retrieval: true },
    ];

    for (const combo of combos) {
      const weights = selectWeights(combo);
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 2);
    }
  });
});

// =====================================================
// Phase 8 — retrieval slot tests (Plan 04 Task 3)
// =====================================================

describe("selectWeights — Phase 8 retrieval slot (D-15: retrieval disabled in D-16)", () => {
  it("returns retrieval=0 when retrieval available — D-15 disabled this phase (weight=0 in D-16)", () => {
    // D-15 (Phase 13): retrieval weight=0 in SCORE_WEIGHTS. Corpus embeddings are caption-derived;
    // retrieval signal disabled for video-mode primary flow. Weight=0 means no contribution.
    const w = selectWeights({
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
      retrieval: true,
    });
    // D-15/D-16: retrieval=0 in SCORE_WEIGHTS → normalized weight is 0
    expect(w.retrieval).toBe(0);
    const sum = Object.values(w).reduce((a, b) => a + (b ?? 0), 0);
    expect(sum).toBeCloseTo(1.0, 2);
  });

  it("retrieval=false: same result as retrieval=true (both contribute 0 — D-15 disabled)", () => {
    const wTrue = selectWeights({
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
      retrieval: true,
    });
    const wFalse = selectWeights({
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
      retrieval: false,
    });
    // Both retrieval=true and retrieval=false should yield retrieval weight=0
    expect(wTrue.retrieval ?? 0).toBe(0);
    expect(wFalse.retrieval ?? 0).toBe(0);
    const totalTrue = Object.values(wTrue).reduce((a, b) => a + (b ?? 0), 0);
    expect(totalTrue).toBeCloseTo(1.0, 2);
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
    expect(ENGINE_VERSION).toBe("3.0.0");
  });

  it("PredictionResult.engine_version reads from ./version module", async () => {
    const { ENGINE_VERSION } = await import("../version");
    const result = await aggregateScores(makePipelineResult());
    expect(result.engine_version).toBe(ENGINE_VERSION);
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
  });

  it("selectWeights regression: 6-key availability all-true → D-16 Phase 13 normalized weights", () => {
    // D-16 weights without audio/platform_fit in this call:
    // active base sum = behavioral(0.40) + gemini(0.35) + ml(0) + rules(0) + trends(0.10) + retrieval(0) = 0.85
    // normalized: behavioral=0.40/0.85, gemini=0.35/0.85, trends=0.10/0.85
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
      retrieval: true, // D-15: weight=0 in D-16
    });
    // D-16 Phase 13: rules=0, retrieval=0, ml=0 → sum of active non-zero: 0.40+0.35+0.10=0.85
    expect(weights.behavioral).toBeCloseTo(0.471, 2);
    expect(weights.gemini).toBeCloseTo(0.412, 2);
    expect(weights.ml).toBe(0);
    expect(weights.rules).toBe(0);
    expect(weights.trends).toBeCloseTo(0.118, 2);
    expect(weights.retrieval).toBe(0);
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
      retrieval: true,
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
      retrieval: true,
    });
    expect(weightsWithNew).toEqual(weightsWithoutNew);
    const sum = Object.values(weightsWithNew).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 2);
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
      retrieval: true,
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
          primary_slug: "beauty",
          micro_slug: null,
          confidence: 0.8,
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
      rewatch_intent: 40,
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
      rewatch_intent: 15,
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

// =====================================================
// Phase 8 — aggregator retrieval signal integration (Plan 04 Task 3)
// =====================================================

import type { RetrievalEvidenceItem } from "../types";

describe("Phase 8 — aggregator retrieval integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(predictWithML).mockResolvedValue(50);
  });

  it("populates retrieval_score on PredictionResult when retrieval is available", async () => {
    const pipeline = makePipelineResult({
      retrievalResult: {
        evidence: [],
        score: 0.8,
        availability: true,
        cost_cents: 0.001,
      },
    });
    const result = await aggregateScores(pipeline);
    expect(result.retrieval_score).toBe(0.8);
    expect(result.signal_availability.retrieval).toBe(true);
  });

  it("treats retrieval_score=null as 0 contribution to overall_score (null-safe)", async () => {
    const pipeline = makePipelineResult({
      retrievalResult: {
        evidence: [],
        score: null,
        availability: false,
        cost_cents: 0,
      },
    });
    const result = await aggregateScores(pipeline);
    expect(result.retrieval_score).toBeNull();
    expect(result.signal_availability.retrieval).toBe(false);
    // overall_score must still be a valid number (no NaN from null arithmetic)
    expect(result.overall_score).toBeGreaterThanOrEqual(0);
    expect(result.overall_score).toBeLessThanOrEqual(100);
  });

  it("populates retrieval_evidence on PredictionResult", async () => {
    const evidence: RetrievalEvidenceItem[] = [
      {
        source_pool: "training_corpus",
        source_id: "abcdef00-0000-0000-0000-000000000001",
        similarity_score: 0.9,
        video_url: "https://tiktok.com/v/1",
        creator_handle: "creator1",
        caption_snippet: "Test caption",
        views: 1_000_000,
        likes: 100_000,
        shares: 5_000,
        comments: 2_000,
        saves: 10_000,
        hashtags: ["beauty", "grwm"],
        posted_at: "2026-04-01T00:00:00Z",
        bucket_label: "viral",
        bucket_source: "corpus",
        relaxed_to: "strict",
      },
    ];
    const pipeline = makePipelineResult({
      retrievalResult: {
        evidence,
        score: 0.9,
        availability: true,
        cost_cents: 0.001,
      },
    });
    const result = await aggregateScores(pipeline);
    expect(result.retrieval_evidence).toEqual(evidence);
  });

  it("score_weights.retrieval is included in PredictionResult", async () => {
    const pipeline = makePipelineResult({
      retrievalResult: {
        evidence: [],
        score: 0.5,
        availability: true,
        cost_cents: 0.001,
      },
    });
    const result = await aggregateScores(pipeline);
    expect(result.score_weights).toHaveProperty("retrieval");
    // D-15/D-16 (Phase 13): retrieval weight=0 — corpus embeddings caption-derived.
    expect(result.score_weights.retrieval).toBe(0);
  });

  it("signal_availability.retrieval mirrors pipelineResult.retrievalResult.availability", async () => {
    const trueResult = await aggregateScores(
      makePipelineResult({
        retrievalResult: {
          evidence: [],
          score: 0.5,
          availability: true,
          cost_cents: 0.001,
        },
      }),
    );
    expect(trueResult.signal_availability.retrieval).toBe(true);

    const falseResult = await aggregateScores(
      makePipelineResult({
        retrievalResult: {
          evidence: [],
          score: null,
          availability: false,
          cost_cents: 0,
        },
      }),
    );
    expect(falseResult.signal_availability.retrieval).toBe(false);
  });
});

// =====================================================
// Phase 3 (Plan 08) — aggregator.ts Pass 2 wiring
// Tests: weighted_* fields + heatmap + isAntiViralityGatedFull + signal_availability.pass2_timeline
// =====================================================

describe("aggregateScores Phase 3 (Plan 08) — Pass 2 wiring", () => {
  // Shared fixtures
  const sampleSegments: SegmentGrid[] = [
    { t_start: 0, t_end: 3, visual_event: "hook reveal", audio_event: "beat drop", is_hook_zone: true },
    { t_start: 3, t_end: 6, visual_event: "body content", audio_event: "ambient", is_hook_zone: false },
  ];

  const samplePass2Results = [
    {
      persona_id: "fyp-saver-beauty",
      archetype: "saver" as const,
      slot_type: "fyp" as const,
      segment_reactions: [
        { t_start: 0, t_end: 3, attention: 0.9, swipe_predicted: false },
        { t_start: 3, t_end: 6, attention: 0.7, swipe_predicted: false },
      ],
      pass2_latency_ms: 500,
      pass2_cost_cents: 0.05,
    },
    {
      persona_id: "fyp-lurker-beauty",
      archetype: "lurker" as const,
      slot_type: "fyp" as const,
      segment_reactions: [
        { t_start: 0, t_end: 3, attention: 0.8, swipe_predicted: false },
        { t_start: 3, t_end: 6, attention: 0.6, swipe_predicted: true },
      ],
      pass2_latency_ms: 450,
      pass2_cost_cents: 0.05,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to their default implementations
    mockBuildWeightedCurve.mockReturnValue({
      weighted_curve: [0.9, 0.7],
      weighted_completion_pct: 0.8,
      weighted_top_dropoff_t: 3,
      weighted_hook_score: 0.9,
    });
    mockAssembleHeatmapPayload.mockReturnValue({
      segments: [
        { idx: 0, t_start: 0, t_end: 3, label: "hook reveal", is_hook_zone: true, keyframe_uri: null },
        { idx: 1, t_start: 3, t_end: 6, label: "body content", is_hook_zone: false, keyframe_uri: null },
      ],
      personas: [],
      weighted_curve: [0.9, 0.7],
      weights: { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
      weights_source: "default" as const,
    });
    mockIsAntiViralityGatedFull.mockReturnValue({ gated: false as boolean, reason: null as "confidence" | "timeline_pattern" | "both" | null, dropoff_segment_indices: [] as number[] });
    mockResolveWeights.mockReturnValue({
      weights: { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
      source: "default" as const,
    });
    vi.mocked(predictWithML).mockResolvedValue(50);
  });

  it("Phase 3: heatmap populated via assembleHeatmapPayload when pass2_aggregate_built === true", async () => {
    const pipeline = makePipelineResult({
      pass2Outcome: {
        pass2Results: samplePass2Results,
        warnings: [] as string[],
        cost_cents: 0.1,
        pass2_success_count: 2,
        pass2_aggregate_built: true,
      },
      segments: sampleSegments,
    });
    const result = await aggregateScores(pipeline);
    expect(mockAssembleHeatmapPayload).toHaveBeenCalledOnce();
    expect(result.heatmap).not.toBeNull();
    expect(result.heatmap).toBeDefined();
  });

  it("Phase 3: weighted_completion_pct / weighted_top_dropoff_t / weighted_hook_score populated from buildWeightedCurve", async () => {
    const pipeline = makePipelineResult({
      pass2Outcome: {
        pass2Results: samplePass2Results,
        warnings: [] as string[],
        cost_cents: 0.1,
        pass2_success_count: 2,
        pass2_aggregate_built: true,
      },
      segments: sampleSegments,
    });
    const result = await aggregateScores(pipeline);
    expect(result.weighted_completion_pct).toBe(0.8);
    expect(result.weighted_top_dropoff_t).toBe(3);
    expect(result.weighted_hook_score).toBe(0.9);
  });

  it("Phase 3: signal_availability.pass2_timeline === true when pass2_aggregate_built", async () => {
    const pipeline = makePipelineResult({
      pass2Outcome: {
        pass2Results: samplePass2Results,
        warnings: [] as string[],
        cost_cents: 0.1,
        pass2_success_count: 2,
        pass2_aggregate_built: true,
      },
      segments: sampleSegments,
    });
    const result = await aggregateScores(pipeline);
    expect(result.signal_availability.pass2_timeline).toBe(true);
  });

  it("Phase 3: signal_availability.pass2_timeline === false when pass2Outcome is null", async () => {
    const pipeline = makePipelineResult({ pass2Outcome: null });
    const result = await aggregateScores(pipeline);
    expect(result.signal_availability.pass2_timeline).toBe(false);
  });

  it("Phase 3: when pass2_aggregate_built === false, heatmap=null and weighted_* fields=null (Pass 1 fallback)", async () => {
    const pipeline = makePipelineResult({
      pass2Outcome: {
        pass2Results: [] as typeof samplePass2Results,
        warnings: ["Too few personas succeeded"] as string[],
        cost_cents: 0.05,
        pass2_success_count: 3,
        pass2_aggregate_built: false,
      },
      segments: sampleSegments,
    });
    const result = await aggregateScores(pipeline);
    expect(result.heatmap).toBeNull();
    expect(result.weighted_completion_pct).toBeNull();
    expect(result.weighted_top_dropoff_t).toBeNull();
    expect(result.weighted_hook_score).toBeNull();
  });

  it("Phase 3: isAntiViralityGatedFull called instead of isAntiViralityGated when heatmap present", async () => {
    const pipeline = makePipelineResult({
      pass2Outcome: {
        pass2Results: samplePass2Results,
        warnings: [] as string[],
        cost_cents: 0.1,
        pass2_success_count: 2,
        pass2_aggregate_built: true,
      },
      segments: sampleSegments,
    });
    await aggregateScores(pipeline);
    expect(mockIsAntiViralityGatedFull).toHaveBeenCalled();
  });

  it("Phase 3: when heatmap triggers timeline pattern with confidence above 0.4, anti_virality_gated=true with reason='timeline_pattern'", async () => {
    // Mock isAntiViralityGatedFull to return timeline_pattern gating. Persistent (not Once):
    // deterministic Stage 10 now always runs, so the POST-critique re-eval calls this a 2nd
    // time — the real fn is heatmap-deterministic and returns timeline_pattern on both calls.
    mockIsAntiViralityGatedFull.mockReturnValue({
      gated: true,
      reason: "timeline_pattern" as const,
      dropoff_segment_indices: [1],
    });
    const pipeline = makePipelineResult({
      pass2Outcome: {
        pass2Results: samplePass2Results,
        warnings: [] as string[],
        cost_cents: 0.1,
        pass2_success_count: 2,
        pass2_aggregate_built: true,
      },
      segments: sampleSegments,
    });
    const result = await aggregateScores(pipeline);
    expect(result.anti_virality_gated).toBe(true);
    expect(result.anti_virality_reason).toBe("timeline_pattern");
  });
});

// =====================================================
// Phase 2 (Quick 260528-nqx) — hook_decomposition + emotion_arc pluck
// =====================================================

describe("hook_decomposition + emotion_arc pluck (Quick 260528-nqx)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(predictWithML).mockResolvedValue(50);
  });

  it("populates hook_decomposition on result when geminiResult.analysis.hook_decomposition is present", async () => {
    const hookDecomp: HookDecomposition = {
      visual_stop_power: 8.2,
      audio_hook_quality: 6.5,
      first_words_speech_score: 7.0,
      text_overlay_score: 4.1,
      visual_audio_coherence: 7.4,
      cognitive_load: 5,
      weakest_modality: "text_overlay_score",
      // watermark_detected is optional per ALGO-06 back-compat; omit in this test
    };
    const arc: EmotionArcPoint[] = [
      { timestamp_ms: 0, intensity_0_1: 0.3 },
      { timestamp_ms: 1500, intensity_0_1: 0.8 },
    ];
    const pipeline = makePipelineResult({
      geminiResult: {
        // Cast to inject fields not in the base GeminiAnalysis Zod shape
        // (hook_decomposition lives on GeminiVideoAnalysis, the video superset).
        // At runtime the Gemini video path always returns GeminiVideoAnalysis;
        // only the aggregator's static typing sees the narrower base type.
        analysis: {
          ...makeGeminiAnalysis(),
          hook_decomposition: hookDecomp,
          emotion_arc: arc,
        } as unknown as ReturnType<typeof makeGeminiAnalysis>,
        cost_cents: 0.5,
      },
    });
    const result = await aggregateScores(pipeline);
    expect(result.hook_decomposition).toEqual(hookDecomp);
    expect(result.emotion_arc).toEqual(arc);
  });

  it("falls back to null when geminiResult.analysis omits both fields", async () => {
    const pipeline = makePipelineResult({
      geminiResult: {
        analysis: {
          ...makeGeminiAnalysis(),
          hook_decomposition: undefined,
          emotion_arc: undefined,
        } as unknown as ReturnType<typeof makeGeminiAnalysis>,
        cost_cents: 0.5,
      },
    });
    const result = await aggregateScores(pipeline);
    expect(result.hook_decomposition).toBeNull();
    expect(result.emotion_arc).toBeNull();
  });

  it("falls back to null when emotion_arc is an empty array (preserves Pitfall #5 backward compat)", async () => {
    const pipeline = makePipelineResult({
      geminiResult: {
        analysis: {
          ...makeGeminiAnalysis(),
          hook_decomposition: undefined,
          emotion_arc: [],
        } as unknown as ReturnType<typeof makeGeminiAnalysis>,
        cost_cents: 0.5,
      },
    });
    const result = await aggregateScores(pipeline);
    expect(result.emotion_arc).toBeNull();
  });
});
