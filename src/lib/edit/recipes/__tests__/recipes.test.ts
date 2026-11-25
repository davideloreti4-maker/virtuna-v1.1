import { describe, expect, it } from "vitest";
import type { Analyses, FaceSample, Pause, ShareBox, TakeAnalysis } from "../../analysis";
import { layout } from "../../derive";
import { DEFAULT_CAPTIONS, NO_LOOK, STAGE, newShot, type Asset, type Edit, type Shot, type Word } from "../../doc";
import { applyOps, type Op } from "../../ops";
import { review, type Finding } from "../../review";
import { faceOnStage } from "../../stage";
import { CAPTION_YS, captionSizes, levelled, levelVoice, placeCaptions, punched, punchIns, tighten, tightened, wordCounts } from "..";
import { captionPages } from "../../../../edit/film/layout";
import { pagesFor } from "../../../../edit/film/pages";
import { runWords } from "../../derive";
import { measure } from "../../measure";
import { countsTried } from "../captions";
import { matchOf } from "../../style/match";
import { DEFAULT_STYLE, type StyleProfile } from "../../style/profile";

/* ── made-up takes ─────────────────────────────────────────────────────────────────────────────── */

const TEXTS = ["One", "two", "three", "four", "five", "six", "seven", "eight"];

/** Words filling each stretch, back to back, at most 400 ms each. */
function wordsIn(stretches: [number, number][]): Word[] {
  const words: Word[] = [];
  for (const [from, to] of stretches) {
    const n = Math.max(1, Math.ceil((to - from) / 400));
    for (let i = 0; i < n; i++) {
      words.push({ text: TEXTS[words.length % TEXTS.length]!, startMs: Math.round(from + ((to - from) * i) / n), endMs: Math.round(from + ((to - from) * (i + 1)) / n) });
    }
  }
  return words;
}
/** The stretches of a take between its pauses. */
function between(ms: number, pauses: Pause[]): [number, number][] {
  const out: [number, number][] = [];
  let at = 0;
  for (const pause of pauses) {
    if (pause.startMs > at) out.push([at, pause.startMs]);
    at = pause.endMs;
  }
  if (at < ms) out.push([at, ms]);
  return out;
}
const pause = (startMs: number, endMs: number, cutMs: number): Pause => ({ startMs, endMs, cutMs });

const take = (ms: number, words: Word[], over: Partial<Extract<Asset, { kind: "video" }>> = {}): Asset => ({
  id: "take", kind: "video", origin: "filmed", at: { bucket: "edit-media", path: "u1/take.mp4" }, ms, w: 720, h: 1280, sound: true, words, ...over,
});
const analysis = (over: Partial<TakeAnalysis> = {}): TakeAnalysis => ({ language: "en", pauses: [], faces: [], loudness: null, ...over });
function editOf(asset: Asset, shots: Shot[] = [newShot({ id: "s1", asset: asset.id, endMs: asset.kind === "video" ? asset.ms : 3000 })], captions: Partial<Edit["captions"]> = {}): Edit {
  return { v: 1, kit: "1", stage: { ...STAGE }, assets: [asset], shots, items: [], captions: { ...DEFAULT_CAPTIONS, y: 0.3, ...captions }, look: structuredClone(NO_LOOK), cover: null };
}
const through = (edit: Edit, ops: Op[]): Edit => {
  if (ops.length === 0) return edit;
  const made = applyOps(edit, ops, edit.assets);
  if (!made.ok) throw new Error(made.problems.map((problem) => problem.message).join("; "));
  return made.edit;
};
const stretches = (edit: Edit) => edit.shots.map((shot) => [shot.startMs, shot.endMs]);
const errors = (findings: Finding[]) => findings.filter((finding) => finding.severity === "error");
const cutsOutside = (edit: Edit, analyses: Analyses) => review(edit, analyses).filter((finding) => finding.code === "cut-outside-pause");

/** Five face samples a second over `ms`, each the face `at` its moment gives. */
const samples = (ms: number, at: (t: number) => { face: ShareBox | null; mouth: ShareBox | null }): FaceSample[] =>
  Array.from({ length: Math.ceil(ms / 200) }, (_, i) => ({ ms: i * 200, ...at(i * 200) }));

/** How much of a stretch [from, to) the edit's shots of the take show. */
const shownOf = (edit: Edit, from: number, to: number) =>
  edit.shots.reduce((sum, shot) => sum + (shot.asset === "take" ? Math.max(0, Math.min(shot.endMs, to) - Math.max(shot.startMs, from)) : 0), 0);

/** Pauses with only wordless gaps of at most 400 ms between them, as tighten joins them. */
function silenceGroups(pauses: Pause[], words: Word[]): Pause[][] {
  const groups: Pause[][] = [];
  for (const each of pauses) {
    const group = groups[groups.length - 1];
    const before = group?.[group.length - 1];
    if (group && before && each.startMs - before.endMs <= 400 && !words.some((word) => word.startMs < each.startMs && word.endMs > before.endMs)) group.push(each);
    else groups.push([each]);
  }
  return groups;
}

/** A small PRNG (mulberry32) with a fixed seed, so the property test is the same every run. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── tighten ───────────────────────────────────────────────────────────────────────────────────── */

describe("tighten: pauses shortened inside the measured silence", () => {
  it("cuts a 10 s shot's two long pauses down to 200 ms, centred on each cut, clamped inside the pause, and leaves the short one", () => {
    const pauses = [pause(1000, 1600, 1300), pause(4000, 4150, 4075), pause(7000, 8000, 7900)];
    const edit = editOf(take(10_000, wordsIn(between(10_000, pauses))));
    const given = { take: analysis({ pauses }) };
    const ops = tighten(edit, given, { pauseMs: 200 });
    // The first removes 400 ms centred on 1300: 1100 to 1500. The second (150 ms) is under 200 and left alone.
    // The third removes 800 ms centred on 7900, clamped inside the pause: 7199 to 7999, not 7200 to 8000. A pause
    // is half-open in review ([startMs, endMs)): 8000 is where the next word starts, never a cut point (X54), so
    // the stretch ends a millisecond before it (ruling A1).
    expect(ops).toEqual([
      { op: "shot.split", id: "s1", atMs: 1100, newId: "s1-t1" },
      { op: "shot.trim", id: "s1-t1", startMs: 1500 },
      { op: "shot.split", id: "s1-t1", atMs: 7199, newId: "s1-t2" },
      { op: "shot.trim", id: "s1-t2", startMs: 7999 },
    ]);
    const cut = through(edit, ops);
    expect(stretches(cut)).toEqual([[0, 1100], [1500, 7199], [7999, 10_000]]);
    expect(cutsOutside(cut, given)).toEqual([]);
    // Run again on its own output, it changes nothing: each cut keeps 200 ms across it (fix round 1, I1).
    expect(tighten(cut, given, { pauseMs: 200 })).toEqual([]);
  });

  it("judges both sides of a cut in one silence together: it keeps pauseMs across the cut in all, never half on each side (fix round 1)", () => {
    // A creator's cut in the pause 1000 to 1600: 50 ms kept before it, 500 after, 550 in all. The 400 ms that go are
    // placed as a removal of the pause would be (1100 to 1500), held to contain the stretch already cut: 1050 to 1450.
    const pauses = [pause(1000, 1600, 1300)];
    const asset = take(3000, wordsIn(between(3000, pauses)));
    const given = { take: analysis({ pauses }) };
    const cutAt = (endMs: number, startMs: number) => editOf(asset, [newShot({ id: "s1", asset: "take", endMs }), newShot({ id: "s2", asset: "take", startMs, endMs: 3000 })]);
    expect(tighten(cutAt(1050, 1100), given, { pauseMs: 200 })).toEqual([{ op: "shot.trim", id: "s2", startMs: 1450 }]);
    expect(tighten(cutAt(1050, 1450), given, { pauseMs: 200 })).toEqual([]); // 200 kept across it: nothing to do
    expect(tighten(cutAt(1050, 1500), given, { pauseMs: 200 })).toEqual([]); // 150: less than pauseMs is never made longer
  });

  it("keeps each shot at a cut three frames long when it places the cut's sides (fix round 2, NB2)", () => {
    // Pause 1471 to 2502 at speed 1.5 (150 ms a piece), pauseMs 265: 766 ms go. The removal would start at the pause's
    // start (1471), leaving the shot before it 131 ms, 2 frames; held to 150 ms, it goes 1490 to 2256, keeping 265.
    const pauses = [pause(1471, 2502, 1500)];
    const asset = take(2700, wordsIn([[1340, 1471], [2502, 2700]]));
    const edit = editOf(asset, [{ ...newShot({ id: "s1", asset: "take", startMs: 1340, endMs: 1600 }), speed: 1.5 }, { ...newShot({ id: "s2", asset: "take", startMs: 1600, endMs: 2700 }), speed: 1.5 }]);
    const given = { take: analysis({ pauses }) };
    const ops = tighten(edit, given, { pauseMs: 265 });
    expect(ops).toEqual([{ op: "shot.trim", id: "s1", endMs: 1490 }, { op: "shot.trim", id: "s2", startMs: 2256 }]);
    const cut = through(edit, ops);
    expect(layout(cut).shots.map((shot) => shot.frames)).toEqual([3, 9]);
    expect(cutsOutside(cut, given)).toEqual([]);
    expect(tighten(cut, given, { pauseMs: 265 })).toEqual([]);
  });

  it("never turns a split at a pause's edge into a cut outside a pause (fix round 2, O1)", () => {
    const pauses = [pause(1000, 1600, 1300)];
    const asset = take(3000, wordsIn(between(3000, pauses)));
    const given = { take: analysis({ pauses }) };
    const splitAt = (ms: number) => editOf(asset, [newShot({ id: "s1", asset: "take", endMs: ms }), newShot({ id: "s2", asset: "take", startMs: ms, endMs: 3000 })]);
    // At the pause's end, where the next word starts: no removal can hold the split without starting s2 earlier, so the
    // join stays a join; trimming s1 alone would leave s2 starting on the word.
    expect(tighten(splitAt(1600), given, { pauseMs: 200 })).toEqual([]);
    // At the pause's start, where the word before ends: s1 stays, s2 starts 200 ms of silence before its word.
    const ops = tighten(splitAt(1000), given, { pauseMs: 200 });
    expect(ops).toEqual([{ op: "shot.trim", id: "s2", startMs: 1400 }]);
    expect(cutsOutside(through(splitAt(1000), ops), given)).toEqual([]);
  });
});

