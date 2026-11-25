/**
 * Task 9b (the controller's rulings, 2026-11-24): the label that stays gives way to a new text, by code, and an asked stress
 * shows. On the real code (the door, the review, the room, the loop), with Qwen's `ask` stood in for by scripted answers. Every
 * text here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { Analyses, FaceSample, TakeAnalysis } from "../../analysis";
import { placed } from "../../derive";
import { newEdit, type Asset, type Edit, type Item, type Mark } from "../../doc";
import { applyOps } from "../../ops";
import { review } from "../../review";
import { captionWeights, wordLight } from "../../../../edit/film/layout";
import { LABEL_GAP, LABEL_LEAST, contextOf, effectOf, labelGivesWay, roomFor, saidOf, stressShows } from "../context";
import { MARKED } from "../first-cut";
import { change, codeMoves, sayFault, type AgentInput } from "../loop";
import type { Ask } from "../model";

/* ── a made-up close-up: 8 s, 720x1280, sixteen words, the face filling the middle of the frame ─────────────────────────── */

const TAKE_MS = 8000;
const WORDS = ["Bake", "the", "bread", "slowly", "and", "it", "rises", "tall", "every", "single", "time", "you", "try", "this", "at", "home"]
  .map((text, i) => ({ text, startMs: 200 + i * 480, endMs: 600 + i * 480 }));
const facesAt = (y: number, h: number, mouthY: number): FaceSample[] =>
  Array.from({ length: TAKE_MS / 200 }, (_, i) => ({ ms: i * 200, face: { x: 0.2, y, w: 0.58, h }, mouth: { x: 0.37, y: mouthY, w: 0.22, h: 0.06 } }));
const analysisOf = (faces: FaceSample[]): TakeAnalysis => ({ language: "en", pauses: [{ startMs: 0, endMs: 200, cutMs: 100 }, { startMs: 7880, endMs: 8000, cutMs: 7940 }], faces, loudness: null });
/** A close-up: the face from 0.32 to 0.74 of the height, so the band above it is the one place a call-out has. */
const CLOSE: Analyses = { take: analysisOf(facesAt(0.32, 0.42, 0.62)) };
/** The face low, from 0.6 to 0.9: room for a call-out between the label and the face. */
const LOW: Analyses = { take: analysisOf(facesAt(0.6, 0.3, 0.8)) };

const TAKE: Asset = { id: "take", kind: "video", origin: "filmed", at: { bucket: "edit-media", path: "u1/take.mp4" }, ms: TAKE_MS, w: 720, h: 1280, sound: true, words: WORDS.map((word) => ({ ...word })) };
const LIBRARY: readonly Asset[] = [TAKE];
const FRAMES = 240;

const through = (edit: Edit, ops: unknown[]): Edit => {
  const made = applyOps(edit, ops, LIBRARY);
  if (!made.ok) throw new Error(made.problems.map((problem) => problem.message).join("; "));
  return made.edit;
};
/** The house's captions (plain, a weight, no highlight colour) and its label, staying to the end, at `y`. */
const HOOK = "Bread that rises every time";
const label = (y = 0.2, frames: number | null = null): Item => ({ id: "hook", part: "title", anchor: "start", at: 0, frames, props: { text: HOOK, font: "tiktok", look: "label", y, size: 72, color: "#111111", accent: null, weight: 600 } });
const house = (captionsY: number, y = 0.2, frames: number | null = null): Edit =>
  through(newEdit(TAKE), [{ op: "captions.set", look: "plain", font: "tiktok", size: 64, y: captionsY, maxWords: 5, highlight: null, weight: 600 }, { op: "item.add", item: label(y, frames) }]);
const closeUp = (): Edit => house(0.76);
const callout = (atMs: number, y: number, text = "TALL"): Mark => ({ id: "c1", part: "callout", atMs, lenMs: 1200, props: { text, font: "tiktok", look: "pop", x: 0.5, y, size: 110, color: "#ffffff" } });
const closing = (y = 0.2): Item => ({ id: "outro", part: "title", anchor: "end", at: 60, frames: 60, props: { text: "Try it *tonight*", font: "tiktok", look: "bold", y, size: 96, color: "#ffffff", accent: null } });

