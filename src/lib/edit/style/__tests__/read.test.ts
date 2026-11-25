/**
 * A reference's sheet judged by Qwen for what is not measured (part 3, Task 9b), with Qwen's `ask` stood in for by canned
 * answers; the sheet's frames and the mapping of the measures and the judgement to the kit are the real ones.
 */
import { describe, expect, it, vi } from "vitest";
import type { TakeAnalysis } from "../../analysis";
import type { Ask, AskOptions, Message } from "../../agent/model";
import type { Measures } from "../measures";
import { EXTRA_KINDS, SHEET, judgeSheet, sheetFrames, styleOfReference, type Judgement } from "../read";
import type { TextRead } from "../text";

/* ── sheetFrames ───────────────────────────────────────────────────────────────────────────────── */

const analysis = (cuts: number[]): TakeAnalysis => ({ language: "en", pauses: [], faces: [], loudness: null, cuts, picture: [] });

describe("sheetFrames: twelve frames of a reference", () => {
  it("gives 12 frames in order over a 30 s reference cut at 3 s and 12 s: 4 in its first 5 s, two just after the cuts", () => {
    const frames = sheetFrames(analysis([3000, 12_000]), 30_000);
    expect(frames).toHaveLength(12);
    expect(frames).toEqual([...frames].sort((a, b) => a - b));
    expect(new Set(frames).size).toBe(12);
    expect(frames.filter((frame) => frame < 150)).toHaveLength(4);
    const justAfter = (cutMs: number) => frames.filter((frame) => frame > (cutMs * 30) / 1000 && frame <= ((cutMs + SHEET.afterCutMs) * 30) / 1000);
    expect(justAfter(3000)).toHaveLength(1);
    expect(justAfter(12_000)).toHaveLength(1);
    expect(frames.every((frame) => frame >= 0 && frame < 900)).toBe(true);
  });

  it("waits past a transition's own frames after a cut: the frame is 400 ms after it, past a 10-frame push found 1 frame in", () => {
    expect(SHEET.afterCutMs).toBeGreaterThanOrEqual(300);
  });

  it("holds the opening a second apart, so a title's end taken between two of them is within half a second", () => {
    const frames = sheetFrames(analysis([]), 30_000);
    expect(frames.slice(0, 4)).toEqual([15, 45, 75, 105]);
    expect(frames.slice(4).every((frame) => frame >= 150)).toBe(true);
  });

  it("takes at most four cuts after the opening, spread over them, and fills a short reference with frames of its own", () => {
    const many = sheetFrames(analysis(Array.from({ length: 30 }, (_, i) => 6000 + i * 3000)), 100_000);
    expect(many).toHaveLength(12);
    expect(new Set(many).size).toBe(12);
    const short = sheetFrames(analysis([]), 3000);
    expect(short).toHaveLength(12);
    expect(new Set(short).size).toBe(12);
    expect(short.every((frame) => frame >= 0 && frame < 90)).toBe(true);
  });
});

/* ── judgeSheet ─────────────────────────────────────────────────────────────────────────────────── */

const FRAMES = [15, 45, 75, 105, 200, 310, 372, 420, 525, 630, 740, 845];
const SEEN = { captions: ["get this", "right now"], title: "3 money mistakes" };
const GOOD = { extras: [{ kind: "emoji", cells: [2, 5] }, { kind: "progress bar", cells: [0, 11] }] };

/** Canned answers in turn (a thrown error for an `Error`), and every call's messages and options. */
function scripted(...answers: (string | Error)[]): { ask: Ask; calls: { messages: Message[]; opts: AskOptions }[] } {
  const calls: { messages: Message[]; opts: AskOptions }[] = [];
  const ask: Ask = async (messages, opts) => {
    calls.push({ messages: structuredClone(messages), opts });
    const answer = answers[calls.length - 1];
    if (answer === undefined) throw new Error("asked once too often");
    if (answer instanceof Error) throw answer;
    return { text: answer, usage: { input: 2000, output: 40 }, ms: 3000 };
  };
  return { ask, calls };
}
const textOfMessage = (message: Message): string =>
  typeof message.content === "string" ? message.content : message.content.map((part) => (part.type === "text" ? part.text : "")).join("");