describe("tighten: one budget per silence across its joins and cuts (fix round 3, N1)", () => {
  /** A take with one pause and speech either side, cut into shots at `edges` (a pair [end, start] is a cut, one number a split). */
  const silenceIn = (pause: Pause, ms: number, edges: ([number, number] | number)[]) => {
    const asset = take(ms, wordsIn(between(ms, [pause])));
    const sides = edges.map((edge) => (typeof edge === "number" ? [edge, edge] : edge));
    const shots = [...sides.map(([, start], k) => newShot({ id: `s${k + 2}`, asset: "take", startMs: start!, endMs: sides[k + 1]?.[0] ?? ms }))];
    return { edit: editOf(asset, [newShot({ id: "s1", asset: "take", endMs: sides[0]![0]! }), ...shots]), given: { take: analysis({ pauses: [pause] }) } };
  };
  const check = (pause: Pause, ms: number, edges: ([number, number] | number)[], pauseMs: number, kept: number) => {
    const { edit, given } = silenceIn(pause, ms, edges);
    const done = tightened(edit, given, { pauseMs });
    const cut = through(edit, done.ops);
    expect(shownOf(cut, pause.startMs, pause.endMs)).toBe(kept);
    expect(cutsOutside(cut, given)).toEqual([]);
    expect(layout(cut).shots.every((shot) => shot.frames >= 3)).toBe(true);
    expect(tightened(cut, given, { pauseMs }).ops).toEqual([]);
    return done;
  };

  it("splits at 1000 and 2100 in the pause 1000 to 2200, pauseMs 200: one removal, keeping 200 ms", () => {
    const done = check(pause(1000, 2200, 1600), 3200, [1000, 2100], 200, 200);
    expect(done.ops).toHaveLength(1);
  });

  it("splits at 1600 and 1700 in the pause 1000 to 2000, pauseMs 400: keeps 400 ms, not 101", () => {
    check(pause(1000, 2000, 1500), 3000, [1600, 1700], 400, 400);
  });

  it("splits at 1300 and 1400 in the pause 1000 to 2000, pauseMs 300: keeps 300 ms, spread over both", () => {
    check(pause(1000, 2000, 1500), 3000, [1300, 1400], 300, 300);
  });

  it("cuts 1200 to 1500 and 1600 to 1800 in the pause 1000 to 2000, pauseMs 200: keeps 200 ms", () => {
    check(pause(1000, 2000, 1500), 3000, [[1200, 1500], [1600, 1800]], 200, 200);
  });

  it("trims the film's end only as far as three frames allow, past the last word, rather than not at all (fix round 3, O3)", () => {
    // At speed 2 a piece needs 200 ms. The take's one word is 950 to 1000, and the film starts on it. 100 ms after the
    // word would leave 150 ms, so the end goes to 950 + 200 = 1150: after the word, and three frames.
    const pauses = [pause(1000, 3000, 2000)];
    const edit = editOf(take(3000, [{ text: "Hi", startMs: 950, endMs: 1000 }]), [{ ...newShot({ id: "s1", asset: "take", startMs: 950, endMs: 3000 }), speed: 2 }]);
    const given = { take: analysis({ pauses }) };
    const ops = tighten(edit, given, { pauseMs: 200 });
    expect(ops).toEqual([{ op: "shot.trim", id: "s1", endMs: 1150 }]);
    const cut = through(edit, ops);
    expect(layout(cut).shots[0]!.frames).toBe(3);
    expect(cutsOutside(cut, given)).toEqual([]);
  });

  it("trims the take's head and tail pauses to at most half of pauseMs, next to the speech", () => {
    const pauses = [pause(0, 900, 450), pause(9000, 10_000, 9500)];
    const edit = editOf(take(10_000, wordsIn(between(10_000, pauses))));
    const given = { take: analysis({ pauses }) };
    const ops = tighten(edit, given, { pauseMs: 200 });
    expect(ops).toEqual([{ op: "shot.trim", id: "s1", startMs: 800, endMs: 9100 }]);
    expect(cutsOutside(through(edit, ops), given)).toEqual([]);
  });

  it("ends the film half of pauseMs after the take's last word and starts it half before the first, pause or not (round 0, ruling 2)", () => {
    // Before the first word (600) and after the last (8000), 300 ms of sound no pause covers (a breath, a knock),
    // as on the owner's take. The film's own ends cannot cut through speech there, so they go 100 ms from the words.
    const pauses = [pause(0, 300, 150), pause(8400, 10_000, 9000)];
    const edit = editOf(take(10_000, wordsIn([[600, 8000]])));
    const given = { take: analysis({ pauses }) };
    const ops = tighten(edit, given, { pauseMs: 200 });
    expect(ops).toEqual([{ op: "shot.trim", id: "s1", startMs: 500, endMs: 8100 }]);
    expect(cutsOutside(through(edit, ops), given)).toEqual([]);
  });

  it("keeps the head or tail pause's own rule where it comes later at the start or earlier at the end", () => {
    // Head: a pause, an 80 ms click, and a 70 ms pause up to the first word (600): the cut goes in that last pause,
    // at 530, later than the word's 500. Tail: a 60 ms pause from the last word (8100), a click, a long pause: the cut
    // goes in that first pause, at 8159, earlier than the word's 8200. Neither keeps the click.
    const pauses = [pause(0, 450, 200), pause(530, 600, 560), pause(8100, 8160, 8130), pause(8200, 10_000, 9000)];
    const edit = editOf(take(10_000, wordsIn([[600, 8100]])));
    const given = { take: analysis({ pauses }) };
    const ops = tighten(edit, given, { pauseMs: 200 });
    expect(ops).toEqual([{ op: "shot.trim", id: "s1", startMs: 530, endMs: 8159 }]);
    expect(cutsOutside(through(edit, ops), given)).toEqual([]);
  });

  it("moves a film edge to 60 ms from the word when a level in the kept stretch is more than 12 LU above the speech's median, and says so", () => {
    const pauses = [pause(0, 600, 300), pause(9000, 10_000, 9500)];
    const edit = editOf(take(10_000, wordsIn([[600, 9000]])));
    // Speech at -25 LUFS; a bang at -5 heard by the levels at 500 ms (300 to 700) and 9000 ms (8800 to 9200).
    const levels = Array.from({ length: 21 }, (_, i) => ({ ms: i * 500, lufs: i * 500 === 500 || i * 500 === 9000 ? -5 : -25 }));
    const given = { take: analysis({ pauses, loudness: { lufs: -24, truePeak: -1, levels } }) };
    const done = tightened(edit, given, { pauseMs: 200 });
    expect(done.ops).toEqual([{ op: "shot.trim", id: "s1", startMs: 540, endMs: 9060 }]);
    expect(done.transients).toEqual([
      { shot: "s1", side: "start", levelMs: 500, lufs: -5, edgeMs: 540 },
      { shot: "s1", side: "end", levelMs: 9000, lufs: -5, edgeMs: 9060 },
    ]);
    // The word's own level does not count: the bang at 9000 heard inside the last word, which ends at 9150 (fix round 1, M1).
    const late = editOf(take(10_000, wordsIn([[600, 9150]])));
    const inWord = { take: analysis({ pauses: [pause(0, 600, 300), pause(9150, 10_000, 9500)], loudness: { lufs: -24, truePeak: -1, levels: levels.map((level) => ({ ...level, lufs: level.ms === 9000 ? -5 : -25 })) } }) };
    expect(tightened(late, inWord, { pauseMs: 200 })).toMatchObject({ ops: [{ op: "shot.trim", id: "s1", startMs: 500, endMs: 9250 }], transients: [] });
    // At -15, 10 LU above the speech, the edges stay 100 ms from the words.
    const mild = { take: analysis({ pauses, loudness: { lufs: -24, truePeak: -1, levels: levels.map((level) => ({ ...level, lufs: level.lufs === -5 ? -15 : -25 })) } }) };
    expect(tightened(edit, mild, { pauseMs: 200 }).ops).toEqual([{ op: "shot.trim", id: "s1", startMs: 500, endMs: 9100 }]);
  });

  it("applies the words' rule only at the film's own ends; a cut between shots stays in its pause", () => {
    // Two shots of one take; the first ends and the second starts in a pause after a breath, not next to a word.
    const pauses = [pause(3300, 3800, 3550)];
    const asset = take(6000, wordsIn([[0, 3000], [3800, 6000]]));
    const edit = editOf(asset, [newShot({ id: "s1", asset: "take", endMs: 3550 }), newShot({ id: "s2", asset: "take", startMs: 3550, endMs: 6000 })]);
    expect(tighten(edit, { take: analysis({ pauses }) }, { pauseMs: 200 })).toEqual([{ op: "shot.trim", id: "s1", endMs: 3400 }, { op: "shot.trim", id: "s2", startMs: 3700 }]);
  });

  it("trims a head or tail with more than half of pauseMs in the shot, and leaves one with half or less", () => {
    const pauses = [pause(0, 150, 75), pause(9900, 10_000, 9950)];
    const edit = editOf(take(10_000, wordsIn(between(10_000, pauses))));
    expect(tighten(edit, { take: analysis({ pauses }) }, { pauseMs: 200 })).toEqual([{ op: "shot.trim", id: "s1", startMs: 50 }]);
  });

  it("trims both sides of a cut a creator made in a pause, so the cut keeps at most pauseMs of it", () => {
    const pauses = [pause(2000, 2600, 2300)];
    const asset = take(5000, wordsIn(between(5000, pauses)));
    const edit = editOf(asset, [newShot({ id: "s1", asset: "take", endMs: 2300 }), newShot({ id: "s2", asset: "take", startMs: 2300, endMs: 5000 })]);
    const given = { take: analysis({ pauses }) };
    const ops = tighten(edit, given, { pauseMs: 200 });
    expect(ops).toEqual([{ op: "shot.trim", id: "s1", endMs: 2100 }, { op: "shot.trim", id: "s2", startMs: 2500 }]);
    expect(cutsOutside(through(edit, ops), given)).toEqual([]);
  });

  it("names new shots <shot id>-t<n>, skipping ids the edit already has, and keeps them valid ids", () => {
    const pauses = [pause(1000, 1600, 1300)];
    const asset = take(3000, wordsIn(between(3000, pauses)));
    const taken = { ...editOf(asset), items: [{ id: "s1-t1", part: "progress", anchor: "start", at: 0, frames: null, props: { edge: "top", color: "#ffffff" } }] } satisfies Edit;
    expect(tighten(taken, { take: analysis({ pauses }) }, { pauseMs: 200 }).filter((op) => op.op === "shot.split").map((op) => op.newId)).toEqual(["s1-t2"]);
    const long = "x".repeat(40);
    const named = editOf(asset, [newShot({ id: long, asset: "take", endMs: 3000 })]);
    const [split] = tighten(named, { take: analysis({ pauses }) }, { pauseMs: 200 });
    expect(split).toEqual({ op: "shot.split", id: long, atMs: 1100, newId: `${"x".repeat(37)}-t1` });
    expect(applyOps(named, tighten(named, { take: analysis({ pauses }) }, { pauseMs: 200 }), [asset]).ok).toBe(true);
  });

  it("leaves a take with no words, no analysis or no pauses alone, and refuses a pauseMs outside 120 to 400", () => {
    const pauses = [pause(1000, 1600, 1300)];
    const asset = take(3000, wordsIn(between(3000, pauses)));
    expect(tighten(editOf(take(3000, [])), { take: analysis({ pauses }) }, { pauseMs: 200 })).toEqual([]);
    expect(tighten(editOf(asset), {}, { pauseMs: 200 })).toEqual([]);
    expect(tighten(editOf(asset), { take: analysis() }, { pauseMs: 200 })).toEqual([]);
    expect(() => tighten(editOf(asset), { take: analysis({ pauses }) }, { pauseMs: 119 })).toThrow(RangeError);
    expect(() => tighten(editOf(asset), { take: analysis({ pauses }) }, { pauseMs: 401 })).toThrow(RangeError);
  });
});

describe("tighten: pauses with only a wordless gap of 400 ms or less between them are one silence (round 0, ruling 1)", () => {
  const hasWords = (edit: Edit, shot: Shot) => {
    const asset = edit.assets.find((each) => each.id === shot.asset);
    return asset?.kind === "video" && (asset.words ?? []).some((word) => shot.startMs <= (word.startMs + word.endMs) / 2 && (word.startMs + word.endMs) / 2 < shot.endMs);
  };

  it("cuts the owner's shape (a pause, a 48 ms click, a pause) with one removal, leaving no shot without words", () => {
    const pauses = [pause(3552, 3846, 3712), pause(3894, 4226, 4025)];
    const edit = editOf(take(6000, wordsIn([[0, 3552], [4226, 6000]])));
    const given = { take: analysis({ pauses }) };
    const done = tightened(edit, given, { pauseMs: 200 });
    // One silence from 3552 to 4226 (674 ms): 474 ms go, 100 kept in each outer pause: 3652 to 4126, the click with them.
    expect(done.ops).toEqual([{ op: "shot.split", id: "s1", atMs: 3652, newId: "s1-t1" }, { op: "shot.trim", id: "s1-t1", startMs: 4126 }]);
    expect(done.joined).toBe(1);
    const cut = through(edit, done.ops);
    expect(cut.shots.every((shot) => hasWords(cut, shot))).toBe(true);
    expect(cutsOutside(cut, given)).toEqual([]);
  });

  it("keeps pauses apart when the gap between them is longer than 400 ms or holds a word", () => {
    const split = (gap: [number, number], words: Word[]) => {
      const pauses = [pause(1000, 1600, 1300), pause(gap[1], gap[1] + 600, gap[1] + 300)];
      const asset = take(5000, [...wordsIn([[0, 1000]]), ...words, ...wordsIn([[gap[1] + 600, 5000]])]);
      return tightened(editOf(asset), { take: analysis({ pauses }) }, { pauseMs: 200 });
    };
    const long = split([1600, 2050], []); // 450 ms of breath: two removals
    expect(long.ops.filter((op) => op.op === "shot.split")).toHaveLength(2);
    expect(long.joined).toBe(0);
    const worded = split([1600, 1700], [{ text: "a", startMs: 1600, endMs: 1700 }]); // 100 ms, but a word: two removals
    expect(worded.ops.filter((op) => op.op === "shot.split")).toHaveLength(2);
  });

  it("takes the removal nearest pauseMs when its outer pauses cannot hold it, never leaving the silence whole (fix round 2, NB1)", () => {
    // 130 + 48 + 130 ms at pauseMs 300: keeping 300 would reach into the click, so the click alone goes, 1129 to 1178,
    // and 259 ms are kept: the nearest to 300 a removal from the first pause into the last can keep.
    const pauses = [pause(1000, 1130, 1065), pause(1178, 1308, 1243)];
    const edit = editOf(take(3000, wordsIn([[0, 1000], [1308, 3000]])));
    const done = tightened(edit, { take: analysis({ pauses }) }, { pauseMs: 300 });
    expect(done.ops).toEqual([{ op: "shot.split", id: "s1", atMs: 1129, newId: "s1-t1" }, { op: "shot.trim", id: "s1-t1", startMs: 1178 }]);
    expect(tightened(through(edit, done.ops), { take: analysis({ pauses }) }, { pauseMs: 300 }).ops).toEqual([]);
  });

  it("cuts a split at a word's end inside a joined silence with a short last pause, keeping pauseMs (fix rounds 2 and 3)", () => {
    // The creator split at 1000, where the word ends and a 900 ms pause starts; a click, then a 100 ms pause to the next
    // word (2050). Round 2 cut it at 1000 to 1950, keeping 100 ms, since a removal had to end in the last pause. With one
    // budget per silence (fix round 3, N1), never spent past: 850 ms go inside the first pause, 1000 to 1850, keeping
    // exactly 200 ms (50 of the first pause, the click, the last pause), rather than leaving all 1050.
    const pauses = [pause(1000, 1900, 1450), pause(1950, 2050, 2000)];
    const asset = take(4000, wordsIn([[0, 1000], [2050, 4000]]));
    const edit = editOf(asset, [newShot({ id: "s1", asset: "take", endMs: 1000 }), newShot({ id: "s2", asset: "take", startMs: 1000, endMs: 4000 })]);
    const given = { take: analysis({ pauses }) };
    const ops = tighten(edit, given, { pauseMs: 200 });
    expect(ops).toEqual([{ op: "shot.trim", id: "s2", startMs: 1850 }]);
    const cut = through(edit, ops);
    expect(cutsOutside(cut, given)).toEqual([]);
    expect(tighten(cut, given, { pauseMs: 200 })).toEqual([]);
  });
});

