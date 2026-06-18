/**
 * Phase 7 Plan 01 — resolveAudienceWeights (D-04 / Pitfall 5 / AUD-03).
 *
 * Array-shaped, multi-select-ready resolver. In v1, resolves the FIRST audience.
 * The signature accepts Audience[] so that multi-select compare is a purely additive
 * change later — the runner call signature stays stable (Pitfall 5).
 *
 * Anti-pattern: do NOT apply GOAL_INTENT_BIAS per-call. The goal-intent bias is
 * PRE-BAKED into `audience.persona_weights` at calibration time (07-03). This resolver
 * does NOT re-apply bias — it passes the pre-baked weights directly through the
 * analysis_override slot (Pitfall 2 / anti-pattern: no per-run nondeterminism).
 *
 * General-audience identity guarantee (AUD-03 regression-gate anchor):
 *   resolveAudienceWeights([]) or resolveAudienceWeights([generalAudience])
 *   → resolveWeights(DEFAULT_PERSONA_WEIGHT_CONFIG, {})
 *   → { weights: DEFAULT mix, source: 'default' }
 *   The gate is free by construction — General never injects an override.
 *
 * NEVER mutate DEFAULT_PERSONA_WEIGHT_CONFIG.
 */

import {
  resolveWeights,
  DEFAULT_PERSONA_WEIGHT_CONFIG,
  type PersonaWeights,
  type WeightsSource,
} from "@/lib/engine/persona-weights";
import type { Audience } from "./audience-types";

/** The full resolved-weights result (weights + source). */
export interface ResolvedAudienceWeights {
  weights: PersonaWeights;
  source: WeightsSource;
}

/**
 * Resolves the active PersonaWeights for an array of audiences.
 *
 * Semantics (v1 — single-resolution):
 *  - Empty array OR first audience is_general=true → DEFAULT mix (source: 'default').
 *  - First audience is calibrated (is_general=false) → audience.persona_weights via
 *    the analysis_override slot (source: 'analysis_override').
 *
 * Multi-select future: to blend multiple calibrated audiences, replace the single-
 * resolution logic with a weighted average of persona_weights across the array,
 * then pass the merged weights as analysis_override. The caller interface stays identical.
 *
 * @param audiences - array of Audience objects (v1: only first element is used)
 */
export function resolveAudienceWeights(audiences: Audience[]): ResolvedAudienceWeights {
  const first = audiences[0];

  // Empty array or General audience → gate-protected DEFAULT.
  // General MUST NOT inject an override — this is the AUD-03 regression gate.
  if (!first || first.is_general) {
    return resolveWeights(DEFAULT_PERSONA_WEIGHT_CONFIG, {});
  }

  // Calibrated audience: pass pre-baked persona_weights through analysis_override
  // (highest precedence in the existing chain). The bias was applied once at calibration
  // time — this resolver passes it through, never re-derives it.
  return resolveWeights(DEFAULT_PERSONA_WEIGHT_CONFIG, {
    analysis_override: first.persona_weights,
  });
}
