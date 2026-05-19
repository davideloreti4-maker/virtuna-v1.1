/**
 * Phase 6 Plan 06-06 — calculate-trends cron route tests (D-F4 inline embedding pipeline).
 *
 * 6 tests covering:
 *   - Test 1: full D-F4 pipeline runs per newly-upserted sound (fetch → upload → describe →
 *             embed → update + Files API cleanup) — mirrors scripts/backfill semantics.
 *   - Test 2: per-row download failure isolated; cron continues to next row; route returns 200.
 *   - Test 3: per-row Gemini audio analysis failure isolated; embed/update skipped for that
 *             row; cleanup still attempted; cron continues.
 *   - Test 4: per-row embedContent failure isolated; update skipped for that row; cleanup
 *             still attempted; cron continues.
 *   - Test 5: existing cron behavior preserved when GEMINI_API_KEY is missing (no embedding
 *             attempts, response shape unchanged).
 *   - Test 6: cron returns 200 even when ALL rows fail audio extension (fire-and-forget
 *             contract per Pitfall 4).
 *
 * Mocking pattern mirrors tests/scripts/backfill-trending-sound-embeddings.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.hoisted() pre-creates the spies BEFORE vi.mock factories evaluate, avoiding the
// "Cannot access before initialization" hoisting trap.
const {
  mockEmbedContent,
  mockGenerateContent,
  mockFilesUpload,
  mockFilesDelete,
  mockFetch,
  mockVerifyCronAuth,
  mockCreateServiceClient,
} = vi.hoisted(() => ({
  mockEmbedContent: vi.fn(),
  mockGenerateContent: vi.fn(),
  mockFilesUpload: vi.fn(),
  mockFilesDelete: vi.fn(),
  mockFetch: vi.fn(),
  mockVerifyCronAuth: vi.fn(),
  mockCreateServiceClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => {
    const stub = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: () => stub,
    };
    return stub;
  },
}));

vi.mock("@/lib/cron-auth", () => ({
  verifyCronAuth: mockVerifyCronAuth,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mockCreateServiceClient,
}));

vi.mock("@google/genai", () => {
  const Type = {
    OBJECT: "object",
    STRING: "string",
    NUMBER: "number",
    BOOLEAN: "boolean",
  };
  const MockGoogleGenAI = vi.fn(function (this: Record<string, unknown>) {
    this.models = {
      embedContent: mockEmbedContent,
      generateContent: mockGenerateContent,
    };
    this.files = {
      upload: mockFilesUpload,
      delete: mockFilesDelete,
    };
  });
  return { GoogleGenAI: MockGoogleGenAI, Type };
});

// Global fetch stub — cron route's inline pipeline uses fetch() for sound_url downloads.
vi.stubGlobal("fetch", mockFetch);

// Default env so cron does not auth-reject in any test (verifyCronAuth returns null = ok).
mockVerifyCronAuth.mockReturnValue(null);

// =====================================================
// Supabase mock helpers
// =====================================================
//
// The route makes these from() calls (in order):
//   1. .from("scraped_videos").select(...).is(...).not(...).gte(...).order(...) — fetch videos.
//   2. .from("trending_sounds").upsert(batch, { onConflict: "sound_name" }) — upsert sounds.
//   3. Phase 6 NEW: for each upserted row,
//      .from("trending_sounds").select("audio_embedding").eq("sound_name", X).maybeSingle()
//      to check idempotency, then if audio_embedding IS NULL run the D-F4 pipeline +
//      .from("trending_sounds").update({ audio_embedding, audio_description }).eq("sound_name", X).
//
// We dispatch on the table name + the operation type.

interface MockState {
  videos: Array<{
    sound_name: string;
    sound_url: string | null;
    views: number | null;
    likes: number | null;
    shares: number | null;
    created_at: string | null;
  }> | null;
  videosError: { message: string } | null;
  upsertError: { message: string } | null;
  embeddingChecks: Record<string, string | null>; // sound_name → existing audio_embedding (null = needs embedding)
  updates: Array<{
    sound_name: string;
    audio_embedding: unknown;
    audio_description: unknown;
  }>;
  updateErrors: Record<string, { message: string }>;
}

let state: MockState;

function buildSupabaseClient(): unknown {
  return {
    from: vi.fn((table: string) => {
      if (table === "scraped_videos") {
        // Chain: select().is().not().gte().order() → resolves to { data, error }.
        const chain = {
          select: () => chain,
          is: () => chain,
          not: () => chain,
          gte: () => chain,
          order: () =>
            Promise.resolve({
              data: state.videos,
              error: state.videosError,
            }),
        };
        return chain;
      }
      if (table === "trending_sounds") {
        return {
          upsert: vi.fn(() =>
            Promise.resolve({ error: state.upsertError }),
          ),
          select: vi.fn(() => ({
            eq: vi.fn((_col: string, sound_name: string) => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({
                  data: {
                    audio_embedding:
                      state.embeddingChecks[sound_name] ?? null,
                  },
                  error: null,
                }),
              ),
            })),
          })),
          update: vi.fn((args: { audio_embedding: unknown; audio_description: unknown }) => ({
            eq: vi.fn((_col: string, sound_name: string) => {
              state.updates.push({
                sound_name,
                audio_embedding: args.audio_embedding,
                audio_description: args.audio_description,
              });
              const err = state.updateErrors[sound_name] ?? null;
              return Promise.resolve({ error: err });
            }),
          })),
        };
      }
      return {};
    }),
  };
}

function makeAudioResponse(byteLength = 1024, contentType = "audio/mpeg"): Response {
  const body = new Uint8Array(byteLength).fill(0);
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-length": String(byteLength),
    },
  });
}

function makeRequest(): Request {
  return new Request("https://example.com/api/cron/calculate-trends", {
    method: "GET",
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  // Re-stub fetch (vi.resetAllMocks doesn't reset stubGlobal).
  mockFetch.mockReset();

  mockVerifyCronAuth.mockReturnValue(null);

  state = {
    videos: [
      {
        sound_name: "Sound A",
        sound_url: "https://cdn.test/sound-a.mp3",
        views: 10000,
        likes: 500,
        shares: 100,
        created_at: new Date().toISOString(),
      },
      {
        sound_name: "Sound B",
        sound_url: "https://cdn.test/sound-b.mp3",
        views: 5000,
        likes: 250,
        shares: 50,
        created_at: new Date().toISOString(),
      },
    ],
    videosError: null,
    upsertError: null,
    embeddingChecks: {}, // empty → all sounds have null audio_embedding (need embedding)
    updates: [],
    updateErrors: {},
  };

  mockCreateServiceClient.mockReturnValue(buildSupabaseClient());

  // Default Gemini mocks — happy path
  mockFilesUpload.mockResolvedValue({
    name: "files/abc",
    uri: "https://generativelanguage.googleapis.com/v1/files/abc",
  });
  mockFilesDelete.mockResolvedValue(undefined);
  mockGenerateContent.mockResolvedValue({
    text: JSON.stringify({ audio_description: "upbeat hip-hop, 90 BPM" }),
  });
  mockEmbedContent.mockResolvedValue({
    embeddings: [{ values: new Array(768).fill(0.1) }],
  });
  // Each fetch returns a FRESH Response — Response bodies are read-once, so
  // mockResolvedValue(makeAudioResponse()) would fail on the 2nd call with
  // 'Body is unusable: Body has already been read'.
  mockFetch.mockImplementation(async () => makeAudioResponse());

  process.env.GEMINI_API_KEY = "gemini-test-key";

  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal("fetch", mockFetch);
});

describe("calculate-trends cron — D-F4 inline embedding pipeline (Phase 6 Plan 06-06)", () => {
  it("Test 1: full D-F4 pipeline runs per newly-upserted sound (fetch → upload → describe → embed → update + cleanup)", async () => {
    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    // Each of the 2 sounds triggers the full pipeline.
    expect(mockFetch).toHaveBeenCalledWith(
      "https://cdn.test/sound-a.mp3",
      expect.any(Object),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "https://cdn.test/sound-b.mp3",
      expect.any(Object),
    );
    expect(mockFilesUpload).toHaveBeenCalledTimes(2);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(mockEmbedContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-embedding-001",
        contents: "upbeat hip-hop, 90 BPM",
        config: expect.objectContaining({
          outputDimensionality: 768,
          taskType: "SEMANTIC_SIMILARITY",
        }),
      }),
    );
    expect(mockEmbedContent).toHaveBeenCalledTimes(2);

    // Each successful row triggers an UPDATE with both columns.
    expect(state.updates).toHaveLength(2);
    expect(state.updates[0]).toEqual(
      expect.objectContaining({
        audio_description: "upbeat hip-hop, 90 BPM",
        audio_embedding: expect.any(Array),
      }),
    );

    // Files API cleanup runs after each row.
    expect(mockFilesDelete).toHaveBeenCalledTimes(2);
  });

  it("Test 2: per-row download failure isolated — cron continues to next row; route returns 200", async () => {
    let callCount = 0;
    mockFetch.mockImplementation(async () => {
      callCount += 1;
      if (callCount === 1) throw new TypeError("Network error");
      return makeAudioResponse();
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    // Row 1 failed download → no upload/describe/embed/update for it.
    // Row 2 succeeded the full pipeline → 1 upload + 1 describe + 1 embed + 1 update.
    expect(mockFilesUpload).toHaveBeenCalledTimes(1);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(mockEmbedContent).toHaveBeenCalledTimes(1);
    expect(state.updates).toHaveLength(1);
  });

  it("Test 3: per-row Gemini audio analysis failure isolated — embed/update skipped for that row; cleanup attempted; cron continues", async () => {
    mockGenerateContent
      .mockRejectedValueOnce(new Error("Quota exceeded"))
      .mockResolvedValueOnce({
        text: JSON.stringify({ audio_description: "mellow lo-fi" }),
      });

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    // Row 1's describe failed → no embed/update; cleanup still attempted.
    // Row 2 succeeded full pipeline → 1 embed + 1 update.
    expect(mockEmbedContent).toHaveBeenCalledTimes(1);
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]?.audio_description).toBe("mellow lo-fi");
    // Cleanup runs for BOTH rows (Files API upload happened for both before describe).
    expect(mockFilesDelete).toHaveBeenCalledTimes(2);
  });

  it("Test 4: per-row embedContent failure isolated — update skipped for that row; cleanup attempted; cron continues", async () => {
    mockEmbedContent
      .mockRejectedValueOnce(new Error("Embed quota exceeded"))
      .mockResolvedValueOnce({
        embeddings: [{ values: new Array(768).fill(0.2) }],
      });

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    // Row 1's embed failed → no update; cleanup still attempted.
    // Row 2 succeeded → 1 update.
    expect(state.updates).toHaveLength(1);
    expect(mockFilesDelete).toHaveBeenCalledTimes(2);
  });

  it("Test 5: missing GEMINI_API_KEY → no embedding attempts; response shape preserved", async () => {
    delete process.env.GEMINI_API_KEY;

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    // No Gemini calls at all when API key is missing.
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockFilesUpload).not.toHaveBeenCalled();
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockEmbedContent).not.toHaveBeenCalled();
    expect(state.updates).toHaveLength(0);

    // Response shape unchanged (existing keys present).
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("processed");
    expect(body).toHaveProperty("sounds");
    expect(body).toHaveProperty("upserted");
  });

  it("Test 6: ALL rows fail audio extension → cron still returns 200 (fire-and-forget contract per Pitfall 4)", async () => {
    mockFetch.mockImplementation(async () => {
      throw new TypeError("Network error");
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    // No updates happened — but the route returned 200.
    expect(state.updates).toHaveLength(0);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("upserted");
  });

  // Idempotency cross-check: rows that already have an audio_embedding skip the pipeline.
  it("Test 7: idempotent — rows with existing audio_embedding skip the inline pipeline", async () => {
    // Mark Sound A as already-embedded; only Sound B should trigger the pipeline.
    state.embeddingChecks = { "Sound A": "[0.1,0.2,0.3]" };

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://cdn.test/sound-b.mp3",
      expect.any(Object),
    );
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]?.sound_name).toBe("Sound B");
  });
});
