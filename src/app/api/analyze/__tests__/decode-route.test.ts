/**
 * Phase 03 Plan 02 — Decode route branch tests.
 *
 * Covers all C2/m3/C4 behaviors:
 *   C2: remix branch NEVER calls runPredictionPipeline, NEVER upserts usage_tracking
 *   m3: placeholder row has overall_score:null + mode:'remix'; complete event carries same
 *   C4: resolveAndRehost cleanup() runs unconditionally; video_storage_path never written
 *   T-03-04: persistDecodeToVariants read-merge-write preserves sibling craft + filmstrip_segments
 *   T-03-05: DAILY_LIMITS 429 guard still fires on remix mode
 *   DD-04: cleanup() invoked even when runDecode returns null
 *   DD-05: INSERT never sets video_storage_path on decode rows
 *
 * Mocking pattern: vi.hoisted() for variables used inside vi.mock factories.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// =====================================================
// Hoisted variables — safe inside vi.mock factories
// =====================================================

const {
  mockGetUser,
  mockInsert,
  mockVariantsUpdate,
  mockUsageTrackingUpsert,
  mockResolveAndRehost,
  mockAnalyzeVideoWithOmni,
  mockRunDecode,
  mockVariantsStateHolder,
} = vi.hoisted(() => {
  const mockInsert = vi.fn(async (_data?: unknown) => ({ error: null }));
  const mockVariantsUpdate = vi.fn(async (_data?: unknown) => ({ error: null }));
  const mockUsageTrackingUpsert = vi.fn(async () => ({ error: null }));
  const mockGetUser = vi.fn();
  const mockResolveAndRehost = vi.fn();
  const mockAnalyzeVideoWithOmni = vi.fn();
  const mockRunDecode = vi.fn();
  // Holder for mutable variants state — object so factory closure can read it
  const mockVariantsStateHolder = {
    existing: { craft: { video_signals: { pacing_score: 8 } }, filmstrip_segments: [{ idx: 0 }] } as Record<string, unknown>,
  };
  return {
    mockGetUser,
    mockInsert,
    mockVariantsUpdate,
    mockUsageTrackingUpsert,
    mockResolveAndRehost,
    mockAnalyzeVideoWithOmni,
    mockRunDecode,
    mockVariantsStateHolder,
  };
});

// =====================================================
// Mock engine deps — before importing route
// =====================================================

vi.mock("@/lib/engine/pipeline", () => ({
  runPredictionPipeline: vi.fn(),
}));

vi.mock("@/lib/engine/aggregator", () => ({
  aggregateScores: vi.fn(),
}));

vi.mock("@/lib/engine/cache/prediction-cache", () => ({
  computeContentHash: vi.fn(() => "hash-remix-abc"),
  lookupPredictionCache: vi.fn(() => null),
  populatePredictionCache: vi.fn(),
}));

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
  nanoid: vi.fn(() => "remix-analysis-id"),
}));

// =====================================================
// Mock decode-specific engine deps
// =====================================================

vi.mock("@/lib/engine/remix/resolve-and-rehost", () => ({
  resolveAndRehost: mockResolveAndRehost,
}));

vi.mock("@/lib/engine/qwen/omni-analysis", () => ({
  analyzeVideoWithOmni: mockAnalyzeVideoWithOmni,
}));

// Keep the REAL omniOutputToStructuralInput so this route test exercises the
// omni→structural mapping wiring (the cast-bug regression); only runDecode is mocked.
vi.mock("@/lib/engine/remix/decode", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/engine/remix/decode")>()),
  runDecode: mockRunDecode,
}));

// =====================================================
// Build usage_tracking chain: .select().eq().eq().eq().single()
// =====================================================

function makeUsageTrackingChain(count = 0) {
  const single = vi.fn(async () => ({ data: { analysis_count: count }, error: null }));
  const eq3 = vi.fn(() => ({ single }));
  const eq2 = vi.fn(() => ({ eq: eq3 }));
  const eq1 = vi.fn(() => ({ eq: eq2 }));
  const select = vi.fn(() => ({ eq: eq1 }));
  return { select, upsert: mockUsageTrackingUpsert };
}

// =====================================================
// Mock Supabase auth client
// =====================================================

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === "user_subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn(async () => ({ data: { virtuna_tier: "pro" }, error: null })),
        };
      }
      if (table === "creator_profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => ({ data: { storage_retention_opted_in: false }, error: null })),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(async () => ({ data: { virtuna_tier: "pro" }, error: null })),
      };
    }),
  })),
}));

// =====================================================
// Mock Supabase service client
// =====================================================

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "usage_tracking") {
        return makeUsageTrackingChain(0);
      }
      if (table === "analysis_results") {
        return {
          insert: mockInsert,
          update: vi.fn((data: Record<string, unknown>) => {
            // Variants update (persistDecodeToVariants) — capture it
            if ("variants" in data) {
              void mockVariantsUpdate(data);
              return { eq: vi.fn(async () => ({ error: null })) };
            }
            // Score-path safety-net update (has mode/overall_score keys)
            return {
              eq: vi.fn(() => ({
                eq: vi.fn(async () => ({ error: null })),
              })),
            };
          }),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: { variants: mockVariantsStateHolder.existing },
                error: null,
              })),
            })),
          })),
          upsert: vi.fn(async () => ({ error: null })),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(async () => ({ data: null, error: null })),
        upsert: vi.fn(async () => ({ error: null })),
      };
    }),
    storage: {
      from: vi.fn(() => ({
        remove: vi.fn(async () => ({ error: null })),
      })),
    },
    rpc: vi.fn(async () => ({ error: null })),
  })),
}));

// =====================================================
// Imports (after mocks)
// =====================================================

import { POST } from "../route";
import { runPredictionPipeline } from "@/lib/engine/pipeline";

// =====================================================
// Helpers
// =====================================================

const VALID_REMIX_BODY = {
  input_mode: "tiktok_url" as const,
  tiktok_url: "https://www.tiktok.com/@test_user/video/1234567890123456789",
  content_type: "video" as const,
  mode: "remix" as const,
};

const fakeDecodeResult = {
  beats: [
    { id: "hook_pattern", body: "Strong visual hook in first 2s", verdict: "present" },
    { id: "structure_pacing", body: "Tight 3s cuts maintain momentum", verdict: "present" },
    { id: "the_turn", body: "No narrative pivot detected", verdict: "absent" },
    { id: "emotional_beat", body: "Consistent joy arc throughout", verdict: "present" },
  ],
  repeatable: ["Visual hook with text overlay", "3-beat structure"],
  luck: [{ category: "algorithmic_outlier", note: "Unusual distribution spike" }],
};

const fakeOmniOutput = {
  // Structural fields live under geminiResult.analysis.* (omni assembly shape).
  // hook_decomposition + factors + video_signals are REQUIRED for
  // omniOutputToStructuralInput to return non-null (else runDecode is skipped).
  geminiResult: {
    analysis: {
      factors: [{ name: "Scroll-Stop Power", score: 8, rationale: "Strong open" }],
      overall_impression: "Punchy comedic hook.",
      content_summary: "Creator lands a quick visual gag up front.",
      video_signals: {
        visual_production_quality: 8,
        hook_visual_impact: 9,
        pacing_score: 9,
        transition_quality: 7,
      },
      hook_decomposition: {
        visual_stop_power: 9,
        audio_hook_quality: 8,
        text_overlay_score: 7,
        first_words_speech_score: 9,
        weakest_modality: "text_overlay_score",
        visual_audio_coherence: 8,
        cognitive_load: 3,
        watermark_detected: { tiktok: false, ig: false, yt: false },
      },
    },
    cost_cents: 0.5,
  },
  wave0Result: {
    content_type: { type: "comedy", confidence: 1 },
    niche: { primary_slug: "comedy", micro_slug: null, confidence: 1 },
  },
  audio_perceptual_score: 85,
  signalAvailability: { gemini_hook: true, gemini_body: true, gemini_cta: false },
  segments: [{ t_start: 0, t_end: 3, visual_event: "gag", audio_event: "punchline", is_hook_zone: true }],
};

function makeRemixRequest(body = VALID_REMIX_BODY) {
  return new Request("https://example.com/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readSSE(res: Response): Promise<Record<string, unknown>[]> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  let done = false;
  while (!done) {
    const r = await reader.read();
    if (r.value) raw += decoder.decode(r.value);
    done = r.done;
  }
  const frames: Record<string, unknown>[] = [];
  const blocks = raw.split("\n\n").filter(Boolean);
  for (const block of blocks) {
    const lines = block.split("\n");
    const eventLine = lines.find((l) => l.startsWith("event: "));
    const dataLine = lines.find((l) => l.startsWith("data: "));
    if (eventLine && dataLine) {
      const event = eventLine.replace("event: ", "");
      try {
        const data = JSON.parse(dataLine.replace("data: ", "")) as unknown;
        frames.push({ event, data });
      } catch {
        frames.push({ event, data: dataLine.replace("data: ", "") });
      }
    }
  }
  return frames;
}

// =====================================================
// Setup
// =====================================================

beforeEach(() => {
  vi.clearAllMocks();

  mockGetUser.mockResolvedValue({
    data: { user: { id: "user-remix-1" } },
    error: null,
  });

  // Reset variants state
  mockVariantsStateHolder.existing = {
    craft: { video_signals: { pacing_score: 8 } },
    filmstrip_segments: [{ idx: 0 }],
  };

  mockInsert.mockResolvedValue({ error: null });

  const mockCleanup = vi.fn(async () => { /* no-op */ });
  mockResolveAndRehost.mockResolvedValue({
    signedUrl: "https://supabase.test/signed/remix-video.mp4",
    cleanup: mockCleanup,
  });

  mockAnalyzeVideoWithOmni.mockResolvedValue(fakeOmniOutput);
  mockRunDecode.mockResolvedValue(fakeDecodeResult);
});

