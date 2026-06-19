/**
 * Phase 7 Plan 01 — Goal-intent → deterministic PersonaWeights bias table (D-05).
 * Phase 8 Plan 01 (W0) — values LOCKED. The placeholder marker is gone; each intent
 * resolves to a real WEIGHT_PRESETS preset so the multi-audience compare (W4) renders
 * signal, not noise (08-RESEARCH §W0 Persona-Tuning Targets, D-02).
 *
 * Source: WEIGHT_PRESETS from audience-constants.ts — every value is a preset reference,
 * never an inline-invented mix (each preset sums to exactly 1.0).
 * See: D-05 in 07-CONTEXT.md and §W0 in 08-RESEARCH.md.
 *
 * Anti-pattern: do NOT call this per-request. The bias is PRE-BAKED into
 * `audience.persona_weights` at calibration time (07-03). This module is used
 * during calibration only.
 */

import { WEIGHT_PRESETS } from "@/components/board/audience/audience-constants";
import type { GoalIntent } from "./audience-types";
import type { PersonaWeights } from "@/lib/engine/persona-weights";

/**
 * D-05 locked goal-intent → PersonaWeights bias table (values FINAL as of W0 / 08-01).
 *
 * Each intent maps to a WEIGHT_PRESETS preset — keys AND values are now locked:
 *  - grow      → new_creator  (fyp 0.75 — cold-reach proxy; growing audience = max FYP pull)
 *  - sell      → niche_heavy  (niche 0.55 — converter/buyer lean; conversion lives in-niche)
 *  - authority → niche_heavy  (niche 0.55 — scout/skeptic lean; depth over breadth)
 *  - nurture   → established  (loyalist 0.30 — retention lean; serve the existing fan core)
 *
 * Rationale for re-using niche_heavy for both sell and authority: both are depth plays whose
 * audience lives inside the niche (buyer vs. scout) — the deterministic bias is identical; the
 * per-intent flavour is carried by the repaint prose (GOAL_INTENT_SUFFIX), not the weight mix.
 */
export const GOAL_INTENT_BIAS: Record<GoalIntent, PersonaWeights> = {
  grow:      WEIGHT_PRESETS.new_creator,  // fyp 0.75 — cold-reach proxy, grow the audience
  sell:      WEIGHT_PRESETS.niche_heavy,  // niche 0.55 — converter/buyer lean, conversion in-niche
  authority: WEIGHT_PRESETS.niche_heavy,  // niche 0.55 — scout/skeptic lean, depth over breadth
  nurture:   WEIGHT_PRESETS.established,  // loyalist 0.30 — retention lean, serve existing fans
} as const;

/**
 * Returns the deterministic PersonaWeights bias for a given goal intent.
 * Always returns the same object reference for the same input (table lookup).
 *
 * @param intent - one of 'grow' | 'sell' | 'authority' | 'nurture'
 */
export function biasForGoalIntent(intent: GoalIntent): PersonaWeights {
  return GOAL_INTENT_BIAS[intent];
}
