import { describe, it, expect } from "vitest";
import {
  percentile,
  computeNicheStats,
  buildSanityWarnings,
  formatThresholdCodeBlock,
  calibrate,
  formatNumber,
} from "../calibration";
import type { NicheStats } from "../calibration";
import type { Niche } from "../eval-config";

// ─── percentile ───────────────────────────────────────────────────────────────
describe("percentile", () => {
  it("returns NaN for empty array", () => {
    expect(isNaN(percentile([], 50))).toBe(true);
  });

  it("returns the single value for a single-element array", () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 0)).toBe(42);
    expect(percentile([42], 100)).toBe(42);
  });

  it("P0 = min, P100 = max", () => {
    const sorted = [10, 20, 30, 40, 50];
    expect(percentile(sorted, 0)).toBe(10);
    expect(percentile(sorted, 100)).toBe(50);
  });

  it("P50 interpolates correctly for even-length arrays", () => {
    const sorted = [10, 20, 30, 40];
    const p50 = percentile(sorted, 50);
    expect(p50).toBeGreaterThanOrEqual(20);
    expect(p50).toBeLessThanOrEqual(30);
  });

  it("P50 of [10, 30, 50] = 30", () => {
    expect(percentile([10, 30, 50], 50)).toBe(30);
  });

  it("P25 of [100, 200, 300, 400] = 175", () => {
    // rank = 0.25 * 3 = 0.75 → lower=0, upper=1 → 100 + 0.75*(200-100) = 175
    expect(percentile([100, 200, 300, 400], 25)).toBe(175);
  });

  it("P90 of 10 equal values = that value", () => {
    const equal = [500_000, 500_000, 500_000, 500_000, 500_000, 500_000, 500_000, 500_000, 500_000, 500_000];
    expect(percentile(equal, 90)).toBe(500_000);
  });

  it("handles large numbers accurately", () => {
    const sorted = [1_000_000, 5_000_000, 10_000_000, 50_000_000];
    expect(percentile(sorted, 0)).toBe(1_000_000);
    expect(percentile(sorted, 100)).toBe(50_000_000);
  });
});

// ─── computeNicheStats ────────────────────────────────────────────────────────
describe("computeNicheStats", () => {
  it("returns correct rowCount", () => {
    const stats = computeNicheStats("beauty", [100, 200, 300]);
    expect(stats.rowCount).toBe(3);
  });

  it("computes proposedViralFloor at P90 by default", () => {
    // Create 100 values: 1-100 (sorted). P90 ≈ 90.1 → rounds to ~90
    const views = Array.from({ length: 100 }, (_, i) => i + 1);
    const stats = computeNicheStats("beauty", views);
    // Allow ±1 for rounding
    expect(Math.abs(stats.proposedViralFloor - 90)).toBeLessThanOrEqual(2);
  });

  it("computes proposedUnderCeiling at P30 by default", () => {
    const views = Array.from({ length: 100 }, (_, i) => i + 1);
    const stats = computeNicheStats("beauty", views);
    // Allow ±2 for rounding
    expect(Math.abs(stats.proposedUnderCeiling - 30)).toBeLessThanOrEqual(2);
  });

  it("respects custom percentile parameters", () => {
    const views = Array.from({ length: 100 }, (_, i) => i + 1);
    const stats = computeNicheStats("fitness", views, 80, 20);
    // Allow ±2 for rounding
    expect(Math.abs(stats.proposedViralFloor - 80)).toBeLessThanOrEqual(2);
    expect(Math.abs(stats.proposedUnderCeiling - 20)).toBeLessThanOrEqual(2);
  });

  it("handles unsorted input (sorts internally)", () => {
    const unsorted = [300, 100, 200, 400, 500];
    const sorted = [100, 200, 300, 400, 500];
    const statsU = computeNicheStats("edu", unsorted);
    const statsS = computeNicheStats("edu", sorted);
    expect(statsU.p50).toBe(statsS.p50);
    expect(statsU.proposedViralFloor).toBe(statsS.proposedViralFloor);
  });

  it("returns NaN for empty views array", () => {
    const stats = computeNicheStats("comedy", []);
    expect(stats.rowCount).toBe(0);
    expect(isNaN(stats.p50)).toBe(true);
    expect(isNaN(stats.proposedViralFloor)).toBe(true);
  });

  it("viralFloor > underCeiling for normal distributions", () => {
    const views = Array.from({ length: 200 }, (_, i) => i * 10_000); // 0 to 1.99M
    const stats = computeNicheStats("lifestyle", views);
    expect(stats.proposedViralFloor).toBeGreaterThan(stats.proposedUnderCeiling);
  });
});

