/**
 * 1:1 E2E learning loop — outcome labeling (pure, self-contained).
 *
 * Ground-truth labels come from PERCENTILE-WITHIN-NICHE of REAL views, never
 * absolute counts (staleness discipline — a 1.5yr-old viral number is not a
 * current viral number, but its rank within its niche cohort is stable).
 *
 * Deliberately depends on NOTHING from the distrusted `corpus/` dataset — this
 * subsystem sets its own quality bar. Pure functions, fully unit-testable.
 */

export type OutcomeBucket = "viral" | "average" | "under";

export interface BucketThresholds {
  /** percentile (0-1) at/above which a video is "viral". Default 0.80. */
  viralAtOrAbove: number;
  /** percentile (0-1) at/below which a video is "under". Default 0.30. */
  underAtOrBelow: number;
}

export const DEFAULT_THRESHOLDS: BucketThresholds = {
  viralAtOrAbove: 0.8,
  underAtOrBelow: 0.3,
};

/** Map a within-niche percentile (0-1) to a three-class outcome bucket. */
export function bucketFromPercentile(
  percentile: number,
  t: BucketThresholds = DEFAULT_THRESHOLDS,
): OutcomeBucket {
  if (percentile >= t.viralAtOrAbove) return "viral";
  if (percentile <= t.underAtOrBelow) return "under";
  return "average";
}

export interface NicheRankInput {
  id: string;
  niche: string;
  real_views: number;
}

export interface NicheRankOutput {
  percentile: number; // 0-1, rank of this video's views within its niche cohort
  bucket: OutcomeBucket;
}

/**
 * Compute each video's percentile rank + outcome bucket WITHIN its own niche.
 *
 * Percentile = fraction of same-niche videos with strictly fewer views
 * (rank-based, tie-safe). A niche with a single video gets percentile 0 →
 * labeling that row is unreliable; callers should require a minimum cohort size
 * before trusting the label (see `MIN_NICHE_COHORT`).
 */
export function computeNicheBuckets(
  rows: NicheRankInput[],
  t: BucketThresholds = DEFAULT_THRESHOLDS,
): Map<string, NicheRankOutput> {
  const byNiche = new Map<string, NicheRankInput[]>();
  for (const r of rows) {
    const list = byNiche.get(r.niche) ?? [];
    list.push(r);
    byNiche.set(r.niche, list);
  }

  const out = new Map<string, NicheRankOutput>();
  for (const [, list] of byNiche) {
    const n = list.length;
    const views = list.map((r) => r.real_views);
    for (const r of list) {
      // fraction strictly below (rank-based percentile, stable to outliers)
      const below = views.filter((v) => v < r.real_views).length;
      const percentile = n > 1 ? below / (n - 1) : 0;
      out.set(r.id, { percentile, bucket: bucketFromPercentile(percentile, t) });
    }
  }
  return out;
}

/** Minimum same-niche cohort before a percentile label is trustworthy. */
export const MIN_NICHE_COHORT = 8;

const BUCKET_ORDER: Record<OutcomeBucket, number> = {
  under: 0,
  average: 1,
  viral: 2,
};

/** Ordinal distance between predicted + actual buckets (0 = exact, 2 = opposite). */
export function bucketDistance(a: OutcomeBucket, b: OutcomeBucket): number {
  return Math.abs(BUCKET_ORDER[a] - BUCKET_ORDER[b]);
}

/** Whether the engine's predicted bucket matches the real outcome bucket. */
export function bucketMatch(
  predicted: OutcomeBucket | null,
  actual: OutcomeBucket | null,
): boolean {
  return predicted !== null && actual !== null && predicted === actual;
}
