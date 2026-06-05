/**
 * Engine version — single source of truth.
 * Flipped 3.0.0-dev → 3.0.0 by Phase 13 Plan 08 per D-27 + D-28 (10-video cadence superseded
 * by Qwen-migration deviation sign-off; see 13-FINAL-VALIDATION-REPORT.md).
 * Bumped 3.1.0 → 3.2.0 by Phase 2 Plan 02 (R1 verbatim threading): stale pre-verbatim
 * cached rows must not serve a verbatim-less result after this plan ships.
 * Bumped 3.2.0 → 3.3.0 by Phase 3 Plan 04 (Apollo blend rewire, D-04): stale pre-Apollo
 * cached rows must not serve an old gemini-term score after this plan ships.
 * Bumped 3.3.0 → 3.4.0 by Phase 4 Plan 05 (10-pass deletion): fold is now the sole
 * audience-sim path; stale rows produced by the 10-pass era must not mix with fold-era rows.
 * Bumped 3.4.0 → 3.5.0 by Phase 4 Plan 05 (fold model flip): fold default → qwen3.6-flash,
 * no-thinking (A/B-validated); behavioral scores shift from the plus-thinking era, so stale
 * 3.4.0 rows must not mix with flash-era rows.
 *
 * D-23 cache invariant: prediction-cache.ts keys on ENGINE_VERSION; this bump auto-invalidates
 * all `3.4.0` cached rows on next analyze-route call (L1 in-memory + L2 Supabase filter).
 */
export const ENGINE_VERSION = "3.5.0";