describe("tighten: a fractional pauseMs, rounded once (fix round 4, B1)", () => {
  it("keeps round(200.5) = 201 ms of a joined silence inside a shot, and a second run, now at a cut, changes nothing", () => {
    // A pause, a 100 ms click, a pause: one silence, 1000 to 2000. The first run keeps 201 ms (1000 to 1100 and 1899 to
    // 2000). Rounded in two places, the second run read the cut's budget as round(201 − 200.5) = 1 and took 1 ms more.
    const pauses = [pause(1000, 1500, 1250), pause(1600, 2000, 1800)];
    const edit = editOf(take(3000, wordsIn([[0, 1000], [2000, 3000]])));
    const given = { take: analysis({ pauses }) };
    const ops = tighten(edit, given, { pauseMs: 200.5 });
    expect(ops).toEqual([{ op: "shot.split", id: "s1", atMs: 1100, newId: "s1-t1" }, { op: "shot.trim", id: "s1-t1", startMs: 1899 }]);
    const cut = through(edit, ops);
    expect(shownOf(cut, 1000, 2000)).toBe(201);
    expect(cutsOutside(cut, given)).toEqual([]);
    expect(tighten(cut, given, { pauseMs: 200.5 })).toEqual([]);
  });
});

describe("tighten: a removal that would leave a shot under three frames (ruling A2)", () => {
  it("first slides the removal inside its pause, away from the short piece", () => {
    // A 50 ms word between two long pauses whose cuts lie next to it. Centred, the second removal (1650 to 2100)
    // would leave the word alone in a 50 ms shot, 2 frames; slid right, the piece is 1599 to 1699, 3 frames.
    const pauses = [pause(1000, 1600, 1590), pause(1650, 2300, 1660)];
    const asset = take(3000, [...wordsIn([[0, 1000]]), { text: "a", startMs: 1600, endMs: 1650 }, ...wordsIn([[2300, 3000]])]);
    const edit = editOf(asset);
    const done = tightened(edit, { take: analysis({ pauses }) }, { pauseMs: 200 });
    expect(done.ops).toEqual([
      { op: "shot.split", id: "s1", atMs: 1199, newId: "s1-t1" },
      { op: "shot.trim", id: "s1-t1", startMs: 1599 },
      { op: "shot.split", id: "s1-t1", atMs: 1699, newId: "s1-t2" },
      { op: "shot.trim", id: "s1-t2", startMs: 2149 },
    ]);
    expect([done.slid, done.shrunk, done.leftAlone]).toEqual([1, 0, 0]);
    const cut = through(edit, done.ops);
    expect(layout(cut).shots.map((shot) => shot.frames).every((frames) => frames >= 3)).toBe(true);
  });

  it("then shrinks it, when sliding cannot keep both pieces three frames long", () => {
    // A shot 10 ms into the speech on each side of one pause: 990 to 1310, the pause 1000 to 1300. Each piece needs
    // 100 ms, so at most 1090 to 1210 can go: 120 ms, not the 180 the rule asks.
    const asset = take(2000, [...wordsIn([[500, 1000]]), ...wordsIn([[1300, 1800]])]);
    const edit = editOf(asset, [newShot({ id: "s1", asset: "take", startMs: 990, endMs: 1310 })]);
    const done = tightened(edit, { take: analysis({ pauses: [pause(1000, 1300, 1150)] }) }, { pauseMs: 120 });
    expect(done.ops).toEqual([{ op: "shot.split", id: "s1", atMs: 1090, newId: "s1-t1" }, { op: "shot.trim", id: "s1-t1", startMs: 1210 }]);
    expect([done.slid, done.shrunk, done.leftAlone]).toEqual([0, 1, 0]);
    expect(layout(through(edit, done.ops)).shots.map((shot) => shot.frames)).toEqual([3, 3]);
  });

  it("then leaves the pause alone, when nothing can go", () => {
    const asset = take(2000, [...wordsIn([[500, 1000]]), ...wordsIn([[1150, 1650]])]);
    const edit = editOf(asset, [newShot({ id: "s1", asset: "take", startMs: 990, endMs: 1160 })]);
    const done = tightened(edit, { take: analysis({ pauses: [pause(1000, 1150, 1075)] }) }, { pauseMs: 120 });
    expect(done).toMatchObject({ ops: [], slid: 0, shrunk: 0, leftAlone: 1 });
  });
});

describe("tighten: a run holding a shot under three frames' worth of milliseconds", () => {
  it("is left alone, all of it: that shot has its three frames only from where its run starts", () => {
    // At speed 2 a piece needs 200 ms. The creator's last shot, 2830 to 2967 (137 ms), fills 3 frames only as part of
    // the run from 0; on its own it would fill 2. Cutting the pause 1000 to 1600 out of the run would break it, so it is
    // not done, and counted. (The cut at 2830 keeps 200 ms of its pause across it: nothing to trim there.)
    const pauses = [pause(1000, 1600, 1300), pause(2700, 2900, 2830)];
    const asset = take(2967, wordsIn([[0, 1000], [1600, 2700], [2900, 2967]]));
    const edit = editOf(asset, [{ ...newShot({ id: "s1", asset: "take", endMs: 2830 }), speed: 2 }, { ...newShot({ id: "c1", asset: "take", startMs: 2830, endMs: 2967 }), speed: 2 }]);
    expect(layout(through(edit, [{ op: "captions.set", y: 0.3 }])).shots.map((shot) => shot.frames)).toEqual([42, 3]);
    expect(tightened(edit, { take: analysis({ pauses }) }, { pauseMs: 200 })).toMatchObject({ ops: [], slid: 0, shrunk: 0, leftAlone: 1, runsLeftAlone: 1 });
  });
});

describe("tighten: the property test's take 63, kept (round 0, ruling 3)", () => {
  it("leaves the run alone that holds a creator's 137 ms shot at speed 2, and every shot keeps three frames", () => {
    const pauses = [pause(0, 810, 741), pause(1463, 1840, 1569), pause(3550, 3673, 3669), pause(4025, 4836, 4725), pause(5590, 5888, 5632), pause(6071, 6308, 6118), pause(6424, 7120, 6445), pause(8285, 8451, 8431)];
    const speech: [number, number][] = [[810, 1463], [1840, 3550], [3673, 4025], [4836, 5590], [5888, 6071], [6308, 6424], [7120, 8285], [8451, 8568]];
    const asset = take(8568, wordsIn(speech));
    const edit = through(editOf(asset, [{ ...newShot({ id: "s1", asset: "take", endMs: 8568 }), speed: 2 }]), [{ op: "shot.split", id: "s1", atMs: 8431, newId: "c1" }]);
    const done = tightened(edit, { take: analysis({ pauses }) }, { pauseMs: 176 });
    expect(done.runsLeftAlone).toBe(1);
    expect(done.ops).toEqual([]);
  });
});

describe("tighten: a property over 200 made-up takes (fixed seed)", () => {
  it("cuts only inside pauses, clips no word, and leaves every shot at least three frames", () => {
    const random = prng(20261121);
    const between = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
    const totals = { slid: 0, shrunk: 0, leftAlone: 0, runsLeftAlone: 0, joined: 0, cuts: 0 };
    /** Why each silence longer than pauseMs was kept whole, outside the film's ends: its run left alone; inside one shot with no room; across shots, its joins at a pause's end. */
    const whole = { fragile: 0, noRoom: 0, joins: 0 };
    for (let n = 0; n < 200; n++) {
      // Speech and pauses in turn; one speech stretch in four is a short word (20 to 120 ms).
      const pauses: Pause[] = [];
      const speech: [number, number][] = [];
      let at = 0;
      if (random() < 0.5) at = between(120, 900);
      if (at > 0) pauses.push(pause(0, at, between(0, at - 1)));
      const count = between(2, 12);
      for (let i = 0; i <= count; i++) {
        // One stretch in six between pauses is a sound with no word (a click, a breath), up to 600 ms.
        if (i > 0 && i < count && random() < 1 / 6) at += between(20, 600);
        else {
          const said = random() < 0.25 ? between(20, 120) : between(150, 2500);
          speech.push([at, at + said]);
          at += said;
        }
        if (i === count && random() < 0.5) break;
        const quiet = between(120, 1500);
        pauses.push(pause(at, at + quiet, between(at, at + quiet - 1)));
        at += quiet;
      }
      const asset = take(at, wordsIn(speech));
      const given = { take: analysis({ pauses }) };
      // One shot over the take, or two or three cut at pauses' cuts; at speed 1, or at 0.5, 1.5 or 2.
      const speed = [1, 1, 0.5, 1.5, 2][between(0, 4)]!;
      let edit = editOf(asset, [{ ...newShot({ id: "s1", asset: "take", endMs: at }), speed }]);
      // The creator's splits (fix round 2, O1): at pauses' cuts, starts and ends, at words' edges and at any moment.
      const words = asset.kind === "video" ? (asset.words ?? []) : [];
      const points = [...pauses.flatMap((each) => [each.cutMs, each.startMs, each.endMs]), ...words.flatMap((word) => [word.startMs, word.endMs])];
      const picks = [...new Set([...points.filter(() => random() < 0.12), ...Array.from({ length: between(0, 2) }, () => between(1, at - 1))])]
        .filter((ms) => ms > 0 && ms < at).sort((a, b) => a - b);
      // Where the door takes them: two splits a click apart can leave a piece too short to keep.
      const splitted = picks.length > 0 ? applyOps(edit, picks.map((ms, i) => ({ op: "shot.split" as const, id: i === 0 ? "s1" : `c${i}`, atMs: ms, newId: `c${i + 1}` })), edit.assets) : null;
      if (splitted?.ok) edit = splitted.edit;
      const splits = splitted?.ok ? picks : [];
      // Fractional in three takes of four, k + 0.5 among them (fix round 4, B1), with no draw of its own, so the takes stay
      // the same. tighten rounds it once, so the checks below judge it by the rounded value.
      const asked = Math.min(400, between(120, 400) + [0, 0.5, 0.25, 0.75][n % 4]!);
      const pauseMs = Math.round(asked);

      const done = tightened(edit, given, { pauseMs: asked });
      const where = `take ${n}: ${JSON.stringify({ pauses, speech, speed, pauseMs: asked, splits, ops: done.ops })}`;
      const made = done.ops.length > 0 ? applyOps(edit, done.ops, edit.assets) : { ok: true as const, edit };
      expect(made.ok ? [] : made.problems, where).toEqual([]);
      if (!made.ok) continue;
      const cut = made.edit;
      expect(tightened(cut, given, { pauseMs: asked }).ops, `${where}: a second run`).toEqual([]);
      // Every silence longer than pauseMs, single or joined, across any number of shots (fix rounds 2 and 3, NB1 and N1),
      // but the film's own two ends, which keep half of pauseMs by the words' rule:
      const least = Math.ceil((3 * 1000 * speed) / 30 - 1e-9);
      const lay = layout(cut);
      const fragile = (shot: Shot) => {
        const run = lay.runs[lay.shots[cut.shots.indexOf(shot)]!.run]!;
        return cut.shots.slice(run.first, run.last + 1).some((each) => each.endMs - each.startMs < least);
      };
      const inPauses = (group: Pause[], ms: number) => group.some((each) => each.startMs <= ms && ms < each.endMs);
      for (const group of silenceGroups(pauses, words)) {
        const [first, last] = [group[0]!, group[group.length - 1]!];
        const [startMs, endMs] = [first.startMs, last.endMs];
        if (startMs <= edit.shots[0]!.startMs || endMs >= edit.shots[edit.shots.length - 1]!.endMs) continue; // a film's end
        const [before, after] = [shownOf(edit, startMs, endMs), shownOf(cut, startMs, endMs)];
        const label = `${where}: the silence ${startMs}-${endMs} (shown ${before}, kept ${after})`;
        if (Math.round(before - pauseMs) <= 0) {
          expect(after, label).toBe(before);
          continue;
        }
        // Never kept under pauseMs but where crossing a gap forces it, and never under its two outer pauses then.
        expect(after, label).toBeGreaterThanOrEqual(Math.min(pauseMs, before, first.endMs - first.startMs + last.endMs - last.startMs - 1));
        if (after !== endMs - startMs) continue;
        // Kept whole: only when no removal could go. Whole inside one shot: none from its first pause into its last.
        const inside = cut.shots.find((shot) => shot.startMs < startMs && endMs < shot.endMs);
        if (inside) {
          if (fragile(inside)) {
            whole.fragile++;
            continue;
          }
          const [lo, hi] = [Math.max(first.startMs, inside.startMs + least), Math.min(last.endMs - 1, inside.endMs - least)];
          expect(lo <= first.endMs - 1 && Math.max(last.startMs, lo + 1) <= hi, `${label}: whole in ${inside.id}`).toBe(false);
          whole.noRoom++;
          continue;
        }
        if (cut.shots.some((shot) => shot.startMs < endMs && startMs < shot.endMs && fragile(shot))) whole.fragile++;
        else whole.joins++;
        // Across shots: no join of two shots inside it could open, each side into a pause, each shot keeping three frames.
        cut.shots.forEach((shot, k) => {
          const next = cut.shots[k + 1];
          if (!next || shot.endMs !== next.startMs || shot.endMs < startMs || shot.endMs > endMs || fragile(shot) || fragile(next)) return;
          const opens = Array.from({ length: shot.endMs - Math.max(startMs, shot.startMs + least) + 1 }, (_, i) => shot.endMs - i)
            .some((lo) => inPauses(group, lo) && Array.from({ length: Math.min(endMs - 1, next.endMs - least) - next.startMs + 1 }, (_, i) => next.startMs + i)
              .some((hi) => inPauses(group, hi) && hi > lo));
          expect(opens, `${label}: the join at ${shot.endMs} could open`).toBe(false);
        });
      }
      expect(layout(cut).shots.every((shot) => shot.frames >= 3), where).toBe(true);
      expect(cutsOutside(cut, given), where).toEqual([]);
      // No word clipped: the shots together still show every millisecond of every word (a creator may split one).
      for (const word of words) {
        let at = word.startMs;
        for (let shot = cut.shots.find((each) => each.startMs <= at && at < each.endMs); shot && at < word.endMs; shot = cut.shots.find((each) => each.startMs <= at && at < each.endMs)) at = shot.endMs;
        expect(at >= word.endMs, `${where}: word ${word.startMs}-${word.endMs} shown only to ${at}`).toBe(true);
      }
      totals.slid += done.slid;
      totals.shrunk += done.shrunk;
      totals.leftAlone += done.leftAlone;
      totals.runsLeftAlone += done.runsLeftAlone;
      totals.joined += done.joined;
      totals.cuts += done.ops.filter((op) => op.op === "shot.split").length;
    }
    console.log(`tighten over 200 takes: ${totals.cuts} removals inside shots (${totals.joined} of joined pauses), ${totals.slid} slid, ${totals.shrunk} shrunk; ${totals.leftAlone} silences longer than pauseMs shown whole as before; ${totals.runsLeftAlone} runs left alone`);
    console.log(`  kept whole, outside the film's ends: ${whole.fragile} in a run left alone, ${whole.noRoom} inside one shot with no room for three-frame pieces, ${whole.joins} across shots whose joins cannot open into pauses (a split where a word starts, or no room for three frames)`);
    expect(totals.slid).toBeGreaterThan(0);
    expect(totals.joined).toBeGreaterThan(0);
  });
});

