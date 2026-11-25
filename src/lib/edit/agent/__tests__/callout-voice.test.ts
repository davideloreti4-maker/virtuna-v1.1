/**
 * Task 3b (ruling S6, amended 2026-11-24): a new call-out speaks in the film's voice, by code. Told so in the craft lines, the
 * model sent the template call-out (pop, white, 800) on the plain film three times of three; so where the captions draw every
 * word alike, a white call-out the answer added is set as a label in the title's colour and weight. On the real code (the
 * door, the review, the moves, the loop), with Qwen's `ask` stood in for by scripted answers, the made-up close-up of
 * `gives-way.test.ts`. Every text here is made up. The fix wave (F1 to F3): what the creator named stays, a call-out moved by
 * remove and add is not a new one, and a white highlight on plain white captions, unasked, is undone first (`plainHighlight`).
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { Analyses, FaceSample, TakeAnalysis } from "../../analysis";
import { placed } from "../../derive";
import { newEdit, type Asset, type Edit, type Item, type Mark } from "../../doc";
import { applyOps } from "../../ops";
import { review } from "../../review";
import { LABEL_GAP, calloutVoice, plainHighlight } from "../context";
import { MARKED } from "../first-cut";
import { change, codeMoves, type AgentInput } from "../loop";
import type { Ask } from "../model";
import { CRAFT } from "../prompt";

/* ── a made-up close-up: 8 s, 720x1280, sixteen words, the face filling the middle of the frame ─────────────────────────── */

const TAKE_MS = 8000;
const WORDS = ["Bake", "the", "bread", "slowly", "and", "it", "rises", "tall", "every", "single", "time", "you", "try", "this", "at", "home"]
  .map((text, i) => ({ text, startMs: 200 + i * 480, endMs: 600 + i * 480 }));
const facesAt = (y: number, h: number, mouthY: number): FaceSample[] =>
  Array.from({ length: TAKE_MS / 200 }, (_, i) => ({ ms: i * 200, face: { x: 0.2, y, w: 0.58, h }, mouth: { x: 0.37, y: mouthY, w: 0.22, h: 0.06 } }));
const analysisOf = (faces: FaceSample[]): TakeAnalysis => ({ language: "en", pauses: [{ startMs: 0, endMs: 200, cutMs: 100 }, { startMs: 7880, endMs: 8000, cutMs: 7940 }], faces, loudness: null });
/** A close-up: the face from 0.32 to 0.74 of the height, so the band above it is the one place a call-out has. */
const CLOSE: Analyses = { take: analysisOf(facesAt(0.32, 0.42, 0.62)) };

const TAKE: Asset = { id: "take", kind: "video", origin: "filmed", at: { bucket: "edit-media", path: "u1/take.mp4" }, ms: TAKE_MS, w: 720, h: 1280, sound: true, words: WORDS.map((word) => ({ ...word })) };
const LIBRARY: readonly Asset[] = [TAKE];

const through = (edit: Edit, ops: unknown[]): Edit => {
  const made = applyOps(edit, ops, LIBRARY);
  if (!made.ok) throw new Error(made.problems.map((problem) => problem.message).join("; "));
  return made.edit;
};
/** The house's captions: plain, a weight, no highlight colour, so every word is drawn alike. */
const CAPTIONS = { op: "captions.set", look: "plain", font: "tiktok", size: 64, y: 0.76, maxWords: 5, highlight: null, weight: 600 } as const;
/** The house's label, staying to the end. */
const label = (): Item => ({ id: "hook", part: "title", anchor: "start", at: 0, frames: null, props: { text: "Bread that rises every time", font: "tiktok", look: "label", y: 0.2, size: 72, color: "#111111", accent: null, weight: 600 } });
const house = (): Edit => through(newEdit(TAKE), [CAPTIONS, { op: "item.add", item: label() }]);

type CalloutMark = Extract<Mark, { part: "callout" }>;
/** The template call-out the model sends: pop, white, 800, 130 px, above the face when "rises" is said. */
const sent = (props: Partial<CalloutMark["props"]> = {}): CalloutMark => ({ id: "c1", part: "callout", atMs: 3080, lenMs: 1200, props: { text: "RISES", font: "tiktok", look: "pop", x: 0.5, y: 0.2, size: 130, color: "#ffffff", weight: 800, ...props } });
const adding = (mark: Mark) => [{ op: "mark.add", shot: "s1", mark }];

