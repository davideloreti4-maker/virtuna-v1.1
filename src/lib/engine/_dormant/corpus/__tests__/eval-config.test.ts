import { describe, it, expect } from "vitest";
import {
  NICHES,
  NICHE_THRESHOLDS,
  TARGET_DISTRIBUTION_PILOT,
  TARGET_DISTRIBUTION_FULL,
  MAX_PER_NICHE_REGRESSION_PP,
  BOOTSTRAP_ITERATIONS,
  SIGNIFICANCE_ALPHA,
  MIN_VIEWS_FOR_MAE_ENGAGEMENT,
  VIRAL_SCORE_CUT,
  UNDER_SCORE_CUT,
  requiredImprovementFor,
  type Niche,
  type Bucket,
} from "../eval-config";

describe("eval-config / NICHES", () => {
  it("contains exactly 5 niches (D-03)", () => {
    expect(NICHES.length).toBe(5);
  });

  it("contains the D-03 niche set", () => {
    expect(new Set(NICHES)).toEqual(
      new Set(["beauty", "fitness", "edu", "comedy", "lifestyle"]),
    );
  });
});

describe("eval-config / NICHE_THRESHOLDS (D-08 pilot snapshot)", () => {
  it("has entries for every niche", () => {
    for (const niche of NICHES) {
      expect(NICHE_THRESHOLDS[niche]).toBeDefined();
    }
  });

  it("encodes the D-08 pilot starting thresholds exactly", () => {
    expect(NICHE_THRESHOLDS.beauty.viralFloor).toBe(250_000);
    expect(NICHE_THRESHOLDS.beauty.underCeiling).toBe(5_000);
    expect(NICHE_THRESHOLDS.fitness.viralFloor).toBe(200_000);
    expect(NICHE_THRESHOLDS.fitness.underCeiling).toBe(5_000);
    expect(NICHE_THRESHOLDS.edu.viralFloor).toBe(100_000);
    expect(NICHE_THRESHOLDS.edu.underCeiling).toBe(2_000);
    expect(NICHE_THRESHOLDS.comedy.viralFloor).toBe(500_000);
    expect(NICHE_THRESHOLDS.comedy.underCeiling).toBe(10_000);
    expect(NICHE_THRESHOLDS.lifestyle.viralFloor).toBe(250_000);
    expect(NICHE_THRESHOLDS.lifestyle.underCeiling).toBe(5_000);
  });

  it("viralFloor > underCeiling for every niche (sanity)", () => {
    for (const niche of NICHES) {
      const t = NICHE_THRESHOLDS[niche];
      expect(t.viralFloor).toBeGreaterThan(t.underCeiling);
    }
  });
});

describe("eval-config / TARGET_DISTRIBUTION", () => {
  it("pilot is 10/20/20 (D-01)", () => {
    expect(TARGET_DISTRIBUTION_PILOT).toEqual({
      viral: 10,
      average: 20,
      under: 20,
    });
  });

  it("full is 100/200/200 (D-01)", () => {
    expect(TARGET_DISTRIBUTION_FULL).toEqual({
      viral: 100,
      average: 200,
      under: 200,
    });
  });
});

describe("eval-config / numeric constants", () => {
  it("MAX_PER_NICHE_REGRESSION_PP === 0.05 (D-15)", () => {
    expect(MAX_PER_NICHE_REGRESSION_PP).toBe(0.05);
  });

  it("BOOTSTRAP_ITERATIONS === 200 (D-17 minimum)", () => {
    expect(BOOTSTRAP_ITERATIONS).toBe(200);
  });

  it("SIGNIFICANCE_ALPHA === 0.05 (D-17 p-value)", () => {
    expect(SIGNIFICANCE_ALPHA).toBe(0.05);
  });

  it("MIN_VIEWS_FOR_MAE_ENGAGEMENT === 1000 (Pitfall 4)", () => {
    expect(MIN_VIEWS_FOR_MAE_ENGAGEMENT).toBe(1000);
  });

  it("score-to-bucket cuts: VIRAL=70, UNDER=30", () => {
    expect(VIRAL_SCORE_CUT).toBe(70);
    expect(UNDER_SCORE_CUT).toBe(30);
  });
});

describe("eval-config / requiredImprovementFor (D-18 sliding scale)", () => {
  it("low band (≤ 0.40) → 15% required improvement", () => {
    expect(requiredImprovementFor(0.0)).toBe(0.15);
    expect(requiredImprovementFor(0.3)).toBe(0.15);
    // boundary inclusive on lower band
    expect(requiredImprovementFor(0.4)).toBe(0.15);
  });

  it("mid band (0.40 < x ≤ 0.55) → 10% required improvement", () => {
    expect(requiredImprovementFor(0.41)).toBe(0.1);
    expect(requiredImprovementFor(0.5)).toBe(0.1);
    // boundary inclusive
    expect(requiredImprovementFor(0.55)).toBe(0.1);
  });

  it("high band (> 0.55) → 7% required improvement", () => {
    expect(requiredImprovementFor(0.56)).toBe(0.07);
    expect(requiredImprovementFor(0.65)).toBe(0.07);
    expect(requiredImprovementFor(1.0)).toBe(0.07);
  });
});

describe("eval-config / type assertions", () => {
  it("Niche is a string-literal union covering all 5 niches", () => {
    const n: Niche = "beauty";
    expect(NICHES).toContain(n);
  });

  it("Bucket covers the three outcome buckets", () => {
    const b: Bucket[] = ["viral", "average", "under"];
    expect(b.length).toBe(3);
  });
});
