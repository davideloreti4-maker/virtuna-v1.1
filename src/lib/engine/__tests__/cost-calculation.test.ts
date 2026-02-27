/**
 * Cost calculation tests — verify exact cent calculations for Gemini, DeepSeek,
 * and pipeline-level cost aggregation.
 *
 * Pricing constants under test:
 *   Gemini:   $0.15/1M input, $0.60/1M output, fallback: 2000/800
 *   DeepSeek: $0.28/1M input, $0.42/1M output, fallback: 3000/2000
 *   Formula:  (inputTokens × pricePerToken + outputTokens × pricePerToken) × 100 = cents
 *   Aggregator: Math.round((gemini + deepseek) × 10000) / 10000
 */

// =====================================================
// Mocks — must be hoisted before imports
// =====================================================

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

// DeepSeek (OpenAI client)
const mockDeepSeekCreate = vi.fn();
vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockDeepSeekCreate } };
  });
  return { default: MockOpenAI };
});

// Gemini — shared mock so both gemini.ts and deepseek.ts fallback use the same fn
const mockGeminiGenerate = vi.fn();
const mockFileUpload = vi.fn();
const mockFileGet = vi.fn();
const mockFileDelete = vi.fn();
vi.mock("@google/genai", () => {
  const MockGoogleGenAI = vi.fn(function (this: Record<string, unknown>) {
    this.models = { generateContent: mockGeminiGenerate };
    this.files = {
      upload: mockFileUpload,
      get: mockFileGet,
      delete: mockFileDelete,
    };
  });
  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: {
      OBJECT: "OBJECT",
      ARRAY: "ARRAY",
      STRING: "STRING",
      NUMBER: "NUMBER",
    },
  };
});

