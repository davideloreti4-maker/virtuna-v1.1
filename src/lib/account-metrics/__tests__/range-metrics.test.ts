import { describe, it, expect } from "vitest";
import { buildRangeMetrics, type AccountSnapshot } from "../account-metrics";

// Oldest → newest; anchored so the windows line up with a 2026-07-03 "latest".
const SERIES: AccountSnapshot[] = [
  { snapshot_date: "2026-04-04", follower_count: 1000, heart_count: 5000, video_count: 40 }, // 90d ago
  { snapshot_date: "2026-06-03", follower_count: 1800, heart_count: 8000, video_count: 52 }, // 30d ago
  { snapshot_date: "2026-06-26", follower_count: 1950, heart_count: 9500, video_count: 58 }, // 7d ago
  { snapshot_date: "2026-07-03", follower_count: 2000, heart_count: 10000, video_count: 60 }, // latest
];

describe("buildRangeMetrics", () => {
  it("returns null for an empty series (honest empty, no fabrication)", () => {
    expect(buildRangeMetrics([], 30)).toBeNull();
  });

  it("computes the 7-day window against the oldest snapshot inside it", () => {
    const followers = buildRangeMetrics(SERIES, 7)!.find((m) => m.key === "followers")!;
    expect(followers.value).toBe("2K"); // 2000
    expect(followers.delta).toBe("+50"); // 2000 - 1950
    expect(followers.deltaPct).toBe("+2.6%"); // 50 / 1950
    expect(followers.up).toBe(true);
    expect(followers.points).toBe(2);
  });

  it("widens the baseline for 30 / 90 day windows", () => {
    const d30 = buildRangeMetrics(SERIES, 30)!.find((m) => m.key === "followers")!;
    expect(d30.delta).toBe("+200"); // 2000 - 1800
    expect(d30.points).toBe(3);

    const d90 = buildRangeMetrics(SERIES, 90)!.find((m) => m.key === "followers")!;
    expect(d90.delta).toBe("+1K"); // 2000 - 1000
    expect(d90.deltaPct).toBe("+100%");
    expect(d90.points).toBe(4);
  });

  it("is honest ('—', null pct) when the window holds a single snapshot", () => {
    const one = buildRangeMetrics([SERIES[3]!], 90)!.find((m) => m.key === "followers")!;
    expect(one.value).toBe("2K");
    expect(one.delta).toBe("—");
    expect(one.deltaPct).toBeNull();
    expect(one.points).toBe(1);
  });

  it("omits the Views metric when no snapshot carries recent_views", () => {
    const keys = buildRangeMetrics(SERIES, 90)!.map((m) => m.key);
    expect(keys).not.toContain("views");
    expect(keys).toEqual(["followers", "likes", "posts"]);
  });

  it("includes a real Views metric when recent_views is present", () => {
    const withViews: AccountSnapshot[] = [
      { ...SERIES[2]!, recent_views: 1_000_000 },
      { ...SERIES[3]!, recent_views: 1_500_000 },
    ];
    const views = buildRangeMetrics(withViews, 7)!.find((m) => m.key === "views")!;
    expect(views.value).toBe("1.5M");
    expect(views.delta).toBe("+500K");
    expect(views.up).toBe(true);
  });

  // ── Honest per-platform tiles (never a fabricated "Likes: 0" for IG/YT) ──────────
  it("Instagram drops Likes, keeps Followers/Posts (no fake engagement number)", () => {
    const metrics = buildRangeMetrics(SERIES, 90, "instagram")!;
    expect(metrics.map((m) => m.key)).toEqual(["followers", "posts"]);
    expect(metrics.map((m) => m.label)).toEqual(["Followers", "Posts"]);
  });

  it("YouTube relabels to Subscribers/Videos/Views and drops Likes", () => {
    const withViews: AccountSnapshot[] = [
      { ...SERIES[2]!, recent_views: 5_000_000_000 },
      { ...SERIES[3]!, recent_views: 5_469_016_050 },
    ];
    const metrics = buildRangeMetrics(withViews, 7, "youtube")!;
    expect(metrics.map((m) => m.key)).toEqual(["followers", "posts", "views"]);
    expect(metrics.map((m) => m.label)).toEqual(["Subscribers", "Videos", "Views"]);
    expect(metrics.find((m) => m.key === "views")!.value).toBe("5.5B");
  });
});
