"use client";

/**
 * in-thread-input-context.ts — the seam between an in-thread input affordance (input-request block)
 * and the composer that hosts the thread.
 *
 * A block renderer is handed only `block` (MessageBlocks passes no callbacks — THREAD-04). So when
 * the InputRequestBlockRenderer finishes running its action (a Remix from a pasted link, an account
 * read, an explore pull, a concept read), it needs a way to tell the host "the thread gained a card
 * server-side — reload it". That single callback flows through this context, mirroring the existing
 * OpenRoomContext/HookTestContext pattern. The default is a no-op so the block renders safely with no
 * provider (e.g. /dev/cards).
 */

import { createContext, useContext } from "react";

export interface InThreadInputContextValue {
  /**
   * Called after an in-thread action persisted a card to the open thread (server-side). The host
   * reloads the open thread so the new card appears in-place. Return value is ignored (the host's
   * reload may resolve a success flag). No-op by default. (Named onComplete since 2026-07-18 — it now
   * services every input action, not just the link/remix one it shipped with.)
   */
  onComplete: () => void | Promise<unknown>;
}

const DEFAULT: InThreadInputContextValue = {
  onComplete: () => {},
};

export const InThreadInputContext = createContext<InThreadInputContextValue>(DEFAULT);

export function useInThreadInput(): InThreadInputContextValue {
  return useContext(InThreadInputContext);
}
