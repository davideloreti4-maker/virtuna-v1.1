/**
 * TDD RED tests for Plan 03 — tiktok_url Omni branch + derive-and-drop.
 *
 * Asserts:
 *   1. tiktok_url input resolves via resolveVideoUrl, re-hosts to Supabase,
 *      then runs analyzeVideoWithOmni so precomputedGeminiResult has real video_signals.
 *   2. IngestError from resolveVideoUrl degrades gracefully (warning added, no crash).
 *   3. Re-host temp object is deleted in finally (via storage.remove), independent of
 *      storage_retention_opted_in.
 *
 * These tests FAIL before the implementation is added to pipeline.ts — that is the
 * intended RED state. They will turn green in the GREEN phase.
 */

// =====================================================
// Mocks — must appear BEFORE imports
// =====================================================

import { vi, describe, it, expect, beforeEach } from "vitest";

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
  nanoid: vi.fn(() => "tiktok-test-req"),
}));

vi.mock("@/lib/cache", () => ({
  createCache: () => ({
    get: vi.fn(() => null),
    set: vi.fn(),
    invalidate: vi.fn(),
    clear: vi.fn(),
  }),
}));

// DeepSeek / Qwen text-mode mock
const mockDeepSeekCreate = vi.fn();
vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockDeepSeekCreate } };
  });
  return { default: MockOpenAI };
});

// Gemini (unused in tiktok_url path but must not throw)
vi.mock("@google/genai", () => {
  const MockGoogleGenAI = vi.fn(function (this: Record<string, unknown>) {
    this.models = { generateContent: vi.fn() };
    this.files = {
      upload: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
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

// node:fs (calibration data)
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
      }),
    ),
  },
  readFileSync: vi.fn(() =>
    JSON.stringify({
      featureNames: Array.from({ length: 15 }, (_, i) => `feature_${i}`),
      trainSet: { features: [], labels: [] },
      testSet: { features: [], labels: [] },
    }),
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

// Platform-fit stub
const { mockRunPlatformFit } = vi.hoisted(() => ({
  mockRunPlatformFit: vi.fn(async () => [
    { platform: "tiktok", fit_score: 70, rationale: "OK" },
  ]),
}));
vi.mock("@/lib/engine/wave4/platform-fit", () => ({
  runPlatformFit: mockRunPlatformFit,
}));

// Filmstrip stub
vi.mock("@/lib/engine/filmstrip/queue", () => ({
  triggerFilmstripGeneration: vi.fn(),
}));

// =====================================================
// Supabase service mock — with spies for storage ops
// =====================================================

const mockStorageUpload = vi.fn().mockResolvedValue({ error: null });
const mockStorageRemove = vi.fn().mockResolvedValue({ error: null });
const mockCreateSignedUrl = vi.fn().mockResolvedValue({
  data: { signedUrl: "https://supabase.test/signed/remix-temp.mp4" },
  error: null,
});

const mockSupabaseChain = () => {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select", "eq", "is", "not", "gte", "gt", "or", "order", "limit",
    "maybeSingle", "single",
  ];
  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => void) =>
    resolve({ data: [], error: null });
  return chain;
};

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => mockSupabaseChain()),
    storage: {
      from: vi.fn(() => ({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
        createSignedUrl: mockCreateSignedUrl,
      })),
    },
  })),
}));

// =====================================================
// ApifyScrapingProvider mock — mutable-state pattern
// (avoids vi.mock hoisting issues; same approach as Plan 02 resolver tests)
// =====================================================

const mockResolveState = {
  shouldReject: false,
  rejectError: null as unknown,
  resolvedVideo: {
    mp4Url: "https://api.apify.com/v2/key-value-stores/store123/records/video-test.mp4",
    durationSeconds: 17,
  },
};

vi.mock("@/lib/scraping/apify-provider", () => ({
  ApifyScrapingProvider: vi.fn(function (this: Record<string, unknown>) {
    this.resolveVideoUrl = async (_url: string) => {
      if (mockResolveState.shouldReject) throw mockResolveState.rejectError;
      return mockResolveState.resolvedVideo;
    };
    // stub other methods to avoid errors if called
    this.scrapeProfile = vi.fn();
    this.scrapeVideos = vi.fn();
  }),
}));

// =====================================================
// Env vars
// =====================================================
process.env.GEMINI_API_KEY = "test-key";
process.env.DEEPSEEK_API_KEY = "test-key";
process.env.DASHSCOPE_API_KEY = "test-key";
process.env.APIFY_TOKEN = "test-apify-token";

// =====================================================
// Global fetch mock — pipeline calls fetch() to download the mp4.
// Must be set BEFORE the import of runPredictionPipeline.
// =====================================================

const mockFetchResponse = {
  ok: true,
  status: 200,
  arrayBuffer: async () => new ArrayBuffer(1024), // ~1KB stub; real is ~7MB
};

const mockFetch = vi.fn().mockResolvedValue(mockFetchResponse);
global.fetch = mockFetch as unknown as typeof fetch;

// =====================================================
// Imports (after mocks)
// =====================================================

import { runPredictionPipeline } from "../pipeline";
import { IngestError } from "@/lib/scraping/types";

// =====================================================
// Helpers
// =====================================================

