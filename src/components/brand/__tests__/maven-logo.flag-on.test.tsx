/** @vitest-environment happy-dom */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { MavenMark } from "../maven-logo";

/** Every on-curve and control point of the path, in order. */
function points(d: string): Array<[number, number]> {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const out: Array<[number, number]> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i]!, nums[i + 1]!]);
  return out;
}

describe("MavenMark, new look", () => {
  const draw = () => {
    const { container } = render(<MavenMark size={20} />);
    const svg = container.querySelector("svg")!;
    return { svg, pts: points(svg.querySelector("path")!.getAttribute("d")!) };
  };

  it("keeps the legacy 2.5:1 box, so call sites lay out the same", () => {
    const { svg } = draw();
    expect(svg.getAttribute("width")).toBe("50");
    expect(svg.getAttribute("height")).toBe("20");
    const [, , w, h] = svg.getAttribute("viewBox")!.split(" ").map(Number);
    expect(w! / h!).toBe(2.5);
  });

  it("is symmetric about the centre line", () => {
    const { pts } = draw();
    const has = (x: number, y: number) => pts.some(([px, py]) => Math.abs(px - x) < 0.051 && Math.abs(py - y) < 0.051);
    for (const [x, y] of pts) expect(has(240 - x, y), `mirror of ${x},${y}`).toBe(true);
  });

  it("closes the V in one point on the centre line, not two", () => {
    const { pts } = draw();
    const lowest = Math.max(...pts.map(([, y]) => y));
    const atBottom = pts.filter(([, y]) => lowest - y < 2);
    expect(atBottom).toEqual([[120, lowest]]);
  });

  it("fits inside its box", () => {
    const { svg, pts } = draw();
    const [x0, y0, w, h] = svg.getAttribute("viewBox")!.split(" ").map(Number);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(x0!);
      expect(x).toBeLessThanOrEqual(x0! + w!);
      expect(y).toBeGreaterThanOrEqual(y0!);
      expect(y).toBeLessThanOrEqual(y0! + h!);
    }
  });
});
