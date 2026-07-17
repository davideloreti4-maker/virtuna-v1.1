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

// AUD-FAIL-01 — lets a single test force runFold to THROW (as it really can: getQwenClient() and
// buildFoldUserContent() run outside its per-attempt try/catch, so a rotated API key throws out of
// it). Defaults to the real implementation, so every other test in this file is untouched.
const foldThrow = vi.hoisted(() => ({ enabled: false }));
vi.mock("../wave3/fold", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../wave3/fold")>();
  return {
    ...actual,
    runFold: (...args: Parameters<typeof actual.runFold>) => {
      if (foldThrow.enabled) throw new Error("QWEN_API_KEY is not set");
      return actual.runFold(...args);
    },
  };
});

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
        // Phase 13 (Qwen migration): video_upload pipeline now resolves a 1h signed URL
        // instead of uploading the bytes to Gemini Files API.
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: "https://supabase.test/signed/video.mp4" },
          error: null,
        }),
      })),
    },
  })),
}));

// Plan 03: platform-fit mock removed — runPlatformFit call site removed from pipeline.ts.
// Note: mockRunPlatformFit kept as a no-op reference to avoid breaking Phase 9 test suite assertions.
const { mockRunPlatformFit } = vi.hoisted(() => ({
  mockRunPlatformFit: vi.fn(),
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
  mode: "score" as const,
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
      // Qwen text-mode analysis (Phase 13 — replaces Gemini text analysis).
      // System prompt set in pipeline.ts at the text-mode geminiPromise branch
      // begins with "You are a TikTok content analyst.".
      const isQwenTextAnalysis = sys.includes("TikTok content analyst");
      let body: string;
      if (isPersonaCall) {
        body = JSON.stringify({
          scroll_past_second: 5,
          watch_through_pct: 70,
          comment_intent: 20,
          share_intent: 30,
          save_intent: 40, rewatch_intent: 25,
          reasoning: "default persona test reaction",
        });
      } else if (isQwenTextAnalysis) {
        body = JSON.stringify(makeGeminiAnalysis());
      } else {
        body = JSON.stringify(makeDeepSeekReasoning());
      }
      return Promise.resolve({
        choices: [{ message: { content: body } }],
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
  // Scenarios 2 and 3 (DeepSeek-failure→Gemini-fallback + Gemini-failure→zero-score
  // fallback) removed: both tested an architecture that no longer exists. Phase 13
  // Qwen migration collapsed Gemini analysis + DeepSeek reasoning into a single
  // engine (qwen3.5-omni-plus for video, qwen3.6-plus for text/persona/reasoning).
  // DeepSeek's fallback path was deleted with the Gemini segmented analysis.

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

    // Rule result + trend enrichment removed from PipelineResult in Plan 03 strip.

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
      // Qwen text-mode analysis (Phase 13 — replaces Gemini text analysis).
      // System prompt set in pipeline.ts at the text-mode geminiPromise branch
      // begins with "You are a TikTok content analyst.".
      const isQwenTextAnalysis = sys.includes("TikTok content analyst");
      let body: string;
      if (isPersonaCall) {
        body = JSON.stringify({
          scroll_past_second: 5,
          watch_through_pct: 70,
          comment_intent: 20,
          share_intent: 30,
          save_intent: 40, rewatch_intent: 25,
          reasoning: "default persona test reaction",
        });
      } else if (isQwenTextAnalysis) {
        body = JSON.stringify(makeGeminiAnalysis());
      } else {
        body = JSON.stringify(makeDeepSeekReasoning());
      }
      return Promise.resolve({
        choices: [{ message: { content: body } }],
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
    // Phase 4 Plan 05: fold is sole audience-sim; in text mode (no segments) fold is not
    // invoked → wave3Result = [] (adapted from foldOutcome=null).
    expect(Array.isArray(result.wave3Result)).toBe(true);
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

    // Phase 13 (Qwen migration): wave_0_content_type is no longer a discrete stage
    // in text mode — it was folded into the single qwen Omni call for video_upload mode
    // only. Text-mode flow runs validate → normalize → pre_creator_context → wave_1
    // (envelope around gemini/audio/creator/rule/retrieval) → wave_2.
    // Phase 4 Plan 05: wave_3_personas removed (10-pass deleted); fold emits wave_3_fold
    // only when segments are present (video_upload mode). In text mode no wave_3 events fire.
    const wave1StartIdx = events.findIndex(
      (e) => e.type === "stage_start" && e.stage === "wave_1"
    );
    expect(wave1StartIdx).toBeGreaterThanOrEqual(0);

    const wave2StartIdx = events.findIndex(
      (e) => e.type === "stage_start" && e.stage === "wave_2"
    );
    expect(wave2StartIdx).toBeGreaterThanOrEqual(0);

    // Validate stage events fire for every timed() boundary
    const stageStartNames = events
      .filter((e) => e.type === "stage_start")
      .map((e) => e.stage);
    expect(stageStartNames).toContain("validate");
    expect(stageStartNames).toContain("normalize");
    // Plan 03 strip: rule_scoring + trend_enrichment stages removed.
    expect(stageStartNames).not.toContain("rule_scoring");
    expect(stageStartNames).toContain("wave_1");
    expect(stageStartNames).toContain("wave_2");
    expect(stageStartNames).toContain("deepseek_reasoning");
    expect(stageStartNames).not.toContain("trend_enrichment");

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
    // Phase 4 Plan 05: fold is sole audience-sim; text mode → no segments → wave3Result=[].
    // bypassCache is a passthrough flag that doesn't affect fold behavior.
    expect(Array.isArray(resultBypass.wave3Result)).toBe(true);
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
      // Qwen text-mode analysis (Phase 13 — replaces Gemini text analysis).
      // System prompt set in pipeline.ts at the text-mode geminiPromise branch
      // begins with "You are a TikTok content analyst.".
      const isQwenTextAnalysis = sys.includes("TikTok content analyst");
      let body: string;
      if (isPersonaCall) {
        body = JSON.stringify({
          scroll_past_second: 5,
          watch_through_pct: 70,
          comment_intent: 20,
          share_intent: 30,
          save_intent: 40, rewatch_intent: 25,
          reasoning: "default persona test reaction",
        });
      } else if (isQwenTextAnalysis) {
        body = JSON.stringify(makeGeminiAnalysis());
      } else {
        body = JSON.stringify(makeDeepSeekReasoning());
      }
      return Promise.resolve({
        choices: [{ message: { content: body } }],
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

  it("pre_creator_context stage_start fires before wave_1 (D-17 single-call ordering)", async () => {
    const events: StageEvent[] = [];
    await runPredictionPipeline(input, { onStageEvent: (e) => events.push(e) });
    const preIdx = events.findIndex(
      (e) => e.type === "stage_start" && e.stage === "pre_creator_context",
    );
    // Phase 13: wave_0_content_type collapsed into the Qwen Omni call (video_upload mode only).
    // Text mode never emits wave_0_content_type/wave_0_niche_detector — assert via wave_1 instead.
    const wave1Idx = events.findIndex(
      (e) => e.type === "stage_start" && e.stage === "wave_1",
    );
    const w0CtIdx = events.findIndex(
      (e) => e.type === "stage_start" && e.stage === "wave_0_content_type",
    );
    const w0NicheIdx = events.findIndex(
      (e) => e.type === "stage_start" && e.stage === "wave_0_niche_detector",
    );
    expect(preIdx).toBeGreaterThanOrEqual(0);
    expect(wave1Idx).toBeGreaterThan(preIdx);
    expect(w0CtIdx).toBe(-1);
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

  it("Wave 0 stages are not emitted in text mode (collapsed into Qwen Omni call which only fires for video_upload)", async () => {
    const events: StageEvent[] = [];
    await runPredictionPipeline(input, { onStageEvent: (e) => events.push(e) });
    const w0CtIdx = events.findIndex(
      (e) => e.type === "stage_start" && e.stage === "wave_0_content_type",
    );
    const w0NicheIdx = events.findIndex(
      (e) => e.type === "stage_start" && e.stage === "wave_0_niche_detector",
    );
    expect(w0CtIdx).toBe(-1);
    expect(w0NicheIdx).toBe(-1);
    // wave_1 envelope still fires
    const wave1Idx = events.findIndex(
      (e) => e.type === "stage_start" && e.stage === "wave_1",
    );
    expect(wave1Idx).toBeGreaterThanOrEqual(0);
  });

  it("PipelineResult includes wave0Result with content_type + niche keys", async () => {
    const result = await runPredictionPipeline(input);
    expect(result.wave0Result).toBeDefined();
    expect(result.wave0Result).toHaveProperty("content_type");
    expect(result.wave0Result).toHaveProperty("niche");
  });

  it("GAP-04-01 regression: video_upload mode produces non-null wave0Result.content_type end-to-end", async () => {
    // Phase 13 (Qwen migration): video_upload mode no longer uploads to Gemini Files
    // API. It generates a 1h Supabase signed URL and passes it to qwen3.5-omni-plus
    // (single call returns wave0 + segmented analysis + audio signals).
    const videoInput = {
      input_mode: "video_upload" as const,
      video_storage_path: "user-abc/test-content.mp4",
      content_text: "GRWM for date night #beauty",
      content_type: "video" as const,
      mode: "score" as const,
    };

    // Omni call returns the full unified response. mockDeepSeekCreate IS the
    // openai mock (qwen uses the OpenAI-compatible client); we branch on
    // model name + system marker text to differentiate from text-analysis /
    // persona / deepseek calls (set in the beforeEach default).
    mockDeepSeekCreate.mockImplementation((args: { model?: string; messages: Array<{ role: string; content: unknown }> }) => {
      const sys = args.messages.find((m) => m.role === "system");
      const sysText = typeof sys?.content === "string" ? sys.content : "";
      const isOmni = sysText.includes("expert TikTok content analyst");
      const isPersonaCall = sysText.includes("TikTok For You Page viewer");
      let body: string;
      if (isOmni) {
        body = JSON.stringify({
          content_type:        "talking_head",
          niche_primary_slug:  "beauty",
          niche_micro_slug:    null,
          factors: [
            { name: "Scroll-Stop Power", score: 7, rationale: "x", improvement_tip: "y" },
            { name: "Completion Pull",   score: 7, rationale: "x", improvement_tip: "y" },
            { name: "Rewatch Potential", score: 6, rationale: "x", improvement_tip: "y" },
            { name: "Share Trigger",     score: 6, rationale: "x", improvement_tip: "y" },
            { name: "Emotional Charge",  score: 7, rationale: "x", improvement_tip: "y" },
          ],
          overall_impression: "Solid GRWM",
          content_summary:    "Beauty GRWM clip",
          hook_visual_impact: 7,
          hook_decomposition: {
            visual_stop_power:        7,
            audio_hook_quality:       6,
            text_overlay_score:       5,
            first_words_speech_score: 6,
            weakest_modality:         "text_overlay_score",
            visual_audio_coherence:   7,
            cognitive_load:           4,
            watermark_detected:       { tiktok: false, ig: false, yt: false },
          },
          video_signals: {
            visual_production_quality: 7,
            pacing_score:              7,
            transition_quality:        6,
          },
          cta_segment: {
            cta_present: false,
            strength:    null,
            type:        null,
            rationale:   "no CTA",
          },
          audio_signals: {
            voice_clarity_0_10:       7,
            audio_hook_first_2s_0_10: 6,
            silence_ratio:            0.1,
            voiceover_ratio:          0.7,
            music_ratio:              0.2,
            audio_description:        "Voiceover with light bg music",
          },
          audio_perceptual_score: 70,
        });
      } else if (isPersonaCall) {
        body = JSON.stringify({
          scroll_past_second: 5,
          watch_through_pct:  70,
          comment_intent:     20,
          share_intent:       30,
          save_intent:        40, rewatch_intent: 25,
          reasoning:          "test",
        });
      } else {
        body = JSON.stringify(makeDeepSeekReasoning());
      }
      return Promise.resolve({
        choices: [{ message: { content: body } }],
        usage:   { prompt_tokens: 1000, completion_tokens: 500 },
      });
    });

    const result = await runPredictionPipeline(videoInput);

    expect(result.wave0Result).toBeDefined();
    expect(result.wave0Result.content_type).not.toBeNull();
    expect(result.wave0Result.content_type?.type).toBe("talking_head");
  });
});

// =====================================================
// Phase 1 (MVP Cut) — retrievalResult synthesized from helper (D-09/D-10)
// =====================================================

describe("Phase 1 — retrievalResult from createEmptyRetrievalResult helper", () => {
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
  });

  it("PipelineResult includes retrievalResult matching empty helper shape (post-strip D-10)", async () => {
    const result = await runPredictionPipeline(input);

    expect(result.retrievalResult).toBeDefined();
    expect(result.retrievalResult).toHaveProperty("evidence");
    expect(result.retrievalResult).toHaveProperty("score");
    expect(result.retrievalResult).toHaveProperty("availability");
    expect(result.retrievalResult).toHaveProperty("cost_cents");
    // Post-strip: helper always returns empty shape
    expect(result.retrievalResult.evidence).toEqual([]);
    expect(result.retrievalResult.score).toBeNull();
    expect(result.retrievalResult.availability).toBe(false);
    expect(result.retrievalResult.cost_cents).toBe(0);
  });
});

// =====================================================
// Phase 4 Plan 05 — Filmstrip trigger + fold wiring tests
// (10-pass / Pass 2 tests removed; fold is the sole audience-sim path)
// =====================================================

// These mocks are hoisted so vi.mock factories can reference them.
const { mockTriggerFilmstripGeneration } = vi.hoisted(() => ({
  mockTriggerFilmstripGeneration: vi.fn(),
}));

vi.mock("../filmstrip/queue", () => ({
  triggerFilmstripGeneration: mockTriggerFilmstripGeneration,
}));

describe("Phase 4 Plan 05 — filmstrip trigger + fold wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCircuitBreaker();
    supabaseTableOverrides = {};

    mockGeminiGenerate.mockResolvedValue({
      text: JSON.stringify(makeGeminiAnalysis()),
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 300 },
    });

    mockDeepSeekCreate.mockImplementation((args: { messages: Array<{ role: string; content: string }> }) => {
      const sys = args.messages?.find((m) => m.role === "system")?.content ?? "";
      const isQwenTextAnalysis = sys.includes("TikTok content analyst");
      let body: string;
      if (isQwenTextAnalysis) {
        body = JSON.stringify(makeGeminiAnalysis());
      } else {
        body = JSON.stringify(makeDeepSeekReasoning());
      }
      return Promise.resolve({
        choices: [{ message: { content: body } }],
        usage: { prompt_tokens: 1000, completion_tokens: 500 },
      });
    });

    supabaseTableOverrides = {
      rule_library: { data: [], error: null },
      trending_sounds: { data: [], error: null },
      creator_profiles: { data: null, error: null },
      scraped_videos: { data: [], error: null },
      analyses: { data: null, error: null },
    };
    mockTriggerFilmstripGeneration.mockReturnValue(undefined);
  });

  // video_upload input whose Omni call returns SEGMENTS — the fold is only invoked when segments
  // are present (pipeline.ts: `if (omniSegments && omniSegments.length > 0)`), so a video fixture
  // without them never reaches the fold at all and cannot exercise its failure paths.
  const VIDEO_INPUT = {
    input_mode: "video_upload" as const,
    video_storage_path: "user-abc/test-content.mp4",
    content_text: "GRWM for date night #beauty",
    content_type: "video" as const,
    mode: "score" as const,
  };

  function armOmniWithSegments() {
    mockDeepSeekCreate.mockImplementation((args: { messages: Array<{ role: string; content: unknown }> }) => {
      const sys = args.messages.find((m) => m.role === "system");
      const sysText = typeof sys?.content === "string" ? sys.content : "";
      const isOmni = sysText.includes("expert TikTok content analyst");
      const body = isOmni
        ? JSON.stringify({
            content_type: "talking_head",
            niche_primary_slug: "beauty",
            niche_micro_slug: null,
            factors: [
              { name: "Scroll-Stop Power", score: 7, rationale: "x", improvement_tip: "y" },
              { name: "Completion Pull", score: 7, rationale: "x", improvement_tip: "y" },
              { name: "Rewatch Potential", score: 6, rationale: "x", improvement_tip: "y" },
              { name: "Share Trigger", score: 6, rationale: "x", improvement_tip: "y" },
              { name: "Emotional Charge", score: 7, rationale: "x", improvement_tip: "y" },
            ],
            overall_impression: "Solid GRWM",
            content_summary: "Beauty GRWM clip",
            hook_visual_impact: 7,
            hook_decomposition: {
              visual_stop_power: 7,
              audio_hook_quality: 6,
              text_overlay_score: 5,
              first_words_speech_score: 6,
              weakest_modality: "text_overlay_score",
              visual_audio_coherence: 7,
              cognitive_load: 4,
              watermark_detected: { tiktok: false, ig: false, yt: false },
            },
            video_signals: {
              visual_production_quality: 7,
              pacing_score: 7,
              transition_quality: 6,
            },
            cta_segment: { cta_present: false, strength: null, type: null, rationale: "no CTA" },
            audio_signals: {
              voice_clarity_0_10: 7,
              audio_hook_first_2s_0_10: 6,
              silence_ratio: 0.1,
              voiceover_ratio: 0.7,
              music_ratio: 0.2,
              audio_description: "Voiceover with light bg music",
            },
            audio_perceptual_score: 70,
            // The point of this fixture: without segments the fold is never invoked.
            segments: [
              { t_start: 0, t_end: 2, visual_event: "face to camera", audio_event: "voiceover" },
              { t_start: 2, t_end: 5, visual_event: "product held up", audio_event: "voiceover" },
            ],
          })
        : JSON.stringify(makeDeepSeekReasoning());
      return Promise.resolve({
        choices: [{ message: { content: body } }],
        usage: { prompt_tokens: 1000, completion_tokens: 500 },
      });
    });
  }

  it("filmstrip: triggerFilmstripGeneration NOT called in text mode (no video)", async () => {
    await runPredictionPipeline(input);
    expect(mockTriggerFilmstripGeneration).not.toHaveBeenCalled();
  });

  it("fold: PipelineResult valid in text mode (no segments → foldOutcome=null, wave3Result=[])", async () => {
    const result = await runPredictionPipeline(input);
    expect(result).toBeDefined();
    expect(result.payload).toBeDefined();
    expect(result.wave3Result).toBeDefined();
    expect(Array.isArray(result.wave3Result)).toBe(true);
    // pass2Outcome always null (10-pass deleted)
    expect(result.pass2Outcome).toBeNull();
  });

  // AUD-FAIL-01 — the two ways a fold can be absent are NOT the same thing, and the aggregator
  // scores them differently: text mode never promised an audience (fall back to apollo-vs-
  // behavioral), a fold that was attempted and died has no counterpart at all (agreement 0, and
  // never HIGH). The distinction IS `foldOutcome === null`, so these two tests pin it.
  //
  // The test that used to live here was named "when fold throws" but ran text mode and asserted
  // foldOutcome=null — it never mocked a throw, so the throw path had zero coverage while looking
  // covered, and the null it asserted was the bug: a thrown fold read as "no fold was ever run".
  it("fold: text mode never runs a fold → foldOutcome=null (no audience was promised)", async () => {
    const result = await runPredictionPipeline(input);
    expect(result).toBeDefined();
    expect(result.payload).toBeDefined();
    // No segments → fold not invoked at all. Null here means "not applicable", not "failed".
    expect(result.foldOutcome).toBeNull();
  });

  it("fold: a fold that THROWS records the attempt (foldOutcome != null, fold_success=false)", async () => {
    // runFold really can throw: getQwenClient() and buildFoldUserContent() run outside its
    // per-attempt try/catch, so a missing/rotated API key escapes it. If the pipeline swallowed
    // that to foldOutcome=null, a dead audience would be indistinguishable from text mode and the
    // aggregator would hand it the 0.4 self-agreement bonus → HIGH confidence with zero personas.
    armOmniWithSegments();
    foldThrow.enabled = true;
    try {
      const result = await runPredictionPipeline(VIDEO_INPUT);

      // The pipeline still degrades gracefully — a dead fold is not a dead Read.
      expect(result).toBeDefined();
      expect(result.payload).toBeDefined();
      expect(result.wave3Result).toEqual([]);
      expect(result.personaBehavioralAggregate).toBeNull();

      // ...but the attempt is on the record. This is the whole fix.
      expect(result.foldOutcome).not.toBeNull();
      expect(result.foldOutcome?.fold_success).toBe(false);
      expect(result.foldOutcome?.personaSimResults).toEqual([]);
      expect(result.foldOutcome?.cost_cents).toBe(0);
      expect(result.warnings.some((w) => w.includes("Fold unavailable"))).toBe(true);
    } finally {
      foldThrow.enabled = false;
    }
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
      // Qwen text-mode analysis (Phase 13 — replaces Gemini text analysis).
      // System prompt set in pipeline.ts at the text-mode geminiPromise branch
      // begins with "You are a TikTok content analyst.".
      const isQwenTextAnalysis = sys.includes("TikTok content analyst");
      let body: string;
      if (isPersonaCall) {
        body = JSON.stringify({
          scroll_past_second: 5,
          watch_through_pct: 70,
          comment_intent: 20,
          share_intent: 30,
          save_intent: 40, rewatch_intent: 25,
          reasoning: "default persona test reaction",
        });
      } else if (isQwenTextAnalysis) {
        body = JSON.stringify(makeGeminiAnalysis());
      } else {
        body = JSON.stringify(makeDeepSeekReasoning());
      }
      return Promise.resolve({
        choices: [{ message: { content: body } }],
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

  it("PipelineResult does not include platformFitResult (Plan 03 strip: platform_fit call site removed)", async () => {
    // Plan 03: platformFitResult removed from PipelineResult; runPlatformFit no longer called.
    const result = await runPredictionPipeline(input);
    expect((result as unknown as Record<string, unknown>).platformFitResult).toBeUndefined();
    expect(mockRunPlatformFit).not.toHaveBeenCalled();
  });

  it("runPlatformFit NOT invoked after Plan 03 strip", async () => {
    mockRunPlatformFit.mockClear();
    const result = await runPredictionPipeline(input);
    // Plan 03: platform_fit call site removed from pipeline.ts.
    expect(mockRunPlatformFit).not.toHaveBeenCalled();
    // Phase 4 Plan 05: fold-only; text mode → no segments → wave3Result=[].
    expect(Array.isArray(result.wave3Result)).toBe(true);
  });

  it("platform-fit stage events do NOT fire (call site removed in Plan 03)", async () => {
    const events: Array<{ type: string; stage: string }> = [];
    await runPredictionPipeline(input, {
      onStageEvent: (e) => {
        if (e.type === "stage_start" || e.type === "stage_end") {
          events.push({ type: e.type, stage: e.stage });
        }
      },
    });
    // Plan 03: platform_fit stage events no longer emitted.
    expect(events.filter((e) => e.stage === "platform_fit")).toHaveLength(0);
  });

  it("pipeline completes without platform_fit (Plan 03 strip: graceful removal)", async () => {
    mockRunPlatformFit.mockClear();
    mockRunPlatformFit.mockRejectedValue(new Error("V3 API timeout"));

    const result = await runPredictionPipeline(input);

    // Plan 03: platform_fit removed; no warning about it, pipeline still completes.
    expect(result).toBeDefined();
    expect(result.warnings.some((w) => w.includes("Platform-fit unavailable"))).toBe(false);
  });
});
