import { describe, expect, it } from "vitest";
import { apifyVideoSchema } from "../competitor";
import type { ResolvedVideo, IngestErrorKind } from "@/lib/scraping/types";
import { IngestError } from "@/lib/scraping/types";

// ─── apifyVideoSchema ──────────────────────────────────────────────────────

describe("apifyVideoSchema — mediaUrls field (Plan 02 additive extension)", () => {
  const baseVideo = {
    id: "vid_001",
    webVideoUrl: "https://www.tiktok.com/@user/video/vid_001",
    text: "test caption",
    playCount: 10_000,
    diggCount: 500,
    shareCount: 50,
    commentCount: 100,
    collectCount: 200,
    hashtags: [{ name: "test" }],
    videoMeta: { duration: 15 },
  };

  it("parses a video item with mediaUrls present (single-URL resolver item)", () => {
    const item = {
      ...baseVideo,
      mediaUrls: ["https://api.apify.com/v2/key-value-stores/abc/records/video.mp4"],
    };
    const result = apifyVideoSchema.safeParse(item);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mediaUrls).toEqual([
        "https://api.apify.com/v2/key-value-stores/abc/records/video.mp4",
      ]);
    }
  });

  it("parses a legacy video item WITHOUT mediaUrls (scrapeVideos regression — no breakage)", () => {
    const result = apifyVideoSchema.safeParse(baseVideo);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mediaUrls).toBeUndefined();
    }
  });

  it("rejects a mediaUrls entry that is not a valid URL", () => {
    const item = { ...baseVideo, mediaUrls: ["not-a-url"] };
    const result = apifyVideoSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it("accepts videoMeta.subtitleLinks: null (clockworks subtitle-less video — must not drop the whole item)", () => {
    // clockworks returns `null` (not `undefined`) for wordless videos (e.g. khaby.lame).
    // Before the .nullable() fix this rejected the item, silently dropping ALL videos of a
    // subtitle-less profile during calibration.
    const item = { ...baseVideo, videoMeta: { duration: 15, subtitleLinks: null } };
    const result = apifyVideoSchema.safeParse(item);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.videoMeta?.subtitleLinks ?? []).toEqual([]);
    }
  });
});

// ─── IngestError ───────────────────────────────────────────────────────────

describe("IngestError", () => {
  const KINDS: IngestErrorKind[] = [
    "empty_dataset",
    "no_media_url",
    "not_found",
    "ssrf_rejected",
    "scrape_failed",
  ];

  it("is an instance of Error", () => {
    const err = new IngestError("not_found", "https://tiktok.com/@x/video/1");
    expect(err).toBeInstanceOf(Error);
  });

  it("exposes kind and url properties", () => {
    const err = new IngestError("empty_dataset", "https://tiktok.com/@x/video/2");
    expect(err.kind).toBe("empty_dataset");
    expect(err.url).toBe("https://tiktok.com/@x/video/2");
  });

  it.each(KINDS)("kind=%s round-trips correctly", (kind) => {
    const err = new IngestError(kind, "https://tiktok.com/@x/video/3");
    expect(err.kind).toBe(kind);
  });
});

// ─── ResolvedVideo shape ───────────────────────────────────────────────────

describe("ResolvedVideo type contract", () => {
  it("satisfies the expected shape at compile time", () => {
    const resolved: ResolvedVideo = {
      mp4Url: "https://api.apify.com/v2/key-value-stores/abc/records/video.mp4",
      durationSeconds: 15,
    };
    expect(resolved.mp4Url).toBeTruthy();
    expect(typeof resolved.durationSeconds).toBe("number");
  });
});
