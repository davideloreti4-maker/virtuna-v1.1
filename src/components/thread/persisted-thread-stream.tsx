'use client';

/**
 * PersistedThreadStream — the ONE renderer of a thread's persisted history (thread-unification Phase 2).
 *
 * Extracted from ChatThreadView's persisted-turns render so EVERY thread — not just chat-agent threads —
 * rehydrates as one ordered, type-complete conversation. It takes the thread's ordered TURNS
 * (`orderedTurns(messages)` from rehydrate-thread.ts) and renders, per turn, the user's question bubble
 * plus every assistant/tool block it produced, through the shared MessageBlocks registry.
 *
 * Because MessageBlocks is type-complete (all 17 block types, incl. `video-test-card`, `account-read`,
 * `markdown`, the profile-read family), this replaces the old per-skill bucket partition in composer.tsx
 * that dropped any block type its owning tool wasn't active — the root cause of markdown text vanishing
 * beside cards, of `video-test-card`/`account-read` disappearing on reload, and of skill-switch hiding
 * prior cards. History is now owned here, once, ungated by `activeTool`; the per-skill views shrink to
 * live-run surfaces (streaming tail only).
 *
 * Card CTAs ("Test full →", "Develop into hooks →", "See the room →", …) ride React context providers
 * lifted to the composer's threadContent root (Phase 1) + the per-card AmbientCardIdContext MessageBlocks
 * itself provides — so every rendered card keeps its action without prop-drilling through this component.
 *
 * Ambient scroll-spy anchors (Phase 4): when `ambientBaseIndex` is provided, each turn's blocks are
 * rendered with their true offset into the room's flat ledger `[...persistedTurns.flatMap(t => t.blocks),
 * ...activeStreamCards]`, keeping each card's `data-card-id` aligned with its descriptor. Undefined
 * (the Phase 2 default) → no anchors → ProofUnit's "See the room →" resolves by concept text (the
 * pre-anchor fallback), never a wrong-card id.
 */

import { Fragment } from 'react';
import { MessageBlocks } from '@/components/thread/message-blocks';
import { ThreadShell, ThreadAssistantTurn, ThreadUserTurn } from '@/components/thread/thread-shell';
import type { RehydrateTurn } from '@/components/app/home/rehydrate-thread';

export interface PersistedThreadStreamProps {
  /** The thread's ordered turns (each user question + the assistant blocks it produced). */
  persistedTurns: RehydrateTurn[];
  /**
   * The stream's base offset into the room's flat ambient ledger. When set, each turn renders with
   * `ambientBaseIndex = base + (blocks in earlier turns)` so card scroll-spy ids stay aligned with
   * `buildAmbientDescriptors`. Undefined → no anchors (Phase 2 default; concept-text room fallback).
   */
  ambientBaseIndex?: number;
}

export function PersistedThreadStream({ persistedTurns, ambientBaseIndex }: PersistedThreadStreamProps) {
  if (persistedTurns.length === 0) return null;

  // Per-turn offset into the flat ledger: the count of blocks in every earlier turn, plus the base.
  const turnBaseIndex = (turnIndex: number) =>
    persistedTurns.slice(0, turnIndex).reduce((n, t) => n + t.blocks.length, 0);

  return (
    <ThreadShell userTurn={undefined}>
      {persistedTurns.map((turn, i) => (
        <Fragment key={i}>
          {turn.userTurn?.trim() && <ThreadUserTurn text={turn.userTurn.trim()} />}
          {turn.blocks.length > 0 && (
            <ThreadAssistantTurn>
              <MessageBlocks
                body={turn.blocks}
                ambientBaseIndex={
                  ambientBaseIndex === undefined ? undefined : ambientBaseIndex + turnBaseIndex(i)
                }
              />
            </ThreadAssistantTurn>
          )}
        </Fragment>
      ))}
    </ThreadShell>
  );
}
