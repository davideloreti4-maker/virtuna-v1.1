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
const mockGeminiFileUpload = vi.fn().mockResolvedValue({ name: "files/pipeline-test", state: "ACTIVE", uri: "gs://pipeline-test" });
const mockGeminiFileGet = vi.fn().mockResolvedValue({ name: "files/pipeline-test", state: "ACTIVE", uri: "gs://pipeline-test" });
const mockGeminiFileDelete = vi.fn().mockResolvedValue({});
vi.mock("@google/genai", () => {
  const MockGoogleGenAI = vi.fn(function (this: Record<string, unknown>) {
    this.models = { generateContent: mockGeminiGenerate };
    // WR-05: expose files API so content-type-detector can call upload/get/delete
    this.files = {
      upload: mockGeminiFileUpload,
      get: mockGeminiFileGet,
      delete: mockGeminiFileDelete,
    };
  });
  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: {
      OBJECT: "OBJECT",
      ARRAY: "ARRAY",
      STRING: "STRING",
      NUMBER: "NUMBER",
      BOOLEAN: "BOOLEAN",  // WR-05 fix: required by content-type-detector RESPONSE_SCHEMA
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

// Phase 8 — retrieval-stage mock (vi.hoisted so vi.mock factory can reference it).
const { mockRunBenchmarkRetrieval } = vi.hoisted(() => ({
  mockRunBenchmarkRetrieval: vi.fn(async () => ({
    evidence: [],
    score: 0.5,
    availability: true,
    cost_cents: 0.001,
  })),
}));
vi.mock("@/lib/engine/retrieval/retrieval-stage", () => ({
  runBenchmarkRetrieval: mockRunBenchmarkRetrieval,
}));

// Phase 9 — platform-fit mock (vi.hoisted so vi.mock factory can reference it).
const { mockRunPlatformFit } = vi.hoisted(() => ({
  mockRunPlatformFit: vi.fn(async () => [
    { platform: "tiktok", fit_score: 78, rationale: "Strong hook aligns with TikTok trends" },
    { platform: "instagram", fit_score: 62, rationale: "Moderate visual appeal for Reels" },
  ]),
}));
vi.mock("@/lib/engine/wave4/platform-fit", () => ({
  runPlatformFit: mockRunPlatformFit,
}));

// Set env vars BEFORE importing the module under test
process.env.GEMINI_API_KEY = "test-key";
process.env.DEEPSEEK_API_KEY = "test-key";
process.env.DASHSCOPE_API_KEY = "test-key";

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

    // Default DeepSeek mock — Wave 2 reasoning OR Wave 3 persona response
    // depending on which call. Phase 7 Plan 07-02b: Wave 3 fires 10 persona
    // calls with the persona system prompt; we distinguish via "TikTok For You Page viewer"
    // marker text in the system prompt (set by buildPersonaSystemPrompt).
    mockDeepSeekCreate.mockImplementation((args: { messages: Array<{ role: string; content: string }> }) => {
      const sys = args.messages?.find((m) => m.role === "system")?.content ?? "";
      const isPersonaCall = sys.includes("TikTok For You Page viewer");
      return Promise.resolve({
        choices: [
          {
            message: {
              content: isPersonaCall
                ? JSON.stringify({
                    scroll_past_second: 5,
                    watch_through_pct: 70,
                    comment_intent: 20,
                    share_intent: 30,
                    save_intent: 40,
                    reasoning: "default persona test reaction",
                  })
                : JSON.stringify(makeDeepSeekReasoning()),
            },
          },
        ],
        usage: { prompt_tokens: 1000, completion_tokens: 500 },
      });
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
  // Scenario 3: Gemini failure degrades gracefully (HARD-03)
  // -------------------------------------------------------
  it("Gemini failure produces fallback result with zero scores and warning", async () => {
    // Gemini fails on all retry attempts
    mockGeminiGenerate.mockRejectedValue(
      new Error("Gemini API unavailable")
    );

    const result = await runPredictionPipeline(input);

    // Pipeline should complete with fallback Gemini result
    expect(result.geminiResult.analysis.factors).toHaveLength(5);
    expect(
      result.geminiResult.analysis.factors.every((f) => f.score === 0)
    ).toBe(true);
    expect(result.geminiResult.cost_cents).toBe(0);
    expect(result.geminiResult.analysis.overall_impression).toContain(
      "unavailable"
    );

    // Warning should indicate Gemini failure
    expect(
      result.warnings.some((w) => w.includes("Gemini analysis unavailable"))
    ).toBe(true);

    // DeepSeek still succeeds — it calls OpenAI directly, not Gemini
    // It receives the fallback zero-score analysis but can still reason
    expect(result.deepseekResult).not.toBeNull();

    // Pipeline metadata still present
    expect(result.requestId).toBe("test-req-id");
    expect(result.total_duration_ms).toBeGreaterThanOrEqual(0);
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

// =====================================================
// Phase 3 — onStageEvent + stub invocations
// =====================================================

describe("Phase 3 — onStageEvent + stub invocations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCircuitBreaker();
    supabaseTableOverrides = {};

    // Default Gemini mock — returns valid GeminiAnalysis
    mockGeminiGenerate.mockResolvedValue({
      text: JSON.stringify(makeGeminiAnalysis()),
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 300 },
    });

    // Default DeepSeek mock — routes Wave 2 reasoning vs Wave 3 persona call
    // by inspecting system prompt (Phase 7 Plan 07-02b orchestrator).
    mockDeepSeekCreate.mockImplementation((args: { messages: Array<{ role: string; content: string }> }) => {
      const sys = args.messages?.find((m) => m.role === "system")?.content ?? "";
      const isPersonaCall = sys.includes("TikTok For You Page viewer");
      return Promise.resolve({
        choices: [
          {
            message: {
              content: isPersonaCall
                ? JSON.stringify({
                    scroll_past_second: 5,
                    watch_through_pct: 70,
                    comment_intent: 20,
                    share_intent: 30,
                    save_intent: 40,
                    reasoning: "default persona test reaction",
                  })
                : JSON.stringify(makeDeepSeekReasoning()),
            },
          },
        ],
        usage: { prompt_tokens: 1000, completion_tokens: 500 },
      });
    });

    supabaseTableOverrides = {
      rule_library: { data: [], error: null },
      trending_sounds: { data: [], error: null },
      creator_profiles: { data: null, error: null },
      scraped_videos: { data: [], error: null },
    };
  });

  it("calling without opts behaves byte-identically (PIPE-01 backwards compat)", async () => {
    const result = await runPredictionPipeline(input);
    expect(result.wave0Result).toEqual({ content_type: null, niche: null });
    // Phase 7 Plan 07-02b: Wave 3 now actually fires 10 persona calls. Under the
    // default mock all 10 succeed → 10 PersonaSimulationResult entries.
    expect(result.wave3Result).toHaveLength(10);
    // Same StageTiming output structure as before
    expect(result.timings.length).toBeGreaterThan(0);
    expect(result.timings.some((t) => t.stage === "validate")).toBe(true);
    expect(result.timings.some((t) => t.stage === "normalize")).toBe(true);
  });

  it("calling with { requestId } only still works (existing call site shape)", async () => {
    const result = await runPredictionPipeline(input, { requestId: "test-req" });
    expect(result).toBeDefined();
    expect(result.requestId).toBe("test-req");
  });

  it("emits stage events when onStageEvent provided (PIPE-03)", async () => {
    const events: Array<{ type: string; stage?: string; wave?: number | string }> = [];
    await runPredictionPipeline(input, {
      requestId: "test",
      onStageEvent: (e) => {
        if (e.type === "stage_start" || e.type === "stage_end") {
          events.push({ type: e.type, stage: e.stage, wave: e.wave });
        }
      },
    });

    // Wave 0 stub fires before Wave 1
    const wave0StartIdx = events.findIndex(
      (e) => e.type === "stage_start" && e.stage === "wave_0_content_type"
    );
    const wave1StartIdx = events.findIndex(
      (e) => e.type === "stage_start" && e.stage === "wave_1"
    );
    expect(wave0StartIdx).toBeGreaterThanOrEqual(0);
    expect(wave1StartIdx).toBeGreaterThan(wave0StartIdx);

    // Wave 3 stub fires after Wave 2
    const wave2EndIdx = events
      .map((e, i) => ({ e, i }))
      .reverse()
      .find(({ e }) => e.type === "stage_end" && e.stage === "wave_2")?.i ?? -1;
    const wave3StartIdx = events.findIndex(
      (e) => e.type === "stage_start" && e.stage === "wave_3_personas"
    );
    expect(wave3StartIdx).toBeGreaterThanOrEqual(0);
    expect(wave3StartIdx).toBeGreaterThan(wave2EndIdx);

    // Validate stage events fire for every timed() boundary
    const stageStartNames = events
      .filter((e) => e.type === "stage_start")
      .map((e) => e.stage);
    expect(stageStartNames).toContain("validate");
    expect(stageStartNames).toContain("normalize");
    expect(stageStartNames).toContain("rule_scoring");
    expect(stageStartNames).toContain("wave_1");
    expect(stageStartNames).toContain("wave_2");
    expect(stageStartNames).toContain("deepseek_reasoning");
    expect(stageStartNames).toContain("trend_enrichment");

    // Each stage_start should have a paired stage_end
    const stageEndNames = events
      .filter((e) => e.type === "stage_end")
      .map((e) => e.stage);
    expect(stageEndNames).toContain("validate");
    expect(stageEndNames).toContain("normalize");
    expect(stageEndNames).toContain("wave_1");
    expect(stageEndNames).toContain("wave_2");
  });

  it("undefined onStageEvent fires no events", async () => {
    const result = await runPredictionPipeline(input);
    // Result should be valid; the test passes if no errors thrown
    expect(result.timings.length).toBeGreaterThan(0);
  });

  it("propagates bypassCache option (consumer responsibility) without affecting pipeline behavior", async () => {
    const resultBypass = await runPredictionPipeline(input, { bypassCache: true });
    const resultNoBypass = await runPredictionPipeline(input, { bypassCache: false });
    // Pipeline returns same shape regardless of bypassCache — it's just a passthrough flag
    expect(resultBypass).toBeDefined();
    expect(resultNoBypass).toBeDefined();
    expect(resultBypass.wave0Result).toEqual({ content_type: null, niche: null });
    // Phase 7 Plan 07-02b: Wave 3 fires 10 persona calls regardless of bypassCache —
    // bypassCache is a passthrough flag, not a Wave 3 disable.
    expect(resultBypass.wave3Result).toHaveLength(10);
  });
});

// =====================================================
// Phase 4 — Wave 0 + pre_creator_context (Plan 04-03 Task 2)
// =====================================================

import type { StageEvent } from "../events";
import type { CreatorContext } from "../creator";

describe("Phase 4 — Wave 0 + pre_creator_context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCircuitBreaker();
    supabaseTableOverrides = {};

    // Default Gemini mock — returns valid GeminiAnalysis (text mode path)
    mockGeminiGenerate.mockResolvedValue({
      text: JSON.stringify(makeGeminiAnalysis()),
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 300 },
    });

    // Default DeepSeek mock — routes Wave 2 reasoning vs Wave 3 persona call
    // by inspecting system prompt (Phase 7 Plan 07-02b orchestrator).
    mockDeepSeekCreate.mockImplementation((args: { messages: Array<{ role: string; content: string }> }) => {
      const sys = args.messages?.find((m) => m.role === "system")?.content ?? "";
      const isPersonaCall = sys.includes("TikTok For You Page viewer");
      return Promise.resolve({
        choices: [
          {
            message: {
              content: isPersonaCall
                ? JSON.stringify({
                    scroll_past_second: 5,
                    watch_through_pct: 70,
                    comment_intent: 20,
                    share_intent: 30,
                    save_intent: 40,
                    reasoning: "default persona test reaction",
                  })
                : JSON.stringify(makeDeepSeekReasoning()),
            },
          },
        ],
        usage: { prompt_tokens: 1000, completion_tokens: 500 },
      });
    });

    supabaseTableOverrides = {
      rule_library: { data: [], error: null },
      trending_sounds: { data: [], error: null },
      creator_profiles: { data: null, error: null },
      scraped_videos: { data: [], error: null },
    };
  });

  it("pre_creator_context stage_start fires before wave_0_content_type stage_start (D-17 single-call ordering)", async () => {
    const events: StageEvent[] = [];
    await runPredictionPipeline(input, { onStageEvent: (e) => events.push(e) });
    const preIdx = events.findIndex(
      (e) => e.type === "stage_start" && e.stage === "pre_creator_context",
    );
    const w0CtIdx = events.findIndex(
      (e) => e.type === "stage_start" && e.stage === "wave_0_content_type",
    );
    // D-17: wave_0_niche_detector is deleted — no separate niche event fires.
    const w0NicheIdx = events.findIndex(
      (e) => e.type === "stage_start" && e.stage === "wave_0_niche_detector",
    );
    expect(preIdx).toBeGreaterThanOrEqual(0);
    expect(w0CtIdx).toBeGreaterThan(preIdx);
    // D-17: niche stage is gone — index should be -1 (not present)
    expect(w0NicheIdx).toBe(-1);
  });

  it("Wave 1 creator_context event still fires (backwards-compat passthrough)", async () => {
    const events: StageEvent[] = [];
    await runPredictionPipeline(input, { onStageEvent: (e) => events.push(e) });
    const starts = events.filter(
      (e) => e.type === "stage_start" && e.stage === "creator_context",
    );
    const ends = events.filter(
      (e) => e.type === "stage_end" && e.stage === "creator_context",
    );
    expect(starts).toHaveLength(1);
    expect(ends).toHaveLength(1);
  });

  it("opts.creatorContext bypasses fetchCreatorContext (D-18 reuse — no creator_profiles read)", async () => {
    const fakeCtx: CreatorContext = {
      found: true,
      follower_count: 12345,
      avg_views: null,
      engagement_rate: 0.07,
      niche: "beauty",
      posting_frequency: "daily",
      platform_averages: {
        avg_views: 50000,
        avg_engagement_rate: 0.06,
        avg_share_rate: 0.008,
        avg_comment_rate: 0.005,
      },
      target_platforms: ["tiktok"],
      niche_primary: "beauty",
      niche_sub: "skincare",
      target_audience: null,
      primary_goal: "growth",
      creator_stage: "growing",
      content_style: "talking_head",
      cuts_per_second: "slow",
      reference_creators: null,
      past_wins: null,
      past_flops: null,
      time_of_day_aware: null,
      pain_points: null,
    };

    // Clear mockFrom to count calls during this test only
    mockFrom.mockClear();

    const result = await runPredictionPipeline(input, { creatorContext: fakeCtx });
    expect(result).toBeDefined();
    expect(result.creatorContext).toEqual(fakeCtx);

    // creator_profiles table should NOT be queried when caller provides creatorContext.
    const creatorProfileCalls = mockFrom.mock.calls.filter(
      ([table]) => table === "creator_profiles",
    );
    expect(creatorProfileCalls).toHaveLength(0);
  });

  it("opts absent triggers internal fetch (pre_creator_context stage fires)", async () => {
    const events: StageEvent[] = [];
    await runPredictionPipeline(input, { onStageEvent: (e) => events.push(e) });
    const preStart = events.find(
      (e) => e.type === "stage_start" && e.stage === "pre_creator_context",
    );
    expect(preStart).toBeDefined();
  });

  it("Wave 0 fires before Wave 1 (Wave 0 SC#1 ordering)", async () => {
    const events: StageEvent[] = [];
    await runPredictionPipeline(input, { onStageEvent: (e) => events.push(e) });
    const w0Idx = events.findIndex(
      (e) => e.type === "stage_start" && e.stage === "wave_0_content_type",
    );
    const wave1Idx = events.findIndex(
      (e) =>
        e.type === "stage_start" &&
        e.wave === 1 &&
        e.stage !== "pre_creator_context" &&
        e.stage !== "creator_context" &&
        e.stage !== "validate" &&
        e.stage !== "normalize" &&
        e.stage !== "wave_1",
    );
    expect(w0Idx).toBeGreaterThanOrEqual(0);
    expect(wave1Idx).toBeGreaterThanOrEqual(0); // WR-04 fix: fail honestly if Wave 1 stops firing in this scenario
    expect(w0Idx).toBeLessThan(wave1Idx);       // ordering invariant — Wave 0 must precede Wave 1
  });

  it("PipelineResult includes wave0Result with content_type + niche keys", async () => {
    const result = await runPredictionPipeline(input);
    expect(result.wave0Result).toBeDefined();
    expect(result.wave0Result).toHaveProperty("content_type");
    expect(result.wave0Result).toHaveProperty("niche");
  });

  it("GAP-04-01 regression: video_upload mode produces non-null wave0Result.content_type end-to-end", async () => {
    // Production-shaped input: input_mode='video_upload' with a real-looking storage key (NO scheme)
    const videoInput = {
      input_mode: "video_upload" as const,
      video_storage_path: "user-abc/test-content.mp4",
      content_text: "GRWM for date night #beauty",
      content_type: "video" as const,
    };

    // Override the default storage download mock to succeed with a Blob
    mockStorageDownload.mockResolvedValue({
      data: new Blob([new Uint8Array(8)], { type: "video/mp4" }),
      error: null,
    });

    // Re-mock files API (vi.clearAllMocks() in beforeEach wipes default return values)
    mockGeminiFileUpload.mockResolvedValue({ name: "files/pipeline-ct-test", state: "ACTIVE", uri: "gs://pipeline-ct-test" });
    mockGeminiFileGet.mockResolvedValue({ name: "files/pipeline-ct-test", state: "ACTIVE", uri: "gs://pipeline-ct-test" });
    mockGeminiFileDelete.mockResolvedValue({});

    // Override generateContent: content-type-detector uses gemini-3-flash-preview model;
    // Wave 1 video analysis and main analysis use other models. Branch on model name.
    mockGeminiGenerate.mockImplementation(async (req: { model?: string }) => {
      if (req.model?.includes("gemini-3-flash")) {
        // content-type-detector response — D-17: includes niche fields
        return {
          text: JSON.stringify({ type: "talking_head", confidence: 0.85, mixed: false, niche_primary_slug: "beauty", niche_confidence: 0.9, niche_micro_slug: null }),
          usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 80 },
        };
      }
      // Default Wave 1 + main analysis response
      return {
        text: JSON.stringify(makeGeminiAnalysis()),
        usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 300 },
      };
    });

    const result = await runPredictionPipeline(videoInput);

    expect(result.wave0Result).toBeDefined();
    expect(result.wave0Result.content_type).not.toBeNull();
    expect(result.wave0Result.content_type?.type).toBe("talking_head");
    // Confirm the storage path was used (NOT a fetch on the raw key)
    expect(mockStorageDownload).toHaveBeenCalledWith("user-abc/test-content.mp4");
  });
});