const hookOf = (edit: Edit): Item | undefined => edit.items.find((item) => item.id === "hook");
const startOf = (edit: Edit, id: string): number => {
  const place = placed(edit).find((each) => each.thing.id === id);
  if (!place) throw new Error(`${id} does not show`);
  return place.at;
};
const errors = (edit: Edit, analyses: Analyses) => review(edit, analyses).filter((finding) => finding.severity === "error");

/* ── Qwen, scripted ────────────────────────────────────────────────────────────────────────────────────────────────────── */

const answer = (say: string, ops: unknown[]) => JSON.stringify({ say, ops });
function scripted(answers: string[]) {
  const clock = { t: 0 };
  const ask: Ask = async () => {
    const text = answers.shift();
    if (text === undefined) throw new Error("the script has no answer left");
    clock.t += 1000;
    return { text, usage: { input: 9000, output: 120 }, ms: 1000 };
  };
  return { ask, now: () => clock.t, wait: async () => undefined };
}
const input = (edit: Edit, analyses: Analyses, request: string): AgentInput => ({ edit, analyses, request, library: LIBRARY, user: "u1", deadlineMs: 50_000, stills: false });

let logs: MockInstance[] = [];
beforeEach(() => {
  logs = [vi.spyOn(console, "log").mockImplementation(() => undefined), vi.spyOn(console, "warn").mockImplementation(() => undefined)];
});
afterEach(() => logs.forEach((spy) => spy.mockRestore()));

/* ── 1. the room ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe("the room does not count a title that stays to the end (ruling 1a)", () => {
  it("offers the band the staying label holds, and says the label ends where the new text starts", () => {
    const edit = closeUp();
    expect(errors(edit, CLOSE)).toEqual([]);
    const room = contextOf(edit, CLOSE, []).room;
    const one = /one line y=\[(\d\.\d\d),(\d\.\d\d)\]/.exec(room);
    expect(one, room).not.toBeNull();
    // The band above the face, where the label sits (y 0.2), is offered for a call-out.
    expect(Number(one?.[1])).toBeLessThanOrEqual(0.2);
    expect(Number(one?.[2])).toBeGreaterThanOrEqual(0.2);
    expect(room).toContain(`the title "${HOOK}" stays to the end`);
    expect(room).toContain("ends it where that text starts");
    // A call-out refused for the face is shown that band too.
    const refused = through(edit, [{ op: "mark.add", shot: "s1", mark: callout(3080, 0.5) }]);
    const onFace = review(refused, CLOSE).find((finding) => finding.code === "on-face" && finding.where.mark === "c1");
    if (!onFace) throw new Error("the call-out is not on the face");
    expect(roomFor(refused, CLOSE, onFace, edit)).toMatch(/^Room for it as it is: y=\[0\.\d\d,0\.\d\d\]/);
  });

  it("says nothing of a label when no title stays", () => {
    expect(contextOf(house(0.76, 0.2, FRAMES), CLOSE, []).room).not.toContain("stays to the end");
  });
});

/* ── 2 to 6. the move ─────────────────────────────────────────────────────────────────────────────────────────────────── */