/* ── placeCaptions ─────────────────────────────────────────────────────────────────────────────── */

/** Eyes over 0.40 to 0.60 of the height (the face's upper half), the mouth over 0.60 to 0.80. */
const LOW = { face: { x: 0.2, y: 0.4, w: 0.6, h: 0.4 }, mouth: { x: 0.4, y: 0.6, w: 0.2, h: 0.2 } };
/** Eyes over 0.10 to 0.30, the mouth over 0.30 to 0.50. */
const HIGH = { face: { x: 0.2, y: 0.1, w: 0.6, h: 0.4 }, mouth: { x: 0.4, y: 0.3, w: 0.2, h: 0.2 } };
const NONE = { face: null, mouth: null };
/**
 * A face from 0.45 to 0.80 whose lower lip is at 0.738 (1417 px): text above the lip is on the face's nose or mouth (final fix
 * wave), so low captions must sit under it and over the apps' bottom bars (from 1500 px). The pill's box is 116 px at 72 px
 * and 100 at 61, too tall for that room at every low place; at 52 px it is 84, and 0.76 (1417 to 1501 px) fits. At 56 px it
 * is 90, and at 0.76 (1414 to 1504 px) it reaches 3 px over the lip, under review's 4 % of its box: it touches the chin, a
 * warning, so it is clear too (Task 5, which tries 56 px).
 */
const LIPPED = { face: { x: 0.2, y: 0.45, w: 0.6, h: 0.35 }, mouth: { x: 0.4, y: 0.698, w: 0.2, h: 0.04 } };

describe("placeCaptions: the captions clear of the face and the apps' buttons", () => {
  const spoken = take(3000, wordsIn([[0, 3000]]));
  const at = (y: number) => editOf(spoken, undefined, { y });
  const captionErrors = (edit: Edit, given: Analyses) =>
    errors(review(edit, given)).filter((finding) => (finding.code === "on-face" || finding.code === "under-buttons") && !finding.where.mark && !finding.where.item);

  it("moves them to the first candidate with no error: 0.30, above a face whose eyes and mouth cover 0.40 to 0.80, when they sit high", () => {
    const given = { take: analysis({ faces: samples(3000, () => LOW) }) };
    for (const y of CAPTION_YS.slice(0, CAPTION_YS.indexOf(0.3))) expect(captionErrors(at(y), given).length, `y ${y}`).toBeGreaterThan(0);
    const ops = placeCaptions(at(0.5 - 0.02), given);
    expect(ops).toEqual([{ op: "captions.set", y: 0.3 }]);
    const placed = through(at(0.48), ops);
    expect(captionErrors(placed, given)).toEqual([]);
    expect(placed.captions).toEqual({ ...at(0.48).captions, y: 0.3 }); // width, size and look kept
  });

  it("keeps low captions low at a smaller size before it takes them high (Task 10b, ruling a): 0.76 at 56 px, the first clear size on the 4 px grid (Task 5; 52 px when sizes were shares of 72), not 0.30 at 72", () => {
    // At 72 px and every size of the grid above 56 (and at 61, 0.85 of 72) every low place is on the face above its lip or under
    // the bars; at 56 px, 0.76 only touches the chin (`LIPPED`). The pill's three words a page are fewer than four: only its size moves.
    const given = { take: analysis({ faces: samples(3000, () => LIPPED) }) };
    const sized = (y: number, size: number) => editOf(spoken, undefined, { y, size });
    for (const size of [...captionSizes(72, "pill").filter((size) => size > 56), 61]) for (const y of CAPTION_YS.filter((y) => y >= 0.5)) expect(captionErrors(sized(y, size), given).length, `y ${y} at ${size}`).toBeGreaterThan(0);
    expect(captionErrors(sized(0.76, 56), given)).toEqual([]);
    expect(captionErrors(at(0.3), given)).toEqual([]);
    const ops = placeCaptions(at(0.8), given);
    expect(ops).toEqual([{ op: "captions.set", y: 0.76, size: 56 }]);
    expect(placeCaptions(through(at(0.8), ops), given)).toEqual([]);
  });

  it("starts high captions in the high band: off eyes at 0.26 to 0.30 up to 0.22, not down to 0.72, which is clear too", () => {
    const eyes = { face: { x: 0.2, y: 0.26, w: 0.6, h: 0.3 }, mouth: { x: 0.4, y: 0.45, w: 0.2, h: 0.05 } };
    const given = { take: analysis({ faces: samples(3000, () => eyes) }) };
    for (const y of [0.3, 0.26]) expect(captionErrors(at(y), given).length, `y ${y}`).toBeGreaterThan(0);
    expect(captionErrors(at(0.72), given)).toEqual([]);
    expect(placeCaptions(at(0.3), given)).toEqual([{ op: "captions.set", y: 0.22 }]);
    expect(placeCaptions(at(0.72), given)).toEqual([]);
  });

  it("keeps them at 0.72 with no face, and moves them there from under the bars", () => {
    const given = { take: analysis({ faces: samples(3000, () => NONE) }) };
    expect(placeCaptions(at(0.72), given)).toEqual([]);
    expect(placeCaptions(at(0.8), given)).toEqual([{ op: "captions.set", y: 0.72 }]);
  });

  it("makes them smaller when no place is clear at their size: on the 4 px grid, at 56 px they fit under the lip at 0.76 (Task 10 fix round 1, I1; Task 5: 52 px, 0.72 of it, when sizes were shares)", () => {
    // Low for 2 s, then high for 1 s: at 72 px, at every size of the grid above 56 and at 0.85 of 72 (61), every candidate is
    // on the face or under the bars some of the time.
    const given = { take: analysis({ faces: samples(3000, (ms) => (ms < 2000 ? LIPPED : HIGH)) }) };
    const sized = (y: number, size: number) => editOf(spoken, undefined, { y, size });
    for (const size of [...captionSizes(72, "pill").filter((size) => size > 56), 61]) for (const y of CAPTION_YS) expect(captionErrors(sized(y, size), given).length, `y ${y} at ${size}`).toBeGreaterThan(0);
    const ops = placeCaptions(at(0.8), given);
    expect(ops).toEqual([{ op: "captions.set", y: 0.76, size: 56 }]);
    expect(captionErrors(through(at(0.8), ops), given)).toEqual([]);
    expect(placeCaptions(through(at(0.8), ops), given)).toEqual([]); // and stays there
  });

  it("takes the candidate with the fewest error frames, at their own size, when no place and no size is clear", () => {
    // A face at three heights, one second each: every candidate, at every size tried, covers the eyes or the mouth some of the time.
    const MID = { face: { x: 0.2, y: 0.58, w: 0.6, h: 0.4 }, mouth: { x: 0.4, y: 0.84, w: 0.2, h: 0.06 } };
    const given = { take: analysis({ faces: samples(3000, (ms) => (ms < 1000 ? LOW : ms < 2000 ? HIGH : MID)) }) };
    const sized = (y: number, size: number) => editOf(spoken, undefined, { y, size });
    for (const size of captionSizes(72, "pill")) for (const y of CAPTION_YS) expect(captionErrors(sized(y, size), given).length, `y ${y} at ${size}`).toBeGreaterThan(0);
    const ops = placeCaptions(at(0.8), given);
    expect(ops).toHaveLength(1);
    expect(ops[0]).not.toHaveProperty("size");
    const placed = through(at(0.8), ops);
    expect(captionErrors(placed, given).length).toBeGreaterThan(0);
    expect(placeCaptions(placed, given)).toEqual([]); // and stays there
  });

  it("moves captions off the mouth whatever their words: a character the tables lack, or a decomposed one, does not hide them (final fix wave)", () => {
    // The reviewer's probe: thirteen words, captions at 0.70, a mouth from 0.66 to 0.72 of the height.
    const MOUTH_LOW = { face: { x: 0.2, y: 0.4, w: 0.6, h: 0.36 }, mouth: { x: 0.4, y: 0.66, w: 0.2, h: 0.06 } };
    const given = { take: analysis({ faces: samples(5200, () => MOUTH_LOW) }) };
    const thirteen = (word: string) => take(5200, Array.from({ length: 13 }, (_, i) => ({ text: i === 6 ? word : TEXTS[i % TEXTS.length]!, startMs: 200 + i * 380, endMs: 200 + i * 380 + 360 })));
    const moved = (word: string) => placeCaptions(editOf(thirteen(word), undefined, { y: 0.7 }), given);
    const plain = moved("Brand");
    expect(plain).toHaveLength(1);
    for (const word of ["Brand™", "Brașov", "nai\u0308ve"]) expect(moved(word), word).toEqual(plain);
  });

  it("does nothing with the captions off", () => {
    expect(placeCaptions(editOf(spoken, undefined, { on: false, y: 0.8 }), { take: analysis({ faces: samples(3000, () => LOW) }) })).toEqual([]);
  });
});

describe("placeCaptions: first, pages of three rows at most (Task K1)", () => {
  /** Made-up words in one breath, 300 ms apart: no pause and no sentence's end, so a page holds as many as it may. */
  const BREATH = "so here is the thing nobody tells you about making short videos that people watch right".split(" ");
  const breath = take(5200, BREATH.map((text, i) => ({ text, startMs: 200 + i * 300, endMs: 200 + i * 300 + 280 })));
  const at = (captions: Partial<Edit["captions"]>) => editOf(breath, undefined, { maxWords: 16, ...captions });
  const rows = (edit: Edit) => review(edit, { take: analysis() }).filter((finding) => finding.code === "caption-rows");
  const words = (edit: Edit, maxWords: number) => ({ ...edit, captions: { ...edit.captions, maxWords } });

  it("takes one word off a page at a time while a page runs to more than three rows at the captions' size, and stops at the first that does not", () => {
    const given = { take: analysis({ faces: samples(5200, () => NONE) }) };
    const edit = at({ size: 64, y: 0.3 }); // clear of the face and the bars: only the rows are wrong
    expect(rows(edit)).toHaveLength(1);
    const ops = placeCaptions(edit, given);
    expect(ops).toHaveLength(1);
    expect(Object.keys(ops[0]!).sort()).toEqual(["maxWords", "op"]);
    const fewer = (ops[0] as { maxWords: number }).maxWords;
    expect(fewer).toBeLessThan(16);
    expect(rows(words(edit, fewer))).toEqual([]);
    expect(rows(words(edit, fewer + 1))).toHaveLength(1); // one word more and a page runs to four rows again
    expect(placeCaptions(through(edit, ops), given)).toEqual([]); // a second run
  });

  it("then places them as before, the fewer words set with the place and the size", () => {
    // The face low on the stage: low captions at 64 px cover the mouth or the eyes, as in "keeps low captions low" above.
    const given = { take: analysis({ faces: samples(5200, () => LOW) }) };
    const edit = at({ size: 64, y: 0.8 });
    const ops = placeCaptions(edit, given);
    expect(ops).toHaveLength(1);
    const { maxWords, ...placed } = ops[0] as Extract<Op, { op: "captions.set" }>;
    expect(maxWords).toBeLessThan(16);
    expect(placed.y).toBeDefined();
    // Where they go is where they would go with those words a page: the same rule, on the edit with fewer words.
    expect([placed]).toEqual(placeCaptions(words(edit, maxWords!), given));
    const after = through(edit, ops);
    expect(rows(after)).toEqual([]);
    expect(placeCaptions(after, given)).toEqual([]);
  });

  it("goes no lower than it must: 200 px type with one word a row stops at three words a page, never under one", () => {
    const given = { take: analysis({ faces: samples(5200, () => NONE) }) };
    const edit = at({ size: 200, y: 0.3, width: 0.6 });
    const ops = placeCaptions(edit, given);
    const fewer = (ops[0] as { maxWords: number }).maxWords;
    expect(fewer).toBe(3);
    expect(rows(words(edit, fewer))).toEqual([]);
    expect(rows(words(edit, fewer + 1))).toHaveLength(1);
    expect(placeCaptions(through(edit, ops), given)).toEqual([]);
  });

  it("leaves the words a page alone when every page is three rows or fewer", () => {
    const given = { take: analysis({ faces: samples(5200, () => NONE) }) };
    expect(placeCaptions(at({ size: 52, y: 0.3 }), given)).toEqual([]);
    expect(placeCaptions(at({ size: 64, y: 0.3, maxWords: 12 }), given)).toEqual([]);
  });
});

