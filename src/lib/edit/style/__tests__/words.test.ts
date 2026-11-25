/**
 * A style from the creator's words (part 3, Task 12, the controller's addendum and fix round 1): Qwen chooses the nearest preset,
 * what to change, whether the words name someone, and what the kit cannot draw; code builds the profile and writes the say.
 * Only Qwen's `ask` is scripted; the schemas, the mapping and the first cut are the real ones.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FaceSample, TakeAnalysis } from "../../analysis";
import type { Asset } from "../../doc";
import { firstCut } from "../../agent/first-cut";
import type { Ask, Message } from "../../agent/model";
import type { stillsOf } from "../../worker/stills";
import { PRESETS, presetOf } from "../presets";
import { StyleProfileSchema, type StyleProfile } from "../profile";
import { CANNOT, CHANGE, ChangeSchema, WORDS_LIMITS, changed, colourName, sayOf, styleOfWords, wordsPrompt, type Change } from "../words";

/** Qwen, as a list of canned answers; each call's messages are kept. */
function scripted(answers: string[]) {
  const calls: { messages: Message[]; maxTokens: number; thinking: boolean }[] = [];
  const ask: Ask = async (messages, { maxTokens, thinking }) => {
    calls.push({ messages: structuredClone(messages), maxTokens, thinking });
    const text = answers.shift();
    if (text === undefined) throw new Error("the script has no answer left");
    return { text, usage: { input: 900, output: 60 }, ms: 400 };
  };
  return { ask, calls };
}
const answer = (over: Record<string, unknown>): string => JSON.stringify(over);
const textOf = (message: Message | undefined): string => (message === undefined ? "" : typeof message.content === "string" ? message.content : message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n"));
const of = (id: string): StyleProfile => presetOf(id)!.profile;
/** A preset's profile as a style from these words holds it: the same, with the words as its source. */
const fromWords = (profile: StyleProfile, words: string): StyleProfile => ({ ...structuredClone(profile), source: { kind: "words", name: words } });

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

/* ── the four cases ────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe("styleOfWords", () => {
  it("turns a phrase with changes into a valid profile, the preset's with what was asked, and says so in plain words", async () => {
    const words = "fast cuts, big yellow captions, zoom when I make a point";
    const qwen = scripted([answer({ preset: "bold-pop", change: { captions: { size: "bigger", highlight: "#FFE14A" }, zooms: "many", pace: "fast" }, named: false })]);
    const { style, say } = await styleOfWords(words, qwen.ask);

    expect(StyleProfileSchema.parse(style)).toEqual(style);
    expect(style).toEqual({
      ...fromWords(of("bold-pop"), words),
      pace: { pauseMs: 150, cutsPerMin: null },
      captions: { ...of("bold-pop").captions, size: 125, highlight: "#ffe14a" },
      punchIns: { perMin: 14, zoom: 1.2 },
    });
    // The yellow it asked for is the preset's own: not said as a change.
    expect(say).toBe("I used Bold pop, with bigger captions, many zooms and a fast pace.");
    expect(qwen.calls).toHaveLength(1);
    expect(qwen.calls[0]).toMatchObject({ maxTokens: WORDS_LIMITS.maxTokens, thinking: false });
    // The words go to Qwen as the creator wrote them, after the system prompt.
    const [system, user] = qwen.calls[0]!.messages;
    expect(system).toEqual({ role: "system", content: wordsPrompt() });
    expect(textOf(user)).toContain(JSON.stringify(words));
  });

  it("gives a bare preset's profile as it is, with the words as its source, and one sentence", async () => {
    const qwen = scripted([answer({ preset: "clean", named: false })]);
    const { style, say } = await styleOfWords("calm and clean", qwen.ask);
    expect(style).toEqual(fromWords(of("clean"), "calm and clean"));
    expect(say).toBe("I used Clean: small captions on a dark pill.");
  });

  it("answers a person's name with the nearest preset, and says it is the nearest look we have, never the name nor that it is theirs", async () => {
    const qwen = scripted([answer({ preset: "bold-pop", named: true })]);
    const { style, say } = await styleOfWords("Hormozi style", qwen.ask);
    expect(qwen.calls).toHaveLength(1);
    expect(style).toEqual(fromWords(of("bold-pop"), "Hormozi style"));
    expect(say).toBe("I used Bold pop: big white words, the one being said in yellow. It is the nearest look we have, not that person's own style.");
    expect(say).not.toMatch(/hormozi/i);
  });

  it("repairs an answer outside the shape once, quoting the problem, then gives a plain error without the answer's text", async () => {
    const qwen = scripted([answer({ preset: "hormozi", named: true }), "Here is the Hormozi style"]);
    const warned = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const thrown: unknown = await styleOfWords("Hormozi style", qwen.ask).then(() => null, (error: unknown) => error);
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe("I couldn't read a style from those words: it is not JSON");
    expect(qwen.calls).toHaveLength(2);
    const repair = qwen.calls[1]!.messages;
    expect(repair.at(-2)).toEqual({ role: "assistant", content: answer({ preset: "hormozi", named: true }) });
    expect(textOf(repair.at(-1))).toMatch(/^Your answer could not be read: preset: .*bold-pop.*\. Answer again with one JSON object only/);
    // The warning holds counts and kinds, never Qwen's text nor the creator's words.
    const logged = warned.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).toContain("no style could be read from the words");
    expect(logged).toContain('"problems":["outside the shape","not JSON"]');
    expect(logged).not.toMatch(/Here is|hormozi/i);
  });

  it("repairs an unknown change and a say it was not asked for, then takes the good answer", async () => {
    const qwen = scripted([
      answer({ say: "Bold pop, with emoji.", preset: "bold-pop", change: { emoji: true } }),
      answer({ preset: "bold-pop", named: false, cannot: ["emoji"] }),
    ]);
    const { style, say } = await styleOfWords("captions with emoji", qwen.ask);
    const repair = textOf(qwen.calls[1]!.messages.at(-1));
    expect(repair).toContain("change: Unrecognized key");
    expect(repair).toContain('Unrecognized key: "say"');
    expect(style).toEqual(fromWords(of("bold-pop"), "captions with emoji"));
    expect(say).toBe("I used Bold pop: big white words, the one being said in yellow. Not in the kit yet: emoji.");
  });

  it("takes \"clean, but black and white\" in one call: the Clean preset with the mono look (the review's case)", async () => {
    const qwen = scripted([answer({ preset: "clean", change: { look: "mono" }, named: false })]);
    const { style, say } = await styleOfWords("clean, but black and white", qwen.ask);
    expect(qwen.calls).toHaveLength(1);
    expect(style).toEqual({ ...fromWords(of("clean"), "clean, but black and white"), look: { preset: "mono" } });
    expect(say).toBe("I used Clean, with a black and white look.");
  });

  it("takes several changes from one phrase: big captions in the middle are bigger and in the middle", async () => {
    const qwen = scripted([answer({ preset: "bold-pop", change: { captions: { size: "bigger", place: "middle" } }, named: false })]);
    const { style, say } = await styleOfWords("big captions in the middle", qwen.ask);
    expect(style.captions).toEqual({ ...of("bold-pop").captions, size: 125, y: 0.5 });
    expect(say).toBe("I used Bold pop, with bigger captions in the middle.");
  });

  it("repairs an answer without named: it is required (Task 12b, the re-review's minor)", async () => {
    const qwen = scripted([
      answer({ preset: "bold-pop", change: { captions: { size: "bigger", place: "middle" } } }),
      answer({ preset: "bold-pop", change: { captions: { size: "bigger", place: "middle" } }, named: false }),
    ]);
    const { say } = await styleOfWords("big captions in the middle", qwen.ask);
    expect(qwen.calls).toHaveLength(2);
    expect(textOf(qwen.calls[1]!.messages.at(-1))).toContain("named: Invalid input");
    expect(say).toBe("I used Bold pop, with bigger captions in the middle.");
  });

  it("asks for named only for a proper name, never for a kind of video or a mood (the real run took \"like a podcast clip\" for a name)", () => {
    const rule = wordsPrompt().split("\n").find((line) => line.startsWith("named: ")) ?? "";
    expect(rule).toMatch(/proper name/);
    expect(rule).toMatch(/never for a kind of video, a format or a mood/);
    expect(rule).not.toMatch(/like …/);
  });

  it("refuses blank words without asking", async () => {
    const qwen = scripted([]);
    await expect(styleOfWords("   ", qwen.ask)).rejects.toThrow("no words were given");
    expect(qwen.calls).toHaveLength(0);
  });

  it("keeps the words as the source's name, spaces made single, cut to 80 characters", async () => {
    const words = `  ${"very ".repeat(30)}calm`;
    const qwen = scripted([answer({ preset: "clean", named: false })]);
    const { style } = await styleOfWords(words, qwen.ask);
    expect(style.source).toEqual({ kind: "words", name: "very ".repeat(16).trimEnd() });
    expect(changed(of("clean"), {}, "calm\n\n  and   clean").source.name).toBe("calm and clean");
  });
});

/* ── the say, one sentence at a time ───────────────────────────────────────────────────────────────────────────────────── */

describe("sayOf: the creator's sentences, written by code", () => {
  const words = "test words";
  const said = (id: string, change: Change, more: { named?: boolean; cannot?: (typeof CANNOT)[number][] } = {}) =>
    sayOf(presetOf(id)!, changed(of(id), change, words), { change, named: more.named ?? false, cannot: more.cannot });
  /** Sentences, split after a full stop. */
  const sentences = (say: string) => say.split(/(?<=\.)\s+/);

  it("names the preset and what it looks like from the first sentence of its line", () => {
    expect(said("bold-pop", {})).toBe("I used Bold pop: big white words, the one being said in yellow.");
    expect(said("clean", {})).toBe("I used Clean: small captions on a dark pill.");
    expect(said("mono", {})).toBe("I used Black and white: black and white, quiet type, unhurried.");
    for (const preset of PRESETS) expect(sentences(said(preset.id, {}))).toHaveLength(1);
  });

  it("says the preset's line only with no change; with any change, the name and the changes (Task 12b)", () => {
    expect(said("bold-pop", { captions: { size: "smaller", place: "high" } })).toBe("I used Bold pop, with smaller captions high on the screen.");
    expect(said("bold-pop", { title: false })).toBe("I used Bold pop, with no title.");
    expect(said("mono", { title: true })).toBe("I used Black and white, with a title over the opening.");
    expect(said("bold-pop", { captions: { on: false } })).toBe("I used Bold pop, with no captions.");
    expect(said("clean", { captions: { look: "pop", place: "low" } })).toBe("I used Clean, with bold pop captions low on the screen.");
    expect(said("bold-pop", { captions: { words: 1 } })).toBe("I used Bold pop, with one word at a time.");
    // Up to the kit's own 16 words a page (the final fix wave: the words' cap came from the schema at 6).
    expect(said("bold-pop", { captions: { words: 12 } })).toBe("I used Bold pop, with twelve words at a time.");
    expect(said("bold-pop", { captions: { words: 16 } })).toBe("I used Bold pop, with sixteen words at a time.");
    expect(said("bold-pop", { captions: { highlight: "#4ADE80" } })).toBe("I used Bold pop, with green on the words that light up.");
    expect(said("key-words", { captions: { highlight: null } })).toBe("I used Key words, with no colour on the words.");
    expect(said("clean", { zooms: "few" })).toBe("I used Clean, with a few zooms.");
    expect(said("bold-pop", { zooms: "none", pace: "calm" })).toBe("I used Bold pop, with no zooms and a calm pace.");
    expect(said("mono", { look: "warm" })).toBe("I used Black and white, with a warm look.");
    expect(said("one-word", { captions: { size: "bigger", words: 3 } })).toBe("I used One word, with bigger captions and three words at a time.");
    expect(said("sentences", { captions: { size: "bigger" } })).toBe("I used Sentences, with bigger captions.");
    // What the preset already has is no change, so the line stays: One word is already fast with many zooms; Bold pop's colour is already yellow.
    expect(said("one-word", { zooms: "many", pace: "fast" })).toBe("I used One word: one huge word at a time, tight cuts, hard zooms.");
    expect(said("bold-pop", { captions: { on: true, highlight: "#ffe14a" }, title: true })).toBe("I used Bold pop: big white words, the one being said in yellow.");
  });

  it("says the nearest-look sentence when the words name a person, a channel or a brand", () => {
    expect(said("one-word", {}, { named: true })).toBe("I used One word: one huge word at a time, tight cuts, hard zooms. It is the nearest look we have, not that person's own style.");
  });

  it("says what the kit cannot draw yet, each once, \"other\" in plain words", () => {
    expect(said("clean", {}, { cannot: ["music", "emoji", "music"] })).toBe("I used Clean: small captions on a dark pill. Not in the kit yet: music, emoji.");
    expect(said("clean", {}, { cannot: ["other"] })).toMatch(/Not in the kit yet: some of what you asked for\.$/);
    expect(said("clean", {}, { cannot: [] })).toBe("I used Clean: small captions on a dark pill.");
  });

  it("keeps to two sentences with everything said at once", () => {
    const all = said("bold-pop", { captions: { size: "bigger", place: "middle" }, title: false }, { named: true, cannot: ["music", "sound effects"] });
    expect(all).toBe("I used Bold pop, with bigger captions in the middle and no title. It is the nearest look we have, not that person's own style; not in the kit yet: music, sound effects.");
    expect(sentences(all)).toHaveLength(2);
    expect(sentences(said("clean", {}, { named: true, cannot: ["music"] }))).toHaveLength(2);
  });

  it("names colours plainly", () => {
    expect(["#ffe14a", "#4ade80", "#ff0000", "#ff8800", "#2563eb", "#a855f7", "#ec4899", "#ffffff", "#000000", "#808080"].map(colourName))
      .toEqual(["yellow", "green", "red", "orange", "blue", "purple", "pink", "white", "black", "grey"]);
  });
});

describe("wordsPrompt", () => {
  it("lists every preset by id, name and line, the change's fields, the kit's six looks, named and cannot", () => {
    const prompt = wordsPrompt();
    for (const preset of PRESETS) expect(prompt).toContain(`${preset.id} — "${preset.name}": ${preset.description}`);
    for (const look of ["natural", "vivid", "warm", "cool", "mono", "soft"]) expect(prompt).toContain(`${look}: `);
    for (const field of ["captions.on", "captions.look", "captions.size", "captions.words", "captions.highlight", "captions.place", "title", "zooms", "pace", "look"]) expect(prompt).toContain(`- ${field}: `);
    expect(prompt).toMatch(/^named: always give it, true or false\. true only when the words give a proper name \(a person, a channel or a brand\) as the style/m);
    for (const what of CANNOT) expect(prompt).toContain(`"${what}"`);
    expect(prompt).toMatch(/several changes at once/);
    // Sentences is offered, its label described as staying, in dark letters.
    expect(prompt).toContain('- sentences — "Sentences": Whole sentences in small white type, as a phone captions a video. A light label holds the hook.');
    expect(prompt).toMatch(/plain captions in tiktok, 52 px, at 0\.76 of the height, 10 words at a time, no colour; a label title that stays to the end, in black letters; no punch-ins/);
    // No free text asked for: the say is code's.
    expect(prompt).not.toMatch(/"say"/);
  });

  it("names in its mood rule only presets there are, each once", () => {
    const mood = wordsPrompt().split("\n").find((line) => line.startsWith("Read the mood")) ?? "";
    const named = [...mood.matchAll(/\(([^)]+)\)/g)].flatMap((group) => group[1]!.split(", "));
    expect([...named].sort()).toEqual(PRESETS.map((preset) => preset.name).sort());
  });
});

