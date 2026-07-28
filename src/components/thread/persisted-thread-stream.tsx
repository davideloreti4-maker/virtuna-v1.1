'use client';

/**
 * ThreadStream (file kept as persisted-thread-stream.tsx for import stability) — the ONE renderer
 * of a thread, history AND live tail.
 *
 * It takes the thread's ordered TURNS (`orderedTurns(messages)` from rehydrate-thread.ts) plus an
 * optional IN-FLIGHT turn, and renders each through <ThreadTurn> — user bubble, intro, loading
 * spine, cards, outro. Because MessageBlocks is type-complete (18 block types incl.
 * `video-test-card`, `account-read`, `markdown`, the profile-read family) this is the only surface
 * a thread needs.
 *
 * The live tail is not a different component. It is the LAST turn, with `live` set. That is the
 * whole point: the previous design gave each skill its own view gated on `activeTool`, so a
 * finished run sat outside the thread until the creator switched skills — and the hand-off between
 * the two surfaces was the race that lost work. One list, one renderer, no hand-off.
 *
 * Card CTAs ("Test full →", "Develop into hooks →", "See the room →", …) ride React context
 * providers lifted to the composer's threadContent root + the per-card AmbientCardIdContext
 * MessageBlocks itself provides — so every rendered card keeps its action without prop-drilling.
 *
 * Ambient scroll-spy anchors: when `ambientBaseIndex` is provided, each turn's blocks render with
 * their true offset into the room's flat ledger `[...turns.flatMap(t => t.blocks), ...liveBlocks]`,
 * keeping each card's `data-card-id` aligned with its descriptor. Undefined → no anchors →
 * ProofUnit's "See the room →" resolves by concept text, never a wrong-card id.
 */

import { Fragment } from 'react';
import { ThreadShell } from '@/components/thread/thread-shell';
import { ThreadTurn, type LiveRun } from '@/components/thread/thread-turn';
import type { RehydrateTurn } from '@/components/app/home/rehydrate-thread';

/** The in-flight turn: the creator's question, the blocks streamed so far, and the run's state. */
export interface LiveTurn {
  userTurn: string | null;
  blocks: unknown[];
  live: LiveRun;
}

export interface PersistedThreadStreamProps {
  /** The thread's ordered turns (each user question + the assistant blocks it produced). */
  persistedTurns: RehydrateTurn[];
  /**
   * The run currently streaming (or just settled and not yet swapped into history). Rendered as the
   * last turn, through the SAME <ThreadTurn> as every persisted one.
   */
  liveTurn?: LiveTurn | null;
  /**
   * The stream's base offset into the flat ambient ledger. When set, each turn renders with
   * `ambientBaseIndex = base + (blocks in earlier turns)` so card scroll-spy ids stay aligned with
   * `buildAmbientDescriptors`. Undefined → no anchors (concept-text room fallback).
   */
  ambientBaseIndex?: number;
}

export function PersistedThreadStream({
  persistedTurns,
  liveTurn,
  ambientBaseIndex,
}: PersistedThreadStreamProps) {
  if (persistedTurns.length === 0 && !liveTurn) return null;

  // Per-turn offset into the flat ledger: the count of blocks in every earlier turn, plus the base.
  const turnBaseIndex = (turnIndex: number) =>
    persistedTurns.slice(0, turnIndex).reduce((n, t) => n + t.blocks.length, 0);
  const liveBaseIndex = persistedTurns.reduce((n, t) => n + t.blocks.length, 0);

  return (
    <ThreadShell userTurn={undefined}>
      {persistedTurns.map((turn, i) => (
        <Fragment key={i}>
          <ThreadTurn
            userTurn={turn.userTurn}
            blocks={turn.blocks}
            ambientBaseIndex={
              ambientBaseIndex === undefined ? undefined : ambientBaseIndex + turnBaseIndex(i)
            }
          />
        </Fragment>
      ))}
      {liveTurn && (
        <ThreadTurn
          userTurn={liveTurn.userTurn}
          blocks={liveTurn.blocks}
          live={liveTurn.live}
          ambientBaseIndex={
            ambientBaseIndex === undefined ? undefined : ambientBaseIndex + liveBaseIndex
          }
        />
      )}
    </ThreadShell>
  );
}
