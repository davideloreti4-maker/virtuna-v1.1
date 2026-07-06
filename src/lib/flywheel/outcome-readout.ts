/**
 * outcome-readout — the DISPLAY-side "predicted vs actual" summary (FLYWHEEL, receipt UI).
 *
 * Pure, deterministic, UI-facing. Turns a pinned PREDICTED disposition vector + the REALIZED
 * one into an honest, glanceable readout: a "match %" + one plain-language standout. This is
 * SEPARATE from `reconcile.ts` (which feeds recalibration with its own calibration/craft
 * semantics) — this module only exists to say something true to the creator at capture time.
 *
 * Honesty note — the like-for-like fix: `realizedSignature` normalizes ACROSS PRESENT channels
 * only (a public-only capture yields collector+connector summing to 1.0), while the predicted
 * vector spans all 6 dispositions. Comparing them raw would systematically overstate divergence.
 * So we RENORMALIZE the predicted vector over exactly the dispositions we measured, then compare
 * distributions on the same support. The copy is scoped honestly ("on what we could measure").
 *
 * Guards (never a misleading number):
 *  - < 2 measured dispositions → no match % (a 1-point "distribution" is trivially 100%).
 *  - either side sums to 0 over the measured support → no match %.
 */

import type { Disposition } from "@/lib/audience/audience-types";

/** The "who showed up" dispositions (reconcile.ts A1) — preferred for the standout line. */
const CALIBRATION: readonly Disposition[] = ["collector", "connector", "converter"] as const;

/** Plain, honest nouns for the standout line (never the raw enum). */
const NOUN: Record<Disposition, string> = {
  collector: "savers",
  connector: "sharers",
  converter: "converters",
  scanner: "skimmers",
  lurker: "quiet watchers",
  skeptic: "skeptics",
};

/** A real shift has to clear this (renormalized share delta) before we name a standout. */
const STANDOUT_MIN = 0.03;

export interface OutcomeReadout {
  /** Dispositions actually measured (present in BOTH predicted and realized). */
  measured: Disposition[];
  /** 0..100 similarity of prediction to reality over the measured support; null if uncomparable. */
  matchPct: number | null;
  /** One honest plain-language standout ("Your savers showed up stronger…"), or null. */
  headline: string | null;
}

/**
 * Build the display readout from a predicted + realized disposition vector.
 * Pure + deterministic.
 */
export function buildOutcomeReadout(
  predicted: Partial<Record<Disposition, number>>,
  realized: Partial<Record<Disposition, number>>,
): OutcomeReadout {
  const measured = (Object.keys(realized) as Disposition[]).filter(
    (d) => realized[d] != null && predicted[d] != null,
  );

  // Need at least two dispositions to compare a distribution meaningfully.
  if (measured.length < 2) {
    return { measured, matchPct: null, headline: null };
  }

  const predSum = measured.reduce((a, d) => a + (predicted[d] ?? 0), 0);
  const realSum = measured.reduce((a, d) => a + (realized[d] ?? 0), 0);
  if (predSum <= 0 || realSum <= 0) {
    return { measured, matchPct: null, headline: null };
  }

  // Renormalize both over the measured support (like-for-like), then total-variation distance.
  const p: Partial<Record<Disposition, number>> = {};
  const r: Partial<Record<Disposition, number>> = {};
  let tvd = 0;
  for (const d of measured) {
    p[d] = (predicted[d] ?? 0) / predSum;
    r[d] = (realized[d] ?? 0) / realSum;
    tvd += Math.abs((p[d] ?? 0) - (r[d] ?? 0));
  }
  tvd /= 2; // total variation distance ∈ [0, 1]
  const matchPct = Math.round((1 - tvd) * 100);

  // Standout = the largest renormalized shift; a calibration disposition wins a near-tie
  // (it's the moat signal — "who showed up"). Only named if it clears STANDOUT_MIN.
  let best: Disposition | null = null;
  let bestScore = -1;
  for (const d of measured) {
    const mag = Math.abs((r[d] ?? 0) - (p[d] ?? 0));
    const score = mag + (CALIBRATION.includes(d) ? 1e-4 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }

  let headline: string | null = null;
  if (best && Math.abs((r[best] ?? 0) - (p[best] ?? 0)) >= STANDOUT_MIN) {
    headline =
      (r[best] ?? 0) > (p[best] ?? 0)
        ? `Your ${NOUN[best]} showed up stronger than the room predicted.`
        : `Fewer ${NOUN[best]} than the room predicted.`;
  }

  return { measured, matchPct, headline };
}
