/**
 * Phase 7 Plan 01 — Temperature × Disposition label lens (D-02).
 *
 * PRESENTATION LENS ONLY — this module maps the 10 engine archetypes onto
 * creator-facing Temperature (cold/warm/hot) × Disposition labels.
 * It NEVER feeds the engine. Engine vocabulary stays: fyp/niche_deep/loyalist/cross_niche
 * + the 10 archetype slugs in wave3/persona-registry.ts.
 *
 * Mapping source: 07-RESEARCH.md §"Temperature × Disposition Label Lens"
 * [ASSUMED] per D-02 Claude's Discretion — planner locks the table; see §Assumptions A2.
 *
 * Temperature assignment rule (grounded in SlotType semantics):
 *   cold  = fyp archetypes with high scroll-past rate OR cross_niche (unfamiliar territory)
 *   warm  = fyp archetypes with moderate engagement (connector/collector/scanner profile)
 *   hot   = niche_deep + loyalist (high intent / prior relationship)
 */

import type { Archetype } from "@/lib/engine/wave3/persona-registry";
import { ARCHETYPES } from "@/lib/engine/wave3/persona-registry";
import type { Temperature, Disposition } from "./audience-types";

// Export Temperature and Disposition types for consumers who only need the lens.
export type { Temperature, Disposition };

/** A label entry for one archetype in the Temperature×Disposition lens. */
export interface TemperatureDispositionLabel {
  temperature: Temperature;
  disposition: Disposition;
}

/**
 * The complete 10-archetype Temperature × Disposition label table.
 *
 * Locked mapping (D-02 / RESEARCH.md §"Temperature × Disposition Label Lens"):
 *
 * | Archetype              | Temperature | Disposition |
 * |------------------------|-------------|-------------|
 * | tough_crowd            | cold        | skeptic     |
 * | lurker                 | cold        | lurker      |
 * | high_engager           | warm        | connector   |
 * | saver                  | warm        | collector   |
 * | sharer                 | warm        | connector   |
 * | purposeful_viewer      | warm        | scanner     |
 * | niche_deep_buyer       | hot         | converter   |
 * | niche_deep_scout       | hot         | skeptic     |
 * | loyalist               | hot         | connector   |
 * | cross_niche_curiosity  | cold        | scanner     |
 */
export const TEMPERATURE_DISPOSITION: Record<Archetype, TemperatureDispositionLabel> = {
  tough_crowd:           { temperature: "cold", disposition: "skeptic" },
  lurker:                { temperature: "cold", disposition: "lurker" },
  high_engager:          { temperature: "warm", disposition: "connector" },
  saver:                 { temperature: "warm", disposition: "collector" },
  sharer:                { temperature: "warm", disposition: "connector" },
  purposeful_viewer:     { temperature: "warm", disposition: "scanner" },
  niche_deep_buyer:      { temperature: "hot",  disposition: "converter" },
  niche_deep_scout:      { temperature: "hot",  disposition: "skeptic" },
  loyalist:              { temperature: "hot",  disposition: "connector" },
  cross_niche_curiosity: { temperature: "cold", disposition: "scanner" },
} as const;

// Compile-time exhaustiveness guard: if ARCHETYPES ever gains an 11th slug,
// the type system will catch any missing entry in TEMPERATURE_DISPOSITION.
type _ExhaustiveCheck = {
  [K in (typeof ARCHETYPES)[number]]: TemperatureDispositionLabel;
};
const _check: _ExhaustiveCheck = TEMPERATURE_DISPOSITION;
void _check; // prevent unused-variable lint

/**
 * Returns the Temperature×Disposition presentation label for a given archetype.
 * Same reference as TEMPERATURE_DISPOSITION[archetype] — deterministic table lookup.
 *
 * @param archetype - one of the 10 engine archetype slugs
 */
export function labelForArchetype(archetype: Archetype): TemperatureDispositionLabel {
  return TEMPERATURE_DISPOSITION[archetype];
}
