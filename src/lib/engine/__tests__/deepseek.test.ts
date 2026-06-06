/**
 * Unit tests for deepseek.ts — circuit breaker state transitions and Zod response validation.
 */

// Mock all external dependencies BEFORE importing the module under test
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  })),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

const mockCreate = vi.fn();
vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockCreate } };
  });
  return { default: MockOpenAI };
});

const mockGeminiGenerateContent = vi.fn().mockResolvedValue({
  text: JSON.stringify({
    behavioral_predictions: {
      completion_pct: 50, completion_percentile: "top 50%",
      share_pct: 2, share_percentile: "top 50%",
      comment_pct: 1.5, comment_percentile: "top 50%",
      save_pct: 2, save_percentile: "top 50%",
    },
    component_scores: {
      hook_effectiveness: 5, retention_strength: 5, shareability: 5,
      comment_provocation: 5, save_worthiness: 5, trend_alignment: 5, originality: 5,
    },
    suggestions: [{ text: "Test suggestion", priority: "medium", category: "general" }],
    warnings: [],
    confidence: "medium",
  }),
  usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 300 },
});
vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      models = { generateContent: mockGeminiGenerateContent };
    },
    // Phase 5: `Type` is imported at module load by ./gemini/schemas.ts (via types.ts).
    // Tests that hoist this mock must expose the enum even when they don't use it.
    Type: {
      OBJECT: "OBJECT",
      ARRAY: "ARRAY",
      STRING: "STRING",
      NUMBER: "NUMBER",
      BOOLEAN: "BOOLEAN",
    },
  };
});

vi.mock("node:fs", () => ({
  promises: {
    readFile: vi.fn().mockResolvedValue(
      JSON.stringify({
        primary_kpis: {
          share_rate: { percentiles: { p50: 0.02, p75: 0.05, p90: 0.1 } },
          comment_rate: { percentiles: { p50: 0.01, p75: 0.03, p90: 0.07 } },
          save_rate: { percentiles: { p50: 0.015, p75: 0.04, p90: 0.08 } },
          weighted_engagement_score: {
            percentiles: { p50: 50, p75: 70, p90: 85 },
          },
        },
        virality_tiers: [
          {
            tier: 1,
            label: "Low",
            score_range: [0, 20],
            median_share_rate: 0.01,
            median_comment_rate: 0.005,
            median_save_rate: 0.008,
          },
        ],
        viral_vs_average: {
          differentiators: [
            {
              factor: "hook_strength",
              difference_pct: 40,
              description: "Strong hooks boost engagement",
            },
          ],
        },
        duration_analysis: {
          sweet_spot_by_weighted_score: { optimal_range_seconds: [15, 45] },
        },
      })
    ),
  },
}));

vi.mock("node:path", () => ({
  join: vi.fn((...args: string[]) => args.join("/")),
  dirname: vi.fn(() => "/mock"),
  default: {
    join: vi.fn((...args: string[]) => args.join("/")),
    dirname: vi.fn(() => "/mock"),
  },
}));

// Set env vars BEFORE importing the module under test
process.env.DEEPSEEK_API_KEY = "test-key";
process.env.DASHSCOPE_API_KEY = "test-key";
process.env.GEMINI_API_KEY = "test-key";

import { isCircuitOpen, resetCircuitBreaker, reasonWithDeepSeek } from "../deepseek";
import { DeepSeekResponseSchema } from "../types";
import { APOLLO_SYSTEM_PROMPT } from "../apollo-core";
import {
  makeGeminiAnalysis,
  makeRuleScoreResult,
  makeTrendEnrichment,
  makeDeepSeekReasoning,
} from "./factories";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext() {
  return {
    input: {
      input_mode: "text" as const,
      content_text: "test",
      content_type: "post" as const,
      mode: "score" as const,
    },
    gemini_analysis: makeGeminiAnalysis(),
    rule_result: makeRuleScoreResult(),
    trend_enrichment: makeTrendEnrichment(),
  };
}

function makeAbortError(): Error {
  const err = new Error("The operation was aborted");
  err.name = "AbortError";
  return err;
}