describe("the label that stays gives way, by code (ruling 1b to 1e)", () => {
  it("2: a call-out in the label's band is taken in one round; the label ends LABEL_GAP frames before it", async () => {
    const before = closeUp();
    const qwen = scripted([answer("I added the call-out TALL above your face.", [{ op: "mark.add", shot: "s1", mark: callout(3080, 0.2) }])]);
    const result = await change(input(before, CLOSE, 'add a call-out "TALL" when I say tall'), qwen);
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed"]);
    const at = startOf(result.edit, "c1");
    expect(hookOf(result.edit)?.frames).toBe(at - LABEL_GAP);
    expect(errors(result.edit, CLOSE)).toEqual([]);
    // The facts, as the loop writes them from the move's own result.
    const add = [{ op: "mark.add", shot: "s1", mark: callout(3080, 0.2) }];
    const moved = codeMoves(before, through(before, add), add, CLOSE, LIBRARY);
    expect(moved.edit).toEqual(result.edit);
    expect(effectOf(before, moved.edit, moved.gave).lines).toContain(`the title "${HOOK}": now ends where the call-out "TALL" starts; it stayed to the end`);
    expect(result.say).toBe(`I added the call-out TALL above your face, so the title "${HOOK}" now ends where the call-out "TALL" starts.`);
    // The ops recorded give the edit: the move is among them.
    expect(through(before, result.ops)).toEqual(result.edit);
  });

  it("3: a closing title over the last 60 frames is taken in one round; the label ends LABEL_GAP frames before it", async () => {
    const before = closeUp();
    const qwen = scripted([answer("I added a closing line over the last two seconds.", [{ op: "item.add", item: closing() }])]);
    const result = await change(input(before, CLOSE, "add a closing line over the last two seconds"), qwen);
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed"]);
    expect(startOf(result.edit, "outro")).toBe(FRAMES - 60);
    expect(hookOf(result.edit)?.frames).toBe(FRAMES - 60 - LABEL_GAP);
    expect(review(result.edit, CLOSE).filter((finding) => finding.code === "two-titles")).toEqual([]);
    expect(errors(result.edit, CLOSE)).toEqual([]);
  });

  it("4: a text that would leave the label under LABEL_LEAST frames takes the label out, and the facts say so", async () => {
    const before = closeUp();
    // At 1.16 s (frame 35): 29 frames of the label would be left.
    const qwen = scripted([answer("I added the call-out BAKE above your face.", [{ op: "mark.add", shot: "s1", mark: callout(1160, 0.2, "BAKE") }]), answer("The call-out is in.", [])]);
    const result = await change(input(before, CLOSE, 'add a call-out "BAKE" when I say bread'), qwen);
    expect(startOf(result.edit, "c1") - LABEL_GAP).toBeLessThan(LABEL_LEAST);
    expect(hookOf(result.edit)).toBeUndefined();
    expect(errors(result.edit, CLOSE)).toEqual([]);
    expect(effectOf(before, result.edit).lines).toContain(`taken out: the title "${HOOK}"`);
    expect(result.say).toBe(`I added the call-out BAKE above your face, so the title "${HOOK}" is taken out: too little of it would show before the call-out "BAKE".`);
  });

  it("5: a call-out whose box does not touch the label's changes nothing about the label", async () => {
    const before = house(0.52, 0.18);
    expect(errors(before, LOW)).toEqual([]);
    const add = [{ op: "mark.add", shot: "s1", mark: callout(3080, 0.36) }];
    expect(labelGivesWay(through(before, add), LOW, LIBRARY).ops).toEqual([]);
    const result = await change(input(before, LOW, 'add a call-out "TALL"'), scripted([answer("I added the call-out TALL.", add)]));
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed"]);
    expect(hookOf(result.edit)).toEqual(hookOf(before));
    expect(result.say).toBe("I added the call-out TALL.");
  });

  it("6: a title with a set length is never touched: the review's two-titles stands as today", async () => {
    const before = house(0.76, 0.2, FRAMES);
    const add = [{ op: "item.add", item: closing() }];
    expect(labelGivesWay(through(before, add), CLOSE, LIBRARY).ops).toEqual([]);
    const result = await change(input(before, CLOSE, "add a closing line"), scripted([answer("I added a closing line.", add), answer("There is no room for a closing line while the title shows.", [])]));
    expect(result.rounds[0]?.outcome).toBe("review");
    expect(result.rounds[0]?.findings.some((finding) => finding.code === "two-titles")).toBe(true);
    expect(result.changed).toBe(false);
    expect(hookOf(result.edit)?.frames).toBe(FRAMES);
  });
});

/* ── 8. an asked stress shows ─────────────────────────────────────────────────────────────────────────────────────────── */

