/**
 * next-steps.test.ts — the steps offered after a change (plan 2026-11-25-editor-screens-b, Task 8; spec §5.3): told by code from
 * the edit before the change and the edit it made, on real edits made by the door from the suite's take (12.7 s, 381 frames,
 * one shot `s1`, captions at 72 px).
 */
import { describe, expect, it } from "vitest";
import { applyOps, filmFrames, frameAt, type Edit, type Op } from "@/lib/edit";
import { assetOf, firstEdit } from "@/lib/edit/worker/takes";
import { BUCKET, takeRow } from "@/lib/edit/worker/__tests__/rows";
import { nextSteps, type NextStep } from "../next-steps";

const ASSET = assetOf(takeRow(), BUCKET);
const FIRST = firstEdit(ASSET);
function through(edit: Edit, ops: Op[]): Edit {
  const made = applyOps(edit, ops, [ASSET]);
  if (!made.ok) throw new Error(made.problems.map((problem) => `${problem.path}: ${problem.message}`).join("; "));
  return made.edit;
}
/** A zoom here, at 4 s of the take: the shot split there and the piece after it pushed in from the footage's own framing in 400 ms. */
const ZOOM_HERE: Op[] = [
  { op: "shot.split", id: "s1", atMs: 4000, newId: "s2" },
  { op: "shot.set", id: "s2", framing: { from: { zoom: 1, x: 0, y: 0 }, move: { to: { zoom: 1.2, x: 0, y: 0 }, ease: "out", part: [0, (12_700 - 4000) / 400] } } },
];
/** The one zoom step: "Hold it longer" did not hold a zoom longer in any of six runs on the real model (Task 10). */
const ZOOMS: NextStep[] = [{ kind: "zoom", label: "Zoom less", request: "Zoom in less here.", at: frameAt(4000, 1) }];
const LOOK: NextStep = { kind: "look", label: "Another look", request: "Try a different colour look.", at: null };
const PUT_BACK: NextStep = { kind: "cut", label: "Put it back", request: null, at: null };
const SMALLER: NextStep = { kind: "captions", label: "Smaller captions", request: "Make the captions a little smaller.", at: null };

