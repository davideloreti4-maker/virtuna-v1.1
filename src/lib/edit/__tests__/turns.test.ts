/**
 * turns.test.ts — the turns' rules (plan 2026-11-24-editor-screens-a, Task 2; spec §6; ruling R9): the turn shown, the runs
 * Undo and Redo step over, a new turn and what it drops, the cap, the conversation and the look at a head.
 */
import { describe, expect, it } from "vitest";
import { applyOps, type Asset, type Edit, type Op } from "@/lib/edit";
import { assetOf, firstEdit } from "@/lib/edit/worker/takes";
import { BUCKET, TAKE, WORDS, takeRow } from "@/lib/edit/worker/__tests__/rows";
import { MOST_TURNS, canMoveTo, carriedFixes, fixedWords, handTurns, lookAt, nextTurn, redoTarget, shownTurn, spokenTurns, undoTarget, type TurnMark } from "../turns";

const cut = (n: number): TurnMark => ({ n, kind: "cut", doc: true });
const change = (n: number): TurnMark => ({ n, kind: "change", doc: true });
const said = (n: number): TurnMark => ({ n, kind: "said", doc: false });
const direct = (n: number): TurnMark => ({ n, kind: "direct", doc: true });
/** The first cut, a change, an answer that changed nothing, a word fixed by hand. Its runs: 1 | 2 3 | 4. */
const LINE = [cut(1), change(2), said(3), direct(4)];
/** A line that ends on an answer that changed nothing. Its runs: 1 | 2 3. */
const ENDS_SAID = [cut(1), change(2), said(3)];
/** A line with two such answers. Its runs: 1 2 | 3 | 4 5. */
const TWO_SAID = [cut(1), said(2), change(3), change(4), said(5)];

describe("the turn shown", () => {
  it("is none before the first cut", () => {
    expect(shownTurn([], null)).toBeNull();
  });

  it("is the latest turn at or before the head that holds an edit", () => {
    expect(shownTurn(LINE, 4)).toBe(4);
    expect(shownTurn(LINE, 3)).toBe(2);
    expect(shownTurn(LINE, 1)).toBe(1);
  });
});

describe("Undo and Redo", () => {
  it("Undo goes to the end of the run before the shown turn's run", () => {
    expect(undoTarget(LINE, 4)).toBe(3);
    expect(undoTarget(LINE, 3)).toBe(1);
    expect(undoTarget(LINE, 1)).toBeNull();
  });

  it("Redo goes to the end of the run after the shown turn's run", () => {
    expect(redoTarget(LINE, 1)).toBe(3);
    expect(redoTarget(LINE, 4)).toBeNull();
  });

  it("Redo from a head that is an answer goes on to the next run", () => {
    expect(redoTarget(LINE, 3)).toBe(4);
    expect(redoTarget(TWO_SAID, 2)).toBe(3);
  });

  it("go nowhere on an empty line", () => {
    expect(undoTarget([], null)).toBeNull();
    expect(redoTarget([], null)).toBeNull();
    expect(canMoveTo([], 1)).toBe(false);
  });

  it("Undo then Redo brings back an answer that changed nothing", () => {
    expect(shownTurn(ENDS_SAID, 3)).toBe(2);
    const undone = undoTarget(ENDS_SAID, 3);
    expect(undone).toBe(1);
    const redone = redoTarget(ENDS_SAID, undone);
    expect(redone).toBe(3);
    expect(spokenTurns(ENDS_SAID, redone).map((turn) => turn.n)).toEqual([1, 2, 3]);
    expect(redoTarget(ENDS_SAID, redone)).toBeNull();
  });

  it("walk a line with two answers back and forth: Undo, Undo, Redo, Redo", () => {
    expect(shownTurn(TWO_SAID, 5)).toBe(4);
    const first = undoTarget(TWO_SAID, 5);
    const second = undoTarget(TWO_SAID, first);
    const third = redoTarget(TWO_SAID, second);
    const fourth = redoTarget(TWO_SAID, third);
    expect([first, second, third, fourth]).toEqual([3, 2, 3, 5]);
    expect(undoTarget(TWO_SAID, second)).toBeNull();
    expect(redoTarget(TWO_SAID, fourth)).toBeNull();
  });

  it("Undo on the answer of a turn goes to the end of the run before that turn's", () => {
    expect(undoTarget(LINE, 2)).toBe(1);
    expect(undoTarget(TWO_SAID, 4)).toBe(3);
    expect(undoTarget(TWO_SAID, 3)).toBe(2);
  });

  it("move only to the end of a run", () => {
    expect(canMoveTo(LINE, 1)).toBe(true);
    expect(canMoveTo(LINE, 2)).toBe(false);
    expect(canMoveTo(LINE, 3)).toBe(true);
    expect(canMoveTo(LINE, 4)).toBe(true);
    expect(canMoveTo(LINE, 9)).toBe(false);
    expect([0, 1, 2, 3, 4, 5, 6].filter((n) => canMoveTo(TWO_SAID, n))).toEqual([2, 3, 5]);
  });

  it("read the turns in whatever order the rows come", () => {
    const rows = [direct(4), change(2), said(3), cut(1)];
    expect(shownTurn(rows, 3)).toBe(2);
    expect(undoTarget(rows, 4)).toBe(3);
    expect(redoTarget(rows, 1)).toBe(3);
    expect(redoTarget([cut(1), direct(4), said(3), change(2)], 1)).toBe(3);
    expect([1, 2, 3, 4].filter((n) => canMoveTo(rows, n))).toEqual([1, 3, 4]);
  });

  it("are a round trip on every line of up to seven turns", () => {
    for (let length = 1; length <= 7; length++) {
      for (let pattern = 0; pattern < 2 ** (length - 1); pattern++) {
        // A cut, then each later turn either a change or an answer that changed nothing.
        const line = [cut(1), ...Array.from({ length: length - 1 }, (_, i) => ((pattern >> i) & 1 ? said(i + 2) : change(i + 2)))];
        const name = line.map((turn) => turn.kind).join(" ");
        // A run ends where the next turn holds an edit, or where the line does.
        const ends = line.filter((_, i) => line[i + 1]?.doc ?? true).map((turn) => turn.n);
        const everyNumber = Array.from({ length: length + 2 }, (_, n) => n);
        for (const rows of [line, [...line].reverse()]) {
          expect(everyNumber.filter((n) => canMoveTo(rows, n)), name).toEqual(ends);
          ends.forEach((end, i) => {
            expect(undoTarget(rows, end), `${name}: Undo at ${end}`).toBe(ends[i - 1] ?? null);
            expect(redoTarget(rows, end), `${name}: Redo at ${end}`).toBe(ends[i + 1] ?? null);
          });
        }
      }
    }
  });
});

