/**
 * The first cut's title from a style read off a real reference (part 3, Task 9c): a title that stays, held to the film's end and
 * placed against the whole film, and its letters' colour. Its own file, beside `first-cut.test.ts`, with the same boundaries
 * stood in for: Qwen's `ask` (one canned answer) and the worker's `stills` (stand-in JPEGs). The recipes, the door and review
 * are the real ones, on a made-up take.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FaceSample, TakeAnalysis } from "../../analysis";
import { layout, placed } from "../../derive";
import type { Asset, Edit } from "../../doc";
import type { StyleProfile } from "../../style/profile";
import type { stillsOf } from "../../worker/stills";
import { firstCut } from "../first-cut";
import type { Ask } from "../model";

/* ── a made-up take: 8 s, eight words, three pauses; the face low for the first 4 s, then high ──────────────────────────── */

const TAKE_MS = 8000;
const WORDS = ["Make", "every", "opening", "count", "then", "show", "the", "proof"].map((text, i) => ({ text, startMs: 300 + i * 900, endMs: 300 + i * 900 + 700 }));
const PAUSES = [{ startMs: 0, endMs: 300, cutMs: 150 }, { startMs: 3000, endMs: 3400, cutMs: 3200 }, { startMs: 7500, endMs: 8000, cutMs: 7750 }];
/** The face from 0.3 to 0.5 of the height until 4 s (clear of a title at 0.18), then from 0.08 to 0.35 (a title at 0.18 is on its eyes). */
const FACES: FaceSample[] = Array.from({ length: TAKE_MS / 200 }, (_, i) => {
  const top = i * 200 < 4000 ? 0.3 : 0.08;
  const h = i * 200 < 4000 ? 0.2 : 0.27;
  return { ms: i * 200, face: { x: 0.3, y: top, w: 0.4, h }, mouth: { x: 0.42, y: top + h * 0.65, w: 0.16, h: h * 0.12 } };
});
const ANALYSIS: TakeAnalysis = { language: "en", pauses: PAUSES, faces: FACES, loudness: null };
const TAKE: Asset = { id: "take", kind: "video", origin: "filmed", at: { bucket: "edit-media", path: "u1/take.mp4" }, ms: TAKE_MS, w: 720, h: 1280, sound: true, words: WORDS };

/** A style as a reference's reading gives one: plain captions low, a label title at 0.18 for two seconds, no punch-ins. */
const STYLE: StyleProfile = {
  source: { kind: "reference", name: "test" },
  pace: { pauseMs: 200, cutsPerMin: null },
  captions: { on: true, look: "plain", font: "inter", size: 64, y: 0.72, maxWords: 3, highlight: null },
  title: { on: true, y: 0.18, frames: 60, look: "label", size: 110 },
  punchIns: null,
  look: { preset: "natural" },
  notMatched: [],
};

const ask: Ask = async () => ({ text: JSON.stringify({ title: "Make it *count*", short: "*Count*", stress: [], look: "natural", pauseMs: 200 }), usage: { input: 3000, output: 60 }, ms: 1000 });
const stills: typeof stillsOf = async (_user, _edit, frames) => frames.map((frame) => ({ frame, jpeg: Buffer.from(`jpeg ${frame}`).toString("base64") }));
const cut = (style: StyleProfile) => firstCut({ asset: TAKE, analysis: ANALYSIS, user: "u1", deadlineMs: 170_000, style }, { ask, stills, now: () => 0 });
const titleOf = (edit: Edit) => edit.items.find((item) => item.part === "title");

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("firstCut: a style's title that stays, and its ink (Task 9c)", () => {
  it("holds a title that stays to the film's end, and places it off the face the whole film long, not only over its opening", async () => {
    const gone = (await cut(STYLE)).edit;
    // Two seconds long, over the opening only: where the style puts it.
    expect(titleOf(gone)).toMatchObject({ frames: 60, props: { y: 0.18 } });

    const held = (await cut({ ...STYLE, title: { ...STYLE.title!, frames: 600, stays: true } })).edit;
    const title = titleOf(held)!;
    expect(title.frames).toBeNull();
    const shown = placed(held).find((each) => each.thing.id === title.id)!;
    expect(shown.at + shown.frames).toBe(layout(held).frames);
    // The face rises at 4 s, under a title at 0.18: held to the end, it is put clear of it.
    expect(title.part === "title" && title.props.y).not.toBe(0.18);
  });

  it("sets the title's letters in the style's ink, and white without one", async () => {
    const dark = titleOf((await cut({ ...STYLE, title: { ...STYLE.title!, ink: "#111111" } })).edit);
    expect(dark?.part === "title" && dark.props.color).toBe("#111111");
    const white = titleOf((await cut(STYLE)).edit);
    expect(white?.part === "title" && white.props.color).toBe("#ffffff");
  });
});