describe("placeCaptions: short rows before small letters (plain and pill)", () => {
  /** Made-up words in one breath, 300 ms apart from 200 ms: no pause and no sentence's end, so a page holds as many as it may. */
  const breath = (texts: readonly string[]) => take(3000, texts.map((text, i) => ({ text, startMs: 200 + i * 300, endMs: 200 + i * 300 + 280 })));
  const given = { take: analysis({ faces: samples(3000, () => LIPPED) }) };
  const plain = (asset: Asset, captions: Partial<Edit["captions"]>) => editOf(asset, undefined, { look: "plain", y: 0.8, ...captions });
  const sized = (edit: Edit, size: number, maxWords: number): Edit => ({ ...edit, captions: { ...edit.captions, size, maxWords } });
  const captionErrors = (edit: Edit) =>
    errors(review(edit, given)).filter((finding) => (finding.code === "on-face" || finding.code === "under-buttons") && !finding.where.mark && !finding.where.item);
  /** The low places (from 0.5 down) where the captions have no error. */
  const clearLow = (edit: Edit) => CAPTION_YS.filter((y) => y >= 0.5 && captionErrors({ ...edit, captions: { ...edit.captions, y } }).length === 0);
  /** Each page's rows and height, set by the kit's layout with the width tables, as review sets them. */
  const tables = (text: string, weight: number, size: number) => measure(text, "tiktok", weight, size)!;
  const pagesSet = (edit: Edit) => {
    const run = layout(edit).runs[0]!;
    const pages = pagesFor(edit.captions, runWords(edit, run), run.frames);
    return captionPages(edit.captions, pages.map((page) => page.words), tables).map((page) => ({ rows: page.rows.length, h: page.h }));
  };

  it("tries plain and pill on one grid down to 44 px, and pop and highlight as today", () => {
    expect(captionSizes(64, "plain")).toEqual([64, 60, 56, 52, 48, 44]);
    expect(captionSizes(66, "pill")).toEqual([66, 64, 60, 56, 52, 48, 44]);
    expect(captionSizes(44, "plain")).toEqual([44]);
    expect(captionSizes(72, "pop")).toEqual([72, 61, 52]);
    expect(captionSizes(72, "highlight")).toEqual([72, 61, 52]);
    expect(wordCounts(8, "plain")).toEqual([8, 7, 6, 5, 4]);
    expect(wordCounts(3, "pill")).toEqual([3]);
    expect(wordCounts(8, "pop")).toEqual([8]);
  });

  it("takes words off a page before it makes the letters smaller", () => {
    const edit = plain(breath(TEXTS), { size: 64, maxWords: 8 });
    // Eight words a page at 64 px run to two rows, 2 × 74 + 8 = 156 px: taller than the room under the lip at every low place.
    expect(pagesSet(edit)).toEqual([{ rows: 2, h: 156 }]);
    expect(clearLow(edit)).toEqual([]);
    // k: the most words a page at which every page is one row at 64 px.
    const k = [8, 7, 6, 5, 4, 3, 2, 1].find((words) => pagesSet(sized(edit, 64, words)).every((page) => page.rows === 1))!;
    expect(k).toBeGreaterThanOrEqual(4);
    expect(clearLow(sized(edit, 64, k))).toContain(0.76);
    const ops = placeCaptions(edit, given);
    expect(ops).toEqual([{ op: "captions.set", y: 0.76, maxWords: k }]); // no size: the letters stay as asked
    const placed = through(edit, ops);
    expect(captionErrors(placed)).toEqual([]);
    expect(placeCaptions(placed, given)).toEqual([]); // and stays there
  });

  it("goes down to four words and no further before smaller letters", () => {
    // Made-up words of ten letters: four a page take two rows at 64 px; three a page would be one row there, and clear.
    const edit = plain(breath(["filtrimint", "riftilmint", "kiltrimfit", "miltifrist", "tirlimbilt", "glitfirmil", "sliftirmin", "biltrifint"]), { size: 64, maxWords: 8 });
    for (const words of [8, 7, 6, 5, 4]) expect(clearLow(sized(edit, 64, words)), `${words} words at 64 px`).toEqual([]);
    expect(clearLow(sized(edit, 64, 3))).toContain(0.76);
    const ops = placeCaptions(edit, given);
    expect(ops).toHaveLength(1);
    const op = ops[0] as Extract<Op, { op: "captions.set" }>;
    expect(op.maxWords).toBeGreaterThanOrEqual(4);
    expect(op.size).toBeLessThan(64);
    expect(captionSizes(64, "plain")).toContain(op.size);
    for (const size of captionSizes(64, "plain").filter((each) => each > op.size!)) {
      for (const words of [8, 7, 6, 5, 4]) expect(clearLow(sized(edit, size, words)), `${words} words at ${size} px`).toEqual([]);
    }
    expect(ops).toEqual([{ op: "captions.set", y: 0.76, size: 52, maxWords: 4 }]); // here: four words at 52 px, kept low
    const placed = through(edit, ops);
    expect(captionErrors(placed)).toEqual([]);
    expect(placeCaptions(placed, given)).toEqual([]); // and stays there
  });

  it("never ends more than 3 px smaller (the grid's step, 4, less one) for a larger size asked: every pair of sizes from 48 to 80 px, on two takes", () => {
    // Six-letter words, five a page: one row at 56 px and two from 60 px; four a page are one row up to 72 px, on the grid. Today's
    // steps, shares of the asked size (0.85 and 0.72), gave 51 for 60, 54 for 64, 56 for 66 and 52 for 72 on this face.
    // Ten-letter words, eight a page: four a page are one row up to 54 px, off the grid, so 55 px asked ends at the grid's 52.
    // Sizes off the grid lie on both sides of each take's first size that fails (73 and 55 px).
    const takes = [
      { asset: breath(["saviro", "virano", "lomira", "rubino", "tumari", "ronebi", "tarkin", "fanite"]), maxWords: 5, worst: 0 },
      { asset: breath(["filtrimint", "riftilmint", "kiltrimfit", "miltifrist", "tirlimbilt", "glitfirmil", "sliftirmin", "biltrifint"]), maxWords: 8, worst: 2 },
    ];
    const asked = Array.from({ length: 33 }, (_, i) => 48 + i);
    for (const { asset, maxWords, worst } of takes) {
      const ended = asked.map((size) => {
        const edit = plain(asset, { size, maxWords });
        const ops = placeCaptions(edit, given);
        expect(captionErrors(through(edit, ops)), `asked ${size}`).toEqual([]);
        return (ops[0] as { size?: number } | undefined)?.size ?? size;
      });
      const pairs = asked.flatMap((b, j) => asked.slice(0, j).map((a, i) => ({ a, b, drop: ended[i]! - ended[j]! })));
      expect(pairs.filter((pair) => pair.drop > 3), `${maxWords} words a page`).toEqual([]);
      expect(Math.max(...pairs.map((pair) => pair.drop)), `${maxWords} words a page`).toBe(worst);
    }
  });

  it("places pop as it did", () => {
    // Each expected op is from a run on the code before Task 5: pop and highlight keep their words a page and today's sizes.
    const spoken = take(3000, wordsIn([[0, 3000]]));
    const pop = editOf(spoken, undefined, { look: "pop", y: 0.8 }); // the `LIPPED` case of "keeps low captions low", as pop
    const ops = placeCaptions(pop, given);
    expect(ops).toEqual([{ op: "captions.set", y: 0.76 }]);
    expect(placeCaptions(through(pop, ops), given)).toEqual([]);
    // Where plain would take words off a page, pop and highlight make the letters smaller, by 0.85 and 0.72 of the asked size.
    expect(placeCaptions(editOf(breath(TEXTS), undefined, { look: "pop", size: 64, maxWords: 8, y: 0.8 }), given)).toEqual([{ op: "captions.set", y: 0.76, size: 46 }]);
    expect(placeCaptions(editOf(breath(TEXTS), undefined, { look: "highlight", size: 72, maxWords: 6, y: 0.8 }), given)).toEqual([{ op: "captions.set", y: 0.76, size: 61 }]);
  });

  /** Made-up words in two breaths of five, 600 ms of pause between: a page ends at the pause whatever the count above five. */
  const twoBreaths = (texts: readonly string[]) =>
    take(4000, texts.map((text, i) => ({ text, startMs: 200 + i * 300 + (i >= 5 ? 600 : 0), endMs: 200 + i * 300 + (i >= 5 ? 600 : 0) + 280 })));

  it("does not try a count of words again whose pages come out the same as the count before's: review sees the count only through the pages", () => {
    // 8, 7, 6 and 5 words a page all give two pages of five; four gives pages of four and one.
    expect(countsTried(plain(twoBreaths([...TEXTS.slice(0, 5), ...TEXTS.slice(0, 5)]), { size: 64, maxWords: 8 }))).toEqual([8, 4]);
    expect(countsTried(plain(breath(TEXTS), { size: 64, maxWords: 8 }))).toEqual([8, 7, 6, 5, 4]); // one breath: each count gives other pages
    expect(countsTried(editOf(breath(TEXTS), undefined, { look: "pop", maxWords: 8 }))).toEqual([8]);
    expect(countsTried(editOf(breath(TEXTS), undefined, { maxWords: 3 }))).toEqual([3]);
  });

  it("tries the counts as the pages are drawn: a sentence's pages evened out, any other captions' filled (S1, S2)", () => {
    // Made-up words: one sentence of six, said back to back from 200 ms, 300 ms each.
    const sentence = take(3000, ["One", "two", "three", "four", "five", "six."].map((text, i) => ({ text, startMs: 200 + i * 300, endMs: 500 + i * 300 })));
    // Set as a sentence: five a page are 3 + 3, and four a page 3 + 3 too, so four is not tried again.
    expect(countsTried(plain(sentence, { weight: 600, maxWords: 5 }))).toEqual([5]);
    // No weight: five a page are 5 + 1 and four a page 4 + 2, as before.
    expect(countsTried(plain(sentence, { maxWords: 5 }))).toEqual([5, 4]);
  });

  it("places them as trying every count did: the op pinned from the code before the skip, on a take whose counts above five are skipped", () => {
    // Made-up words of ten letters in two breaths of five: two rows a page at 64 px from 8 words down to 5; four a page fit one row at 52 px.
    const texts = ["filtrimint", "riftilmint", "kiltrimfit", "miltifrist", "tirlimbilt", "glitfirmil", "sliftirmin", "biltrifint", "lirtifjold", "triflingit"];
    const edit = plain(twoBreaths(texts), { size: 64, maxWords: 8 });
    const lipped = { take: analysis({ faces: samples(4000, () => LIPPED) }) };
    expect(placeCaptions(edit, lipped)).toEqual([{ op: "captions.set", y: 0.76, size: 52, maxWords: 4 }]);
    expect(countsTried(edit)).toEqual([8, 4]);
  });
});

describe("placeCaptions: the time on a 90 s take (it runs once a first cut, never in the change loop)", () => {
  // A made-up 90 s take: 162 words between 34 pauses of 600 ms, and a face over the whole stage in every sample, so that no place
  // is clear at any size or count: every one is tried, then the last resort.
  const MS = 90_000;
  const pauses = Array.from({ length: 34 }, (_, i) => pause(Math.round(((i + 1) * MS) / 35) - 300, Math.round(((i + 1) * MS) / 35) + 300, Math.round(((i + 1) * MS) / 35)));
  const words: Word[] = [];
  let [said, placed] = [0, 0];
  const speech = MS - 34 * 600;
  for (const [from, to] of between(MS, pauses)) {
    said += to - from;
    const n = Math.round((162 * said) / speech) - placed;
    for (let i = 0; i < n; i++) words.push({ text: TEXTS[words.length % TEXTS.length]!, startMs: Math.round(from + ((to - from) * i) / n), endMs: Math.round(from + ((to - from) * (i + 1)) / n) - 20 });
    placed += n;
  }
  const ninety = take(MS, words);
  const everywhere = { take: analysis({ pauses, faces: samples(MS, () => ({ face: { x: 0.1, y: 0.05, w: 0.8, h: 0.9 }, mouth: { x: 0.35, y: 0.6, w: 0.3, h: 0.2 } })) }) };
  /**
   * The fastest of three runs in this process's CPU time, in ms, with its wall time and the ops: the suite's other files run
   * beside this one, and the time spent waiting for a core is the machine's, not the recipe's.
   */
  const timed = (edit: Edit) => {
    const runs = Array.from({ length: 3 }, () => {
      const [cpu, wall] = [process.cpuUsage(), performance.now()];
      const ops = placeCaptions(edit, everywhere);
      const { user, system } = process.cpuUsage(cpu);
      return { ms: (user + system) / 1000, wall: performance.now() - wall, ops };
    });
    return [...runs].sort((a, b) => a.ms - b.ms)[0]!;
  };

  it("has 162 words and 34 pauses", () => {
    expect([words.length, pauses.length]).toEqual([162, 34]);
  });

  it("places plain captions in under 1,000 ms across the house's range (64 px, eight words a page, nothing clear): once a first cut affords a second", { timeout: 30_000 }, () => {
    const { ms, wall, ops } = timed(editOf(ninety, undefined, { look: "plain", size: 64, maxWords: 8, y: 0.8 }));
    console.log(`placeCaptions, 90 s, plain 64 px, 8 words, nothing clear: ${ms.toFixed(0)} ms of CPU, ${wall.toFixed(0)} ms of wall time`);
    expect(ops).toEqual([]); // nowhere has fewer error frames than where they are
    expect(ms).toBeLessThan(1000);
  });

  it("places plain captions in under 3,500 ms at the largest size the schema allows (200 px, nothing clear): each try is one full review", { timeout: 60_000 }, () => {
    const { ms, wall, ops } = timed(editOf(ninety, undefined, { look: "plain", size: 200, maxWords: 8, y: 0.8 }));
    console.log(`placeCaptions, 90 s, plain 200 px, 8 words, nothing clear: ${ms.toFixed(0)} ms of CPU, ${wall.toFixed(0)} ms of wall time`);
    expect(ops.every((op) => op.op === "captions.set" && op.y === undefined && op.size === undefined)).toBe(true); // at most fewer words a page (K1)
    expect(ms).toBeLessThan(3500);
  });
});

