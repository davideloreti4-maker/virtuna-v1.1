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

// Mock global fetch for video URL fetch (succeeds with a tiny buffer)
const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  } as unknown as Response));
});

process.env.GEMINI_API_KEY = "test-key";
process.env.GEMINI_WAVE0_MODEL = "gemini-3-flash-preview";

import { detectContentType } from "../wave0/content-type-detector";

const videoPayload: ContentPayload = {
  input_mode: "video_upload",
  video_url: "https://test-bucket.supabase.co/video.mp4",
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
  });

  it("returns valid Wave0ContentTypeResult on Gemini success (7-cat enum)", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({ type: "talking_head", confidence: 0.85, mixed: false }),
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 80 },
    });
    const cb = vi.fn();
    const result = await detectContentType(videoPayload, cb);
    expect(result).toEqual({ type: "talking_head", confidence: 0.85 });
    const events = cb.mock.calls.map((c) => c[0] as StageEvent);
    expect(events.some((e) => e.type === "stage_start" && (e as { stage?: string }).stage === "wave_0_content_type")).toBe(true);
    expect(events.some((e) => e.type === "stage_end" && (e as { stage?: string }).stage === "wave_0_content_type" && (e as { ok?: boolean }).ok === true)).toBe(true);
  });

  it("returns null when input_mode !== video_upload (no_video_input warning)", async () => {
    const cb = vi.fn();
    const result = await detectContentType(textPayload, cb);
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
    const result = await detectContentType(videoPayload, cb);
    expect(result).toBeNull();
    const ends = cb.mock.calls.map((c) => c[0] as StageEvent).filter((e) => e.type === "stage_end");
    expect((ends[0] as { ok?: boolean }).ok).toBe(false);
    expect((ends[0] as { warning?: string }).warning).toBeTruthy();
  });

  it("returns null when file state goes FAILED", async () => {
    mockFileUpload.mockResolvedValue({ name: "files/abc", state: "FAILED", uri: null });
    const cb = vi.fn();
    const result = await detectContentType(videoPayload, cb);
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
    const result = await detectContentType(videoPayload, cb);
    expect(result).toBeNull();
  });

  it("emits both stage_start AND stage_end with wave=0 in every code path", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({ type: "vlog", confidence: 0.7, mixed: false }),
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 80 },
    });
    const cb = vi.fn();
    await detectContentType(videoPayload, cb);
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
    await detectContentType(videoPayload, cb);
    const ends = cb.mock.calls.map((c) => c[0] as StageEvent).filter((e) => e.type === "stage_end");
    expect((ends[0] as { cost_cents?: number }).cost_cents).toBeGreaterThan(0);
    expect((ends[0] as { cost_cents?: number }).cost_cents).toBeLessThan(0.5);
  });

  it("warning is 'low_confidence' when confidence < 0.6", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({ type: "other", confidence: 0.4, mixed: false }),
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 80 },
    });
    const result = await detectContentType(videoPayload, undefined);
    expect(result?.warning).toBe("low_confidence");
  });

  it("warning is 'mixed_content_detected' when raw.mixed === true", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({ type: "slideshow", confidence: 0.8, mixed: true, dominant_seconds: 3 }),
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 80 },
    });
    const result = await detectContentType(videoPayload, undefined);
    expect(result?.warning).toBe("mixed_content_detected");
  });

  it("does not call generateContent when input_mode is text", async () => {
    await detectContentType(textPayload, undefined);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockFileUpload).not.toHaveBeenCalled();
  });
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});
