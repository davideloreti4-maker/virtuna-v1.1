/**
 * Re-host persistence + orphan-cleanup assertions for the tiktok_url Omni branch.
 *
 * Strategy: Option B (Supabase re-host) was chosen per spike §8 for security
 * (token non-leakage to DashScope). reading-ux S1 (2026-06-15, Option A) UPDATED the
 * derive-and-drop policy: a tiktok_url re-host is now KEPT on success when an owner
 * `userId` is supplied (the retention scrubber needs a playable source on permalink
 * reload). Only orphans are dropped. Tests assert:
 *
 *   1. KEEP-ON-SUCCESS (with userId): the re-host lands at an owner-prefixed, signable
 *      path (`${userId}/tiktok-...`), the pipeline surfaces it via
 *      PipelineResult.video_storage_path, and storage.remove is NOT called (object kept).
 *
 *   2. ORPHAN-DROP (no userId): without an owner id the legacy remix-temp path is used,
 *      persistedVideoPath stays null, and storage.remove IS called (derive-and-drop) so
 *      no non-owned, non-signable object lingers. video_storage_path is null.
 *
 *   3. RE-HOST → SURFACE cycle (with userId): storage.upload is called at the
 *      owner-prefixed path AND that exact path is returned as video_storage_path (the
 *      route persists it). storage.remove is NOT called on this success path.
 *
 * Tests here exercise the pipeline layer directly (not the route handler), using the
 * same mock patterns as pipeline.test.ts and tiktok-url-branch.test.ts.
 */

// =====================================================
// Mocks — before imports
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
  nanoid: vi.fn(() => "dd-test-req"),
}));

vi.mock("@/lib/cache", () => ({
  createCache: () => ({
    get: vi.fn(() => null),
    set: vi.fn(),
    invalidate: vi.fn(),
    clear: vi.fn(),
  }),
}));

const mockDeepSeekCreate = vi.fn();
vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockDeepSeekCreate } };
  });
  return { default: MockOpenAI };
});