/* ── the mapping, one rule at a time ────────────────────────────────────────────────────────────────────────────────────── */

describe("changed: the preset's profile with the change", () => {
  const words = "test words";
  const base = (id: string) => fromWords(of(id), words);

  it("makes captions smaller or bigger by 0.8 and 1.3, held to the kit's 44 to 200", () => {
    expect(changed(of("bold-pop"), { captions: { size: "smaller" } }, words).captions.size).toBe(77);
    expect(changed(of("bold-pop"), { captions: { size: "bigger" } }, words).captions.size).toBe(125);
    const huge: StyleProfile = { ...of("one-word"), captions: { ...of("one-word").captions, size: 190 } };
    const tiny: StyleProfile = { ...of("clean"), captions: { ...of("clean").captions, size: 50 } };
    expect(changed(huge, { captions: { size: "bigger" } }, words).captions.size).toBe(200);
    expect(changed(tiny, { captions: { size: "smaller" } }, words).captions.size).toBe(44);
    // The range is the schema's own, not a copy (review, Minor 1).
    const size = StyleProfileSchema.shape.captions.shape.size;
    expect([size.minValue, size.maxValue]).toEqual([44, 200]);
    expect(CHANGE.size).toEqual({ smaller: 0.8, bigger: 1.3 });
    // Words a page as the kit takes them: 1 to 16, from the captions' schema, and the prompt says so.
    expect(ChangeSchema.safeParse({ captions: { words: 16 } }).success).toBe(true);
    expect(ChangeSchema.safeParse({ captions: { words: 17 } }).success).toBe(false);
    expect(wordsPrompt()).toContain("- captions.words: how many words show at a time, 1 to 16.");
  });

  it("places the captions low, in the middle or high: 0.74, 0.50, 0.26", () => {
    expect(changed(of("clean"), { captions: { place: "low" } }, words).captions.y).toBe(0.74);
    expect(changed(of("clean"), { captions: { place: "middle" } }, words).captions.y).toBe(0.5);
    expect(changed(of("clean"), { captions: { place: "high" } }, words).captions.y).toBe(0.26);
  });

  it("sets the captions on or off, their look, words a page and highlight, as asked", () => {
    expect(changed(of("bold-pop"), { captions: { on: false } }, words).captions).toEqual({ ...of("bold-pop").captions, on: false });
    expect(changed(of("bold-pop"), { captions: { look: "highlight", words: 1, highlight: null } }, words).captions).toEqual({ ...of("bold-pop").captions, look: "highlight", maxWords: 1, highlight: null });
  });

  it("makes zooms none, few (6 a minute at 1.12) or many (14 a minute at 1.2)", () => {
    expect(changed(of("bold-pop"), { zooms: "none" }, words).punchIns).toBeNull();
    expect(changed(of("clean"), { zooms: "few" }, words).punchIns).toEqual({ perMin: 6, zoom: 1.12 });
    expect(changed(of("clean"), { zooms: "many" }, words).punchIns).toEqual({ perMin: 14, zoom: 1.2 });
  });

  it("makes the pace calm, normal or fast: pauses of 350, 220 and 150 ms", () => {
    expect(changed(of("bold-pop"), { pace: "calm" }, words).pace).toEqual({ pauseMs: 350, cutsPerMin: null });
    expect(changed(of("mono"), { pace: "normal" }, words).pace).toEqual({ pauseMs: 220, cutsPerMin: null });
    expect(changed(of("mono"), { pace: "fast" }, words).pace).toEqual({ pauseMs: 150, cutsPerMin: null });
  });

  it("takes the title away, or gives the preset's, or Bold pop's where the preset has none", () => {
    expect(changed(of("bold-pop"), { title: false }, words).title).toBeNull();
    expect(changed(of("clean"), { title: true }, words).title).toEqual(of("clean").title);
    expect(changed(of("mono"), { title: true }, words).title).toEqual(of("bold-pop").title);
    expect(changed(of("mono"), { title: true }, words).title).not.toBe(of("bold-pop").title);
    expect(changed(of("clean"), { zooms: "few" }, words).punchIns).not.toBe(CHANGE.zooms.few);
  });

  it("sets the look", () => {
    expect(changed(of("clean"), { look: "warm" }, words).look).toEqual({ preset: "warm" });
  });

  it("changes nothing else, and leaves the preset as it was", () => {
    const before = structuredClone(of("highlighter"));
    expect(changed(of("highlighter"), {}, words)).toEqual(base("highlighter"));
    expect(changed(of("highlighter"), { captions: { place: "high" }, zooms: "none", look: "cool" }, words)).toEqual({
      ...base("highlighter"), captions: { ...of("highlighter").captions, y: 0.26 }, punchIns: null, look: { preset: "cool" },
    });
    expect(of("highlighter")).toEqual(before);
  });
});

