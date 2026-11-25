/**
 * answer-in.ts — "the answer is in" (thread feel, spec 2026-11-25 §4.1, §4.3, §4.6): the one rule
 * the turn draws its cards by, the composer's settle runs on, and the field drops Stop on. Three
 * readers that used to write it three times drifted apart (the settle waited for a dispatched run's
 * stream to close, seconds after its cards), so they all read this.
 *
 * - A run's result cards are in once every stage it reported is done, though its stream may stay
 *   open: a chat-dispatched run finishes its stages, bills, writes its cards and only then its
 *   closing line. A run that reports no stage (a fresh dispatch clears them) waits for its end.
 * - Anything else (a plain answer, a run that ended in text or a link field) is in when its stream
 *   has ended and it has something to show. A plain answer's words stream before that; they are
 *   not "in" until the last one.
 *
 * `isDone` is not read: the turn never sees it, and a skill's own stream ends its streaming with it.
 *
 * Pure: no React.
 */

import { hasResultCard } from "./answer-parts";

export interface AnswerRunState {
  isStreaming: boolean;
  stages: readonly { status: string }[];
  /** The turn's assistant blocks so far. */
  blocks: readonly unknown[];
}

export function answerIsIn({ isStreaming, stages, blocks }: AnswerRunState): boolean {
  if (!isStreaming) return blocks.length > 0;
  return hasResultCard(blocks) && stages.length > 0 && stages.every((s) => s.status === "done");
}