describe("asking for a stress on an even line turns the colour on (ruling 2b, 2c)", () => {
  it("8: a word.set that stresses a word on house captions sets the highlight to MARKED, a step heavier, and the facts tell it", async () => {
    const before = closeUp();
    const qwen = scripted([answer('I stressed "bread".', [{ op: "word.set", asset: "take", index: 2, stress: true }])]);
    const result = await change(input(before, CLOSE, 'stress the word "bread"'), qwen);
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed"]);
    expect(result.edit.captions.highlight).toBe(MARKED);
    const weights = captionWeights(result.edit.captions);
    expect(weights).toEqual({ plain: 600, stressed: 700 });
    // The first page's five words as the kit draws them: the stressed one heavier and in colour.
    const page = (result.edit.assets[0]?.kind === "video" ? (result.edit.assets[0].words ?? []) : []).slice(0, 5);
    expect(page.map((word) => (word.stress ? weights.stressed : weights.plain))).toEqual([600, 600, 700, 600, 600]);
    expect(page.map((word) => wordLight(result.edit.captions.look, false, word.stress === true).lit)).toEqual([false, false, true, false, false]);
    expect(effectOf(before, result.edit).lines).toContain('the stressed word w2 "bread" now stands out in yellow');
    expect(result.say).toBe('I stressed "bread", so "bread" now stands out in yellow.');
  });

  it("8: a word a first cut already marked, asked for again, turns the colour on too: every stressed word now stands out", async () => {
    const before = through(closeUp(), [{ op: "word.set", asset: "take", index: 2, stress: true }, { op: "word.set", asset: "take", index: 8, stress: true }]);
    const ops = [{ op: "word.set", asset: "take", index: 2, stress: true }];
    const result = await change(input(before, CLOSE, 'stress the word "bread"'), scripted([answer('I stressed "bread".', ops)]));
    expect(result.edit.captions.highlight).toBe(MARKED);
    expect(result.say).toBe('I stressed "bread", so the stressed words now stand out in yellow.');
    expect(effectOf(before, result.edit).lines).toEqual(expect.arrayContaining(['the stressed word w2 "bread" now stands out in yellow', 'the stressed word w8 "every" now stands out in yellow']));
    expect(saidOf(before, result.edit)).toBe("Some words now stand out in yellow.");
  });

  it("does nothing where the stress already shows, or no word is stressed; a stress taken off leaves the colour", () => {
    const stress = [{ op: "word.set", asset: "take", index: 2, stress: true }];
    const coloured = through(closeUp(), [{ op: "captions.set", highlight: "#ff6363" }]);
    expect(stressShows(coloured, through(coloured, stress), stress).ops).toEqual([]);
    const even = closeUp();
    const bigger = [{ op: "captions.set", size: 70 }];
    expect(stressShows(even, through(even, bigger), bigger).ops).toEqual([]);
    const lit = through(even, [...stress, { op: "captions.set", highlight: MARKED }]);
    const off = [{ op: "word.set", asset: "take", index: 2, stress: false }];
    expect(stressShows(lit, through(lit, off), off).ops).toEqual([]);
    const result = through(lit, off);
    expect(result.captions.highlight).toBe(MARKED);
  });
});

/* ── 9. the code's own sentence ───────────────────────────────────────────────────────────────────────────────────────── */

