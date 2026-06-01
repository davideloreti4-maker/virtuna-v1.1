import { describe, it, expect } from "vitest";
import {
  bucketFromPercentile,
  computeNicheBuckets,
  bucketDistance,
  bucketMatch,
  DEFAULT_THRESHOLDS,
  type NicheRankInput,
} from "../labeling";

describe("bucketFromPercentile", () => {
  it("maps top decile to viral, bottom to under, middle to average", () => {
    expect(bucketFromPercentile(0.95)).toBe("viral");
    expect(bucketFromPercentile(0.8)).toBe("viral"); // boundary inclusive
    expect(bucketFromPercentile(0.5)).toBe("average");
    expect(bucketFromPercentile(0.3)).toBe("under"); // boundary inclusive
    expect(bucketFromPercentile(0.05)).toBe("under");
  });

  it("respects custom thresholds", () => {
    const t = { viralAtOrAbove: 0.9, underAtOrBelow: 0.1 };
    expect(bucketFromPercentile(0.85, t)).toBe("average");
    expect(bucketFromPercentile(0.95, t)).toBe("viral");
  });
});

describe("computeNicheBuckets", () => {
  it("ranks each video WITHIN its own niche, not globally", () => {
    // beauty cohort has huge views; fitness cohort small. A 50k-view fitness
    // video should still be 'viral' in fitness even though it'd be 'under' in beauty.
    const rows: NicheRankInput[] = [
      // beauty: 10M..1M
      { id: "b1", niche: "beauty", real_views: 10_000_000 },
      { id: "b2", niche: "beauty", real_views: 5_000_000 },
      { id: "b3", niche: "beauty", real_views: 2_000_000 },
      { id: "b4", niche: "beauty", real_views: 1_000_000 },
      { id: "b5", niche: "beauty", real_views: 500_000 },
      // fitness: 50k..1k
      { id: "f1", niche: "fitness", real_views: 50_000 },
      { id: "f2", niche: "fitness", real_views: 20_000 },
      { id: "f3", niche: "fitness", real_views: 8_000 },
      { id: "f4", niche: "fitness", real_views: 3_000 },
      { id: "f5", niche: "fitness", real_views: 1_000 },
    ];
    const out = computeNicheBuckets(rows, DEFAULT_THRESHOLDS);

    // top of each niche = viral
    expect(out.get("b1")!.bucket).toBe("viral");
    expect(out.get("f1")!.bucket).toBe("viral");
    // bottom of each niche = under
    expect(out.get("b5")!.bucket).toBe("under");
    expect(out.get("f5")!.bucket).toBe("under");
    // a 50k fitness video is viral despite being a fraction of any beauty video
    expect(out.get("f1")!.percentile).toBeGreaterThan(out.get("b5")!.percentile);
  });

  it("gives percentile 0 to a singleton niche (untrustworthy → MIN_NICHE_COHORT guards it)", () => {
    const out = computeNicheBuckets([{ id: "x", niche: "edu", real_views: 999 }]);
    expect(out.get("x")!.percentile).toBe(0);
  });
});

describe("bucketDistance + bucketMatch", () => {
  it("scores ordinal distance between buckets", () => {
    expect(bucketDistance("viral", "viral")).toBe(0);
    expect(bucketDistance("average", "viral")).toBe(1);
    expect(bucketDistance("under", "viral")).toBe(2);
  });

  it("matches only equal, non-null buckets", () => {
    expect(bucketMatch("viral", "viral")).toBe(true);
    expect(bucketMatch("viral", "under")).toBe(false);
    expect(bucketMatch(null, "viral")).toBe(false);
    expect(bucketMatch("viral", null)).toBe(false);
  });
});