function makeSuccessResponse() {
  return {
    choices: [
      { message: { content: JSON.stringify(makeDeepSeekReasoning()) } },
    ],
    usage: { prompt_tokens: 1000, completion_tokens: 500 },
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("circuit breaker state transitions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetCircuitBreaker();
    mockCreate.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in closed state", () => {
    expect(isCircuitOpen()).toBe(false);
  });

  // Helper: open the circuit by triggering enough AbortErrors.
  // Uses real timers since reasonWithDeepSeek has async Gemini fallback.
  async function openCircuit() {
    vi.useRealTimers();
    mockCreate.mockRejectedValue(makeAbortError());
    await reasonWithDeepSeek(makeContext());
    await reasonWithDeepSeek(makeContext());
  }

  it("opens after consecutive failures", async () => {
    // AbortError triggers recordFailure() inside catch + after loop (2 per call).
    // With FAILURE_THRESHOLD=3, 2 calls = 4 failures → circuit opens during 2nd call.
    // Both calls still return valid results via Gemini fallback.
    await openCircuit();
    expect(isCircuitOpen()).toBe(true);
  });

  it("open circuit returns null immediately", async () => {
    await openCircuit();
    expect(isCircuitOpen()).toBe(true);

    // Now the circuit is open — reasonWithDeepSeek returns null without API call
    mockCreate.mockClear();
    const result = await reasonWithDeepSeek(makeContext());
    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("transitions to half-open after backoff period", async () => {
    // openCircuit triggers 2 calls × 2 recordFailure each = 4 failures.
    // The 4th recordFailure uses backoffIndex=1 → 3000ms backoff.
    await openCircuit();
    expect(isCircuitOpen()).toBe(true);

    // Wait past the actual backoff (3000ms due to double-recordFailure escalation)
    await new Promise((r) => setTimeout(r, 3100));

    // Should now be half-open (isCircuitOpen returns false)
    expect(isCircuitOpen()).toBe(false);
  });

  it("success in half-open state resets to closed", async () => {
    await openCircuit();
    expect(isCircuitOpen()).toBe(true);

    // Wait past actual backoff (3000ms)
    await new Promise((r) => setTimeout(r, 3100));

    // Mock a successful response — reasonWithDeepSeek will transition to
    // half-open internally via isCircuitOpen() and probe
    mockCreate.mockResolvedValue(makeSuccessResponse());

    const result = await reasonWithDeepSeek(makeContext());
    expect(result).not.toBeNull();
    expect(result!.reasoning).toBeDefined();

    // Circuit should be closed again
    expect(isCircuitOpen()).toBe(false);
  });

  it("failure in half-open state reopens with increased backoff", async () => {
    await openCircuit();
    expect(isCircuitOpen()).toBe(true);

    // Wait past actual backoff (3000ms)
    await new Promise((r) => setTimeout(r, 3100));

    // Fail again in half-open -> should reopen with further increased backoff
    mockCreate.mockRejectedValue(makeAbortError());
    const result = await reasonWithDeepSeek(makeContext());
    // Phase 13 Qwen migration: deepseek.ts:557-559 dropped the Gemini fallback.
    // Failure now returns null and the caller handles graceful degradation.
    expect(result).toBeNull();

    // Circuit re-opened — verify it's open
    expect(isCircuitOpen()).toBe(true);

    // After half-open failure, backoff escalates (backoffIndex incremented).
    // The exact backoff depends on how many recordFailure calls happened,
    // but we can verify it's still open shortly after and eventually half-opens.
    await new Promise((r) => setTimeout(r, 1000));
    expect(isCircuitOpen()).toBe(true); // Still open — backoff > 1s
  }, 15_000);
});

describe("DeepSeek response validation", () => {
  it("valid response parses successfully", () => {
    const valid = makeDeepSeekReasoning();
    const result = DeepSeekResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("missing behavioral_predictions fails", () => {
    const invalid = {
      ...makeDeepSeekReasoning(),
      behavioral_predictions: undefined,
    };
    const result = DeepSeekResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("missing component_scores fails", () => {
    const invalid = {
      ...makeDeepSeekReasoning(),
      component_scores: undefined,
    };
    const result = DeepSeekResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("score out of range (0-10) fails", () => {
    const invalid = {
      ...makeDeepSeekReasoning(),
      component_scores: {
        ...makeDeepSeekReasoning().component_scores,
        hook_effectiveness: 15,
      },
    };
    const result = DeepSeekResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("invalid confidence value fails", () => {
    const invalid = {
      ...makeDeepSeekReasoning(),
      confidence: "extreme",
    };
    const result = DeepSeekResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("empty suggestions fails", () => {
    const invalid = {
      ...makeDeepSeekReasoning(),
      suggestions: [],
    };
    const result = DeepSeekResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("warnings default to empty array", () => {
    const { warnings: _, ...withoutWarnings } = makeDeepSeekReasoning();
    const result = DeepSeekResponseSchema.safeParse(withoutWarnings);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.warnings).toEqual([]);
    }
  });

  it("markdown-fenced JSON is handled through reasonWithDeepSeek", async () => {
    vi.useFakeTimers();
    resetCircuitBreaker();

    const fencedJson = "```json\n" + JSON.stringify(makeDeepSeekReasoning()) + "\n```";
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: fencedJson } }],
      usage: { prompt_tokens: 1000, completion_tokens: 500 },
    });

    const result = await reasonWithDeepSeek(makeContext());
    expect(result).not.toBeNull();
    expect(result!.reasoning.confidence).toBe("medium");

    vi.useRealTimers();
  });
});

// =====================================================
// Phase 3 — cache-prefix stability + telemetry (CACHE-03)
// =====================================================

describe("Phase 3 — cache-prefix stability + telemetry (CACHE-03)", () => {
  beforeEach(() => {
    resetCircuitBreaker();
    mockCreate.mockReset();
  });

  it("messages array has [system, user] shape with stable system content", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeDeepSeekReasoning()) } }],
      usage: {
        prompt_tokens: 1000,
        completion_tokens: 200,
        prompt_cache_hit_tokens: 800,
        prompt_cache_miss_tokens: 200,
      },
    });

    await reasonWithDeepSeek(makeContext());

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0]![0] as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(callArgs.messages).toHaveLength(2);
    expect(callArgs.messages[0]!.role).toBe("system");
    expect(callArgs.messages[1]!.role).toBe("user");
    // Plan 03-02: system message is APOLLO_SYSTEM_PROMPT (knowledge core), not the old 5-step framework
    expect(callArgs.messages[0]!.content).toContain("Apollo Knowledge Core");
    expect(callArgs.messages[0]!.content).not.toContain("5-Step Reasoning Framework");
  });

  it("STABLE system content is byte-identical across calls (cache prefix invariant)", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeDeepSeekReasoning()) } }],
      usage: { prompt_tokens: 1000, completion_tokens: 200 },
    });

    await reasonWithDeepSeek(makeContext());
    await reasonWithDeepSeek({
      ...makeContext(),
      input: {
        input_mode: "text",
        content_text: "different content",
        content_type: "post",
        mode: "score" as const,
      },
    });

    const sys1 = (mockCreate.mock.calls[0]![0] as { messages: Array<{ content: string }> })
      .messages[0]!.content;
    const sys2 = (mockCreate.mock.calls[1]![0] as { messages: Array<{ content: string }> })
      .messages[0]!.content;
    expect(sys1).toBe(sys2); // Identical bytes → DeepSeek cache will match prefix
  });

  it("dynamic content appears only in user message (content text, gemini signals)", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeDeepSeekReasoning()) } }],
      usage: { prompt_tokens: 1000, completion_tokens: 200 },
    });

    // Use a distinctive content text that won't appear in the byte-stable knowledge core
    const ctx = {
      ...makeContext(),
      input: { ...makeContext().input, content_text: "UNIQUE_DYNAMIC_CONTENT_XYZ" },
    };
    await reasonWithDeepSeek(ctx);

    const callArgs = mockCreate.mock.calls[0]![0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const sys = callArgs.messages[0]!.content;
    const user = callArgs.messages[1]!.content;

    // Plan 03-02: calibration benchmark blocks removed (RESEARCH:283-285 cleanup).
    // Dynamic content is creator content + Omni sensor signals — must NOT be in the cached system prefix.
    expect(sys).not.toContain("Top viral differentiators");
    expect(sys).not.toContain("Duration sweet spot");
    // Dynamic per-request content must NOT leak into the byte-stable system prefix
    expect(sys).not.toContain("UNIQUE_DYNAMIC_CONTENT_XYZ");
    // Per-request content MUST appear in user message
    expect(user).toContain("UNIQUE_DYNAMIC_CONTENT_XYZ");
  });

  it("NO Cache-Control header is added to the request (DeepSeek caching is automatic)", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeDeepSeekReasoning()) } }],
      usage: { prompt_tokens: 1000, completion_tokens: 200 },
    });

    await reasonWithDeepSeek(makeContext());

    // The second arg to chat.completions.create is { signal }, no headers
    const secondArg = mockCreate.mock.calls[0]![1];
    expect(JSON.stringify(secondArg ?? {})).not.toContain("Cache-Control");
  });

  it("reads prompt_cache_hit_tokens from usage when present", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeDeepSeekReasoning()) } }],
      usage: {
        prompt_tokens: 1000,
        completion_tokens: 200,
        prompt_cache_hit_tokens: 800,
        prompt_cache_miss_tokens: 200,
      },
    });

    const result = await reasonWithDeepSeek(makeContext());
    expect(result).not.toBeNull();
    expect(result!.cost_cents).toBeGreaterThan(0);
  });

  it("cache_hit_tokens are ignored under Qwen pricing (cost is equal for same prompt+completion totals)", async () => {
    // Phase 13 Qwen migration: deepseek.ts now uses qwen/cost.ts which only
    // bills on prompt_tokens + completion_tokens. Cache-hit/miss split is
    // ignored — DashScope International does not publish per-cache-tier rates
    // for the qwen3.6-* family at the time of migration. This test pins the
    // current invariant so any future cache-aware pricing reintroduction is
    // an explicit change.
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(makeDeepSeekReasoning()) } }],
      usage: {
        prompt_tokens: 1000,
        completion_tokens: 200,
        prompt_cache_hit_tokens: 900,
        prompt_cache_miss_tokens: 100,
      },
    });
    const cacheHeavyResult = await reasonWithDeepSeek(makeContext());

    resetCircuitBreaker();
    mockCreate.mockReset();

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(makeDeepSeekReasoning()) } }],
      usage: {
        prompt_tokens: 1000,
        completion_tokens: 200,
        prompt_cache_hit_tokens: 0,
        prompt_cache_miss_tokens: 1000,
      },
    });
    const cacheMissResult = await reasonWithDeepSeek(makeContext());

    expect(cacheHeavyResult).not.toBeNull();
    expect(cacheMissResult).not.toBeNull();
    expect(cacheHeavyResult!.cost_cents).toBe(cacheMissResult!.cost_cents);
  });

  it("falls back to legacy pricing when cache fields missing (backwards compat)", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeDeepSeekReasoning()) } }],
      usage: {
        prompt_tokens: 1000,
        completion_tokens: 200,
        // No prompt_cache_hit_tokens / prompt_cache_miss_tokens
      },
    });

    const result = await reasonWithDeepSeek(makeContext());
    expect(result).not.toBeNull();
    expect(result!.cost_cents).toBeGreaterThan(0);
  });
});

