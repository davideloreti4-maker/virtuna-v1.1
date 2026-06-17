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

// ─── ENGINE-01 calibration thresholds ─────────────────────────────────────────
// These are tunable per the inline-scoring spec — named constants, not magic numbers.
// Calibrated for "relative pull on text content":
//   STRONG_THRESHOLD: ≥6 of 10 personas stop — strong pull signal
//   MIXED_THRESHOLD:  ≥3 of 10 personas stop — moderate pull signal
// Below MIXED_THRESHOLD → Weak (1–2 stops, or 0).

/** Minimum stop-count for "Strong" band (inclusive). Tunable per ENGINE-01 calibration. */
export const STRONG_THRESHOLD = 6;

/** Minimum stop-count for "Mixed" band (inclusive, below STRONG_THRESHOLD). Tunable. */
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
