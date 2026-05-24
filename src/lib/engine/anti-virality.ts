/**
 * Phase 1 (R1.9) — Anti-virality confidence threshold.
 *
 * When a prediction's `confidence` falls below this cutoff, the UI renders the
 * "Don't post yet" verdict state (orange GlassPill warning) instead of a
 * percentile prediction. The threshold marks the point where the model is
 * systematically wrong on high-predicted-score outputs — below which the
 * "Don't post" recommendation is statistically defensible.
 *
 * --- PROVENANCE ---
 * Calibration script:  scripts/calibrate-anti-virality.ts
 * Last calibrated:     2026-05-24 (Phase 1)
 * Method:              Threshold sweep against `outcomes` table.
 *
 * --- VARIANT B: Insufficient-data fallback ---
 * Sample size (N):     <50 — insufficient calibration corpus.
 * Calibration result:  outcomes table empty (0 rows). Per RESEARCH Open
 *                      Question 1 + Assumption A1, the documented fallback
 *                      path is taken.
 * Chosen because:      Matches existing `calculateConfidence()` LOW band cutoff
 *                      (`confidence < 0.4`) in src/lib/engine/aggregator.ts —
 *                      preserves alignment between the UI's "Don't post yet"
 *                      verdict and the engine's confidence_label = "LOW" band.
 * TODO(M2-II):         Revisit once outcome data accumulates. Rerun
 *                      scripts/calibrate-anti-virality.ts when outcomes row
 *                      count ≥ 50, then replace this constant with the
 *                      script-recommended value and switch this provenance
 *                      block to "Variant A: Real corpus result".
 *
 * --- END PROVENANCE ---
 */
export const ANTI_VIRALITY_THRESHOLD = 0.4;

/** True when confidence is below the cutoff (UI renders "Don't post yet"). */
export function isAntiViralityGated(confidence: number): boolean {
  return confidence < ANTI_VIRALITY_THRESHOLD;
}
