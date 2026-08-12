/**
 * outlier-receipt.test.ts — the Phase 2 switch: the PRINTED multiplier stops being a
 * within-set statistic.
 *
 * The fixtures below are REAL rows from a live Apify niche pull ("startup founder",
 * 2026-08-11, 20 posts) — see scripts/probe-author-baseline-coverage.ts. Real numbers matter
 * here: the defect only shows up against a set whose author distribution is realistic (that
 * pull held 18 distinct authors across 20 posts, 16 of them contributing a single post), and
 * an invented fixture with three tidy authors would hide both failure modes.
 */
import { describe, expect, it } from "vitest";
import { rankOutliers } from "@/lib/discover/outlier-compute";
import { attachOutlierReceipt } from "@/lib/discover/outlier-receipt";
import type { VideoData } from "@/lib/scraping/types";

/** 2026-08-11 — the day the fixture was pulled, so the 90-day window is reproducible. */
const NOW = new Date("2026-08-11T08:00:00.000Z").getTime();

function video(
  over: Omit<Partial<VideoData>, "postedAt"> & {
    views: number;
    /** ISO string — the fixtures read better as dates than as epoch ms. */
    postedAt: string;
    author?: VideoData["author"];
  },
): VideoData {
  return {
    platformVideoId: over.platformVideoId ?? `v${over.views}`,
    videoUrl: "https://tiktok.com/x",
    caption: over.caption ?? "c",
    views: over.views,
    likes: over.likes ?? 0,
    comments: 0,
    shares: 0,
    saves: 0,
    hashtags: [],
    durationSeconds: 30,
    postedAt: new Date(over.postedAt),
    ...(over.author ? { author: over.author } : {}),
  };
}

const JAMES = { handle: "james.penny10", fans: 8192, heart: 189_700, videoCount: 32 };
const VINNIE = { handle: "vinnielauria", fans: 5370, heart: 19_500, videoCount: 31 };
const KHRIS = { handle: "khris.sheer", fans: 70_200, heart: 848_100, videoCount: 240 };

/** Six real in-window rows from the measured pull. */
const NICHE_SET: VideoData[] = [
  video({ platformVideoId: "james1", views: 377_900, likes: 27_500, postedAt: "2026-06-03T16:55:02.000Z", author: JAMES }),
  video({ platformVideoId: "vinnie1", views: 48_100, likes: 4_033, postedAt: "2026-06-13T05:26:21.000Z", author: VINNIE }),
  video({ platformVideoId: "vinnie2", views: 97_700, likes: 4_643, postedAt: "2026-07-23T14:30:56.000Z", author: VINNIE }),
  video({ platformVideoId: "khris1", views: 367_100, likes: 20_900, postedAt: "2026-07-01T13:57:44.000Z", author: KHRIS }),
  video({ platformVideoId: "small1", views: 261, likes: 4, postedAt: "2026-07-28T10:00:00.000Z", author: { handle: "vaultedmedia5", fans: 430, heart: 7_600, videoCount: 123 } }),
  video({ platformVideoId: "small2", views: 187, likes: 4, postedAt: "2026-08-01T10:00:00.000Z", author: { handle: "hattipchristian", fans: 544, heart: 15_200, videoCount: 46 } }),
];

function receipt(tiles: VideoData[], mode: "profile" | "niche", id: string) {
  const out = attachOutlierReceipt(rankOutliers(tiles, mode, NOW), mode);
  return out.find((t) => t.platformVideoId === id)!;
}

describe("attachOutlierReceipt — niche mode", () => {
  it("prints views ÷ followers with the honest 'vs followers' label", () => {
    const t = receipt(NICHE_SET, "niche", "james1");
    expect(t.baselineLabel).toBe("vs followers");
    expect(t.multiplier).toBeCloseTo(377_900 / 8192, 4); // 46.1x
  });

  it("THE REGRESSION: the printed number does NOT move with the size of the pull", () => {
    // The shipped denominator is the median of the RETURNED set, so halving the pull moves
    // every badge. Measured on this exact data: 12.1x at N=20 became 1.3x at N=10.
    const full = rankOutliers(NICHE_SET, "niche", NOW);
    const half = rankOutliers(NICHE_SET.slice(0, 3), "niche", NOW);

    const shippedFull = full.find((t) => t.platformVideoId === "vinnie2")!.multiplier;
    const shippedHalf = half.find((t) => t.platformVideoId === "vinnie2")!.multiplier;
    expect(shippedFull).not.toBeCloseTo(shippedHalf, 1); // the bug, still present in SELECTION

    const receiptFull = attachOutlierReceipt(full, "niche").find((t) => t.platformVideoId === "vinnie2")!;
    const receiptHalf = attachOutlierReceipt(half, "niche").find((t) => t.platformVideoId === "vinnie2")!;
    expect(receiptFull.multiplier).toBe(receiptHalf.multiplier); // the fix
    expect(receiptFull.multiplier).toBeCloseTo(97_700 / 5370, 4);
  });

  it("gives NO badge — not a fabricated one — when the row carries no author aggregates", () => {
    const anon = [video({ platformVideoId: "anon", views: 90_000, postedAt: "2026-08-01T10:00:00.000Z" })];
    const t = receipt(anon, "niche", "anon");
    expect(t.multiplier).toBeNull();
    expect(t.baselineLabel).toBeNull();
  });

  it("gives no badge on a zero-follower account rather than dividing by nothing", () => {
    const newbie = [
      video({
        platformVideoId: "newbie",
        views: 5_000,
        postedAt: "2026-08-01T10:00:00.000Z",
        author: { handle: "brandnew", fans: 0, heart: 0, videoCount: 1 },
      }),
    ];
    expect(receipt(newbie, "niche", "newbie").multiplier).toBeNull();
  });

  it("never falls back to the lifetime-avg-likes basis, which measured 0.0x on a 32k-view post", () => {
    const t = receipt(NICHE_SET, "niche", "khris1");
    expect(t.baselineLabel).toBe("vs followers");
    expect(t.baselineLabel).not.toBe("vs their lifetime average");
  });
});

