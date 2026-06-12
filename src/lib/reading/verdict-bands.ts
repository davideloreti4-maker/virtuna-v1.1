/**
 * VERDICT_BANDS — the SINGLE Phase-3 calibration target (D-04).
 *
 * Phase 2 extracts the verdict band thresholds (historically duplicated across
 * `components/board/verdict/verdict-constants.ts` `BAND_THRESHOLDS`/`bandFromScore`
 * and `components/board/verdict/verdict-derive.ts` `bandLabel` — same numbers, two
 * files, different labels) into ONE exported constant. The Reading's verdict block
 * reads its band from `bandFor(score)` here.
 *
 * Phase 3 calibration tunes THIS array (and only this array): it adjusts the
 * thresholds against measured same-video score variance and adds the buffer zone
 * for the first-class "Mixed signals" band (D-07 — the `/100` number is demoted to
 * in-body supporting evidence; the throne shows judgment, not a metric). The legacy
 * board copies are board-only and intentionally left byte-unchanged (the freeze is
 * on the engine, not these presentation files) — they carry drift-redirect comments
 * pointing here so calibration never edits the wrong file (Pitfall 4 / T-02-04).
 *
 * Labels are the Reading-facing wording ('High potential' / 'Solid contender' /
 * 'Needs work'), NOT the board's 'Strong' / 'Mid' / 'Low'.
 */

export interface VerdictBand {
  id: 'high' | 'solid' | 'needs-work';
  label: string;
  /** Inclusive lower bound on overall_score (0-100); bands are listed descending. */
  min: number;
}

/**
 * Descending-by-`min` band table. `bandFor` relies on this ordering: it returns the
 * first band whose `min <= score`. The terminal band (`needs-work`, min 0) is the
 * exhaustive fallback so `bandFor` never returns undefined for any finite score.
 */
export const VERDICT_BANDS: readonly VerdictBand[] = [
  { id: 'high', label: 'High potential', min: 70 },
  { id: 'solid', label: 'Solid contender', min: 40 },
  { id: 'needs-work', label: 'Needs work', min: 0 },
] as const;

/**
 * Map a 0-100 `overall_score` to its verdict band. Returns the first band whose
 * `min <= score` (bands are descending), falling back to the terminal `needs-work`
 * band — so it is total over every finite score (never undefined).
 */
export function bandFor(score: number): VerdictBand {
  return (
    VERDICT_BANDS.find((b) => score >= b.min) ??
    VERDICT_BANDS[VERDICT_BANDS.length - 1]!
  );
}

/**
 * DEAD_BAND_FLOOR — the minimum dead-band half-width (in score points) around each
 * non-terminal VERDICT_BANDS threshold (D-03; planner-chosen ±5pt).
 *
 * LOAD-BEARING: the engine is deterministic (temp:0 + seed:7 + maxRetries:0, live in
 * ENGINE_VERSION 3.19.0), so the measured same-video score variance is ~= 0. Without a
 * non-zero floor the first-class "Mixed signals" verdict would collapse to the
 * antiViralityGated-only path and stop being common. This floor keeps it first-class
 * regardless of how small the measured variance turns out to be.
 *
 * Relationship to the measured variance (GATE-01, 03-01): the caller passes
 * `Math.ceil(Math.max(measuredVarianceHalfwidth, DEAD_BAND_FLOOR))`, so the effective
 * buffer is >= the variance BY CONSTRUCTION (max, then round up) — the GATE-03
 * "buffer > variance" proof holds for any measured value.
 *
 * NOTE: the live 03-01 smoke batch is DEFERRED, so the measured half-width is not yet
 * wired in here. Given the determinism gate it is expected ~= 0 (well under this floor);
 * the GATE-03 decision must confirm `DEAD_BAND_FLOOR (5) >= measured half-width` once the
 * batch lands. Runtime is unaffected either way: confidenceLanguage() calls inDeadBand()
 * with the default floor, so the measured number documents the proof, it does not flow
 * into the verdict.
 */
export const DEAD_BAND_FLOOR = 5;

/**
 * True when `score` sits within `buffer` (inclusive) of ANY non-terminal VERDICT_BANDS
 * threshold (the 70 and 40 mins). The terminal `needs-work` min (0) is NOT a buffered
 * threshold — a 0 score is not "near a boundary". Thresholds are derived from the array
 * (never hard-coded) so they track any future re-tune. Pure + total, mirrors bandFor's
 * style (no React, no I/O).
 */
export function inDeadBand(
  score: number,
  buffer: number = DEAD_BAND_FLOOR
): boolean {
  const thresholds = VERDICT_BANDS.map((b) => b.min).filter((min) => min > 0);
  return thresholds.some((t) => Math.abs(score - t) <= buffer);
}
