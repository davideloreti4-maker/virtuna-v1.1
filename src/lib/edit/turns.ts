/**
 * turns.ts — the rules of an edit's turns (spec 2026-11-24-editor-screens-design.md §6; plan 2026-11-24-editor-screens-a,
 * Task 2; ruling R9). Every change of an edit is a turn; `head` is the last turn of the line the creator is on, and the
 * edit shown is the latest turn at or before it that holds one (an answer that changed nothing, `said`, holds none).
 *
 * A line is made of runs: a turn that holds an edit, plus the answers that changed nothing directly after it, up to the
 * next turn that holds an edit. `head` rests on the end of a run, its last turn, so the conversation up to `head` keeps
 * those answers. Undo moves `head` to the end of the run before the shown turn's run and Redo to the end of the run after
 * it, so Undo then Redo is a round trip. A new turn comes right after `head` and drops the turns after it. An edit keeps at
 * most `MOST_TURNS` turns. A cut turn's `request` is the key of its look (`house`, a preset's id, `video`, `words`).
 *
 * A caption word fixed by hand is a fact about the take (E9, changed by R31): every cut made later on the line carries the
 * line's hand-made fixes (`handTurns`, `fixedWords`, `carriedFixes`), each found again by the take's own word.
 *
 * Pure: the routes read and write the rows and ask this what to do; the page asks it nothing (the routes answer the targets).
 * The rows may come in any order.
 */
import type { Edit } from "./doc";
import type { Op } from "./ops";

export const TURN_KINDS = ["cut", "change", "direct", "said"] as const;
export type TurnKind = (typeof TURN_KINDS)[number];

/** The most turns one edit keeps. */
export const MOST_TURNS = 300;

/** A turn as the rules read it: its number, its kind, and whether it holds an edit. */
export interface TurnMark {
  n: number;
  kind: TurnKind;
  doc: boolean;
}

const upTo = (head: number | null): number => head ?? 0;

/** The turn whose edit is shown: the latest at or before `head` that holds one; null before the first cut. */
export function shownTurn(turns: readonly TurnMark[], head: number | null): number | null {
  let shown: number | null = null;
  for (const turn of turns) if (turn.doc && turn.n <= upTo(head) && (shown === null || turn.n > shown)) shown = turn.n;
  return shown;
}

/** The first turn after `n` that holds an edit; null when there is none. */
function editAfter(turns: readonly TurnMark[], n: number): number | null {
  let next: number | null = null;
  for (const turn of turns) if (turn.doc && turn.n > n && (next === null || turn.n < next)) next = turn.n;
  return next;
}

/** The end of the run that `start`, a turn that holds an edit, begins: the last turn before the next that holds one. */
function runEnd(turns: readonly TurnMark[], start: number): number {
  const next = editAfter(turns, start) ?? Infinity;
  let end = start;
  for (const turn of turns) if (turn.n > end && turn.n < next) end = turn.n;
  return end;
}

/**
 * Where Undo goes: the end of the run before the shown turn's run; null when the shown turn is the first that holds an
 * edit, or there is none. With a turn's own number for `head`, this is where the Undo on that turn's answer goes.
 */
export function undoTarget(turns: readonly TurnMark[], head: number | null): number | null {
  const shown = shownTurn(turns, head);
  const before = shown === null ? null : shownTurn(turns, shown - 1);
  return before === null ? null : runEnd(turns, before);
}

/**
 * Where Redo goes: the end of the run after the shown turn's run; null when there is none. No turn between the shown one
 * and `head` holds an edit, so that run begins at the first turn after `head` that does.
 */
export function redoTarget(turns: readonly TurnMark[], head: number | null): number | null {
  const next = editAfter(turns, upTo(head));
  return next === null ? null : runEnd(turns, next);
}

/** Whether `head` may move to `n`: only to the end of a run. */
export function canMoveTo(turns: readonly TurnMark[], n: number): boolean {
  const start = shownTurn(turns, n);
  return start !== null && runEnd(turns, start) === n;
}

