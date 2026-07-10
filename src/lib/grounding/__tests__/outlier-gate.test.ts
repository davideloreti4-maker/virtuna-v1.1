import { describe, it, expect } from "vitest";
import {
  accountMultiplier,
  passesOutlierGate,
  selectCandidates,
  MIN_OUTLIER_MULTIPLIER,
} from "../outlier-gate";
import type { VideoData } from "@/lib/scraping/types";

const NOW = Date.UTC(2026, 6, 10); // fixed clock — no Date.now() jitter in tests

const vid = (over: Partial<VideoData> = {}): VideoData => ({
  platformVideoId: "x",
  videoUrl: "https://tiktok.com/@a/1",
  caption: "c",
  views: 1000,
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
  hashtags: [],
  durationSeconds: 10,
  postedAt: new Date(NOW - 2 * 86_400_000), // 2 days old — inside the 90d window
  ...over,
});

describe("accountMultiplier (durable receipt)", () => {
  it("computes views ÷ followers with the honest 'vs followers' label", () => {
    expect(accountMultiplier(1_200_000, 100_000)).toEqual({
      multiplier: 12,
      baselineLabel: "vs followers",
    });
  });
  it("returns null when follower_count is missing or zero (caller falls back)", () => {
    expect(accountMultiplier(1_000_000, null)).toBeNull();
    expect(accountMultiplier(1_000_000, 0)).toBeNull();
    expect(accountMultiplier(1_000_000, undefined)).toBeNull();
  });
  it("returns null for a nonsense view count", () => {
    expect(accountMultiplier(NaN, 100)).toBeNull();
    expect(accountMultiplier(-5, 100)).toBeNull();
  });
});

describe("passesOutlierGate (§12 ≥3× on the durable receipt)", () => {
  it("passes at/above 3×, fails below", () => {
    expect(passesOutlierGate(MIN_OUTLIER_MULTIPLIER)).toBe(true);
    expect(passesOutlierGate(9.2)).toBe(true);
    expect(passesOutlierGate(2.9)).toBe(false);
    expect(passesOutlierGate(Infinity)).toBe(false);
  });
});

describe("selectCandidates (cheap selection ranking)", () => {
  it("ranks by the result-set-median multiplier and takes top N", () => {
    const videos = [
      vid({ platformVideoId: "low", views: 500 }),
      vid({ platformVideoId: "mid", views: 1000 }),
      vid({ platformVideoId: "high", views: 50_000 }),
    ];
    const out = selectCandidates(videos, 2, NOW);
    expect(out).toHaveLength(2);
    expect(out[0]!.platformVideoId).toBe("high"); // biggest outlier ranks first
    expect(out[0]!.baselineLabel).toBe("vs niche"); // cheap metric's honest label
  });
  it("returns [] for topN<=0", () => {
    expect(selectCandidates([vid()], 0, NOW)).toHaveLength(0);
  });
});
