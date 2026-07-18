'use client';

/**
 * HookTestContext — React context for the "Test full →" handoff callback.
 *
 * Used by HookCardRenderer to invoke the handoff without threading a prop
 * through MessageBlocks (which only passes block to renderers).
 *
 * When null (default), HookCardRenderer renders the CTA as a stub (Plan 01 behavior).
 * When set (by HooksThreadView), clicking "Test full →" fires the callback with
 * the chosen hookLine + audienceArchetype (Plan 03 deep-link handoff — D-05/D-06).
 *
 * Default: null (stub — no handler wired).
 */

import { createContext, useContext } from 'react';

export type OnTestHookFn = (hookLine: string, audienceArchetype: string) => void;

export const HookTestContext = createContext<OnTestHookFn | null>(null);

export function useOnTestHook(): OnTestHookFn | null {
  return useContext(HookTestContext);
}

/**
 * HookWriteScriptContext — React context for the "Write script →" handoff (hooks→script).
 *
 * Mirrors HookTestContext: HookCardRenderer reads this to fire the hooks→script chain
 * handoff without threading a prop through MessageBlocks. When set (by HooksThreadView),
 * clicking "Write script →" switches to the Script tool and starts a script run anchored
 * on the chosen hookLine (CHAIN_HANDOFFS hooks→script — /api/tools/script { anchor }).
 *
 * Default: null (CTA renders as a stub — no handler wired).
 */
export type OnWriteScriptFn = (hookLine: string, audienceArchetype: string) => void;

export const HookWriteScriptContext = createContext<OnWriteScriptFn | null>(null);

export function useOnWriteScriptHook(): OnWriteScriptFn | null {
  return useContext(HookWriteScriptContext);
}

/**
 * OpenRoomContext — opens the docked ambient-audience Room focused on a specific card.
 *
 * A generated skill card's "See the room →" (ProofUnit) reads this to open the CURRENT
 * audience's Room anchored on that card, instead of the standalone per-card AudienceLens —
 * which only shows fraction-expansion placeholder viewers ("viewer 1…10 / New viewers"),
 * NOT the live audience the run actually used. The handler resolves the card by its concept
 * text to the matching ambient descriptor, makes it the sticky focus, and opens the docked
 * presence (reusing the card's real per-persona reactions).
 *
 * Returns true when it handled the open (a matching descriptor was found + focused). Default
 * null ⇒ not inside the home composer (calendar / saved / library) ⇒ ProofUnit keeps the
 * standalone Lens so those surfaces are unaffected.
 *
 * `cardId` is the card's LEDGER id (`AmbientCardIdContext`, threaded by MessageBlocks). It
 * disambiguates two cards with an identical concept — matching on `conceptText` alone opened the
 * FIRST of a dup pair (family of #306). Optional so off-composer callers (with no id) still work.
 */
export type OpenRoomForCardFn = (conceptText: string, cardId?: string | null) => boolean;

export const OpenRoomContext = createContext<OpenRoomForCardFn | null>(null);

export function useOpenRoomForCard(): OpenRoomForCardFn | null {
  return useContext(OpenRoomContext);
}

/**
 * AmbientCardIdContext — the LEDGER id of the card currently being rendered (`hook-0`, `idea-16`…).
 *
 * MessageBlocks already computes this per card (the SAME `toAmbientDescriptor` id it stamps on the
 * scroll-spy `[data-card-id]` anchor) and provides it around each reactable card. ProofUnit reads it
 * so a "See the room →" tap resolves by id, not by concept text — the fix for the dup-concept open
 * (two cards, same concept, previously both opened the first). Default null ⇒ no id in context
 * (off-composer / pre-anchor) ⇒ the tap falls back to concept-text matching.
 */
export const AmbientCardIdContext = createContext<string | null>(null);

export function useAmbientCardId(): string | null {
  return useContext(AmbientCardIdContext);
}
