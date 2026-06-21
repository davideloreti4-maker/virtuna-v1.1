/**
 * outlier-compute.test.ts — Phase 08, Plan 02, Task 2 (D-05/06/07).
 *
 * Asserts the outlier arithmetic against the D-05/06/07 envelope:
 *   - over-performer ranks #1
 *   - baselineLabel matches mode ("vs own" | "vs niche")
 *   - the 90d window EXCLUDES stale items
 *   - the saves/views → shares/views tiebreak order holds when rankKeys tie
 *
 * `now` is injected for determinism (no wall-clock flake).
 */
import { describe, expect, it } from "vitest";
import { rankOutliers, median, WINDOW_DAYS } from "../outlier-compute";
import type { VideoData } from "@/lib/scraping/types";

const NOW = new Date("2026-06-19T00:00:00.000Z").getTime();
const DAY = 86_400_000;

function vid(overrides: Partial<VideoData> & { id: string }): VideoData {
  const { id, ...rest } = overrides;
  return {
    platformVideoId: id,
    videoUrl: `https://tiktok.com/@x/video/${id}`,
    caption: "",
    views: 1000,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    hashtags: [],
    durationSeconds: 30,
    postedAt: new Date(NOW - 5 * DAY),
    ...rest,
  };
}

describe("median", () => {
  it("returns 0 for empty, the middle for odd, the mean-of-two for even", () => {
    expect(median([])).toBe(0);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("rankOutliers", () => {
  it("ranks a clear over-performer #1 (profile mode, vs own)", () => {
    const videos = [
      vid({ id: "a", views: 1000, postedAt: new Date(NOW - 3 * DAY) }),
      vid({ id: "b", views: 1000, postedAt: new Date(NOW - 4 * DAY) }),
      vid({ id: "spike", views: 50_000, postedAt: new Date(NOW - 2 * DAY) }),
      vid({ id: "c", views: 1000, postedAt: new Date(NOW - 5 * DAY) }),
    ];
    const ranked = rankOutliers(videos, "profile", NOW);
    expect(ranked[0]!.platformVideoId).toBe("spike");
    expect(ranked[0]!.multiplier).toBeGreaterThan(1);
    expect(ranked[0]!.baselineLabel).toBe("vs own");
  });

  it("labels niche mode 'vs niche'", () => {
    const videos = [
      vid({ id: "a", views: 1000 }),
      vid({ id: "b", views: 3000 }),
    ];
    const ranked = rankOutliers(videos, "niche", NOW);
    expect(ranked.every((r) => r.baselineLabel === "vs niche")).toBe(true);
  });

  it("excludes videos older than the 90d window", () => {
    const videos = [
      vid({ id: "fresh", views: 5000, postedAt: new Date(NOW - 10 * DAY) }),
      vid({
        id: "stale",
        views: 10_000_000,
        postedAt: new Date(NOW - (WINDOW_DAYS + 30) * DAY),
      }),
    ];
    const ranked = rankOutliers(videos, "niche", NOW);
    expect(ranked.map((r) => r.platformVideoId)).toEqual(["fresh"]);
    expect(ranked.find((r) => r.platformVideoId === "stale")).toBeUndefined();
  });

  it("recency decay: a recent spike outranks an older one of equal views", () => {
    const videos = [
      vid({ id: "filler", views: 1000, postedAt: new Date(NOW - 1 * DAY) }),
      vid({ id: "recent", views: 20_000, postedAt: new Date(NOW - 2 * DAY) }),
      vid({ id: "older", views: 20_000, postedAt: new Date(NOW - 60 * DAY) }),
    ];
    const ranked = rankOutliers(videos, "profile", NOW);
    const recentIdx = ranked.findIndex((r) => r.platformVideoId === "recent");
    const olderIdx = ranked.findIndex((r) => r.platformVideoId === "older");
    expect(recentIdx).toBeLessThan(olderIdx);
  });

  it("tiebreak: equal rankKey resolves by saves/views then shares/views (D-06)", () => {
    // Two videos with identical views + identical age → identical rankKey.
    // The one with the higher save-rate must rank first.
    const postedAt = new Date(NOW - 5 * DAY);
    const videos = [
      vid({ id: "lowSaves", views: 10_000, saves: 100, shares: 100, postedAt }),
      vid({ id: "highSaves", views: 10_000, saves: 900, shares: 100, postedAt }),
    ];
    const ranked = rankOutliers(videos, "niche", NOW);
    expect(ranked[0]!.platformVideoId).toBe("highSaves");
    expect(ranked[1]!.platformVideoId).toBe("lowSaves");
  });

  it("shares/views breaks a tie when saves/views are equal", () => {
    const postedAt = new Date(NOW - 5 * DAY);
    const videos = [
      vid({ id: "lowShares", views: 10_000, saves: 500, shares: 100, postedAt }),
      vid({ id: "highShares", views: 10_000, saves: 500, shares: 900, postedAt }),
    ];
    const ranked = rankOutliers(videos, "niche", NOW);
    expect(ranked[0]!.platformVideoId).toBe("highShares");
  });

  it("guards divide-by-zero: an all-zero-views set does not throw or NaN", () => {
    const videos = [
      vid({ id: "z1", views: 0, postedAt: new Date(NOW - 2 * DAY) }),
      vid({ id: "z2", views: 0, postedAt: new Date(NOW - 3 * DAY) }),
    ];
    const ranked = rankOutliers(videos, "niche", NOW);
    expect(ranked).toHaveLength(2);
    expect(ranked.every((r) => Number.isFinite(r.rankKey))).toBe(true);
    expect(ranked.every((r) => Number.isFinite(r.multiplier))).toBe(true);
  });

  it("emits no SIM score — only measured multiplier + honest label (Pitfall 5)", () => {
    const ranked = rankOutliers([vid({ id: "a", views: 2000 })], "profile", NOW);
    const tile = ranked[0]!;
    // The shape carries measured data only; no 0–100 score field exists.
    expect(tile).not.toHaveProperty("score");
    expect(typeof tile.multiplier).toBe("number");
    expect(tile.baselineLabel).toBe("vs own");
  });
});
