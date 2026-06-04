/**
 * Engine version — single source of truth.
 * Flipped 3.0.0-dev → 3.0.0 by Phase 13 Plan 08 per D-27 + D-28 (10-video cadence superseded
 * by Qwen-migration deviation sign-off; see 13-FINAL-VALIDATION-REPORT.md).
 *
 * D-23 cache invariant: prediction-cache.ts keys on ENGINE_VERSION; this flip auto-invalidates
 * all `3.0.0-dev` cached rows on next analyze-route call.
 */
export const ENGINE_VERSION = "3.1.0";