describe("the code's own sentence tells the label and the colour truly (ruling 1e, 2b)", () => {
  /** The edit an answer's ops make, with the code's moves made as the loop makes them, and what the label's move did. */
  const made = (before: Edit, ops: unknown[]) => codeMoves(before, through(before, ops), ops, CLOSE, LIBRARY);
  const cases: [string, unknown[], string][] = [
    ["2: a call-out", [{ op: "mark.add", shot: "s1", mark: callout(3080, 0.2) }], `A call-out "TALL" is added; the title "${HOOK}" now ends where the call-out "TALL" starts.`],
    ["3: a closing title", [{ op: "item.add", item: closing() }], `The title "${HOOK}" now ends where the title "Try it tonight" starts; a title "Try it tonight" is added.`],
    ["4: the label taken out", [{ op: "mark.add", shot: "s1", mark: callout(1160, 0.2, "BAKE") }], `A call-out "BAKE" is added; the title "${HOOK}" is gone.`],
    ["8: a stress", [{ op: "word.set", asset: "take", index: 2, stress: true }], 'The word "bread" now stands out in yellow.'],
  ];
  it.each(cases)("%s", (_, ops, sentence) => {
    const before = closeUp();
    const { edit: after, gave } = made(before, ops);
    expect(saidOf(before, after, gave)).toBe(sentence);
    expect(sayFault(saidOf(before, after, gave), { request: "make it better", ops, was: before.captions, is: after.captions })).toBeNull();
  });

  it("keeps its stress sentence where the colour does not show", () => {
    const pill = through(newEdit(TAKE), [{ op: "captions.set", y: 0.3 }]);
    expect(saidOf(pill, through(pill, [{ op: "word.set", asset: "take", index: 2, stress: true }]))).toBe('The word "bread" is stressed in the captions.');
  });
});

/* ── fix round 1 ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe("fix round 1: the label gives way only to a text that starts after it", () => {
  /** A call-out as an item, from frame `at`, at the label's height. */
  const calloutAt = (at: number, frames = 36): Item => ({ id: "c2", part: "callout", anchor: "start", at, frames, props: { text: "HOT", font: "tiktok", look: "pop", x: 0.5, y: 0.2, size: 110, color: "#ffffff" } });
  /** The creator's own closing line that stays to the end, from frame 180, and no hook. */
  const closingStays: Item = { ...closing(), frames: null };
  const withClosing = (): Edit => through(newEdit(TAKE), [{ op: "captions.set", look: "plain", font: "tiktok", size: 64, y: 0.76, maxWords: 5, highlight: null, weight: 600 }, { op: "item.add", item: closingStays }]);

  it("leaves a staying title alone when the text in its way started before it, or on its frame: the review's finding stands", async () => {
    const before = withClosing();
    expect(startOf(before, "outro")).toBe(180);
    for (const at of [170, 180]) {
      const add = [{ op: "item.add", item: calloutAt(at) }];
      expect(labelGivesWay(through(before, add), CLOSE, LIBRARY).ops).toEqual([]);
    }
    const add = [{ op: "item.add", item: calloutAt(170) }];
    const result = await change(input(before, CLOSE, 'add a call-out "HOT"'), scripted([answer("I added the call-out HOT.", add), answer("There is no room for it while the closing line shows.", [])]));
    expect(result.rounds[0]?.outcome).toBe("review");
    expect(result.rounds[0]?.findings.some((finding) => finding.code === "on-text")).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.edit.items.find((item) => item.id === "outro")?.frames).toBeNull();
  });

  it("keeps LABEL_LEAST frames: a text at frame 51 leaves 45 and ends the label; at frame 50, 44, and takes it out", () => {
    const before = closeUp();
    expect(labelGivesWay(through(before, [{ op: "item.add", item: calloutAt(51) }]), CLOSE, LIBRARY).ops).toEqual([{ op: "item.set", id: "hook", frames: LABEL_LEAST }]);
    expect(labelGivesWay(through(before, [{ op: "item.add", item: calloutAt(50) }]), CLOSE, LIBRARY).ops).toEqual([{ op: "item.remove", id: "hook" }]);
  });
});