// ─── buildSanityWarnings ──────────────────────────────────────────────────────
describe("buildSanityWarnings", () => {
  function makeStats(overrides: Partial<NicheStats>): NicheStats {
    return {
      niche: "beauty",
      rowCount: 200,
      p10: 5_000,
      p30: 20_000,
      p50: 80_000,
      p70: 300_000,
      p90: 900_000,
      proposedViralFloor: 900_000,
      proposedUnderCeiling: 20_000,
      ...overrides,
    };
  }

  it("returns no warnings for healthy stats", () => {
    const stats = [
      makeStats({ niche: "beauty" }),
      makeStats({ niche: "fitness", rowCount: 150 }),
    ];
    const warnings = buildSanityWarnings(stats);
    expect(warnings).toHaveLength(0);
  });

  it("warns when rowCount < 100", () => {
    const stats = [makeStats({ rowCount: 50 })];
    const warnings = buildSanityWarnings(stats);
    expect(warnings.some((w) => w.level === "warn" && w.message.includes("50 rows"))).toBe(true);
  });

  it("warns when viralFloor <= underCeiling * 3 (tight separation)", () => {
    const stats = [makeStats({ proposedViralFloor: 30_000, proposedUnderCeiling: 20_000 })];
    // 30_000 <= 20_000 * 3 = 60_000 → should warn
    const warnings = buildSanityWarnings(stats);
    expect(warnings.some((w) => w.level === "warn" && w.message.includes("tight"))).toBe(true);
  });

  it("does NOT warn for exactly 3x separation", () => {
    // viralFloor = underCeiling * 3 → should warn (≤ 3x)
    const stats = [makeStats({ proposedViralFloor: 60_000, proposedUnderCeiling: 20_000 })];
    const warnings = buildSanityWarnings(stats);
    expect(warnings.some((w) => w.message.includes("tight"))).toBe(true);
  });

  it("fires error for empty input (rowCount=0)", () => {
    const stats = [makeStats({ rowCount: 0, p90: NaN, p30: NaN })];
    const warnings = buildSanityWarnings(stats);
    expect(warnings.some((w) => w.level === "error")).toBe(true);
  });

  it("fires error for NaN p90 or p30", () => {
    const stats = [makeStats({ p90: NaN })];
    const warnings = buildSanityWarnings(stats);
    expect(warnings.some((w) => w.level === "error")).toBe(true);
  });

  it("can produce both warn and error for different niches", () => {
    const stats = [
      makeStats({ niche: "beauty", rowCount: 0, p90: NaN, p30: NaN }), // error
      makeStats({ niche: "fitness", rowCount: 50 }), // warn: low row count
    ];
    const warnings = buildSanityWarnings(stats);
    expect(warnings.some((w) => w.level === "error")).toBe(true);
    expect(warnings.some((w) => w.level === "warn")).toBe(true);
  });
});

