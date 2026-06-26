/**
 * Core dispatch surface — holds ZERO scoring logic (PACK-01); scoring is reached
 * via pack.scoring.run.
 *
 * `resolvePack(mode)` maps the DOMAIN axis key to its pack. The pack key is
 * orthogonal to `input_mode` (the stimulus axis). In Phase 1 the only pack is
 * Socials, so resolution is a simple lookup; unknown ids throw (the guard for
 * the General/Predict packs that mount this same contract later).
 *
 * This file holds NO direct reference to the scorer, the Apollo system prompt,
 * or any `overall_score` math — those are reached only via the returned
 * `pack.scoring.*`. It pulls in `SOCIALS_PACK` transitively, never the scorer.
 */
import type { DomainPack } from "../domain-pack";
import { SOCIALS_PACK } from "./socials";

export type { DomainPack } from "../domain-pack";
export { SOCIALS_PACK } from "./socials";

/**
 * Resolve a domain pack by its `id`. P1: the only pack is `"socials"`.
 * Throws on an unknown id (future packs register here).
 */
export function resolvePack(mode: DomainPack["id"]): DomainPack {
  switch (mode) {
    case "socials":
      return SOCIALS_PACK;
    default:
      throw new Error(`resolvePack: unknown pack id "${mode}"`);
  }
}
