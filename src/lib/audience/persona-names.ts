/**
 * persona-names — the named-people source of truth (The Room, Phase 1 Task A).
 *
 * The moat reframe: the audience is a cast of REAL, recurring, named people (Maya, Dev…),
 * not registry archetype enums ("tough_crowd"). This module is the single place a name is
 * resolved for a persona, so every surface (the Lens "Ask them why" list, the persona chat
 * drawer, the in-voice answer prompt) names the same person the same way.
 *
 * Design:
 *  - `ARCHETYPE_PERSONA_NAME` is a STABLE archetype→first-name map. Because it is keyed on the
 *    immutable engine archetype slug, the tough_crowd is "Dev" in EVERY audience and across
 *    every piece of content — so the cast recurs and the creator gets to know them (the vision's
 *    "they recur; you get to know them"). One name per archetype; diverse, unambiguous first
 *    names.
 *  - A creator-set `CalibratedPersona.label` (AUD-EDIT-01 / D-06) ALWAYS wins over the default,
 *    so a renamed persona shows the creator's chosen name.
 *  - Pure + deterministic (no Math.random / Date.now) — SSR-hydration + engine-determinism safe.
 *
 * Import discipline (BUILD-01): imports ONLY the `Archetype` TYPE (erased at build) from the
 * registry — never the barrel — so this module stays safe to import from both server (chat
 * route/runner) and `"use client"` (the Lens) surfaces without dragging Node deps.
 */

import type { Archetype } from "@/lib/engine/wave3/persona-registry";

/**
 * Stable default first-name per archetype. Keyed on the immutable engine slug so the same
 * person recurs across every audience and every Read. Keep exactly one name per archetype;
 * changing a name only changes presentation (no engine / cache impact).
 */
export const ARCHETYPE_PERSONA_NAME: Record<Archetype, string> = {
  high_engager: "Maya",
  saver: "Priya",
  lurker: "Sam",
  sharer: "Jordan",
  tough_crowd: "Dev",
  purposeful_viewer: "Alex",
  niche_deep_buyer: "Nadia",
  niche_deep_scout: "Elena",
  loyalist: "Theo",
  cross_niche_curiosity: "Robin",
};

/** Fast membership check without importing the registry's runtime ARCHETYPES array. */
function isNamedArchetype(archetype: string): archetype is Archetype {
  return Object.prototype.hasOwnProperty.call(ARCHETYPE_PERSONA_NAME, archetype);
}

/**
 * Resolve a persona's display NAME.
 *  1. A non-empty creator `label` (from CalibratedPersona) always wins.
 *  2. Else the stable default name for the archetype.
 *  3. Else null — the caller falls back to its own label (e.g. the archetype display string)
 *     so an unknown/legacy archetype never renders a broken "Ask undefined".
 */
export function resolvePersonaName(
  archetype: string | null | undefined,
  label?: string | null,
): string | null {
  const trimmed = label?.trim();
  if (trimmed) return trimmed;
  if (archetype && isNamedArchetype(archetype)) return ARCHETYPE_PERSONA_NAME[archetype];
  return null;
}

/**
 * Build an archetype→name override map from an Audience's calibrated personas. Only personas
 * carrying a creator-set `label` contribute an entry (the default name is applied downstream by
 * {@link resolvePersonaName} when an archetype is absent from this map). Returns an empty object
 * for General/legacy audiences (no labels) — safe to pass verbatim.
 */
export function personaNameMap(
  personas?: ReadonlyArray<{ archetype: Archetype; label?: string | null }> | null,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of personas ?? []) {
    const trimmed = p.label?.trim();
    if (trimmed) map[p.archetype] = trimmed;
  }
  return map;
}
