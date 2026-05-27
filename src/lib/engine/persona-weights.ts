import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "engine.persona-weights" });

/** D-20: per-persona-type audience-share weight. Sum should = 1.0 (normalized). */
export interface PersonaWeights {
  fyp: number;
  niche: number;
  loyalist: number;
  cross_niche: number;
}

/** D-20: precedence chain — analysis > creator > niche > default. */
export interface PersonaWeightConfig {
  default: PersonaWeights;
  niche_overrides?: Record<string, PersonaWeights>;
  creator_overrides?: Record<string, PersonaWeights>;
  analysis_override?: PersonaWeights;
}

/** R2.3 default mix: FYP 0.65 / niche 0.20 / loyalist 0.10 / cross 0.05 */
export const DEFAULT_PERSONA_WEIGHT_CONFIG: PersonaWeightConfig = {
  default: { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
};

export type WeightsSource =
  | "default"
  | "niche_override"
  | "creator_override"
  | "analysis_override";

/** D-20 precedence resolver. Always normalizes the result. */
export function resolveWeights(
  config: PersonaWeightConfig,
  context: {
    analysis_override?: PersonaWeights;
    creator_id?: string;
    niche?: string;
  },
): { weights: PersonaWeights; source: WeightsSource } {
  if (context.analysis_override) {
    return {
      weights: normalizeWeights(context.analysis_override),
      source: "analysis_override",
    };
  }
  if (context.creator_id && config.creator_overrides?.[context.creator_id]) {
    return {
      weights: normalizeWeights(config.creator_overrides[context.creator_id]!),
      source: "creator_override",
    };
  }
  if (context.niche && config.niche_overrides?.[context.niche]) {
    return {
      weights: normalizeWeights(config.niche_overrides[context.niche]!),
      source: "niche_override",
    };
  }
  return { weights: normalizeWeights(config.default), source: "default" };
}

/** Scale values so sum = 1.0. Returns default on all-zero input (avoid NaN). */
export function normalizeWeights(w: PersonaWeights): PersonaWeights {
  const sum = w.fyp + w.niche + w.loyalist + w.cross_niche;
  if (sum === 0) {
    log.warn("normalizeWeights: all-zero input — returning default mix");
    return { ...DEFAULT_PERSONA_WEIGHT_CONFIG.default };
  }
  return {
    fyp: w.fyp / sum,
    niche: w.niche / sum,
    loyalist: w.loyalist / sum,
    cross_niche: w.cross_niche / sum,
  };
}
