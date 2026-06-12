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