describe("a new turn", () => {
  it("comes right after the head and drops the turns after it", () => {
    expect(nextTurn([], null)).toEqual({ ok: true, n: 1, drops: [] });
    expect(nextTurn(LINE, 4)).toEqual({ ok: true, n: 5, drops: [] });
    expect(nextTurn(LINE, 2)).toEqual({ ok: true, n: 3, drops: [3, 4] });
    expect(nextTurn(ENDS_SAID, 1)).toEqual({ ok: true, n: 2, drops: [2, 3] });
  });

  it("names what it drops in order, whatever order the rows come", () => {
    expect(nextTurn([direct(4), change(2), said(3), cut(1)], 1)).toEqual({ ok: true, n: 2, drops: [2, 3, 4] });
  });

  it(`is refused past ${MOST_TURNS}`, () => {
    const full = Array.from({ length: MOST_TURNS }, (_, i) => change(i + 1));
    expect(nextTurn(full, MOST_TURNS)).toEqual({ ok: false, reason: "full" });
    expect(nextTurn(full, MOST_TURNS - 1)).toEqual({ ok: true, n: MOST_TURNS, drops: [MOST_TURNS] });
  });
});

describe("the conversation", () => {
  it("is every turn up to the head, in order, and none before the first", () => {
    const words = [{ n: 2, say: "b" }, { n: 1, say: "a" }, { n: 3, say: "c" }];
    expect(spokenTurns(words, 2).map((turn) => turn.say)).toEqual(["a", "b"]);
    expect(spokenTurns(words, null)).toEqual([]);
    expect(words.map((turn) => turn.n)).toEqual([2, 1, 3]);
  });

  it("names the look of the latest cut at or before the head", () => {
    const looks = [{ ...cut(1), request: "house" }, { ...change(2), request: "Bigger captions" }, { ...cut(3), request: "clean" }];
    expect(lookAt(looks, 3)).toBe("clean");
    expect(lookAt(looks, 2)).toBe("house");
    expect(lookAt(looks, null)).toBeNull();
    expect(lookAt([...looks].reverse(), 3)).toBe("clean");
  });
});

/* ── the words fixed by hand (E9, changed by R31) ── */