/** A request that names no colour, look or weight: its only such word is in the call-out's quoted text. */
const ASKED = 'add a call-out "RISES" when I say rises';
/** The code's moves on an answer, as the loop makes them, given the creator's request. */
const moved = (before: Edit, ops: unknown[], request = ASKED) => codeMoves(before, through(before, ops), ops, CLOSE, LIBRARY, request);
const calloutIn = (edit: Edit, id = "c1"): CalloutMark | undefined => edit.shots.flatMap((shot) => shot.marks).find((mark): mark is CalloutMark => mark.id === id && mark.part === "callout");
/** The template call-out as the label it becomes on the house film. */
const asLabel = (mark: CalloutMark): CalloutMark => ({ ...mark, props: { ...mark.props, look: "label", color: "#111111", weight: 600, size: 96 } });
const whiteHighlight = (highlight = "#ffffff") => ({ op: "captions.set", highlight });
const startOf = (edit: Edit, id: string): number => {
  const place = placed(edit).find((each) => each.thing.id === id);
  if (!place) throw new Error(`${id} does not show`);
  return place.at;
};
const errors = (edit: Edit) => review(edit, CLOSE).filter((finding) => finding.severity === "error");

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
const input = (edit: Edit, request: string): AgentInput => ({ edit, analyses: CLOSE, request, library: LIBRARY, user: "u1", deadlineMs: 50_000, stills: false });

let logs: MockInstance[] = [];
beforeEach(() => {
  logs = [vi.spyOn(console, "log").mockImplementation(() => undefined), vi.spyOn(console, "warn").mockImplementation(() => undefined)];
});
afterEach(() => logs.forEach((spy) => spy.mockRestore()));

describe("a new call-out on a film whose captions draw every word alike is a label in the title's voice, by code", () => {
  it("1: the template call-out becomes a label in the label title's colour and weight, at most 96 px; the title gives way to it", () => {
    const before = house();
    const after = through(before, adding(sent()));
    expect(calloutVoice(before, after, ASKED).ops).toEqual([{ op: "mark.set", id: "c1", props: { look: "label", color: "#111111", weight: 600, size: 96 } }]);
    const made = moved(before, adding(sent()));
    expect(calloutIn(made.edit)).toEqual({ ...sent(), props: { ...sent().props, look: "label", color: "#111111", weight: 600, size: 96 } });
    // The staying title gave way to the call-out as it is finally drawn.
    expect(made.edit.items.find((item) => item.id === "hook")?.frames).toBe(startOf(made.edit, "c1") - LABEL_GAP);
    expect(made.says).toEqual(['so the title "Bread that rises every time" now ends where the call-out "RISES" starts']);
  });

  it("2: whatever colour the model gave it: the title's ink on the pop look (as one live run sent it), white in capitals, or yellow", () => {
    const before = house();
    for (const color of ["#111111", "#FFFFFF", "#ffe14a"]) {
      const after = through(before, adding(sent({ color })));
      expect(calloutVoice(before, after, ASKED).ops, color).toEqual([{ op: "mark.set", id: "c1", props: { look: "label", color: "#111111", weight: 600, size: 96 } }]);
      expect(calloutIn(moved(before, adding(sent({ color }))).edit), color).toEqual(asLabel(sent()));
    }
  });

  it("3: a call-out in a colour the creator named is left exactly as sent", () => {
    const before = house();
    const yellow = sent({ color: "#ffe14a" });
    const request = 'add a yellow call-out "RISES" when I say rises';
    expect(calloutVoice(before, through(before, adding(yellow)), request).ops).toEqual([]);
    expect(calloutIn(moved(before, adding(yellow), request).edit)).toEqual(yellow);
  });

  it("4: on captions with a highlight colour, a white pop call-out is left exactly as sent", () => {
    const before = through(house(), [{ op: "captions.set", highlight: "#ffe14a" }]);
    expect(calloutVoice(before, through(before, adding(sent())), ASKED).ops).toEqual([]);
    expect(calloutIn(moved(before, adding(sent())).edit)).toEqual(sent());
  });

  it("5: a call-out already in the edit, which the answer only moves, is left as it was", () => {
    const before = through(house(), adding(sent()));
    const lower = [{ op: "mark.set", id: "c1", props: { y: 0.24 } }];
    expect(calloutVoice(before, through(before, lower), ASKED).ops).toEqual([]);
    expect(calloutIn(moved(before, lower).edit)).toEqual({ ...sent(), props: { ...sent().props, y: 0.24 } });
  });

  it("6: with no title in the edit, the label call-out's own ink and the captions' weight", () => {
    const before = through(newEdit(TAKE), [CAPTIONS]);
    expect(calloutVoice(before, through(before, adding(sent())), ASKED).ops).toEqual([{ op: "mark.set", id: "c1", props: { look: "label", color: CRAFT.callout.labelInk, weight: CAPTIONS.weight, size: 96 } }]);
  });

  it("7: its size is held inside the label call-out's sizes: 60 becomes 72, 80 stays 80, 130 becomes 96", () => {
    const before = house();
    for (const [asked, drawn] of [[60, 72], [80, 80], [130, 96]] as const) {
      expect(calloutVoice(before, through(before, adding(sent({ size: asked }))), ASKED).ops, String(asked)).toEqual([{ op: "mark.set", id: "c1", props: { look: "label", color: "#111111", weight: 600, size: drawn } }]);
    }
    expect(CRAFT.callout.labelPx).toEqual([72, 96]);
  });

  it("8: through the loop, an answer adding the template call-out comes out in one round with the label call-out and no new error", async () => {
    const before = house();
    expect(errors(before)).toEqual([]);
    const result = await change(input(before, 'add a call-out "RISES" when I say rises'), scripted([answer("I added the call-out RISES above your face.", adding(sent()))]));
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed"]);
    expect(calloutIn(result.edit)?.props).toEqual({ ...sent().props, look: "label", color: "#111111", weight: 600, size: 96 });
    expect(errors(result.edit)).toEqual([]);
    // The ops recorded give the edit: the move is among them.
    expect(through(before, result.ops)).toEqual(result.edit);
  });
});