describe("attachOutlierReceipt — profile mode", () => {
  /** One creator's own pull: five posts, median 20_000. */
  const OWN: VideoData[] = [
    video({ platformVideoId: "p1", views: 5_000, postedAt: "2026-07-01T10:00:00.000Z", author: VINNIE }),
    video({ platformVideoId: "p2", views: 12_000, postedAt: "2026-07-05T10:00:00.000Z", author: VINNIE }),
    video({ platformVideoId: "p3", views: 20_000, postedAt: "2026-07-10T10:00:00.000Z", author: VINNIE }),
    video({ platformVideoId: "p4", views: 31_000, postedAt: "2026-07-15T10:00:00.000Z", author: VINNIE }),
    video({ platformVideoId: "p5", views: 140_000, postedAt: "2026-07-20T10:00:00.000Z", author: VINNIE }),
  ];

  it("prints views ÷ their own median views, labelled 'vs their usual views'", () => {
    const t = receipt(OWN, "profile", "p5");
    expect(t.baselineLabel).toBe("vs their usual views");
    expect(t.multiplier).toBeCloseTo(140_000 / 20_000, 4); // 7x
  });

  it("keeps each creator on their OWN denominator in a merged competitors pull", () => {
    // explore-runner's CR-02 mergeInputs pull is mode:"profile" with SEVERAL handles. A single
    // median across all of them is the cross-creator bug this whole change exists to kill.
    const merged: VideoData[] = [
      ...OWN,
      video({ platformVideoId: "k1", views: 100_000, postedAt: "2026-07-02T10:00:00.000Z", author: KHRIS }),
      video({ platformVideoId: "k2", views: 400_000, postedAt: "2026-07-06T10:00:00.000Z", author: KHRIS }),
      video({ platformVideoId: "k3", views: 900_000, postedAt: "2026-07-11T10:00:00.000Z", author: KHRIS }),
    ];
    const vinnieTile = receipt(merged, "profile", "p5");
    // Unchanged by khris's far bigger numbers joining the set.
    expect(vinnieTile.multiplier).toBeCloseTo(140_000 / 20_000, 4);

    const khrisTile = receipt(merged, "profile", "k3");
    expect(khrisTile.multiplier).toBeCloseTo(900_000 / 400_000, 4); // khris's own median
  });

  it("gives no badge below the minimum own-post count, where the median IS the post itself", () => {
    const thin: VideoData[] = [
      video({ platformVideoId: "t1", views: 40_000, postedAt: "2026-08-01T10:00:00.000Z", author: VINNIE }),
      video({ platformVideoId: "t2", views: 60_000, postedAt: "2026-08-02T10:00:00.000Z", author: VINNIE }),
    ];
    expect(receipt(thin, "profile", "t1").multiplier).toBeNull();
  });
});

describe("attachOutlierReceipt — invariants", () => {
  it("preserves the SELECTION order exactly — it annotates, it does not re-rank", () => {
    const ranked = rankOutliers(NICHE_SET, "niche", NOW);
    const out = attachOutlierReceipt(ranked, "niche");
    expect(out.map((t) => t.platformVideoId)).toEqual(ranked.map((t) => t.platformVideoId));
  });

  it("keeps rankKey — the within-set signal stays available for sorting and fit math", () => {
    const ranked = rankOutliers(NICHE_SET, "niche", NOW);
    const out = attachOutlierReceipt(ranked, "niche");
    expect(out[0]!.rankKey).toBe(ranked[0]!.rankKey);
  });

  it("REPLACES the within-set multiplier rather than shipping both", () => {
    // If the selection figure survived alongside the receipt, a renderer could print it.
    const ranked = rankOutliers(NICHE_SET, "niche", NOW);
    const out = attachOutlierReceipt(ranked, "niche");
    const james = out.find((t) => t.platformVideoId === "james1")!;
    const shipped = ranked.find((t) => t.platformVideoId === "james1")!.multiplier;
    expect(james.multiplier).not.toBeCloseTo(shipped, 1);
    expect(Object.values(james)).not.toContain(shipped);
  });
});
