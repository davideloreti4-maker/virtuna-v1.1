// Threshold formula constants for the v3 acceptance benchmark (BENCH-01..06).
// Cross-referenced by: .planning/research/v2.1-baseline.md (D-19).
//
// IMPORTANT: NICHE_THRESHOLDS here are PILOT starting values (D-08). They are
// initial guesses, not load-bearing. D-09 mandates empirical recalibration from
// pilot scrape data before the 500-video corpus seals its corpus_version.
// Full-corpus thresholds are written into thresholds.ts THRESHOLD_SNAPSHOTS,
// not here.

// D-03: the locked niche set for the Engine Foundation milestone.
export const NICHES = [
  "beauty",
  "fitness",
  "edu",
  "comedy",
  "lifestyle",
] as const;

export type Niche = (typeof NICHES)[number];

// Outcome bucket label — string-literal union (mirrors types.ts:123 ConfidenceLevel idiom).
export type Bucket = "viral" | "average" | "under";

/**
 * D-08 pilot starting thresholds (per-niche absolute view bands).
 * Loose by design — chosen to ensure all buckets fill so the eval harness
 * runs end-to-end. NOT load-bearing for the v3 acceptance gate. D-09 mandates
 * empirical recalibration from pilot scrape data before the full corpus is
 * sealed; the recalibrated snapshot lives in thresholds.ts THRESHOLD_SNAPSHOTS
 * keyed by the new `corpus_version`.
 */
export const NICHE_THRESHOLDS = {
  beauty: { viralFloor: 250_000, underCeiling: 5_000 },
  fitness: { viralFloor: 200_000, underCeiling: 5_000 },
  edu: { viralFloor: 100_000, underCeiling: 2_000 },
  comedy: { viralFloor: 500_000, underCeiling: 10_000 },
  lifestyle: { viralFloor: 250_000, underCeiling: 5_000 },
} as const;

// D-01: target distribution counts per build.
export const TARGET_DISTRIBUTION_PILOT = {
  viral: 10,
  average: 20,
  under: 20,
} as const;

export const TARGET_DISTRIBUTION_FULL = {
  viral: 100,
  average: 200,
  under: 200,
} as const;

// D-15: per-niche regression floor (5 percentage points).
export const MAX_PER_NICHE_REGRESSION_PP = 0.05;

// D-17: paired bootstrap minimum iterations + significance threshold.
export const BOOTSTRAP_ITERATIONS = 200;
export const SIGNIFICANCE_ALPHA = 0.05;

// Pitfall 4: engagement-rate MAE noise floor (suppress views < 1000 from MAE pool).
export const MIN_VIEWS_FOR_MAE_ENGAGEMENT = 1_000;

// score-to-bucket Phase 1 cuts (Phase 10 calibrates per-niche).
export const VIRAL_SCORE_CUT = 70;
export const UNDER_SCORE_CUT = 30;

/**
 * D-18 sliding-scale required improvement vs v2.1 baseline.
 *
 *   baseline ≤ 0.40 → 15% relative improvement required
 *   0.40 < baseline ≤ 0.55 → 10%
 *   baseline > 0.55 → 7%
 *
 * Boundary semantics: lower band inclusive on its upper edge (≤ 0.40),
 * mid band inclusive on its upper edge (≤ 0.55). Pure function.
 */
export function requiredImprovementFor(baselineMacroF1: number): number {
  if (baselineMacroF1 <= 0.4) return 0.15;
  if (baselineMacroF1 <= 0.55) return 0.1;
  return 0.07;
}
