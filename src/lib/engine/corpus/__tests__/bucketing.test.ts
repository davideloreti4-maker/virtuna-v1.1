import { describe, it, expect } from "vitest";
import { bucketByViews } from "../bucketing";
import { getThresholds } from "../thresholds";
import type { Niche } from "../eval-config";

const pilot = getThresholds("pilot.2026-05-12");

describe("bucketing / boundary semantics (D-10 hard cutoff)", () => {
  describe("beauty (viralFloor=250k, underCeiling=5k)", () => {
    it("views >= viralFloor → viral", () => {
      expect(bucketByViews({ views: 1_000_000, niche: "beauty" }, pilot)).toBe(
        "viral",
      );
      expect(bucketByViews({ views: 250_000, niche: "beauty" }, pilot)).toBe(
        "viral",
      ); // boundary inclusive
    });

    it("viralFloor - 1 → average", () => {
      expect(bucketByViews({ views: 249_999, niche: "beauty" }, pilot)).toBe(
        "average",
      );
    });

    it("between viralFloor and underCeiling → average", () => {
      expect(bucketByViews({ views: 50_000, niche: "beauty" }, pilot)).toBe(
        "average",
      );
      expect(bucketByViews({ views: 5_001, niche: "beauty" }, pilot)).toBe(
        "average",
      );
    });

    it("views <= underCeiling → under", () => {
      expect(bucketByViews({ views: 5_000, niche: "beauty" }, pilot)).toBe(
        "under",
      ); // boundary inclusive
      expect(bucketByViews({ views: 0, niche: "beauty" }, pilot)).toBe("under");
    });
  });

  describe("comedy (viralFloor=500k, underCeiling=10k)", () => {
    it("views >= viralFloor → viral", () => {
      expect(bucketByViews({ views: 500_000, niche: "comedy" }, pilot)).toBe(
        "viral",
      );
      expect(bucketByViews({ views: 2_000_000, niche: "comedy" }, pilot)).toBe(
        "viral",
      );
    });

    it("499_999 views → average (different from beauty's threshold)", () => {
      expect(bucketByViews({ views: 499_999, niche: "comedy" }, pilot)).toBe(
        "average",
      );
    });

    it("10_001 views → average", () => {
      expect(bucketByViews({ views: 10_001, niche: "comedy" }, pilot)).toBe(
        "average",
      );
    });

    it("views <= underCeiling=10k → under", () => {
      expect(bucketByViews({ views: 10_000, niche: "comedy" }, pilot)).toBe(
        "under",
      );
      expect(bucketByViews({ views: 5_000, niche: "comedy" }, pilot)).toBe(
        "under",
      ); // notice: 5k is "under" for comedy but boundary for beauty
    });
  });

  describe("table-driven thresholds per niche (D-08)", () => {
    const cases: Array<{ niche: Niche; viral: number; under: number }> = [
      { niche: "fitness", viral: 200_000, under: 5_000 },
      { niche: "edu", viral: 100_000, under: 2_000 },
      { niche: "lifestyle", viral: 250_000, under: 5_000 },
    ];
    for (const c of cases) {
      it(`${c.niche}: viralFloor (${c.viral}) is inclusive`, () => {
        expect(bucketByViews({ views: c.viral, niche: c.niche }, pilot)).toBe(
          "viral",
        );
        expect(
          bucketByViews({ views: c.viral - 1, niche: c.niche }, pilot),
        ).toBe("average");
      });
      it(`${c.niche}: underCeiling (${c.under}) is inclusive`, () => {
        expect(bucketByViews({ views: c.under, niche: c.niche }, pilot)).toBe(
          "under",
        );
        expect(
          bucketByViews({ views: c.under + 1, niche: c.niche }, pilot),
        ).toBe("average");
      });
    }
  });
});

describe("bucketing / bigint input handling", () => {
  it("bigint views classify identically to number views", () => {
    expect(
      bucketByViews({ views: BigInt(1_000_000), niche: "beauty" }, pilot),
    ).toBe("viral");
    expect(
      bucketByViews({ views: BigInt(250_000), niche: "beauty" }, pilot),
    ).toBe("viral");
    expect(
      bucketByViews({ views: BigInt(249_999), niche: "beauty" }, pilot),
    ).toBe("average");
    expect(
      bucketByViews({ views: BigInt(5_000), niche: "beauty" }, pilot),
    ).toBe("under");
    expect(bucketByViews({ views: BigInt(0), niche: "beauty" }, pilot)).toBe(
      "under",
    );
  });

  it("very large bigint (above Number.MAX_SAFE_INTEGER) still classifies as viral", () => {
    // 2^53 + 1 — beyond Number.MAX_SAFE_INTEGER. Number() coerces to a value
    // well above any niche's viralFloor, so this should still classify as viral.
    const huge = BigInt("9007199254740993");
    expect(bucketByViews({ views: huge, niche: "beauty" }, pilot)).toBe(
      "viral",
    );
  });
});

describe("bucketing / unknown niche guard", () => {
  it("returns 'average' for an unknown niche (no throw)", () => {
    // Cast through unknown to bypass type narrowing — tests the runtime guard
    const unknown = "unicorn" as unknown as Niche;
    expect(bucketByViews({ views: 1_000_000, niche: unknown }, pilot)).toBe(
      "average",
    );
  });
});
