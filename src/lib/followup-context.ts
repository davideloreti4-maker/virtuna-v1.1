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

export type FollowupHandler = (prompt: string) => void;

export const FollowupContext = createContext<FollowupHandler | undefined>(undefined);

export function useFollowupHandler(): FollowupHandler | undefined {
  return useContext(FollowupContext);
}