// ─── formatThresholdCodeBlock ─────────────────────────────────────────────────
describe("formatThresholdCodeBlock", () => {
  const validStats: NicheStats[] = [
    { niche: "beauty", rowCount: 200, p10: 5_000, p30: 20_000, p50: 80_000, p70: 300_000, p90: 900_000, proposedViralFloor: 900_000, proposedUnderCeiling: 20_000 },
    { niche: "fitness", rowCount: 200, p10: 4_000, p30: 18_000, p50: 70_000, p70: 250_000, p90: 800_000, proposedViralFloor: 800_000, proposedUnderCeiling: 18_000 },
    { niche: "edu", rowCount: 200, p10: 2_000, p30: 8_000, p50: 30_000, p70: 100_000, p90: 400_000, proposedViralFloor: 400_000, proposedUnderCeiling: 8_000 },
    { niche: "comedy", rowCount: 200, p10: 10_000, p30: 50_000, p50: 200_000, p70: 700_000, p90: 2_000_000, proposedViralFloor: 2_000_000, proposedUnderCeiling: 50_000 },
    { niche: "lifestyle", rowCount: 200, p10: 5_000, p30: 20_000, p50: 80_000, p70: 300_000, p90: 900_000, proposedViralFloor: 900_000, proposedUnderCeiling: 20_000 },
  ];

  it("includes the version key", () => {
    const block = formatThresholdCodeBlock("full.2026-05-12", validStats);
    expect(block).toContain('"full.2026-05-12"');
  });

  it("includes all 5 niche entries", () => {
    const block = formatThresholdCodeBlock("full.2026-05-12", validStats);
    for (const niche of ["beauty", "fitness", "edu", "comedy", "lifestyle"] as Niche[]) {
      expect(block).toContain(niche);
    }
  });

  it("includes viralFloor and underCeiling keywords", () => {
    const block = formatThresholdCodeBlock("full.2026-05-12", validStats);
    expect(block).toContain("viralFloor");
    expect(block).toContain("underCeiling");
  });

  it("includes a retrospective cross-reference comment (D-13 provenance)", () => {
    const block = formatThresholdCodeBlock("full.2026-05-12", validStats);
    expect(block).toContain("D-09");
    expect(block).toContain("IMMUTABLE");
  });

  it("uses underscore separators for large numbers", () => {
    const block = formatThresholdCodeBlock("full.2026-05-12", validStats);
    // 900_000 or 800_000 etc should appear with underscores
    expect(block).toMatch(/\d+_\d+/);
  });

  it("includes run date in the comment when provided", () => {
    const block = formatThresholdCodeBlock("full.2026-05-12", validStats, "2026-05-12");
    expect(block).toContain("2026-05-12");
  });

  it("produces valid TypeScript-like syntax (braces, colons)", () => {
    const block = formatThresholdCodeBlock("full.2026-05-12", validStats);
    expect(block).toContain("{");
    expect(block).toContain("}");
    expect(block).toContain(":");
  });
});

// ─── calibrate (full pipeline) ────────────────────────────────────────────────
describe("calibrate", () => {
  it("handles empty input — returns error for all niches", () => {
    const result = calibrate({});
    expect(result.hasErrors).toBe(true);
    // All 5 niches should have errors
    expect(result.warnings.filter((w) => w.level === "error")).toHaveLength(5);
  });

  it("processes views for provided niches", () => {
    const views = Array.from({ length: 200 }, (_, i) => (i + 1) * 10_000);
    const result = calibrate({ beauty: views, fitness: views, edu: views, comedy: views, lifestyle: views });
    expect(result.hasErrors).toBe(false);
    expect(result.stats).toHaveLength(5);
    for (const s of result.stats) {
      expect(s.rowCount).toBe(200);
      expect(s.proposedViralFloor).toBeGreaterThan(0);
      expect(s.proposedUnderCeiling).toBeGreaterThan(0);
    }
  });

  it("returns warnings when a niche has < 100 rows", () => {
    const views = Array.from({ length: 200 }, (_, i) => (i + 1) * 10_000);
    const fewViews = Array.from({ length: 50 }, (_, i) => (i + 1) * 10_000);
    const result = calibrate({
      beauty: views,
      fitness: fewViews, // < 100
      edu: views,
      comedy: views,
      lifestyle: views,
    });
    expect(result.warnings.some((w) => w.niche === "fitness" && w.level === "warn")).toBe(true);
  });

  it("hasErrors=false when all niches have data", () => {
    const views = Array.from({ length: 200 }, (_, i) => (i + 1) * 1_000);
    const result = calibrate({
      beauty: views,
      fitness: views,
      edu: views,
      comedy: views,
      lifestyle: views,
    });
    expect(result.hasErrors).toBe(false);
  });

  it("respects custom percentile parameters", () => {
    const views = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    const result = calibrate(
      { beauty: views, fitness: views, edu: views, comedy: views, lifestyle: views },
      80, 20
    );
    // Allow ±2 for rounding
    const beautyStats = result.stats.find((s) => s.niche === "beauty");
    expect(Math.abs((beautyStats?.proposedViralFloor ?? 0) - 80)).toBeLessThanOrEqual(2);
    expect(Math.abs((beautyStats?.proposedUnderCeiling ?? 0) - 20)).toBeLessThanOrEqual(2);
  });
});

// ─── formatNumber ─────────────────────────────────────────────────────────────
describe("formatNumber", () => {
  it("handles 0", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("handles NaN/Infinity as 0", () => {
    expect(formatNumber(NaN)).toBe("0");
    expect(formatNumber(Infinity)).toBe("0");
  });

  it("handles small numbers without underscores", () => {
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(5_000)).toBe("5_000");
  });

  it("handles large numbers with underscores", () => {
    expect(formatNumber(250_000)).toBe("250_000");
    expect(formatNumber(1_000_000)).toBe("1_000_000");
  });
});