const lastUser = (messages: Message[]): string => textOfMessage(messages.filter((message) => message.role === "user").at(-1)!);

describe("judgeSheet: Qwen judges only what is not measured", () => {
  it("asks twice at once, thinking off, with the sheet and what was measured, for the extras only, and reads them", async () => {
    const { ask, calls } = scripted(JSON.stringify(GOOD), JSON.stringify(GOOD));
    expect(await judgeSheet("c2hlZXQ=", FRAMES, SEEN, ask)).toEqual(GOOD);
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.opts.thinking)).toEqual([false, false]);
    const parts = calls[0]!.messages.flatMap((message) => (typeof message.content === "string" ? [] : message.content));
    expect(parts).toContainEqual({ type: "image_url", image_url: { url: "data:image/jpeg;base64,c2hlZXQ=" } });
    expect(calls[1]!.messages).toEqual(calls[0]!.messages);
    const said = calls[0]!.messages.map(textOfMessage).join("\n");
    // The measured captions and title are named so they are not listed; the six kinds are offered, each with the cells it is
    // in, and "other text", a place for words on screen to go (dropped: they are measured); no grade, place, size or colour.
    expect(said).toContain('"get this"');
    expect(said).toContain('"3 money mistakes"');
    expect(EXTRA_KINDS).toEqual(["emoji", "sticker", "arrow", "progress bar", "clip or picture cut in", "split screen"]);
    for (const kind of [...EXTRA_KINDS, "other text"]) expect(said).toContain(`"${kind}"`);
    expect(said).toContain('"cells"');
    expect(said).not.toMatch(/grade|vivid|warm|0-1000|colou?r of|size/i);
  });

  it("keeps only the kinds both answers name, on the cells both name (the controller's ruling after Task 9c)", async () => {
    const one = { extras: [{ kind: "emoji", cells: [2, 5] }, { kind: "sticker", cells: [1] }, { kind: "arrow", cells: [3] }] };
    const two = { extras: [{ kind: "arrow", cells: [7] }, { kind: "emoji", cells: [5, 6] }, { kind: "emoji", cells: [2] }, { kind: "split screen", cells: [4] }] };
    // Emoji in both, on 2 and 5; the arrow in both, on no cell both name: dropped; the sticker and the split screen in one only.
    expect(await judgeSheet("c2hlZXQ=", FRAMES, SEEN, scripted(JSON.stringify(one), JSON.stringify(two)).ask)).toEqual({ extras: [{ kind: "emoji", cells: [2, 5] }] });
    expect(await judgeSheet("c2hlZXQ=", FRAMES, SEEN, scripted(JSON.stringify(GOOD), JSON.stringify({ extras: [] })).ask)).toEqual({ extras: [] });
  });

  it("keeps one answer alone when the other call fails, or its answer cannot be read twice", async () => {
    const warned = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(await judgeSheet("c2hlZXQ=", FRAMES, SEEN, scripted(JSON.stringify(GOOD), new Error("timed out")).ask)).toEqual(GOOD);
      expect(await judgeSheet("c2hlZXQ=", FRAMES, SEEN, scripted(new Error("timed out"), JSON.stringify(GOOD)).ask)).toEqual(GOOD);
      // The first answer unreadable, its repair too (calls 1 and 3); the second read (call 2).
      expect(await judgeSheet("c2hlZXQ=", FRAMES, SEEN, scripted("{}", JSON.stringify(GOOD), "{}").ask)).toEqual(GOOD);
    } finally {
      warned.mockRestore();
    }
  });

  it("keeps an extra only with cells on the sheet, drops other text, and passes over a grade it was not asked for", async () => {
    const extras = [{ kind: "emoji", cells: [3] }, { kind: "split screen", cells: [] }, { kind: "arrow", cells: [4, 12] }, { kind: "sticker", cells: [-1] },
      { kind: "other text", cells: [1, 2] }, { kind: "clip or picture cut in", cells: [7, 8] }];
    const answer = JSON.stringify({ grade: "cool", extras });
    expect(await judgeSheet("c2hlZXQ=", FRAMES, SEEN, scripted(answer, answer).ask)).toEqual({ extras: [{ kind: "emoji", cells: [3] }, { kind: "clip or picture cut in", cells: [7, 8] }] });
    // On a sheet of six, cell 7 is not on it.
    expect((await judgeSheet("c2hlZXQ=", FRAMES.slice(0, 6), SEEN, scripted(answer, answer).ask))?.extras).toEqual([{ kind: "emoji", cells: [3] }]);
  });

  it("repairs a kind that is not in the list: boxes are no longer a kind (Task 9c)", async () => {
    for (const kind of ["a fire emoji", "box or shape"]) {
      const { ask, calls } = scripted(JSON.stringify({ extras: [{ kind, cells: [2] }] }), JSON.stringify(GOOD), JSON.stringify(GOOD));
      expect(await judgeSheet("c2hlZXQ=", FRAMES, SEEN, ask)).toEqual(GOOD);
      expect(calls).toHaveLength(3);
      expect(lastUser(calls[2]!.messages)).toContain("extras.0.kind");
    }
  });

  it("says there is no title when none was measured", async () => {
    const { ask, calls } = scripted(JSON.stringify(GOOD), JSON.stringify(GOOD));
    await judgeSheet("c2hlZXQ=", FRAMES, { captions: [], title: null }, ask);
    expect(lastUser(calls[0]!.messages)).toMatch(/no captions/i);
    expect(lastUser(calls[0]!.messages)).toMatch(/no title/i);
  });

  it("gives an answer outside its shape one repair, quoting zod's issues, and reads the second", async () => {
    const bad = { extras: "none" };
    const { ask, calls } = scripted(JSON.stringify(bad), JSON.stringify(GOOD), JSON.stringify(GOOD));
    expect(await judgeSheet("c2hlZXQ=", FRAMES, SEEN, ask)).toEqual(GOOD);
    expect(calls).toHaveLength(3);
    expect(lastUser(calls[2]!.messages)).toContain("extras");
    expect(calls[2]!.messages.at(-2)).toEqual({ role: "assistant", content: JSON.stringify(bad) });
    // The other call's messages are its own: no repair in them.
    expect(calls[1]!.messages).toHaveLength(2);
  });

  it("repairs an answer that is not JSON", async () => {
    const { ask, calls } = scripted("I see an emoji.", JSON.stringify(GOOD), JSON.stringify(GOOD));
    expect(await judgeSheet("c2hlZXQ=", FRAMES, SEEN, ask)).toEqual(GOOD);
    expect(lastUser(calls[2]!.messages)).toMatch(/not JSON/);
  });

  it("gives null when both fail, never throws, and says each failure in the log without words", async () => {
    const warned = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const twice = scripted("{}", "{}", JSON.stringify({ grade: "natural" }), "{}");
      expect(await judgeSheet("c2hlZXQ=", FRAMES, SEEN, twice.ask)).toBeNull();
      expect(twice.calls).toHaveLength(4);
      expect(await judgeSheet("c2hlZXQ=", FRAMES, SEEN, scripted(new Error("DashScope is down"), new Error("DashScope is down")).ask)).toBeNull();
      const logged = warned.mock.calls.map((call) => call.join(" ")).join("\n");
      expect(warned).toHaveBeenCalledTimes(4);
      expect(logged).toMatch(/could not be read/);
      expect(logged).toMatch(/DashScope is down/);
      expect(logged).not.toMatch(/get this|3 money mistakes/);
    } finally {
      warned.mockRestore();
    }
  });
});

