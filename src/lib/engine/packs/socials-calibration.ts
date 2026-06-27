import type { CalibrationSpec } from "../domain-pack";

/**
 * Socials calibration descriptor — the Validated anchor for the Socials pack.
 *
 * Extracted into this LEAF module (no pipeline/scraping imports) so presentation-
 * layer code can read the calibration baseline without importing the whole
 * `SOCIALS_PACK` barrel. The barrel imports `runPredictionPipeline` → apify-client
 * → Node `dns`, so pulling it into a `"use client"` component (audience-card.tsx →
 * resolve-tier.ts) dragged the entire server-only engine pipeline into the browser
 * bundle and broke the `/audience` build (BUILD-01).
 *
 * `socials.ts` consumes this verbatim for its `calibration` field, so the pack value
 * stays byte-identical → ENGINE_VERSION unchanged, prediction cache valid.
 */
export const SOCIALS_CALIBRATION: CalibrationSpec = {
  kind: "socials",
  baselineRef: "src/lib/engine/calibration-baseline.json",
};
