/**
 * Phase 10 Plan 01 — Bounded recalibration delta (FLYWHEEL-04).
 *
 * Pure, deterministic. Translates ONE confirmed calibration proposal into a bounded,
 * re-normalized PersonaWeights override — the ONLY thing the flywheel writes back to the
 * audience object (via the analysis_override slot, Plan 05).
 *
 * Invariants (the math the owner demanded depth on):
 *  - The diverging calibration disposition maps to its PersonaWeights slot(s) (RESEARCH §2):
 *      collector → fyp        (saver lives in the fyp slot group)
 *      converter → niche      (niche_deep_buyer lives in the niche slot group)
 *      connector → fyp + loyalist  (high_engager/sharer in fyp, loyalist in its own slot)
 *  - Bounded nudge: slot_new = clamp(slot_old + ASSUMED_STEP * sign(mean), 0, 1).
 *  - Re-normalize all four weights via normalizeWeights() so they always sum to 1.0.
 *
 * Safety (D-03 / Pitfall 5): the only weights touched are the passed-in CURRENT audience
 * weights. This module NEVER reads DEFAULT_PERSONA_WEIGHT_CONFIG or ARCHETYPE_DEFINITIONS
 * and never mutates archetype definitions. General/preset exclusion is enforced at the call
 * site (Plan 05). The output passes normalizeWeights + clamp, and the DB CHECK
 * `audiences_weights_sum_check` (Plan 02) is the final guard.
 *
 * Determinism guarantee: no Date.now, no Math.random, no I/O. Same (proposal, weights) →
 * byte-identical output.
 */

import type { Disposition } from "@/lib/audience/audience-types";
import {
  normalizeWeights,
  type PersonaWeights,
} from "@/lib/engine/persona-weights";
import type { Proposal } from "./confidence-gate";

/** [ASSUMED] A3 — bounded per-recalibration nudge size (owner-tunable). */
export const ASSUMED_STEP = 0.05;

type WeightKey = keyof PersonaWeights;

/**
 * Calibration disposition → PersonaWeights slot(s) it nudges (RESEARCH §2).
 * Only the 3 calibration dispositions appear here — craft dispositions never reach
 * recalibration (enforced upstream by the confidence gate).
 */
const DISPOSITION_TO_SLOTS: Partial<Record<Disposition, WeightKey[]>> = {
  collector: ["fyp"],
  converter: ["niche"],
  connector: ["fyp", "loyalist"],
};

/** clamp x into [lo, hi]. */
function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * Build a normalized PersonaWeights override from one confirmed proposal.
 *
 * - Map proposal.disposition → its slot(s).
 * - Nudge each slot by ASSUMED_STEP in the direction of sign(proposal.mean), clamped to [0,1].
 * - Re-normalize the four weights to sum 1.0.
 *
 * Pure + deterministic. If the disposition has no slot mapping (defensive — should never
 * happen for a gate-passed calibration disposition), the current weights are returned
 * normalized, unchanged in direction.
 */
export function buildOverride(
  proposal: Proposal,
  currentWeights: PersonaWeights,
): PersonaWeights {
  const slots = DISPOSITION_TO_SLOTS[proposal.disposition];
  const direction = Math.sign(proposal.mean); // -1 | 0 | 1

  // Copy so we never mutate the caller's object.
  const next: PersonaWeights = { ...currentWeights };

  if (slots && direction !== 0) {
    for (const slot of slots) {
      next[slot] = clamp(next[slot] + ASSUMED_STEP * direction, 0, 1);
    }
  }

  // normalizeWeights re-sums to 1.0 (and clamps the all-zero edge to the default mix).
  return normalizeWeights(next);
}
