/**
 * Integration tests for pipeline.ts — full prediction pipeline with mocked external SDKs.
 *
 * Tests wiring between all pipeline stages using real internal modules
 * and mocked external dependencies (Gemini API, DeepSeek API, Supabase, etc.).
 *
 * 4 scenarios:
 * 1. Happy path — all stages succeed
 * 2. DeepSeek failure with Gemini fallback
 * 3. Gemini failure (critical stage — pipeline throws)
 * 4. Non-critical stage failures (rules, trends, creator degrade gracefully)
 */

// =====================================================
// Mock external dependencies BEFORE imports
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

vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test-req-id"),
}));

vi.mock("@/lib/cache", () => ({
  createCache: () => ({
    get: vi.fn(() => null),
    set: vi.fn(),
    invalidate: vi.fn(),
    clear: vi.fn(),
  }),
}));

// DeepSeek (OpenAI client)
const mockDeepSeekCreate = vi.fn();
vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockDeepSeekCreate } };
  });
  return { default: MockOpenAI };
});

// Gemini — must use `function` keyword for `new GoogleGenAI(...)` constructor calls
const mockGeminiGenerate = vi.fn();
vi.mock("@google/genai", () => {
  const MockGoogleGenAI = vi.fn(function (this: Record<string, unknown>) {
    this.models = { generateContent: mockGeminiGenerate };
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

// Calibration data (used by both gemini.ts and deepseek.ts) — inlined in factory to avoid hoisting issues
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
  readFileSync: vi.fn(() =>
    JSON.stringify({
      featureNames: Array.from({ length: 15 }, (_, i) => `feature_${i}`),
      trainSet: { features: [], labels: [] },
      testSet: { features: [], labels: [] },
    })
  ),
}));

vi.mock("node:path", () => ({
  join: vi.fn((...args: string[]) => args.join("/")),
  dirname: vi.fn(() => "/mock"),
  default: {
    join: vi.fn((...args: string[]) => args.join("/")),
    dirname: vi.fn(() => "/mock"),
  },
}));

// Supabase — smart mock that returns different results per table
const mockSupabaseChain = () => {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select",
    "eq",
    "is",
    "not",
    "gte",
    "gt",
    "or",
    "order",
    "limit",
    "maybeSingle",
  ];
  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }
  // Terminal: await returns { data, error }
  chain.then = (resolve: (v: unknown) => void) =>
    resolve({ data: [], error: null });
  return chain;
};

const mockStorageDownload = vi.fn().mockResolvedValue({
  data: null,
  error: { message: "Not found" },
});

let supabaseTableOverrides: Record<
  string,
  (() => unknown) | { data: unknown; error: unknown }
> = {};

const mockFrom = vi.fn((table: string) => {
  // Check for per-table overrides
  const override = supabaseTableOverrides[table];
  if (override) {
    if (typeof override === "function") {
      return override();
    }
    // Return a thenable chain that resolves to the override value
    const chain = mockSupabaseChain();
    chain.then = (resolve: (v: unknown) => void) => resolve(override);
    return chain;
  }
  return mockSupabaseChain();
});

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: mockFrom,
    storage: {
      from: vi.fn(() => ({
        download: mockStorageDownload,
        upload: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  })),
}));

// Set env vars BEFORE importing the module under test
process.env.GEMINI_API_KEY = "test-key";
process.env.DEEPSEEK_API_KEY = "test-key";

// =====================================================
// Imports
// =====================================================

import { runPredictionPipeline } from "../pipeline";
import { resetCircuitBreaker } from "../deepseek";
import { makeGeminiAnalysis, makeDeepSeekReasoning } from "./factories";

// =====================================================
// Test input
// =====================================================

const input = {
  input_mode: "text" as const,
  content_text:
    "What if you could double your engagement? #viral #trending",
  content_type: "video" as const,
};

// =====================================================
// Test suite
// =====================================================

