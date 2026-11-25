/**
 * The first cut (part 3, Tasks 10 and 10b), with its two network boundaries stood in for: Qwen's `ask` (a list of canned answers
 * on a clock of the test's own) and the worker's `stills` (stand-in JPEGs). The recipes, the door (`applyOps`, `checkEdit`),
 * `review`, `change` and `matchOf` are the real ones, on a made-up take.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Analyses, FaceSample, TakeAnalysis } from "../../analysis";
import { layout, placed } from "../../derive";
import type { Asset, Edit } from "../../doc";
import { applyOps, type Op } from "../../ops";
import { levelVoice, placeCaptions, placeTitle, punchIns, tighten } from "../../recipes";
import { review, type Finding } from "../../review";
import { HOUSE_STYLE } from "../../style/house";
import { matchOf } from "../../style/match";
import { presetOf } from "../../style/presets";
import type { StyleProfile } from "../../style/profile";
import type { stillsOf } from "../../worker/stills";
import { firstEdit } from "../../worker/takes";
import { catalogue } from "../catalogue";
import { evenLine } from "../context";
import { ChoicesSchema, FILLERS, FIX_REQUEST, HOOK, HOOK_EXAMPLE, MARKED, firstCut, hookLines, thinned, type FirstCutInput , repeatsOpening } from "../first-cut";
import type { Ask, Message } from "../model";

/* ── a made-up take: 8 s, 720x1280, twelve words, five pauses (three of 500 ms inside), the face in the middle ─────────── */

const TAKE_MS = 8000;
const WORDS = [
  { text: "Stop", startMs: 300, endMs: 600 },
  { text: "scrolling", startMs: 620, endMs: 1000 },
  { text: "this", startMs: 1500, endMs: 1800 },
  { text: "changes", startMs: 1820, endMs: 2300 },
  { text: "everything", startMs: 2320, endMs: 2900 },
  { text: "you", startMs: 3400, endMs: 3700 },
  { text: "know", startMs: 3720, endMs: 4100 },
  { text: "about", startMs: 4120, endMs: 4600 },
  { text: "editing", startMs: 5100, endMs: 5700 },
  { text: "your", startMs: 5720, endMs: 6000 },
  { text: "videos", startMs: 6020, endMs: 6600 },
  { text: "today", startMs: 6620, endMs: 7500 },
];
const PAUSES = [
  { startMs: 0, endMs: 300, cutMs: 150 },
  { startMs: 1000, endMs: 1500, cutMs: 1250 },
  { startMs: 2900, endMs: 3400, cutMs: 3150 },
  { startMs: 4600, endMs: 5100, cutMs: 4850 },
  { startMs: 7500, endMs: 8000, cutMs: 7750 },
];
/** The face five times a second, from `top` down `h` of the picture's height, its mouth two thirds of the way down it. */
const facesAt = (top: number, h: number): FaceSample[] =>
  Array.from({ length: TAKE_MS / 200 }, (_, i) => ({ ms: i * 200, face: { x: 0.3, y: top, w: 0.4, h }, mouth: { x: 0.42, y: top + h * 0.65, w: 0.16, h: h * 0.12 } }));
/** Louder in the first phrase (-20) than in the rest (-26), silence in the pauses: `levelVoice` turns the first shot down. */
const LOUDNESS: TakeAnalysis["loudness"] = {
  lufs: -24, truePeak: -3,
  levels: Array.from({ length: TAKE_MS / 100 }, (_, i) => {
    const ms = i * 100;
    const quiet = PAUSES.some((pause) => pause.startMs <= ms && ms < pause.endMs);
    return { ms, lufs: quiet ? -70 : ms < 1000 ? -20 : -26 };
  }),
};
const analysisWith = (faces: FaceSample[]): TakeAnalysis => ({ language: "en", pauses: PAUSES, faces, loudness: LOUDNESS });
/** The face from 0.3 to 0.5 of the height: clear of the captions low and at 0.62, and of a title at 0.2 or 0.18 above it. */
const MIDDLE = analysisWith(facesAt(0.3, 0.2));
/** The face from 0.08 to 0.35: a title at 0.2 covers the eyes. */
const HIGH = analysisWith(facesAt(0.08, 0.27));
/** A face at three heights in turn, 0.6 s each: no place and no size keeps the captions off its eyes or mouth. */
const MOVING = analysisWith(
  Array.from({ length: TAKE_MS / 200 }, (_, i) => ({
    ms: i * 200,
    ...[
      { face: { x: 0.2, y: 0.4, w: 0.6, h: 0.4 }, mouth: { x: 0.4, y: 0.6, w: 0.2, h: 0.2 } },
      { face: { x: 0.2, y: 0.1, w: 0.6, h: 0.4 }, mouth: { x: 0.4, y: 0.3, w: 0.2, h: 0.2 } },
      { face: { x: 0.2, y: 0.58, w: 0.6, h: 0.4 }, mouth: { x: 0.4, y: 0.84, w: 0.2, h: 0.06 } },
    ][Math.floor((i * 200) / 600) % 3]!,
  })),
);

const TAKE: Asset = {
  id: "take", kind: "video", origin: "filmed", at: { bucket: "edit-media", path: "u1/take.mp4" },
  ms: TAKE_MS, w: 720, h: 1280, sound: true, words: WORDS.map((word) => ({ ...word })),
};

const through = (edit: Edit, ops: Op[]): Edit => {
  if (ops.length === 0) return edit;
  const made = applyOps(edit, ops, [TAKE]);
  if (!made.ok) throw new Error(made.problems.map((problem) => `${problem.path}: ${problem.message}`).join("; "));
  return made.edit;
};
const errors = (findings: Finding[]) => findings.filter((finding) => finding.severity === "error");
const titleOf = (edit: Edit) => edit.items.find((item) => item.part === "title");
const stressedOf = (edit: Edit) => {
  const asset = edit.assets.find((each) => each.kind === "video");
  return asset?.kind === "video" ? (asset.words ?? []).flatMap((word, i) => (word.stress ? [i] : [])) : [];
};
const punchedOf = (edit: Edit) => edit.shots.filter((shot) => shot.framing.from.zoom > 1).length;

/** A style as Task 9's profiles hold one: highlight captions at 0.62, a label title at 0.18 for two seconds, six punch-ins a minute. */
const STYLE: StyleProfile = {
  source: { kind: "preset", name: "test" },
  pace: { pauseMs: 180, cutsPerMin: null },
  captions: { on: true, look: "highlight", font: "tiktok", size: 72, y: 0.62, maxWords: 3, highlight: "#ffe14a" },
  title: { on: true, y: 0.18, frames: 60, look: "label", size: 110 },
  punchIns: { perMin: 6, zoom: 1.2 },
  look: { preset: "warm" },
  notMatched: ["emoji"],
};
/** The largest of Task 8's candidate labels (84 px, 600): a hook within two lines here is within them at every candidate size. */
const LARGEST_LABEL: NonNullable<StyleProfile["title"]> = { on: true, y: 0.2, frames: 75, look: "label", size: 84, stays: true, ink: "#111111", weight: 600 };

/* ── the two boundaries ────────────────────────────────────────────────────────────────────────────────────────────────── */

