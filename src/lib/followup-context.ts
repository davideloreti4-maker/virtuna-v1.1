'use client';

/**
 * FollowupContext — the "send a follow-up chip into the thread" handler, provided once by the
 * composer and read by every skill view's <FollowupRow> (chat-followups pills).
 *
 * Mirrors HookWriteScriptContext: the standalone skill views (Ideas/Hooks/Script/Remix/Explore/
 * Account) are rendered deep under the composer, and threading an `onFollowup` prop through all of
 * them (and every /dev/cards call site) is exactly the churn a context avoids. The composer wraps
 * its view region in a Provider carrying its chat-send handler; a view with no provider (the gallery)
 * simply renders the pills inert for visual review. ChatThreadView still passes its handler EXPLICITLY
 * (an explicit prop wins over the context) because it already owns it.
 */

import { createContext, useContext } from 'react';

/**
 * `skill` carries the chip's DECLARED generator (chat-followups.ts `ChatFollowup.skill`) alongside
 * its sentence. It is optional and absent on every conversational chip, so a handler that ignores it
 * behaves exactly as before — but the composer forwards it, and the chat route pins the agent's first
 * tool choice to it. Without it a chip's subject-less sentence gets re-litigated as a vague ask and
 * nothing runs.
 *
 * `opts.cards` (Stage B, B2) is the PACK a `carryCards` chip refers to — the card lines of the turn
 * the chip sits under, extracted by the renderer that can see them (`cardLinesOf`). The composer
 * forwards it as the chat body's `cards` (one-brain flag); handlers that ignore it are unaffected.
 */
export type FollowupHandler = (prompt: string, skill?: string, opts?: { cards?: string[] }) => void;

export const FollowupContext = createContext<FollowupHandler | undefined>(undefined);

export function useFollowupHandler(): FollowupHandler | undefined {
  return useContext(FollowupContext);
}