describe("pipeline integration tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCircuitBreaker();
    supabaseTableOverrides = {};

    // Default Gemini mock — returns valid GeminiAnalysis
    mockGeminiGenerate.mockResolvedValue({
      text: JSON.stringify(makeGeminiAnalysis()),
      usageMetadata: {
        promptTokenCount: 500,
        candidatesTokenCount: 300,
      },
    });

    // Default DeepSeek mock — returns valid DeepSeekReasoning
    mockDeepSeekCreate.mockResolvedValue({
      choices: [
        {
          message: { content: JSON.stringify(makeDeepSeekReasoning()) },
        },
      ],
      usage: { prompt_tokens: 1000, completion_tokens: 500 },
    });

    // Default Supabase overrides — empty results
    supabaseTableOverrides = {
      rule_library: { data: [], error: null },
      trending_sounds: { data: [], error: null },
      creator_profiles: { data: null, error: null },
      scraped_videos: { data: [], error: null },
    };
  });

  // -------------------------------------------------------
  // Scenario 1: Happy path — all stages succeed
  // -------------------------------------------------------
  it("happy path: all stages succeed and produce a complete PipelineResult", async () => {
    const result = await runPredictionPipeline(input);

    // Payload
    expect(result.payload.input_mode).toBe("text");
    expect(result.payload.hashtags).toContain("#viral");

    // Gemini result
    expect(result.geminiResult.analysis.factors).toHaveLength(5);
    expect(result.geminiResult.cost_cents).toBeGreaterThan(0);

    // DeepSeek result
    expect(result.deepseekResult).not.toBeNull();
    expect(
      result.deepseekResult!.reasoning.behavioral_predictions
    ).toBeDefined();

    // Pipeline metadata
    expect(result.timings).toBeInstanceOf(Array);
    expect(result.timings.length).toBeGreaterThan(0);
    expect(result.total_duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.warnings).toEqual([]);
    expect(result.requestId).toBe("test-req-id");
  });

  // -------------------------------------------------------
  // Scenario 2: DeepSeek failure with Gemini fallback
  // -------------------------------------------------------
  it("DeepSeek failure triggers Gemini fallback — deepseekResult is still populated", async () => {
    // Make DeepSeek fail on all attempts (MAX_RETRIES + 1 = 3)
    mockDeepSeekCreate.mockRejectedValue(
      new Error("503 Service Unavailable")
    );

    // The Gemini fallback inside deepseek.ts uses the same mockGeminiGenerate.
    // It needs to return valid DeepSeekReasoning JSON (not GeminiAnalysis).
    // The first call to mockGeminiGenerate is for analyzeWithGemini (returns GeminiAnalysis).
    // The second call is for the Gemini fallback in deepseek.ts (returns DeepSeekReasoning).
    const geminiAnalysis = makeGeminiAnalysis();
    const deepSeekFallback = makeDeepSeekReasoning();

    mockGeminiGenerate
      .mockResolvedValueOnce({
        text: JSON.stringify(geminiAnalysis),
        usageMetadata: {
          promptTokenCount: 500,
          candidatesTokenCount: 300,
        },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify(deepSeekFallback),
        usageMetadata: {
          promptTokenCount: 800,
          candidatesTokenCount: 400,
        },
      });

    const result = await runPredictionPipeline(input);

    // DeepSeek result should be populated via Gemini fallback
    expect(result.deepseekResult).not.toBeNull();
    expect(
      result.deepseekResult!.reasoning.behavioral_predictions
    ).toBeDefined();
    expect(
      result.deepseekResult!.reasoning.component_scores
    ).toBeDefined();
  });

  // -------------------------------------------------------
  // Scenario 3: Gemini failure (critical stage — pipeline throws)
  // -------------------------------------------------------
  it("Gemini failure throws — pipeline cannot proceed without critical stage", async () => {
    // Gemini fails on all retry attempts
    mockGeminiGenerate.mockRejectedValue(
      new Error("Gemini API unavailable")
    );

    await expect(runPredictionPipeline(input)).rejects.toThrow(
      /Gemini/i
    );
  });

  // -------------------------------------------------------
  // Scenario 4: Non-critical stage failures degrade gracefully
  // -------------------------------------------------------
  it("non-critical stage failures produce warnings and fallback values", async () => {
    // Make rule_library, trending_sounds, creator_profiles, and scraped_videos fail
    const errorChain = () => {
      const chain: Record<string, unknown> = {};
      const methods = [
        "select",
        "eq",
        "is",
        "not",
        "gte",
        "gt",
        "or",
        "order",
        "limit",
        "maybeSingle",
      ];
      for (const method of methods) {
        chain[method] = vi.fn(() => chain);
      }
      // Return error result
      chain.then = (resolve: (v: unknown) => void) =>
        resolve({ data: null, error: { message: "DB error" } });
      return chain;
    };

    supabaseTableOverrides = {
      rule_library: () => errorChain(),
      trending_sounds: () => errorChain(),
      creator_profiles: () => errorChain(),
      scraped_videos: () => errorChain(),
    };

    const result = await runPredictionPipeline(input);

    // Pipeline should complete (non-critical stages don't throw)
    expect(result).not.toBeNull();
    expect(result.geminiResult.analysis.factors).toHaveLength(5);
    expect(result.deepseekResult).not.toBeNull();

    // Rule result should be default fallback
    expect(result.ruleResult.rule_score).toBe(50);
    expect(result.ruleResult.matched_rules).toEqual([]);

    // Trend enrichment should be default fallback
    expect(result.trendEnrichment.trend_score).toBe(0);

    // RequestId and metadata still present
    expect(result.requestId).toBe("test-req-id");
    expect(result.total_duration_ms).toBeGreaterThanOrEqual(0);
  });

  // -------------------------------------------------------
  // Scenario 5: Invalid input — validation throws
  // -------------------------------------------------------
  it("throws on invalid input (missing required field for input_mode)", async () => {
    const invalidInput = {
      input_mode: "text" as const,
      // content_text is missing — required for text mode
      content_type: "video" as const,
    };

    await expect(
      runPredictionPipeline(invalidInput as never)
    ).rejects.toThrow(/validation/i);
  });

  // -------------------------------------------------------
  // Scenario 6: Custom requestId via opts
  // -------------------------------------------------------
  it("uses custom requestId when provided via opts", async () => {
    const result = await runPredictionPipeline(input, {
      requestId: "custom-req-123",
    });

    expect(result.requestId).toBe("custom-req-123");
  });

  // -------------------------------------------------------
  // Scenario 7: DeepSeek returns null (circuit breaker open) — pipeline degrades
  // -------------------------------------------------------
  it("handles DeepSeek returning null gracefully (circuit breaker open)", async () => {
    // Open circuit breaker by failing 3 times with AbortError
    const abortError = new Error("abort");
    abortError.name = "AbortError";
    mockDeepSeekCreate.mockRejectedValue(abortError);

    // Run pipeline 3 times to open circuit breaker (each throws in pipeline's catch)
    for (let i = 0; i < 3; i++) {
      try {
        await runPredictionPipeline(input);
      } catch {
        // Expected — DeepSeek abort triggers pipeline catch but Gemini succeeds
      }
    }

    // Reset DeepSeek mock but circuit is open — should return null
    mockDeepSeekCreate.mockClear();

    // Re-setup Gemini mock since it was cleared
    mockGeminiGenerate.mockResolvedValue({
      text: JSON.stringify(makeGeminiAnalysis()),
      usageMetadata: {
        promptTokenCount: 500,
        candidatesTokenCount: 300,
      },
    });

    const result = await runPredictionPipeline(input);

    // Pipeline should complete with null deepseekResult
    expect(result.deepseekResult).toBeNull();
    expect(result.geminiResult.analysis.factors).toHaveLength(5);
  });
});
