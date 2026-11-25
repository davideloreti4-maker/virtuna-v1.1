/**
 * The presets (part 3, Task 12, the controller's addendum, X105): six ready-made styles, designed and named by their look, each a
 * valid profile, `bold-pop` built from the house style. Each is proved by the real first cut on a made-up take, with only Qwen's
 * `ask` scripted: the recipes, the door, `review` and `matchOf` are the real ones.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FaceSample, TakeAnalysis } from "../../analysis";
import type { Asset, Edit } from "../../doc";
import { firstCut } from "../../agent/first-cut";
import type { Ask } from "../../agent/model";
import type { stillsOf } from "../../worker/stills";
import { PRESETS, PRESET_IDS, presetOf } from "../presets";
import { StyleProfileSchema } from "../profile";

/* ── a made-up take: 8 s, 720x1280, twelve words, five pauses, the face from 0.3 to 0.5 of the height ─────────────────── */

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
const FACES: FaceSample[] = Array.from({ length: TAKE_MS / 200 }, (_, i) => ({ ms: i * 200, face: { x: 0.3, y: 0.3, w: 0.4, h: 0.2 }, mouth: { x: 0.42, y: 0.43, w: 0.16, h: 0.024 } }));
const ANALYSIS: TakeAnalysis = {
  language: "en", pauses: PAUSES, faces: FACES,
  loudness: { lufs: -24, truePeak: -3, levels: Array.from({ length: TAKE_MS / 100 }, (_, i) => ({ ms: i * 100, lufs: PAUSES.some((pause) => pause.startMs <= i * 100 && i * 100 < pause.endMs) ? -70 : -24 })) },
};
const TAKE: Asset = { id: "take", kind: "video", origin: "filmed", at: { bucket: "edit-media", path: "u1/take.mp4" }, ms: TAKE_MS, w: 720, h: 1280, sound: true, words: WORDS.map((word) => ({ ...word })) };

/** Qwen, as one canned set of choices; the clock moves a second a call. */
function scripted(answers: string[]) {
  const clock = { t: 0 };
  const ask: Ask = async () => {
    const text = answers.shift();
    if (text === undefined) throw new Error("the script has no answer left");
    clock.t += 1000;
    return { text, usage: { input: 2000, output: 60 }, ms: 1000 };
  };
  return { ask, now: () => clock.t };
}
const stills: typeof stillsOf = async (_user, _edit, frames) => frames.map((frame) => ({ frame, jpeg: Buffer.from(`jpeg ${frame}`).toString("base64") }));
const CHOICES = JSON.stringify({ title: "Edit *smarter*", short: "*Smarter*", stress: [1, 4], look: "natural", pauseMs: 250 });

const titleOf = (edit: Edit) => edit.items.find((item) => item.part === "title");
const punchedOf = (edit: Edit) => edit.shots.filter((shot) => shot.framing.from.zoom > 1).length;

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

