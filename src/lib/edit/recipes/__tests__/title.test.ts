/**
 * placeTitle (part 3, Task 10b, A): a title moved, and last made smaller, so review finds no error for it. Review, the door and
 * the kit's boxes are the real ones, on made-up takes.
 */
import { describe, expect, it } from "vitest";
import type { Analyses, FaceSample } from "../../analysis";
import { newEdit, type Asset, type Edit, type Item, type Mark } from "../../doc";
import { applyOps, type Op } from "../../ops";
import { review, type Finding } from "../../review";
import { placeTitle } from "../title";

const TAKE: Asset = {
  id: "take", kind: "video", origin: "filmed", at: { bucket: "edit-media", path: "u1/take.mp4" },
  ms: 6000, w: 720, h: 1280, sound: true, words: [{ text: "Hi", startMs: 100, endMs: 5900 }],
};
const through = (edit: Edit, ops: Op[]): Edit => {
  if (ops.length === 0) return edit;
  const made = applyOps(edit, ops, [TAKE]);
  if (!made.ok) throw new Error(made.problems.map((problem) => `${problem.path}: ${problem.message}`).join("; "));
  return made.edit;
};
/** The face five times a second from `top` down `h` of the picture, its mouth two thirds of the way down it. */
const facesAt = (top: number, h: number): FaceSample[] =>
  Array.from({ length: 30 }, (_, i) => ({ ms: i * 200, face: { x: 0.3, y: top, w: 0.4, h }, mouth: { x: 0.42, y: top + h * 0.65, w: 0.16, h: h * 0.12 } }));
const analysesWith = (faces: FaceSample[]): Analyses => ({ take: { language: "en", pauses: [], faces, loudness: null } });
const NO_FACE = analysesWith([]);

type TitleProps = Extract<Item, { part: "title" }>["props"];
/** The take with its captions off, and a title on the film's first two seconds. */
function titled(props: Partial<TitleProps>): Edit {
  const title: Item = { id: "hook", part: "title", anchor: "start", at: 0, frames: 60, props: { text: "Edit smarter", font: "tiktok", look: "label", y: 0.14, size: 110, color: "#ffffff", accent: null, ...props } };
  return through(newEdit(TAKE), [{ op: "captions.set", on: false }, { op: "item.add", item: title }]);
}
const ofHook = (edit: Edit, given: Analyses): Finding[] => review(edit, given).filter((finding) => finding.where.item === "hook" || finding.where.mark === "hook");
const codes = (findings: Finding[], severity: Finding["severity"]) => findings.filter((finding) => finding.severity === severity).map((finding) => finding.code);
const hookAt = (y: number, props: Partial<TitleProps> = {}) => titled({ ...props, y });