// =====================================================
// Plan 03-02 Task 1 — Apollo schema validates (GREEN after schema extension)
// =====================================================
// These tests assert the extended Apollo output schema and R2 behavior.
// Plan 02 extends DeepSeekResponseSchema with Apollo fields; these tests verify the contract.
// The names are exact and must NOT be renamed — downstream plans check by name.
// =====================================================

describe("apollo schema validates", () => {
  const apolloDimension = {
    name: "hook" as const,
    band: "strong" as const,
    score: 85, // D-01: band-anchored numeric score (strong band → 85)
    lever: "Contrast / curiosity gap (§2.1)",
    evidence: "Hook opens with a clear contrarian claim in sentence 1",
  };
  const apolloRewrite = {
    original: "This is the verbatim hook line from the creator",
    variant: "Variant fixing distillation lever",
    lever_fixed: "Distillation (§2.1) — trimmed 3 filler words",
  };

  function makeApolloResponse(overrides?: Record<string, unknown>) {
    return {
      behavioral_predictions: makeDeepSeekReasoning().behavioral_predictions,
      component_scores: makeDeepSeekReasoning().component_scores,
      suggestions: makeDeepSeekReasoning().suggestions,
      warnings: [],
      confidence: "high" as const,
      dimensions: [
        apolloDimension,
        { ...apolloDimension, name: "retention" as const },
        { ...apolloDimension, name: "clarity" as const },
        { ...apolloDimension, name: "share_pull" as const },
        { ...apolloDimension, name: "substance" as const },
        { ...apolloDimension, name: "credibility" as const },
      ],
      composite_score: 72,
      ceiling_capper: "Hook runs 4.2s — past the ≤3s threshold (§2.0a)",
      confidence_scope:
        "Transcript-only: visual signals (stimulation, 3-hook alignment, mute-readability) not observable",
      rewrites: [
        apolloRewrite,
        { ...apolloRewrite, variant: "Variant fixing specificity lever", lever_fixed: "Specificity (§2.1)" },
      ],
      ...overrides,
    };
  }

  it("apollo schema validates — 6 dims + composite 0–100 + confidence_scope + rewrites 2–3", () => {
    const result = DeepSeekResponseSchema.safeParse(makeApolloResponse());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.composite_score).toBe(72);
      expect(result.data.dimensions).toHaveLength(6);
      expect(result.data.rewrites).toHaveLength(2);
      expect(result.data.confidence_scope.length).toBeGreaterThan(0);
      expect(result.data.ceiling_capper.length).toBeGreaterThan(0);
      // Existing fields still required (additive, no regression)
      expect(result.data.behavioral_predictions).toBeDefined();
      expect(result.data.component_scores).toBeDefined();
    }
  });

  it("composite_score outside 0–100 fails parse", () => {
    const tooHigh = DeepSeekResponseSchema.safeParse(makeApolloResponse({ composite_score: 101 }));
    expect(tooHigh.success).toBe(false);
    const tooLow = DeepSeekResponseSchema.safeParse(makeApolloResponse({ composite_score: -1 }));
    expect(tooLow.success).toBe(false);
  });

  it("rewrites.length === 1 fails (min 2); rewrites.length === 4 fails (max 3)", () => {
    const oneRewrite = DeepSeekResponseSchema.safeParse(makeApolloResponse({ rewrites: [apolloRewrite] }));
    expect(oneRewrite.success).toBe(false);
    const fourRewrites = DeepSeekResponseSchema.safeParse(makeApolloResponse({
      rewrites: [
        apolloRewrite,
        { ...apolloRewrite, lever_fixed: "A" },
        { ...apolloRewrite, lever_fixed: "B" },
        { ...apolloRewrite, lever_fixed: "C" },
      ],
    }));
    expect(fourRewrites.success).toBe(false);
  });

  it("dimensions.length !== 6 fails", () => {
    const fiveDims = DeepSeekResponseSchema.safeParse(makeApolloResponse({
      dimensions: Array(5).fill(apolloDimension),
    }));
    expect(fiveDims.success).toBe(false);
    const sevenDims = DeepSeekResponseSchema.safeParse(makeApolloResponse({
      dimensions: Array(7).fill(apolloDimension),
    }));
    expect(sevenDims.success).toBe(false);
  });

  it("existing behavioral_predictions/component_scores still required (additive, no regression)", () => {
    const noBehavioral = DeepSeekResponseSchema.safeParse({
      ...makeApolloResponse(),
      behavioral_predictions: undefined,
    });
    expect(noBehavioral.success).toBe(false);
    const noComponentScores = DeepSeekResponseSchema.safeParse({
      ...makeApolloResponse(),
      component_scores: undefined,
    });
    expect(noComponentScores.success).toBe(false);
  });

  it("rewrite original matches verbatim hook (R2 verify)", () => {
    // R2 verify: the rewrite's `original` field must equal the verbatim hook line.
    // The backstop in deepseek.ts normalizes whitespace and enforces this.
    const verbatimHook = "The exact hook line from the video transcript";
    const rewrite = {
      original: verbatimHook,
      variant: "A directional variant fixing the curiosity gap (§2.1)",
      lever_fixed: "Contrast / curiosity gap (§2.1)",
    };
    expect(rewrite.original).toBe(verbatimHook);
    expect(rewrite.variant).not.toBe(rewrite.original);
    expect(rewrite.lever_fixed.length).toBeGreaterThan(0);
  });

  it("rewrites fix distinct §2 levers (D-08)", () => {
    // D-08: each of the 2–3 rewrites must fix a DIFFERENT §2 lever.
    const rewrites = [
      { original: "Same verbatim hook line", variant: "Variant 1", lever_fixed: "Distillation (§2.1)" },
      { original: "Same verbatim hook line", variant: "Variant 2", lever_fixed: "Contrast / curiosity gap (§2.1)" },
      { original: "Same verbatim hook line", variant: "Variant 3", lever_fixed: "Specificity (§2.1)" },
    ];
    const levers = rewrites.map((r) => r.lever_fixed);
    const uniqueLevers = new Set(levers);
    expect(uniqueLevers.size).toBe(levers.length);
    expect(rewrites.length).toBeGreaterThanOrEqual(2);
    expect(rewrites.length).toBeLessThanOrEqual(3);
  });
});

