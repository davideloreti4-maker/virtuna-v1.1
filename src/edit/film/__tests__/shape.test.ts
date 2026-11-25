import { describe, expect, it } from "vitest";
import { labelShape, snapped } from "../shape";

/** The arcs of a path: each one's radius and whether it turns outward (1) or inward (0). */
const arcs = (d: string) => [...d.matchAll(/A([\d.]+) [\d.]+ 0 0 ([01]) /g)].map((arc) => ({ r: Number(arc[1]), out: arc[2] === "1" }));
/** Every x and y a path names. */
const points = (d: string) => [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)(?=[ALZ])/g)].map((at) => [Number(at[1]), Number(at[2])] as const);

describe("a label's shape", () => {
  it("is a rounded box for one line", () => {
    expect(labelShape([{ left: 0, right: 200 }], 100, 20)).toBe("M0 20A20 20 0 0 1 20 0L180 0A20 20 0 0 1 200 20L200 80A20 20 0 0 1 180 100L20 100A20 20 0 0 1 0 80Z");
  });

  it("joins a narrower line to a wider one with one corner turned outward and one inward at each side", () => {
    const d = labelShape([{ left: 50, right: 150 }, { left: 0, right: 200 }], 100, 20);
    expect(arcs(d)).toHaveLength(8);
    expect(arcs(d).filter((arc) => !arc.out)).toHaveLength(2);
    expect(arcs(d).every((arc) => arc.r === 20)).toBe(true);
    expect(labelShape([{ left: 0, right: 200 }, { left: 50, right: 150 }], 100, 20)).not.toBe(d); // the wider line above works too
    expect(arcs(labelShape([{ left: 0, right: 200 }, { left: 50, right: 150 }], 100, 20)).filter((arc) => !arc.out)).toHaveLength(2);
  });

  it("keeps a step of two radii, its corners full arcs, and draws one of less as the plain box", () => {
    const d = labelShape([{ left: 40, right: 160 }, { left: 0, right: 200 }], 100, 20);
    expect(arcs(d)).toHaveLength(8);
    expect(arcs(d).every((arc) => arc.r === 20)).toBe(true);
    expect(arcs(d).filter((arc) => !arc.out)).toHaveLength(2);
    const plain = labelShape([{ left: 0, right: 200 }, { left: 0, right: 200 }], 100, 20);
    expect(labelShape([{ left: 39, right: 161 }, { left: 0, right: 200 }], 100, 20)).toBe(plain);
    expect(arcs(plain)).toHaveLength(4);
  });

  it("makes a corner smaller, half its shorter side, on a line narrower or a pitch shorter than two radii", () => {
    expect(arcs(labelShape([{ left: 0, right: 30 }], 100, 20)).map((arc) => arc.r)).toEqual([15, 15, 15, 15]);
    expect(arcs(labelShape([{ left: 0, right: 200 }], 30, 20)).map((arc) => arc.r)).toEqual([15, 15, 15, 15]);
  });

  it("draws two lines whose edges are closer than two radii as one edge, the outer one", () => {
    expect(snapped([{ left: 12, right: 188 }, { left: 0, right: 200 }], 20)).toEqual([{ left: 0, right: 200 }, { left: 0, right: 200 }]);
    expect(labelShape([{ left: 12, right: 188 }, { left: 0, right: 200 }], 100, 20)).toBe(labelShape([{ left: 0, right: 200 }, { left: 0, right: 200 }], 100, 20));
    expect(arcs(labelShape([{ left: 12, right: 188 }, { left: 0, right: 200 }], 100, 20))).toHaveLength(4);
    expect(snapped([{ left: 20, right: 180 }, { left: 0, right: 200 }], 20)).toEqual([{ left: 0, right: 200 }, { left: 0, right: 200 }]); // one radius apart: snapped
    expect(snapped([{ left: 40, right: 160 }, { left: 0, right: 200 }], 20)).toEqual([{ left: 40, right: 160 }, { left: 0, right: 200 }]); // two whole radii apart: a step
  });

  it("snaps each side by itself, and through three lines", () => {
    expect(snapped([{ left: 10, right: 150 }, { left: 0, right: 200 }], 20)).toEqual([{ left: 0, right: 150 }, { left: 0, right: 200 }]);
    expect(snapped([{ left: 20, right: 180 }, { left: 10, right: 190 }, { left: 0, right: 200 }], 20)).toEqual([{ left: 0, right: 200 }, { left: 0, right: 200 }, { left: 0, right: 200 }]);
  });

  it("never leaves the lines' own box, and is empty for no lines", () => {
    const d = labelShape([{ left: 40, right: 160 }, { left: 0, right: 200 }, { left: 70, right: 130 }], 100, 20);
    for (const [x, y] of points(d)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(200);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(300);
    }
    expect(labelShape([], 100, 20)).toBe("");
  });
});
