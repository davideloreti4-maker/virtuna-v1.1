/**
 * Unit tests for src/lib/engine/wave0/content-type-detector.ts — Phase 4 Wave 0.
 * Mirrors gemini.test.ts mocking pattern (PATTERNS lines 847-915).
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

// Supabase storage mock — replaces the old globalThis.fetch pattern (Phase 4 GAP-04-01 fix)
const mockStorageDownload = vi.fn();
const mockStorageFrom = vi.fn(() => ({ download: mockStorageDownload }));
const mockSupabaseClient = {
  storage: { from: mockStorageFrom },
} as unknown as import("@supabase/supabase-js").SupabaseClient;

// Keep a no-op global fetch reference (defensive — the detector no longer calls fetch on storage keys)
const originalFetch = globalThis.fetch;

process.env.GEMINI_API_KEY = "test-key";
process.env.GEMINI_WAVE0_MODEL = "gemini-3-flash-preview";

import { detectContentType } from "../wave0/content-type-detector";

const videoPayload: ContentPayload = {
  input_mode: "video_upload",
  video_storage_path: "user-abc/video.mp4",  // Production-shaped: no scheme, no host, raw object key
  video_url: null,                            // Option A — NEVER aliased to the storage key
  hashtags: [],
} as unknown as ContentPayload;

const textPayload: ContentPayload = {
  input_mode: "text",
  content_text: "hello",
  hashtags: [],
} as unknown as ContentPayload;

describe("detectContentType — Phase 4 Wave 0", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFileUpload.mockResolvedValue({ name: "files/abc", state: "ACTIVE", uri: "gs://abc" });
    mockFileGet.mockResolvedValue({ name: "files/abc", state: "ACTIVE", uri: "gs://abc" });
    // Default storage mock: succeeds with a tiny mp4-shaped Blob (Phase 4 GAP-04-01 fix default)
    mockStorageDownload.mockResolvedValue({
      data: new Blob([new Uint8Array(8)], { type: "video/mp4" }),
      error: null,
    });
  });

  it("returns valid Wave0ContentTypeResult on Gemini success (7-cat enum)", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({ type: "talking_head", confidence: 0.85, mixed: false }),
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 80 },
    });
    const cb = vi.fn();
    const result = await detectContentType(videoPayload, mockSupabaseClient, cb);
    expect(result).toEqual({ type: "talking_head", confidence: 0.85 });
    const events = cb.mock.calls.map((c) => c[0] as StageEvent);
    expect(events.some((e) => e.type === "stage_start" && (e as { stage?: string }).stage === "wave_0_content_type")).toBe(true);
    expect(events.some((e) => e.type === "stage_end" && (e as { stage?: string }).stage === "wave_0_content_type" && (e as { ok?: boolean }).ok === true)).toBe(true);
  });

  it("returns null when input_mode !== video_upload (no_video_input warning)", async () => {
    const cb = vi.fn();
    const result = await detectContentType(textPayload, mockSupabaseClient, cb);
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
    const result = await detectContentType(videoPayload, mockSupabaseClient, cb);
    expect(result).toBeNull();
    const ends = cb.mock.calls.map((c) => c[0] as StageEvent).filter((e) => e.type === "stage_end");
    expect((ends[0] as { ok?: boolean }).ok).toBe(false);
    expect((ends[0] as { warning?: string }).warning).toBeTruthy();
  });

  it("returns null when file state goes FAILED", async () => {
    mockFileUpload.mockResolvedValue({ name: "files/abc", state: "FAILED", uri: null });
    const cb = vi.fn();
    const result = await detectContentType(videoPayload, mockSupabaseClient, cb);
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
    const result = await detectContentType(videoPayload, mockSupabaseClient, cb);
    expect(result).toBeNull();
  });

  it("emits both stage_start AND stage_end with wave=0 in every code path", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({ type: "vlog", confidence: 0.7, mixed: false }),
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 80 },
    });
    const cb = vi.fn();
    await detectContentType(videoPayload, mockSupabaseClient, cb);
    const events = cb.mock.calls.map((c) => c[0] as StageEvent);
    const starts = events.filter((e) => e.type === "stage_start" && (e as { stage?: string }).stage === "wave_0_content_type");
    const ends = events.filter((e) => e.type === "stage_end" && (e as { stage?: string }).stage === "wave_0_content_type");
    expect(starts).toHaveLength(1);
    expect(ends).toHaveLength(1);
    expect((starts[0] as { wave?: number }).wave).toBe(0);
    expect((ends[0] as { wave?: number }).wave).toBe(0);
  });

  it("cost_cents on success path > 0 (defensive cost cap < 0.5)", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({ type: "tutorial", confidence: 0.9, mixed: false }),
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 80 },
    });
    const cb = vi.fn();
    await detectContentType(videoPayload, mockSupabaseClient, cb);
    const ends = cb.mock.calls.map((c) => c[0] as StageEvent).filter((e) => e.type === "stage_end");
    expect((ends[0] as { cost_cents?: number }).cost_cents).toBeGreaterThan(0);
    expect((ends[0] as { cost_cents?: number }).cost_cents).toBeLessThan(0.5);
  });

  it("warning is 'low_confidence' when confidence < 0.6", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({ type: "other", confidence: 0.4, mixed: false }),
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 80 },
    });
    const result = await detectContentType(videoPayload, mockSupabaseClient, undefined);
    expect(result?.warning).toBe("low_confidence");
  });

  it("warning is 'mixed_content_detected' when raw.mixed === true", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({ type: "slideshow", confidence: 0.8, mixed: true, dominant_seconds: 3 }),
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 80 },
    });
    const result = await detectContentType(videoPayload, mockSupabaseClient, undefined);
    expect(result?.warning).toBe("mixed_content_detected");
  });

  it("does not call generateContent when input_mode is text", async () => {
    await detectContentType(textPayload, mockSupabaseClient, undefined);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockFileUpload).not.toHaveBeenCalled();
  });

  it("GAP-04-01 regression: downloads via supabase.storage when input_mode='video_upload' (NOT fetch)", async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as Response));
    globalThis.fetch = fetchSpy;

    mockGenerate.mockResolvedValue({
      text: JSON.stringify({ type: "talking_head", confidence: 0.85, mixed: false }),
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 80 },
    });

    const result = await detectContentType(videoPayload, mockSupabaseClient);

    expect(result).not.toBeNull();
    expect(result?.type).toBe("talking_head");
    // Storage download invoked with the raw key (no scheme/host)
    expect(mockStorageFrom).toHaveBeenCalledWith("videos");
    expect(mockStorageDownload).toHaveBeenCalledWith("user-abc/video.mp4");
    // fetch() must NOT have been called on the storage key
    expect(fetchSpy).not.toHaveBeenCalledWith(expect.stringMatching(/^user-abc\//));
  });

  it("GAP-04-01 regression: returns null + ok:false stage_end when supabase storage download fails", async () => {
    mockStorageDownload.mockResolvedValue({
      data: null,
      error: { message: "Object not found" },
    });

    const cb = vi.fn();
    const result = await detectContentType(videoPayload, mockSupabaseClient, cb);

    expect(result).toBeNull();
    const ends = cb.mock.calls
      .map((c) => c[0] as StageEvent)
      .filter((e) => e.type === "stage_end");
    expect(ends).toHaveLength(1);
    expect((ends[0] as { ok?: boolean }).ok).toBe(false);
    expect((ends[0] as { warning?: string }).warning).toMatch(/video download failed|Object not found/);
    // Gemini Files API must NOT have been hit when the storage download failed
    expect(mockFileUpload).not.toHaveBeenCalled();
  });

  it("returns null + warning when input_mode='video_upload' but video_storage_path is missing", async () => {
    const payloadMissingPath: ContentPayload = {
      ...videoPayload,
      video_storage_path: null,
    } as ContentPayload;

    const cb = vi.fn();
    const result = await detectContentType(payloadMissingPath, mockSupabaseClient, cb);

    expect(result).toBeNull();
    const ends = cb.mock.calls
      .map((c) => c[0] as StageEvent)
      .filter((e) => e.type === "stage_end");
    expect(ends).toHaveLength(1);
    expect((ends[0] as { ok?: boolean }).ok).toBe(true); // graceful skip, not a failure
    expect((ends[0] as { warning?: string }).warning).toContain("no_video_input");
    // No supabase or Gemini calls when there's nothing to download
    expect(mockStorageDownload).not.toHaveBeenCalled();
    expect(mockFileUpload).not.toHaveBeenCalled();
  });
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});
