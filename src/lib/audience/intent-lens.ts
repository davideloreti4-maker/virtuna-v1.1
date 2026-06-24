/**
 * intent-lens.ts — per-run intent → SIM reaction lens (GAP-C2 resolution, §P.10).
 *
 * DECISION (2026-06-24, "keep 2, derive down"): the composer exposes a 2-value per-run
 * intent (`grow | sell`) — the reaction LENS. The audience model keeps its 4-value
 * `goal_intent` (`grow | sell | authority | nurture`) which already does its work at
 * CALIBRATION time (weight bias via goal-intent.ts + per-archetype repaint flavour via
 * persona-repaint.ts GOAL_INTENT_SUFFIX). authority/nurture are strategic audience
 * postures, NOT per-run content modes, so they collapse to the `grow` lens at run time.
 *
 * The lens is a CONTENT-LAYER overlay (see memory commerce-marketing-intent-track):
 *   - grow → watch/share frame (the engine's existing default — BYTE-IDENTICAL no-op)
 *   - sell → would-buy/price/objection frame (a thin directive appended to the SIM user
 *     message at run time; never touches weights, the engine, or the frozen signature)
 *
 * GATE SAFETY: the lens is only meaningful for a calibrated (non-general) audience; the
 * runners gate it to undefined for General/no-audience so the regression gate stays green.
 */

import type { GoalIntent } from "./audience-types";

/** The per-run reaction lens surfaced in the composer (2 values, derived from goal_intent). */
export type IntentLens = "grow" | "sell";

/**
 * Map the audience's 4-value `goal_intent` down to the 2-value per-run lens DEFAULT.
 * grow → grow · sell → sell · authority → grow · nurture → grow · null/undefined → grow.
 *
 * authority/nurture are calibration-time postures already baked into the signature
 * (GOAL_INTENT_BIAS + GOAL_INTENT_SUFFIX) — at run time they read as the neutral `grow`
 * watch/share lens. The user can still flip to `sell` per-run via the composer override.
 */
export function goalIntentToLens(goalIntent: GoalIntent | null | undefined): IntentLens {
  return goalIntent === "sell" ? "sell" : "grow";
}

/** Narrow an untrusted request-body value to a valid IntentLens, else undefined. */
export function parseIntentLens(raw: unknown): IntentLens | undefined {
  return raw === "grow" || raw === "sell" ? raw : undefined;
}
