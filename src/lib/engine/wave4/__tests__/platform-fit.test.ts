import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ContentPayload } from "../../types";
import type { CreatorContext } from "../../creator";

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  })),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

const { mockCreate, mockIsCircuitOpen } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockIsCircuitOpen: vi.fn(() => false),
}));

vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockCreate } };
  });
  return { default: MockOpenAI };
});

vi.mock("../../deepseek", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../../deepseek")>();
  return { ...orig, isCircuitOpen: mockIsCircuitOpen };
});

process.env.DEEPSEEK_API_KEY = "test-key";

import { runPlatformFit } from "../platform-fit";
import type { PlatformFitResult } from "../../types";

function mockResponse(
  data: { platform_fits: Array<{ platform: string; fit_score: number; rationale: string; watermark_penalty?: boolean }> },
  usage?: Partial<{ prompt_cache_hit_tokens: number; prompt_cache_miss_tokens: number; completion_tokens: number }>,
) {
  return {
    choices: [{ message: { content: JSON.stringify(data) } }],
    usage: {
      prompt_cache_hit_tokens: usage?.prompt_cache_hit_tokens ?? 0,
      prompt_cache_miss_tokens: usage?.prompt_cache_miss_tokens ?? 500,
      completion_tokens: usage?.completion_tokens ?? 100,
    },
  };
}

const payload: ContentPayload = {
  input_mode: "video_upload",
  content_text: "GRWM for date night — full routine in 60 seconds",
  content_type: "video",
  hashtags: ["beauty", "makeup", "grwm"],
  duration_hint: 60,
} as unknown as ContentPayload;

const creatorContext: CreatorContext = {
  target_platforms: ["tiktok", "instagram"],
  follower_count: 50000,
  niche: "beauty",
} as CreatorContext;

describe("runPlatformFit — ALGO-01..06", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ALGO-01: Basic platform fit scoring
  it("ALGO-01: returns non-null PlatformFitResult array for valid input", async () => {
    mockCreate.mockResolvedValueOnce(
      mockResponse({
        platform_fits: [
          { platform: "tiktok", fit_score: 72, rationale: "Strong hook fits TikTok's fast-paced format" },
          { platform: "instagram", fit_score: 45, rationale: "Visual storytelling could be stronger" },
        ],
      }),
    );

    const result = await runPlatformFit(payload, creatorContext, null, null);
    expect(result).not.toBeNull();
    expect(Array.isArray(result)).toBe(true);
    expect(result!.length).toBeGreaterThan(0);
    expect(result![0]!.platform).toBe("tiktok");
    expect(result![0]!.fit_score).toBe(72);
  });

  // ALGO-02: Platform-specific score variation
  it("ALGO-02: returns different fit scores for different platforms", async () => {
    mockCreate.mockResolvedValueOnce(
      mockResponse({
        platform_fits: [
          { platform: "tiktok", fit_score: 82, rationale: "Fast pace suits TikTok" },
          { platform: "instagram", fit_score: 35, rationale: "Not enough visual hooks for Reels" },
        ],
      }),
    );

    const result = await runPlatformFit(payload, creatorContext, null, null);
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThanOrEqual(2);
    const scores = result!.map((r: PlatformFitResult) => r.fit_score);
    expect(new Set(scores).size).toBeGreaterThan(1);
  });

  // ALGO-03: Watermark penalty
  it("ALGO-03: returns watermark_penalty=true when watermark detected in user message", async () => {
    mockCreate.mockResolvedValueOnce(
      mockResponse({
        platform_fits: [
          {
            platform: "tiktok",
            fit_score: 40,
            rationale: "IG watermark visible — penalized",
            watermark_penalty: true,
          },
        ],
      }),
    );

    const watermarkDetected = { tiktok: false, ig: true, yt: false };
    const result = await runPlatformFit(payload, creatorContext, null, watermarkDetected);
    expect(result).not.toBeNull();
    const withPenalty = result!.filter((r: PlatformFitResult) => r.watermark_penalty === true);
    expect(withPenalty.length).toBeGreaterThan(0);
    expect(withPenalty[0]!.watermark_penalty).toBe(true);
  });

  // ALGO-04: Score range validation
  it("ALGO-04: fit_score is always 0-100 inclusive", async () => {
    mockCreate.mockResolvedValueOnce(
      mockResponse({
        platform_fits: [
          { platform: "tiktok", fit_score: 100, rationale: "Perfect fit" },
          { platform: "instagram", fit_score: 0, rationale: "No fit at all" },
        ],
      }),
    );

    const result = await runPlatformFit(payload, creatorContext, null, null);
    expect(result).not.toBeNull();
    for (const r of result!) {
      expect(r.fit_score).toBeGreaterThanOrEqual(0);
      expect(r.fit_score).toBeLessThanOrEqual(100);
    }
  });

  // ALGO-05: Rationale generation
  it("ALGO-05: returns non-empty rationale strings", async () => {
    mockCreate.mockResolvedValueOnce(
      mockResponse({
        platform_fits: [
          { platform: "tiktok", fit_score: 72, rationale: "Hook uses specificity pattern which performs well on TikTok's scroll-optimized feed." },
          { platform: "instagram", fit_score: 45, rationale: "Content lacks strong visual storytelling for muted Reels viewing." },
        ],
      }),
    );

    const result = await runPlatformFit(payload, creatorContext, null, null);
    expect(result).not.toBeNull();
    for (const r of result!) {
      expect(r.rationale).toBeTruthy();
      expect(r.rationale.length).toBeGreaterThan(0);
    }
  });

  // ALGO-06: Degraded input handling
  it("ALGO-06: returns null when platform fit cannot be determined (circuit open)", async () => {
    mockIsCircuitOpen.mockReturnValueOnce(true);

    const result = await runPlatformFit(payload, creatorContext, null, null);
    expect(result).toBeNull();
  });

  it("returns null when V3 response is invalid JSON", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "not valid json" } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    });

    const result = await runPlatformFit(payload, creatorContext, null, null);
    expect(result).toBeNull();
  });

  it("returns null when OpenAI throws", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API error"));

    const result = await runPlatformFit(payload, creatorContext, null, null);
    expect(result).toBeNull();
  });
});
