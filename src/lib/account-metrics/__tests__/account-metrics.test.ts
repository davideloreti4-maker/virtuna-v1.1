import { describe, it, expect } from "vitest";
import {
  buildAccountStats,
  formatCount,
  sumRecentViews,
  type AccountSnapshot,
} from "../account-metrics";

const row = (
  snapshot_date: string,
  follower_count: number,
  heart_count: number,
  video_count: number,
  recent_views?: number | null,
): AccountSnapshot => ({
  snapshot_date,
  follower_count,
  heart_count,
  video_count,
  ...(recent_views !== undefined ? { recent_views } : {}),
});

describe("formatCount", () => {
  it("compacts thousands and millions, keeps small numbers exact", () => {
    expect(formatCount(820)).toBe("820");
    expect(formatCount(12310)).toBe("12.3K");
    expect(formatCount(229400)).toBe("229.4K");
    expect(formatCount(1_240_000)).toBe("1.2M");
    expect(formatCount(85_900_000)).toBe("85.9M");
    expect(formatCount(1_300_000_000)).toBe("1.3B"); // large-account likes (regression: was "1300M")
    expect(formatCount(43)).toBe("43");
  });
});

describe("buildAccountStats", () => {
  it("returns null with no snapshots (honest empty — never fabricate)", () => {
    expect(buildAccountStats([])).toBeNull();
  });

  it("shows real totals but no invented trend from a single snapshot", () => {
    const stats = buildAccountStats([row("2026-07-03", 12310, 229400, 43)]);
    expect(stats).not.toBeNull();
    // The 4-metric row (Stanley parity) drops the cumulative Followers tile; Likes is
    // the point-in-time engagement total with no fake delta from a single snapshot.
    const likes = stats!.find((s) => s.label === "Likes")!;
    expect(likes.value).toBe("229.4K");
    expect(likes.delta).toBe("—"); // no baseline → no fake delta
    expect(likes.up).toBe(false);
    expect(stats!.find((s) => s.label === "Followers")).toBeUndefined();
    const newFollowers = stats!.find((s) => s.label === "New followers")!;
    expect(newFollowers.value).toBe("—");
  });

  it("derives correct weekly deltas from a 7-day series (any input order)", () => {
    const series: AccountSnapshot[] = [
      row("2026-07-03", 12310, 229400, 43),
      row("2026-06-27", 11480, 210000, 40),
      row("2026-06-30", 11890, 219900, 41),
      row("2026-07-01", 12040, 223100, 42),
      row("2026-06-28", 11610, 213500, 40),
      row("2026-07-02", 12180, 226000, 42),
      row("2026-06-29", 11705, 216800, 41),
    ];
    const stats = buildAccountStats(series)!;
    const by = (label: string) => stats.find((s) => s.label === label)!;

    // New followers = the weekly follower gain (Followers total tile dropped).
    expect(by("New followers").value).toBe("+830"); // 12310 - 11480
    expect(by("New followers").up).toBe(true);

    expect(by("Likes").value).toBe("229.4K");
    expect(by("Likes").delta).toBe("+19.4K"); // 229400 - 210000

    expect(by("Posts").value).toBe("43");
    expect(by("Posts").delta).toBe("+3"); // 43 - 40

    // one sparkline per tile, all non-empty
    expect(stats.every((s) => s.spark.length > 0)).toBe(true);
    // No recent_views in this series → the honest 3 (Likes · New followers · Posts).
    expect(stats).toHaveLength(3);
    expect(stats.find((s) => s.label === "Followers")).toBeUndefined();
  });

  it("reports a flat delta when a metric doesn't move", () => {
    const stats = buildAccountStats([
      row("2026-07-01", 12000, 220000, 42),
      row("2026-07-03", 12000, 220000, 42),
    ])!;
    expect(stats.find((s) => s.label === "Likes")!.delta).toBe("flat");
    expect(stats.find((s) => s.label === "New followers")!.value).toBe("0");
  });

  it("omits the Views tile when no snapshot carries recent_views", () => {
    const stats = buildAccountStats([row("2026-07-03", 12310, 229400, 43)])!;
    expect(stats.find((s) => s.label === "Views")).toBeUndefined();
    expect(stats).toHaveLength(3); // Likes · New followers · Posts
  });

  it("leads with a real Views tile when captured (Stanley-parity 4-metric row)", () => {
    const series: AccountSnapshot[] = [
      row("2026-06-27", 11480, 210000, 40, 500_000),
      row("2026-07-03", 12310, 229400, 43, 640_000),
    ];
    const stats = buildAccountStats(series)!;
    const views = stats.find((s) => s.label === "Views")!;
    expect(views).toBeDefined();
    expect(views.value).toBe("640K");
    expect(views.delta).toBe("+140K"); // 640000 - 500000
    expect(views.up).toBe(true);
    expect(stats).toHaveLength(4); // Views · Likes · New followers · Posts
    expect(stats[0]!.label).toBe("Views"); // Views leads
  });

  it("shows a real Views total but no invented trend from a single capture", () => {
    const stats = buildAccountStats([
      row("2026-07-01", 12000, 220000, 42), // no recent_views yet
      row("2026-07-03", 12310, 229400, 43, 512_300), // first capture
    ])!;
    const views = stats.find((s) => s.label === "Views")!;
    expect(views.value).toBe("512.3K");
    expect(views.delta).toBe("—"); // one carrying snapshot → no fake delta
    expect(views.up).toBe(false);
  });

  it("holds the latest CARRYING value when the newest day's video scrape lapses", () => {
    const stats = buildAccountStats([
      row("2026-07-01", 12000, 220000, 42, 480_000), // captured
      row("2026-07-03", 12310, 229400, 43, null), // video scrape failed → null
    ])!;
    const views = stats.find((s) => s.label === "Views")!;
    expect(views.value).toBe("480K"); // last real value, never fabricated forward
    expect(views.delta).toBe("—");
  });

  // ── Honest per-platform tiles for /start (heart_count is 0 for IG/YT — never shown) ──
  it("Instagram drops the Likes tile (no fabricated 'Likes: 0')", () => {
    // heart_count 0 = IG's honest absence; the tile must not appear.
    const stats = buildAccountStats([row("2026-07-03", 12310, 0, 43)], "instagram")!;
    expect(stats.find((s) => s.label === "Likes")).toBeUndefined();
    expect(stats.map((s) => s.label)).toEqual(["New followers", "Posts"]);
  });

  it("YouTube relabels to New subscribers/Videos/Views and drops Likes", () => {
    const stats = buildAccountStats(
      [
        row("2026-06-27", 20_000_000, 0, 1800, 5_000_000_000),
        row("2026-07-03", 21_100_000, 0, 1834, 5_469_016_050),
      ],
      "youtube",
    )!;
    expect(stats.find((s) => s.label === "Likes")).toBeUndefined();
    expect(stats.map((s) => s.label)).toEqual(["Views", "New subscribers", "Videos"]);
    expect(stats.find((s) => s.label === "New subscribers")!.value).toBe("+1.1M");
  });
});

