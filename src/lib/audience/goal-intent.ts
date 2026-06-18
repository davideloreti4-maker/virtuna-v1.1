/**
 * Phase 7 Plan 01 — Goal-intent → deterministic PersonaWeights bias table (D-05).
 *
 * [ASSUMED] structure-not-values: these specific weight mappings are locked by the planner
 * as the structural skeleton. The values (which WEIGHT_PRESETS key maps to which intent)
 * are tuned in the post-P7 refinement run. See RESEARCH.md §"Goal-intent → deterministic bias".
 *
 * Source: WEIGHT_PRESETS from audience-constants.ts — do NOT invent new mixes.
 * See: D-05 in 07-CONTEXT.md and §Assumptions A1 in 07-RESEARCH.md.
 *
 * Anti-pattern: do NOT call this per-request. The bias is PRE-BAKED into
 * `audience.persona_weights` at calibration time (07-03). This module is used
 * during calibration only.
 */

import { WEIGHT_PRESETS } from "@/components/board/audience/audience-constants";
import type { GoalIntent } from "./audience-types";
import type { PersonaWeights } from "@/lib/engine/persona-weights";

/**
 * D-05 locked goal-intent → PersonaWeights bias table.
 *
 * Mapping (locked — tune values in refinement run, do NOT change keys):
 *  - grow      → new_creator  (fyp-heavy — cold reach proxy, growing an audience)
 *  - sell      → niche_heavy  (niche-heavy — converter/buyer lean, conversion focus)
 *  - authority → niche_heavy  (niche-deep scout/skeptic lean, depth over breadth)
 *  - nurture   → established  (loyalist-heavy — retention lean, serve existing fans)
 *
 * [ASSUMED] per D-05 Claude's Discretion — see §Assumptions A1 in 07-RESEARCH.md.
 * The key→WEIGHT_PRESETS mapping is the structure being locked; absolute values tune later.
 */
export const GOAL_INTENT_BIAS: Record<GoalIntent, PersonaWeights> = {
  grow:      WEIGHT_PRESETS.new_creator,  // fyp 0.75 — cold-reach proxy
  sell:      WEIGHT_PRESETS.niche_heavy,  // niche 0.55 — converter/buyer lean
  authority: WEIGHT_PRESETS.niche_heavy,  // niche-deep scout/skeptic lean
  nurture:   WEIGHT_PRESETS.established,  // loyalist 0.30 — retention lean
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