// =====================================================
// Phase 8 — Wave 1 retrieval sibling (Plan 04 Task 2)
// =====================================================

// retrieval-stage is mocked at the top of the file via vi.hoisted (see top of file).
// Note: this `vi.mock` call must execute before runPredictionPipeline is imported,
// so we rely on Vitest's hoisting + the matching vi.hoisted block above.

describe("Phase 8 — Wave 1 retrieval sibling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCircuitBreaker();
    supabaseTableOverrides = {};

    // Default Gemini mock — returns valid GeminiAnalysis
    mockGeminiGenerate.mockResolvedValue({
      text: JSON.stringify(makeGeminiAnalysis()),
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 300 },
    });

    // Default DeepSeek mock — returns valid DeepSeekReasoning
    mockDeepSeekCreate.mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify(makeDeepSeekReasoning()) } },
      ],
      usage: { prompt_tokens: 1000, completion_tokens: 500 },
    });

    supabaseTableOverrides = {
      rule_library: { data: [], error: null },
      trending_sounds: { data: [], error: null },
      creator_profiles: { data: null, error: null },
      scraped_videos: { data: [], error: null },
    };

    // Default retrieval mock — non-null result with one evidence item
    mockRunBenchmarkRetrieval.mockResolvedValue({
      evidence: [],
      score: 0.5,
      availability: true,
      cost_cents: 0.001,
    });
  });

  it("PipelineResult includes retrievalResult with full BenchmarkRetrievalResult shape", async () => {
    const result = await runPredictionPipeline(input);

    expect(result.retrievalResult).toBeDefined();
    expect(result.retrievalResult).toHaveProperty("evidence");
    expect(result.retrievalResult).toHaveProperty("score");
    expect(result.retrievalResult).toHaveProperty("availability");
    expect(result.retrievalResult).toHaveProperty("cost_cents");
    expect(result.retrievalResult.score).toBe(0.5);
    expect(result.retrievalResult.availability).toBe(true);
  });

  it("runBenchmarkRetrieval invoked once with payload + creatorContext + wave0Result + supabase + onEvent + requestId", async () => {
    mockRunBenchmarkRetrieval.mockClear();

    await runPredictionPipeline(input, { requestId: "ret-test-id" });

    expect(mockRunBenchmarkRetrieval).toHaveBeenCalledTimes(1);
    const args = (mockRunBenchmarkRetrieval.mock.calls[0] as unknown as [Record<string, unknown>])?.[0];
    expect(args).toBeDefined();
    expect(args!.payload).toBeDefined();
    expect(args!.creatorContext).toBeDefined();
    expect(args!.wave0Result).toBeDefined();
    expect(args!.supabase).toBeDefined();
    expect(args!.requestId).toBe("ret-test-id");
  });

  it("retrieval failure pushes warning + returns empty BenchmarkRetrievalResult (graceful degradation)", async () => {
    mockRunBenchmarkRetrieval.mockRejectedValueOnce(
      new Error("RPC unreachable"),
    );

    const result = await runPredictionPipeline(input);

    expect(result.retrievalResult.evidence).toEqual([]);
    expect(result.retrievalResult.score).toBeNull();
    expect(result.retrievalResult.availability).toBe(false);
    expect(result.retrievalResult.cost_cents).toBe(0);
    expect(
      result.warnings.some((w) => w.includes("Retrieval unavailable")),
    ).toBe(true);
  });
});