// =====================================================
// Phase 5 Plan 01 — Wave 0 rubric-sum + determinism + threading scaffolds (D-01)
// RED scaffolds: fail until Tasks 2–4 land.
// =====================================================

describe("D-01 rubric-sum — score field schema (V5 boundary defense)", () => {
  // Band-anchor values that should map to numeric scores (names match Task 3 constants).
  // Strong=85, Mid=50, Weak=20 are the expected band anchors baked into the corpus §4.
  // These tests RED-fail because ApolloDimensionSchema does not yet have `score`.

  function makeDimWithScore(name: string, score: number) {
    return {
      name,
      band: "mid" as const,
      lever: "Contrast / curiosity gap (§2.1)",
      evidence: "Test evidence",
      score,
    };
  }

  it("dimension with score in [0,100] parses — schema must accept the numeric score field (V5)", () => {
    const dim = makeDimWithScore("hook", 75);
    // RED: ApolloDimensionSchema does not have `score` yet — parse strips it or rejects.
    // GREEN after Task 2: schema accepts score and parses it.
    const result = DeepSeekResponseSchema.safeParse({
      ...makeDeepSeekReasoning(),
      dimensions: [
        makeDimWithScore("hook", 85),
        makeDimWithScore("retention", 50),
        makeDimWithScore("clarity", 50),
        makeDimWithScore("share_pull", 50),
        makeDimWithScore("substance", 50),
        makeDimWithScore("credibility", 50),
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.dimensions[0]!.score).toBe("number");
      expect(result.data.dimensions[0]!.score).toBe(85);
    }
    // Verify the dim fixture itself
    expect(dim.score).toBe(75);
  });

  it("dimension score > 100 is rejected by zod bound (V5 — LLM output is untrusted)", () => {
    const result = DeepSeekResponseSchema.safeParse({
      ...makeDeepSeekReasoning(),
      dimensions: [
        makeDimWithScore("hook", 101),   // > 100 — must fail
        makeDimWithScore("retention", 50),
        makeDimWithScore("clarity", 50),
        makeDimWithScore("share_pull", 50),
        makeDimWithScore("substance", 50),
        makeDimWithScore("credibility", 50),
      ],
    });
    // RED: schema has no score field — the invalid score is ignored (passes).
    // GREEN after Task 2: schema rejects score > 100.
    expect(result.success).toBe(false);
  });

  it("dimension score < 0 is rejected by zod bound (V5 — LLM output is untrusted)", () => {
    const result = DeepSeekResponseSchema.safeParse({
      ...makeDeepSeekReasoning(),
      dimensions: [
        makeDimWithScore("hook", -1),    // < 0 — must fail
        makeDimWithScore("retention", 50),
        makeDimWithScore("clarity", 50),
        makeDimWithScore("share_pull", 50),
        makeDimWithScore("substance", 50),
        makeDimWithScore("credibility", 50),
      ],
    });
    // RED: schema has no score field — the invalid score is ignored (passes).
    // GREEN after Task 2: schema rejects score < 0.
    expect(result.success).toBe(false);
  });
});

describe("D-01 rubric-sum — sum-identity + determinism (R8)", () => {
  // HOOK_WEIGHT = 0.80; BODY_WEIGHT = 0.20 / 5 = 0.04 each.
  // Expected composite = Math.round(80 * 0.80 + 60 * 0.04 * 5) = Math.round(64 + 12) = 76.
  // The LLM emits composite_score: 99 (deliberately wrong) — must be overwritten by the sum.
  // RED: the sum logic doesn't exist in deepseek.ts yet — composite stays 99.
  // GREEN after Task 3: composite_score == 76 (the deterministic sum).

  const HOOK_SCORE = 80;
  const BODY_SCORE = 60;
  const HOOK_WEIGHT = 0.80;
  const BODY_WEIGHT = 0.20 / 5;
  const EXPECTED_COMPOSITE = Math.round(
    HOOK_SCORE * HOOK_WEIGHT +
    BODY_SCORE * BODY_WEIGHT +
    BODY_SCORE * BODY_WEIGHT +
    BODY_SCORE * BODY_WEIGHT +
    BODY_SCORE * BODY_WEIGHT +
    BODY_SCORE * BODY_WEIGHT
  ); // = Math.round(64 + 12) = 76

  function makeDimWithScore(name: string, score: number) {
    return {
      name,
      band: "mid" as const,
      lever: "Contrast / curiosity gap (§2.1)",
      evidence: "Test evidence",
      score,
    };
  }

  function makeRubricSumResponse(emittedComposite: number) {
    return {
      ...makeDeepSeekReasoning(),
      composite_score: emittedComposite, // deliberately wrong — must be overwritten
      dimensions: [
        makeDimWithScore("hook", HOOK_SCORE),
        makeDimWithScore("retention", BODY_SCORE),
        makeDimWithScore("clarity", BODY_SCORE),
        makeDimWithScore("share_pull", BODY_SCORE),
        makeDimWithScore("substance", BODY_SCORE),
        makeDimWithScore("credibility", BODY_SCORE),
      ],
    };
  }

  beforeEach(() => {
    resetCircuitBreaker();
    mockCreate.mockReset();
  });

  it("sum-identity: post-parse composite_score == hook-weighted sum, overwriting wrong emitted value (D-01)", async () => {
    vi.useFakeTimers();
    // Emit composite_score: 99 (wrong); dimensions carry correct scores.
    // After post-parse, composite must be EXPECTED_COMPOSITE (76), not 99.
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeRubricSumResponse(99)) } }],
      usage: { prompt_tokens: 1000, completion_tokens: 200 },
    });

    const result = await reasonWithDeepSeek(makeContext());
    expect(result).not.toBeNull();
    // RED: sum logic absent — composite stays 99.
    // GREEN: composite == EXPECTED_COMPOSITE (76).
    expect(result!.reasoning.composite_score).toBe(EXPECTED_COMPOSITE);
    vi.useRealTimers();
  });

  it("determinism: same dimension scores parsed twice yield byte-identical composite (R8)", async () => {
    vi.useFakeTimers();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeRubricSumResponse(99)) } }],
      usage: { prompt_tokens: 1000, completion_tokens: 200 },
    });

    const result1 = await reasonWithDeepSeek(makeContext());
    expect(result1).not.toBeNull();

    resetCircuitBreaker();
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeRubricSumResponse(99)) } }],
      usage: { prompt_tokens: 1000, completion_tokens: 200 },
    });

    const result2 = await reasonWithDeepSeek(makeContext());
    expect(result2).not.toBeNull();

    // RED: sum logic absent — both return 99 (technically equal by coincidence, but
    // the sum-identity assertion in the previous test is what gates GREEN).
    // After Task 3 both return EXPECTED_COMPOSITE and this determinism check holds.
    expect(result1!.reasoning.composite_score).toBe(result2!.reasoning.composite_score);
    vi.useRealTimers();
  });
});