/* ── levelVoice ────────────────────────────────────────────────────────────────────────────────── */

describe("levelVoice: the shots evened out to the film's median loudness", () => {
  const spoken = take(10_000, wordsIn([[0, 10_000]]));
  /** A level every 500 ms, as the worker gives them. */
  const levels = (lufs: (ms: number) => number) => Array.from({ length: 21 }, (_, i) => ({ ms: i * 500, lufs: lufs(i * 500) }));
  const loud = (lufs: (ms: number) => number): Analyses => ({ take: analysis({ loudness: { lufs: -23, truePeak: -3, levels: levels(lufs) } }) });
  const two = (volumes: [number, number] = [1, 1]) =>
    editOf(spoken, [{ ...newShot({ id: "s1", asset: "take", endMs: 4900 }), volume: volumes[0] }, { ...newShot({ id: "s2", asset: "take", startMs: 5100, endMs: 10_000 }), volume: volumes[1] }]);
  const halves = loud((ms) => (ms < 5000 ? -20 : -26));

  it("gives a -20 LUFS shot 0.71 and a -26 shot 1.41 against their median, -23; a second run changes nothing", () => {
    const ops = levelVoice(two(), halves);
    expect(ops).toEqual([{ op: "shot.set", id: "s1", volume: 0.71 }, { op: "shot.set", id: "s2", volume: 1.41 }]);
    expect(levelVoice(through(two(), ops), halves)).toEqual([]);
  });

  it("leaves silent levels (-70) out of a shot's loudness", () => {
    const gaps = loud((ms) => (ms === 1000 || ms === 1500 ? -70 : ms < 5000 ? -20 : -26));
    expect(levelVoice(two(), gaps)).toEqual([{ op: "shot.set", id: "s1", volume: 0.71 }, { op: "shot.set", id: "s2", volume: 1.41 }]);
  });

  it("counts a shot's own volume: a -20 shot already at 0.5 is heard at -26", () => {
    expect(levelVoice(two([0.5, 1]), halves)).toEqual([]);
  });

  it("leaves shots within 1 LU of the target alone, and clamps the volume to 0.71 to 1.41, ±3 dB (Task 10, fix round 2)", () => {
    const three = editOf(spoken, [newShot({ id: "s1", asset: "take", endMs: 3000 }), newShot({ id: "s2", asset: "take", startMs: 3500, endMs: 6500 }), newShot({ id: "s3", asset: "take", startMs: 7000, endMs: 10_000 })]);
    expect(levelVoice(three, loud((ms) => (ms < 3000 ? -22.5 : ms < 6500 ? -23 : -23.9)))).toEqual([]);
    expect(levelVoice(two(), loud((ms) => (ms < 5000 ? -10 : -40)))).toEqual([{ op: "shot.set", id: "s1", volume: 0.71 }, { op: "shot.set", id: "s2", volume: 1.41 }]);
  });

  it("gives a piece shorter than 3 s of film the volume of the longer neighbour of its take, not one of its own (fix round 2)", () => {
    // A 4.9 s piece at -20, a 1 s piece at -30 and a 4 s piece at -26: the short one takes the first's volume, the longer neighbour.
    const pieces = editOf(spoken, [newShot({ id: "a", asset: "take", endMs: 4900 }), newShot({ id: "b", asset: "take", startMs: 5000, endMs: 6000 }), newShot({ id: "c", asset: "take", startMs: 6000, endMs: 10_000 })]);
    const given = loud((ms) => (ms < 4900 ? -20 : ms < 6000 ? -30 : -26));
    const ops = levelVoice(pieces, given);
    expect(ops).toEqual([{ op: "shot.set", id: "a", volume: 0.71 }, { op: "shot.set", id: "b", volume: 0.71 }, { op: "shot.set", id: "c", volume: 1.41 }]);
    expect(levelVoice(through(pieces, ops), given)).toEqual([]);
    // A short piece between two pieces of another take, or alone, keeps its own.
    const lonely = editOf(spoken, [newShot({ id: "b", asset: "take", startMs: 5000, endMs: 6000 })]);
    expect(levelVoice(lonely, given)).toEqual([]);
  });

  it("never gives a short piece a muted neighbour's volume, and holds what it takes or keeps to 0.71 to 1.41 (fix round 3)", () => {
    const given = loud((ms) => (ms < 4900 ? -20 : ms < 6000 ? -30 : -70));
    const pair = (a: number, b: number) => editOf(spoken, [{ ...newShot({ id: "a", asset: "take", endMs: 4900 }), volume: a }, { ...newShot({ id: "b", asset: "take", startMs: 5000, endMs: 6000 }), volume: b }]);
    // Muted beside it: the short piece keeps its own (1), and at 1.8, its own held to 1.41.
    expect(levelVoice(pair(0, 1), given)).toEqual([]);
    expect(levelVoice(pair(0, 1.8), given)).toEqual([{ op: "shot.set", id: "b", volume: 1.41 }]);
    // A long neighbour left as it is at 1.8 (one piece: nothing to level against) gives the short piece 1.41, not 1.8.
    const unlevelled = editOf(spoken, [{ ...newShot({ id: "a", asset: "take", endMs: 4900 }), volume: 1.8 }, newShot({ id: "b", asset: "take", startMs: 5000, endMs: 6000 })]);
    const ops = levelVoice(unlevelled, given);
    expect(ops.find((op) => op.op === "shot.set" && op.id === "b")).toEqual({ op: "shot.set", id: "b", volume: 1.41 });
    expect(levelVoice(through(unlevelled, ops), given)).toEqual([]);
  });

  it("changes nothing on a second run, over 500 seeded films of 2 to 30 shots, the reviewer's six and three slow films (fix rounds 1 and 2, I3)", () => {
    /** A film of shots 3 s long (none short: fix round 2), each heard at its own loudness (two levels in each) and at its own volume. */
    const film = (lufs: number[], volumes: number[]) => {
      const levels = lufs.flatMap((each, k) => [{ ms: k * 3100, lufs: each }, { ms: k * 3100 + 500, lufs: each }]);
      const shots = lufs.map((_, k) => ({ ...newShot({ id: `s${k + 1}`, asset: "take", startMs: k * 3100, endMs: k * 3100 + 3000 }), volume: volumes[k]! }));
      return { edit: editOf(take(lufs.length * 3100, wordsIn([[0, lufs.length * 3100]])), shots), given: { take: analysis({ loudness: { lufs: -23, truePeak: -1, levels } }) } };
    };
    const twice = (lufs: number[], volumes: number[] = lufs.map(() => 1)) => {
      const { edit, given } = film(lufs, volumes);
      const ops = levelVoice(edit, given);
      return { ops, again: levelVoice(through(edit, ops), given) };
    };
    const reviewers = twice([-20.43, -26.2, -28.09, -19.23, -29.57, -28.18]);
    expect(reviewers.ops.length).toBeGreaterThan(0);
    expect(reviewers.again).toEqual([]);
    // Films that need more than five rounds to settle (fix round 2, I3): found by a search for the slowest, 6, 7 and 8
    // rounds of change. The reviewer's 12- and 14-shot films were not handed over; these stand for them.
    const slow = [
      [-23.31, -26.86, -24.45, -24.41, -24.62, -8, -24.35, -24.37, -13.15, -16.18, -16.05, -8.07],
      [-11.73, -22.44, -12.63, -24.17, -14.06, -22.48, -15.3, -21.41, -22.47, -22.75, -8, -22.45, -22.67, -13.91],
      [-27.63, -19.01, -8.33, -16.16, -19.02, -20.05, -43.09, -30.83, -39.78, -20.27, -11.08, -19.04, -48.1, -44.53, -18.94, -16.36, -18.66, -18.85, -46.21, -34.38, -10.07, -18.96, -27.06, -26.62, -29.66, -8.08],
    ];
    for (const lufs of slow) {
      const { edit, given } = film(lufs, lufs.map(() => 1));
      const done = levelled(edit, given);
      expect([lufs.length, done.settled, done.rounds > 6]).toEqual([lufs.length, "stable", true]);
      expect(twice(lufs).again, `${lufs.length} shots`).toEqual([]);
    }
    const random = prng(1121);
    for (let n = 0; n < 500; n++) {
      const count = 2 + Math.floor(random() * 29);
      const lufs = Array.from({ length: count }, () => Math.round((-38 + random() * 26) * 100) / 100);
      const volumes = lufs.map(() => (random() < 0.3 ? Math.round((0.5 + random() * 1.5) * 100) / 100 : 1));
      expect(twice(lufs, volumes).again, `film ${n}: ${JSON.stringify({ lufs, volumes })}`).toEqual([]);
    }
  });

  it("leaves a take without loudness, a take without analysis and a muted shot alone", () => {
    expect(levelVoice(two(), { take: analysis() })).toEqual([]);
    expect(levelVoice(two(), {})).toEqual([]);
    expect(levelVoice(two([0, 1]), halves)).toEqual([]);
  });
});

/* ── punchIns ──────────────────────────────────────────────────────────────────────────────────── */

/** A face a little left of centre, 0.30 to 0.55 of the height, its mouth at 0.48 to 0.52. */
const FACE = { face: { x: 0.22, y: 0.3, w: 0.3, h: 0.25 }, mouth: { x: 0.32, y: 0.48, w: 0.1, h: 0.04 } };

/**
 * A 69.3 s take: a 300 ms head pause, then 21 phrases of 2.7 s with 600 ms pauses between them, then a
 * 300 ms tail. Tightened at 200 ms, it is a 60.9 s edit cut 20 times, its captions at 0.72.
 */
function sixty(over: Partial<Extract<Asset, { kind: "video" }>> = {}) {
  const pauses: Pause[] = [pause(0, 300, 150)];
  const speech: [number, number][] = [];
  let at = 300;
  for (let k = 0; k < 21; k++) {
    speech.push([at, at + 2700]);
    at += 2700;
    const quiet = k < 20 ? 600 : 300;
    pauses.push(pause(at, at + quiet, at + quiet / 2));
    at += quiet;
  }
  const asset = take(at, wordsIn(speech), over);
  const given = { take: analysis({ pauses, faces: samples(at, () => FACE) }) };
  const whole = editOf(asset, undefined, { y: 0.72 });
  return { asset, given, edit: through(whole, tighten(whole, given, { pauseMs: 200 })) };
}
const shotSets = (ops: Op[]) => ops.filter((op): op is Extract<Op, { op: "shot.set" }> => op.op === "shot.set");