/* ── the tests ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe("PRESETS", () => {
  it("are the seven, in the order the page shows them, Bold pop last (the native default), each a valid preset profile named by its look", () => {
    expect(PRESETS.map((preset) => preset.id)).toEqual(["sentences", "clean", "one-word", "highlighter", "key-words", "mono", "bold-pop"]);
    expect(PRESET_IDS).toEqual(PRESETS.map((preset) => preset.id));
    expect(PRESETS.map((preset) => preset.name)).toEqual(["Sentences", "Clean", "One word", "Highlighter", "Key words", "Black and white", "Bold pop"]);
    for (const preset of PRESETS) {
      expect(StyleProfileSchema.parse(preset.profile)).toEqual(preset.profile);
      expect(preset.profile.source).toEqual({ kind: "preset", name: preset.name });
      expect(preset.profile.pace.cutsPerMin).toBeNull();
      expect("quiet" in preset.profile.pace).toBe(false);
      expect(preset.profile.notMatched).toEqual([]);
      expect(preset.description).toMatch(/\S/);
      expect(presetOf(preset.id)).toBe(preset);
    }
    expect(presetOf("hormozi")).toBeUndefined();
  });

  it("hold the addendum's numbers, and Task 12b's for sentences", () => {
    const of = (id: string) => presetOf(id)!.profile;
    expect(of("sentences")).toEqual({
      source: { kind: "preset", name: "Sentences" }, pace: { pauseMs: 250, cutsPerMin: null },
      captions: { on: true, look: "plain", font: "tiktok", size: 52, y: 0.76, maxWords: 10, highlight: null },
      title: { on: true, y: 0.18, frames: 90, look: "label", size: 64, ink: "#111111", stays: true }, punchIns: null, look: { preset: "natural" }, notMatched: [],
    });
    expect(presetOf("sentences")!.description).toBe("Whole sentences in small white type, as a phone captions a video. A light label holds the hook.");
    expect(of("one-word")).toMatchObject({
      pace: { pauseMs: 150 }, captions: { on: true, look: "pop", font: "tiktok", size: 150, y: 0.64, maxWords: 1, highlight: "#ffe14a" },
      title: { on: true, y: 0.2, frames: 60, look: "bold", size: 140 }, punchIns: { perMin: 14, zoom: 1.2 }, look: { preset: "natural" },
    });
    expect(of("clean")).toMatchObject({
      pace: { pauseMs: 320 }, captions: { on: true, look: "pill", font: "inter", size: 68, y: 0.76, maxWords: 4, highlight: null },
      title: { on: true, y: 0.18, frames: 90, look: "label", size: 110 }, punchIns: null, look: { preset: "natural" },
    });
    expect(of("highlighter")).toMatchObject({
      pace: { pauseMs: 220 }, captions: { on: true, look: "highlight", font: "montserrat", size: 88, y: 0.7, maxWords: 3, highlight: "#4ade80" },
      title: { on: true, y: 0.2, frames: 75, look: "outline", size: 130 }, punchIns: { perMin: 6, zoom: 1.15 }, look: { preset: "natural" },
    });
    expect(of("key-words")).toMatchObject({
      pace: { pauseMs: 250 }, captions: { on: true, look: "plain", font: "montserrat", size: 88, y: 0.72, maxWords: 4, highlight: "#ffe14a" },
      title: { on: true, y: 0.2, frames: 75, look: "bold", size: 120 }, punchIns: { perMin: 6, zoom: 1.12 }, look: { preset: "natural" },
    });
    expect(of("mono")).toMatchObject({
      pace: { pauseMs: 350 }, captions: { on: true, look: "plain", font: "inter", size: 72, y: 0.74, maxWords: 4, highlight: null },
      title: null, punchIns: null, look: { preset: "mono" },
    });
  });

  it("hold Bold pop's own numbers: the house's until the native default", () => {
    expect(presetOf("bold-pop")!.profile).toEqual({
      source: { kind: "preset", name: "Bold pop" }, pace: { pauseMs: 220, cutsPerMin: null },
      captions: { on: true, look: "pop", font: "tiktok", size: 96, y: 0.72, maxWords: 3, highlight: "#ffe14a" },
      title: { on: true, y: 0.2, frames: 75, look: "bold", size: 130 }, punchIns: { perMin: 8, zoom: 1.15 }, look: { preset: "natural" }, notMatched: [],
    });
    expect(presetOf("bold-pop")!.description).toBe("Big white words, the one being said in yellow. A hook up top, light zooms.");
  });

  it("are frozen: a caller cannot change a preset for everyone", () => {
    const clean = presetOf("clean")!;
    expect(Object.isFrozen(clean)).toBe(true);
    expect(Object.isFrozen(clean.profile.captions)).toBe(true);
    expect(() => {
      (clean.profile.captions as { size: number }).size = 200;
    }).toThrow();
  });

  it("keep presets.json to numbers and words of the look: no link, no file, no handle", () => {
    const json = readFileSync(join(__dirname, "..", "presets.json"), "utf8");
    expect(json).not.toMatch(/https?:|www\.|\.mp4|\.mov|@/i);
  });
});

describe("each preset's first cut, on a made-up take", () => {
  it("sentences: the hook is a label in dark ink that stays to the film's end, and the pages hold up to ten words", async () => {
    const qwen = scripted([CHOICES]);
    const result = await firstCut({ asset: TAKE, analysis: ANALYSIS, user: "u1", deadlineMs: 170_000, style: presetOf("sentences")!.profile }, { ask: qwen.ask, stills, now: qwen.now });
    const title = titleOf(result.edit);
    expect(title?.part === "title" && { frames: title.frames, look: title.props.look, color: title.props.color }).toEqual({ frames: null, look: "label", color: "#111111" });
    expect(result.edit.captions).toMatchObject({ look: "plain", maxWords: 10, highlight: null });
    expect(punchedOf(result.edit)).toBe(0);
  });

  it.each(PRESETS.map((preset) => [preset.id, preset] as const))("%s: the cut carries the preset's captions, title, punch-ins and look, with no error left", async (_id, preset) => {
    const qwen = scripted([CHOICES]);
    const result = await firstCut({ asset: TAKE, analysis: ANALYSIS, user: "u1", deadlineMs: 170_000, style: preset.profile }, { ask: qwen.ask, stills, now: qwen.now });
    const { captions, title, punchIns, look } = preset.profile;

    expect(result.findings.filter((finding) => finding.severity === "error")).toEqual([]);
    expect(result.edit.captions).toMatchObject({ on: true, look: captions.look, font: captions.font, maxWords: captions.maxWords, highlight: captions.highlight });
    expect(result.edit.look.preset).toBe(look.preset);
    expect(titleOf(result.edit) !== undefined).toBe(title !== null);
    if (punchIns === null) expect(punchedOf(result.edit)).toBe(0);
    else expect(punchedOf(result.edit)).toBeGreaterThan(0);
    // Nothing measured is off the preset on a take that leaves room: every field matched or near.
    expect(result.match?.fields.filter((field) => field.verdict === "not")).toEqual([]);
  });
});
