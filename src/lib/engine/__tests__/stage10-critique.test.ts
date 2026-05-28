/**
 * Wave 0 test suite for Phase 9 Stage 10 self-critique (CRITIQUE-01..03).
 * All tests pass GREEN with real V3 mock and applyCritiqueAdjustment helper.
 *
 * Test surface (8 tests):
 *   1 — CRITIQUE-01: returns non-null CritiqueResult with consistency_score 0-100
 *   2 — CRITIQUE-02: returns flags array when inconsistencies detected
 *   3 — CRITIQUE-03: returns confidence_adjustment in range [-0.5, 0.5]
 *   4 — User message includes past_wins_count and past_flops_count (never URLs)
 *   5 — applyCritiqueAdjustment clamps -0.30 → -0.20 (upper bound)
 *   6 — applyCritiqueAdjustment clamps +0.10 → 0 (lower bound)
 *   7 — D-13 Check #1: V3 returning signal agreement flag → result.flags.length ≥ 1
 *   8 — Graceful: V3 error → returns null, stage event ok=false
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runStage10Critique, applyCritiqueAdjustment } from "../stage10-critique";
import { buildCritiqueUserMessage, CritiqueResponseSchema } from "../stage10-critique-prompts";
import { QWEN_REASONING_MODEL } from "../qwen/client";
import { calculateCost } from "../qwen/cost";
import type { PredictionResult, CritiqueResult } from "../types";
import type { StageEvent } from "../events";
import type { CreatorContext } from "../creator";

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

// Hoisted mocks for OpenAI and circuit breaker
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
process.env.DASHSCOPE_API_KEY = "test-key";

// =====================================================
// Factory helpers
// =====================================================

function makeValidCritiqueResponse(
  overrides?: Partial<{
    consistency_score: number;
    flags: string[];
    confidence_adjustment: number;
  }>,
): string {
  return JSON.stringify({
    consistency_score: 7,
    flags: ["Gemini score (85) and behavioral score (45) differ by >30 points"],
    confidence_adjustment: -0.1,
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
    overall_score: 72,
    confidence: 0.75,
    confidence_label: "HIGH",
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
      shareability: 5,
      commentProvocation: 5,
      saveWorthiness: 5,
      trendAlignment: 5,
      originality: 5,
      ruleScore: 55,
      trendScore: 30,
      audioTrendingMatch: null,
      captionScore: 5,
      hashtagRelevance: 0.5,
      hashtagCount: 3,
      durationSeconds: null,
      hasVideo: false,
    },
    reasoning: "test reasoning",
    warnings: [],
    predicted_engagement: {
      views: 10000,
      likes: 500,
      shares: 100,
      comments: 50,
      saves: 25,
    },
    factors: [
      { id: "hook-power", name: "Hook Power", score: 8, max_score: 10, rationale: "Strong opening", improvement_tip: "Add visual surprise" },
      { id: "retention-pull", name: "Retention Pull", score: 6, max_score: 10, rationale: "Decent narrative", improvement_tip: "Tease earlier" },
      { id: "share-trigger", name: "Share Trigger", score: 3, max_score: 10, rationale: "Low shareability", improvement_tip: "Add CTA" },
      { id: "emotional-charge", name: "Emotional Charge", score: 5, max_score: 10, rationale: "Moderate", improvement_tip: "Amplify" },
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
    // Phase 1 (R1.9, B4) — REQUIRED boolean. Default false (confidence=0.75 >= threshold=0.4).
    anti_virality_gated: false,
    ...overrides,
  };
}

describe("runStage10Critique — CRITIQUE-01..03 (Phase 9 Wave 0 GREEN)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCircuitOpen.mockReturnValue(false);
  });

  // CRITIQUE-01: Consistency scoring
  it("CRITIQUE-01: returns non-null CritiqueResult with consistency_score", async () => {
    mockV3Success(makeValidCritiqueResponse({ consistency_score: 7 }));
    const result = await runStage10Critique(makeFakePredictionResult());
    expect(result).not.toBeNull();
    expect(result!.consistency_score).toBeGreaterThanOrEqual(0);
    expect(result!.consistency_score).toBeLessThanOrEqual(100);
  });

  // CRITIQUE-02: Flag extraction
  it("CRITIQUE-02: returns flags array when inconsistencies detected", async () => {
    mockV3Success(makeValidCritiqueResponse({
      flags: ["Gemini score (85) and behavioral score (45) differ by >30 points"],
    }));
    const result = await runStage10Critique(makeFakePredictionResult());
    expect(result).not.toBeNull();
    expect(Array.isArray(result!.flags)).toBe(true);
    expect(result!.flags.length).toBeGreaterThanOrEqual(1);
  });

  // CRITIQUE-03: Confidence adjustment
  it("CRITIQUE-03: returns confidence_adjustment in range [-0.5, 0.5]", async () => {
    mockV3Success(makeValidCritiqueResponse({ confidence_adjustment: -0.15 }));
    const result = await runStage10Critique(makeFakePredictionResult());
    expect(result).not.toBeNull();
    expect(result!.confidence_adjustment).toBeGreaterThanOrEqual(-0.5);
    expect(result!.confidence_adjustment).toBeLessThanOrEqual(0.5);
  });
});

describe("buildCritiqueUserMessage — URL safety + Card 6 counts", () => {
  it("includes past_wins_count and past_flops_count — never URLs", async () => {
    const result = makeFakePredictionResult();
    const creatorContext: CreatorContext = {
      found: true,
      follower_count: 50000,
      avg_views: 10000,
      engagement_rate: 0.05,
      niche: "gaming",
      posting_frequency: "daily",
      platform_averages: {
        avg_views: 50000,
        avg_engagement_rate: 0.06,
        avg_share_rate: 0.008,
        avg_comment_rate: 0.004,
      },
      target_platforms: ["tiktok"],
      niche_primary: "gaming",
      niche_sub: null,
      target_audience: null,
      primary_goal: "growth",
      creator_stage: "mid",
      content_style: null,
      cuts_per_second: null,
      reference_creators: null,
      past_wins: [{ url: "https://tiktok.com/@test/video/1" }, { url: "https://tiktok.com/@test/video/2" }],
      past_flops: [{ url: "https://tiktok.com/@test/video/flop1" }],
      time_of_day_aware: null,
      pain_points: null,
    };

    const msg = buildCritiqueUserMessage(result, creatorContext);

    expect(msg).toContain("past_wins_count=2");
    expect(msg).toContain("past_flops_count=1");
    expect(msg).not.toContain("http://");
    expect(msg).not.toContain("https://");
    expect(msg).not.toContain("tiktok.com");
  });
});

describe("applyCritiqueAdjustment — confidence clamp", () => {
  it("clamps -0.30 → -0.20 (upper bound)", () => {
    const critique: CritiqueResult = {
      consistency_score: 5,
      flags: [],
      confidence_adjustment: -0.3,
    };
    const adjusted = applyCritiqueAdjustment(0.75, critique);
    // 0.75 + (-0.20) = 0.55
    expect(adjusted).toBeCloseTo(0.55, 10);
  });

  it("clamps +0.10 → 0 (lower bound — only reductions allowed)", () => {
    const critique: CritiqueResult = {
      consistency_score: 5,
      flags: [],
      confidence_adjustment: 0.1,
    };
    const adjusted = applyCritiqueAdjustment(0.75, critique);
    // 0.75 + 0 = 0.75
    expect(adjusted).toBeCloseTo(0.75, 10);
  });
});

describe("D-13 consistency check fixtures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCircuitOpen.mockReturnValue(false);
  });

  it("Check #1: V3 returning signal agreement flag → result.flags.length ≥ 1", async () => {
    mockV3Success(makeValidCritiqueResponse({
      flags: ["Gemini score (85) and behavioral score (45) differ by >30 points"],
    }));
    const result = await runStage10Critique(makeFakePredictionResult());
    expect(result).not.toBeNull();
    expect(result!.flags.length).toBeGreaterThanOrEqual(1);
    // Verify the flag content references the signal gap
    const flagText = result!.flags[0]!;
    expect(flagText).toMatch(/gemini|behavioral|signal|score/i);
  });

  it("Check #4: V3 returning over-confidence thin signals flag → result.flags.length ≥ 1", async () => {
    // Set confidence high, disable 2+ signals
    const thinResult = makeFakePredictionResult({
      confidence: 0.82,
      confidence_label: "HIGH",
      signal_availability: {
        behavioral: true,
        gemini: true,
        ml: true,
        rules: true,
        trends: true,
        content_type: true,
        niche: true,
        gemini_hook: false,
        gemini_body: true,
        gemini_cta: true,
        personas: false,
        audio: false,
        retrieval: false,
      },
    });
    mockV3Success(makeValidCritiqueResponse({
      flags: ["Confidence=0.82 but audio, retrieval, and gemini_hook are all unavailable"],
    }));
    const result = await runStage10Critique(thinResult);
    expect(result).not.toBeNull();
    expect(result!.flags.length).toBeGreaterThanOrEqual(1);
  });
});

describe("runStage10Critique — graceful degradation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCircuitOpen.mockReturnValue(false);
  });

  it("V3 error → returns null, stage event ok=false", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API failure"));
    const events: StageEvent[] = [];
    const cb = (e: StageEvent) => events.push(e);

    const result = await runStage10Critique(makeFakePredictionResult(), cb);
    expect(result).toBeNull();

    const ends = events.filter(
      (e): e is Extract<StageEvent, { type: "stage_end" }> =>
        e.type === "stage_end" && e.stage === "stage_10_critique",
    );
    expect(ends.length).toBe(1);
    expect(ends[0]!.ok).toBe(false);
  });

  it("circuit breaker open → returns null, 0 calls fired", async () => {
    mockIsCircuitOpen.mockReturnValue(true);
    const result = await runStage10Critique(makeFakePredictionResult());
    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("V3 returning invalid JSON → Zod parse fails → returns null gracefully", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "not valid json" } }],
      usage: { prompt_tokens: 100, completion_tokens: 20 },
    });
    const result = await runStage10Critique(makeFakePredictionResult());
    expect(result).toBeNull();
  });
});

describe("Stage10 D-21 thinking-mode upgrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCircuitOpen.mockReturnValue(false);
  });

  it("Test 1: uses QWEN_REASONING_MODEL (qwen3.6-plus), not QWEN_FAST_MODEL", async () => {
    mockV3Success(makeValidCritiqueResponse());
    await runStage10Critique(makeFakePredictionResult());
    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(callArgs.model).toBe(QWEN_REASONING_MODEL);
    expect(callArgs.model).toMatch(/qwen3\.6-plus/);
  });

  it("Test 2: call includes enable_thinking: true", async () => {
    mockV3Success(makeValidCritiqueResponse());
    await runStage10Critique(makeFakePredictionResult());
    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(callArgs.enable_thinking).toBe(true);
  });

  it("Test 3: call includes thinking_budget: 4000", async () => {
    mockV3Success(makeValidCritiqueResponse());
    await runStage10Critique(makeFakePredictionResult());
    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(callArgs.thinking_budget).toBe(4000);
  });

  it("Test 4: cost telemetry uses qwen3.6-plus pricing via calculateCost helper", async () => {
    // Provide usage with known token counts
    const usage = {
      prompt_tokens: 500,
      prompt_cache_hit_tokens: 0,
      prompt_cache_miss_tokens: 500,
      completion_tokens: 100,
    };
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: makeValidCritiqueResponse() } }],
      usage,
    });
    const events: StageEvent[] = [];
    await runStage10Critique(makeFakePredictionResult(), (e) => events.push(e));

    const endEvent = events.find(
      (e): e is Extract<StageEvent, { type: "stage_end" }> =>
        e.type === "stage_end" && e.stage === "stage_10_critique",
    )!;
    expect(endEvent).toBeDefined();
    expect(endEvent.ok).toBe(true);

    // qwen3.6-plus input rate: $0.40/1M, output: $2.40/1M
    // cost = (500 * 0.40/1M + 100 * 2.40/1M) * 100 cents = (0.0002 + 0.00024) * 100 = 0.044 cents
    const expectedCost = calculateCost(QWEN_REASONING_MODEL, { prompt_tokens: 500, completion_tokens: 100 });
    expect(endEvent.cost_cents).toBeCloseTo(expectedCost, 2);
  });
});

describe("CritiqueResponseSchema — Zod boundary validation", () => {
  it("accepts valid critique response", () => {
    const parsed = CritiqueResponseSchema.safeParse({
      consistency_score: 7,
      flags: ["test flag"],
      confidence_adjustment: -0.1,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects consistency_score above 10", () => {
    const parsed = CritiqueResponseSchema.safeParse({
      consistency_score: 15,
      flags: [],
      confidence_adjustment: -0.1,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects more than 8 flags", () => {
    const parsed = CritiqueResponseSchema.safeParse({
      consistency_score: 5,
      flags: Array.from({ length: 9 }, (_, i) => `flag ${i + 1}`),
      confidence_adjustment: 0,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects flag exceeding 400 chars", () => {
    const parsed = CritiqueResponseSchema.safeParse({
      consistency_score: 5,
      flags: ["x".repeat(401)],
      confidence_adjustment: 0,
    });
    expect(parsed.success).toBe(false);
  });
});
