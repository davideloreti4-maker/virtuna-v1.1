import { describe, it, expect } from "vitest";
import {
  computeChannelMetrics,
  CHANNEL_BASELINE_LABEL,
} from "../compute-channel-metrics";
import type { VideoData } from "@/lib/scraping/types";

/** Minimal VideoData factory — only the fields compute-channel-metrics reads matter. */
function mkVideo(overrides: Partial<VideoData>): VideoData {
  return {
    platformVideoId: "v",
    videoUrl: "https://tiktok.com/@x/video/1",
    caption: "c",
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    hashtags: [],
    durationSeconds: 10,
    postedAt: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  };
}

describe("computeChannelMetrics", () => {
  it("uses the channel's median views as the baseline and divides for the multiplier", () => {
    const videos = [
      mkVideo({ views: 100 }),
      mkVideo({ views: 200 }),
      mkVideo({ views: 300 }),
    ];
    const { baseline, metrics } = computeChannelMetrics(videos);

    expect(baseline).toBe(200); // median of [100,200,300]
    expect(metrics.map((m) => m.outlierMultiplier)).toEqual([0.5, 1, 1.5]);
  });

  it("computes engagement_rate as (likes+comments+shares)/views", () => {
    const videos = [mkVideo({ views: 100, likes: 10, comments: 5, shares: 5 })];
    const { metrics } = computeChannelMetrics(videos);
    expect(metrics[0]!.engagementRate).toBeCloseTo(0.2, 10);
  });

  it("never divides by zero: views=0 yields multiplier 0 and engagement 0", () => {
    const videos = [
      mkVideo({ views: 200 }),
      mkVideo({ views: 0, likes: 9, comments: 9, shares: 9 }),
    ];
    const { metrics } = computeChannelMetrics(videos);
    expect(metrics[1]!.outlierMultiplier).toBe(0);
    expect(metrics[1]!.engagementRate).toBe(0);
  });

  it("falls back to baseline=1 for an all-zero-views channel (no NaN/Infinity)", () => {
    const { baseline, metrics } = computeChannelMetrics([
      mkVideo({ views: 0 }),
      mkVideo({ views: 0 }),
    ]);
    expect(baseline).toBe(1);
    expect(metrics.every((m) => m.outlierMultiplier === 0)).toBe(true);
  });

  it("handles an empty bundle (baseline=1, no metrics)", () => {
    const { baseline, metrics } = computeChannelMetrics([]);
    expect(baseline).toBe(1);
    expect(metrics).toEqual([]);
  });

  it("exposes the honest single-channel baseline label", () => {
    expect(CHANNEL_BASELINE_LABEL).toBe("vs own");
  });
});