describe("nextSteps", () => {
  it("after a zoom here: zoom less, about the piece's first frame; never hold it longer", () => {
    const after = through(FIRST, ZOOM_HERE);
    expect(nextSteps(FIRST, after)).toEqual(ZOOMS);
    expect(ZOOMS[0]!.at).toBe(120);
  });

  it("after a push, 0.05 or more over what the footage there had; not under that", () => {
    const push = (to: number): Op[] => [{ op: "shot.set", id: "s1", framing: { from: { zoom: 1, x: 0, y: 0 }, move: { to: { zoom: to, x: 0, y: 0 }, ease: "out", part: [0, 4] } } }];
    expect(nextSteps(FIRST, through(FIRST, push(1.05)))).toEqual(ZOOMS.map((step) => ({ ...step, at: 0 })));
    expect(nextSteps(FIRST, through(FIRST, push(1.04)))).toEqual([]);
    // Zoomed out: no zoom step.
    expect(nextSteps(through(FIRST, push(1.2)), FIRST)).toEqual([]);
  });

  it("after a still zoom, one shot or several as \"Add zooms\" makes them, no zoom step: the code has no move for less (I1)", () => {
    const tighter = through(FIRST, [{ op: "shot.set", id: "s1", framing: { from: { zoom: 1.1, x: 0, y: 0 }, move: null } }]);
    expect(nextSteps(FIRST, tighter)).toEqual([]);
    const split = through(FIRST, [{ op: "shot.split", id: "s1", atMs: 6000, newId: "s2" }]);
    const both = through(split, [
      { op: "shot.set", id: "s1", framing: { from: { zoom: 1.15, x: 0, y: 0 }, move: null } },
      { op: "shot.set", id: "s2", framing: { from: { zoom: 1.2, x: 0, y: 0 }, move: null } },
    ]);
    expect(nextSteps(split, both)).toEqual([]);
    // A push beside a still zoom: the step would lower only one of them, so none.
    const mixed = through(split, [
      { op: "shot.set", id: "s1", framing: { from: { zoom: 1.15, x: 0, y: 0 }, move: null } },
      { op: "shot.set", id: "s2", framing: { from: { zoom: 1, x: 0, y: 0 }, move: { to: { zoom: 1.2, x: 0, y: 0 }, ease: "out", part: [0, 4] } } },
    ]);
    expect(nextSteps(split, mixed)).toEqual([]);
    // A still zoom beside a look: the look's step is still offered.
    expect(nextSteps(FIRST, through(tighter, [{ op: "look.set", preset: "warm" }]))).toEqual([LOOK]);
  });

  it("after a new look on the film or on a shot: another look", () => {
    expect(nextSteps(FIRST, through(FIRST, [{ op: "look.set", preset: "warm" }]))).toEqual([LOOK]);
    expect(nextSteps(FIRST, through(FIRST, [{ op: "look.set", adjust: { warmth: 0.2 } }]))).toEqual([LOOK]);
    expect(nextSteps(FIRST, through(FIRST, [{ op: "look.set", shot: "s1", preset: "mono" }]))).toEqual([LOOK]);
  });

  it("after a cut that made the film shorter: put it back", () => {
    const short = through(FIRST, [{ op: "shot.trim", id: "s1", endMs: 10_000 }]);
    expect(filmFrames(short)).toBeLessThan(filmFrames(FIRST));
    expect(nextSteps(FIRST, short)).toEqual([PUT_BACK]);
  });

  it("after bigger captions: smaller captions; not after smaller ones", () => {
    const bigger = through(FIRST, [{ op: "captions.set", size: FIRST.captions.size + 8 }]);
    expect(nextSteps(FIRST, bigger)).toEqual([SMALLER]);
    expect(nextSteps(bigger, FIRST)).toEqual([]);
  });

  it("after a word fixed, or nothing changed: none", () => {
    expect(nextSteps(FIRST, through(FIRST, [{ op: "word.set", asset: ASSET.id, index: 1, text: "evening." }]))).toEqual([]);
    expect(nextSteps(FIRST, FIRST)).toEqual([]);
  });

  it("gives two at most, the kinds in order: a zoom and bigger captions give zoom less, then smaller captions", () => {
    const both = through(FIRST, [...ZOOM_HERE, { op: "captions.set", size: FIRST.captions.size + 8 }]);
    expect(nextSteps(FIRST, both)).toEqual([...ZOOMS, SMALLER]);
    const many = through(FIRST, [{ op: "captions.set", size: 96 }, { op: "shot.trim", id: "s1", endMs: 10_000 }, { op: "look.set", preset: "cool" }]);
    expect(nextSteps(FIRST, many)).toEqual([LOOK, PUT_BACK]);
    const zoomLookCut = through(FIRST, [...ZOOM_HERE, { op: "look.set", preset: "cool" }, { op: "shot.trim", id: "s2", endMs: 10_000 }]);
    expect(nextSteps(FIRST, zoomLookCut)).toEqual([...ZOOMS, LOOK]);
  });

  it("counts no zoom on footage the edit before did not show (another file, or a stretch it had cut)", () => {
    const short = through(FIRST, [{ op: "shot.trim", id: "s1", endMs: 6000 }]);
    // The stretch from 6 s back in, zoomed: nothing before showed it, so there is nothing it zoomed from.
    const back = through(short, [{ op: "shot.insert", after: "s1", shot: { id: "s2", asset: ASSET.id, startMs: 8000, endMs: 12_000, framing: { from: { zoom: 1.3, x: 0, y: 0 }, move: null } } }]);
    expect(nextSteps(short, back)).toEqual([]);
  });
});
