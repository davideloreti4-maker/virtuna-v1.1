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

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(() => ({
    models: { generateContent: vi.fn() },
  })),
}));

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

  it("opens after 3 consecutive failures", async () => {
    // AbortError triggers recordFailure() and throws immediately (no retries)
    mockCreate.mockRejectedValue(makeAbortError());

    // Each call = 1 recordFailure(). Need 3 to reach FAILURE_THRESHOLD.
    for (let i = 0; i < 3; i++) {
      await expect(reasonWithDeepSeek(makeContext())).rejects.toThrow();
    }

    expect(isCircuitOpen()).toBe(true);
  });

  it("open circuit returns null immediately", async () => {
    // Open the circuit with 3 failures
    mockCreate.mockRejectedValue(makeAbortError());
    for (let i = 0; i < 3; i++) {
      await expect(reasonWithDeepSeek(makeContext())).rejects.toThrow();
    }
    expect(isCircuitOpen()).toBe(true);

    // Now the circuit is open — reasonWithDeepSeek returns null
    mockCreate.mockClear();
    const result = await reasonWithDeepSeek(makeContext());
    expect(result).toBeNull();
    // No API call should have been made
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("transitions to half-open after backoff period", async () => {
    // Open the circuit
    mockCreate.mockRejectedValue(makeAbortError());
    for (let i = 0; i < 3; i++) {
      await expect(reasonWithDeepSeek(makeContext())).rejects.toThrow();
    }
    expect(isCircuitOpen()).toBe(true);

    // Advance past first backoff (1000ms)
    vi.advanceTimersByTime(1001);

    // Should now be half-open (isCircuitOpen returns false)
    expect(isCircuitOpen()).toBe(false);
  });

  it("success in half-open state resets to closed", async () => {
    // Open the circuit
    mockCreate.mockRejectedValue(makeAbortError());
    for (let i = 0; i < 3; i++) {
      await expect(reasonWithDeepSeek(makeContext())).rejects.toThrow();
    }
    expect(isCircuitOpen()).toBe(true);

    // Advance past backoff
    vi.advanceTimersByTime(1001);
    expect(isCircuitOpen()).toBe(false); // half-open

    // Mock a successful response
    mockCreate.mockResolvedValue(makeSuccessResponse());

    const result = await reasonWithDeepSeek(makeContext());
    expect(result).not.toBeNull();
    expect(result!.reasoning).toBeDefined();

    // Circuit should be closed again
    expect(isCircuitOpen()).toBe(false);
  });

  it("failure in half-open state reopens with increased backoff", async () => {
    // Open the circuit
    mockCreate.mockRejectedValue(makeAbortError());
    for (let i = 0; i < 3; i++) {
      await expect(reasonWithDeepSeek(makeContext())).rejects.toThrow();
    }
    expect(isCircuitOpen()).toBe(true);

    // Advance past first backoff (1000ms) -> half-open
    vi.advanceTimersByTime(1001);
    expect(isCircuitOpen()).toBe(false); // half-open

    // Fail again in half-open -> should reopen with 3000ms backoff
    mockCreate.mockRejectedValue(makeAbortError());
    await expect(reasonWithDeepSeek(makeContext())).rejects.toThrow();

    expect(isCircuitOpen()).toBe(true);

    // Advance 1000ms — should still be open (backoff is 3000ms)
    vi.advanceTimersByTime(1000);
    expect(isCircuitOpen()).toBe(true);

    // Advance another 2001ms (total 3001ms) — should transition to half-open
    vi.advanceTimersByTime(2001);
    expect(isCircuitOpen()).toBe(false);
  });
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
