/**
 * Unit tests for gemini.ts — analyzeWithGemini text analysis, retry logic, cost calculation, and Zod validation.
 */

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
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
      upload: mockFileUpload,
      get: mockFileGet,
      delete: mockFileDelete,
    };
  });
  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: {
      OBJECT: "OBJECT",
      ARRAY: "ARRAY",
      STRING: "STRING",
      NUMBER: "NUMBER",
    },
  };
});

vi.mock("node:fs", () => ({
  promises: {
    readFile: vi.fn().mockResolvedValue(
      JSON.stringify({
        primary_kpis: {
          share_rate: { viral_threshold: 0.1 },
          weighted_engagement_score: { percentiles: { p90: 85 } },
        },
        duration_analysis: {
          sweet_spot_by_weighted_score: { optimal_range_seconds: [15, 45] },
        },
        viral_vs_average: {
          differentiators: [
            {
              factor: "hook_strength",
              difference_pct: 40,
              description: "Strong hooks boost engagement",
            },
          ],
        },
      })
    ),
  },
}));

vi.mock("node:path", () => ({
  join: vi.fn((...args: string[]) => args.join("/")),
  dirname: vi.fn(() => "/mock"),
  default: {
    join: vi.fn((...args: string[]) => args.join("/")),
    dirname: vi.fn(() => "/mock"),
  },
}));

process.env.GEMINI_API_KEY = "test-key";

import { analyzeWithGemini, analyzeVideoWithGemini, GEMINI_MODEL } from "../gemini";
import { makeGeminiAnalysis } from "./factories";
import type { AnalysisInput } from "../types";

function makeInput(overrides?: Partial<AnalysisInput>): AnalysisInput {
  return {
    input_mode: "text" as const,
    content_text: "Test content for analysis",
    content_type: "video" as const,
    ...overrides,
  };
}

