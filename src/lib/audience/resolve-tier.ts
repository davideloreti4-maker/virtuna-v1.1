/**
 * Phase 3 Plan 02 — trust-tier resolver (D-06 / TRUST-01).
 *
 * Productionizes the spike-locked tier RULE (signature-determinism.test.ts:105-110)
 * into a real export: a SIM is **Validated** iff its DomainPack carries a non-empty
 * calibration baseline, else **Directional**.
 *
 * CRITICAL: the tier keys off `DomainPack.calibration` (the pack), NEVER
 * `Audience.calibration` (scrape provenance) — do not conflate the two. The pack's
 * calibration baseline is the Validated anchor.
 *
 * No General pack object exists in P3 (D-02): a `mode:"general"` audience resolves
 * Directional BY RULE here directly — never Validated. Do NOT widen `DomainPack`
 * or add a General pack to force a Validated path.
 */

import type { Audience } from "./audience-types";
// Import the leaf calibration descriptor, NOT the SOCIALS_PACK barrel: the barrel
// pulls runPredictionPipeline → apify-client → Node `dns`, and this module is reached
// from a "use client" component (audience-card.tsx), so importing the barrel breaks the
// browser bundle (BUILD-01). The descriptor is the pack's calibration field verbatim.
import { SOCIALS_CALIBRATION } from "@/lib/engine/packs/socials-calibration";

export type TrustTier = "Validated" | "Directional";

/**
 * The verbatim spike predicate: a pack-calibration baseline → Validated, else
 * Directional. Reads only the `baselineRef` shape so it doesn't depend on heavy
 * pack internals.
 */
export function tierFromCalibration(calibration?: { baselineRef?: string }): TrustTier {
  return calibration?.baselineRef ? "Validated" : "Directional";
}

/**
 * Resolve an audience's trust tier from its Mode. Socials reads the Socials pack's
 * calibration baseline (Validated anchor); every other mode has no calibration-bearing
 * pack in P3 → Directional by rule, never Validated.
 */
export function resolveTier(audience: Pick<Audience, "mode">): TrustTier {
  if (audience.mode === "socials") return tierFromCalibration(SOCIALS_CALIBRATION);
  return "Directional";
}