/* ── into the first cut ───────────────────────────────────────────────────────────────────────────────────────────────── */

describe("a style from words, through the real first cut on a made-up take", () => {
  const TAKE_MS = 8000;
  const WORDS = ["Stop", "scrolling", "this", "changes", "everything", "you", "know", "about", "editing", "your", "videos", "today"]
    .map((text, i) => ({ text, startMs: 300 + i * 600, endMs: 300 + i * 600 + 450 }));
  const PAUSES = [{ startMs: 0, endMs: 300, cutMs: 150 }, ...WORDS.slice(0, -1).map((word, i) => ({ startMs: word.endMs, endMs: WORDS[i + 1]!.startMs, cutMs: word.endMs + 75 })), { startMs: 7350, endMs: 8000, cutMs: 7600 }];
  const FACES: FaceSample[] = Array.from({ length: TAKE_MS / 200 }, (_, i) => ({ ms: i * 200, face: { x: 0.3, y: 0.3, w: 0.4, h: 0.2 }, mouth: { x: 0.42, y: 0.43, w: 0.16, h: 0.024 } }));
  const ANALYSIS: TakeAnalysis = { language: "en", pauses: PAUSES, faces: FACES, loudness: { lufs: -24, truePeak: -3, levels: Array.from({ length: 80 }, (_, i) => ({ ms: i * 100, lufs: -24 })) } };
  const TAKE: Asset = { id: "take", kind: "video", origin: "filmed", at: { bucket: "edit-media", path: "u1/take.mp4" }, ms: TAKE_MS, w: 720, h: 1280, sound: true, words: WORDS };
  const stills: typeof stillsOf = async (_user, _edit, frames) => frames.map((frame) => ({ frame, jpeg: "" }));

  it("cuts the take in the words' style: black and white, no captions, no title", async () => {
    const qwen = scripted([answer({ preset: "mono", change: { captions: { on: false } }, named: false })]);
    const { style } = await styleOfWords("black and white, no captions", qwen.ask);
    const cut = scripted([JSON.stringify({ title: null, short: null, stress: [], look: "mono", pauseMs: 350 })]);
    const result = await firstCut({ asset: TAKE, analysis: ANALYSIS, user: "u1", deadlineMs: 170_000, style }, { ask: cut.ask, stills });

    expect(result.edit.captions.on).toBe(false);
    expect(result.edit.look.preset).toBe("mono");
    expect(result.edit.items.filter((item) => item.part === "title")).toEqual([]);
    expect(result.match?.fields.find((field) => field.field === "captions.on")?.verdict).toBe("matched");
  });
});