// =====================================================
// C2: runPredictionPipeline is NEVER called on remix path
// =====================================================

describe("C2: remix branch does not call runPredictionPipeline", () => {
  it("remix POST never invokes runPredictionPipeline", async () => {
    const req = makeRemixRequest();
    const res = await POST(req);
    await readSSE(res);
    expect(runPredictionPipeline).not.toHaveBeenCalled();
  });
});

// =====================================================
// C2: usage_tracking upsert is NEVER called on remix path
// =====================================================

describe("C2: remix branch does not increment usage_tracking", () => {
  it("remix POST never calls usage_tracking upsert", async () => {
    const req = makeRemixRequest();
    const res = await POST(req);
    await readSSE(res);
    expect(mockUsageTrackingUpsert).not.toHaveBeenCalled();
  });
});

// =====================================================
// T-03-04: read-merge-write preserves sibling craft + filmstrip_segments
// =====================================================

describe("T-03-04: persistDecodeToVariants read-merge-write", () => {
  it("update payload preserves existing craft and filmstrip_segments", async () => {
    const req = makeRemixRequest();
    const res = await POST(req);
    await readSSE(res);

    expect(mockVariantsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        variants: expect.objectContaining({
          craft: expect.objectContaining({ video_signals: expect.any(Object) }),
          filmstrip_segments: expect.arrayContaining([expect.any(Object)]),
          remix: expect.objectContaining({
            decode: fakeDecodeResult,
          }),
        }),
      })
    );
  });
});

