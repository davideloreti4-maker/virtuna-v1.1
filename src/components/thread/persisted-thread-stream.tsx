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
import { cn } from '@/lib/utils';
import { NEW_LOOK_ENABLED } from '@/lib/flags/new-look';
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
  /**
   * New look only (thread answers step 1): turns the composer renders itself, drawn after the
   * history and the live turn inside the same column. The live and the failed video run are not
   * stream turns (the video run is not in `useActiveRun`), so they ride here: where the thread ends,
   * spaced like every other turn. Unset with the flag off.
   */
  tail?: React.ReactNode;
  /**
   * New look only: the `tail` is a video run still in flight. Like a live skill run, it is the
   * thread's answer on its way, so no turn shows the next-step chips while it runs. A tail that is
   * not running (the failed video turn) is a question with no answer: the chips stay under the last
   * answer above it, as for a failed live run.
   */
  tailRunning?: boolean;
  /**
   * New look only (thread feel, step 1): a turn was sent in this visit. The thread's last turn then
   * takes the room (`data-room`): at least the window's height less the field's, so its top can be
   * taken to the window's top however short its answer is (`useThreadAutoscroll.anchorNextTurn`).
   * Unset on a chat that was only opened: it opens at its end with no empty room under it.
   */
  anchored?: boolean;
  /**
   * New look only: the number of the last send whose turn is the live turn, and of the last whose
   * turn is the tail (the number `useThreadAutoscroll.anchorNextTurn()` gave it). Each marks its
   * own slot (`data-send`) and keys it, so every send is a new element the autoscroll hook can
   * find, whatever its words, and nothing else is taken for it: a persisted turn is never marked,
   * and a send to one slot leaves the other's number (and element) as it was.
   */
  liveSendSeq?: number;
  tailSendSeq?: number;
}

/**
 * New look: one turn's element. Its parts stay the column's own gap apart (ThreadShell's
 * `NEXT_COLUMN`), as they were when they were the column's children. A turn that draws nothing is
 * an empty element and takes no place, so it adds no gap either.
 */
const TURN = 'flex flex-col gap-3.5 md:gap-4 empty:hidden';
/**
 * New look: a later turn that has a question sits 14 further down than the rhythm, as its bubble
 * did (`NextUserTurn`'s `mt-3.5`). The bubble is now its turn's first child, so its own
 * `first:mt-0` drops that margin: the turn carries it instead, and the sum is unchanged.
 */
const TURN_LATER = 'mt-3.5';
/**
 * New look: the room a sent turn takes. `--thread-room` is the window's height (the autoscroll
 * hook writes it on the region), `--field-reserve` the field's measured block, and
 * `--thread-room-trim` what is left (the composer sets it on the region): with the turn's top taken
 * to the window's top, its least height ends where the visible part of the thread ends.
 */
const TURN_ROOM = 'min-h-[calc(var(--thread-room,0px)-var(--field-reserve,0px)-var(--thread-room-trim,72px))]';

export function PersistedThreadStream({
  persistedTurns,
  liveTurn,
  ambientBaseIndex,
  tail,
  tailRunning = false,
  anchored = false,
  liveSendSeq = 0,
  tailSendSeq = 0,
}: PersistedThreadStreamProps) {
  if (persistedTurns.length === 0 && !liveTurn && !tail) return null;

  // Per-turn offset into the flat ledger: the count of blocks in every earlier turn, plus the base.
  const turnBaseIndex = (turnIndex: number) =>
    persistedTurns.slice(0, turnIndex).reduce((n, t) => n + t.blocks.length, 0);
  const liveBaseIndex = persistedTurns.reduce((n, t) => n + t.blocks.length, 0);

  // New look: the next-step chips sit under the last ANSWER only (spec 2026-11-20 §4.4). That is
  // the live turn while it runs or once it has blocks; else the last persisted turn with blocks. A
  // question saved with no answer (a failed Simulate, a stopped chat) draws none, so it never takes
  // them, and neither does a live run that ended empty. Flag off: every settled turn, as before.
  // A running video `tail` is the answer on its way too: while it runs, no turn takes the row.
  const liveHasAnswer = !!liveTurn && (liveTurn.live.isStreaming || liveTurn.blocks.length > 0);
  const videoRuns = !!tail && tailRunning;
  const lastAnswer =
    liveHasAnswer || videoRuns ? -1 : persistedTurns.findLastIndex((t) => t.blocks.length > 0);
  const chipsOn = (i: number | 'live') =>
    !NEW_LOOK_ENABLED || (i === 'live' ? liveHasAnswer && !videoRuns : i === lastAnswer);

  // New look: the turn's element (see TURN). `place` is its place in the thread: the persisted
  // turns, then the live one, then the tail; the last of them takes the room once a turn was sent.
  const lastPlace = persistedTurns.length + (liveTurn ? 1 : 0) + (tail ? 1 : 0) - 1;
  const turnProps = (place: number, hasQuestion: boolean) => {
    const kind = place === 0 ? 'first' : hasQuestion ? 'later' : 'answer';
    const room = anchored && place === lastPlace;
    return {
      'data-turn': kind,
      'data-room': room ? '' : undefined,
      className: cn(TURN, kind === 'later' && TURN_LATER, room && TURN_ROOM),
    };
  };

  const liveNode = liveTurn ? (
    <ThreadTurn
      userTurn={liveTurn.userTurn}
      blocks={liveTurn.blocks}
      live={liveTurn.live}
      showFollowups={chipsOn('live')}
      ambientBaseIndex={
        ambientBaseIndex === undefined ? undefined : ambientBaseIndex + liveBaseIndex
      }
    />
  ) : null;

  return (
    <ThreadShell userTurn={undefined}>
      {persistedTurns.map((turn, i) => {
        const node = (
          <ThreadTurn
            userTurn={turn.userTurn}
            blocks={turn.blocks}
            blockOrigins={turn.blockOrigins}
            showFollowups={chipsOn(i)}
            ambientBaseIndex={
              ambientBaseIndex === undefined ? undefined : ambientBaseIndex + turnBaseIndex(i)
            }
          />
        );
        return NEW_LOOK_ENABLED ? (
          <div key={i} {...turnProps(i, !!turn.userTurn?.trim())}>
            {node}
          </div>
        ) : (
          <Fragment key={i}>{node}</Fragment>
        );
      })}
      {liveTurn &&
        (NEW_LOOK_ENABLED ? (
          // New look: a new send is a new element, marked with its number. A send made before the
          // last run has folded into history (a chip under its answer, a stopped answer, the moment
          // before the reload lands) re-uses this slot; keyed by the send, the sent turn is a new
          // element whatever its words, and the autoscroll hook finds it by `data-send`.
          <div
            key={`live:${liveSendSeq}`}
            data-send={liveSendSeq}
            {...turnProps(persistedTurns.length, !!liveTurn.userTurn?.trim())}
          >
            {liveNode}
          </div>
        ) : (
          liveNode
        ))}
      {NEW_LOOK_ENABLED && tail ? (
        // The video run's turn brings its own question. Each send is its own element (a video sent
        // again after a failed one); one send stays one element from the upload to its card.
        <div key={`tail:${tailSendSeq}`} data-send={tailSendSeq} {...turnProps(lastPlace, true)}>
          {tail}
        </div>
      ) : (
        tail
      )}
    </ThreadShell>
  );
}