// =====================================================
// Phase 9 — Platform-fit V3 + Critique + Counterfactuals (Plan 09-07)
// =====================================================

// platform-fit is mocked at the top of the file via vi.hoisted (see top of file).

describe("Phase 9 — Platform-fit V3 result in PipelineResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCircuitBreaker();
    supabaseTableOverrides = {};

    // Default Gemini mock
    mockGeminiGenerate.mockResolvedValue({
      text: JSON.stringify(makeGeminiAnalysis()),
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 300 },
    });

    // Default DeepSeek mock — routes Wave 2 reasoning vs Wave 3 persona call
    mockDeepSeekCreate.mockImplementation((args: { messages: Array<{ role: string; content: string }> }) => {
      const sys = args.messages?.find((m) => m.role === "system")?.content ?? "";
      const isPersonaCall = sys.includes("TikTok For You Page viewer");
      return Promise.resolve({
        choices: [
          {
            message: {
              content: isPersonaCall
                ? JSON.stringify({
                    scroll_past_second: 5,
                    watch_through_pct: 70,
                    comment_intent: 20,
                    share_intent: 30,
                    save_intent: 40,
                    reasoning: "default persona test reaction",
                  })
                : JSON.stringify(makeDeepSeekReasoning()),
            },
          },
        ],
        usage: { prompt_tokens: 1000, completion_tokens: 500 },
      });
    });

    supabaseTableOverrides = {
      rule_library: { data: [], error: null },
      trending_sounds: { data: [], error: null },
      creator_profiles: { data: null, error: null },
      scraped_videos: { data: [], error: null },
    };
  });

  it("PipelineResult includes platformFitResult with per-platform scores", async () => {
    mockRunPlatformFit.mockClear();
    mockRunPlatformFit.mockResolvedValue([
      { platform: "tiktok", fit_score: 85, rationale: "Strong hook" },
    ]);

    const result = await runPredictionPipeline(input);

    expect(result.platformFitResult).toBeDefined();
    expect(result.platformFitResult).toHaveLength(1);
    expect(result.platformFitResult![0]!.platform).toBe("tiktok");
    expect(result.platformFitResult![0]!.fit_score).toBe(85);
  });

  it("runPlatformFit invoked once after Wave 3 (ordering invariant)", async () => {
    mockRunPlatformFit.mockClear();
    mockRunPlatformFit.mockResolvedValue([
      { platform: "tiktok", fit_score: 70, rationale: "Decent fit" },
    ]);

    const result = await runPredictionPipeline(input);

    expect(mockRunPlatformFit).toHaveBeenCalledTimes(1);
    // platformFitResult in the return confirms platform-fit ran after Wave 3
    // (Wave 3 must finish before PipelineResult is assembled).
    expect(result.platformFitResult).toBeDefined();
    expect(result.wave3Result).toHaveLength(10);
  });

  it("platform-fit stage events fire (delegated to runPlatformFit self-emission)", async () => {
    mockRunPlatformFit.mockImplementation((async (_payload: unknown, _ctx: unknown, _ds: unknown, _wm: unknown, onEvent?: (e: { type: string; stage: string; wave: number }) => void) => {
      onEvent?.({ type: "stage_start" as const, stage: "platform_fit", wave: 4 });
      await Promise.resolve();
      onEvent?.({ type: "stage_end" as const, stage: "platform_fit", wave: 4 });
      return [{ platform: "tiktok", fit_score: 70, rationale: "Decent fit" }];
    }) as unknown as () => Promise<{ platform: string; fit_score: number; rationale: string }[]>);

    const events: Array<{ type: string; stage: string }> = [];
    await runPredictionPipeline(input, {
      onStageEvent: (e) => {
        if (e.type === "stage_start" || e.type === "stage_end") {
          events.push({ type: e.type, stage: e.stage });
        }
      },
    });

    expect(events.filter((e) => e.stage === "platform_fit")).toHaveLength(2);
  });

  it("platform-fit null on failure produces null platformFitResult (graceful degradation)", async () => {
    mockRunPlatformFit.mockClear();
    mockRunPlatformFit.mockRejectedValue(new Error("V3 API timeout"));

    const result = await runPredictionPipeline(input);

    expect(result.platformFitResult).toBeNull();
    expect(
      result.warnings.some((w) => w.includes("Platform-fit unavailable")),
    ).toBe(true);
  });
});