// =====================================================
// m3: placeholder INSERT has overall_score:null + mode:'remix'
// =====================================================

describe("m3: remix row has overall_score:null and mode:'remix'", () => {
  it("INSERT placeholder has overall_score: null", async () => {
    const req = makeRemixRequest();
    const res = await POST(req);
    await readSSE(res);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        overall_score: null,
        mode: "remix",
      })
    );
  });

  it("INSERT placeholder does NOT set video_storage_path (C4 derive-and-drop)", async () => {
    const req = makeRemixRequest();
    const res = await POST(req);
    await readSSE(res);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.not.objectContaining({
        video_storage_path: expect.anything(),
      })
    );
  });
});

// =====================================================
// m3 + complete event: SSE complete carries variants.remix.decode + overall_score:null
// =====================================================

describe("m3: SSE complete event carries variants.remix.decode + overall_score:null", () => {
  it("complete event payload has overall_score: null", async () => {
    const req = makeRemixRequest();
    const res = await POST(req);
    const frames = await readSSE(res);

    const completeFrame = frames.find((f) => f.event === "complete");
    expect(completeFrame).toBeDefined();
    const data = completeFrame!.data as Record<string, unknown>;
    expect(data.overall_score).toBeNull();
  });

  it("complete event payload carries variants.remix.decode", async () => {
    const req = makeRemixRequest();
    const res = await POST(req);
    const frames = await readSSE(res);

    const completeFrame = frames.find((f) => f.event === "complete");
    expect(completeFrame).toBeDefined();
    const data = completeFrame!.data as Record<string, unknown>;
    const variants = data.variants as Record<string, unknown>;
    const remix = variants?.remix as Record<string, unknown>;
    expect(remix?.decode).toEqual(fakeDecodeResult);
  });

  it("complete event has mode: 'remix'", async () => {
    const req = makeRemixRequest();
    const res = await POST(req);
    const frames = await readSSE(res);

    const completeFrame = frames.find((f) => f.event === "complete");
    expect(completeFrame).toBeDefined();
    const data = completeFrame!.data as Record<string, unknown>;
    expect(data.mode).toBe("remix");
  });
});

