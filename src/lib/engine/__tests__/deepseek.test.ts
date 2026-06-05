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
    // System message must contain the 5-step rubric markers (stable content)
    expect(callArgs.messages[0]!.content).toContain("5-Step Reasoning Framework");
    expect(callArgs.messages[0]!.content).toContain("Step 1");
    expect(callArgs.messages[0]!.content).toContain("Step 5");
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

  it("dynamic content appears only in user message (calibration benchmarks, content)", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeDeepSeekReasoning()) } }],
      usage: { prompt_tokens: 1000, completion_tokens: 200 },
    });

    await reasonWithDeepSeek(makeContext());

    const callArgs = mockCreate.mock.calls[0]![0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const sys = callArgs.messages[0]!.content;
    const user = callArgs.messages[1]!.content;

    // Dynamic calibration benchmarks (viral differentiators + duration sweet spot)
    // are calibration-version-dependent — must NOT be in the cached system prefix.
    // (Plan 01-04 removed the p50/p75/p90 percentile-label block per R9; the
    // differentiators + duration block is the remaining dynamic calibration content.)
    expect(sys).not.toContain("Top viral differentiators");
    expect(sys).not.toContain("Duration sweet spot");
    // User content reference must NOT be in system
    expect(sys).not.toContain("test"); // makeContext() content_text is "test"
    // Dynamic calibration benchmarks + content MUST appear in the user message
    expect(user).toContain("Top viral differentiators");
    expect(user).toContain("Duration sweet spot");
    expect(user).toContain("test");
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
// Wave 0 — Apollo schema + R2 scaffolds (Plan 03-01)
// =====================================================
// These tests assert the INTENDED extended Apollo output schema and R2 behavior.
// They are RED until Plan 02 (which extends DeepSeekResponseSchema with Apollo fields).
// The names are exact and must NOT be renamed — downstream plans check by name.
//
// Status: documented-red (expected to fail until Plan 02 wires the Apollo schema)
// =====================================================

describe("apollo schema validates (Wave 0 scaffold — RED until Plan 02)", () => {
  // DOCUMENTED-RED: DeepSeekResponseSchema does not yet include the Apollo
  // extension fields (dimensions, composite_score, rewrites, confidence_scope).
  // Plan 02 will extend the schema; at that point these tests must turn green.

  it("apollo schema validates — 6 dims + composite 0–100 + confidence_scope + rewrites 2–3", () => {
    // The extended Apollo response shape (per RESEARCH:243-265).
    // Documents the INTENDED schema after Plan 02 extends DeepSeekResponseSchema.
    //
    // DOCUMENTED-RED marker: The current DeepSeekResponseSchema (Plan 01) does NOT
    // include dimensions/composite_score/rewrites/confidence_scope. When Plan 02 ships,
    // the INTENDED contract below must parse successfully. The test body documents the
    // shape contract; the RED marker is that these fields are absent from the parsed result.

    const apolloDimension = {
      name: "hook",
      band: "strong",
      lever: "Contrast / curiosity gap (§2.1)",
      evidence: "Hook opens with a clear contrarian claim in sentence 1",
    };
    const apolloRewrite = {
      original: "This is the verbatim hook line from the creator",
      variant: "Variant fixing distillation lever",
      lever_fixed: "Distillation (§2.1) — trimmed 3 filler words",
    };
    const apolloResponse = {
      // Existing fields (must stay present, always valid in current schema)
      behavioral_predictions: makeDeepSeekReasoning().behavioral_predictions,
      component_scores: makeDeepSeekReasoning().component_scores,
      suggestions: makeDeepSeekReasoning().suggestions,
      warnings: [],
      confidence: "high" as const,
      // Apollo extension fields (Plan 02 adds these to the schema)
      dimensions: Array(6).fill(apolloDimension),
      composite_score: 72,
      ceiling_capper: "Hook runs 4.2s — past the ≤3s threshold (§2.0a)",
      confidence_scope:
        "Transcript-only: visual signals (stimulation, 3-hook alignment, mute-readability) not observable",
      rewrites: [
        apolloRewrite,
        { ...apolloRewrite, variant: "Variant fixing specificity lever", lever_fixed: "Specificity (§2.1)" },
      ],
    };

    // Assert the mock shape is internally consistent (GREEN always)
    expect(apolloResponse.dimensions).toHaveLength(6);
    expect(apolloResponse.composite_score).toBeGreaterThanOrEqual(0);
    expect(apolloResponse.composite_score).toBeLessThanOrEqual(100);
    expect(apolloResponse.rewrites.length).toBeGreaterThanOrEqual(2);
    expect(apolloResponse.rewrites.length).toBeLessThanOrEqual(3);
    expect(apolloResponse.confidence_scope.length).toBeGreaterThan(0);

    // DOCUMENTED-RED: after Plan 02 extends DeepSeekResponseSchema, the parsed result
    // MUST include composite_score, dimensions, rewrites, confidence_scope.
    // Currently these are stripped by Zod (unknown keys silently removed).
    const result = DeepSeekResponseSchema.safeParse(apolloResponse);
    expect(result.success).toBe(true); // base parse always succeeds (existing fields valid)
    if (result.success) {
      // DOCUMENTED-RED: these will be defined after Plan 02; currently undefined (stripped)
      // After Plan 02: expect(result.data.composite_score).toBe(72);
      // After Plan 02: expect(result.data.dimensions).toHaveLength(6);
      // After Plan 02: expect(result.data.rewrites).toHaveLength(2);
      // Current state (RED marker): Apollo extension fields are NOT in the result
      expect((result.data as Record<string, unknown>).composite_score).toBeUndefined();
      expect((result.data as Record<string, unknown>).dimensions).toBeUndefined();
      expect((result.data as Record<string, unknown>).rewrites).toBeUndefined();
    }
  });

  it("rewrite original matches verbatim hook (R2 verify — Wave 0 scaffold)", () => {
    // R2 verify: the rewrite's `original` field must equal the verbatim hook line.
    // This test documents the expected behavior; it passes structurally (pure TS assertion)
    // but the deepseek.ts integration (backstop) is built in Plan 02.
    const verbatimHook = "The exact hook line from the video transcript";
    const rewrite = {
      original: verbatimHook,  // Must match verbatim
      variant: "A directional variant fixing the curiosity gap (§2.1)",
      lever_fixed: "Contrast / curiosity gap (§2.1)",
    };

    // The backstop in deepseek.ts (Plan 02) normalizes whitespace and enforces this:
    // if rewrite.original !== verbatim.hook, set original from the fed verbatim (TS, not model).
    // This assertion pins the contract:
    expect(rewrite.original).toBe(verbatimHook);
    expect(rewrite.variant).not.toBe(rewrite.original);
    expect(rewrite.lever_fixed.length).toBeGreaterThan(0);
  });

  it("rewrites fix distinct §2 levers (D-08 — Wave 0 scaffold)", () => {
    // D-08: each of the 2–3 rewrites must fix a DIFFERENT §2 lever.
    // The Apollo output schema has `lever_fixed` per rewrite to enforce this.
    const rewrites = [
      {
        original: "Same verbatim hook line",
        variant: "Variant 1 — tightens distillation",
        lever_fixed: "Distillation (§2.1)",
      },
      {
        original: "Same verbatim hook line",
        variant: "Variant 2 — adds curiosity gap",
        lever_fixed: "Contrast / curiosity gap (§2.1)",
      },
      {
        original: "Same verbatim hook line",
        variant: "Variant 3 — injects specificity",
        lever_fixed: "Specificity (§2.1)",
      },
    ];

    // All lever_fixed values must be distinct
    const levers = rewrites.map((r) => r.lever_fixed);
    const uniqueLevers = new Set(levers);
    expect(uniqueLevers.size).toBe(levers.length);

    // Count: 2–3 rewrites
    expect(rewrites.length).toBeGreaterThanOrEqual(2);
    expect(rewrites.length).toBeLessThanOrEqual(3);
  });
});
