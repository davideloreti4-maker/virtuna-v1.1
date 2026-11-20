/**
 * The Brain panel's four signals, read on RECORDED runs through the existing model
 * (`src/lib/brain/cortex-sim.ts`). Nothing stands in for our own code.
 *
 * Measured on 2026-11-20 before building (end of clip, 0..100): Focus 25.6 on `early` (a third
 * leave by 0:03, 46% to the end), 61.9 on `holds` (84% to the end). Wandering 49.7 against 18.8.
 */
import { describe, expect, it } from "vitest";
import { driveFor, hashSeed, predictedBold, RESTING_BOLD } from "@/lib/brain/cortex-sim";
import { brainTrackOf } from "../brain-track";
import { watchingAt } from "../curve";
import type { ResultRow, VideoModel } from "../types";
import { videoStateOf } from "../video-model";
import early from "./fixtures/early.json";
import holds from "./fixtures/holds.json";
import opening from "./fixtures/opening.json";

function modelOf(fixture: unknown): VideoModel {
  const state = videoStateOf(fixture as ResultRow);
  if (state.kind !== "result") throw new Error(`fixture is ${state.kind}, not a result`);
  return state.model;
}

const signal = (model: VideoModel, label: string) => {
  const found = brainTrackOf(model).signals.find((s) => s.label === label);
  if (!found) throw new Error(`no signal ${label}`);
  return found;
};
const last = (values: number[]) => values[values.length - 1]!;

describe("brainTrackOf", () => {
  it("has the four signals in order, with their labels", () => {
    const track = brainTrackOf(modelOf(early));
    expect(track.signals.map((s) => [s.id, s.label])).toEqual([
      ["visual", "Eyes"],
      ["dorsal_attention", "Focus"],
      ["limbic", "Feeling"],
      ["default", "Wandering"],
    ]);
  });

  it("has one value per second of the clip, 0:00 to the end", () => {
    const e = modelOf(early);
    const h = modelOf(holds);
    const o = modelOf(opening);
    expect([e.clipS, h.clipS, o.clipS]).toEqual([29, 37, 121]);
    for (const s of brainTrackOf(e).signals) expect(s.perSecond).toHaveLength(30);
    for (const s of brainTrackOf(h).signals) expect(s.perSecond).toHaveLength(38);
    for (const s of brainTrackOf(o).signals) expect(s.perSecond).toHaveLength(122);
  });

  it("stays within 0..100, and rest is the model's resting level", () => {
    for (const fixture of [early, holds, opening]) {
      for (const s of brainTrackOf(modelOf(fixture)).signals) {
        for (const v of s.perSecond) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
        expect(s.rest).toBeCloseTo(RESTING_BOLD[s.id] * 100, 10);
      }
    }
  });

  it("is grounded on the still-watching line, seeded by the run", () => {
    const model = modelOf(early);
    const track = brainTrackOf(model);
    expect(track.drive.mode).toBe("grounded");
    expect(track.seed).toBe(hashSeed(model.id));
    expect(track.drive.durationS).toBe(29);
    // The drive's retention is the line itself: 100% through the opening, 46% at the end.
    expect(track.drive.retentionAt!(0)).toBeCloseTo(1, 6);
    expect(track.drive.retentionAt!(1)).toBeCloseTo(watchingAt(model.audience.points, 29) / 100, 6);
    expect(track.drive.retentionAt!(3 / 29)).toBeCloseTo(watchingAt(model.audience.points, 3) / 100, 6);
  });

  it("reads each second straight off the model", () => {
    const track = brainTrackOf(modelOf(holds));
    for (const s of track.signals) {
      for (const sec of [0, 5, 12, 37]) expect(s.perSecond[sec]).toBeCloseTo(predictedBold(track.drive, sec)[s.id] * 100, 10);
    }
  });

  it("starts at rest: nothing has reached the brain at 0:00", () => {
    for (const s of brainTrackOf(modelOf(early)).signals) expect(s.perSecond[0]).toBeCloseTo(s.rest, 0);
  });

  it("ends with less Focus and more Wandering when a third leave early than when most stay", () => {
    expect(last(signal(modelOf(early), "Focus").perSecond)).toBeLessThan(last(signal(modelOf(holds), "Focus").perSecond));
    expect(last(signal(modelOf(early), "Focus").perSecond)).toBeCloseTo(25.6, 0);
    expect(last(signal(modelOf(holds), "Focus").perSecond)).toBeCloseTo(61.9, 0);
    expect(last(signal(modelOf(early), "Wandering").perSecond)).toBeGreaterThan(last(signal(modelOf(holds), "Wandering").perSecond));
  });

  it("does not depend on the stop ratio: a grounded drive reads the line alone", () => {
    // The page's model does not carry the stored hook hold that buildBrainFrameData reads, so the
    // track takes the line's share at 0:02 instead. This holds the reason that is safe.
    const model = modelOf(early);
    const track = brainTrackOf(model);
    expect(track.drive.stopRatio).toBeGreaterThanOrEqual(0);
    expect(track.drive.stopRatio).toBeLessThanOrEqual(1);
    const other = driveFor({ seedKey: model.id, stopRatio: 0.05, durationS: model.clipS, retentionCurve: Array.from({ length: 30 }, (_, s) => watchingAt(model.audience.points, s) / 100) });
    for (const sec of [3, 9, 20, 29]) expect(predictedBold(other, sec)).toEqual(predictedBold(track.drive, sec));
  });
});
