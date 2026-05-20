import { describe, it, expect } from "vitest";
import type { ContentPayload } from "../../types";
import type { CreatorContext } from "../../creator";

process.env.DEEPSEEK_API_KEY = "test-key";

import {
  STABLE_PLATFORM_FIT_SYSTEM_PROMPT,
  buildPlatformFitUserMessage,
  PlatformFitResponseSchema,
} from "../platform-fit-prompts";

describe("STABLE_PLATFORM_FIT_SYSTEM_PROMPT", () => {
  it("is a non-empty string", () => {
    expect(STABLE_PLATFORM_FIT_SYSTEM_PROMPT).toBeTruthy();
    expect(typeof STABLE_PLATFORM_FIT_SYSTEM_PROMPT).toBe("string");
    expect(STABLE_PLATFORM_FIT_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("contains platform-specific heuristics for TikTok", () => {
    expect(STABLE_PLATFORM_FIT_SYSTEM_PROMPT.toLowerCase()).toContain("tiktok");
  });

  it("contains platform-specific heuristics for Instagram Reels", () => {
    expect(STABLE_PLATFORM_FIT_SYSTEM_PROMPT.toLowerCase()).toContain("instagram");
  });

  it("contains platform-specific heuristics for YouTube Shorts", () => {
    const lower = STABLE_PLATFORM_FIT_SYSTEM_PROMPT.toLowerCase();
    expect(lower).toContain("youtube") || expect(lower).toContain("shorts");
  });

  it("includes watermark detection instructions", () => {
    const lower = STABLE_PLATFORM_FIT_SYSTEM_PROMPT.toLowerCase();
    expect(lower).toContain("watermark");
  });
});

describe("buildPlatformFitUserMessage", () => {
  const payload: ContentPayload = {
    input_mode: "video_upload",
    content_text: "GRWM for date night",
    content_type: "video",
    hashtags: ["beauty", "makeup", "grwm"],
    duration_hint: 45,
  } as unknown as ContentPayload;

  const creatorContext: CreatorContext = {
    target_platforms: ["tiktok", "instagram"],
    follower_count: 50000,
    niche: "beauty",
  } as CreatorContext;

  it("returns a non-empty string with default args", () => {
    const result = buildPlatformFitUserMessage(payload, creatorContext, null, null);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(50);
  });

  it("includes target platforms from creator context", () => {
    const result = buildPlatformFitUserMessage(payload, creatorContext, null, null);
    expect(result).toContain("tiktok");
    expect(result).toContain("instagram");
  });

  it("defaults to TikTok when target_platforms is empty/null", () => {
    const noPlatforms: CreatorContext = { ...creatorContext, target_platforms: null };
    const result = buildPlatformFitUserMessage(payload, noPlatforms, null, null);
    expect(result).toContain("tiktok");
  });

  it("includes follower tier information", () => {
    const result = buildPlatformFitUserMessage(payload, creatorContext, null, null);
    const lower = result.toLowerCase();
    expect(lower).toContain("follower");
  });

  it("includes watermark detection info when provided", () => {
    const watermark = { tiktok: true, ig: false, yt: false };
    const result = buildPlatformFitUserMessage(payload, creatorContext, null, watermark);
    expect(result).toContain("TikTok");
  });

  it("includes content caption and hashtags", () => {
    const result = buildPlatformFitUserMessage(payload, creatorContext, null, null);
    expect(result).toContain("GRWM for date night");
    expect(result).toContain("beauty");
    expect(result).toContain("makeup");
  });
});

describe("PlatformFitResponseSchema", () => {
  it("validates a correct single-platform response", () => {
    const input = {
      platform_fits: [
        { platform: "tiktok", fit_score: 72, rationale: "Strong hook fits TikTok format" },
      ],
    };
    const result = PlatformFitResponseSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.platform_fits).toHaveLength(1);
      expect(result.data.platform_fits[0]!.platform).toBe("tiktok");
      expect(result.data.platform_fits[0]!.fit_score).toBe(72);
    }
  });

  it("validates a correct multi-platform response", () => {
    const input = {
      platform_fits: [
        { platform: "tiktok", fit_score: 72, rationale: "Good hook speed", watermark_penalty: false },
        { platform: "instagram", fit_score: 55, rationale: "Visual storytelling lacking" },
        { platform: "youtube_shorts", fit_score: 30, rationale: "Too short for YT audience" },
      ],
    };
    const result = PlatformFitResponseSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.platform_fits).toHaveLength(3);
    }
  });

  it("rejects fit_score below 0", () => {
    const input = {
      platform_fits: [
        { platform: "tiktok", fit_score: -5, rationale: "Bad" },
      ],
    };
    const result = PlatformFitResponseSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects fit_score above 100", () => {
    const input = {
      platform_fits: [
        { platform: "tiktok", fit_score: 150, rationale: "Over max" },
      ],
    };
    const result = PlatformFitResponseSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects empty rationale string", () => {
    const input = {
      platform_fits: [
        { platform: "tiktok", fit_score: 50, rationale: "" },
      ],
    };
    const result = PlatformFitResponseSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("accepts optional watermark_penalty field", () => {
    const input = {
      platform_fits: [
        { platform: "tiktok", fit_score: 50, rationale: "Test", watermark_penalty: true },
      ],
    };
    const result = PlatformFitResponseSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});
