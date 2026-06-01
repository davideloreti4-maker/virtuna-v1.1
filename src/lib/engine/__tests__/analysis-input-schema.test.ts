/**
 * Unit tests for AnalysisInputSchema — mode enum, default, and remix+text refine.
 * Task 1 (RED): these tests fail against the current schema (no mode field yet).
 * Phase 02-01, REMIX-01/REMIX-02.
 */
import { describe, it, expect } from "vitest";
import { AnalysisInputSchema } from "@/lib/engine/types";

describe("AnalysisInputSchema — mode field", () => {
  it("accepts mode='remix' with tiktok_url input_mode", () => {
    const result = AnalysisInputSchema.parse({
      input_mode: "tiktok_url",
      tiktok_url: "https://www.tiktok.com/@creator/video/1234567890",
      content_type: "video",
      mode: "remix",
    });
    expect(result.mode).toBe("remix");
  });

  it("defaults mode to 'score' when omitted", () => {
    const result = AnalysisInputSchema.parse({
      input_mode: "tiktok_url",
      tiktok_url: "https://www.tiktok.com/@creator/video/1234567890",
      content_type: "video",
    });
    expect(result.mode).toBe("score");
  });

  it("rejects mode='remix' combined with input_mode='text' (refine)", () => {
    expect(() =>
      AnalysisInputSchema.parse({
        input_mode: "text",
        content_text: "some hook idea",
        content_type: "video",
        mode: "remix",
      })
    ).toThrow("Remix mode requires a video or link source, not text");
  });

  it("rejects invalid mode enum value", () => {
    expect(() =>
      AnalysisInputSchema.parse({
        input_mode: "tiktok_url",
        tiktok_url: "https://www.tiktok.com/@creator/video/1234567890",
        content_type: "video",
        mode: "bogus",
      })
    ).toThrow();
  });

  it("accepts mode='score' with video_upload input_mode", () => {
    const result = AnalysisInputSchema.parse({
      input_mode: "video_upload",
      video_storage_path: "user-abc/video.mp4",
      content_type: "video",
      mode: "score",
    });
    expect(result.mode).toBe("score");
  });

  it("accepts mode='remix' with video_upload input_mode", () => {
    const result = AnalysisInputSchema.parse({
      input_mode: "video_upload",
      video_storage_path: "user-abc/viral.mp4",
      content_type: "video",
      mode: "remix",
    });
    expect(result.mode).toBe("remix");
  });
});
