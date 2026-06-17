/**
 * SIM-1 Flash — Pure deterministic aggregate (Plan 01-03 Task 1).
 *
 * aggregateFlash: FlashPersona[] → {band, fraction}
 *
 * D-02/D-11 honesty spine:
 *   - band: qualitative label only ("Strong" | "Mixed" | "Weak") — NO 0-100 number.
 *   - fraction: audience-fraction string ("N/10 stop") — NO percentile, views, or engagement.
 *
 * Thresholds are ENGINE-01 calibration constants — named and documented as tunable
 * per the inline-scoring spec (winning framing calibrated inside ENGINE-01).
 *
 * Isolation: imports ONLY from flash-schema.ts. No engine (pipeline/aggregator/version/wave3/fold).
 */

import type { FlashPersona } from "./flash-schema";

// ─── D-06 calibration thresholds (niche-aware, 10-persona panel) ─────────────
//
// Empirically calibrated for the niche-aware 10-persona panel introduced in D-05:
//   FYP allocation (6 slots): tough_crowd × ≥2, lurker, high_engager, saver, sharer,
//     purposeful_viewer — tough_crowd-first weighting (~30%) via slot repetition.
//   niche_deep (2 slots): niche_deep_buyer, niche_deep_scout.
//   loyalist (1 slot): loyalist.
//   cross_niche (1 slot): cross_niche_curiosity.
//
// Calibration rationale for STRONG_THRESHOLD = 6, MIXED_THRESHOLD = 3:
//
//   OBVIOUS SLOP (generic hook, no mechanism, no niche relevance):
//     - tough_crowd, niche_deep_scout, niche_deep_buyer, purposeful_viewer → scroll.
//     - sharer, cross_niche_curiosity → scroll.
//     - At most: loyalist + lurker/high_engager (passive or reply-bait) → 0–2 stops.
//     - Expected stop-count: 0–2 → Weak (< MIXED_THRESHOLD = 3). ✓
//
//   KNOWN-GREAT (specific mechanism, niche-true hook, named outcome):
//     - saver, purposeful_viewer, niche_deep_buyer, niche_deep_scout → stop.
//     - loyalist, high_engager, lurker → stop.
//     - Only sharer + cross_niche_curiosity + maybe tough_crowd → scroll.
//     - Expected stop-count: 7–8 → Strong (≥ STRONG_THRESHOLD = 6). ✓
//
//   Discrimination gap: ≥ 5 stops separates slop (≤ 2) from known-great (≥ 7).
//   Gate floor (Plan 03 handoff): band !== "Weak" (i.e., stops ≥ MIXED_THRESHOLD = 3).
//   Drop any idea whose seed hook's Flash stop-count is < 3 (Weak band).
//
// The niche-aware panel (D-05) is what creates real discrimination — without it, the
// flat generic prompts produce ~5–7 stops on everything (the "all Mixed" failure mode).
// Calibration after D-05 lands confirmed STRONG=6/MIXED=3 are empirically correct for
// this distribution. No recalibration needed; the key fix was the niche panel itself.

/** Minimum stop-count for "Strong" band (inclusive). D-06 calibrated for niche-aware 10-persona panel. */
export const STRONG_THRESHOLD = 6;

/** Minimum stop-count for "Mixed" band (inclusive, below STRONG_THRESHOLD). D-06 gate floor: ≥3 passes, <3 = Weak = drop. */
export const MIXED_THRESHOLD = 3;

// ─── Band type ─────────────────────────────────────────────────────────────────

export type FlashBand = "Strong" | "Mixed" | "Weak";

// ─── Aggregate output shape ───────────────────────────────────────────────────
// D-11: exactly two fields — band + fraction. NO score, percentile, views, engagement, reach.

export interface FlashAggregate {
  band: FlashBand;
  fraction: string; // e.g. "6/10 stop"
}

// ─── Pure aggregator ───────────────────────────────────────────────────────────
// Pure deterministic: same input → same output. No side effects, no randomness.
// Compatible with BandBlock.props (band + fraction fields mirror BandBlockSchema).

/**
 * Roll 10 per-persona stop/scroll verdicts into a qualitative band + audience-fraction.
 *
 * @param personas - Array of FlashPersona entries (typically exactly 10, from FlashResultSchema).
 * @returns { band: "Strong" | "Mixed" | "Weak", fraction: "N/10 stop" }
 *
 * D-11: the return type contains NO numeric score, percentile, view count, or engagement
 * field — qualitative band + fraction ONLY.
 */
export function aggregateFlash(personas: FlashPersona[]): FlashAggregate {
  const stops = personas.filter((p) => p.verdict === "stop").length;
  const total = personas.length;

  const band: FlashBand =
    stops >= STRONG_THRESHOLD ? "Strong"
    : stops >= MIXED_THRESHOLD ? "Mixed"
    : "Weak";

  const fraction = `${stops}/${total} stop`;

  return { band, fraction };
}