// =====================================================
// T-03-05: DAILY_LIMITS 429 guard still fires on remix bodies
// =====================================================

describe("T-03-05: DAILY_LIMITS guard still runs on remix mode", () => {
  it("returns 429 when currentCount >= limit even for mode:remix", async () => {
    const { createServiceClient } = await import("@/lib/supabase/service");
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn((table: string) => {
        if (table === "usage_tracking") {
          const single = vi.fn(async () => ({ data: { analysis_count: 50 }, error: null }));
          const eq3 = vi.fn(() => ({ single }));
          const eq2 = vi.fn(() => ({ eq: eq3 }));
          const eq1 = vi.fn(() => ({ eq: eq2 }));
          const select = vi.fn(() => ({ eq: eq1 }));
          return { select, upsert: mockUsageTrackingUpsert };
        }
        return {
          insert: mockInsert,
          upsert: vi.fn(async () => ({ error: null })),
          select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null, error: null })) })) })),
        };
      }),
      storage: { from: vi.fn(() => ({ remove: vi.fn(async () => ({ error: null })) })) },
      rpc: vi.fn(async () => ({ error: null })),
    });

    // Free-tier subscription so limit applies
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-remix-1" } }, error: null })) },
      from: vi.fn((table: string) => {
        if (table === "user_subscriptions") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn(async () => ({ data: { virtuna_tier: "free" }, error: null })),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => ({ data: { storage_retention_opted_in: false }, error: null })),
        };
      }),
    });

    const req = makeRemixRequest();
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(mockResolveAndRehost).not.toHaveBeenCalled();
    expect(runPredictionPipeline).not.toHaveBeenCalled();
  });
});

// =====================================================
// C4: derive-and-drop — cleanup() called unconditionally
// =====================================================

describe("C4: decode route cleanup (derive-and-drop)", () => {
  it("DD-04: cleanup() is invoked even when runDecode returns null", async () => {
    const localCleanup = vi.fn(async () => { /* no-op */ });
    mockResolveAndRehost.mockResolvedValueOnce({
      signedUrl: "https://supabase.test/signed/decode-null.mp4",
      cleanup: localCleanup,
    });
    mockRunDecode.mockResolvedValueOnce(null);

    const req = makeRemixRequest();
    const res = await POST(req);
    await readSSE(res);

    expect(localCleanup).toHaveBeenCalledTimes(1);
  });

  it("DD-05: decode branch INSERT never sets video_storage_path", async () => {
    const req = makeRemixRequest();
    const res = await POST(req);
    await readSSE(res);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.not.objectContaining({ video_storage_path: expect.anything() })
    );
  });
});
