/**
 * The audience ring's layout (plan 2026-11-20, Task 4), on recorded runs: 1,000 dots, one wedge
 * per group, each wedge as large as the weight its group carries; a group that is not in the run
 * keeps a thin wedge of outlines.
 */
import { describe, expect, it } from "vitest";
import { groupsAt } from "../group-state";
import { videoStateOf } from "../video-model";
import type { ResultRow, VideoModel } from "../types";
import { RING_DOTS, ringDots, wedgeLooks, wedgesOf } from "../ring-layout";
import early from "./fixtures/early.json";
import leak from "./fixtures/leak.json";
import ending from "./fixtures/ending.json";

function modelOf(fixture: unknown): VideoModel {
  const state = videoStateOf(fixture as ResultRow);
  if (state.kind !== "result") throw new Error(`fixture is ${state.kind}`);
  return state.model;
}

const restingRows = (model: VideoModel) => groupsAt(model.audience, model.verdict, model.clipS);
const PHONE = { r1: 74, R: 158 } as const;
const DESKTOP = { r1: 56, R: 124 } as const;

describe("wedgesOf", () => {
  it("gives every group a wedge in the app's order, sized by its weight", () => {
    const rows = restingRows(modelOf(early));
    const wedges = wedgesOf(rows);
    expect(wedges.map((w) => w.group)).toEqual(rows.map((r) => r.group));
    expect(wedges.map((w) => w.weight)).toEqual(rows.map((r) => r.weight));
    expect(wedges.every((w) => w.present)).toBe(true);
  });

  it("keeps the groups that are not in the run, marked absent", () => {
    const wedges = wedgesOf(restingRows(modelOf(leak)));
    expect(wedges).toHaveLength(10);
    expect(wedges.filter((w) => !w.present).map((w) => w.group)).toEqual(["sharer", "purposeful_viewer"]);
  });
});

describe("ringDots", () => {
  for (const [name, fixture] of [["early", early], ["leak", leak]] as const) {
    for (const [size, radii] of [["phone", PHONE], ["desktop", DESKTOP]] as const) {
      it(`${name}, ${size}: 1,000 viewer dots, each wedge within one dot of its weight`, () => {
        const wedges = wedgesOf(restingRows(modelOf(fixture)));
        const layout = ringDots(wedges, radii);
        const present = layout.wedges.filter((w) => w.present);
        expect(present.reduce((sum, w) => sum + w.dots.length, 0)).toBe(RING_DOTS);
        const total = wedges.filter((w) => w.present).reduce((sum, w) => sum + w.weight, 0);
        for (const wedge of present) {
          const weight = wedges.find((w) => w.group === wedge.group)!.weight;
          expect(Math.abs(wedge.dots.length - (weight / total) * RING_DOTS)).toBeLessThanOrEqual(1);
        }
      });
    }
  }

  it("draws an absent group as a thin wedge of outlines, apart from the 1,000", () => {
    const layout = ringDots(wedgesOf(restingRows(modelOf(leak))), PHONE);
    const absent = layout.wedges.filter((w) => !w.present);
    expect(absent).toHaveLength(2);
    for (const wedge of absent) {
      expect(wedge.dots.length).toBeGreaterThan(0);
      // Thinner than the lightest group in the run (Passers-by, 1.5%: 15 dots).
      expect(wedge.dots.length).toBeLessThan(15);
    }
  });

  it("puts every dot between the two radii, inside the box", () => {
    const layout = ringDots(wedgesOf(restingRows(modelOf(early))), PHONE);
    // The mock's box: twice the outer radius and 10 of padding, rounded up.
    expect(layout.size).toBe(326);
    const c = layout.size / 2;
    for (const wedge of layout.wedges) {
      for (const dot of wedge.dots) {
        const r = Math.hypot(dot.x - c, dot.y - c);
        expect(r).toBeGreaterThanOrEqual(PHONE.r1 - 0.2);
        expect(r).toBeLessThanOrEqual(PHONE.R + 0.2);
      }
    }
    // The mock's dot: 0.31 of the pitch, about 2.5 on the phone.
    expect(layout.dotR).toBeGreaterThan(2.3);
    expect(layout.dotR).toBeLessThan(2.7);
  });

  it("starts at the top and runs clockwise in the groups' order", () => {
    const layout = ringDots(wedgesOf(restingRows(modelOf(early))), PHONE);
    const c = layout.size / 2;
    const angleOf = (i: number) => {
      const dots = layout.wedges[i]!.dots;
      const mx = dots.reduce((s, d) => s + d.x, 0) / dots.length;
      const my = dots.reduce((s, d) => s + d.y, 0) / dots.length;
      // Clockwise from 12 o'clock, 0 to 360.
      return ((Math.atan2(mx - c, -(my - c)) * 180) / Math.PI + 360) % 360;
    };
    const angles = layout.wedges.map((_, i) => angleOf(i));
    expect(angles[0]).toBeLessThan(40);
    for (let i = 1; i < angles.length; i++) expect(angles[i]).toBeGreaterThan(angles[i - 1]!);
  });

  it("orders a wedge's dots from the inside out, so a part of a group lights from the centre", () => {
    const layout = ringDots(wedgesOf(restingRows(modelOf(early))), PHONE);
    for (const wedge of layout.wedges) {
      const rows = wedge.dots.map((d) => d.row);
      expect([...rows].sort((a, b) => a - b)).toEqual(rows);
    }
  });

  it("gives the same layout for the same input", () => {
    const wedges = wedgesOf(restingRows(modelOf(early)));
    const a = ringDots(wedges, PHONE);
    const b = ringDots(wedgesOf(restingRows(modelOf(early))), PHONE);
    expect(b).toEqual(a);
    expect(a.wedges[0]!.dots[0]).toEqual(b.wedges[0]!.dots[0]);
    expect(a.pitch).toBeCloseTo(b.pitch, 10);
  });
});

