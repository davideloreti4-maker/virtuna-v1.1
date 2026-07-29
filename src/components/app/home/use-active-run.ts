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
  followupText: string | null;
  warnings: string[];
  error: string | null;
  outliersAvailable: boolean;
  /** Abort the in-flight stream (every hook backs this with a real AbortController). */
  stop: () => void;
  /** Clear the stream so the persisted thread owns this run's history. */
  reset: () => void;
}

/**
 * One stream, described loosely enough that all seven fit. The composer builds this list; every
 * field but `skill`/`isStreaming`/`stop`/`reset` is optional.
 */
export interface RunCandidate {
  skill: ChatTurnKind;
  isStreaming: boolean;
  isDone?: boolean;
  /** Omit for streams with no late frame — it defaults TRUE, i.e. "fold as soon as done". */
  isClosed?: boolean;
  blocks?: unknown[];
  stages?: StageState[];
  followupText?: string | null;
  warnings?: string[];
  error?: string | null;
  outliersAvailable?: boolean;
  stop: () => void;
  reset: () => void;
}

function normalize(c: RunCandidate): ActiveRun {
  return {
    skill: c.skill,
    isStreaming: c.isStreaming,
    isDone: c.isDone ?? false,
    isClosed: c.isClosed ?? true,
    blocks: c.blocks ?? [],
    stages: c.stages ?? [],
    followupText: c.followupText ?? null,
    warnings: c.warnings ?? [],
    error: c.error ?? null,
    outliersAvailable: c.outliersAvailable ?? false,
    stop: c.stop,
    reset: c.reset,
  };
}

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
 */
function hasContent(c: RunCandidate): boolean {
  return (
    c.isStreaming ||
    (c.blocks?.length ?? 0) > 0 ||
    (c.stages?.length ?? 0) > 0 ||
    !!c.error
  );
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
  // Remember which skill last began streaming, so that when two runs both hold content — the
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
  const [lastStarted, setLastStarted] = useState<ChatTurnKind | null>(null);
  const streaming = candidates.find((c) => c.isStreaming) ?? null;
  const streamingSkill = streaming?.skill ?? null;
  if (streamingSkill && streamingSkill !== lastStarted) setLastStarted(streamingSkill);

  const settled = candidates.filter(hasContent);
  const preferred =
    streaming ??
    settled.find((c) => c.skill === lastStarted) ??
    settled[settled.length - 1] ??
    null;

  return {
    activeRun: preferred ? normalize(preferred) : null,
    isAnyStreaming: !!streaming,
    stopActive: () => streaming?.stop(),
  };
}