/** One canned answer: its text, whether it stopped at the token limit, and how long it takes on the test's clock; or an Error, a failed call. */
type Canned = string | { text: string; truncated?: boolean; takesMs?: number } | Error;

/** Qwen, as a list of canned answers, each taking a second on the test's clock unless it says; `wait` waits on that clock. */
function scripted(answers: Canned[]) {
  const clock = { t: 0 };
  const calls: Message[][] = [];
  const waits: number[] = [];
  const ask: Ask = async (messages) => {
    calls.push(structuredClone(messages));
    const next = answers.shift();
    if (next === undefined) throw new Error("the script has no answer left");
    if (next instanceof Error) throw next;
    const { text, truncated = false, takesMs = 1000 } = typeof next === "string" ? { text: next } : next;
    clock.t += takesMs;
    return { text, usage: { input: 3000, output: 80 }, ms: takesMs, truncated };
  };
  const wait = async (ms: number) => {
    waits.push(ms);
    clock.t += ms;
  };
  return { ask, calls, waits, wait, now: () => clock.t };
}
const chose = (over: Record<string, unknown> = {}): string => JSON.stringify({ title: "Edit *smarter*", short: "*Smarter*", stress: [1, 4], look: "vivid", pauseMs: 200, ...over });
const answer = (say: string, ops: unknown[]): string => JSON.stringify({ say, ops });

/** The worker's stills: each frame asked as a stand-in JPEG. */
function drawer() {
  const calls: number[][] = [];
  const stills: typeof stillsOf = async (_user, _edit, frames) => {
    calls.push([...frames]);
    return frames.map((frame) => ({ frame, jpeg: Buffer.from(`jpeg ${frame}`).toString("base64") }));
  };
  return { stills, calls };
}

const input = (over: Partial<FirstCutInput> = {}): FirstCutInput => ({ asset: TAKE, analysis: MIDDLE, user: "u1", deadlineMs: 170_000, ...over });
const analysesOf = (analysis: TakeAnalysis): Analyses => ({ take: analysis });

const textOf = (message: Message | undefined): string => {
  if (!message) return "";
  return typeof message.content === "string" ? message.content : message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
};
const lastUser = (messages: Message[] = []) => textOf(messages.filter((message) => message.role === "user").at(-1));

/**
 * The first cut as the briefs' steps make it from the real recipes, in their order: the edit the test expects. `profile` is the
 * style or the house's; with no style, the pace is the choices'. The look is the profile's, the house's natural too (X129).
 * The title as `titleOp` sets it: held to the end when it stays, in the profile's ink or white, at its weight when it has one,
 * its marked words in the captions' colour, or `MARKED` for a preset's or words' captions with none. Captions that draw every
 * word alike (the house's) end with no word stressed: the stresses placed the punch-ins, and are then left out (Task 9b, 2a).
 */
function expectedCut(analysis: TakeAnalysis, profile: StyleProfile, styled: boolean, choices: { title: string | null; stress: number[]; pauseMs: number }, keepStress = false, take: Asset = TAKE): Edit {
  const given = analysesOf(analysis);
  let edit = firstEdit(take);
  edit = through(edit, tighten(edit, given, { pauseMs: styled ? profile.pace.pauseMs : choices.pauseMs }));
  edit = through(edit, [{ op: "captions.set", ...profile.captions }, ...choices.stress.map((index): Op => ({ op: "word.set", asset: "take", index, stress: true }))]);
  edit = through(edit, placeCaptions(edit, given));
  if (profile.punchIns) edit = through(edit, punchIns(edit, given, profile.punchIns));
  edit = through(edit, levelVoice(edit, given));
  if (choices.title !== null && profile.title?.on) {
    const { y, frames, look, size, stays, ink, weight } = profile.title;
    const accent = profile.captions.highlight ?? (profile.source.kind === "preset" || profile.source.kind === "words" ? MARKED : null);
    const props = { text: choices.title, font: "tiktok" as const, look, y, size, color: ink ?? "#ffffff", accent, ...(weight !== undefined && { weight }) };
    edit = through(edit, [{ op: "item.add", item: { id: "hook", part: "title", anchor: "start", at: 0, frames: stays ? null : frames, props } }]);
    edit = through(edit, placeTitle(edit, given, "hook"));
  }
  edit = through(edit, [{ op: "look.set", preset: profile.look.preset }]);
  return evenLine(edit.captions) && !keepStress ? unstressed(edit) : edit;
}

/** The edit with no word stressed. */
const unstressed = (edit: Edit): Edit => ({ ...edit, assets: edit.assets.map((asset) => (asset.kind === "video" && asset.words ? { ...asset, words: asset.words.map(({ stress: _stress, ...word }) => word) } : asset)) });

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

