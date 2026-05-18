import { describe, it, expect } from "vitest";
import { normalizeInput } from "../normalize";
import type { AnalysisInput } from "../types";

// Helper: build a minimal valid AnalysisInput for text mode
function textInput(overrides?: Partial<AnalysisInput>): AnalysisInput {
  return {
    input_mode: "text",
    content_text: "Hello world",
    content_type: "post",
    ...overrides,
  } as AnalysisInput;
}

// =====================================================
// Hashtag extraction
// =====================================================

describe("normalizeInput — hashtag extraction", () => {
  it("extracts hashtags from text", () => {
    const result = normalizeInput(
      textInput({ content_text: "Check out #viral and #trending content" })
    );
    expect(result.hashtags).toEqual(["#viral", "#trending"]);
  });

  it("lowercases hashtags", () => {
    const result = normalizeInput(
      textInput({ content_text: "#Viral #TRENDING" })
    );
    expect(result.hashtags).toEqual(["#viral", "#trending"]);
  });

  it("deduplicates hashtags", () => {
    const result = normalizeInput(
      textInput({ content_text: "#viral #viral" })
    );
    expect(result.hashtags).toHaveLength(1);
    expect(result.hashtags[0]).toBe("#viral");
  });

  it("returns empty array when no hashtags", () => {
    const result = normalizeInput(
      textInput({ content_text: "No hashtags here" })
    );
    expect(result.hashtags).toEqual([]);
  });

  it("handles Unicode hashtags", () => {
    const result = normalizeInput(
      textInput({ content_text: "#café #résumé" })
    );
    expect(result.hashtags).toContain("#café");
    expect(result.hashtags).toContain("#résumé");
  });

  it("defaults to empty hashtags when content_text is undefined", () => {
    const result = normalizeInput(
      textInput({ content_text: undefined })
    );
    expect(result.hashtags).toEqual([]);
    expect(result.content_text).toBe("");
  });
});

// =====================================================
// Duration extraction
// =====================================================

describe("normalizeInput — duration extraction", () => {
  it('extracts seconds from "30s"', () => {
    const result = normalizeInput(
      textInput({ content_text: "This 30s video is great" })
    );
    expect(result.duration_hint).toBe(30);
  });

  it('extracts seconds from "60 seconds"', () => {
    const result = normalizeInput(
      textInput({ content_text: "Watch this 60 seconds clip" })
    );
    expect(result.duration_hint).toBe(60);
  });

  it("converts minutes to seconds", () => {
    const result = normalizeInput(
      textInput({ content_text: "A 2 min tutorial" })
    );
    expect(result.duration_hint).toBe(120);
  });

  it("returns null when no duration hint", () => {
    const result = normalizeInput(
      textInput({ content_text: "Great content" })
    );
    expect(result.duration_hint).toBeNull();
  });

  it("is case insensitive", () => {
    const result = normalizeInput(
      textInput({ content_text: "15 Seconds of fame" })
    );
    expect(result.duration_hint).toBe(15);
  });
});

// =====================================================
// Input modes
// =====================================================

describe("normalizeInput — input modes", () => {
  it("handles text mode", () => {
    const result = normalizeInput({
      input_mode: "text",
      content_text: "Hello world",
      content_type: "post",
    } as AnalysisInput);

    expect(result.input_mode).toBe("text");
    expect(result.content_text).toBe("Hello world");
    expect(result.video_url).toBeNull();
  });

  it("handles tiktok_url mode", () => {
    const result = normalizeInput({
      input_mode: "tiktok_url",
      tiktok_url: "https://tiktok.com/@user/video/123",
      content_type: "video",
    } as AnalysisInput);

    expect(result.input_mode).toBe("tiktok_url");
    expect(result.video_url).toBe("https://tiktok.com/@user/video/123");
  });

  it("handles video_upload mode (Option A — video_url is null; video_storage_path carries the key)", () => {
    const result = normalizeInput({
      input_mode: "video_upload",
      video_storage_path: "uploads/vid.mp4",
      content_type: "video",
    } as AnalysisInput);

    expect(result.input_mode).toBe("video_upload");
    // GAP-04-01 regression-lock: video_url is NEVER aliased to a storage key. The detector
    // reads video_storage_path explicitly; re-introducing the alias would make fetch() throw
    // on the raw key in production (the original bug).
    expect(result.video_url).toBeNull();
    expect(result.video_storage_path).toBe("uploads/vid.mp4");
  });

  it("GAP-04-01 regression-lock: tiktok_url mode does NOT populate video_storage_path", () => {
    const result = normalizeInput({
      input_mode: "tiktok_url",
      tiktok_url: "https://tiktok.com/@user/video/123",
      content_type: "video",
    } as AnalysisInput);

    expect(result.video_url).toBe("https://tiktok.com/@user/video/123");
    // Locks the inverse contract: tiktok_url mode never leaks into video_storage_path
    expect(result.video_storage_path).toBeNull();
  });

  it("GAP-04-01 regression-lock: video_upload mode never aliases video_storage_path into video_url", () => {
    // Production-shaped raw storage key (no scheme, no host)
    const result = normalizeInput({
      input_mode: "video_upload",
      video_storage_path: "user-abc/private/video.mp4",
      content_type: "video",
    } as AnalysisInput);

    // The original bug: video_url was set to "user-abc/private/video.mp4" (a non-URL),
    // and fetch(payload.video_url) threw TypeError in production. This lock prevents the
    // alias from coming back even if a future refactor "innocently" adds `?? input.video_storage_path`.
    expect(result.video_url).toBeNull();
    expect(result.video_storage_path).toBe("user-abc/private/video.mp4");
  });

  it("defaults optional fields to null", () => {
    const result = normalizeInput(
      textInput({ content_text: "Hello" })
    );

    expect(result.niche).toBeNull();
    expect(result.creator_handle).toBeNull();
    expect(result.society_id).toBeNull();
  });

  it("passes through niche and creator_handle", () => {
    const result = normalizeInput(
      textInput({
        content_text: "Hello",
        niche: "fitness",
        creator_handle: "@user",
      })
    );

    expect(result.niche).toBe("fitness");
    expect(result.creator_handle).toBe("@user");
  });
});