describe("placeTitle: a title moved so review has no error for it", () => {
  it("moves a label title from under the apps' top bars down to the nearest place with no error: 0.14 to 0.18", () => {
    const edit = titled({});
    expect(codes(ofHook(edit, NO_FACE), "error")).toEqual(["under-buttons", "under-buttons"]);
    // 0.16 still sits under Instagram's bar; 0.18 is the first place with none.
    expect(codes(ofHook(hookAt(0.16), NO_FACE), "error")).toEqual(["under-buttons"]);
    const ops = placeTitle(edit, NO_FACE, "hook");
    expect(ops).toEqual([{ op: "item.set", id: "hook", props: { y: 0.18 } }]);
    const placed = through(edit, ops);
    expect(ofHook(placed, NO_FACE)).toEqual([]);
    expect(placeTitle(placed, NO_FACE, "hook")).toEqual([]);
  });

  it("takes a clear place within 0.12 over a nearer one with a warning: a two-line title from 0.14 to 0.22, not 0.20", () => {
    const edit = titled({ text: "Grab a pen today", look: "bold", size: 130 });
    expect(codes(ofHook(hookAt(0.2, { text: "Grab a pen today", look: "bold", size: 130 }), NO_FACE), "error")).toEqual([]);
    expect(codes(ofHook(hookAt(0.2, { text: "Grab a pen today", look: "bold", size: 130 }), NO_FACE), "warn")).toEqual(["under-buttons"]);
    expect(placeTitle(edit, NO_FACE, "hook")).toEqual([{ op: "item.set", id: "hook", props: { y: 0.22 } }]);
  });

  it("moves a title off the eyes of a face high in the picture to the nearer free side, below it, warning and all past 0.12", () => {
    const high = analysesWith(facesAt(0.08, 0.27));
    const edit = titled({ y: 0.2 });
    expect(codes(ofHook(edit, high), "error")).toContain("on-face");
    // Above the face is the bars; below it, 0.34 touches the chin and the first clear place, 0.40, is 0.20 away.
    expect(codes(ofHook(hookAt(0.34), high), "warn")).toEqual(["on-face"]);
    expect(ofHook(hookAt(0.4), high)).toEqual([]);
    const ops = placeTitle(edit, high, "hook");
    expect(ops).toEqual([{ op: "item.set", id: "hook", props: { y: 0.34 } }]);
    expect(codes(ofHook(through(edit, ops), high), "error")).toEqual([]);
    expect(placeTitle(through(edit, ops), high, "hook")).toEqual([]);
  });

  it("makes it smaller when no place is free at its size: a two-line title above a face that leaves room for one line only", () => {
    const tall = analysesWith(facesAt(0.25, 0.6));
    const props = { text: "Grab a pen today", look: "bold" as const, size: 130, y: 0.2 };
    const edit = titled(props);
    for (let k = 0; k <= 40; k++) expect(codes(ofHook(hookAt(Math.round((0.1 + 0.02 * k) * 100) / 100, props), tall), "error").length, `y ${0.1 + 0.02 * k}`).toBeGreaterThan(0);
    const ops = placeTitle(edit, tall, "hook");
    expect(ops).toEqual([{ op: "item.set", id: "hook", props: { size: 111 } }]); // 0.85 of 130, on one line, where it was
    expect(codes(ofHook(through(edit, ops), tall), "error")).toEqual([]);
    expect(placeTitle(through(edit, ops), tall, "hook")).toEqual([]);
  });

  it("changes nothing when no place and no size clears it: a title too long for the stage at the least size", () => {
    const edit = titled({ text: "W".repeat(80), y: 0.5 });
    expect(codes(ofHook(edit, NO_FACE), "error")).toContain("text-fits");
    expect(placeTitle(edit, NO_FACE, "hook")).toEqual([]);
  });

  it("changes nothing for a title with no error, warnings and all", () => {
    expect(placeTitle(hookAt(0.3), NO_FACE, "hook")).toEqual([]);
    const warned = hookAt(0.2, { text: "Grab a pen today", look: "bold", size: 130 });
    expect(codes(ofHook(warned, NO_FACE), "warn")).toEqual(["under-buttons"]);
    expect(placeTitle(warned, NO_FACE, "hook")).toEqual([]);
  });

  it("places a title that is a mark on a shot as it places one on the film, with mark.set", () => {
    const mark: Mark = { id: "hook", part: "title", atMs: 100, lenMs: 2000, props: { text: "Edit smarter", font: "tiktok", look: "label", y: 0.14, size: 110, color: "#ffffff", accent: null } };
    const edit = through(newEdit(TAKE), [{ op: "captions.set", on: false }, { op: "mark.add", shot: "s1", mark }]);
    expect(placeTitle(edit, NO_FACE, "hook")).toEqual([{ op: "mark.set", id: "hook", props: { y: 0.18 } }]);
  });

  it("refuses an id that is not a title of the edit", () => {
    expect(() => placeTitle(titled({}), NO_FACE, "nothing")).toThrow(/no title "nothing"/);
  });
});
