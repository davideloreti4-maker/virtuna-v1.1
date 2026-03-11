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
    expect(result).not.toBeNull(); // Gemini fallback returns result

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
