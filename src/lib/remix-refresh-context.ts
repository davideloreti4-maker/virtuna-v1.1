"use client";

/**
 * remix-refresh-context.ts — the seam between a chat-agent `revised` frame (phase 5, the free
 * `revise_remix` tool) and an already-mounted RemixBeats card that fetched its shoot sheet once.
 *
 * RemixBeats fetches by blueprintId on mount, and the thread reload after a turn never remounts
 * it — its React keys are positional indexes, not blueprintIds — so its `[blueprintId, initialData]`
 * fetch effect never re-runs on its own. A revision nobody sees didn't happen. use-chat-stream.ts
 * turns each `revised` SSE frame into a `revisedSheets` entry with a per-blueprintId incrementing
 * nonce; the composer folds that into `counters[blueprintId] = latest nonce` and provides it here,
 * mirroring the existing OpenRoomContext/HookTestContext/InThreadInputContext pattern. RemixBeats
 * reads its own blueprintId's counter and adds it to its fetch effect's deps, so a bump is an
 * explicit "refetch me" signal — the same nonce trick `focusVideo` (composer.tsx) uses to make a
 * repeat tap on the SAME id a fresh request.
 *
 * Default `{counters: {}}` so every non-thread host (e.g. /dev/cards) is unaffected: with no
 * provider, every blueprintId reads a bump of 0 and RemixBeats behaves exactly as it did before
 * this lane.
 */

import { createContext, useContext } from "react";

export interface RemixRefreshContextValue {
  /** blueprintId → bump count (the latest nonce seen for that sheet). 0 = never revised. */
  counters: Record<string, number>;
}

const DEFAULT: RemixRefreshContextValue = { counters: {} };

export const RemixRefreshContext = createContext<RemixRefreshContextValue>(DEFAULT);

export function useRemixRefresh(): RemixRefreshContextValue {
  return useContext(RemixRefreshContext);
}