describe("sumRecentViews", () => {
  const now = new Date("2026-07-03T12:00:00Z");
  const v = (postedAt: string, views: number) => ({ postedAt: new Date(postedAt), views });

  it("sums only posts within the trailing window", () => {
    const videos = [
      v("2026-07-01T00:00:00Z", 10_000), // in
      v("2026-06-20T00:00:00Z", 5_000), // in
      v("2026-05-01T00:00:00Z", 900_000), // out (older than 28d)
    ];
    expect(sumRecentViews(videos, 28, now)).toBe(15_000);
  });

  it("returns 0 for an empty list (caller stores NULL, not a fabricated 0)", () => {
    expect(sumRecentViews([], 28, now)).toBe(0);
  });

  it("excludes future-dated posts and ignores non-finite view counts", () => {
    const videos = [
      v("2026-07-02T00:00:00Z", 1_000),
      v("2026-08-01T00:00:00Z", 999), // future → excluded
      { postedAt: new Date("2026-07-01T00:00:00Z"), views: NaN }, // non-finite → 0
    ];
    expect(sumRecentViews(videos, 28, now)).toBe(1_000);
  });

  it("respects the window width", () => {
    const videos = [v("2026-06-25T00:00:00Z", 2_000)]; // 8 days ago
    expect(sumRecentViews(videos, 7, now)).toBe(0); // outside 7d
    expect(sumRecentViews(videos, 28, now)).toBe(2_000); // inside 28d
  });
});