export type NextTurn = { ok: true; n: number; drops: number[] } | { ok: false; reason: "full" };

/** A new turn: right after `head`, dropping every turn from there on (named in order); refused past `MOST_TURNS`. */
export function nextTurn(turns: readonly TurnMark[], head: number | null): NextTurn {
  const n = upTo(head) + 1;
  if (n > MOST_TURNS) return { ok: false, reason: "full" };
  const drops = turns.filter((turn) => turn.n >= n).map((turn) => turn.n).sort((a, b) => a - b);
  return { ok: true, n, drops };
}

/** The conversation: every turn up to `head`, in order. A new array; `turns` is not touched. */
export function spokenTurns<T extends { n: number }>(turns: readonly T[], head: number | null): T[] {
  return turns.filter((turn) => turn.n <= upTo(head)).sort((a, b) => a.n - b.n);
}

/** The look of the edit at `head`: the `request` of the latest cut at or before it; null before the first cut. */
export function lookAt(turns: readonly (TurnMark & { request: string | null })[], head: number | null): string | null {
  let look: { n: number; request: string | null } | null = null;
  for (const turn of turns) if (turn.kind === "cut" && turn.n <= upTo(head) && (look === null || turn.n > look.n)) look = turn;
  return look?.request ?? null;
}

/** A hand-made change on the line: its turn, and the turn whose edit it was made on. */
export interface HandTurn {
  n: number;
  on: number;
}

/**
 * The hand-made changes (`direct` turns) on the line up to `head`, in order, each with the turn whose edit it was made on: the
 * edit shown just before it, since a turn is made at the head on the edit shown there. One after `head` is on no line the
 * creator is on (undone), and is left out.
 */
export function handTurns(turns: readonly TurnMark[], head: number | null): HandTurn[] {
  return spokenTurns(turns, head).flatMap((turn) => {
    const on = turn.kind === "direct" ? shownTurn(turns, turn.n - 1) : null;
    return on === null ? [] : [{ n: turn.n, on }];
  });
}

/**
 * A caption word fixed by hand: the take's word it is (its file, its place among that file's words, when it was heard there,
 * none of which an edit can change) and its text as fixed.
 */
export interface WordFix {
  asset: string;
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

/** The words a hand-made change fixed: each word of `after` whose text is not the one it had in `before`, the edit it was made on. */
export function fixedWords(before: Edit, after: Edit): WordFix[] {
  return after.assets.flatMap((asset) => {
    const was = before.assets.find((each) => each.id === asset.id);
    if (asset.kind !== "video" || was?.kind !== "video") return [];
    return (asset.words ?? []).flatMap((word, index) => {
      const heard = was.words?.[index];
      return heard && heard.text !== word.text ? [{ asset: asset.id, index, startMs: word.startMs, endMs: word.endMs, text: word.text }] : [];
    });
  });
}

/**
 * The words fixed by hand on the line (`fixes`, in the order they were fixed) as `word.set` operations on `cut`, a new cut of
 * the same take, for the door. Each fix finds its word by the take's own word: the same file, the same place among its words,
 * heard at the same time. The latest fix of a word wins; a fix whose word `cut` does not hold is dropped, and so is one the
 * word already reads as.
 */
export function carriedFixes(cut: Edit, fixes: readonly WordFix[]): Op[] {
  const latest = new Map<string, WordFix>();
  for (const fix of fixes) latest.set(`${fix.asset}\u0000${fix.index}`, fix);
  return [...latest.values()].flatMap((fix) => {
    const asset = cut.assets.find((each) => each.id === fix.asset);
    const word = asset?.kind === "video" ? asset.words?.[fix.index] : undefined;
    if (!word || word.startMs !== fix.startMs || word.endMs !== fix.endMs || word.text === fix.text) return [];
    return [{ op: "word.set" as const, asset: fix.asset, index: fix.index, text: fix.text }];
  });
}
