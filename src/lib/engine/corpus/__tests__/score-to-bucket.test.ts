import { describe, it, expect } from "vitest";
import { bucketFromScore } from "../metrics/score-to-bucket";

describe("bucketFromScore (Phase 1 simplification)", () => {
  it("score >= 70 → viral (VIRAL_SCORE_CUT)", () => {
    expect(bucketFromScore(85, "beauty")).toBe("viral");
    expect(bucketFromScore(70, "beauty")).toBe("viral"); // boundary inclusive
    expect(bucketFromScore(100, "beauty")).toBe("viral");
  });

  it("score between cuts (30 < x < 70) → average", () => {
    expect(bucketFromScore(50, "beauty")).toBe("average");
    expect(bucketFromScore(69, "beauty")).toBe("average");
    expect(bucketFromScore(31, "beauty")).toBe("average");
  });

  it("score <= 30 → under (UNDER_SCORE_CUT)", () => {
    expect(bucketFromScore(30, "beauty")).toBe("under"); // boundary inclusive
    expect(bucketFromScore(10, "beauty")).toBe("under");
    expect(bucketFromScore(0, "beauty")).toBe("under");
  });

  it("niche argument currently unused — all niches produce identical mapping (Phase 1)", () => {
    expect(bucketFromScore(50, "beauty")).toBe(
      bucketFromScore(50, "fitness"),
    );
    expect(bucketFromScore(50, "edu")).toBe(bucketFromScore(50, "comedy"));
    expect(bucketFromScore(50, "lifestyle")).toBe(
      bucketFromScore(50, "beauty"),
    );
  });
});
