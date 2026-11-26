'use client';

/**
 * useActiveRun — ONE run at a time, normalized into ONE shape.
 *
 * The app runs seven SSE parsers (ideas / hooks / script / remix / explore / chat / account-read),
 * each a good hook in its own right, none of them quite the same shape. Previously every one of
 * them had its own bespoke thread view mounted behind an `activeTool ===` gate, which is how a
 * finished run ended up living OUTSIDE the thread until the creator switched skills.
 *
 * This selects the single run that matters right now and flattens it to the interface <ThreadTurn>
 * consumes. It does NOT rewrite the hooks — they parse SSE correctly and are heavily tested; the
 * irregularity is real and is absorbed here:
 *
 *     ideas / hooks / script   full shape (stages · followupText · warnings · toBlocks)
 *     remix                    no `warnings`
 *     explore                  no `followupText`, no `warnings`
 *     chat                     no `followupText`, no `warnings`
 *     account-read             no `stages`, no `toBlocks`, no `isDone` — a single `block`
 *
 * PRECEDENCE: a streaming run always wins. Otherwise the most recently STARTED run that still has
 * content (not yet `reset()` into history) holds the tail, so its cards stay on screen for the beat
 * between `done` and the persisted-thread reload that folds it in.
 *
 * ⚠️ `skill` is the DISPLAY namespace (`ChatTurnKind` — "ideas" PLURAL), never the composer
 * `ToolId` ("idea" singular). See thread-turn.tsx.
 */

import { useState } from 'react';
import type { ChatTurnKind } from '@/lib/tools/chat-followups';
import type { StageState } from '@/components/thread/progress-checklist';
import type { RunEvidence } from '@/lib/tools/evidence';

/** The normalized view of one skill stream, as <ThreadTurn> wants it. */
export interface ActiveRun {
  skill: ChatTurnKind;
  isStreaming: boolean;
  isDone: boolean;
  /**
   * The SSE stream has CLOSED — distinct from `isDone`, and the distinction is the whole point.
   *
   * The four generative routes emit `done` before their closing line (S2: unblock the UI early),
   * persist that line, and only then close. `isDone` therefore means "the cards are finished";
   * this means "nothing more is coming, and all of it is on disk". The composer folds on this.
   *
   * Defaults TRUE for every stream that does not report it (chat · explore · account-read · test),
   * because those have no late frame to wait for — they fold the moment they are done, exactly as
   * before. A stream that cannot say when it closed must not be able to stall the fold.
   */
  isClosed: boolean;
  blocks: unknown[];
  stages: StageState[];
  /**
   * The artifacts this run touched mid-flight (`evidence` SSE frame) — the proven outliers it is
   * grounded on, the post it resolved. Rendered inside the loading spine. Every stream that cannot
   * produce evidence (explore, account) simply omits it and this is null.
   */
  evidence: RunEvidence | null;
  followupText: string | null;
  warnings: string[];
  error: string | null;
  outliersAvailable: boolean;
  /** The creator stopped this run while its request was out (see `RunCandidate.isStopped`). */
  isStopped: boolean;
  /** Abort the in-flight stream (every hook backs this with a real AbortController). */
  stop: () => void;
  /** Clear the stream so the persisted thread owns this run's history. */
  reset: () => void;
  /**
   * Run it again as it was asked (the failed turn's Retry). It rides the run, not its `skill`: a run
   * the chat dispatched is named by the skill it ran, and retrying it is the chat's to do.
   */
  retry?: () => void;
}

/**
 * One stream, described loosely enough that all seven fit. The composer builds this list; every
 * field but `skill`/`isStreaming`/`stop`/`reset` is optional.
 */
export interface RunCandidate {
  skill: ChatTurnKind;
  /**
   * The stream this run is on, when it is not named by `skill` alone: the chat names its run by the
   * skill it dispatched, so a chat-dispatched hooks run and the hooks stream's own run share a skill
   * but are two runs. Defaults to `skill`.
   */
  stream?: string;
  isStreaming: boolean;
  isDone?: boolean;
  /** Omit for streams with no late frame — it defaults TRUE, i.e. "fold as soon as done". */
  isClosed?: boolean;
  blocks?: unknown[];
  stages?: StageState[];
  evidence?: RunEvidence | null;
  followupText?: string | null;
  warnings?: string[];
  error?: string | null;
  outliersAvailable?: boolean;
  /**
   * The creator stopped this run while its request was out. Holds the tail on its own, so a run
   * stopped before anything arrived keeps its turn (and the creator's message) on screen.
   */
  isStopped?: boolean;
  /**
   * How many runs this stream has started (each hook counts its starts). A new number is a new run,
   * whether or not a render ever saw it streaming: a request refused at once ends in the render it
   * started in.
   */
  runs?: number;
  /**
   * A wait with no request of ours behind it (a chat reopened while its run goes on, on the server).
   * It may hold the tail, but it never holds the field: it is not "streaming" to the composer's
   * one-run-at-a-time gate, and Stop does not reach it.
   */
  waitOnly?: boolean;
  stop: () => void;
  reset: () => void;
  retry?: () => void;
}

function normalize(c: RunCandidate): ActiveRun {
  return {
    skill: c.skill,
    isStreaming: c.isStreaming,
    isDone: c.isDone ?? false,
    isClosed: c.isClosed ?? true,
    blocks: c.blocks ?? [],
    stages: c.stages ?? [],
    evidence: c.evidence ?? null,
    followupText: c.followupText ?? null,
    warnings: c.warnings ?? [],
    error: c.error ?? null,
    outliersAvailable: c.outliersAvailable ?? false,
    isStopped: c.isStopped ?? false,
    stop: c.stop,
    reset: c.reset,
    retry: c.retry,
  };
}

