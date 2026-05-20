/**
 * Wave 0 test suite for Phase 9 Stage 11 counterfactuals (COUNTER-01..04).
 * All tests pass GREEN with real V3 mock.
 *
 * Test surface:
 *   1 — COUNTER-01: returns non-null CounterfactualResult with suggestions
 *   2 — COUNTER-02: each suggestion has change, timestamp_ms, expected_impact
 *   3 — COUNTER-03: returns suggestions when overall_score is below flop threshold
 *   4 — COUNTER-04: returns null when content scores above flop threshold
 *   5 — LIKELY_FLOP boundary: score < 30 AND confidence > 0.70 → warning added
 *   6 — LIKELY_FLOP boundary: score >= 30 AND confidence > 0.70 → no warning
 *   7 — LIKELY_FLOP boundary: score < 30 AND confidence <= 0.70 → no warning
 *   8 — LIKELY_FLOP boundary: score >= 30 AND confidence <= 0.70 → no warning
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runStage11Counterfactuals, maybeAppendLikelyFlopWarning } from "../stage11-counterfactuals";
import { buildCounterfactualsUserMessage, CounterfactualsResponseSchema } from "../stage11-counterfactuals-prompts";
import type { PredictionResult } from "../types";

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

const { mockCreate, mockIsCircuitOpen } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockIsCircuitOpen: vi.fn(() => false),
}));

vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockCreate } };
  });
  return { default: MockOpenAI };
});

vi.mock("../deepseek", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../deepseek")>();
  return { ...orig, isCircuitOpen: mockIsCircuitOpen };
});

process.env.DEEPSEEK_API_KEY = "test-key";

// =====================================================
// Factory helpers
// =====================================================

function makeValidCounterfactualsResponse(
  overrides?: Partial<{
    suggestions: Array<{ change: string; timestamp_ms: number; expected_impact: string }>;
  }>,
): string {
  return JSON.stringify({
    suggestions: [
      {
        change: "Add a pattern interrupt at the 3-second mark — cut to a close-up of the product with a sound effect",
        timestamp_ms: 3000,
        expected_impact: "Reduces early drop-off by 15-20% by resetting viewer attention",
      },
      {
        change: "Move the hook's key visual to the first 1.5 seconds — current establishing shot wastes critical scroll time",
        timestamp_ms: 0,
        expected_impact: "Increases hook retention by 25% for audio-off viewers",
      },
      {
        change: "Replace generic caption with a specific number-backed hook in the first frame text overlay",
        timestamp_ms: 500,
        expected_impact: "Improves scroll-stop rate by 30% through specificity bias",
      },
    ],
    ...overrides,
  });
}

function mockV3Success(body: string): void {
  mockCreate.mockResolvedValueOnce({
    choices: [{ message: { content: body } }],
    usage: {
      prompt_tokens: 500,
      prompt_cache_hit_tokens: 450,
      prompt_cache_miss_tokens: 50,
      completion_tokens: 120,
    },
  });
}

function makeFakePredictionResult(
  overrides?: Partial<PredictionResult>,
): PredictionResult {
  return {
    overall_score: 45,
    confidence: 0.65,
    confidence_label: "MEDIUM",
    is_calibrated: false,
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
    reasoning: "test reasoning for counterfactual generation",
    warnings: [],
    predicted_engagement: {
      views: 10000,
      likes: 500,
      shares: 100,
      comments: 50,
      saves: 30,
    },
    factors: [
      { id: "hook-power", name: "Hook Power", score: 8, max_score: 10, rationale: "Strong opening", improvement_tip: "Add visual surprise" },
      { id: "retention-pull", name: "Retention Pull", score: 6, max_score: 10, rationale: "Decent narrative", improvement_tip: "Tease earlier" },
      { id: "share-trigger", name: "Share Trigger", score: 3, max_score: 10, rationale: "Low shareability", improvement_tip: "Add CTA" },
    ],
    suggestions: [
      { id: "sug-1", text: "Add pattern interrupt at 3s", priority: "high", category: "hook" },
    ],
    rule_score: 55,
    trend_score: 30,
    gemini_score: 85,
    behavioral_score: 45,
    ml_score: 50,
    score_weights: {
      behavioral: 0.35,
      gemini: 0.25,
      ml: 0.15,
      rules: 0.15,
      trends: 0.10,
    },
    latency_ms: 1500,
    cost_cents: 5,
    engine_version: "9.0.0",
    gemini_model: "gemini-2.0-flash",
    deepseek_model: "deepseek-reasoner",
    input_mode: "text",
    has_video: false,
    signal_availability: {
      behavioral: true,
      gemini: true,
      ml: true,
      rules: true,
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
      completion_pct: 45,
      completion_percentile: "top 50%",
      share_pct: 2.1,
      share_percentile: "top 50%",
      comment_pct: 1.5,
      comment_percentile: "top 50%",
      save_pct: 1.8,
      save_percentile: "top 50%",
    },
    persona_simulation_results: [],
    retrieval_score: null,
    retrieval_evidence: [],
    ...overrides,
  };
}

describe("runStage11Counterfactuals — COUNTER-01..04 (Phase 9 Wave 0 GREEN)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCircuitOpen.mockReturnValue(false);
  });

  // COUNTER-01: Returns suggestions
  it("COUNTER-01: returns non-null CounterfactualResult with suggestions", async () => {
    mockV3Success(makeValidCounterfactualsResponse());
    const result = await runStage11Counterfactuals(makeFakePredictionResult());
    expect(result).not.toBeNull();
    expect(Array.isArray(result!.suggestions)).toBe(true);
    expect(result!.suggestions.length).toBe(3);
  });

  // COUNTER-02: Suggestion shape
  it("COUNTER-02: each suggestion has change, timestamp_ms, expected_impact", async () => {
    mockV3Success(makeValidCounterfactualsResponse());
    const result = await runStage11Counterfactuals(makeFakePredictionResult());
    expect(result).not.toBeNull();
    for (const s of result!.suggestions) {
      expect(s).toHaveProperty("change");
      expect(typeof s.change).toBe("string");
      expect(s).toHaveProperty("timestamp_ms");
      expect(typeof s.timestamp_ms).toBe("number");
      expect(s).toHaveProperty("expected_impact");
      expect(typeof s.expected_impact).toBe("string");
    }
  });

  // COUNTER-03: Low-scoring content gets counterfactuals
  it("COUNTER-03: returns suggestions when overall_score is below flop threshold", async () => {
    mockV3Success(makeValidCounterfactualsResponse());
    const result = await runStage11Counterfactuals(
      makeFakePredictionResult({ overall_score: 25 }),
    );
    expect(result).not.toBeNull();
    expect(result!.suggestions.length).toBe(3);
  });

  // COUNTER-04: High-scoring content returns null
  it("COUNTER-04: returns null when content scores above flop threshold (no actionable changes)", async () => {
    const result = await runStage11Counterfactuals(
      makeFakePredictionResult({ overall_score: 85 }),
    );
    expect(result).toBeNull();
  });
});

describe("buildCounterfactualsUserMessage — hook timestamp signal", () => {
  it("includes hook AVAILABLE status when gemini_hook=true", async () => {
    const result = makeFakePredictionResult({ signal_availability: { ...makeFakePredictionResult().signal_availability, gemini_hook: true } });
    const msg = buildCounterfactualsUserMessage(result);
    expect(msg).toContain("AVAILABLE");
    expect(msg).not.toContain("UNAVAILABLE");
  });

  it("includes hook UNAVAILABLE status when gemini_hook=false", async () => {
    const result = makeFakePredictionResult({ signal_availability: { ...makeFakePredictionResult().signal_availability, gemini_hook: false } });
    const msg = buildCounterfactualsUserMessage(result);
    expect(msg).toContain("UNAVAILABLE");
    // Use word boundary to avoid matching "UNAVAILABLE" substring
    expect(msg).not.toMatch(/\bAVAILABLE\b/);
  });
});

describe("CounterfactualsResponseSchema — Zod enforcement (.length(3))", () => {
  it("accepts exactly 3 suggestions", () => {
    const valid = {
      suggestions: [
        { change: "A", timestamp_ms: 1000, expected_impact: "B" },
        { change: "C", timestamp_ms: 2000, expected_impact: "D" },
        { change: "E", timestamp_ms: 3000, expected_impact: "F" },
      ],
    };
    const parsed = CounterfactualsResponseSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("rejects 2 suggestions", () => {
    const invalid = {
      suggestions: [
        { change: "A", timestamp_ms: 1000, expected_impact: "B" },
        { change: "C", timestamp_ms: 2000, expected_impact: "D" },
      ],
    };
    const parsed = CounterfactualsResponseSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it("rejects 4 suggestions", () => {
    const invalid = {
      suggestions: [
        { change: "A", timestamp_ms: 1000, expected_impact: "B" },
        { change: "C", timestamp_ms: 2000, expected_impact: "D" },
        { change: "E", timestamp_ms: 3000, expected_impact: "F" },
        { change: "G", timestamp_ms: 4000, expected_impact: "H" },
      ],
    };
    const parsed = CounterfactualsResponseSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it("rejects negative timestamp_ms", () => {
    const invalid = {
      suggestions: [
        { change: "A", timestamp_ms: -1, expected_impact: "B" },
        { change: "C", timestamp_ms: 2000, expected_impact: "D" },
        { change: "E", timestamp_ms: 3000, expected_impact: "F" },
      ],
    };
    const parsed = CounterfactualsResponseSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});

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
