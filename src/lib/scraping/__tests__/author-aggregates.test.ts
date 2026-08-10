import { describe, expect, it } from "vitest";
import { remapClockworksVideo } from "@/lib/scraping/apify-provider";

const item = (authorMeta: unknown) => ({
  id: "123",
  webVideoUrl: "https://www.tiktok.com/@a/video/123",
  text: "caption",
  playCount: 100000,
  diggCount: 26800,
  commentCount: 10,
  shareCount: 5,
  collectCount: 2,
  hashtags: [],
  createTime: 1735689600,
  videoMeta: { duration: 30 },
  authorMeta,
});

describe("remapClockworksVideo — author aggregates", () => {
  it("carries fans / heart / videoCount so a per-author baseline is computable", () => {
    const v = remapClockworksVideo(
      item({ name: "techwitbrianx", fans: 10400, heart: 55700, video: 405 }),
    );
    expect(v?.author).toEqual({
      handle: "techwitbrianx",
      fans: 10400,
      heart: 55700,
      videoCount: 405,
    });
  });

  it("omits author entirely when authorMeta is absent (never zero-fills a denominator)", () => {
    const v = remapClockworksVideo(item(undefined));
    expect(v?.author).toBeUndefined();
  });

  it("omits author when the aggregates are missing, so no false baseline is derived", () => {
    const v = remapClockworksVideo(item({ name: "x" }));
    expect(v?.author).toBeUndefined();
  });
});
