'use client';

/**
 * SaveProvenanceContext — where a saved output came from, delivered to <SaveAffordance> without
 * touching the eleven card renderers that mount it.
 *
 * The problem it solves: `saved_items` has had `ref_id` and `thread_id` columns since P10, and
 * <SaveAffordance> has always accepted both as props — but the renderers never pass them, so every
 * saved row is an orphan with no route back to the thread that produced it. Fixing that at the call
 * sites would mean editing eleven files, and the ids are not in scope at any of them: MessageBlocks
 * invokes every renderer as `<Component block={block} />`, a deliberately uniform signature.
 *
 * So provenance rides context instead, exactly as the card CTAs do (HookTestContext,
 * AmbientCardIdContext). Two separate contexts, because they change at different rates:
 *
 *   - ThreadIdContext    — one value for the whole thread, provided once at the composer root.
 *   - BlockOriginContext — per block, provided by MessageBlocks as it maps the body.
 *
 * <SaveAffordance> composes the two. Both default to null, so any surface that does not provide
 * them (the /dev/cards gallery, unit tests, the profile thread view) saves exactly as it does
 * today — with a null ref, never a wrong one.
 */

import { createContext, useContext } from 'react';
import type { BlockOrigin } from '@/components/app/home/rehydrate-thread';
import { blockRefId } from '@/components/app/home/rehydrate-thread';

/** The thread being rendered. Null on surfaces that render blocks outside a thread. */
export const ThreadIdContext = createContext<string | null>(null);

/** The message row + in-message index of the ONE block currently rendering. */
export const BlockOriginContext = createContext<BlockOrigin | null>(null);

export interface SaveProvenance {
  /** `threads.id` — the thread this output belongs to. */
  threadId: string | null;
  /** `${messageId}:${index}` — stable across reloads. Null while a run is still streaming. */
  refId: string | null;
}

/**
 * The provenance for the block currently rendering. Returns nulls outside a provided thread, which
 * is the honest answer — a save with no known origin must record none rather than guess.
 */
export function useSaveProvenance(): SaveProvenance {
  const threadId = useContext(ThreadIdContext);
  const origin = useContext(BlockOriginContext);
  return { threadId, refId: blockRefId(origin) };
}
