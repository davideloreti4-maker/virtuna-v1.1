/**
 * Unit tests for src/lib/engine/wave0/content-type-detector.ts — Phase 4 Wave 0.
 * D-17 update (Phase 13 Plan 03): extended to test niche fields returned by the folded Gemini call.
 * D-18 update: tests for videoContext bypass path.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import type { StageEvent } from "../events";
import type { ContentPayload } from "../types";

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  })),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

const mockGenerate = vi.fn();
const mockFileUpload = vi.fn();
const mockFileGet = vi.fn();
const mockFileDelete = vi.fn();
vi.mock("@google/genai", () => {
  const MockGoogleGenAI = vi.fn(function (this: Record<string, unknown>) {
    this.models = { generateContent: mockGenerate };
    this.files = {
      upload: mockFileUpload, get: mockFileGet, delete: mockFileDelete,
    };
  });
  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: { OBJECT: "OBJECT", STRING: "STRING", NUMBER: "NUMBER", BOOLEAN: "BOOLEAN" },
  };
});

// Mock niches taxonomy so tests don't depend on actual taxonomy file
vi.mock("@/lib/niches/taxonomy", () => ({
  NICHE_TREE: [
    { slug: "beauty", label: "Beauty", subs: [{ slug: "skincare", label: "Skincare" }], personas: [], benchmark_filters: { tag_filters: [], min_corpus_size: 0 } },
    { slug: "fitness", label: "Fitness", subs: [{ slug: "strength-training", label: "Strength Training" }], personas: [], benchmark_filters: { tag_filters: [], min_corpus_size: 0 } },
    { slug: "education", label: "Education", subs: [{ slug: "coding-programming", label: "Coding" }], personas: [], benchmark_filters: { tag_filters: [], min_corpus_size: 0 } },
    { slug: "comedy", label: "Comedy", subs: [], personas: [], benchmark_filters: { tag_filters: [], min_corpus_size: 0 } },
    { slug: "lifestyle", label: "Lifestyle", subs: [], personas: [], benchmark_filters: { tag_filters: [], min_corpus_size: 0 } },
    { slug: "food-cooking", label: "Food & Cooking", subs: [], personas: [], benchmark_filters: { tag_filters: [], min_corpus_size: 0 } },
    { slug: "tech-gadgets", label: "Tech & Gadgets", subs: [], personas: [], benchmark_filters: { tag_filters: [], min_corpus_size: 0 } },
    { slug: "gaming", label: "Gaming", subs: [], personas: [], benchmark_filters: { tag_filters: [], min_corpus_size: 0 } },
    { slug: "fashion-style", label: "Fashion & Style", subs: [], personas: [], benchmark_filters: { tag_filters: [], min_corpus_size: 0 } },
    { slug: "music-performance", label: "Music & Performance", subs: [], personas: [], benchmark_filters: { tag_filters: [], min_corpus_size: 0 } },
  ],
  getNicheBranches: vi.fn(() => []),
}));

// Supabase storage mock
const mockStorageDownload = vi.fn();
const mockStorageFrom = vi.fn(() => ({ download: mockStorageDownload }));
const mockSupabaseClient = {
  storage: { from: mockStorageFrom },
} as unknown as import("@supabase/supabase-js").SupabaseClient;

// Keep a no-op global fetch reference (defensive)
const originalFetch = globalThis.fetch;

process.env.GEMINI_API_KEY = "test-key";
process.env.GEMINI_WAVE0_MODEL = "gemini-3-flash-preview";

import { detectContentType } from "../wave0/content-type-detector";

const videoPayload: ContentPayload = {
  input_mode: "video_upload",
  video_storage_path: "user-abc/video.mp4",
  video_url: null,
  hashtags: [],
} as unknown as ContentPayload;

const textPayload: ContentPayload = {
  input_mode: "text",
  content_text: "hello",
  hashtags: [],
} as unknown as ContentPayload;

// Helper: valid Gemini response with niche fields (D-17)
function geminiResponse(overrides: Record<string, unknown> = {}) {
  return {
    text: JSON.stringify({
      type: "talking_head",
      confidence: 0.85,
      mixed: false,
      niche_primary_slug: "beauty",
      niche_confidence: 0.9,
      niche_micro_slug: null,
      ...overrides,
    }),
    usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 80 },
  };
}

describe("detectContentType — Phase 4 Wave 0 (D-17 niche fold, D-18 videoContext)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFileUpload.mockResolvedValue({ name: "files/abc", state: "ACTIVE", uri: "gs://abc" });
    mockFileGet.mockResolvedValue({ name: "files/abc", state: "ACTIVE", uri: "gs://abc" });
    mockStorageDownload.mockResolvedValue({
      data: new Blob([new Uint8Array(8)], { type: "video/mp4" }),
      error: null,
    });
  });

  // -------------------------------------------------------
  // D-17: niche fields returned alongside content_type
  // -------------------------------------------------------

  it("D-17-T1: returns niche_primary_slug, niche_confidence, niche_micro_slug alongside content_type", async () => {
    mockGenerate.mockResolvedValue(geminiResponse({
      niche_primary_slug: "fitness",
      niche_confidence: 0.82,
      niche_micro_slug: "home-workouts",
    }));
    const result = await detectContentType(videoPayload, mockSupabaseClient, undefined, undefined);
    expect(result).not.toBeNull();
    expect(result?.niche_primary_slug).toBe("fitness");
    expect(result?.niche_confidence).toBe(0.82);
    expect(result?.niche_micro_slug).toBe("home-workouts");
  });

  it("D-17-T2: niche_primary_slug must be in NICHE_TREE — unknown slug falls back to first valid slug", async () => {
    mockGenerate.mockResolvedValue(geminiResponse({
      niche_primary_slug: "completely-unknown-slug",
      niche_confidence: 0.7,
      niche_micro_slug: null,
    }));
    const result = await detectContentType(videoPayload, mockSupabaseClient, undefined, undefined);
    // Fallback to first slug from NICHE_TREE (beauty)
    expect(result?.niche_primary_slug).toBe("beauty");
  });

  it("D-17-T3: low niche_confidence still returns result (graceful — consumers handle low conf)", async () => {
    mockGenerate.mockResolvedValue(geminiResponse({
      niche_primary_slug: "comedy",
      niche_confidence: 0.35,
      niche_micro_slug: null,
    }));
    const result = await detectContentType(videoPayload, mockSupabaseClient, undefined, undefined);
    expect(result?.niche_confidence).toBe(0.35);
    expect(result?.niche_primary_slug).toBe("comedy");
  });

  it("D-17-T4: when Gemini call fails, returns null (both content_type and niche null)", async () => {
    mockGenerate.mockRejectedValue(new Error("Gemini API error"));
    const result = await detectContentType(videoPayload, mockSupabaseClient, undefined, undefined);
    expect(result).toBeNull();
  });

  it("D-17-T5: niche_micro_slug is null when Gemini omits it", async () => {
    mockGenerate.mockResolvedValue(geminiResponse({ niche_micro_slug: undefined }));
    const result = await detectContentType(videoPayload, mockSupabaseClient, undefined, undefined);
    expect(result?.niche_micro_slug).toBeNull();
  });

  // -------------------------------------------------------
  // D-18: videoContext bypass — skip upload when caller provides fileUri
  // -------------------------------------------------------

  it("D-18-T1: when videoContext provided, does NOT call ai.files.upload", async () => {
    mockGenerate.mockResolvedValue(geminiResponse());
    const vc = { fileUri: "gs://pre-uploaded-abc", mimeType: "video/mp4" };
    const result = await detectContentType(videoPayload, mockSupabaseClient, vc, undefined);
    expect(result).not.toBeNull();
    expect(mockFileUpload).not.toHaveBeenCalled();
    expect(mockStorageDownload).not.toHaveBeenCalled();
  });

  it("D-18-T2: when videoContext provided, uses the provided fileUri in the Gemini call", async () => {
    mockGenerate.mockResolvedValue(geminiResponse());
    const vc = { fileUri: "gs://caller-owned-uri", mimeType: "video/mp4" };
    await detectContentType(videoPayload, mockSupabaseClient, vc, undefined);
    const callArgs = mockGenerate.mock.calls[0][0];
    const filePart = callArgs.contents[0].parts.find((p: Record<string, unknown>) => p.fileData);
    expect(filePart?.fileData?.fileUri).toBe("gs://caller-owned-uri");
  });

  it("D-18-T3: when videoContext provided, does NOT call ai.files.delete (caller owns lifecycle)", async () => {
    mockGenerate.mockResolvedValue(geminiResponse());
    const vc = { fileUri: "gs://caller-owned-uri", mimeType: "video/mp4" };
    await detectContentType(videoPayload, mockSupabaseClient, vc, undefined);
    expect(mockFileDelete).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------
  // Existing tests — updated for new signature (videoContext=undefined before onEvent)
  // -------------------------------------------------------

  it("returns valid Wave0ContentTypeExtendedResult on Gemini success (7-cat enum)", async () => {
    mockGenerate.mockResolvedValue(geminiResponse());
    const cb = vi.fn();
    const result = await detectContentType(videoPayload, mockSupabaseClient, undefined, cb);
    expect(result).toMatchObject({ type: "talking_head", confidence: 0.85, niche_primary_slug: "beauty", niche_confidence: 0.9 });
    const events = cb.mock.calls.map((c) => c[0] as StageEvent);
    expect(events.some((e) => e.type === "stage_start" && (e as { stage?: string }).stage === "wave_0_content_type")).toBe(true);
    expect(events.some((e) => e.type === "stage_end" && (e as { stage?: string }).stage === "wave_0_content_type" && (e as { ok?: boolean }).ok === true)).toBe(true);
  });

  it("returns null when input_mode !== video_upload (no_video_input warning)", async () => {
    const cb = vi.fn();
    const result = await detectContentType(textPayload, mockSupabaseClient, undefined, cb);
    expect(result).toBeNull();
    const ends = cb.mock.calls.map((c) => c[0] as StageEvent).filter((e) => e.type === "stage_end");
    expect(ends).toHaveLength(1);
    expect((ends[0] as { warning?: string }).warning).toContain("no_video_input");
    expect((ends[0] as { cost_cents?: number }).cost_cents).toBe(0);
    expect((ends[0] as { ok?: boolean }).ok).toBe(true);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("returns null on file upload failure (ok:false stage_end)", async () => {
    mockFileUpload.mockRejectedValue(new Error("upload failed"));
    const cb = vi.fn();
    const result = await detectContentType(videoPayload, mockSupabaseClient, undefined, cb);
    expect(result).toBeNull();
    const ends = cb.mock.calls.map((c) => c[0] as StageEvent).filter((e) => e.type === "stage_end");
    expect((ends[0] as { ok?: boolean }).ok).toBe(false);
    expect((ends[0] as { warning?: string }).warning).toBeTruthy();
  });

  it("returns null when file state goes FAILED", async () => {
    mockFileUpload.mockResolvedValue({ name: "files/abc", state: "FAILED", uri: null });
    const cb = vi.fn();
    const result = await detectContentType(videoPayload, mockSupabaseClient, undefined, cb);
    expect(result).toBeNull();
    const ends = cb.mock.calls.map((c) => c[0] as StageEvent).filter((e) => e.type === "stage_end");
    expect((ends[0] as { ok?: boolean }).ok).toBe(false);
  });

  it("returns null on Zod schema validation failure (invalid type enum)", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({ type: "INVALID", confidence: 0.9 }),
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20 },
    });
    const cb = vi.fn();
    const result = await detectContentType(videoPayload, mockSupabaseClient, undefined, cb);
    expect(result).toBeNull();
  });

  it("emits both stage_start AND stage_end with wave=0 in every code path", async () => {
    mockGenerate.mockResolvedValue(geminiResponse({ type: "vlog", confidence: 0.7 }));
    const cb = vi.fn();
    await detectContentType(videoPayload, mockSupabaseClient, undefined, cb);
    const events = cb.mock.calls.map((c) => c[0] as StageEvent);
    const starts = events.filter((e) => e.type === "stage_start" && (e as { stage?: string }).stage === "wave_0_content_type");
    const ends = events.filter((e) => e.type === "stage_end" && (e as { stage?: string }).stage === "wave_0_content_type");
    expect(starts).toHaveLength(1);
    expect(ends).toHaveLength(1);
    expect((starts[0] as { wave?: number }).wave).toBe(0);
    expect((ends[0] as { wave?: number }).wave).toBe(0);
  });

  it("cost_cents on success path > 0 (defensive cost cap < 0.5)", async () => {
    mockGenerate.mockResolvedValue(geminiResponse({ type: "tutorial", confidence: 0.9 }));
    const cb = vi.fn();
    await detectContentType(videoPayload, mockSupabaseClient, undefined, cb);
    const ends = cb.mock.calls.map((c) => c[0] as StageEvent).filter((e) => e.type === "stage_end");
    expect((ends[0] as { cost_cents?: number }).cost_cents).toBeGreaterThan(0);
    expect((ends[0] as { cost_cents?: number }).cost_cents).toBeLessThan(0.5);
  });

  it("warning is 'low_confidence' when confidence < 0.6", async () => {
    mockGenerate.mockResolvedValue(geminiResponse({ type: "other", confidence: 0.4 }));
    const result = await detectContentType(videoPayload, mockSupabaseClient, undefined, undefined);
    expect(result?.warning).toBe("low_confidence");
  });

  it("warning is 'mixed_content_detected' when raw.mixed === true", async () => {
    mockGenerate.mockResolvedValue(geminiResponse({ type: "slideshow", confidence: 0.8, mixed: true, dominant_seconds: 3 }));
    const result = await detectContentType(videoPayload, mockSupabaseClient, undefined, undefined);
    expect(result?.warning).toBe("mixed_content_detected");
  });

  it("does not call generateContent when input_mode is text", async () => {
    await detectContentType(textPayload, mockSupabaseClient, undefined, undefined);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockFileUpload).not.toHaveBeenCalled();
  });

  it("GAP-04-01 regression: downloads via supabase.storage when input_mode='video_upload' (NOT fetch)", async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as Response));
    globalThis.fetch = fetchSpy;

    mockGenerate.mockResolvedValue(geminiResponse());

    const result = await detectContentType(videoPayload, mockSupabaseClient);

    expect(result).not.toBeNull();
    expect(result?.type).toBe("talking_head");
    expect(mockStorageFrom).toHaveBeenCalledWith("videos");
    expect(mockStorageDownload).toHaveBeenCalledWith("user-abc/video.mp4");
    expect(fetchSpy).not.toHaveBeenCalledWith(expect.stringMatching(/^user-abc\//));
  });

  it("GAP-04-01 regression: returns null + ok:false stage_end when supabase storage download fails", async () => {
    mockStorageDownload.mockResolvedValue({
      data: null,
      error: { message: "Object not found" },
    });

    const cb = vi.fn();
    const result = await detectContentType(videoPayload, mockSupabaseClient, undefined, cb);

    expect(result).toBeNull();
    const ends = cb.mock.calls
      .map((c) => c[0] as StageEvent)
      .filter((e) => e.type === "stage_end");
    expect(ends).toHaveLength(1);
    expect((ends[0] as { ok?: boolean }).ok).toBe(false);
    expect((ends[0] as { warning?: string }).warning).toMatch(/video download failed|Object not found/);
    expect(mockFileUpload).not.toHaveBeenCalled();
  });

  it("returns null + warning when input_mode='video_upload' but video_storage_path is missing", async () => {
    const payloadMissingPath: ContentPayload = {
      ...videoPayload,
      video_storage_path: null,
    } as ContentPayload;

    const cb = vi.fn();
    const result = await detectContentType(payloadMissingPath, mockSupabaseClient, undefined, cb);

    expect(result).toBeNull();
    const ends = cb.mock.calls
      .map((c) => c[0] as StageEvent)
      .filter((e) => e.type === "stage_end");
    expect(ends).toHaveLength(1);
    expect((ends[0] as { ok?: boolean }).ok).toBe(true);
    expect((ends[0] as { warning?: string }).warning).toContain("no_video_input");
    expect(mockStorageDownload).not.toHaveBeenCalled();
    expect(mockFileUpload).not.toHaveBeenCalled();
  });
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});
