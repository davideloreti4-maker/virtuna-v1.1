/**
 * Phase 5 Plan 03 Task 1 — Pipeline → analyzeVideoSegmented integration.
 *
 * Heavier than gemini-segmented.test.ts (Plan 02 Task 3) which tests the orchestrator
 * in isolation. This suite drives the FULL pipeline with input_mode="video_upload",
 * asserts the segmented path is taken (NOT the legacy single-call), and verifies
 * hook_decomposition + cta_segment + per-segment signalAvailability flow through to
 * PipelineResult.geminiResult.
 *
 * Mock pattern: prompt-routed (the wave0 detector + 3 segment helpers all fire
 * concurrently against the SAME mockGeminiGenerate; we route each call to the right
 * fixture by inspecting the prompt content — same approach as gemini-segmented.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StageEvent } from "../events";

// =====================================================
// Mocks — external dependencies (imports transitively chained from pipeline.ts)
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

// DeepSeek client mock
const mockDeepSeekCreate = vi.fn();
vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockDeepSeekCreate } };
  });
  return { default: MockOpenAI };
});

// Gemini SDK mock — single generateContent + files API surface.
const mockGeminiGenerate = vi.fn();
const mockGeminiFileUpload = vi.fn();
const mockGeminiFileGet = vi.fn();
const mockGeminiFileDelete = vi.fn();
vi.mock("@google/genai", () => {
  const MockGoogleGenAI = vi.fn(function (this: Record<string, unknown>) {
    this.models = { generateContent: mockGeminiGenerate };
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
      BOOLEAN: "BOOLEAN",
    },
  };
});

// Calibration JSON fixture loaded from disk by gemini.ts:loadCalibrationData()
vi.mock("node:fs", () => ({
  promises: {
    readFile: vi.fn().mockResolvedValue(
      JSON.stringify({
        primary_kpis: {
          share_rate: {
            viral_threshold: 0.1,
            percentiles: { p50: 0.02, p75: 0.05, p90: 0.1 },
          },
          comment_rate: { percentiles: { p50: 0.01, p75: 0.03, p90: 0.07 } },
          save_rate: { percentiles: { p50: 0.015, p75: 0.04, p90: 0.08 } },
          weighted_engagement_score: { percentiles: { p50: 50, p75: 70, p90: 85 } },
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
            { factor: "hook_strength", difference_pct: 40, description: "Strong hooks boost engagement" },
            { factor: "cta_clarity", difference_pct: 22, description: "Clear CTAs drive shares" },
            { factor: "pacing_density", difference_pct: 18, description: "Dense pacing keeps viewers" },
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

// Supabase service client — table queries + storage download stub.
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
  chain.then = (resolve: (v: unknown) => void) =>
    resolve({ data: [], error: null });
  return chain;
};

const mockStorageDownload = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => mockSupabaseChain()),
    storage: {
      from: vi.fn(() => ({
        download: mockStorageDownload,
        upload: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  })),
}));

// =====================================================
// Env vars BEFORE importing modules under test
// =====================================================

process.env.GEMINI_API_KEY = "test-key";
process.env.DEEPSEEK_API_KEY = "test-key";
process.env.GEMINI_HOOK_MODEL = "gemini-3.1-pro-preview";
process.env.GEMINI_BODY_MODEL = "gemini-3-flash-preview";
process.env.GEMINI_CTA_MODEL = "gemini-3-flash-preview";

// =====================================================
// Imports
// =====================================================

import { runPredictionPipeline } from "../pipeline";
import { resetCircuitBreaker } from "../deepseek";
import { makeGeminiAnalysis, makeDeepSeekReasoning } from "./factories";

// =====================================================
// Fixtures — segment-shaped responses for Gemini SDK
// =====================================================

const VALID_HOOK_FIXTURE = {
  factors: [
    { name: "Scroll-Stop Power", score: 7, rationale: "Strong face-first frame", improvement_tip: "Add motion" },
    { name: "Completion Pull", score: 6, rationale: "Promises payoff", improvement_tip: "Tighten" },
    { name: "Rewatch Potential", score: 5, rationale: "Single watch", improvement_tip: "Add layer" },
    { name: "Share Trigger", score: 5, rationale: "Relatable but not tag-worthy", improvement_tip: "End with question" },
    { name: "Emotional Charge", score: 6, rationale: "Energetic", improvement_tip: "Sharpen mood" },
  ],
  overall_impression: "Solid hook with motion-led visual",
  content_summary: "Beauty tutorial opener",
  hook_decomposition: {
    visual_stop_power: 7.5,
    audio_hook_quality: 6.0,
    text_overlay_score: 4.5,
    first_words_speech_score: 7.0,
    weakest_modality: "text_overlay_score",
    visual_audio_coherence: 7.0,
    cognitive_load: 3.0,
  },
};

const VALID_BODY_FIXTURE = {
  video_signals: {
    visual_production_quality: 7,
    pacing_score: 6,
    transition_quality: 5,
  },
  body_summary: "Body has steady three-beat pacing through the middle.",
};

const VALID_CTA_FIXTURE = {
  cta_present: true,
  strength: 7,
  type: "follow",
  rationale: "Creator says 'follow for more' at 28s",
};

const WAVE0_CT_FIXTURE = { type: "tutorial", confidence: 0.9, mixed: false };

const HOOK_USAGE = { promptTokenCount: 1790, candidatesTokenCount: 800 };
const BODY_USAGE = { promptTokenCount: 6075, candidatesTokenCount: 600 };
const CTA_USAGE = { promptTokenCount: 1074, candidatesTokenCount: 250 };
const WAVE0_USAGE = { promptTokenCount: 500, candidatesTokenCount: 80 };

// =====================================================
// Prompt-routed mock — segments fire concurrently against the SAME mockGeminiGenerate
// (Promise.allSettled fan-out). Route each call by inspecting the prompt content +
// the model name (wave 0 vs segment).
// =====================================================

type Caller = "wave0_ct" | "hook" | "body" | "cta";

// WR-06: Route generateContent calls using HYBRID signals. Use
// videoMetadata.startOffset+endOffset to disambiguate hook (both wave 0 AND
// hook share startOffset="0s"+endOffset="5s", so they're disambiguated by a
// stable wave-0-only prompt anchor instead). Body and CTA are anchored on
// physical-time section markers ("MIDDLE section" / "LAST 3 SECONDS") that
// CANNOT drift without changing which window the prompt actually analyzes.
function detectCaller(call: {
  model?: string;
  contents?: Array<{ parts?: Array<Record<string, unknown>> }>;
}): Caller {
  const parts = call.contents?.[0]?.parts;
  const textPart = parts?.[0] as { text?: string } | undefined;
  const videoPart = parts?.[1] as { videoMetadata?: { startOffset?: string } } | undefined;
  const text = textPart?.text ?? "";
  const startOffset = videoPart?.videoMetadata?.startOffset;
  // Wave 0 detector has a uniquely identifying prompt anchor ("TikTok
  // content-type classifier") — the wave 0 detector and hook both use
  // startOffset="0s" so a structural-only check would mis-route hook to
  // wave 0. The wave 0 system prompt is the most stable disambiguator.
  if (text.includes("TikTok content-type classifier")) return "wave0_ct";
  if (startOffset === "0s") return "hook";
  if (text.includes("MIDDLE section")) return "body";
  if (text.includes("LAST 3 SECONDS")) return "cta";
  // Defensive fallback — anything we can't identify is presumed wave 0.
  return "wave0_ct";
}

function routeGeminiCalls(
  overrides: Partial<Record<Caller, () => Promise<unknown>>> = {},
) {
  mockGeminiGenerate.mockImplementation(async (call: unknown) => {
    const caller = detectCaller(
      call as { model?: string; contents?: Array<{ parts?: Array<{ text?: string }> }> }
    );
    const override = overrides[caller];
    if (override) return override();
    if (caller === "hook") return { text: JSON.stringify(VALID_HOOK_FIXTURE), usageMetadata: HOOK_USAGE };
    if (caller === "body") return { text: JSON.stringify(VALID_BODY_FIXTURE), usageMetadata: BODY_USAGE };
    if (caller === "cta") return { text: JSON.stringify(VALID_CTA_FIXTURE), usageMetadata: CTA_USAGE };
    return { text: JSON.stringify(WAVE0_CT_FIXTURE), usageMetadata: WAVE0_USAGE };
  });
}

function rejectWith(message: string): () => Promise<unknown> {
  return () => Promise.reject(new Error(message));
}

// =====================================================
// Test input scaffolds
// =====================================================

const videoInput = {
  input_mode: "video_upload" as const,
  video_storage_path: "user-1/clip.mp4",
  // WR-08: content_text includes "30s" so normalize.ts:extractDurationHint
  // parses duration_hint=30. The pipeline now refuses to invoke
  // analyzeVideoSegmented with duration_hint=null (would otherwise hallucinate
  // scores against fabricated window math). Tests assume duration is known.
  content_text: "Beauty tutorial GRWM 30s #skincare",
  content_type: "video" as const,
  niche: "beauty",
};

const textInput = {
  input_mode: "text" as const,
  content_text: "What if you could double your engagement? #viral #trending",
  content_type: "video" as const,
};

const tiktokInput = {
  input_mode: "tiktok_url" as const,
  tiktok_url: "https://www.tiktok.com/@creator/video/1234567890",
  content_text: "TikTok URL test",
  content_type: "video" as const,
};

// =====================================================
// Test suite
// =====================================================

describe("Phase 5 Plan 03 — pipeline integration with analyzeVideoSegmented", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCircuitBreaker();

    // Default Gemini routing — all 4 callers (wave 0 + 3 segments) succeed.
    routeGeminiCalls();

    // Default DeepSeek mock — returns valid DeepSeekReasoning.
    mockDeepSeekCreate.mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify(makeDeepSeekReasoning()) } },
      ],
      usage: { prompt_tokens: 1000, completion_tokens: 500 },
    });

    // Files API defaults — upload returns ACTIVE immediately.
    mockGeminiFileUpload.mockResolvedValue({
      name: "files/test-segmented",
      state: "ACTIVE",
      uri: "gs://test-segmented",
    });
    mockGeminiFileGet.mockResolvedValue({
      name: "files/test-segmented",
      state: "ACTIVE",
      uri: "gs://test-segmented",
    });
    mockGeminiFileDelete.mockResolvedValue(undefined);

    // Storage download stub — returns a small Blob.
    mockStorageDownload.mockResolvedValue({
      data: new Blob([new Uint8Array(8)], { type: "video/mp4" }),
      error: null,
    });
  });

  // -------------------------------------------------------
  // Test 1: video_upload → analyzeVideoSegmented (3 segment events, no wrapper)
  // -------------------------------------------------------
  it("Test 1: video_upload routes to analyzeVideoSegmented — 3 segment events fire under wave 1, NO gemini_video_analysis wrapper event", async () => {
    const events: StageEvent[] = [];
    await runPredictionPipeline(videoInput, {
      onStageEvent: (e) => events.push(e),
    });

    const stageStartNames = events
      .filter((e) => e.type === "stage_start")
      .map((e) => (e as { stage: string }).stage);

    expect(stageStartNames).toContain("gemini_hook");
    expect(stageStartNames).toContain("gemini_body");
    expect(stageStartNames).toContain("gemini_cta");
    // D-14: outer wrapper REMOVED.
    expect(stageStartNames).not.toContain("gemini_video_analysis");

    // IN-04: per-segment call-count pin. The segmented orchestrator MUST
    // invoke exactly one hook + one body + one cta generateContent call.
    // Without this assertion, a regression that double-invokes a segment
    // helper would route both calls to the same fixture and the test
    // would silently pass.
    const hookCalls = mockGeminiGenerate.mock.calls.filter(
      (c) => detectCaller(c[0] as { model?: string; contents?: Array<{ parts?: Array<{ text?: string }> }> }) === "hook"
    );
    const bodyCalls = mockGeminiGenerate.mock.calls.filter(
      (c) => detectCaller(c[0] as { model?: string; contents?: Array<{ parts?: Array<{ text?: string }> }> }) === "body"
    );
    const ctaCalls = mockGeminiGenerate.mock.calls.filter(
      (c) => detectCaller(c[0] as { model?: string; contents?: Array<{ parts?: Array<{ text?: string }> }> }) === "cta"
    );
    expect(hookCalls).toHaveLength(1);
    expect(bodyCalls).toHaveLength(1);
    expect(ctaCalls).toHaveLength(1);
  });

  // -------------------------------------------------------
  // Test 2: Exactly 3 segment generateContent calls during video_upload run
  // -------------------------------------------------------
  it("Test 2: mockGeminiGenerate is called exactly 3 times for segments (+1 for wave 0)", async () => {
    await runPredictionPipeline(videoInput);

    // Count distinct callers from the generate mock.
    const callsByCaller: Record<Caller, number> = {
      wave0_ct: 0,
      hook: 0,
      body: 0,
      cta: 0,
    };
    for (const call of mockGeminiGenerate.mock.calls) {
      const caller = detectCaller(
        call[0] as { model?: string; contents?: Array<{ parts?: Array<{ text?: string }> }> }
      );
      callsByCaller[caller]++;
    }

    expect(callsByCaller.hook).toBe(1);
    expect(callsByCaller.body).toBe(1);
    expect(callsByCaller.cta).toBe(1);
    // Wave 0 also runs once for video_upload mode.
    expect(callsByCaller.wave0_ct).toBeGreaterThanOrEqual(1);
  });

  // -------------------------------------------------------
  // Test 3: signalAvailability triple populated when all 3 segments succeed
  // -------------------------------------------------------
  it("Test 3: signalAvailability is { gemini_hook: true, gemini_body: true, gemini_cta: true } on success", async () => {
    const result = await runPredictionPipeline(videoInput);

    expect(result.geminiResult.signalAvailability).toEqual({
      gemini_hook: true,
      gemini_body: true,
      gemini_cta: true,
    });

    // IN-04: per-segment call-count pin on the integration happy path.
    // Pairs with the same pin in Test 1 to give coverage on both the
    // event-emission path and the result-shape path.
    const hookCalls = mockGeminiGenerate.mock.calls.filter(
      (c) => detectCaller(c[0] as { model?: string; contents?: Array<{ parts?: Array<{ text?: string }> }> }) === "hook"
    );
    const bodyCalls = mockGeminiGenerate.mock.calls.filter(
      (c) => detectCaller(c[0] as { model?: string; contents?: Array<{ parts?: Array<{ text?: string }> }> }) === "body"
    );
    const ctaCalls = mockGeminiGenerate.mock.calls.filter(
      (c) => detectCaller(c[0] as { model?: string; contents?: Array<{ parts?: Array<{ text?: string }> }> }) === "cta"
    );
    expect(hookCalls).toHaveLength(1);
    expect(bodyCalls).toHaveLength(1);
    expect(ctaCalls).toHaveLength(1);
  });

  // -------------------------------------------------------
  // Test 4: hook_decomposition populated with the 7-field shape
  // -------------------------------------------------------
  it("Test 4: result.geminiResult.analysis.hook_decomposition has 7-field shape", async () => {
    const result = await runPredictionPipeline(videoInput);

    const hookDecomp = (
      result.geminiResult.analysis as { hook_decomposition?: Record<string, unknown> | null }
    ).hook_decomposition;
    expect(hookDecomp).not.toBeNull();
    expect(hookDecomp).toBeDefined();
    expect(hookDecomp).toMatchObject({
      visual_stop_power: 7.5,
      audio_hook_quality: 6.0,
      text_overlay_score: 4.5,
      first_words_speech_score: 7.0,
      weakest_modality: "text_overlay_score",
      visual_audio_coherence: 7.0,
      cognitive_load: 3.0,
    });
  });

  // -------------------------------------------------------
  // Test 5: cta_segment populated with presence-aware shape
  // -------------------------------------------------------
  it("Test 5: result.geminiResult.analysis.cta_segment is present with presence-aware shape", async () => {
    const result = await runPredictionPipeline(videoInput);

    const ctaSeg = (
      result.geminiResult.analysis as { cta_segment?: Record<string, unknown> | null }
    ).cta_segment;
    expect(ctaSeg).not.toBeNull();
    expect(ctaSeg).toMatchObject({
      cta_present: true,
      strength: 7,
      type: "follow",
    });
    expect((ctaSeg as { rationale: string }).rationale).toMatch(/follow/i);
  });

  // -------------------------------------------------------
  // Test 6: Text mode still calls analyzeWithGemini (segmented path NOT invoked)
  // -------------------------------------------------------
  it("Test 6: text mode invokes legacy gemini_analysis event; signalAvailability undefined", async () => {
    // Text-mode mock — no segment routing needed, but reset to text-shaped response.
    mockGeminiGenerate.mockReset();
    mockGeminiGenerate.mockResolvedValue({
      text: JSON.stringify(makeGeminiAnalysis()),
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 300 },
    });

    const events: StageEvent[] = [];
    const result = await runPredictionPipeline(textInput, {
      onStageEvent: (e) => events.push(e),
    });

    const stageNames = events
      .filter((e) => e.type === "stage_start" || e.type === "stage_end")
      .map((e) => (e as { stage: string }).stage);

    // Text mode emits the legacy single `gemini_analysis` event.
    expect(stageNames).toContain("gemini_analysis");
    // Segmented path NOT taken — no per-segment events.
    expect(stageNames).not.toContain("gemini_hook");
    expect(stageNames).not.toContain("gemini_body");
    expect(stageNames).not.toContain("gemini_cta");

    // signalAvailability is undefined for non-segmented paths.
    expect(result.geminiResult.signalAvailability).toBeUndefined();
  });

  // -------------------------------------------------------
  // Test 7: TikTok-URL mode does NOT trigger segmented either
  // -------------------------------------------------------
  it("Test 7: tiktok_url mode goes through text-path (no segmented events; signalAvailability undefined)", async () => {
    mockGeminiGenerate.mockReset();
    mockGeminiGenerate.mockResolvedValue({
      text: JSON.stringify(makeGeminiAnalysis()),
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 300 },
    });

    const events: StageEvent[] = [];
    const result = await runPredictionPipeline(tiktokInput, {
      onStageEvent: (e) => events.push(e),
    });

    const stageNames = events
      .filter((e) => e.type === "stage_start")
      .map((e) => (e as { stage: string }).stage);

    expect(stageNames).not.toContain("gemini_hook");
    expect(stageNames).not.toContain("gemini_body");
    expect(stageNames).not.toContain("gemini_cta");
    expect(result.geminiResult.signalAvailability).toBeUndefined();
  });

  // -------------------------------------------------------
  // Test 8: Partial failure (body) — signalAvailability.gemini_body=false + warning
  // -------------------------------------------------------
  it("Test 8: body segment failure produces signalAvailability.gemini_body=false + ONE gemini_body pipeline_warning", async () => {
    routeGeminiCalls({ body: rejectWith("body API failure") });

    const events: StageEvent[] = [];
    const result = await runPredictionPipeline(videoInput, {
      onStageEvent: (e) => events.push(e),
    });

    expect(result.geminiResult.signalAvailability).toBeDefined();
    expect(result.geminiResult.signalAvailability!.gemini_body).toBe(false);
    expect(result.geminiResult.signalAvailability!.gemini_hook).toBe(true);
    expect(result.geminiResult.signalAvailability!.gemini_cta).toBe(true);

    const warnings = events
      .filter((e) => e.type === "pipeline_warning")
      .map((e) => (e as { stage?: string }).stage);
    expect(warnings.filter((s) => s === "gemini_body")).toHaveLength(1);
    expect(warnings).not.toContain("gemini_video_unavailable");

    // IN-06: body segment failure is handled via the SSE pipeline_warning event,
    // NOT via the persisted result.warnings array. Per-segment failures emit
    // events only; only the outermost pipeline catch (Files API upload throws,
    // calibration unavailable, etc.) pushes onto result.warnings. This pin
    // asserts that boundary contract so it cannot silently drift.
    //
    // Phase 7 caveat: Wave 3 (10-persona simulation) legitimately pushes its own
    // warnings onto result.warnings (e.g. `wave_3_below_threshold`, persona Zod
    // failures) when DeepSeek is not mocked in this segment-failure integration
    // test. Filter Wave 3 entries before asserting the segment-boundary contract.
    const segmentScopedWarnings = result.warnings.filter(
      (w) =>
        !w.startsWith("wave_3_") &&
        !w.startsWith("Persona ") &&
        !w.includes("PersonaResponseSchema") &&
        !w.includes("invalid_type"),
    );
    expect(segmentScopedWarnings).toEqual([]);
  });

  // -------------------------------------------------------
  // Test 9: All 3 segments fail — gemini_video_unavailable warning + analysis null-filled
  // -------------------------------------------------------
  it("Test 9: all 3 segments failing → pipeline still completes with DEFAULT_GEMINI_RESULT shape + signalAvailability all false + gemini_video_unavailable warning", async () => {
    routeGeminiCalls({
      hook: rejectWith("hook failure"),
      body: rejectWith("body failure"),
      cta: rejectWith("cta failure"),
    });

    const events: StageEvent[] = [];
    const result = await runPredictionPipeline(videoInput, {
      onStageEvent: (e) => events.push(e),
    });

    // Pipeline did NOT throw.
    expect(result).toBeDefined();
    expect(result.geminiResult.signalAvailability).toEqual({
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
    });

    // analysis null-filled into DEFAULT_GEMINI_RESULT structural zeros (5 factors at score 0).
    expect(result.geminiResult.analysis.factors).toHaveLength(5);
    expect(result.geminiResult.analysis.factors.every((f) => f.score === 0)).toBe(true);

    // ONE consolidated gemini_video_unavailable warning fired (D-09).
    const warnings = events
      .filter((e) => e.type === "pipeline_warning")
      .map((e) => (e as { stage?: string }).stage);
    expect(warnings).toContain("gemini_video_unavailable");

    // IN-06: 3-of-3 failure is handled via the SSE gemini_video_unavailable event
    // (asserted above) — the persisted result.warnings array stays empty for
    // segment-scoped warnings. mergeSegments emits the event but does NOT push to
    // the warnings array; only the outermost pipeline catch (Test 10) populates it.
    //
    // Phase 7 caveat: Wave 3 may push its own warnings here (unmocked DeepSeek
    // call against an integration-test pipeline). Filter Wave 3 entries to preserve
    // the segment-boundary contract intent.
    const segmentScopedWarnings = result.warnings.filter(
      (w) =>
        !w.startsWith("wave_3_") &&
        !w.startsWith("Persona ") &&
        !w.includes("PersonaResponseSchema") &&
        !w.includes("invalid_type"),
    );
    expect(segmentScopedWarnings).toEqual([]);
  });

  // -------------------------------------------------------
  // Test 10: Files API upload throws → pipeline catch falls back to DEFAULT_GEMINI_RESULT
  // -------------------------------------------------------
  it("Test 10: Files API upload failure → pipeline.warnings includes 'Gemini analysis unavailable'; falls back to DEFAULT_GEMINI_RESULT", async () => {
    mockGeminiFileUpload.mockRejectedValue(new Error("Upload throttled by Gemini Files API"));

    const result = await runPredictionPipeline(videoInput);

    expect(result.warnings.some((w) => w.includes("Gemini analysis unavailable"))).toBe(true);
    expect(result.geminiResult.analysis.factors).toHaveLength(5);
    expect(result.geminiResult.analysis.factors.every((f) => f.score === 0)).toBe(true);
    // Files API upload threw BEFORE analyzeVideoSegmented could return any flags;
    // pipeline catch routes to DEFAULT_GEMINI_RESULT which does NOT include
    // signalAvailability — so it should be undefined (consistent with the
    // "segmented path produced no provenance" interpretation).
    expect(result.geminiResult.signalAvailability).toBeUndefined();
  });
});