describe("fix round 1: the facts and the code's sentence tell only what the move did", () => {
  it("a length the model set, with no text after it: the label's new end in seconds, and no text named", async () => {
    const before = closeUp();
    const ops = [{ op: "item.set", id: "hook", frames: 90 }];
    const result = await change(input(before, CLOSE, "end the title after three seconds"), scripted([answer("The title now ends after three seconds.", ops)]));
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed"]);
    const moved = codeMoves(before, through(before, ops), ops, CLOSE, LIBRARY);
    expect(moved.ops).toEqual([]);
    expect(effectOf(before, result.edit, moved.gave).lines).toContain(`the title "${HOOK}": now ends at 3.0 s; it stayed to the end`);
    expect(saidOf(before, result.edit, moved.gave)).toBe(`The title "${HOOK}" now ends earlier.`);
    expect(result.say).toBe("The title now ends after three seconds.");
  });

  it("a length the model set that already clears a call-out after it: the move does nothing, and the call-out is not named as its cause", async () => {
    const before = closeUp();
    const ops = [{ op: "mark.add", shot: "s1", mark: callout(3080, 0.2) }, { op: "item.set", id: "hook", frames: 60 }];
    const result = await change(input(before, CLOSE, 'end the title after two seconds and add a call-out "TALL"'), scripted([answer("I ended the title after two seconds and added the call-out TALL.", ops)]));
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed"]);
    expect(hookOf(result.edit)?.frames).toBe(60);
    const moved = codeMoves(before, through(before, ops), ops, CLOSE, LIBRARY);
    expect(moved.gave).toEqual([]);
    const facts = effectOf(before, result.edit, moved.gave).lines;
    expect(facts).toContain(`the title "${HOOK}": now ends at 2.0 s; it stayed to the end`);
    expect(facts.join("\n")).not.toContain("ends where");
    expect(saidOf(before, result.edit, moved.gave)).toBe(`A call-out "TALL" is added; the title "${HOOK}" now ends earlier.`);
    expect(result.say).toBe("I ended the title after two seconds and added the call-out TALL.");
  });
});

/* ── the final fix wave ───────────────────────────────────────────────────────────────────────────────────────────────── */

describe("final fix wave (I1): a label that gave way keeps giving way to that text", () => {
  /** The close-up's words with a second's pause after w7: 9 s, so `pauses.tighten` shortens the film before a closing line. */
  const GAPPED: Asset = { ...TAKE, ms: 9000, words: WORDS.map((word, i) => (i < 8 ? { ...word } : { ...word, startMs: word.startMs + 1000, endMs: word.endMs + 1000 })) };
  const GAP: Analyses = {
    take: {
      language: "en", loudness: null,
      pauses: [{ startMs: 0, endMs: 200, cutMs: 100 }, { startMs: 4000, endMs: 5000, cutMs: 4500 }, { startMs: 8880, endMs: 9000, cutMs: 8940 }],
      faces: Array.from({ length: 45 }, (_, i) => ({ ms: i * 200, face: { x: 0.2, y: 0.32, w: 0.58, h: 0.42 }, mouth: { x: 0.37, y: 0.62, w: 0.22, h: 0.06 } })),
    },
  };
  const gapped = (frames: number | null): Edit =>
    through(newEdit(GAPPED), [{ op: "captions.set", look: "plain", font: "tiktok", size: 64, y: 0.76, maxWords: 5, highlight: null, weight: 600 }, { op: "item.add", item: label(0.2, frames) }]);
  const tighter = [{ op: "pauses.tighten", ms: 120 }];

  it("ends the hook again, LABEL_GAP before the closing line's new start, when a cut moves the closing line earlier", async () => {
    const start = gapped(null);
    expect(errors(start, GAP)).toEqual([]);
    const one = await change(input(start, GAP, "add a closing line over the last two seconds"), scripted([answer("I added a closing line over the last two seconds.", [{ op: "item.add", item: closing() }])]));
    expect(hookOf(one.edit)?.frames).toBe(startOf(one.edit, "outro") - LABEL_GAP);
    const two = await change(input(one.edit, GAP, "make it tighter"), scripted([answer("I tightened the pauses.", tighter)]));
    expect(two.rounds.map((round) => round.outcome)).toEqual(["changed"]);
    expect(startOf(two.edit, "outro")).toBeLessThan(startOf(one.edit, "outro") - LABEL_GAP);
    expect(hookOf(two.edit)?.frames).toBe(startOf(two.edit, "outro") - LABEL_GAP);
    expect(errors(two.edit, GAP)).toEqual([]);
    expect(two.say).toBe(`I tightened the pauses, so the title "${HOOK}" now ends where the title "Try it tonight" starts.`);
  });

  it("leaves a title with a set length that never gave way to the review", async () => {
    // Its end 10 frames before the closing line's start, not LABEL_GAP: it did not give way.
    const one = through(gapped(200), [{ op: "item.add", item: closing() }]);
    expect(startOf(one, "outro") - 200).toBe(10);
    expect(errors(one, GAP)).toEqual([]);
    const two = await change(input(one, GAP, "make it tighter"), scripted([answer("I tightened the pauses.", tighter), answer("The title and the closing line would show at once.", [])]));
    expect(two.rounds[0]?.outcome).toBe("review");
    expect(two.rounds[0]?.findings.some((finding) => finding.code === "two-titles")).toBe(true);
    expect(hookOf(two.edit)?.frames).toBe(200);
  });
});

