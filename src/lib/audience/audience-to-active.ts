/**
 * audienceToActiveAudience — the Audience (domain) → ActiveAudience (contract) adapter.
 *
 * The ONE adapter Seam 3 needs (docs/SURFACE-SEAM-SPEC.md §2.2). `resolveUserAudience`
 * reads the user-level last-used `Audience` (server, RLS-safe → General on any failure);
 * this maps that domain object into the contract `ActiveAudience` shape the app-wide
 * presence/dock represents, so BOTH sessions share ONE producer instead of `MOCK_AUDIENCES`
 * (room-contract/mock-room.ts). Room-owned so the shape stays in lock-step with the seam.
 *
 * Pure + deterministic (no wall-clock / PRNG) — SSR-hydration + engine-determinism-gate safe.
 *
 * Honesty spine (binding, mirrors `variant='thread'`): `pulse` is the idle READINESS line
 * ("Name · N people ready"), NEVER a fabricated / stale reaction — a surface has no at-rest
 * focus (§2.1). A Person is a NAMED person, never the archetype enum (THE-CONTRACT.md §2):
 * names resolve via persona-names (creator label wins, else the stable archetype default).
 *
 * Import discipline (BUILD-01): pulls only the leaf `resolveTier` (reads `audience.mode`) and
 * `resolvePersonaName` (Archetype TYPE only) — never the SOCIALS_PACK barrel — so this stays
 * safe to import from both server and `"use client"` surfaces without dragging Node deps.
 */

import type { Audience } from "./audience-types";
import type { ActiveAudience, Person } from "@/lib/room-contract/types";
import { resolvePersonaName } from "./persona-names";
import { resolveTier } from "./resolve-tier";

/**
 * Roster size for a personas-less audience (General carries `personas: []`). Mirrors the brand
 * Constellation's `DEFAULT_ROSTER_DOTS` (10) so the readiness pulse reads "10 people ready",
 * never the dishonest "0". Kept local (a plain number) to avoid a lib→component import.
 */
const DEFAULT_ROSTER = 10;

/** grow/sell → the contract's Grow/Sell goal lens; authority/nurture/null carry no lens (§2.2). */
function goalOf(audience: Audience): ActiveAudience["goal"] {
  if (audience.goal_intent === "grow") return "Grow";
  if (audience.goal_intent === "sell") return "Sell";
  return undefined;
}

/** The calibrated personas → the named, contract-shaped `Person[]` (never the archetype enum). */
function peopleOf(audience: Audience): Person[] {
  return audience.personas.map((p) => ({
    // The archetype slug is the stable person identity — the same person recurs across every
    // audience + Read (persona-names is keyed on it), and the 10 are unique by construction.
    id: p.archetype,
    // Creator label wins, else the stable archetype default; "Someone" only for an unknown /
    // legacy archetype (unreachable for the 10 real ones) — a name, never the enum (§2).
    name: resolvePersonaName(p.archetype, p.label) ?? "Someone",
    // The per-audience calibrated presentation IS the human segment descriptor
    // ("The Skeptic — pressure-tests every claim"); the disposition is the honest fallback.
    segment: p.repaint?.trim() || p.disposition,
  }));
}

/**
 * Adapt a domain `Audience` into the contract `ActiveAudience` the surface presence renders.
 * Total (never throws): every field has a defined mapping and General/legacy rows degrade
 * gracefully (empty personas → the default roster count in the readiness pulse).
 */
export function audienceToActiveAudience(audience: Audience): ActiveAudience {
  const name = audience.is_general ? "General" : audience.name;
  const people = peopleOf(audience);
  const count = people.length > 0 ? people.length : DEFAULT_ROSTER;
  const goal = goalOf(audience);

  return {
    id: audience.id,
    name,
    people,
    tier: resolveTier(audience),
    platform: audience.platform,
    // Idle readiness — a non-thread surface has no card in focus at rest, so this is the honest
    // "who's ready" line, never a live/stale reaction (the honesty spine, §2.1).
    pulse: `${name} · ${count} people ready`,
    // Omit `goal` entirely (not `goal: undefined`) when the intent carries no Grow/Sell lens.
    ...(goal ? { goal } : {}),
  };
}