function makeOmniResponse(overrides: Record<string, unknown> = {}) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            content_type: "comedy",
            niche_primary_slug: "comedy",
            niche_micro_slug: null,
            factors: [
              { name: "Scroll-Stop Power", score: 9, rationale: "x", improvement_tip: "y" },
              { name: "Completion Pull", score: 8, rationale: "x", improvement_tip: "y" },
              { name: "Rewatch Potential", score: 7, rationale: "x", improvement_tip: "y" },
              { name: "Share Trigger", score: 8, rationale: "x", improvement_tip: "y" },
              { name: "Emotional Charge", score: 9, rationale: "x", improvement_tip: "y" },
            ],
            overall_impression: "Funny short",
            content_summary: "Mr Bean impersonation in driveway",
            hook_visual_impact: 9,
            hook_decomposition: {
              visual_stop_power: 9,
              audio_hook_quality: 10,
              text_overlay_score: 9,
              first_words_speech_score: 10,
              weakest_modality: "text_overlay_score",
              visual_audio_coherence: 10,
              cognitive_load: 2,
              watermark_detected: { tiktok: false, ig: false, yt: false },
            },
            video_signals: {
              visual_production_quality: 8,
              pacing_score: 9,
              transition_quality: 7,
            },
            cta_segment: {
              cta_present: false,
              strength: null,
              type: null,
              rationale: "no CTA",
            },
            audio_signals: {
              voice_clarity_0_10: 8,
              audio_hook_first_2s_0_10: 9,
              silence_ratio: 0.05,
              voiceover_ratio: 0.6,
              music_ratio: 0.35,
              audio_description: "Light comedy audio with spoken lines",
            },
            audio_perceptual_score: 85,
            ...overrides,
          }),
        },
      },
    ],
    usage: { prompt_tokens: 1500, completion_tokens: 800 },
  };
}

function makeTextResponse() {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            factors: [
              { name: "Scroll-Stop Power", score: 7, rationale: "x", improvement_tip: "y" },
              { name: "Completion Pull", score: 6, rationale: "x", improvement_tip: "y" },
              { name: "Rewatch Potential", score: 5, rationale: "x", improvement_tip: "y" },
              { name: "Share Trigger", score: 6, rationale: "x", improvement_tip: "y" },
              { name: "Emotional Charge", score: 7, rationale: "x", improvement_tip: "y" },
            ],
            overall_impression: "Good text",
            content_summary: "Text-mode summary",
          }),
        },
      },
    ],
    usage: { prompt_tokens: 500, completion_tokens: 200 },
  };
}

// =====================================================
// Test suite
// =====================================================

const tiktokInput = {
  input_mode: "tiktok_url" as const,
  tiktok_url: "https://www.tiktok.com/@isi_comedy1/video/7645695501630737697",
  content_type: "video" as const,
  mode: "score" as const,
};

describe("Plan 03 — tiktok_url Omni branch (RED gate)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveState.shouldReject = false;
    mockResolveState.rejectError = null;
    mockStorageUpload.mockResolvedValue({ error: null });
    mockStorageRemove.mockResolvedValue({ error: null });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://supabase.test/signed/remix-temp.mp4" },
      error: null,
    });
    // Reset fetch mock to OK for every test
    mockFetch.mockResolvedValue(mockFetchResponse);

    // Route all OpenAI-compat calls through a dispatcher:
    // Omni calls have "expert TikTok content analyst" in system prompt.
    mockDeepSeekCreate.mockImplementation(
      (args: { model?: string; messages: Array<{ role: string; content: unknown }> }) => {
        const sys = args.messages.find((m) => m.role === "system");
        const sysText = typeof sys?.content === "string" ? sys.content : "";
        const isOmni = sysText.includes("expert TikTok content analyst");
        const isPersona = sysText.includes("TikTok For You Page viewer");
        if (isOmni) return Promise.resolve(makeOmniResponse());
        if (isPersona) {
          return Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    scroll_past_second: 5,
                    watch_through_pct: 70,
                    comment_intent: 20,
                    share_intent: 30,
                    save_intent: 40,
                    rewatch_intent: 25,
                    reasoning: "test",
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 200, completion_tokens: 100 },
          });
        }
        return Promise.resolve(makeTextResponse());
      },
    );
  });

  it("RED-01: tiktok_url resolves via resolveVideoUrl and Omni returns non-null video_signals", async () => {
    const result = await runPredictionPipeline(tiktokInput);

    // The pipeline must reach analyzeVideoWithOmni for tiktok_url
    // → geminiResult.analysis.video_signals must be non-null (real signal, not text branch)
    expect(result.geminiResult.analysis.video_signals).not.toBeNull();
    expect(result.geminiResult.analysis.video_signals).toBeDefined();
  });

  it("RED-02: resolveVideoUrl IngestError degrades gracefully (warning added, pipeline does NOT crash)", async () => {
    mockResolveState.shouldReject = true;
    mockResolveState.rejectError = new IngestError("not_found", tiktokInput.tiktok_url);

    const result = await runPredictionPipeline(tiktokInput);

    // Pipeline must complete (no throw)
    expect(result).not.toBeNull();
    expect(result.requestId).toBe("tiktok-test-req");

    // A warning must be recorded describing the resolver failure
    const hasResolverWarning = result.warnings.some(
      (w) => w.toLowerCase().includes("ingest") || w.toLowerCase().includes("resolve") || w.toLowerCase().includes("tiktok"),
    );
    expect(hasResolverWarning).toBe(true);
  });

  it("RED-03: re-host temp object is deleted in finally after successful Omni run", async () => {
    await runPredictionPipeline(tiktokInput);

    // The re-host path must call storage.remove to clean up the temp object
    expect(mockStorageRemove).toHaveBeenCalledTimes(1);
    const [removedPaths] = mockStorageRemove.mock.calls[0] as [string[]];
    // The removed path must be the temp path (contains "remix-temp")
    expect(removedPaths.length).toBe(1);
    expect(removedPaths[0]).toContain("remix-temp");
  });
});