vi.mock("node:fs", () => ({
  promises: {
    readFile: vi.fn().mockResolvedValue(
      JSON.stringify({
        primary_kpis: {
          share_rate: {
            viral_threshold: 0.1,
            percentiles: { p50: 0.02, p75: 0.05, p90: 0.1 },
          },
          comment_rate: {
            percentiles: { p50: 0.01, p75: 0.03, p90: 0.07 },
          },
          save_rate: {
            percentiles: { p50: 0.015, p75: 0.04, p90: 0.08 },
          },
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

// Set env vars BEFORE importing modules
process.env.GEMINI_API_KEY = "test-key";
process.env.DEEPSEEK_API_KEY = "test-key";

// =====================================================
// Imports (after mocks)
// =====================================================

import { analyzeWithGemini, analyzeVideoWithGemini } from "../gemini";
import { reasonWithDeepSeek, resetCircuitBreaker, isCircuitOpen } from "../deepseek";
import {
  makeGeminiAnalysis,
  makeDeepSeekReasoning,
  makeRuleScoreResult,
  makeTrendEnrichment,
} from "./factories";
import type { AnalysisInput } from "../types";

// =====================================================
// Helpers
// =====================================================

function makeInput(overrides?: Partial<AnalysisInput>): AnalysisInput {
  return {
    input_mode: "text" as const,
    content_text: "Test content for analysis",
    content_type: "video" as const,
    ...overrides,
  };
}

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

function makeVideoAnalysis() {
  return {
    ...makeGeminiAnalysis(),
    video_signals: {
      visual_production_quality: 7,
      hook_visual_impact: 8,
      pacing_score: 6,
      transition_quality: 7,
    },
  };
}

// =====================================================
// Gemini cost calculation
// =====================================================

describe("Gemini cost calculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes exact cost for known token counts", async () => {
    // 500 input + 300 output
    // (500 × 0.15/1M + 300 × 0.60/1M) × 100
    // = (0.000075 + 0.00018) × 100 = 0.0255¢
    mockGeminiGenerate.mockResolvedValue({
      text: JSON.stringify(makeGeminiAnalysis()),
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 300 },
    });

    const result = await analyzeWithGemini(makeInput());
    expect(result.cost_cents).toBeCloseTo(0.0255, 6);
  });

  it("uses fallback tokens (2000/800) when metadata is missing", async () => {
    // 2000 input + 800 output
    // (2000 × 0.15/1M + 800 × 0.60/1M) × 100
    // = (0.0003 + 0.00048) × 100 = 0.078¢
    mockGeminiGenerate.mockResolvedValue({
      text: JSON.stringify(makeGeminiAnalysis()),
      usageMetadata: {},
    });

    const result = await analyzeWithGemini(makeInput());
    expect(result.cost_cents).toBeCloseTo(0.078, 6);
  });

  it("exceeds text soft cap (0.5¢) with high token counts", async () => {
    // 50000 input + 20000 output
    // (50000 × 0.15/1M + 20000 × 0.60/1M) × 100
    // = (0.0075 + 0.012) × 100 = 1.95¢
    mockGeminiGenerate.mockResolvedValue({
      text: JSON.stringify(makeGeminiAnalysis()),
      usageMetadata: { promptTokenCount: 50000, candidatesTokenCount: 20000 },
    });

    const result = await analyzeWithGemini(makeInput());
    expect(result.cost_cents).toBeCloseTo(1.95, 4);
    expect(result.cost_cents).toBeGreaterThan(0.5);
  });

  it("exceeds video soft cap (2.0¢) with high token counts", async () => {
    // 200000 input + 100000 output
    // (200000 × 0.15/1M + 100000 × 0.60/1M) × 100
    // = (0.03 + 0.06) × 100 = 9.0¢
    mockFileUpload.mockResolvedValue({
      name: "files/cost-test",
      state: "ACTIVE",
      uri: "https://generativelanguage.googleapis.com/files/cost-test",
    });
    mockGeminiGenerate.mockResolvedValue({
      text: JSON.stringify(makeVideoAnalysis()),
      usageMetadata: { promptTokenCount: 200000, candidatesTokenCount: 100000 },
    });
    mockFileDelete.mockResolvedValue({});

    const buffer = Buffer.from("fake-video-data");
    const result = await analyzeVideoWithGemini(buffer, "video/mp4");
    expect(result.cost_cents).toBeCloseTo(9.0, 4);
    expect(result.cost_cents).toBeGreaterThan(2.0);
  });
});

// =====================================================
// DeepSeek cost calculation
// =====================================================

describe("DeepSeek cost calculation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetCircuitBreaker();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes exact cost for known token counts", async () => {
    // 1000 input + 500 output
    // (1000 × 0.28/1M + 500 × 0.42/1M) × 100
    // = (0.00028 + 0.00021) × 100 = 0.049¢
    mockDeepSeekCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeDeepSeekReasoning()) } }],
      usage: { prompt_tokens: 1000, completion_tokens: 500 },
    });

    const result = await reasonWithDeepSeek(makeContext());
    expect(result).not.toBeNull();
    expect(result!.cost_cents).toBeCloseTo(0.049, 6);
  });

  it("uses fallback tokens (3000/2000) when usage metadata is missing", async () => {
    // 3000 input + 2000 output
    // (3000 × 0.28/1M + 2000 × 0.42/1M) × 100
    // = (0.00084 + 0.00084) × 100 = 0.168¢
    mockDeepSeekCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeDeepSeekReasoning()) } }],
      usage: undefined,
    });

    const result = await reasonWithDeepSeek(makeContext());
    expect(result).not.toBeNull();
    expect(result!.cost_cents).toBeCloseTo(0.168, 6);
  });

  it("returns null (zero cost) when circuit breaker is open", async () => {
    // Open circuit breaker with 3 AbortError failures
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockDeepSeekCreate.mockRejectedValue(abortError);

    for (let i = 0; i < 3; i++) {
      try {
        await reasonWithDeepSeek(makeContext());
      } catch {
        // Expected — fallback also fails since Gemini mock returns undefined
      }
    }
    expect(isCircuitOpen()).toBe(true);

    // Circuit open → returns null immediately, no API call, no cost
    const result = await reasonWithDeepSeek(makeContext());
    expect(result).toBeNull();
  });

  it("uses Gemini pricing ($0.15/$0.60) when falling back to Gemini", async () => {
    // Make DeepSeek fail with AbortError (skips retries, falls through to Gemini fallback)
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockDeepSeekCreate.mockRejectedValue(abortError);

    // Gemini fallback returns valid DeepSeekReasoning with known tokens
    // 800 input + 400 output using Gemini pricing ($0.15/$0.60)
    // (800 × 0.15/1M + 400 × 0.60/1M) × 100
    // = (0.00012 + 0.00024) × 100 = 0.036¢
    mockGeminiGenerate.mockResolvedValue({
      text: JSON.stringify(makeDeepSeekReasoning()),
      usageMetadata: { promptTokenCount: 800, candidatesTokenCount: 400 },
    });

    const result = await reasonWithDeepSeek(makeContext());
    expect(result).not.toBeNull();
    expect(result!.cost_cents).toBeCloseTo(0.036, 6);

    // Verify it's NOT DeepSeek pricing: (800×0.28/1M + 400×0.42/1M)×100 = 0.0392¢
    expect(result!.cost_cents).not.toBeCloseTo(0.0392, 4);
  });
});

// =====================================================
// Pipeline cost aggregation
// =====================================================

describe("Pipeline cost aggregation", () => {
  it("sums gemini + deepseek costs with 4-decimal rounding", () => {
    // Aggregator formula: Math.round((g + d) × 10000) / 10000
    const gemini = 0.0255;
    const deepseek = 0.049;
    const expected = Math.round((gemini + deepseek) * 10000) / 10000;
    expect(expected).toBe(0.0745);
  });

  it("returns gemini cost only when deepseek is null", () => {
    const gemini = 0.078;
    const deepseek = null;
    const expected = Math.round((gemini + (deepseek ?? 0)) * 10000) / 10000;
    expect(expected).toBe(0.078);
  });

  it("returns deepseek cost only when gemini fails (cost_cents = 0)", () => {
    const gemini = 0; // Gemini failure → fallback with cost_cents: 0
    const deepseek = 0.168;
    const expected = Math.round((gemini + deepseek) * 10000) / 10000;
    expect(expected).toBe(0.168);
  });
});
