/**
 * `video-file` — the video checks lifted out of `VideoUpload` so the new message field can run
 * the same ones. The messages are pinned verbatim: they are what a creator reads today, and the
 * two surfaces must never say different things about the same file.
 */

import { describe, it, expect } from "vitest";

import { VIDEO_ACCEPT, VIDEO_MAX_BYTES, formatLength, validateVideoFile } from "@/lib/video-file";

const WRONG_TYPE = "Please select a video file (MP4, MOV, WebM)";

/** A file that reports `size` without allocating it (a 200 MB buffer per test is wasteful). */
function fileOfSize(name: string, type: string, size: number): File {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

describe("VIDEO_MAX_BYTES / VIDEO_ACCEPT", () => {
  it("is today's 200 MB limit", () => {
    expect(VIDEO_MAX_BYTES).toBe(200 * 1024 * 1024);
  });

  it("is the accept string today's input uses", () => {
    expect(VIDEO_ACCEPT).toBe("video/*");
  });
});

describe("validateVideoFile", () => {
  it.each(["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo", "video/x-matroska"])(
    "accepts a %s file even without a known extension",
    (type) => {
      expect(validateVideoFile(new File(["x"], "clip", { type }))).toBeNull();
    },
  );

  it.each(["clip.mp4", "clip.mov", "clip.webm", "clip.avi", "clip.mkv", "CLIP.MOV"])(
    "accepts %s by its extension when the browser gives no type",
    (name) => {
      expect(validateVideoFile(new File(["x"], name, { type: "" }))).toBeNull();
    },
  );

  it("refuses a file that is not a video", () => {
    expect(validateVideoFile(new File(["x"], "notes.txt", { type: "text/plain" }))).toBe(
      WRONG_TYPE,
    );
  });

  it("checks the type before the size", () => {
    expect(validateVideoFile(fileOfSize("notes.txt", "text/plain", VIDEO_MAX_BYTES + 1))).toBe(
      WRONG_TYPE,
    );
  });

  it("accepts a video of exactly the limit", () => {
    expect(validateVideoFile(fileOfSize("clip.mp4", "video/mp4", VIDEO_MAX_BYTES))).toBeNull();
  });

  it("refuses a video over the limit with its size in the message", () => {
    expect(validateVideoFile(fileOfSize("clip.mp4", "video/mp4", VIDEO_MAX_BYTES + 1))).toBe(
      "File too large (200.0 MB). Maximum size is 200MB.",
    );
    expect(validateVideoFile(fileOfSize("clip.mp4", "video/mp4", 1.5 * 1024 * 1024 * 1024))).toBe(
      "File too large (1.5 GB). Maximum size is 200MB.",
    );
  });
});

// Task 4, fix round 2: a webm recorded in the browser reports its length as Infinity until played.
describe("formatLength", () => {
  it("formats a clip's length as the tiles show it", () => {
    expect(formatLength(29.4)).toBe("0:29");
    expect(formatLength(0)).toBe("0:00");
    expect(formatLength(75)).toBe("1:15");
  });

  it("is null for a length that is not a finite number of seconds", () => {
    expect(formatLength(Infinity)).toBeNull();
    expect(formatLength(NaN)).toBeNull();
    expect(formatLength(-1)).toBeNull();
  });
});
