/**
 * Unit tests for scripts/backfill-trending-sound-embeddings.ts — Phase 6 Plan 06-04 Task 2.
 *
 * Verifies the FULL D-F4 pipeline (WARNING 3 fix — no synthetic descriptions):
 *   (a) download sound_url → (b) Gemini Files upload → (c) Gemini audio description →
 *   (d) Gemini embedContent → (e) Supabase update of audio_embedding + audio_description.
 *
 * Each step is non-fatal — failure at any step skips the row, leaves audio_embedding NULL,
 * advances the cursor, and continues. Idempotency comes from .is("audio_embedding", null).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted() declares spies BEFORE vi.mock factories are evaluated.
const {
  mockEmbedContent,
  mockGenerateContent,
  mockFilesUpload,
  mockFilesDelete,
  mockFetch,
  mockSelect,
  mockIs,
  mockOrder,
  mockLimit,
  mockGt,
  mockFromUpdate,
  mockUpdate,
  mockEq,
  mockCreateClient,
} = vi.hoisted(() => ({
  mockEmbedContent: vi.fn(),
  mockGenerateContent: vi.fn(),
  mockFilesUpload: vi.fn(),
  mockFilesDelete: vi.fn(),
  mockFetch: vi.fn(),
  mockSelect: vi.fn(),
  mockIs: vi.fn(),
  mockOrder: vi.fn(),
  mockLimit: vi.fn(),
  mockGt: vi.fn(),
  mockFromUpdate: vi.fn(),
  mockUpdate: vi.fn(),
  mockEq: vi.fn(),
  mockCreateClient: vi.fn(),
}));

vi.mock("dotenv", () => ({ config: vi.fn() }));

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

// fetch stub — script reaches for global fetch.
vi.stubGlobal("fetch", mockFetch);

// Supabase client mock. `from()` is dispatched per call:
//   - SELECT path returns the chainable query (select → is → order → limit → gt → resolved).
//   - UPDATE path returns { update: () => ({ eq: () => Promise }) }.
vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.GEMINI_API_KEY = "gemini-test-key";

// Pending result for the SELECT chain — set by setLimitResult() before each fetch iteration.
// The chain object is both a method-returning proxy AND a thenable (so `await chain` works).
let pendingSelectResult: { data: unknown; error: unknown } = { data: [], error: null };
let selectFetchSequence: Array<{ data: unknown; error: unknown }> = [];

function setSelectSequence(results: Array<{ data: unknown; error: unknown }>) {
  selectFetchSequence = [...results];
}

function setupSupabaseChain() {
  // Canonical Supabase mock chain: every method returns the chain itself, the chain is
  // thenable (await works), and the resolved value comes from selectFetchSequence
  // (one element per query iteration in main()).

  type ChainLike = {
    is: (...a: unknown[]) => ChainLike;
    order: (...a: unknown[]) => ChainLike;
    limit: (...a: unknown[]) => ChainLike;
    gt: (...a: unknown[]) => ChainLike;
    then: (
      resolve: (v: { data: unknown; error: unknown }) => void,
      reject?: (e: unknown) => void,
    ) => void;
  };

  const chain: ChainLike = {
    is: (...args) => {
      mockIs(...args);
      return chain;
    },
    order: (...args) => {
      mockOrder(...args);
      return chain;
    },
    limit: (...args) => {
      mockLimit(...args);
      return chain;
    },
    gt: (...args) => {
      mockGt(...args);
      return chain;
    },
    then: (resolve) => {
      // Pull the next pending result per iteration. Reset when sequence is exhausted.
      pendingSelectResult =
        selectFetchSequence.shift() ?? { data: [], error: null };
      resolve(pendingSelectResult);
    },
  };

  mockSelect.mockImplementation(() => chain);

  // UPDATE path
  mockFromUpdate.mockImplementation((args: unknown) => {
    // capture for later assertion
    mockUpdate(args);
    return { eq: mockEq };
  });
  mockEq.mockResolvedValue({ error: null });

  // from() returns SELECT chain + UPDATE entry both — we identify by which is called.
  mockCreateClient.mockReturnValue({
    from: vi.fn(() => ({
      select: mockSelect,
      update: mockFromUpdate,
    })),
  });
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

function singleRowFetcher(row: {
  id: string;
  sound_name: string;
  sound_url: string | null;
}) {
  // First iteration returns the row; second iteration terminates the loop with [].
  setSelectSequence([
    { data: [row], error: null },
    { data: [], error: null },
  ]);
}

describe("backfill-trending-sound-embeddings (FULL D-F4 pipeline)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupSupabaseChain();
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
    mockFetch.mockResolvedValue(makeAudioResponse());
    vi.resetModules();
  });

  it("Test 1: full pipeline succeeds — download → upload → describe → embed → update → cleanup", async () => {
    singleRowFetcher({ id: "1", sound_name: "Sound A", sound_url: "https://cdn/a.mp3" });

    const { main } = await import("../../scripts/backfill-trending-sound-embeddings");
    await main();

    expect(mockFetch).toHaveBeenCalledWith("https://cdn/a.mp3", expect.any(Object));
    expect(mockFilesUpload).toHaveBeenCalled();
    expect(mockGenerateContent).toHaveBeenCalled();
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
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        audio_description: "upbeat hip-hop, 90 BPM",
        audio_embedding: expect.any(Array),
      }),
    );
    expect(mockEq).toHaveBeenCalledWith("id", "1");
    expect(mockFilesDelete).toHaveBeenCalledWith({ name: "files/abc" });
  });

  it("Test 2: idempotency — empty initial fetch exits cleanly, .is(audio_embedding,null) applied", async () => {
    setSelectSequence([{ data: [], error: null }]);

    const { main } = await import("../../scripts/backfill-trending-sound-embeddings");
    await main();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockFromUpdate).not.toHaveBeenCalled();
    // Idempotency filter is applied
    expect(mockIs).toHaveBeenCalledWith("audio_embedding", null);
  });

  it("Test 3: sound_url = null → row skipped, NO Gemini calls, NO update", async () => {
    singleRowFetcher({ id: "1", sound_name: "Bad row", sound_url: null });

    const { main } = await import("../../scripts/backfill-trending-sound-embeddings");
    await main();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockFilesUpload).not.toHaveBeenCalled();
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockEmbedContent).not.toHaveBeenCalled();
    expect(mockFromUpdate).not.toHaveBeenCalled();
  });

  it("Test 4: download fails → row skipped, no upload, no describe, no update", async () => {
    singleRowFetcher({ id: "1", sound_name: "A", sound_url: "https://cdn/a.mp3" });
    mockFetch.mockRejectedValueOnce(new TypeError("Network error"));

    const { main } = await import("../../scripts/backfill-trending-sound-embeddings");
    await main();

    expect(mockFilesUpload).not.toHaveBeenCalled();
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockEmbedContent).not.toHaveBeenCalled();
    expect(mockFromUpdate).not.toHaveBeenCalled();
  });

  it("Test 5: Gemini audio analysis fails → row skipped, cleanup still attempted", async () => {
    singleRowFetcher({ id: "1", sound_name: "A", sound_url: "https://cdn/a.mp3" });
    mockGenerateContent.mockRejectedValueOnce(new Error("Quota exceeded"));

    const { main } = await import("../../scripts/backfill-trending-sound-embeddings");
    await main();

    expect(mockEmbedContent).not.toHaveBeenCalled();
    expect(mockFromUpdate).not.toHaveBeenCalled();
    // Cleanup runs even when describe failed mid-way (uploadedName was set by mockFilesUpload).
    expect(mockFilesDelete).toHaveBeenCalled();
  });

  it("Test 6: embedContent fails → row skipped, no update, cleanup still runs", async () => {
    singleRowFetcher({ id: "1", sound_name: "A", sound_url: "https://cdn/a.mp3" });
    mockEmbedContent.mockRejectedValueOnce(new Error("Embed quota"));

    const { main } = await import("../../scripts/backfill-trending-sound-embeddings");
    await main();

    expect(mockFromUpdate).not.toHaveBeenCalled();
    expect(mockFilesDelete).toHaveBeenCalled();
  });

  it("Test 7: HTTP non-200 → row skipped (download returns null)", async () => {
    singleRowFetcher({ id: "1", sound_name: "A", sound_url: "https://cdn/a.mp3" });
    mockFetch.mockResolvedValueOnce(
      new Response("", {
        status: 404,
        headers: { "content-type": "text/plain" },
      }),
    );

    const { main } = await import("../../scripts/backfill-trending-sound-embeddings");
    await main();

    expect(mockFilesUpload).not.toHaveBeenCalled();
    expect(mockFromUpdate).not.toHaveBeenCalled();
  });

  it("Test 8: oversized download → row skipped via Content-Length pre-check", async () => {
    singleRowFetcher({ id: "1", sound_name: "Huge", sound_url: "https://cdn/big.mp3" });
    mockFetch.mockResolvedValueOnce(
      new Response("", {
        status: 200,
        headers: {
          "content-type": "audio/mpeg",
          "content-length": String(20 * 1024 * 1024), // 20 MB > 10 MB cap
        },
      }),
    );

    const { main } = await import("../../scripts/backfill-trending-sound-embeddings");
    await main();

    expect(mockFilesUpload).not.toHaveBeenCalled();
    expect(mockFromUpdate).not.toHaveBeenCalled();
  });
});