describe("wedgeLooks", () => {
  it("early at rest: four wedges full, the two named groups coral, the rest pale", () => {
    const model = modelOf(early);
    const rows = restingRows(model);
    const layout = ringDots(wedgesOf(rows), PHONE);
    const looks = wedgeLooks(rows, layout);
    const byName = Object.fromEntries(rows.map((r, i) => [r.name, looks[i]!]));
    for (const name of ["Commenters", "Quiet watchers", "Sharers", "Regulars"]) {
      expect(byName[name]!.on).toBe(layout.wedges[rows.findIndex((r) => r.name === name)]!.dots.length);
      expect(byName[name]!.coral).toBe(false);
    }
    expect(looks.filter((l) => l.coral)).toHaveLength(2);
    expect(byName["Tough crowd"]).toMatchObject({ on: 0, coral: true });
    expect(byName["Purposeful viewers"]).toMatchObject({ on: 0, coral: true });
    expect(byName["Savers"]).toMatchObject({ on: 0, coral: false });
  });

  it("early at 0:02.5: everyone is lit and nobody is coral yet", () => {
    const model = modelOf(early);
    const rows = groupsAt(model.audience, model.verdict, 2.5);
    const layout = ringDots(wedgesOf(rows), PHONE);
    const looks = wedgeLooks(rows, layout);
    expect(looks.every((l, i) => l.on === layout.wedges[i]!.dots.length)).toBe(true);
    expect(looks.some((l) => l.coral)).toBe(false);
  });

  it("ending: everyone has gone", () => {
    const rows = restingRows(modelOf(ending));
    const layout = ringDots(wedgesOf(rows), PHONE);
    expect(wedgeLooks(rows, layout).every((l) => l.on === 0)).toBe(true);
  });

  it("an absent group is an outline, never lit", () => {
    const rows = restingRows(modelOf(leak));
    const looks = wedgeLooks(rows, ringDots(wedgesOf(rows), PHONE));
    const absent = rows.map((r, i) => [r, looks[i]!] as const).filter(([r]) => !r.present);
    expect(absent.map(([, l]) => l)).toEqual([
      { on: 0, coral: false, outline: true },
      { on: 0, coral: false, outline: true },
    ]);
  });
});