vi.mock("@google/genai", () => {
  const MockGoogleGenAI = vi.fn(function (this: Record<string, unknown>) {
    this.models = { generateContent: vi.fn() };
    this.files = { upload: vi.fn(), get: vi.fn(), delete: vi.fn() };
  });
  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: {
      OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING",
      NUMBER: "NUMBER", BOOLEAN: "BOOLEAN",
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
          comment_rate: { percentiles: { p50: 0.01, p75: 0.03, p90: 0.07 } },
          save_rate: { percentiles: { p50: 0.015, p75: 0.04, p90: 0.08 } },
          weighted_engagement_score: {
            percentiles: { p50: 50, p75: 70, p90: 85 },
          },
        },
        virality_tiers: [
          {
            tier: 1, label: "Low", score_range: [0, 20],
            median_share_rate: 0.01, median_comment_rate: 0.005, median_save_rate: 0.008,
          },
        ],
        viral_vs_average: {
          differentiators: [
            { factor: "hook_strength", difference_pct: 40, description: "Strong hooks" },
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

const { mockRunPlatformFit } = vi.hoisted(() => ({
  mockRunPlatformFit: vi.fn(async () => [
    { platform: "tiktok", fit_score: 70, rationale: "OK" },
  ]),
}));
vi.mock("@/lib/engine/wave4/platform-fit", () => ({
  runPlatformFit: mockRunPlatformFit,
}));

vi.mock("@/lib/engine/filmstrip/queue", () => ({
  triggerFilmstripGeneration: vi.fn(),
}));

// =====================================================
// Supabase spies — shared across tests
// =====================================================

const mockStorageUpload = vi.fn().mockResolvedValue({ error: null });
const mockStorageRemove = vi.fn().mockResolvedValue({ error: null });
const mockCreateSignedUrl = vi.fn().mockResolvedValue({
  data: { signedUrl: "https://supabase.test/signed/dd-rehost.mp4" },
  error: null,
});

const mockSupabaseChain = () => {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select", "eq", "is", "not", "gte", "gt", "or",
    "order", "limit", "maybeSingle", "single",
  ];
  for (const m of methods) chain[m] = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
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
// ApifyScrapingProvider mock (mutable-state pattern)
// =====================================================

const mockResolveState = {
  shouldReject: false,
  rejectError: null as unknown,
  resolvedVideo: {
    mp4Url: "https://api.apify.com/v2/key-value-stores/store123/records/video-dd.mp4",
    durationSeconds: 17,
  },
};

vi.mock("@/lib/scraping/apify-provider", () => ({
  ApifyScrapingProvider: vi.fn(function (this: Record<string, unknown>) {
    this.resolveVideoUrl = async (_url: string) => {
      if (mockResolveState.shouldReject) throw mockResolveState.rejectError;
      return mockResolveState.resolvedVideo;
    };
    this.scrapeProfile = vi.fn();
    this.scrapeVideos = vi.fn();
  }),
}));

// =====================================================
// Env vars + global fetch mock
// =====================================================

process.env.GEMINI_API_KEY = "test-key";
process.env.DEEPSEEK_API_KEY = "test-key";
process.env.DASHSCOPE_API_KEY = "test-key";
process.env.APIFY_TOKEN = "test-apify-token";

const mockFetchResponse = {
  ok: true,
  status: 200,
  arrayBuffer: async () => new ArrayBuffer(1024),
};
const mockFetch = vi.fn().mockResolvedValue(mockFetchResponse);
global.fetch = mockFetch as unknown as typeof fetch;

// =====================================================
// Imports (after mocks)
// =====================================================

import { runPredictionPipeline } from "@/lib/engine/pipeline";

// =====================================================
// Helpers
// =====================================================

function makeOmniBody() {
  return JSON.stringify({
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
    overall_impression: "Funny",
    content_summary: "Comedy short",
    hook_visual_impact: 9,
    hook_decomposition: {
      visual_stop_power: 9, audio_hook_quality: 10, text_overlay_score: 9,
      first_words_speech_score: 10, weakest_modality: "text_overlay_score",
      visual_audio_coherence: 10, cognitive_load: 2,
      watermark_detected: { tiktok: false, ig: false, yt: false },
    },
    video_signals: {
      visual_production_quality: 8, pacing_score: 9, transition_quality: 7,
    },
    cta_segment: { cta_present: false, strength: null, type: null, rationale: "no CTA" },
    audio_signals: {
      voice_clarity_0_10: 8, audio_hook_first_2s_0_10: 9,
      silence_ratio: 0.05, voiceover_ratio: 0.6, music_ratio: 0.35,
      audio_description: "Comedy audio",
    },
    audio_perceptual_score: 85,
  });
}

// =====================================================
// Tests
// =====================================================

const tiktokInput = {
  input_mode: "tiktok_url" as const,
  tiktok_url: "https://www.tiktok.com/@isi_comedy1/video/7645695501630737697",
  content_type: "video" as const,
  mode: "score" as const,
};

describe("Derive-and-drop assertions (Plan 03 INGEST-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveState.shouldReject = false;
    mockResolveState.rejectError = null;
    mockStorageUpload.mockResolvedValue({ error: null });
    mockStorageRemove.mockResolvedValue({ error: null });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://supabase.test/signed/dd-rehost.mp4" },
      error: null,
    });
    mockFetch.mockResolvedValue(mockFetchResponse);

    mockDeepSeekCreate.mockImplementation(
      (args: { model?: string; messages: Array<{ role: string; content: unknown }> }) => {
        const sys = args.messages.find((m) => m.role === "system");
        const sysText = typeof sys?.content === "string" ? sys.content : "";
        const isOmni = sysText.includes("expert TikTok content analyst");
        const isPersona = sysText.includes("TikTok For You Page viewer");
        if (isOmni) {
          return Promise.resolve({
            choices: [{ message: { content: makeOmniBody() } }],
            usage: { prompt_tokens: 1500, completion_tokens: 800 },
          });
        }
        if (isPersona) {
          return Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    scroll_past_second: 5, watch_through_pct: 70,
                    comment_intent: 20, share_intent: 30,
                    save_intent: 40, rewatch_intent: 25, reasoning: "ok",
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 200, completion_tokens: 100 },
          });
        }
        return Promise.resolve({
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
                  overall_impression: "OK",
                  content_summary: "Text summary",
                }),
              },
            },
          ],
          usage: { prompt_tokens: 500, completion_tokens: 200 },
        });
      },
    );
  });

  /**
   * Assertion 1 (reading-ux S1 — keep-on-success):
   * With an owner userId, a successful tiktok_url re-host is KEPT and surfaced via
   * PipelineResult.video_storage_path at an owner-prefixed (signable) path. The temp
   * object is NOT removed — the route persists the path so the scrubber replays on reload.
   */
  it("DD-01: tiktok_url + userId surfaces an owner-prefixed video_storage_path and keeps the object", async () => {
    const result = await runPredictionPipeline(tiktokInput, { userId: "user-dd" });

    // Pipeline completes successfully (real Omni signal, not null text branch)
    expect(result).not.toBeNull();
    expect(result.geminiResult.analysis.video_signals).not.toBeNull();
    // Surfaced path is owner-prefixed (so /api/videos/sign's owner check passes) and signable
    expect(result.video_storage_path).toBe("user-dd/tiktok-dd-test-req.mp4");
    // KEEP-ON-SUCCESS: the re-host object is NOT dropped
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  /**
   * Assertion 2 (reading-ux S1 — orphan drop):
   * Without an owner userId the legacy remix-temp path is used and the object is dropped
   * (derive-and-drop) — it is not owner-signable, so nothing should reference it. The
   * pipeline surfaces a null video_storage_path. This is the back-compat / safety path.
   */
  it("DD-02: tiktok_url without userId drops the legacy remix-temp object (orphan cleanup)", async () => {
    const result = await runPredictionPipeline(tiktokInput);

    // No owner → nothing persistable
    expect(result.video_storage_path).toBeNull();
    // Exactly one remove call, targeting the remix-temp object (not any owned path)
    expect(mockStorageRemove).toHaveBeenCalledTimes(1);
    const [paths] = mockStorageRemove.mock.calls[0] as [string[]];
    expect(paths.length).toBe(1);
    expect(paths[0]).toContain("remix-temp");
  });

  /**
   * Assertion 3 (reading-ux S1 — re-host → surface cycle):
   * With a userId, storage.upload re-hosts the mp4 at the owner-prefixed path AND that exact
   * path is returned as video_storage_path. storage.remove is NOT called (success keep).
   */
  it("DD-03: re-host upload path with userId is surfaced as video_storage_path and kept", async () => {
    const result = await runPredictionPipeline(tiktokInput, { userId: "user-dd" });

    // Upload happened at the owner-prefixed path
    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    const [uploadPath,, uploadOpts] = mockStorageUpload.mock.calls[0] as [string, unknown, { contentType: string }];
    expect(uploadPath).toBe("user-dd/tiktok-dd-test-req.mp4");
    expect(uploadOpts.contentType).toBe("video/mp4");

    // The uploaded path is exactly what the pipeline surfaces — the route persists it
    expect(result.video_storage_path).toBe(uploadPath);
    // Not dropped on the success path
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  /**
   * Assertion 4 (reading-ux S1 — failure still cleans up):
   * If the re-host signed-URL step fails AFTER upload (with a userId), persistedVideoPath
   * never gets set, so video_storage_path is null and the orphaned upload is dropped.
   */
  it("DD-04: re-host signed-URL failure with userId drops the orphan and surfaces null", async () => {
    mockCreateSignedUrl.mockResolvedValueOnce({ data: null, error: { message: "sign failed" } });
    const result = await runPredictionPipeline(tiktokInput, { userId: "user-dd" });

    // Re-host did not fully succeed → nothing surfaced
    expect(result.video_storage_path).toBeNull();
    // The orphaned upload (owner-prefixed path) is cleaned up
    expect(mockStorageRemove).toHaveBeenCalledTimes(1);
    const [paths] = mockStorageRemove.mock.calls[0] as [string[]];
    expect(paths[0]).toBe("user-dd/tiktok-dd-test-req.mp4");
  });
});