/* ── the tests ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe("the fixture", () => {
  it("has a first edit whose captions sit under the apps' bars, and a face clear of the captions at 0.72", () => {
    const given = analysesOf(MIDDLE);
    expect(errors(review(firstEdit(TAKE), given)).map((finding) => finding.code)).toContain("under-buttons");
    expect(errors(review(through(firstEdit(TAKE), [{ op: "captions.set", y: 0.72 }]), given))).toEqual([]);
    expect(errors(review(through(firstEdit(TAKE), [{ op: "captions.set", y: 0.4 }]), given)).map((finding) => finding.code)).toContain("on-face");
  });
});

describe("firstCut: no style, the house style", () => {
  it("asks once with the catalogue's title, call-out and look lines, the words and pauses, how to choose stresses and the title's asterisks", async () => {
    const qwen = scripted([chose()]);
    await firstCut(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });

    expect(qwen.calls).toHaveLength(1);
    const [system, user] = qwen.calls[0] ?? [];
    const lines = catalogue().split("\n");
    const line = (head: string) => lines.find((each) => each.startsWith(head)) ?? `no line ${head}`;
    for (const head of ["title — ", "  title.props ", "callout — ", "  callout.props ", "look.set ", "  warm: ", "- words: ", "- pauses: "]) {
      expect(textOf(system)).toContain(line(head));
    }
    expect(textOf(system)).toContain("never a filler (is, are, be, will, the, and, so");
    expect(textOf(system)).toContain("never two neighbours, and at most one in any three words in a row");
    expect(textOf(system)).toContain("*asterisks*");
    expect(textOf(system)).toContain("at most 8 words and 44 characters, on at most two lines");
    expect(textOf(system)).toContain("a claim of what the viewer gets from the video (its news, its result or its promise)");
    expect(textOf(system)).toContain("from the most concrete thing the take says, wherever it says it");
    expect(textOf(system)).toContain("never the greeting, where the speaker is, that they have returned or what they are doing");
    expect(textOf(system)).toContain("nothing the take does not say; never a question");
    expect(textOf(system)).toContain("at most 3 words and 18 characters");
    expect(textOf(system)).not.toMatch(/"say"/);
    expect(textOf(user)).toContain("w1 scrolling [620,1000)");
    expect(textOf(user)).toContain("[1000,1500) cut@1250");
    expect(textOf(user)).not.toContain("style:");
  });

  it("cuts with the native captions, a label that stays to the end in dark letters at 600, no colour on any word, Qwen's pace and the natural look, and no errors", async () => {
    const qwen = scripted([chose()]);
    const worker = drawer();
    const result = await firstCut(input(), { ask: qwen.ask, stills: worker.stills, now: qwen.now });

    const expected = expectedCut(MIDDLE, HOUSE_STYLE, false, { title: "Edit *smarter*", stress: [1, 4], pauseMs: 200 });
    expect(result.edit).toEqual(expected);
    expect(result.edit).toEqual(through(firstEdit(TAKE), result.ops));
    // Tightened at Qwen's 200 ms: the three pauses inside cut down, the head and the tail trimmed to the words.
    expect(result.edit.shots.filter((shot) => shot.framing.from.zoom === 1).map((shot) => [shot.startMs, shot.endMs])).toContainEqual([200, 1100]);
    // Every piece of this 8 s take is under 3 s of film, so none is levelled on its own (fix round 2).
    expect(result.edit.shots.every((shot) => shot.volume === 1)).toBe(true);
    // The size and words a page are what the fit leaves; the rest is the house's.
    expect(result.edit.captions).toMatchObject({ look: "plain", font: "tiktok", highlight: null, weight: 600 });
    expect(result.edit.captions.size).toBeLessThanOrEqual(64);
    expect(result.edit.captions.maxWords).toBeLessThanOrEqual(5);
    expect(titleOf(result.edit)).toMatchObject({ id: "hook", anchor: "start", at: 0, frames: null, props: { text: "Edit *smarter*", look: "label", size: 72, color: "#111111", accent: null, weight: 600 } });
    // The stresses chose where the punch-ins land; the house's even line shows none, so none is left in the edit (Task 9b, 2a).
    expect(stressedOf(result.edit)).toEqual([]);
    expect(result.edit.look.preset).toBe("natural");
    expect(errors(result.findings)).toEqual([]);
    expect(result.rounds.map((round) => round.outcome)).toEqual(["chosen"]);
    expect(result.choices).toEqual({ title: "Edit *smarter*", short: "*Smarter*", stress: [1, 4], look: "vivid", pauseMs: 200 });
    expect(result.match).toBeNull();
    expect(worker.calls).toEqual([]);
    const seconds = (edit: Edit) => (layout(edit).frames / 30).toFixed(1);
    const punched = punchedOf(result.edit);
    const carries = punched === 0 ? "a title" : `a title and ${punched === 1 ? "a punch-in" : `${punched} punch-ins`}`;
    expect(result.say).toBe(`Your first cut runs ${seconds(result.edit)} s, down from ${seconds(firstEdit(TAKE))} s, with ${carries}; its captions are plain white words.`);
  });

  it("tells Qwen the look is natural with no style, and sets natural whatever it answers (X129)", async () => {
    const qwen = scripted([chose({ look: "warm" })]);
    const result = await firstCut(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(lastUser(qwen.calls[0])).toContain('answer look "natural"');
    expect(result.edit.look.preset).toBe("natural");
    expect(result.choices.look).toBe("warm");
  });

  it("keeps the house's title to the film's end after a later cut", async () => {
    const qwen = scripted([chose()]);
    const { edit } = await firstCut(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    const last = edit.shots.at(-1)!;
    const trimmed = through(edit, [{ op: "shot.trim", id: last.id, endMs: last.endMs - 1000 }]);
    const title = placed(trimmed).find((each) => each.thing.id === "hook");
    expect(layout(trimmed).frames).toBeLessThan(layout(edit).frames);
    expect(title).toMatchObject({ at: 0, frames: layout(trimmed).frames });
  });

  it("thins the stresses: never two neighbours, at most one in any three words in a row, the later one dropped", async () => {
    expect(thinned([4, 1, 2, 3, 7, 7, 8])).toEqual([1, 4, 7]);
    // No filler among them (Task 12b drops those first): scrolling, changes, everything, editing.
    const qwen = scripted([chose({ stress: [1, 3, 4, 8] })]);
    // On a style whose captions show a stress: the house's even line keeps none (Task 9b, 2a).
    const result = await firstCut(input({ style: STYLE }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(stressedOf(result.edit)).toEqual([1, 4, 8]);
    expect(result.choices.stress).toEqual([1, 3, 4, 8]);
  });

  it("asks once more for a hook that repeats the take's opening words, and keeps whatever comes (Task 14b, ruling 6)", async () => {
    // The take opens "Stop scrolling this changes everything you": a hook made of those words stands on screen twice.
    expect(repeatsOpening("Stop scrolling, this changes", WORDS)).toBe(true);
    expect(repeatsOpening("This'll surprise you all", WORDS)).toBe(false); // two of four ("this'll" counts as "this"): half, not more
    expect(repeatsOpening("Edit smarter", WORDS)).toBe(false);
    expect(repeatsOpening("We're *scrolling*", [{ text: "We" }, { text: "are" }, { text: "scrolling." }])).toBe(true);
    const qwen = scripted([chose({ title: "Stop *scrolling* this", short: "Stop *scrolling*" }), chose()]);
    const result = await firstCut(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(result.rounds.map((round) => round.outcome)).toEqual(["refused", "chosen"]);
    expect(lastUser(qwen.calls[1])).toContain('The title repeats the take\'s opening words ("Stop scrolling this changes everything you"), which the captions show at the same moment.');
    expect(result.edit.items.find((item) => item.part === "title")?.props).toMatchObject({ text: "Edit *smarter*" });
    // Once only: a second hook of the opening's words is kept.
    const again = scripted([chose({ title: "Stop *scrolling* this", short: "Stop *scrolling*" }), chose({ title: "This changes *everything*", short: "*Everything* changes" })]);
    const kept = await firstCut(input(), { ask: again.ask, stills: drawer().stills, now: again.now });
    expect(again.calls).toHaveLength(2);
    expect(kept.edit.items.find((item) => item.part === "title")?.props).toMatchObject({ text: "This changes *everything*" });
  });

  it("keeps the first answer when nothing readable comes after the hook's re-ask: a title that repeats is better than none (the final review)", async () => {
    const qwen = scripted([chose({ title: "Stop *scrolling* this", short: "Stop *scrolling*" }), "{", "{"]);
    const result = await firstCut(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(result.rounds.slice(0, 3).map((round) => round.outcome)).toEqual(["refused", "unreadable", "unreadable"]);
    expect(result.edit.items.find((item) => item.part === "title")?.props).toMatchObject({ text: "Stop *scrolling* this" });
    expect(result.say).not.toContain("I couldn't choose a title");
  });

  it("repairs a hook that ends in a question mark: round 2 says so, and the cut takes the repaired hook", async () => {
    const qwen = scripted([chose({ title: "Does your bread rise?", short: "Bread *rises*" }), chose()]);
    const result = await firstCut(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(result.rounds.map((round) => round.outcome)).toEqual(["unreadable", "chosen"]);
    expect(lastUser(qwen.calls[1])).toContain("title: ends in a question mark");
    expect(titleOf(result.edit)?.props).toMatchObject({ text: "Edit *smarter*" });
  });

  it("repairs choices with pauseMs 50: round 2 quotes the range, and the cut uses the repaired pause", async () => {
    const qwen = scripted([chose({ pauseMs: 50 }), chose({ pauseMs: 300 })]);
    const result = await firstCut(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });

    expect(result.rounds.map((round) => round.outcome)).toEqual(["unreadable", "chosen"]);
    const repair = lastUser(qwen.calls[1]);
    expect(repair).toContain("pauseMs: must be a whole number from 120 to 400");
    expect(qwen.calls[1]?.at(-2)).toEqual({ role: "assistant", content: chose({ pauseMs: 50 }) });
    expect(result.edit).toEqual(expectedCut(MIDDLE, HOUSE_STYLE, false, { title: "Edit *smarter*", stress: [1, 4], pauseMs: 300 }));
  });

  it("repairs a stressed word the take does not have, naming its words' range; and says an answer cut off at the token limit was", async () => {
    const qwen = scripted([chose({ stress: [3, 12] }), { text: '{"title": "Edit', truncated: true }, chose({ stress: [3] })]);
    const result = await firstCut(input({ style: STYLE }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(lastUser(qwen.calls[1])).toContain("stress.1: is w12; the take's words are w0 to w11");
    expect(lastUser(qwen.calls[2])).toContain("Your answer stopped at the token limit before it ended");
    expect(stressedOf(result.edit)).toEqual([3]);
  });

  it("asks again after a failed call, a second later, and stops asking when the deadline passes", async () => {
    const busy = scripted([new Error("503 busy"), chose()]);
    const asked = await firstCut(input(), { ask: busy.ask, stills: drawer().stills, now: busy.now, wait: busy.wait });
    expect(asked.rounds.map((round) => [round.outcome, round.error])).toEqual([["no answer", "the model did not answer: 503 busy"], ["chosen", null]]);
    expect(busy.waits).toEqual([1000]);

    const slow = scripted([{ text: "{", takesMs: 9000 }, chose()]);
    const late = await firstCut(input({ deadlineMs: 5000 }), { ask: slow.ask, stills: drawer().stills, now: slow.now, wait: slow.wait });
    expect(slow.calls).toHaveLength(1);
    expect(late.choices).toEqual({ title: null, short: null, stress: [], look: "natural", pauseMs: 250 });
  });

  it("takes choices that carry a say (left aside) and choices without one", () => {
    expect(ChoicesSchema.parse(JSON.parse(chose({ say: "I opened with a hook." })))).toEqual(JSON.parse(chose()));
    expect(ChoicesSchema.safeParse(JSON.parse(chose())).success).toBe(true);
  });

  it("gives title: null no title, and says nothing of one", async () => {
    const qwen = scripted([chose({ title: null })]);
    const result = await firstCut(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(titleOf(result.edit)).toBeUndefined();
    expect(result.ops.some((op) => op.op === "item.add")).toBe(false);
    expect(result.say).not.toMatch(/title/i);
    expect(errors(result.findings)).toEqual([]);
  });

  it("moves a title that would sit on the face (high in the picture) by code, with no Qwen round after the choices", async () => {
    const qwen = scripted([chose()]);
    const result = await firstCut(input({ analysis: HIGH }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(qwen.calls).toHaveLength(1);
    expect(titleOf(result.edit)?.props.y).not.toBe(0.2);
    expect(errors(result.findings)).toEqual([]);
    expect(result.edit).toEqual(expectedCut(HIGH, HOUSE_STYLE, false, { title: "Edit *smarter*", stress: [1, 4], pauseMs: 200 }));
  });

  it("names the title its own id's next free name when the take is called hook", async () => {
    const hook: Asset = { ...TAKE, id: "hook" };
    const qwen = scripted([chose()]);
    const result = await firstCut(input({ asset: hook, analysis: MIDDLE }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(titleOf(result.edit)?.id).toBe("hook-2");
  });

  it("returns a captions error that no place or size clears, and says it plainly", async () => {
    const qwen = scripted([chose({ title: null }), answer("I left it as it is.", [])]);
    const result = await firstCut(input({ analysis: MOVING }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });

    const left = errors(result.findings);
    expect(left.length).toBeGreaterThan(0);
    expect(left.every((finding) => finding.code === "on-face" && !finding.where.item && !finding.where.mark)).toBe(true);
    expect(result.edit.captions.on).toBe(true);
    expect(result.say).toMatch(/; its captions are plain white words\. The captions still cover your face in places\.$/);
  });

  it("cuts with the recipes alone when no answer can be read: the house's captions and punch-ins, no title, no stresses, natural, 250 ms", async () => {
    const qwen = scripted(["{", "{", "{"]);
    const result = await firstCut(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });

    expect(result.rounds.map((round) => round.outcome)).toEqual(["unreadable", "unreadable", "unreadable"]);
    expect(result.edit).toEqual(expectedCut(MIDDLE, HOUSE_STYLE, false, { title: null, stress: [], pauseMs: 250 }));
    expect(errors(result.findings)).toEqual([]);
    expect(result.say).toMatch(/I couldn't choose a title or the words to stress this time\.$/);
  });

  it("says what the captions look like, and nothing of where they were kept clear: one sentence when all is well (Task 14b)", async () => {
    const qwen = scripted([chose()]);
    const result = await firstCut(input({ analysis: analysisWith([]) }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(result.say).toMatch(/; its captions are plain white words\.$/);
    expect(result.say).not.toContain("kept clear");
    expect(result.say.split(/(?<=[.!?])\s+/)).toHaveLength(1);
  });

  it("names any other error it could not clear in one plain line: captions set under their least size (fix round 3)", async () => {
    // One word forty Ws wide: the kit sets its page under 44 px wherever the captions sit.
    const wide: Asset = { ...TAKE, words: WORDS.map((word, i) => (i === 6 ? { ...word, text: "W".repeat(40) } : { ...word })) };
    const qwen = scripted([chose({ title: null }), answer("I left it as it is.", [])]);
    const result = await firstCut(input({ asset: wide }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(errors(result.findings).map((finding) => finding.code)).toEqual(["text-fits"]);
    expect(result.say).toMatch(/something in the video still needs fixing; ask me to fix it/i);
  });

  it("never changes what it is given", async () => {
    const [asset, analysis] = [structuredClone(TAKE), structuredClone(MIDDLE)];
    const qwen = scripted([chose()]);
    await firstCut(input({ asset, analysis }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(asset).toEqual(TAKE);
    expect(analysis).toEqual(MIDDLE);
  });
});

describe("firstCut: in a style", () => {
  it("gives exactly the style's settings: its pause, captions, title and punch-ins, its look over Qwen's, and every field matched", async () => {
    const qwen = scripted([chose({ look: "mono", pauseMs: 300 })]);
    const result = await firstCut(input({ style: STYLE }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });

    const asked = textOf(qwen.calls[0]?.[1]);
    expect(asked).toContain(`style:\n${JSON.stringify(STYLE)}`);
    expect(asked).toContain('answer look "warm" and pauseMs 180');

    expect(result.edit).toEqual(expectedCut(MIDDLE, STYLE, true, { title: "Edit *smarter*", stress: [1, 4], pauseMs: 300 }));
    expect(result.edit.captions).toMatchObject(STYLE.captions);
    expect(titleOf(result.edit)).toMatchObject({ frames: 60, props: { y: 0.18, look: "label", size: 110, accent: "#ffe14a" } });
    expect(punchedOf(result.edit)).toBe(1);
    expect(result.edit.look.preset).toBe("warm");
    expect(errors(result.findings)).toEqual([]);
    expect(result.match).toEqual(matchOf(STYLE, result.edit, analysesOf(MIDDLE)));
    expect(result.match?.fields.filter((field) => field.verdict !== "matched")).toEqual([]);
    expect(result.say).toMatch(/\. It follows the style; not in the kit yet: emoji\.$/);
    expect(result.say).not.toContain("match");
  });

  it("puts a style's title from under the apps' top bar (0.14, as the real run's) on screen by code, with no errors and no round after the choices", async () => {
    const top: StyleProfile = { ...STYLE, title: { on: true, y: 0.14, frames: 90, look: "label", size: 110 } };
    const qwen = scripted([chose()]);
    const result = await firstCut(input({ style: top }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(qwen.calls).toHaveLength(1);
    expect(titleOf(result.edit)?.props).toMatchObject({ y: 0.18, size: 110 });
    expect(errors(result.findings)).toEqual([]);
    expect(result.say).toContain(", with a title");
    // Only near the style's place (0.18 for 0.14): not named.
    expect(result.say).toMatch(/\. It follows the style; not in the kit yet: emoji\.$/);
  });

  it("moves the style's captions off the face within their band (high: 0.4 to 0.26), with matchOf saying where they sit is not the style's, and say saying why", async () => {
    const onFace: StyleProfile = { ...STYLE, captions: { ...STYLE.captions, y: 0.4 } };
    const qwen = scripted([chose()]);
    const result = await firstCut(input({ style: onFace }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });

    expect(result.edit.captions.y).toBe(0.26);
    expect(errors(result.findings)).toEqual([]);
    expect(result.match?.fields.find((field) => field.field === "captions.y")).toMatchObject({ target: "0.4", actual: "0.26", verdict: "not" });
    // High captions at 0.26: the punch-in holds the face's top where it was, so it stays (fix round 2).
    expect(result.say).toContain(". It follows the style, except that the captions sit higher to stay off your face");
  });

  it("does not name the title twice when it was left out, and gives no reason a move did not have", async () => {
    const qwen = scripted([chose({ title: "W".repeat(28), short: "W".repeat(18) }), answer("I left it as it is.", [])]);
    const result = await firstCut(input({ style: STYLE }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(result.say).toMatch(/It follows the style(; not in the kit yet: [^;]+)?; I left the title out: it would not fit on the screen\.$/);
    expect(result.say).not.toContain("no title");
  });

  it("gives no reason to a move the last resort made: the captions placed off the face by code, then moved again by the change", async () => {
    const onFace: StyleProfile = { ...STYLE, captions: { ...STYLE.captions, y: 0.4 } };
    // The title cannot be placed, so the change runs; it also moves the captions, which adds no error, so it is taken.
    const qwen = scripted([chose({ title: "W".repeat(28), short: "W".repeat(18) }), answer("I moved the captions.", [{ op: "captions.set", y: 0.7 }]), answer("Done.", [])]);
    const result = await firstCut(input({ style: onFace }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(result.edit.captions.y).toBe(0.7);
    expect(result.say).toContain(". It follows the style, except that the captions sit lower");
  });

  it("asks for no title when the style has none, and adds none even when Qwen gives one", async () => {
    const untitled: StyleProfile = { ...STYLE, title: null };
    const qwen = scripted([chose()]);
    const result = await firstCut(input({ style: untitled }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(textOf(qwen.calls[0]?.[1])).toContain("The style has no title: answer title null.");
    expect(titleOf(result.edit)).toBeUndefined();
    expect(result.match?.fields.find((field) => field.field === "title")).toMatchObject({ verdict: "matched", target: "none", actual: "none" });
  });

  it("asks for the errors only as a last resort, then leaves out the part that still carries one and says why, never naming it as there", async () => {
    // Twenty-eight Ws, and eighteen for the short hook (its most), in the house style with its title as a label (a style, so
    // the test sits here): in the label's box (0.78 of the stage, 0.4 of the size free at each end) the kit sets them at 30
    // and 45 px, under the least size (48) at every place and size, so the title has a text-fits error to the end. In the
    // bold title no hook of 18 characters is that wide since titles may be 48 px (Task K1): eighteen Ws are 52 px there.
    const label = { ...HOUSE_STYLE, title: { ...HOUSE_STYLE.title!, look: "label" as const } };
    const qwen = scripted([chose({ title: "W".repeat(28), short: "W".repeat(18) }), answer("I left it as it is.", [])]);
    const result = await firstCut(input({ style: label }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });

    expect(lastUser(qwen.calls[1])).toContain(`request:\n${FIX_REQUEST}`);
    expect(FIX_REQUEST).toBe("Fix only these errors, and change nothing else: not the cut, not the captions' look, not the style.");
    expect(result.rounds.map((round) => round.outcome)).toEqual(["chosen", "no change"]);
    expect(titleOf(result.edit)).toBeUndefined();
    expect(result.ops.at(-1)).toEqual({ op: "item.remove", id: "hook" });
    expect(errors(result.findings)).toEqual([]);
    expect(result.say).not.toContain("with a title");
    expect(result.say).toMatch(/I left the title out: it would not fit on the screen\.$/);
  });
});

describe("firstCut: the short hook (fix round 2)", () => {
  /** Task 9's truth 3, as the real run had it: pop captions high at 0.3, a label title at 0.14 for 3 s, punch-ins 12 a minute. */
  const TRUTH3: StyleProfile = {
    source: { kind: "preset", name: "truth 3" },
    pace: { pauseMs: 150, cutsPerMin: null },
    captions: { on: true, look: "pop", font: "inter", size: 76, y: 0.3, maxWords: 3, highlight: "#4ade80" },
    title: { on: true, y: 0.14, frames: 90, look: "label", size: 110 },
    punchIns: { perMin: 12, zoom: 1.25 },
    look: { preset: "warm" },
    notMatched: [],
  };
  /**
   * A face from 0.29 to 0.79 of the height: the owner's take's own extent over the film (its highest top 0.288, its lowest
   * bottom 0.791). From 0.27, the high captions are pushed up to 0.22 and not even the short hook fits above them.
   */
  const REAL = analysisWith(facesAt(0.29, 0.5));

  it("puts the short hook on screen when the hook finds no place, with truth 3's high captions over a face from 0.29 to 0.79", async () => {
    // A made-up hook of five wide words that sets on three lines at every size tried (330 px tall at 79, the least tried since
    // titles may be 48 px, Task K1): no room above the captions, between them and the face, or below the mouth and over the
    // bars. A hook of two lines finds a place at 79 px under the mouth, on the chin. Three lines are over the hook's two
    // (Task 7), so it is sent back once and the same answer, given again, is kept: then no round after the choices.
    const wide = chose({ title: "WWWW WWWWW *WWWWW* WWWWW WWWW", short: "Plan *ahead*" });
    expect(hookLines("WWWW WWWWW *WWWWW* WWWWW WWWW", TRUTH3.title!)).toBe(3);
    const qwen = scripted([wide, wide]);
    const result = await firstCut(input({ analysis: REAL, style: TRUTH3 }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(qwen.calls).toHaveLength(2);
    expect(result.rounds.map((round) => round.outcome)).toEqual(["refused", "chosen"]);
    expect(titleOf(result.edit)?.props.text).toBe("Plan *ahead*");
    expect(errors(result.findings)).toEqual([]);
    expect(result.say).toContain(", with a title");
  });

  it("keeps the full hook when it finds a place", async () => {
    const qwen = scripted([chose({ title: "Plan your *week* in time", short: "Plan *ahead*" })]);
    const result = await firstCut(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(titleOf(result.edit)?.props.text).toBe("Plan your *week* in time");
  });
});

describe("firstCut: the hook on two lines (Task 7, R2, X128)", () => {
  /** Made up: 44 characters in eight words, and another hook as wide. Neither holds a word of the take's first six. */
  const WIDE = "Six quiet habits keep your *gardens* green now";
  const AGAIN = "Your *tomatoes* ripen faster in a warm window";

  it("sends a hook over two lines back once, with how much of it two lines hold, and keeps what comes next", async () => {
    const seen = WIDE.replaceAll("*", "");
    expect(seen).toHaveLength(HOOK.title.chars);
    expect(seen.split(" ")).toHaveLength(HOOK.title.words);
    expect(hookLines(WIDE, LARGEST_LABEL)).toBe(3);
    expect(hookLines(AGAIN, LARGEST_LABEL)).toBe(3);
    // The longest start of the hook, in whole words, that two lines hold.
    const words = seen.split(" ");
    const held = words.map((_, i) => words.slice(0, i + 1).join(" ")).filter((start) => hookLines(start, LARGEST_LABEL) <= 2).at(-1) ?? "";
    expect(held.length).toBeGreaterThan(0);
    expect(held.length).toBeLessThan(seen.length);

    const first = chose({ title: WIDE, short: "Green *gardens*" });
    const qwen = scripted([first, chose({ title: AGAIN, short: "Riper *tomatoes*" }), answer("I left it as it is.", [])]);
    const result = await firstCut(input({ style: { ...STYLE, title: LARGEST_LABEL } }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(result.rounds.slice(0, 2).map((round) => [round.outcome, round.error])).toEqual([["refused", "the title takes more than two lines"], ["chosen", null]]);
    expect(qwen.calls[1]?.at(-2)).toEqual({ role: "assistant", content: first });
    expect(lastUser(qwen.calls[1])).toBe(
      `The title "${seen}" takes 3 lines at its size; at most two: two lines hold about ${held.length} characters of it. Answer again with one JSON object only: {"title": string|null, "short": string|null, "stress": [int], "look": string, "pauseMs": int}.`,
    );
    // Once only: the second hook, three lines too, is kept; and the cut ends with no error and that hook on screen, placed
    // by code (`placeTitle` makes it smaller), with no last resort.
    expect(result.choices.title).toBe(AGAIN);
    expect(result.rounds).toHaveLength(2);
    expect(errors(result.findings)).toEqual([]);
    expect(titleOf(result.edit)?.props).toMatchObject({ text: AGAIN });
  });

  it("measures lines, not characters: one word is one line however wide, and a hook within two lines is taken at once", async () => {
    // The left-out titles of 28 Ws above are one word: never sent back for their lines (the review leaves them out).
    expect(hookLines("W".repeat(28), LARGEST_LABEL)).toBe(1);
    expect(hookLines("W".repeat(28), HOUSE_STYLE.title!)).toBe(1);
    const qwen = scripted([chose({ title: HOOK_EXAMPLE.title, short: HOOK_EXAMPLE.short })]);
    const result = await firstCut(input({ style: { ...STYLE, title: LARGEST_LABEL } }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(result.rounds.map((round) => round.outcome)).toEqual(["chosen"]);
    expect(titleOf(result.edit)?.props.text).toBe(HOOK_EXAMPLE.title);
  });

  it("has no code check for what a hook says: one that names where the speaker is is taken as it comes (the prompt carries that rule)", async () => {
    const qwen = scripted([chose({ title: "Here in my *kitchen* today", short: "My *kitchen*" })]);
    const result = await firstCut(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(result.rounds.map((round) => round.outcome)).toEqual(["chosen"]);
    expect(titleOf(result.edit)?.props.text).toBe("Here in my *kitchen* today");
  });

  it("measures at the title's own look, size and weight: Bold pop's bold title at 130 px holds less than the label at 84", () => {
    const boldPop = presetOf("bold-pop")!.profile.title!;
    expect(boldPop).toMatchObject({ look: "bold", size: 130 });
    expect(hookLines(HOOK_EXAMPLE.title, boldPop)).toBe(3);
    expect(hookLines(HOOK_EXAMPLE.title, LARGEST_LABEL)).toBe(2);
    expect(hookLines("Plan your *week* in time", boldPop)).toBe(2);
  });

  it("sets a hook of the rule's full length on two lines in the house's label (72 px, 600: the ruling of Task 8)", () => {
    expect(HOUSE_STYLE.title).toMatchObject({ look: "label", size: 72, weight: 600 });
    expect(hookLines(WIDE, HOUSE_STYLE.title!)).toBe(2);
    expect(hookLines(AGAIN, HOUSE_STYLE.title!)).toBe(2);
  });
});

describe("firstCut: the reference's pace (X104)", () => {
  it("tightens to the pause pauseFor gives for the style's quiet share: quiet 0.05 cuts further than 300 ms with no quiet", async () => {
    const tight: StyleProfile = { ...STYLE, pace: { pauseMs: 300, cutsPerMin: null, quiet: 0.05 } };
    const loose: StyleProfile = { ...STYLE, pace: { pauseMs: 300, cutsPerMin: null } };
    const length = async (style: StyleProfile) => {
      const qwen = scripted([chose()]);
      return layout((await firstCut(input({ style }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now })).edit).frames;
    };
    expect(await length(tight)).toBeLessThan(await length(loose));
  });
});

describe("say: how long (two short sentences at most, Task 14b)", () => {
  /** The sentences of a say, a title's quoted words left out. */
  const sentences = (say: string) => say.replace(/"[^"]*"/g, '""').split(/(?<=[.!?])\s+/).filter(Boolean);
  const run = async (over: Partial<FirstCutInput>, answers: string[]) => {
    const qwen = scripted(answers);
    return (await firstCut(input(over), { ask: qwen.ask, stills: drawer().stills, now: qwen.now })).say;
  };

  it("keeps a say to two sentences without a style, even with a title left out or no answer read, and to one when all is well", async () => {
    expect(sentences(await run({}, [chose()]))).toHaveLength(1);
    for (const say of [
      await run({}, [chose()]),
      await run({}, [chose({ title: "W".repeat(28), short: "W".repeat(18) }), answer("I left it as it is.", [])]),
      await run({}, ["{", "{", "{"]),
      await run({ analysis: MOVING }, [chose(), answer("I left it as it is.", [])]),
    ]) expect(sentences(say).length, say).toBeLessThanOrEqual(2);
  });

  it("names a look as a creator would: black-and-white, never the kit's own word for it (in a style: the house's look is natural)", async () => {
    const say = await run({ style: { ...STYLE, look: { preset: "mono" } } }, [chose()]);
    expect(say).toContain("a black-and-white look");
    expect(say).not.toMatch(/\bmono\b/);
  });

  it("keeps a say to two sentences with a style, the match in the second", async () => {
    const many: StyleProfile = { ...STYLE, captions: { ...STYLE.captions, y: 0.4 }, notMatched: ["emoji", "a whoosh"] };
    for (const say of [
      await run({ style: STYLE }, [chose()]),
      await run({ style: many }, [chose({ title: "W".repeat(28), short: "W".repeat(18) }), answer("I left it as it is.", [])]),
    ]) {
      expect(sentences(say).length, say).toBe(2);
      expect(sentences(say)[1]).toMatch(/^It follows the style/);
      // No seconds but the cut's own length, which is the point of a first cut.
      expect(say.match(/\d+(\.\d+)? s\b/g)).toHaveLength(2);
    }
  });
});

describe("ChoicesSchema", () => {
  it.each([
    ["a short hook of four words", "One two three four"],
    ["a short hook over 18 characters", "Nineteen characters"],
    ["a blank short hook", " "],
    ["a short hook that asks a question", "Why *rise*?"],
  ])("leaves out %s (null) and keeps the title, rather than asking again (Task 12b)", (_, short) => {
    const read = ChoicesSchema.safeParse(JSON.parse(chose({ short })));
    expect(read.success).toBe(true);
    expect(read.data).toMatchObject({ title: "Edit *smarter*", short: null });
  });

  it("takes the prompt's own example pair as it is: a six-word claim on two lines at the largest label, and its three-word short form", () => {
    expect(ChoicesSchema.parse(JSON.parse(chose({ title: HOOK_EXAMPLE.title, short: HOOK_EXAMPLE.short })))).toMatchObject(HOOK_EXAMPLE);
    expect(HOOK_EXAMPLE.title.replaceAll("*", "").split(" ")).toHaveLength(6);
    expect(HOOK_EXAMPLE.short.replaceAll("*", "").split(" ")).toHaveLength(3);
    expect(hookLines(HOOK_EXAMPLE.title, LARGEST_LABEL)).toBeLessThanOrEqual(2);
  });

  it.each([
    ["a title of six words", "One two three four five six"],
    ["a title over 28 characters", "Twenty-nine characters, long!"],
    ["a title of eight words and 44 characters", "Six quiet habits keep your *gardens* green now"],
  ])("takes %s", (_, title) => {
    expect(ChoicesSchema.safeParse(JSON.parse(chose({ title }))).success).toBe(true);
  });

  it.each([
    ["six stressed words", { stress: [0, 1, 2, 3, 4, 5] }, "stress"],
    ["a pause of 401 ms", { pauseMs: 401 }, "pauseMs"],
    ["a look the kit has not", { look: "sepia" }, "look"],
    ["a blank title", { title: " " }, "title"],
    ["a title of nine words", { title: "One two three four five six seven eight nine" }, "title"],
    ["a title of 45 characters", { title: "Fortyfive characters exactly in one long line" }, "title"],
    ["a title that asks a question", { title: "Why does your bread never rise?" }, "title"],
    ["a title that ends in a full-width question mark", { title: "Does your bread rise？" }, "title"],
    ["a title that ends in an Arabic question mark", { title: "Does your bread rise؟" }, "title"],
    ["a title whose question mark is marked", { title: "Does your bread *rise?*" }, "title"],
    ["a title with no short hook", { short: null }, "short"],
  ])("refuses %s", (_, over, path) => {
    const read = ChoicesSchema.safeParse(JSON.parse(chose(over)));
    expect(read.success).toBe(false);
    expect(read.error?.issues.map((issue) => issue.path.join("."))).toEqual([path]);
  });
});

/* ── Task 12b: three small faults ─────────────────────────────────────────────────────────────────────────────────────── */

describe("Task 12b (a): the captions' sentence says what the look does", () => {
  const withCaptions = (captions: Partial<StyleProfile["captions"]>): StyleProfile => ({ ...STYLE, captions: { ...STYLE.captions, ...captions } });
  it.each([
    ["pill, no colour (clean)", { look: "pill", highlight: null }, [1, 4], "white words on a dark box"],
    ["pill with a colour", { look: "pill", highlight: "#ffe14a" }, [1, 4], "white words on a dark box, the word being said in colour"],
    ["pop, no colour", { look: "pop", highlight: null }, [1, 4], "bold white words"],
    ["pop with a colour (the house)", { look: "pop", highlight: "#ffe14a" }, [1, 4], "bold white words, the word being said in colour"],
    ["highlight with a colour", { look: "highlight", highlight: "#4ade80" }, [1, 4], "words that light up on a block of colour, the word being said in colour"],
    ["highlight, no colour", { look: "highlight", highlight: null }, [1, 4], "words that light up on a block of colour"],
    ["plain with a colour and stresses (key words)", { look: "plain", highlight: "#ffe14a" }, [1, 4], "plain white words, the words that matter in colour"],
    ["plain with a colour and no stress", { look: "plain", highlight: "#ffe14a" }, [], "plain white words"],
    ["plain, no colour (mono, sentences)", { look: "plain", highlight: null }, [1, 4], "plain white words"],
  ] as const)("%s", async (_, captions, stress, says) => {
    const qwen = scripted([chose({ stress })]);
    const result = await firstCut(input({ style: withCaptions(captions) }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(result.say).toContain(`; its captions are ${says}.`);
  });
});

describe("Task 12b (b): no stress on a filler, by code", () => {
  /** The take with "the" at w2 and "Be," at w5, where "this" and "you" were. */
  const FILLED: Asset = { ...TAKE, words: WORDS.map((word, i) => ({ ...word, text: i === 2 ? "the" : i === 5 ? "Be," : word.text })) };
  const stressed = async (asset: Asset, analysis: TakeAnalysis, stress: number[]) => {
    const qwen = scripted([chose({ stress })]);
    return stressedOf((await firstCut(input({ asset, analysis, style: STYLE }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now })).edit);
  };

  it("drops Qwen's stresses on \"the\" and \"Be,\" and keeps the word that carries the point", async () => {
    expect(await stressed(FILLED, MIDDLE, [2, 5, 8])).toEqual([8]);
  });

  it("drops a filler before thinning, so it never blocks the word after it", async () => {
    // w5 "Be," is a filler; w6 "know" stays, though thinning would have dropped it as w5's neighbour.
    expect(await stressed(FILLED, MIDDLE, [5, 6])).toEqual([6]);
  });

  it("reads the take's own language: German \"die\" is a filler, English \"die\" is not; a language without a list drops none", async () => {
    const died: Asset = { ...TAKE, words: WORDS.map((word, i) => ({ ...word, text: i === 4 ? "die" : word.text })) };
    expect(await stressed(died, { ...MIDDLE, language: "de" }, [1, 4])).toEqual([1]);
    expect(await stressed(died, MIDDLE, [1, 4])).toEqual([1, 4]);
    expect(await stressed(FILLED, { ...MIDDLE, language: "fr" }, [2, 5, 8])).toEqual([2, 5, 8]);
  });

  it("holds one closed list for English, German and Italian, each about sixty words, lower case", () => {
    expect(Object.keys(FILLERS).sort()).toEqual(["de", "en", "it"]);
    for (const words of Object.values(FILLERS)) {
      expect(words.size).toBeGreaterThanOrEqual(50);
      expect(words.size).toBeLessThanOrEqual(90);
      for (const word of words) expect(word).toBe(word.toLowerCase());
    }
    for (const filler of ["be", "the", "are", "and"]) expect(FILLERS.en.has(filler)).toBe(true);
    // Words that carry meaning are never on it.
    for (const kept of ["not", "never", "no", "die", "war"]) expect(FILLERS.en.has(kept)).toBe(false);
  });
});

describe("Task 9b, ruling 2a: a first cut whose line is even writes no stress marks", () => {
  const cutWith = async (stress: number[], style?: StyleProfile): Promise<Edit> => {
    const qwen = scripted([chose({ stress })]);
    return (await firstCut(input(style ? { style } : {}), { ask: qwen.ask, stills: drawer().stills, now: qwen.now })).edit;
  };

  it("7: with the house style no word is marked; the rest is the cut the marks make", async () => {
    expect(evenLine(HOUSE_STYLE.captions)).toBe(true);
    const edit = await cutWith([8]);
    expect(stressedOf(edit)).toEqual([]);
    // The cut as the steps make it with the marks left in (as at BASE): the same edit, but the marks.
    const marked = expectedCut(MIDDLE, HOUSE_STYLE, false, { title: "Edit *smarter*", stress: [8], pauseMs: 200 }, true);
    expect(stressedOf(marked)).toEqual([8]);
    expect(edit).toEqual(unstressed(marked));
  });

  /**
   * A made-up take of 11 s in three phrases: tightened, three shots of 2.5, 2.9 and 3.9 s, so the house's one punch-in (4 a
   * minute over about 9 s) may go at the cut into the second or into the third. With no stress the third is nearer the slot's
   * middle; a stress on the second's first word ranks its cut first (`punch.ts`).
   */
  const PHRASES: Asset = {
    ...TAKE, ms: 11_000,
    words: [
      ["Bread", 300, 700], ["rises", 720, 1200], ["slowly", 1220, 1800], ["overnight", 1820, 2600],
      ["Butter", 3300, 3800], ["melts", 3820, 4400], ["into", 4420, 5000], ["crumbs", 5020, 6000],
      ["Ovens", 6700, 7300], ["hum", 7320, 8000], ["through", 8020, 8800], ["winter", 8820, 9600], ["nights", 9620, 10_400],
    ].map(([text, startMs, endMs]) => ({ text: String(text), startMs: Number(startMs), endMs: Number(endMs) })),
  };
  const PHRASED: TakeAnalysis = {
    language: "en", loudness: null,
    pauses: [{ startMs: 0, endMs: 300, cutMs: 150 }, { startMs: 2600, endMs: 3300, cutMs: 2950 }, { startMs: 6000, endMs: 6700, cutMs: 6350 }, { startMs: 10_400, endMs: 11_000, cutMs: 10_700 }],
    faces: Array.from({ length: 55 }, (_, i) => ({ ms: i * 200, face: { x: 0.3, y: 0.3, w: 0.4, h: 0.2 }, mouth: { x: 0.42, y: 0.43, w: 0.16, h: 0.024 } })),
  };
  const punchedAt = (edit: Edit): number[] => edit.shots.filter((shot) => shot.framing.from.zoom > 1).map((shot) => shot.startMs);

  it("7: the house's punch-in lands where the stressed word puts it, and the mark is then left out", async () => {
    const cut = async (stress: number[]) => {
      const qwen = scripted([chose({ stress })]);
      return (await firstCut(input({ asset: PHRASES, analysis: PHRASED }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now })).edit;
    };
    const [plain, stressed] = [await cut([]), await cut([4])];
    // With no stress the punch-in goes at the cut into the third shot; with w4 stressed, at the cut into the second.
    expect(punchedAt(plain)).toHaveLength(1);
    expect(punchedAt(plain)[0]).toBeGreaterThan(6000);
    expect(punchedAt(stressed)).toHaveLength(1);
    expect(punchedAt(stressed)[0]).toBeGreaterThan(2600);
    expect(punchedAt(stressed)[0]).toBeLessThan(3300);
    // And no word is left marked: the mark placed the punch-in, then was left out (it would fail if dropped before punchIns).
    expect(stressedOf(stressed)).toEqual([]);
    expect(stressed).toEqual(unstressed(expectedCut(PHRASED, HOUSE_STYLE, false, { title: "Edit *smarter*", stress: [4], pauseMs: 200 }, true, PHRASES)));
  });

  it.each(["bold-pop", "key-words"])("7: with %s the marks are as before", async (id) => {
    const profile = presetOf(id)?.profile;
    if (!profile) throw new Error(`no preset ${id}`);
    expect(evenLine(profile.captions)).toBe(false);
    expect(stressedOf(await cutWith([1, 4], profile))).toEqual([1, 4]);
  });
});

describe("Task 12b (c): one round for a styled first cut", () => {
  it("takes a first answer whose short hook has four words in one round, leaving the short form out", async () => {
    const qwen = scripted([chose({ title: "Edit your videos *smarter*", short: "Edit videos *much* smarter" })]);
    const result = await firstCut(input({ style: STYLE }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(qwen.calls).toHaveLength(1);
    expect(result.rounds.map((round) => round.outcome)).toEqual(["chosen"]);
    expect(result.choices.short).toBeNull();
    expect(titleOf(result.edit)?.props.text).toBe("Edit your videos *smarter*");
  });

  it("says the short form's limit plainly, with one made-up pair as an example", async () => {
    const qwen = scripted([chose()]);
    await firstCut(input({ style: STYLE }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    const system = textOf(qwen.calls[0]?.[0]);
    expect(system).toContain(`title "${HOOK_EXAMPLE.title}" (six words) and short "${HOOK_EXAMPLE.short}" (three words)`);
    expect(system).toMatch(/A short form of four words or more is left out/);
  });
});

describe("Task 12b: the hook's key word marked when the captions have no colour", () => {
  const colourless = (kind: StyleProfile["source"]["kind"]): StyleProfile => ({ ...STYLE, source: { kind, name: "test" }, captions: { ...STYLE.captions, highlight: null } });
  const accentOf = async (style: StyleProfile) => {
    const qwen = scripted([chose()]);
    const title = titleOf((await firstCut(input({ style }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now })).edit);
    return title?.part === "title" ? title.props.accent : "no title";
  };

  it("takes the captions' colour when they have one", async () => {
    expect(await accentOf({ ...STYLE, captions: { ...STYLE.captions, highlight: "#4ade80" } })).toBe("#4ade80");
  });

  it("takes Bold pop's yellow for a preset or words whose captions have none", async () => {
    expect(MARKED).toBe("#ffe14a");
    expect(await accentOf(colourless("preset"))).toBe(MARKED);
    expect(await accentOf(colourless("words"))).toBe(MARKED);
  });

  it("adds no colour to a style read from a reference whose captions have none", async () => {
    expect(await accentOf(colourless("reference"))).toBeNull();
  });
});
