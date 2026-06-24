/**
 * A1 (weighted SIM aggregation) — build the optional FlashWeighting for a runner.
 *
 * This is the seam that finally CONSUMES `audience.persona_weights` in the live text-gen
 * path. Before A1 the 5 runners resolved the weights and immediately `void`-ed them; the
 * SIM band was a flat, unweighted stop-count. Now a calibrated audience's slot weights
 * bias which candidates clear the band gate → closing the calibration → flywheel-nudge →
 * step-9 drift-rebake loop end-to-end (the weights were previously read by NOTHING).
 *
 * Gate-safe by construction: General / null / no-override audiences return `undefined`,
 * so `aggregateFlash` takes its flat path → byte-identical to today (ENGINE_VERSION 3.19.0
 * regression gate). The SIM call itself (system-prompt cache prefix + 10 personas) is
 * UNTOUCHED — only the post-SIM aggregation math changes.
 *
 * Isolation: this module (not `flash-aggregate.ts`) owns the registry + audience imports;
 * it hands `aggregateFlash` only the minimal `FlashWeighting` shape.
 */

import { ARCHETYPE_SLOT, type SlotType } from "@/lib/engine/wave3/persona-registry";
import { resolveAudienceWeights } from "@/lib/audience/resolve-audience-weights";
import type { PersonaWeights } from "@/lib/engine/persona-weights";
import type { Audience } from "@/lib/audience/audience-types";
import type { FlashWeighting } from "./flash-aggregate";

/**
 * slot_type → PersonaWeights bucket key. `niche_deep` archetypes map to the `niche`
 * weight; every other slot_type is its own bucket. Typed against PersonaWeights so a key
 * rename fails the build.
 */
const SLOT_TO_WEIGHT_KEY: Record<SlotType, keyof PersonaWeights> = {
  fyp: "fyp",
  niche_deep: "niche",
  loyalist: "loyalist",
  cross_niche: "cross_niche",
};

/**
 * Build the FlashWeighting for a runner's `aggregateFlash` call.
 *
 * Returns `undefined` (→ flat, byte-identical band) for:
 *   - no audience / General audience (the regression-gate anchor — General NEVER weights),
 *   - any audience that does not resolve to an `analysis_override` (defensive: only a
 *     calibrated audience's pre-baked persona_weights should ever move the gate).
 *
 * Returns a weighting (→ weighted stop-MASS band) ONLY for a calibrated audience.
 */
export function buildFlashWeighting(
  audience: Audience | null | undefined,
): FlashWeighting | undefined {
  if (!audience || audience.is_general) return undefined;

  const { weights, source } = resolveAudienceWeights([audience]);
  // Only a calibrated audience injects an analysis_override; anything else is the DEFAULT
  // mix, which must NOT silently weight the gate (that would diverge from the General path).
  if (source !== "analysis_override") return undefined;

  return {
    weights: {
      fyp: weights.fyp,
      niche: weights.niche,
      loyalist: weights.loyalist,
      cross_niche: weights.cross_niche,
    },
    slotOf: (archetype: string): string | null => {
      const slot = ARCHETYPE_SLOT[archetype as keyof typeof ARCHETYPE_SLOT];
      return slot ? SLOT_TO_WEIGHT_KEY[slot] : null;
    },
  };
}