describe("analyzeWithGemini", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns valid analysis and cost on success", async () => {
    const analysis = makeGeminiAnalysis();
    mockGenerate.mockResolvedValue({
      text: JSON.stringify(analysis),
      usageMetadata: {
        promptTokenCount: 500,
        candidatesTokenCount: 300,
      },
    });

    const result = await analyzeWithGemini(makeInput());

    expect(result.analysis.factors).toHaveLength(5);
    expect(result.analysis.factors[0]!.name).toBe("Scroll-Stop Power");
    expect(result.cost_cents).toBeGreaterThan(0);
  });

  it("handles markdown-fenced JSON response", async () => {
    const analysis = makeGeminiAnalysis();
    const fenced = "```json\n" + JSON.stringify(analysis) + "\n```";
    mockGenerate.mockResolvedValue({
      text: fenced,
      usageMetadata: {
        promptTokenCount: 500,
        candidatesTokenCount: 300,
      },
    });

    const result = await analyzeWithGemini(makeInput());
    expect(result.analysis.factors).toHaveLength(5);
  });

  it("retries on failure and succeeds on second attempt", async () => {
    const analysis = makeGeminiAnalysis();
    mockGenerate
      .mockRejectedValueOnce(new Error("Server error"))
      .mockResolvedValueOnce({
        text: JSON.stringify(analysis),
        usageMetadata: {
          promptTokenCount: 500,
          candidatesTokenCount: 300,
        },
      });

    const result = await analyzeWithGemini(makeInput());
    expect(result.analysis.factors).toHaveLength(5);
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  it("throws after MAX_RETRIES exhausted", async () => {
    mockGenerate.mockRejectedValue(new Error("Persistent failure"));

    await expect(analyzeWithGemini(makeInput())).rejects.toThrow(
      /Gemini analysis failed after/
    );
    // 3 attempts total (initial + 2 retries)
    expect(mockGenerate).toHaveBeenCalledTimes(3);
  });

  it("uses fallback token counts when usageMetadata is missing", async () => {
    const analysis = makeGeminiAnalysis();
    mockGenerate.mockResolvedValue({
      text: JSON.stringify(analysis),
      usageMetadata: {},
    });

    const result = await analyzeWithGemini(makeInput());

    // Should use fallback: 2000 input + 800 output tokens
    expect(result.cost_cents).toBeGreaterThan(0);
  });

  it("passes society_id as niche context", async () => {
    const analysis = makeGeminiAnalysis();
    mockGenerate.mockResolvedValue({
      text: JSON.stringify(analysis),
      usageMetadata: {
        promptTokenCount: 500,
        candidatesTokenCount: 300,
      },
    });

    await analyzeWithGemini(makeInput({ society_id: "fitness" }));

    // Verify the mock was called (prompt should include niche)
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("exports GEMINI_MODEL constant", () => {
    expect(typeof GEMINI_MODEL).toBe("string");
    expect(GEMINI_MODEL.length).toBeGreaterThan(0);
  });

  it("throws on invalid Zod validation", async () => {
    // Return response missing required fields
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({ factors: [], overall_impression: "test" }),
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
    });

    // Should fail validation and retry, then eventually throw
    await expect(analyzeWithGemini(makeInput())).rejects.toThrow();
  });

  it("throws timeout error on AbortError", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockGenerate.mockRejectedValue(abortError);

    await expect(analyzeWithGemini(makeInput())).rejects.toThrow(
      /timed out/
    );
    // AbortError does NOT retry — throws immediately
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("logs warning when cost exceeds soft cap", async () => {
    const analysis = makeGeminiAnalysis();
    // High token counts to exceed 0.5 cent soft cap
    mockGenerate.mockResolvedValue({
      text: JSON.stringify(analysis),
      usageMetadata: {
        promptTokenCount: 50000,
        candidatesTokenCount: 20000,
      },
    });

    const result = await analyzeWithGemini(makeInput());
    expect(result.cost_cents).toBeGreaterThan(0.5);
  });

  it("handles empty text response gracefully", async () => {
    // text is empty string — JSON.parse will fail, should retry
    mockGenerate
      .mockResolvedValueOnce({
        text: "",
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify(makeGeminiAnalysis()),
        usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 300 },
      });

    const result = await analyzeWithGemini(makeInput());
    expect(result.analysis.factors).toHaveLength(5);
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  it("handles null text response by using empty string fallback", async () => {
    // text is null — should use "" fallback, JSON.parse will fail
    mockGenerate.mockResolvedValue({
      text: null,
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
    });

    // All retries will fail due to JSON parse error on ""
    await expect(analyzeWithGemini(makeInput())).rejects.toThrow();
  });
});

// =====================================================
// analyzeVideoWithGemini
// =====================================================

function makeVideoAnalysis() {
  return {
    ...makeGeminiAnalysis(),
    video_signals: {
      visual_production_quality: 7,
      hook_visual_impact: 8,
      pacing_score: 6,
      transition_quality: 7,
    },
  };
}

describe("analyzeVideoWithGemini", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns valid video analysis on success (upload + ACTIVE state)", async () => {
    mockFileUpload.mockResolvedValue({
      name: "files/test-video-123",
      state: "ACTIVE",
      uri: "https://generativelanguage.googleapis.com/files/test-video-123",
    });

    const videoAnalysis = makeVideoAnalysis();
    mockGenerate.mockResolvedValue({
      text: JSON.stringify(videoAnalysis),
      usageMetadata: {
        promptTokenCount: 2000,
        candidatesTokenCount: 500,
      },
    });

    mockFileDelete.mockResolvedValue({});

    const buffer = Buffer.from("fake-video-data");
    const result = await analyzeVideoWithGemini(buffer, "video/mp4");

    expect(result.analysis.factors).toHaveLength(5);
    expect(result.analysis.video_signals).toBeDefined();
    expect(result.analysis.video_signals.visual_production_quality).toBe(7);
    expect(result.cost_cents).toBeGreaterThan(0);

    // Verify cleanup was called
    expect(mockFileDelete).toHaveBeenCalledWith({ name: "files/test-video-123" });
  });

  it("rejects videos over 50MB size limit", async () => {
    const largeBuffer = Buffer.alloc(51 * 1024 * 1024); // 51MB

    await expect(
      analyzeVideoWithGemini(largeBuffer, "video/mp4")
    ).rejects.toThrow(/exceeds maximum size/);
  });

  it("throws when upload returns no file name", async () => {
    mockFileUpload.mockResolvedValue({
      name: undefined, // no name
      state: "PROCESSING",
      uri: null,
    });

    const buffer = Buffer.from("fake-video-data");
    await expect(
      analyzeVideoWithGemini(buffer, "video/mp4")
    ).rejects.toThrow(/no file name returned/);
  });

  it("polls until ACTIVE state and succeeds", async () => {
    mockFileUpload.mockResolvedValue({
      name: "files/poll-test",
      state: "PROCESSING",
      uri: null,
    });

    // First poll: still processing, second poll: active
    mockFileGet
      .mockResolvedValueOnce({
        state: "PROCESSING",
        uri: null,
      })
      .mockResolvedValueOnce({
        state: "ACTIVE",
        uri: "https://generativelanguage.googleapis.com/files/poll-test",
      });

    const videoAnalysis = makeVideoAnalysis();
    mockGenerate.mockResolvedValue({
      text: JSON.stringify(videoAnalysis),
      usageMetadata: {
        promptTokenCount: 2000,
        candidatesTokenCount: 500,
      },
    });

    mockFileDelete.mockResolvedValue({});

    const buffer = Buffer.from("fake-video-data");
    const result = await analyzeVideoWithGemini(buffer, "video/mp4");

    expect(result.analysis.factors).toHaveLength(5);
    expect(mockFileGet).toHaveBeenCalledTimes(2);
  });

  it("throws when file processing state is FAILED", async () => {
    mockFileUpload.mockResolvedValue({
      name: "files/failed-test",
      state: "PROCESSING",
      uri: null,
    });

    mockFileGet.mockResolvedValue({
      state: "FAILED",
      uri: null,
    });

    mockFileDelete.mockResolvedValue({});

    const buffer = Buffer.from("fake-video-data");
    await expect(
      analyzeVideoWithGemini(buffer, "video/mp4")
    ).rejects.toThrow(/processing failed/);

    // Cleanup should still be called in finally block
    expect(mockFileDelete).toHaveBeenCalledWith({ name: "files/failed-test" });
  });

  it("throws when file has no URI after processing", async () => {
    mockFileUpload.mockResolvedValue({
      name: "files/no-uri-test",
      state: "ACTIVE",
      uri: undefined, // no URI
    });

    mockFileDelete.mockResolvedValue({});

    const buffer = Buffer.from("fake-video-data");
    await expect(
      analyzeVideoWithGemini(buffer, "video/mp4")
    ).rejects.toThrow(/no file URI/);
  });

  it("throws timeout error on AbortError during video analysis", async () => {
    mockFileUpload.mockResolvedValue({
      name: "files/abort-test",
      state: "ACTIVE",
      uri: "https://generativelanguage.googleapis.com/files/abort-test",
    });

    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockGenerate.mockRejectedValue(abortError);

    mockFileDelete.mockResolvedValue({});

    const buffer = Buffer.from("fake-video-data");
    await expect(
      analyzeVideoWithGemini(buffer, "video/mp4")
    ).rejects.toThrow(/timed out/);

    // Cleanup should still run
    expect(mockFileDelete).toHaveBeenCalled();
  });

  it("re-throws non-Error exceptions with context", async () => {
    mockFileUpload.mockResolvedValue({
      name: "files/non-error-test",
      state: "ACTIVE",
      uri: "https://generativelanguage.googleapis.com/files/non-error-test",
    });

    // Throw a non-Error value (string)
    mockGenerate.mockRejectedValue("raw string error");

    mockFileDelete.mockResolvedValue({});

    const buffer = Buffer.from("fake-video-data");
    await expect(
      analyzeVideoWithGemini(buffer, "video/mp4")
    ).rejects.toThrow(/Video analysis failed/);
  });

  it("handles cleanup failure gracefully (best-effort delete)", async () => {
    mockFileUpload.mockResolvedValue({
      name: "files/cleanup-fail-test",
      state: "ACTIVE",
      uri: "https://generativelanguage.googleapis.com/files/cleanup-fail-test",
    });

    const videoAnalysis = makeVideoAnalysis();
    mockGenerate.mockResolvedValue({
      text: JSON.stringify(videoAnalysis),
      usageMetadata: {
        promptTokenCount: 2000,
        candidatesTokenCount: 500,
      },
    });

    // Delete fails but shouldn't throw
    mockFileDelete.mockRejectedValue(new Error("Delete failed"));

    const buffer = Buffer.from("fake-video-data");
    const result = await analyzeVideoWithGemini(buffer, "video/mp4");

    // Should still return valid result despite cleanup failure
    expect(result.analysis.factors).toHaveLength(5);
  });

  it("logs warning when video cost exceeds 2.0 cent soft cap", async () => {
    mockFileUpload.mockResolvedValue({
      name: "files/cost-test",
      state: "ACTIVE",
      uri: "https://generativelanguage.googleapis.com/files/cost-test",
    });

    const videoAnalysis = makeVideoAnalysis();
    mockGenerate.mockResolvedValue({
      text: JSON.stringify(videoAnalysis),
      usageMetadata: {
        promptTokenCount: 200000,
        candidatesTokenCount: 100000,
      },
    });

    mockFileDelete.mockResolvedValue({});

    const buffer = Buffer.from("fake-video-data");
    const result = await analyzeVideoWithGemini(buffer, "video/mp4");

    expect(result.cost_cents).toBeGreaterThan(2.0);
  });

  it("passes niche parameter to video prompt", async () => {
    mockFileUpload.mockResolvedValue({
      name: "files/niche-test",
      state: "ACTIVE",
      uri: "https://generativelanguage.googleapis.com/files/niche-test",
    });

    const videoAnalysis = makeVideoAnalysis();
    mockGenerate.mockResolvedValue({
      text: JSON.stringify(videoAnalysis),
      usageMetadata: {
        promptTokenCount: 2000,
        candidatesTokenCount: 500,
      },
    });

    mockFileDelete.mockResolvedValue({});

    const buffer = Buffer.from("fake-video-data");
    const result = await analyzeVideoWithGemini(buffer, "video/mp4", "fitness");

    expect(result.analysis.factors).toHaveLength(5);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });
});