const streamOf = (c: RunCandidate): string => c.stream ?? c.skill;

/**
 * True when a candidate still has anything worth rendering as the tail turn.
 *
 * ⚠️ `followupText` is deliberately NOT content on its own, and that exclusion is the whole fix
 * for the duplicate turn measured live on 2026-07-28.
 *
 * Every generative route emits `done` BEFORE its closing line and keeps the SSE open to stream it
 * (hooks/route.ts §S2 — the follow-up is a second model call, off the critical path, ~2s). The
 * composer folds the run into history on `done`: reload persisted history, then `reset()` the
 * stream. Then the late `followup` frame lands on the stream that was just reset and calls
 * `setFollowupText` — refilling ONE field of an otherwise empty hook.
 *
 * Counting that as content made the emptied stream claim the tail again, so the thread rendered
 * the just-folded run TWICE: the persisted turn with its cards, then a second Maven block with the
 * same past-tense intro, no cards, no receipt, and the same closing line — plus a duplicate of the
 * user's own bubble. It never cleared, because `reset()` also cleared `isDone`, so the
 * run-completion effect had nothing left to fire on.
 *
 * Nothing is lost by excluding it: every route persists that line as a trailing markdown message
 * BEFORE it sends the event, so the folded turn already carries the outro. And while a run is
 * genuinely live its blocks/stages/isStreaming already make it the tail — a follow-up has never
 * arrived before them.
 *
 * A stopped run is content too, so Stop pressed before a single word, stage or card keeps the turn
 * (the live turn is what draws the creator's message). Only until another run starts, whatever the
 * stopped one holds: a stream is not reset when a different one runs next (a stopped run is never
 * done, so no fold resets it), and once that run has folded into history the stopped one would come
 * back as the tail, its words and stages under the newest message, drawn a second time. Its ask is
 * not lost: the chat and skill routes store the ask before they answer, so the next fold's read
 * brings it in (the account read stores its message with a delivered read only, so a stopped one
 * leaves nothing behind).
 *
 * A failed run the same: it is never done either, so it keeps its error (and its Retry) until the
 * creator retries it, and only while it is the newest run. Once another has started and folded, the
 * failed one would come back with its Retry under that run's ask.
 */
function hasContent(c: RunCandidate, lastStarted: string | null): boolean {
  if ((c.isStopped || c.error) && !c.isStreaming) return streamOf(c) === lastStarted;
  return c.isStreaming || (c.blocks?.length ?? 0) > 0 || (c.stages?.length ?? 0) > 0;
}

export interface UseActiveRunResult {
  /** The run holding the thread's tail, or null when the thread is settled. */
  activeRun: ActiveRun | null;
  /** True while ANY stream is in flight — the composer's one-run-at-a-time gate. */
  isAnyStreaming: boolean;
  /** Abort whatever is streaming. No-op when nothing is. */
  stopActive: () => void;
}

export function useActiveRun(candidates: RunCandidate[]): UseActiveRunResult {
  // Remember which stream last began streaming, so that when two runs both hold content — the
  // previous one settled but not yet folded into history, because its reload is still in flight or
  // failed — the NEWER one owns the tail. Without this the tail falls back to candidate ORDER,
  // which would flip the thread back to a stale run.
  //
  // This is React's documented "adjusting state when a prop changes" pattern — a guarded setState
  // DURING render, not in an effect and not a ref.
  //   https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  // The two obvious alternatives are both genuinely wrong here, not merely lint-noisy: a ref
  // written and read mid-render makes the render impure (and this value IS read while rendering,
  // to choose the tail), while an effect would commit the tail one frame late. The `!==` guard is
  // what makes this terminate — React re-runs the render immediately and the second pass is a
  // no-op. It only fires when a NEW run starts, and while one is streaming the streaming branch
  // wins outright anyway.
  //
  // A run usually starts by streaming. One refused at once can end in the render it started in (its
  // request is refused before React draws it running), so a stream whose count of starts (`runs`)
  // went up since the last render has started too: it is the run the creator just sent. What the
  // stream holds cannot tell: a stream that failed before and is refused again holds an error before
  // and after. `seenRuns` is every stream's count as of the last render, kept the same way.
  const [lastStarted, setLastStarted] = useState<string | null>(null);
  const runsNow = candidates.map((c) => c.runs ?? 0).join(",");
  const [seenRuns, setSeenRuns] = useState(() => candidates.map(() => 0).join(","));
  const streaming = candidates.find((c) => c.isStreaming) ?? null;
  let started = streaming ? streamOf(streaming) : null;
  if (runsNow !== seenRuns) {
    if (!started) {
      const before = seenRuns.split(",").map(Number);
      started = candidates.filter((c, i) => (c.runs ?? 0) > (before[i] ?? 0)).map(streamOf).pop() ?? null;
    }
    setSeenRuns(runsNow);
  }
  if (started && started !== lastStarted) setLastStarted(started);

  const settled = candidates.filter((c) => hasContent(c, lastStarted));
  const preferred =
    streaming ??
    settled.find((c) => streamOf(c) === lastStarted) ??
    settled[settled.length - 1] ??
    null;

  return {
    activeRun: preferred ? normalize(preferred) : null,
    isAnyStreaming: candidates.some((c) => c.isStreaming && !c.waitOnly),
    stopActive: () => {
      if (streaming && !streaming.waitOnly) streaming.stop();
    },
  };
}
