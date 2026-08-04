/**
 * Renormalising a model-authored distribution, instead of throwing the whole calibration away.
 *
 * ── The defect ─────────────────────────────────────────────────────────────────────────────
 * Calibration asks the model for ten persona shares that sum to 1.0, and the schema REJECTED
 * the run when they did not (±0.02). Measured live on a production build 2026-08-04: two of
 * five calibrations failed this way. In both, the Apify scrape had SUCCEEDED — 36 requests, 0
 * failed, ~$0.05 spent — and 135 seconds had elapsed. What the creator saw was:
 *
 *     Calibration failed. Check the handle and try again.
 *
 * Every clause of which is misleading. The handle was `@garyvee`, it is public, the scrape
 * worked, and the failure was OUR model returning 0.97 where our own schema wanted 1.00. The
 * creator is asked to fix something that was never broken, at the single highest-intent moment
 * in the funnel, having already cost us the scrape.
 *
 * ── Why renormalise rather than widen the tolerance ────────────────────────────────────────
 * These are proportions of one audience. Their MEANING is relative — "this reactor is twice as
 * common as that one" — and dividing through by the sum preserves every one of those ratios
 * exactly while making the constraint true by construction. Widening to ±0.1 would still reject
 * at 0.89 and would additionally let a genuinely skewed distribution through unnormalised, so
 * downstream code that assumes a simplex (population expansion, share-weighted scoring) would
 * quietly read the wrong numbers.
 *
 * ── Why there is still a floor and a ceiling ───────────────────────────────────────────────
 * A sum of 0.97 is a rounding artifact. A sum of 4.0 means the model answered a different
 * question — percentages, or per-persona confidences — and renormalising THAT would fabricate a
 * distribution out of something that was never one. So a plausible band is repaired and
 * anything outside it is still rejected, loudly.
 */

/** Sums within this of 1.0 are already fine and pass through untouched. */
const EXACT = 0.02;

/**
 * Outside this band the model answered a different question than the one asked, and the numbers
 * are not a distribution to be repaired.
 */
export const RENORMALISABLE_MIN = 0.5;
export const RENORMALISABLE_MAX = 1.5;

/** True when the sum is close enough to 1.0 to be repairable (or already correct). */
export function isRenormalisable(sum: number): boolean {
  return sum > RENORMALISABLE_MIN && sum < RENORMALISABLE_MAX;
}

/**
 * Scale `share` on each item so the shares sum to exactly 1.0. Relative magnitudes are
 * preserved; a set that already sums to 1.0 (±0.02) is returned unchanged rather than
 * re-derived, so exact model output stays byte-identical.
 */
export function normalizeShares<T extends { share: number }>(items: T[]): T[] {
  const sum = items.reduce((s, i) => s + i.share, 0);
  if (sum <= 0 || Math.abs(sum - 1) < EXACT) return items;
  return items.map((i) => ({ ...i, share: i.share / sum }));
}

/** The four named audience weights, in the order every schema declares them. */
export const WEIGHT_KEYS = ["fyp", "niche", "loyalist", "cross_niche"] as const;

/** The same repair for the four named audience weights. */
export function normalizeWeights<T extends Record<K, number>, K extends string>(
  weights: T,
  keys: readonly K[],
): T {
  const sum = keys.reduce((s, k) => s + weights[k], 0);
  if (sum <= 0 || Math.abs(sum - 1) < EXACT) return weights;
  const out = { ...weights };
  for (const k of keys) out[k] = (weights[k] / sum) as T[K];
  return out;
}