/** The suite's take, "Good morning. Let us begin", as one shot. */
const ASSET = assetOf(takeRow(), BUCKET);
const TAKE_EDIT = firstEdit(ASSET);
const through = (edit: Edit, ops: Op[], library: Asset[] = [ASSET]): Edit => {
  const made = applyOps(edit, ops, library);
  if (!made.ok) throw new Error(made.problems.map((problem) => `${problem.path}: ${problem.message}`).join("; "));
  return made.edit;
};
const fix = (index: number, text: string): Op => ({ op: "word.set", asset: TAKE, index, text });
const wordsOf = (edit: Edit) => (edit.assets[0]?.kind === "video" ? (edit.assets[0].words ?? []).map((word) => word.text) : []);

describe("the hand-made changes on the line", () => {
  it("are its direct turns up to the head, in order, each with the turn whose edit it was made on", () => {
    expect(handTurns(LINE, 4)).toEqual([{ n: 4, on: 2 }]);
    expect(handTurns([cut(1), direct(2), said(3), direct(4), cut(5), direct(6)], 6)).toEqual([{ n: 2, on: 1 }, { n: 4, on: 2 }, { n: 6, on: 5 }]);
  });

  it("leave out those after the head: undone, they stand on no line the creator is on", () => {
    expect(handTurns(LINE, 3)).toEqual([]);
    expect(handTurns([direct(3), cut(1), direct(2)], 2)).toEqual([{ n: 2, on: 1 }]); // rows in any order
    expect(handTurns([], null)).toEqual([]);
  });
});

describe("the words a hand-made change fixed", () => {
  it("are each word whose text it changed, named by the take's own word: its file, its place, when it was heard", () => {
    const fixed = through(TAKE_EDIT, [fix(1, "evening."), fix(4, "began")]);
    expect(fixedWords(TAKE_EDIT, fixed)).toEqual([
      { asset: TAKE, index: 1, startMs: WORDS[1]!.startMs, endMs: WORDS[1]!.endMs, text: "evening." },
      { asset: TAKE, index: 4, startMs: WORDS[4]!.startMs, endMs: WORDS[4]!.endMs, text: "began" },
    ]);
  });

  it("are none for captions turned off, or a word set to the text it had", () => {
    expect(fixedWords(TAKE_EDIT, through(TAKE_EDIT, [{ op: "captions.set", on: false }]))).toEqual([]);
    expect(fixedWords(TAKE_EDIT, TAKE_EDIT)).toEqual([]);
  });
});

describe("the words fixed by hand, carried into a new cut of the take", () => {
  /** A new cut of the same take: shorter, and its words as the take heard them. */
  const NEW_CUT = through(TAKE_EDIT, [{ op: "shot.trim", id: "s1", startMs: 400, endMs: 11_000 }]);

  it("are word.set operations on the new cut, each on the same heard word, which the door takes", () => {
    const fixes = fixedWords(TAKE_EDIT, through(TAKE_EDIT, [fix(1, "evening."), fix(4, "began")]));
    const ops = carriedFixes(NEW_CUT, fixes);
    expect(ops).toEqual([fix(1, "evening."), fix(4, "began")]);
    expect(wordsOf(through(NEW_CUT, ops))).toEqual(["Good", "evening.", "Let", "us", "began"]);
  });

  it("give the latest fix of a word, and leave out a word the new cut holds as fixed already", () => {
    const first = through(TAKE_EDIT, [fix(2, "Lets")]);
    const second = through(first, [fix(2, "Now")]);
    const fixes = [...fixedWords(TAKE_EDIT, first), ...fixedWords(first, second)];
    expect(carriedFixes(NEW_CUT, fixes)).toEqual([fix(2, "Now")]);
    expect(carriedFixes(through(NEW_CUT, [fix(2, "Now")]), fixes)).toEqual([]);
    // Fixed and fixed back: the heard word again, which the new cut has.
    expect(carriedFixes(NEW_CUT, [...fixes, ...fixedWords(second, through(second, [fix(2, "Let")]))])).toEqual([]);
  });

  it("leave out a fix that no longer finds its word: another file, no word at its place, or one heard at another time", () => {
    const fixes = fixedWords(TAKE_EDIT, through(TAKE_EDIT, [fix(1, "evening.")]));
    // Another take's cut: its file is not the one the word was heard in.
    const other = assetOf(takeRow({ id: "55555555-5555-4555-8555-555555555555" }), BUCKET);
    expect(carriedFixes(firstEdit(other), fixes)).toEqual([]);
    // The same file heard again with fewer words, or with the word at another time: not the word that was fixed.
    const fewer = firstEdit({ ...ASSET, words: WORDS.slice(0, 1) } as Asset);
    expect(carriedFixes(fewer, fixes)).toEqual([]);
    const moved = firstEdit({ ...ASSET, words: WORDS.map((word, i) => (i === 1 ? { ...word, startMs: word.startMs + 10 } : word)) } as Asset);
    expect(carriedFixes(moved, fixes)).toEqual([]);
  });
});