describe("the fix wave: what the creator named stays, a moved call-out is not new, an unasked white highlight is undone", () => {
  it("F1.1: a request that names white leaves the white pop call-out exactly as sent", () => {
    const request = 'add a white call-out "RISES" when I say rises';
    const before = house();
    expect(calloutVoice(before, through(before, adding(sent())), request).ops).toEqual([]);
    expect(calloutIn(moved(before, adding(sent()), request).edit)).toEqual(sent());
  });

  it("F1.2: a request that names the pop look, or bold, leaves it exactly as sent", () => {
    const before = house();
    for (const request of ['add a pop call-out "RISES" when I say rises', 'put a BOLD call-out "RISES" on rises']) {
      expect(calloutIn(moved(before, adding(sent()), request).edit), request).toEqual(sent());
    }
  });

  it("F1.3: a colour word only inside the call-out's quoted words is not the creator naming one: set as the label", () => {
    const noise = sent({ text: "White noise" });
    expect(calloutIn(moved(house(), adding(noise), 'add a call-out "White noise" when I say rises').edit)).toEqual(asLabel(noise));
  });

  it("F2: a call-out moved to another shot by remove and add is left as sent; one with other words is set as the label", () => {
    const before = through(house(), [{ op: "shot.split", id: "s1", atMs: 4000, newId: "s2" }, ...adding(sent())]);
    const moving = (text: string) => [{ op: "mark.remove", id: "c1" }, { op: "mark.add", shot: "s2", mark: { ...sent({ text, y: 0.24 }), id: "c2", atMs: 5000 } }];
    expect(calloutVoice(before, through(before, moving("RISES")), "move the call-out to the second part").ops).toEqual([]);
    expect(calloutIn(moved(before, moving("RISES"), "move the call-out to the second part").edit, "c2")).toEqual({ ...sent({ y: 0.24 }), id: "c2", atMs: 5000 });
    expect(calloutIn(moved(before, moving("TALL"), "move the call-out to the second part").edit, "c2")).toEqual(asLabel({ ...sent({ text: "TALL", y: 0.24 }), id: "c2", atMs: 5000 }));
  });

  it("F3.1: a white highlight sent beside the call-out, unasked, is undone first: highlight null and the label call-out", () => {
    for (const white of ["#ffffff", "#FFFFFF"]) {
      const before = house();
      const ops = [...adding(sent()), whiteHighlight(white)];
      expect(plainHighlight(before, through(before, ops), ASKED)).toEqual({ ops: [{ op: "captions.set", highlight: null }], says: [] });
      const made = moved(before, ops);
      expect(made.edit.captions.highlight, white).toBeNull();
      expect(calloutIn(made.edit), white).toEqual(asLabel(sent()));
    }
  });

  it("F3.2: a white highlight the creator asked for is left as sent", () => {
    const before = house();
    const ops = [whiteHighlight()];
    expect(plainHighlight(before, through(before, ops), "make the highlight white").ops).toEqual([]);
    expect(moved(before, ops, "make the highlight white").edit.captions.highlight).toBe("#ffffff");
  });

  it("F3.3: a highlight already white before the answer gives no op", () => {
    const before = through(house(), [whiteHighlight()]);
    expect(plainHighlight(before, through(before, adding(sent())), ASKED).ops).toEqual([]);
  });

  it("F3.4: a stress asked in the same answer as a white highlight: the dodge is undone, then the stress shows in MARKED", () => {
    const before = house();
    const ops = [{ op: "word.set", asset: "take", index: 2, stress: true }, whiteHighlight()];
    const made = moved(before, ops, "stress the word bread");
    expect(made.edit.captions.highlight).toBe(MARKED);
    expect(made.ops).toEqual([{ op: "captions.set", highlight: null }, { op: "captions.set", highlight: MARKED }]);
  });

  it("F3.5: through the loop, one answer with the white pop call-out and a white highlight: one round, highlight null, the label, no error", async () => {
    const before = house();
    const result = await change(input(before, ASKED), scripted([answer("I added the call-out RISES above your face.", [...adding(sent()), whiteHighlight()])]));
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed"]);
    expect(result.edit.captions.highlight).toBeNull();
    expect(calloutIn(result.edit)?.props).toEqual(asLabel(sent()).props);
    expect(errors(result.edit)).toEqual([]);
  });
});
