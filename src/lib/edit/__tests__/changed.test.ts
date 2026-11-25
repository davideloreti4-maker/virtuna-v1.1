/**
 * changed.test.ts — where a change starts on the film (plan 2026-11-24-editor-screens-a, Task 3; spec §5.2): on real edits
 * made by the door from the suite's take (12.7 s, 381 frames; "Good" at 519 ms, "Let" at 1500 ms, "begin" at 1760 ms; the
 * captions three words a page), and from a take of eight made-up words for the pages the kit really sets (`pagesFor`).
 */
import { describe, expect, it } from "vitest";
import { pagesFor } from "@/edit/film/pages";
import { applyOps, layout, runWords, type Asset, type Edit, type Op } from "@/lib/edit";
import { assetOf, firstEdit } from "@/lib/edit/worker/takes";
import { BUCKET, takeRow } from "@/lib/edit/worker/__tests__/rows";
import { firstChangedFrame } from "../changed";

const ASSET = assetOf(takeRow(), BUCKET);
const FIRST = firstEdit(ASSET);
const door = (asset: Asset) => (edit: Edit, ops: Op[]): Edit => {
  const made = applyOps(edit, ops, [asset]);
  if (!made.ok) throw new Error(made.problems.map((problem) => `${problem.path}: ${problem.message}`).join("; "));
  return made.edit;
};
const through = door(ASSET);

/** Eight made-up words said with no pause: one stretch of speech, so only a page's length or a closing mark ends a page. */
const COUNTED = assetOf(takeRow({ words: ["one", "two", "three", "four", "five", "six", "seven", "eight"].map((text, i) => ({ text, startMs: 600 + 300 * i, endMs: 880 + 300 * i })) }), BUCKET);
const counted = door(COUNTED);

/** The pages the kit sets for an edit of one run: each page's first frame and its words. */
const pagesIn = (edit: Edit): [number, string][] => {
  const run = layout(edit).runs[0]!;
  return pagesFor(edit.captions, runWords(edit, run), run.frames).map((page) => [page.from, page.words.map((word) => word.text).join(" ")]);
};

describe("firstChangedFrame", () => {
  it("is null when nothing seen changed, and when the whole film did", () => {
    expect(firstChangedFrame(FIRST, FIRST)).toBeNull();
    expect(firstChangedFrame(FIRST, through(FIRST, [{ op: "shot.set", id: "s1", volume: 0.5 }]))).toBeNull();
    expect(firstChangedFrame(FIRST, through(FIRST, [{ op: "look.set", preset: "mono" }]))).toBeNull();
    expect(firstChangedFrame(FIRST, through(FIRST, [{ op: "captions.set", size: 96 }]))).toBeNull();
    expect(firstChangedFrame(FIRST, through(FIRST, [{ op: "shot.split", id: "s1", atMs: 4000, newId: "s9" }]))).toBeNull();
  });

  it("is where a fixed word's caption page first shows", () => {
    expect(firstChangedFrame(FIRST, through(FIRST, [{ op: "word.set", asset: ASSET.id, index: 0, text: "Fine" }]))).toBe(16);
    expect(firstChangedFrame(FIRST, through(FIRST, [{ op: "word.set", asset: ASSET.id, index: 4, text: "start" }]))).toBe(45);
  });

  it("is where a part comes in, or where a zoom starts", () => {
    const title: Op = { op: "item.add", item: { id: "t1", part: "title", anchor: "start", at: 60, frames: 45, props: { text: "Start here", font: "tiktok", look: "label", y: 0.2, size: 72, color: "#111111", accent: null } } };
    expect(firstChangedFrame(FIRST, through(FIRST, [title]))).toBe(60);
    const split = through(FIRST, [{ op: "shot.split", id: "s1", atMs: 4000, newId: "s9" }]);
    expect(firstChangedFrame(split, through(split, [{ op: "shot.set", id: "s9", framing: { from: { zoom: 1.2, x: 0, y: 0 }, move: null } }]))).toBe(120);
  });

  it("is the start for a cut at the start, and a second before the new end for a cut at the end", () => {
    expect(firstChangedFrame(FIRST, through(FIRST, [{ op: "shot.trim", id: "s1", startMs: 500 }]))).toBe(0);
    expect(firstChangedFrame(FIRST, through(FIRST, [{ op: "shot.trim", id: "s1", endMs: 10_000 }]))).toBe(270);
  });

  it("is the first new frame of a film made longer at its end", () => {
    const short = through(FIRST, [{ op: "shot.trim", id: "s1", endMs: 10_000 }]);
    expect(layout(short).frames).toBe(300);
    expect(firstChangedFrame(short, FIRST)).toBe(300);
  });

  it("is, for a fixed word, the start of the page that can show it: up to two words before the page the kit sets", () => {
    // Filled pages, three words a page: the kit's second page starts at "Let" (45).
    expect(pagesIn(FIRST)).toEqual([[16, "Good morning."], [45, "Let us begin"]]);
    // Its middle word: a page of three could start a word earlier, at "morning." (28).
    expect(firstChangedFrame(FIRST, through(FIRST, [{ op: "word.set", asset: ASSET.id, index: 3, text: "we" }]))).toBe(28);
    // Its first word: such a page could start two words earlier, at "Good" (16).
    expect(firstChangedFrame(FIRST, through(FIRST, [{ op: "word.set", asset: ASSET.id, index: 2, text: "Now" }]))).toBe(16);
  });

  it("is after the first frame that differs when a closing mark re-pages an evened stretch", () => {
    // Captions set as a sentence are evened out over a stretch of speech: eight words on three pages.
    const even = counted(firstEdit(COUNTED), [{ op: "captions.set", look: "plain", weight: 700 }]);
    expect(pagesIn(even)).toEqual([[18, "one two"], [36, "three four five"], [63, "six seven eight"]]);
    // A full stop on "seven" ends the stretch there, and the kit cuts the seven words before it anew, from "three" (36) on.
    const stopped = counted(even, [{ op: "word.set", asset: COUNTED.id, index: 6, text: "seven." }]);
    expect(pagesIn(stopped)).toEqual([[18, "one two"], [36, "three four"], [54, "five six seven."], [81, "eight"]]);
    // The frame given is where the page that can show the fixed word starts ("five", 54): the page from 36 had changed already.
    expect(firstChangedFrame(even, stopped)).toBe(54);
  });
});
