import { describe, it, expect } from "vitest";
import { buildAccountStats, formatCount, type AccountSnapshot } from "../account-metrics";

const row = (
  snapshot_date: string,
  follower_count: number,
  heart_count: number,
  video_count: number,
): AccountSnapshot => ({ snapshot_date, follower_count, heart_count, video_count });

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
    const followers = stats!.find((s) => s.label === "Followers")!;
    expect(followers.value).toBe("12.3K");
    expect(followers.delta).toBe("—"); // no baseline → no fake delta
    expect(followers.up).toBe(false);
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

    expect(by("Followers").value).toBe("12.3K");
    expect(by("Followers").delta).toBe("+830"); // 12310 - 11480
    expect(by("Followers").up).toBe(true);

    expect(by("New followers").value).toBe("+830");
    expect(by("New followers").up).toBe(true);

    expect(by("Likes").value).toBe("229.4K");
    expect(by("Likes").delta).toBe("+19.4K"); // 229400 - 210000

    expect(by("Posts").value).toBe("43");
    expect(by("Posts").delta).toBe("+3"); // 43 - 40

    // one sparkline per tile, all non-empty
    expect(stats.every((s) => s.spark.length > 0)).toBe(true);
    expect(stats).toHaveLength(4);
  });

  it("reports a flat delta when a metric doesn't move", () => {
    const stats = buildAccountStats([
      row("2026-07-01", 12000, 220000, 42),
      row("2026-07-03", 12000, 220000, 42),
    ])!;
    expect(stats.find((s) => s.label === "Followers")!.delta).toBe("flat");
    expect(stats.find((s) => s.label === "New followers")!.value).toBe("0");
  });
});
