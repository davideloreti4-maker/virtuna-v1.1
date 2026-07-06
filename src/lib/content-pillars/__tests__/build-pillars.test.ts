import { describe, it, expect } from "vitest";
import { buildPillars } from "../build-pillars";
import type { AccountPost } from "@/lib/account-metrics/account-posts-repo";
import type { ContentPillarRow } from "../pillars-repo";

const NOW = Date.parse("2026-07-06T12:00:00Z");
const DAY = 86_400_000;

let idc = 0;
function post(
  pillar_id: string | null,
  views: number,
  eng: number,
  daysAgo: number | null,
  pinned = false,
): AccountPost {
  return {
    post_id: `p${idc++}`,
    caption: "x",
    posted_at: daysAgo == null ? null : new Date(NOW - daysAgo * DAY).toISOString(),
    views,
    likes: eng, // engagement rate = eng/views (comments/shares/saves 0)
    comments: 0,
    shares: 0,
    saves: 0,
    hashtags: [],
    is_pinned: pinned,
    pillar_id,
  };
}

// rows in sort order A, B, C (+ D with no posts)
const rows: ContentPillarRow[] = [
  { id: "a", name: "Alpha", sort_order: 0, confirmed: true },
  { id: "b", name: "Beta", sort_order: 1, confirmed: true },
  { id: "c", name: "Gamma", sort_order: 2, confirmed: true },
  { id: "d", name: "Delta", sort_order: 3, confirmed: true },
];

// baseline = median of all rates [0.02,0.06,0.06,0.12,0.12] = 0.06
const posts: AccountPost[] = [
  post("a", 1000, 120, 2), // rate 0.12, 2 days ago
  post("a", 1000, 120, 9), // rate 0.12
  post("c", 1000, 60, 5), // rate 0.06, 5 days ago (non-pinned)
  post("c", 1000, 60, 200, true), // rate 0.06, pinned + old — counts, but must NOT drive cadence
  post("b", 1000, 20, 25), // rate 0.02, 25 days ago (gap)
  post(null, 1000, 500, 1), // unassigned — excluded from everything
];

describe("buildPillars", () => {
  const result = buildPillars(rows, posts, NOW);
  const byName = Object.fromEntries(result.map((p) => [p.name, p]));

  it("drops pillars with no assigned posts and preserves sort order", () => {
    expect(result.map((p) => p.name)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("counts assigned posts and shares sum to 1 (unassigned excluded)", () => {
    expect(byName.Alpha!.count).toBe(2);
    expect(byName.Beta!.count).toBe(1);
    expect(byName.Gamma!.count).toBe(2); // pinned post still counts toward the pillar
    const total = result.reduce((s, p) => s + p.share, 0);
    expect(total).toBeCloseTo(1, 6);
    expect(byName.Alpha!.share).toBeCloseTo(0.4, 6);
    expect(byName.Beta!.share).toBeCloseTo(0.2, 6);
    expect(byName.Gamma!.share).toBeCloseTo(0.4, 6);
  });

  it("derives tone from engagement rate vs the creator baseline", () => {
    expect(byName.Alpha!.tone).toBe("loved"); // 0.12 / 0.06 = 2.0
    expect(byName.Gamma!.tone).toBe("neutral"); // 0.06 / 0.06 = 1.0
    expect(byName.Beta!.tone).toBe("bounced"); // 0.02 / 0.06 = 0.33
  });

  it("labels cadence from the most recent NON-pinned post", () => {
    expect(byName.Alpha!.cadence).toBe("posted 2 days ago");
    expect(byName.Gamma!.cadence).toBe("posted 5 days ago"); // NOT the 200-day pinned
    expect(byName.Beta!.cadence).toBe("none in 3 weeks");
  });

  it("flags the single most-neglected pillar past the gap threshold", () => {
    expect(byName.Beta!.gap).toBe(true);
    expect(byName.Alpha!.gap).toBeUndefined();
    expect(byName.Gamma!.gap).toBeUndefined();
  });

  it("returns empty when nothing is assigned (honest empty state)", () => {
    expect(buildPillars(rows, [], NOW)).toEqual([]);
    expect(buildPillars(rows, [post(null, 1000, 100, 1)], NOW)).toEqual([]);
  });

  it("returns empty when there are no pillars", () => {
    expect(buildPillars([], posts, NOW)).toEqual([]);
  });
});