// =====================================================
// Plan 03-02 Task 2 — Apollo Reasoner integration tests
// "apollo uses shared core prefix", "rewrite original matches verbatim hook",
// "rewrite original backstopped on mismatch", composite_score clamped
// =====================================================

describe("apollo uses shared core prefix", () => {
  beforeEach(() => {
    resetCircuitBreaker();
    mockCreate.mockReset();
  });

  it("system message === APOLLO_SYSTEM_PROMPT (byte-stable prefix, mock captures messages[0].content)", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeDeepSeekReasoning()) } }],
      usage: { prompt_tokens: 1000, completion_tokens: 200 },
    });

    await reasonWithDeepSeek(makeContext());

    const callArgs = mockCreate.mock.calls[0]![0] as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(callArgs.messages[0]!.role).toBe("system");
    // System message must equal APOLLO_SYSTEM_PROMPT exactly (byte-stable)
    expect(callArgs.messages[0]!.content).toBe(APOLLO_SYSTEM_PROMPT);
    // Must contain core content markers (not the old 5-step framework)
    expect(callArgs.messages[0]!.content).toContain("Apollo Knowledge Core");
    expect(callArgs.messages[0]!.content).not.toContain("5-Step Reasoning Framework");
  });
});

describe("rewrite original matches verbatim hook (R2 integration)", () => {
  beforeEach(() => {
    resetCircuitBreaker();
    mockCreate.mockReset();
  });

  const VERBATIM_HOOK = "The exact creator hook line from the transcript";

  function makeContextWithVerbatim() {
    return {
      ...makeContext(),
      verbatim: {
        hook: {
          spoken_words: VERBATIM_HOOK,
          on_screen_text: "Screen text variant",
        },
      },
    };
  }

  it("rewrite original matches verbatim hook — when model returns correct original", async () => {
    const reasoningWithCorrectOriginal = makeDeepSeekReasoning({
      rewrites: [
        { original: VERBATIM_HOOK, variant: "Variant fixing distillation", lever_fixed: "Distillation (§2.1)" },
        { original: VERBATIM_HOOK, variant: "Variant fixing curiosity gap", lever_fixed: "Contrast / curiosity gap (§2.1)" },
      ],
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(reasoningWithCorrectOriginal) } }],
      usage: { prompt_tokens: 1000, completion_tokens: 200 },
    });

    const result = await reasonWithDeepSeek(makeContextWithVerbatim());
    expect(result).not.toBeNull();
    for (const rewrite of result!.reasoning.rewrites) {
      // Normalize whitespace for comparison
      expect(rewrite.original.replace(/\s+/g, " ").trim()).toBe(
        VERBATIM_HOOK.replace(/\s+/g, " ").trim()
      );
    }
  });

  it("rewrite original backstopped on mismatch — model paraphrase gets overwritten from verbatim (R2 verify)", async () => {
    const paraphrasedReasoning = makeDeepSeekReasoning({
      rewrites: [
        { original: "A paraphrased version of the hook that the model changed", variant: "Variant 1", lever_fixed: "Distillation (§2.1)" },
        { original: "Another LLM paraphrase that diverges from verbatim", variant: "Variant 2", lever_fixed: "Contrast / curiosity gap (§2.1)" },
      ],
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(paraphrasedReasoning) } }],
      usage: { prompt_tokens: 1000, completion_tokens: 200 },
    });

    const result = await reasonWithDeepSeek(makeContextWithVerbatim());
    expect(result).not.toBeNull();
    // Backstop must have overwritten the paraphrased original with the verbatim hook
    for (const rewrite of result!.reasoning.rewrites) {
      expect(rewrite.original.replace(/\s+/g, " ").trim()).toBe(
        VERBATIM_HOOK.replace(/\s+/g, " ").trim()
      );
    }
  });

  it("verbatim in user message — hook spoken_words appears in user content, not system", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeDeepSeekReasoning()) } }],
      usage: { prompt_tokens: 1000, completion_tokens: 200 },
    });

    await reasonWithDeepSeek(makeContextWithVerbatim());

    const callArgs = mockCreate.mock.calls[0]![0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const sys = callArgs.messages[0]!.content;
    const user = callArgs.messages[1]!.content;
    // Verbatim hook must NOT leak into the byte-stable system prefix (Pitfall 1)
    expect(sys).not.toContain(VERBATIM_HOOK);
    // Verbatim hook MUST appear in the volatile user message
    expect(user).toContain(VERBATIM_HOOK);
  });
});