describe("final fix wave (I2): the room offers what the move and the review accept", () => {
  const calloutAt = (at: number): Item => ({ id: "c3", part: "callout", anchor: "start", at, frames: 36, props: { text: "HOT", font: "tiktok", look: "pop", x: 0.5, y: 0.2, size: 110, color: "#ffffff" } });
  const closingStays: Item = { ...closing(), frames: null };
  /** The heights of one line the room offers over the stretch that holds frame `from` (stretches alike are one line). */
  const oneLineFrom = (room: string, from: number): number[][] => {
    const line = room.split("\n").find((each) => {
      const [, a, b] = /^film=\[(\d+),(\d+)\)f/.exec(each) ?? [];
      return a !== undefined && b !== undefined && Number(a) <= from && from < Number(b);
    });
    if (!line) throw new Error(`no stretch from ${from}:\n${room}`);
    const one = /one line (none|y=[^;]*)/.exec(line)?.[1] ?? "none";
    return [...one.matchAll(/\[(\d\.\d\d),(\d\.\d\d)\]/g)].map((match) => [Number(match[1]), Number(match[2])]);
  };
  const holds = (ranges: number[][], y: number): boolean => ranges.some(([a = 1, b = 0]) => a <= y && y <= b);

  it("counts a closing line that stays over the stretch from its first frame, and not before it; the loop takes the room's offer", async () => {
    const before = through(newEdit(TAKE), [{ op: "captions.set", look: "plain", font: "tiktok", size: 64, y: 0.76, maxWords: 5, highlight: null, weight: 600 }, { op: "item.add", item: closingStays }]);
    expect(startOf(before, "outro")).toBe(180);
    const room = contextOf(before, CLOSE, []).room;
    // Its first frame is a stretch's edge: over the stretch from it the band it holds is not offered; over the one before, it is.
    expect(holds(oneLineFrom(room, 180), 0.2)).toBe(false);
    expect(holds(oneLineFrom(room, 120), 0.2)).toBe(true);
    // A call-out from 10 frames before it is refused, and roomFor does not offer the band it was refused in.
    const early = through(before, [{ op: "item.add", item: calloutAt(170) }]);
    const onText = review(early, CLOSE).find((finding) => finding.code === "on-text" && finding.where.item === "c3");
    if (!onText) throw new Error("the call-out does not touch the closing line");
    const hint = roomFor(early, CLOSE, onText, before) ?? "";
    expect(holds([...hint.matchAll(/\[(\d\.\d\d),(\d\.\d\d)\]/g)].map((match) => [Number(match[1]), Number(match[2])]), 0.2)).toBe(false);
    // Through the loop: refused there, then taken where the room offers it (over the stretch before the closing line).
    const result = await change(input(before, CLOSE, 'add a call-out "HOT"'), scripted([
      answer("I added the call-out HOT.", [{ op: "item.add", item: calloutAt(170) }]),
      answer("I added the call-out HOT a moment earlier.", [{ op: "item.add", item: calloutAt(130) }]),
    ]));
    expect(result.rounds.map((round) => round.outcome)).toEqual(["review", "changed"]);
    expect(errors(result.edit, CLOSE)).toEqual([]);
    expect(result.edit.items.find((item) => item.id === "outro")?.frames).toBeNull();
  });
});