describe("punchIns: tighter shots at cuts in pauses (X100)", () => {
  it("frames six shots of a 60 s edit tighter at 6 a minute: one per sixth of the film, never two in a row, the face in the middle 60 %", () => {
    const { asset, given, edit } = sixty();
    expect(edit.shots).toHaveLength(21);
    const lay = layout(edit);
    expect(lay.frames / 30).toBeCloseTo(60.9, 1);
    const ops = punchIns(edit, given, { perMin: 6, zoom: 1.15 });
    const sets = shotSets(ops);
    expect(sets).toHaveLength(6);
    expect(ops).toHaveLength(6);
    const index = sets.map((op) => edit.shots.findIndex((shot) => shot.id === op.id));
    index.slice(1).forEach((i, k) => expect(i - index[k]!).toBeGreaterThan(1));
    // One in each sixth of the film.
    expect(index.map((i) => Math.floor((lay.shots[i]!.at * 6) / lay.frames))).toEqual([0, 1, 2, 3, 4, 5]);
    for (const op of sets) {
      expect(op.framing?.from.zoom).toBe(1.15);
      expect(op.framing?.move).toBeNull();
      const shot = edit.shots.find((each) => each.id === op.id)!;
      const sample = given.take.faces.filter((each) => each.ms <= shot.startMs).at(-1)!;
      const face = faceOnStage(sample, asset.kind === "video" ? asset : { w: 1, h: 1 }, op.framing!.from).face!;
      expect(face.x).toBeGreaterThanOrEqual(0.2 * 1080 - 1e-6);
      expect(face.x + face.w).toBeLessThanOrEqual(0.8 * 1080 + 1e-6);
      expect(face.y).toBeGreaterThanOrEqual(0.2 * 1920 - 1e-6);
      expect(face.y + face.h).toBeLessThanOrEqual(0.8 * 1920 + 1e-6);
    }
    // The face sits left of centre: at 1.15 about the centre it would reach left of 0.2, so it is panned, as little as keeps it in.
    expect(sets[0]!.framing!.from.x).toBeLessThan(0);
    const punchedEdit = through(edit, ops);
    expect(review(punchedEdit, given).filter((finding) => finding.code === "on-face")).toEqual([]);
    expect(errors(review(punchedEdit, given))).toEqual([]);
    // Run again on its own output, it adds nothing: a slot holding a tight shot is filled (fix round 1, I2).
    expect(punchIns(punchedEdit, given, { perMin: 6, zoom: 1.15 })).toEqual([]);
  });

  it("never punches into a shot the creator panned, even at zoom 1 (fix round 2, O2)", () => {
    const { given, edit } = sixty();
    const first = shotSets(punchIns(edit, given, { perMin: 6, zoom: 1.15 }))[0]!.id;
    const panned = through(edit, [{ op: "shot.set", id: first, framing: { from: { zoom: 1, x: 0.4, y: 0 }, move: null } }]);
    const sets = shotSets(punchIns(panned, given, { perMin: 6, zoom: 1.15 }));
    expect(sets.map((op) => op.id)).not.toContain(first);
    expect(sets).toHaveLength(6);
  });

  it("prefers, within its slot, a cut before a stressed word", () => {
    const { given, edit } = sixty();
    const lay = layout(edit);
    const slot = edit.shots.map((_, i) => i).filter((i) => i > 0 && lay.shots[i]!.at < lay.frames / 6);
    const chosen = shotSets(punchIns(edit, given, { perMin: 6, zoom: 1.15 }))[0]!.id;
    const other = slot.map((i) => edit.shots[i]!).find((shot) => shot.id !== chosen)!;
    const asset = edit.assets[0]!;
    const first = asset.kind === "video" ? asset.words!.findIndex((word) => (word.startMs + word.endMs) / 2 >= other.startMs) : -1;
    const stressed = through(edit, [{ op: "word.set", asset: "take", index: first, stress: true }]);
    expect(shotSets(punchIns(stressed, given, { perMin: 6, zoom: 1.15 }))[0]!.id).toBe(other.id);
  });

  it("clamps the zoom to review's soft-zoom limit for the take: 1.3 on a 720-wide take, 1.11 on a 600-wide one, none on a 540-wide one", () => {
    const hd = sixty();
    const at13 = shotSets(punchIns(hd.edit, hd.given, { perMin: 6, zoom: 1.3 }));
    expect(at13.length).toBeGreaterThan(0);
    expect(at13.every((op) => op.framing?.from.zoom === 1.3)).toBe(true);
    expect(review(through(hd.edit, at13), hd.given).filter((finding) => finding.code === "soft-zoom")).toEqual([]);

    const small = sixty({ w: 600, h: 1066 });
    const at111 = shotSets(punchIns(small.edit, small.given, { perMin: 6, zoom: 1.3 }));
    expect(at111.length).toBeGreaterThan(0);
    expect(at111.every((op) => op.framing?.from.zoom === 1.11)).toBe(true);
    expect(review(through(small.edit, at111), small.given).filter((finding) => finding.code === "soft-zoom")).toEqual([]);

    const tiny = sixty({ w: 540, h: 960 });
    expect(punchIns(tiny.edit, tiny.given, { perMin: 6, zoom: 1.3 })).toEqual([]);
  });

  it("drops a punch-in after which review finds a new error, and counts it: here the shot runs on into a piece cut in speech", () => {
    const { given, edit } = sixty();
    const first = shotSets(punchIns(edit, given, { perMin: 6, zoom: 1.15 }))[0]!.id;
    const shot = edit.shots.find((each) => each.id === first)!;
    // Split mid-word: the two pieces run on, so there is no cut there until a punch-in frames the first piece tighter.
    const asset = edit.assets[0]!;
    // At least 2 s in, so the piece before it is long enough to be punched (fix round 2: a punch-in holds 2 s or more).
    const word = asset.kind === "video" ? asset.words!.find((each) => each.startMs > shot.startMs + 2100)! : null;
    const split = through(edit, [{ op: "shot.split", id: first, atMs: word!.startMs + 100, newId: "mid" }]);
    expect(errors(review(split, given))).toEqual([]);
    const done = punched(split, given, { perMin: 6, zoom: 1.15 });
    expect(done.dropped).toBe(1);
    expect(shotSets(done.ops).map((op) => op.id)).not.toContain(first);
    expect(errors(review(through(split, done.ops), given))).toEqual([]);
  });

  /**
   * A 15.4 s take cut twice (in its pauses at 5000 and 10000) into three shots, each holding two 200 ms pauses of its own:
   * at 12 a minute the 15.2 s film asks for three punch-ins, which its two cuts cannot give (two punched shots never follow
   * each other), so pauses are split.
   */
  function twoCuts(faceH = 0.25) {
    const inner = [1700, 3300, 6700, 8300, 11700, 13300].map((at) => pause(at - 100, at + 100, at));
    const pauses = [pause(4900, 5100, 5000), pause(9900, 10_100, 10_000), ...inner].sort((a, b) => a.startMs - b.startMs);
    const asset = take(15_400, wordsIn(between(15_400, pauses)));
    const face = { face: { x: 0.35, y: 0.3, w: 0.3, h: faceH }, mouth: { x: 0.45, y: 0.3 + faceH * 0.7, w: 0.1, h: 0.03 } };
    const given = { take: analysis({ pauses, faces: samples(15_400, () => face) }) };
    const shots = [newShot({ id: "a", asset: "take", endMs: 4950 }), newShot({ id: "b", asset: "take", startMs: 5050, endMs: 9950 }), newShot({ id: "c", asset: "take", startMs: 10_050, endMs: 15_400 })];
    return { asset, given, inner, edit: editOf(asset, shots, { y: 0.72 }) };
  }
  const tightAt = (edit: Edit) => {
    const lay = layout(edit);
    return edit.shots.flatMap((shot, i) => (shot.framing.from.zoom > 1 ? [{ i, at: lay.shots[i]!.at }] : []));
  };

  it("reaches 12 a minute on a 30 s take with two cuts by splitting at pauses' cutMs, each held 2 to 5 s, tight and wide in turn, with no error", () => {
    // Shots cut in their pauses at 10.5 and 20.5 s, each with 200 ms pauses of its own every 2.1 s: an in and an out take
    // about 4.2 s, so six fit (with pauses 2.4 s apart, five do).
    const inner = [2100, 4200, 6300, 8400, 12_600, 14_700, 16_800, 18_900, 22_600, 24_700, 26_800].map((at) => pause(at - 100, at + 100, at));
    const pauses = [pause(10_400, 10_600, 10_500), pause(20_400, 20_600, 20_500), ...inner].sort((a, b) => a.startMs - b.startMs);
    const asset = take(30_000, wordsIn(between(30_000, pauses)));
    const given = { take: analysis({ pauses, faces: samples(30_000, () => FACE) }) };
    const shots = [newShot({ id: "a", asset: "take", endMs: 10_450 }), newShot({ id: "b", asset: "take", startMs: 10_550, endMs: 20_450 }), newShot({ id: "c", asset: "take", startMs: 20_550, endMs: 30_000 })];
    const edit = editOf(asset, shots, { y: 0.72 });
    expect(errors(review(edit, given))).toEqual([]);
    const ops = punchIns(edit, given, { perMin: 12, zoom: 1.2 });
    for (const split of ops.filter((op): op is Extract<Op, { op: "shot.split" }> => op.op === "shot.split")) expect(inner.map((each) => each.cutMs)).toContain(split.atMs);
    const punchedEdit = through(edit, ops);
    const lay = layout(punchedEdit);
    const tight = tightAt(punchedEdit);
    expect(tight).toHaveLength(Math.round((12 * lay.frames) / 1800));
    tight.forEach(({ i }) => {
      const frames = lay.shots[i]!.frames;
      expect(frames).toBeGreaterThanOrEqual(60); // 2 s or more
      expect(frames).toBeLessThanOrEqual(150 + 1); // back out, or the film's end, within 5 s: the last shot too (fix round 3)
      expect(punchedEdit.shots[i - 1]?.framing.from.zoom).toBe(1);
      if (i + 1 < punchedEdit.shots.length) expect(punchedEdit.shots[i + 1]?.framing.from.zoom).toBe(1);
    });
    expect(layout(punchedEdit).frames).toBe(layout(edit).frames); // nothing removed
    expect(errors(review(punchedEdit, given))).toEqual([]);
    expect(punchIns(punchedEdit, given, { perMin: 12, zoom: 1.2 })).toEqual([]);
  });

  it("starts punch-ins at least 2 s apart: it passes a cut 1.3 s after a creator's own tight shot for a pause further on", () => {
    // A creator's 0.3 s tight piece at 7.0 s, a wide one to the cut at 8.3 s, then a 7.7 s shot with a pause at 12.1 s.
    const pauses = [pause(6900, 7100, 7000), pause(7200, 7400, 7300), pause(8200, 8600, 8400), pause(12_000, 12_200, 12_100)];
    const asset = take(16_200, wordsIn(between(16_200, pauses)));
    const given = { take: analysis({ pauses, faces: samples(16_200, () => FACE) }) };
    const creators = { ...newShot({ id: "a2", asset: "take", startMs: 7000, endMs: 7300 }), framing: { from: { zoom: 1.2, x: 0, y: 0 }, move: null } };
    const shots = [newShot({ id: "a1", asset: "take", endMs: 7000 }), creators, newShot({ id: "a3", asset: "take", startMs: 7300, endMs: 8300 }), newShot({ id: "b", asset: "take", startMs: 8500, endMs: 16_200 })];
    const edit = editOf(asset, shots, { y: 0.72 });
    expect(errors(review(edit, given))).toEqual([]);
    const starts = tightAt(through(edit, punchIns(edit, given, { perMin: 7.5, zoom: 1.15 }))).map((each) => each.at);
    expect(starts).toEqual([210, 357]); // the creator's at 7.0 s, and 11.9 s of film (12100 of the file), not the cut at 8.3 s
  });

  it("punches in only on the speaker: a shot whose face is not found is never punched (fix round 2)", () => {
    // Two shots cut at 6 s, a pause in each; no face from 5 s to 9.5 s of the file.
    const pauses = [pause(2900, 3100, 3000), pause(5900, 6100, 6000), pause(8900, 9100, 9000)];
    const asset = take(12_000, wordsIn(between(12_000, pauses)));
    const given = { take: analysis({ pauses, faces: samples(12_000, (ms) => (ms >= 5000 && ms < 9500 ? NONE : FACE)) }) };
    const edit = editOf(asset, [newShot({ id: "a", asset: "take", endMs: 5950 }), newShot({ id: "b", asset: "take", startMs: 6050, endMs: 12_000 })], { y: 0.72 });
    const punchedEdit = through(edit, punchIns(edit, given, { perMin: 10, zoom: 1.15 }));
    const tight = punchedEdit.shots.filter((shot) => shot.framing.from.zoom > 1);
    expect(tight.map((shot) => shot.startMs)).toEqual([3000]); // not 9000, where no face is found
    expect(errors(review(punchedEdit, given))).toEqual([]);
  });

  /** A 10 s take cut at 4 s, with a pause at 7 s: one punch-in, at the cut, back out at the pause. Captions at `y`. */
  function held(face: ShareBox, mouth: ShareBox, y: number) {
    const pauses = [pause(3900, 4100, 4000), pause(6900, 7100, 7000)];
    const asset = take(10_000, wordsIn(between(10_000, pauses)));
    const given = { take: analysis({ pauses, faces: samples(10_000, () => ({ face, mouth })) }) };
    const edit = editOf(asset, [newShot({ id: "a", asset: "take", endMs: 3950 }), newShot({ id: "b", asset: "take", startMs: 4050, endMs: 10_000 })], { y });
    return { asset, given, edit, sample: given.take.faces[0]! };
  }

  it("holds the mouth's line when the captions are under the face, so a punch-in is kept that today's framing would drop", () => {
    const { asset, given, edit, sample } = held({ x: 0.3, y: 0.33, w: 0.4, h: 0.42 }, { x: 0.42, y: 0.62, w: 0.16, h: 0.06 }, 0.72);
    expect(errors(review(edit, given))).toEqual([]);
    // Today's framing at 1.2 about the centre brings the mouth into the captions.
    const today = through(edit, [{ op: "shot.split", id: "b", atMs: 7000, newId: "x" }, { op: "shot.set", id: "b", framing: { from: { zoom: 1.2, x: 0, y: 0 }, move: null } }]);
    expect(errors(review(today, given)).map((finding) => finding.code)).toContain("on-face");
    const sets = shotSets(punchIns(edit, given, { perMin: 6, zoom: 1.2 }));
    expect(sets).toHaveLength(1);
    const from = sets[0]!.framing!.from;
    expect(from.zoom).toBe(1.2);
    const video = asset.kind === "video" ? asset : { w: 1, h: 1 };
    const [before, after] = [faceOnStage(sample, video, { zoom: 1, x: 0, y: 0 }).mouth!, faceOnStage(sample, video, from).mouth!];
    expect(after.y + after.h).toBeLessThanOrEqual(before.y + before.h + 1e-6);
    expect(errors(review(through(edit, punchIns(edit, given, { perMin: 6, zoom: 1.2 })), given))).toEqual([]);
  });

  it("holds the face's top when the captions are over it", () => {
    const { asset, given, edit, sample } = held({ x: 0.3, y: 0.33, w: 0.4, h: 0.42 }, { x: 0.42, y: 0.62, w: 0.16, h: 0.06 }, 0.3);
    expect(errors(review(edit, given))).toEqual([]);
    const sets = shotSets(punchIns(edit, given, { perMin: 6, zoom: 1.2 }));
    expect(sets).toHaveLength(1);
    const video = asset.kind === "video" ? asset : { w: 1, h: 1 };
    const [before, after] = [faceOnStage(sample, video, { zoom: 1, x: 0, y: 0 }).face!, faceOnStage(sample, video, sets[0]!.framing!.from).face!];
    expect(after.y).toBeGreaterThanOrEqual(before.y - 1e-6);
    expect(errors(review(through(edit, punchIns(edit, given, { perMin: 6, zoom: 1.2 })), given))).toEqual([]);
  });

  it("holds a punch-in 2 to 5 s: to the longest pause starting in that window, never one nearer; none at all under 2 s", () => {
    // In at the cut at 3 s; pauses start 1.35 s on (too near), 2.75 s on (200 ms) and 4.35 s on (400 ms, the longest).
    const pauses = [pause(2900, 3100, 3000), pause(4400, 4550, 4475), pause(5800, 6000, 5900), pause(7400, 7800, 7600)];
    const asset = take(10_000, wordsIn(between(10_000, pauses)));
    const given = { take: analysis({ pauses, faces: samples(10_000, () => FACE) }) };
    const edit = editOf(asset, [newShot({ id: "a", asset: "take", endMs: 2950 }), newShot({ id: "b", asset: "take", startMs: 3050, endMs: 10_000 })], { y: 0.72 });
    const ops = punchIns(edit, given, { perMin: 6, zoom: 1.15 });
    const splits = ops.filter((op): op is Extract<Op, { op: "shot.split" }> => op.op === "shot.split").map((op) => op.atMs);
    expect(splits).toEqual([7600]);
    expect(through(edit, ops).shots.find((shot) => shot.framing.from.zoom > 1)).toMatchObject({ startMs: 3050, endMs: 7600 });
    // A shot that ends 1.5 s after its only place to start gets none.
    const short = editOf(take(4500, wordsIn(between(4500, [pause(2900, 3100, 3000)]))), undefined, { y: 0.72 });
    expect(punchIns(short, { take: analysis({ pauses: [pause(2900, 3100, 3000)], faces: samples(4500, () => FACE) }) }, { perMin: 13, zoom: 1.15 })).toEqual([]);
  });

  it("makes no punch-in that has no way out: a 15 s take with no pause after its first seconds (fix round 3, the reviewer's probe)", () => {
    // One shot, one pause at 2.1 s: a punch-in there would hold 12.9 s to the film's end; nothing lies 2 to 8 s on.
    const pauses = [pause(2000, 2200, 2100)];
    const asset = take(15_000, wordsIn(between(15_000, pauses)));
    const given = { take: analysis({ pauses, faces: samples(15_000, () => FACE) }) };
    expect(punchIns(editOf(asset, undefined, { y: 0.72 }), given, { perMin: 6, zoom: 1.15 })).toEqual([]);
  });

  it("goes back out at the first pause up to 8 s on when none lies 2 to 5 s on (fix round 3)", () => {
    // In at the cut at 3 s; the only pause of the shot after it is 6.45 s on.
    const pauses = [pause(2900, 3100, 3000), pause(9400, 9600, 9500)];
    const asset = take(12_000, wordsIn(between(12_000, pauses)));
    const given = { take: analysis({ pauses, faces: samples(12_000, () => FACE) }) };
    const edit = editOf(asset, [newShot({ id: "a", asset: "take", endMs: 2950 }), newShot({ id: "b", asset: "take", startMs: 3050, endMs: 12_000 })], { y: 0.72 });
    const ops = punchIns(edit, given, { perMin: 5, zoom: 1.15 });
    expect(ops.filter((op) => op.op === "shot.split").map((op) => (op as Extract<Op, { op: "shot.split" }>).atMs)).toEqual([9500]);
    expect(through(edit, ops).shots.find((shot) => shot.framing.from.zoom > 1)).toMatchObject({ startMs: 3050, endMs: 9500 });
  });

  /** Three shots cut in pauses at 3 s and at `second` ms, with pauses of 200 ms at `inner`; at 8 a minute, two slots, the first holding only the cut at 3 s. */
  function threeShots(second: number, inner: number[]) {
    const pauses = [pause(2900, 3100, 3000), pause(second - 100, second + 100, second), ...inner.map((at) => pause(at - 100, at + 100, at))].sort((a, b) => a.startMs - b.startMs);
    const asset = take(16_000, wordsIn(between(16_000, pauses)));
    const given = { take: analysis({ pauses, faces: samples(16_000, () => FACE) }) };
    const shots = [newShot({ id: "a", asset: "take", endMs: 2950 }), newShot({ id: "b", asset: "take", startMs: 3050, endMs: second - 50 }), newShot({ id: "c", asset: "take", startMs: second + 50, endMs: 16_000 })];
    return { given, edit: editOf(asset, shots, { y: 0.72 }) };
  }
  const tightOf = (edit: Edit, given: Analyses) => through(edit, punchIns(edit, given, { perMin: 8, zoom: 1.15 })).shots.filter((shot) => shot.framing.from.zoom > 1);

  it("goes back out at a cut up to 8 s on when nothing lies 2 to 5 s on, and makes none with the cut 9 s on (fix round 5)", () => {
    // In at 3 s; no pause in the second shot; its cut at 10 s (7 s on), or at 12 s (9 s on).
    const near = threeShots(10_000, [14_000]);
    expect(tightOf(near.edit, near.given).map((shot) => [shot.startMs, shot.endMs])).toContainEqual([3050, 9950]);
    const far = threeShots(12_000, [14_500]);
    expect(tightOf(far.edit, far.given).map((shot) => shot.startMs)).not.toContain(3050);
  });

  it("runs on to the next cut rather than leave under 1 s of wide picture before it (fix round 5)", () => {
    // In at 3 s; a pause starting 4.6 s on (its cut 4.7 s on) and the shot's cut 5.4 s on: going out at the pause would leave
    // 0.7 s of wide picture before the cut, so the punched stretch runs on to the cut.
    const { given, edit } = threeShots(8450, [7750, 13_000]);
    const tight = tightOf(edit, given);
    expect(tight.map((shot) => [shot.startMs, shot.endMs])).toContainEqual([3050, 8400]);
    expect(through(edit, punchIns(edit, given, { perMin: 8, zoom: 1.15 })).shots.some((shot) => shot.startMs === 7750)).toBe(false);
  });

  it("leaves at least a second of wide picture before a punch-in, or starts it at the cut itself (final fix wave, the reviewer's probe)", () => {
    // A cut at 5.0 s in a pause; the face sample at 5.0 s finds no face, so the punch-in at that cut falls away; a 160 ms pause
    // at 5.40 to 5.56 s, 0.33 s into the shot after the cut, would have been taken, leaving ten frames of wide picture.
    const pauses = [pause(4900, 5200, 5050), pause(5400, 5560, 5480), pause(8000, 8120, 8060), pause(12_000, 12_200, 12_100), pause(15_000, 15_200, 15_100)];
    const asset = take(20_000, wordsIn(between(20_000, pauses)));
    const given = { take: analysis({ pauses, faces: samples(20_000, (ms) => (ms === 5000 ? NONE : FACE)) }) };
    const edit = editOf(asset, [newShot({ id: "a", asset: "take", endMs: 5000 }), newShot({ id: "b", asset: "take", startMs: 5150, endMs: 20_000 })], { y: 0.72 });
    const ops = punchIns(edit, given, { perMin: 6, zoom: 1.15 });
    const after = through(edit, ops);
    const lay = layout(after);
    expect(after.shots.some((shot) => shot.framing.from.zoom > 1)).toBe(true); // a punch-in is still made, further on
    after.shots.forEach((shot, i) => {
      const before = after.shots[i - 1];
      if (shot.framing.from.zoom === 1 || !before) return;
      // Either the shot before it ends at a cut of the creator's (a, b), or it is wide picture of a second or more.
      const wide = lay.shots[i - 1]?.frames ?? 0;
      expect(before.id === "a" || wide >= 30, `${before.id} before ${shot.id}: ${wide} frames`).toBe(true);
    });
    expect(after.shots.map((shot) => shot.startMs)).not.toContain(5480);
    expect(punchIns(after, given, { perMin: 6, zoom: 1.15 })).toEqual([]); // a second run
  });

  it("splits at the pause before a stressed word over a longer pause elsewhere, and at the longest pause with no stress", () => {
    // One shot of 6 s, one punch-in at 10 a minute: a 600 ms pause at 2000, a 200 ms one at 3900 that a word follows 200 ms later.
    const pauses = [pause(2000, 2600, 2300), pause(3900, 4100, 4000)];
    const plain = wordsIn(between(6000, pauses)).map((word) => ({ ...word }));
    const at = plain.findIndex((word) => word.startMs >= 4100);
    plain[at] = { ...plain[at]!, startMs: 4300 };
    const stressed = plain.map((word, i) => (i === at ? { ...word, stress: true as const } : word));
    const given = { take: analysis({ pauses, faces: samples(6000, () => FACE) }) };
    const splitAt = (words: Word[]) => {
      const asset = take(6000, words);
      const ops = punchIns(editOf(asset, undefined, { y: 0.72 }), given, { perMin: 10, zoom: 1.15 });
      return ops.filter((op): op is Extract<Op, { op: "shot.split" }> => op.op === "shot.split").map((op) => op.atMs)[0];
    };
    expect(splitAt(plain)).toBe(2300);
    expect(splitAt(stressed)).toBe(4000);
  });

  it("holds the zoom so the face stays at most 0.62 of the stage's height, and punches none into a face 0.6 high", () => {
    const fitting = twoCuts(0.5); // 0.62 / 0.5 = 1.24: the zoom asked, 1.3, is held to it
    const sets = shotSets(punchIns(fitting.edit, fitting.given, { perMin: 12, zoom: 1.3 }));
    expect(sets.length).toBeGreaterThan(0);
    for (const op of sets) expect(op.framing?.from.zoom).toBe(1.24);
    const filling = twoCuts(0.6); // 0.62 / 0.6 = 1.03, under 1.08
    expect(punchIns(filling.edit, filling.given, { perMin: 12, zoom: 1.3 })).toEqual([]);
  });

  it("raises a zoom asked under 1.08 to 1.08, the least a viewer sees, and the match reads it as near (fix round 4)", () => {
    const { given, edit } = sixty();
    // 1.05, the least a style may ask: 0.03 under 1.08, past the match's 0.02 for the same.
    const sets = shotSets(punchIns(edit, given, { perMin: 6, zoom: 1.05 }));
    expect(sets).toHaveLength(6);
    for (const op of sets) expect(op.framing?.from.zoom).toBe(1.08);
    const style: StyleProfile = { ...DEFAULT_STYLE, captions: { ...DEFAULT_STYLE.captions, y: 0.72 }, punchIns: { perMin: 6, zoom: 1.05 } };
    const zoom = matchOf(style, through(edit, sets), given).fields.find((field) => field.field === "punchIns.zoom");
    expect(zoom).toMatchObject({ target: "1.05", actual: "1.08", verdict: "near" });
  });

  it("does not take a captions error the edit already has for a new one after a split renames its shot (fix round 3)", () => {
    // In at the cut at 3 s, back out at the pause at 6 s; from 8 s the face drops and the captions cover its mouth, in the
    // piece after the way out, whose shot is renamed by the split.
    const pauses = [pause(2900, 3100, 3000), pause(5900, 6100, 6000)];
    const asset = take(12_000, wordsIn(between(12_000, pauses)));
    const dropped = { face: { x: 0.3, y: 0.45, w: 0.4, h: 0.3 }, mouth: { x: 0.4, y: 0.69, w: 0.2, h: 0.05 } };
    const given = { take: analysis({ pauses, faces: samples(12_000, (ms) => (ms < 8000 ? FACE : dropped)) }) };
    const edit = editOf(asset, [newShot({ id: "a", asset: "take", endMs: 2950 }), newShot({ id: "b", asset: "take", startMs: 3050, endMs: 12_000 })], { y: 0.72 });
    const before = errors(review(edit, given));
    expect(before.map((finding) => [finding.code, finding.where.shot])).toEqual([["on-face", "b"]]);
    const ops = punchIns(edit, given, { perMin: 5, zoom: 1.15 });
    const punchedEdit = through(edit, ops);
    expect(punchedEdit.shots.find((shot) => shot.framing.from.zoom > 1)).toMatchObject({ startMs: 3050, endMs: 6000 });
    expect(errors(review(punchedEdit, given)).map((finding) => finding.says)).toEqual(before.map((finding) => finding.says));
  });

  it("gives nothing at 0 a minute, and refuses a rate or a zoom out of range", () => {
    const { given, edit } = sixty();
    expect(punchIns(edit, given, { perMin: 0, zoom: 1.15 })).toEqual([]);
    expect(() => punchIns(edit, given, { perMin: 31, zoom: 1.15 })).toThrow(RangeError);
    expect(() => punchIns(edit, given, { perMin: 6, zoom: 1.04 })).toThrow(RangeError);
    expect(() => punchIns(edit, given, { perMin: 6, zoom: 1.31 })).toThrow(RangeError);
  });
});

describe("the recipes are pure", () => {
  it("give the same ops for the same input, and touch nothing they are given", () => {
    const { given, edit } = sixty();
    const before = structuredClone({ edit, given });
    const run = () => [tighten(edit, given, { pauseMs: 150 }), placeCaptions(edit, given), levelVoice(edit, given), punchIns(edit, given, { perMin: 6, zoom: 1.15 })];
    expect(run()).toEqual(run());
    expect({ edit, given }).toEqual(before);
  });
});