/* ── styleOfReference ──────────────────────────────────────────────────────────────────────────── */

const MEASURES: Measures = { pauseMs: 220, cutsPerMin: 18.5, quiet: 0.12, punchIns: { perMin: 6, zoom: 1.2 }, look: null, ms: 30_000 };
type Captions = NonNullable<TextRead["captions"]>;
const CAPTIONS: Captions = { y: 0.62, size: 76, font: "montserrat", typeface: "kit", maxWords: 3, upper: false, ink: "#fefefe", highlight: "#ffe14a", said: "letters", backing: false, edge: true, pages: 30 };
const TITLE: NonNullable<TextRead["title"]> = { y: 0.18, size: 120, fromMs: 0, toMs: 2000, stays: false, backing: false, edge: false, ink: "#ffffff", text: "3 money mistakes" };
const read = (over: Partial<Captions> | null = {}, rest: Partial<TextRead> = {}): TextRead => ({ captions: over === null ? null : { ...CAPTIONS, ...over }, title: null, other: [], ...rest });
const JUDGED: Judgement = { extras: [] };

describe("styleOfReference: the measures and the judgement, in the kit's terms", () => {
  it("takes the captions' font, size, place, words and highlight as measured", () => {
    const style = styleOfReference(MEASURES, read(), JUDGED, "reference 1");
    expect(style.captions).toEqual({ on: true, look: "pop", font: "montserrat", size: 76, y: 0.62, maxWords: 3, highlight: "#ffe14a" });
    expect(style.source).toEqual({ kind: "reference", name: "reference 1" });
    expect(style.notMatched).toEqual([]);
  });

  it("gives a backing pill, a box behind the said word highlight, its letters coloured pop, and else plain", () => {
    const look = (over: Partial<Captions>) => styleOfReference(MEASURES, read(over), JUDGED, null).captions.look;
    expect(look({ backing: true, said: "letters" })).toBe("pill");
    expect(look({ said: "box" })).toBe("highlight");
    expect(look({ said: "letters" })).toBe("pop");
    expect(look({ said: null, highlight: null })).toBe("plain");
  });

  it("takes the pace and the punch-ins from the measures, held to the profile's ranges", () => {
    const style = styleOfReference({ ...MEASURES, cutsPerMin: 75, punchIns: { perMin: 40, zoom: 1.2 } }, read(), JUDGED, null);
    expect(style.pace).toEqual({ pauseMs: 220, cutsPerMin: 60, quiet: 0.12 });
    expect(styleOfReference({ ...MEASURES, quiet: null }, read(), JUDGED, null).pace.quiet).toBeNull();
    expect(style.punchIns).toEqual({ perMin: 30, zoom: 1.2 });
    expect(styleOfReference({ ...MEASURES, punchIns: null }, read(), JUDGED, null).punchIns).toBeNull();
  });

  it("takes the look mono from the measures, else natural: the grade is no longer judged (Task 9c)", () => {
    expect(styleOfReference({ ...MEASURES, look: "mono" }, read(), JUDGED, null).look).toEqual({ preset: "mono" });
    expect(styleOfReference(MEASURES, read(), JUDGED, null).look).toEqual({ preset: "natural" });
    expect(styleOfReference(MEASURES, read(), null, null).look).toEqual({ preset: "natural" });
  });

  it("lists capitals, an ink that is not white, more than 16 words a page and a size past the kit's range", () => {
    const style = styleOfReference(MEASURES, read({ upper: true, ink: "#ffd400", maxWords: 20, size: 230 }), JUDGED, null);
    expect(style.captions).toMatchObject({ size: 200, maxWords: 16 });
    expect(style.notMatched).toEqual(["captions in capitals", "yellow caption text", "captions of 20 words a page", "captions larger than the kit draws"]);
    expect(styleOfReference(MEASURES, read({ size: 30 }), JUDGED, null).notMatched).toEqual(["captions smaller than the kit draws"]);
    // Up to 16 words a page, as the kit sets them (Task 9c): no line for 9.
    expect(styleOfReference(MEASURES, read({ maxWords: 9 }), JUDGED, null)).toMatchObject({ captions: { maxWords: 9 }, notMatched: [] });
    // White, as the reader's colours give it: every channel at 0xe0 or more.
    expect(styleOfReference(MEASURES, read({ ink: "#e4e6e2" }), JUDGED, null).notMatched).toEqual([]);
  });

  it("says nothing of a colour it could not read, and names letters unlike the kit's or a script it lacks (Task 9c)", () => {
    expect(styleOfReference(MEASURES, read({ ink: null }), JUDGED, null).notMatched).toEqual([]);
    expect(styleOfReference(MEASURES, read({ typeface: "unlike", font: "inter" }), JUDGED, null).notMatched).toEqual(["captions in a typeface unlike the kit's"]);
    expect(styleOfReference(MEASURES, read({ typeface: "script", font: "inter" }), JUDGED, null).notMatched).toEqual(["captions in a script the kit has no letters for"]);
  });

  it("says other text is on screen once, in no words of it, and one plain line for each kind of extra, in the kinds' order", () => {
    const extras: Judgement["extras"] = [{ kind: "split screen", cells: [1] }, { kind: "emoji", cells: [2] }, { kind: "emoji", cells: [5, 6] }];
    const style = styleOfReference(MEASURES, read({}, { other: ["follow for part 2", "@handle"] }), { extras }, null);
    expect(style.notMatched).toEqual(["other text on screen", "emoji", "a split screen"]);
    // A profile never quotes a reference (X96): no text of it anywhere in it.
    expect(JSON.stringify(styleOfReference(MEASURES, read({}, { other: ["follow for part 2"], title: TITLE }), { extras }, null))).not.toMatch(/follow|money/);
    const all = EXTRA_KINDS.map((kind) => ({ kind, cells: [0] }));
    expect(styleOfReference(MEASURES, read(), { extras: all }, null).notMatched).toEqual(["emoji", "stickers", "arrows", "a progress bar", "clips or pictures cut in", "a split screen"]);
  });

  it("makes the profile from the measures alone with no judgement", () => {
    const style = styleOfReference(MEASURES, read({}, { other: ["follow"] }), null, null);
    expect(style.look).toEqual({ preset: "natural" });
    expect(style.notMatched).toEqual(["other text on screen"]);
  });

  it("times, places and sizes the title as measured: label for a backing, outline for an edge, else bold", () => {
    const titled = (over: Partial<NonNullable<TextRead["title"]>>) => styleOfReference(MEASURES, read({}, { title: { ...TITLE, ...over } }), JUDGED, null).title;
    expect(titled({})).toEqual({ on: true, y: 0.18, frames: 60, look: "bold", size: 120 });
    expect(titled({ backing: true, fromMs: 500, toMs: 3500 })).toMatchObject({ frames: 90, look: "label" });
    expect(titled({ edge: true })).toMatchObject({ look: "outline" });
    // Held to the profile's half a second to twenty (Task 9c: a hook of 8.6 s is no longer cut to 5), and the kit's sizes.
    expect(titled({ toMs: 300 })?.frames).toBe(15);
    expect(titled({ toMs: 8600 })?.frames).toBe(258);
    expect(titled({ toMs: 30_000 })?.frames).toBe(600);
    const big = styleOfReference(MEASURES, read({}, { title: { ...TITLE, size: 260 } }), JUDGED, null);
    expect(big.title?.size).toBe(220);
    expect(big.notMatched).toEqual(["a title larger than the kit draws"]);
  });

  it("gives a title that stays to the end, and its ink where it is not white (Task 9c)", () => {
    const titled = (over: Partial<NonNullable<TextRead["title"]>>) => styleOfReference(MEASURES, read({}, { title: { ...TITLE, ...over } }), JUDGED, null).title;
    expect(titled({ stays: true, toMs: 59_607 })).toMatchObject({ stays: true, frames: 600 });
    expect(titled({ ink: "#111111", backing: true })).toMatchObject({ ink: "#111111", look: "label" });
    expect(titled({})).not.toHaveProperty("ink");
    expect(titled({ ink: null })).not.toHaveProperty("ink");
  });

  it("gives no title and the captions off when neither was measured", () => {
    const style = styleOfReference(MEASURES, read(null), JUDGED, null);
    expect(style.title).toBeNull();
    expect(style.captions.on).toBe(false);
    expect(style.notMatched).toEqual([]);
  });
});
