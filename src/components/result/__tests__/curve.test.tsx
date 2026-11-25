/** @vitest-environment happy-dom */
/**
 * The still-watching line, its playhead and the strip of scenes (plan Task 3, spec §5 "The curve",
 * "The strip", "Player"). Real components and the real playhead on recorded runs. Only layout is
 * absent (happy-dom measures nothing), so a drag is given in pixels from the plot's left edge.
 */
import { describe, expect, it } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import early from "@/lib/result/__tests__/fixtures/early.json";
import leak from "@/lib/result/__tests__/fixtures/leak.json";
import middle from "@/lib/result/__tests__/fixtures/middle.json";
import opening from "@/lib/result/__tests__/fixtures/opening.json";
import type { VideoModel } from "@/lib/result/types";
import { Curve } from "../curve";
import { FRAME_BASE, modelOf, playhead, renderWithPlayhead } from "./hero-harness";

const W = 329;
const H = 100;

function mountCurve(model: VideoModel, { width = W, height = H, strip = true } = {}) {
  const view = renderWithPlayhead(model, <Curve model={model} width={width} height={height} strip={strip} />);
  const part = (name: string) => view.container.querySelector<HTMLElement>(`[data-part="${name}"]`);
  const parts = (name: string) => [...view.container.querySelectorAll(`[data-part="${name}"]`)];
  return { ...view, part, parts, slider: () => screen.getByRole("slider") };
}

/** The corners of a polyline drawn as `M p0 (L a Q corner b)* L pn`: the start, each corner, the end. */
function vertices(d: string): Array<[number, number]> {
  const nums = (s: string) => s.trim().split(/[\s,]+/).map(Number);
  const out: Array<[number, number]> = [];
  const commands = d.match(/[MLQ][^MLQ]*/g)!;
  commands.forEach((command, i) => {
    const kind = command[0];
    const n = nums(command.slice(1));
    if (kind === "M") out.push([n[0]!, n[1]!]);
    if (kind === "Q") out.push([n[0]!, n[1]!]);
    if (kind === "L" && i === commands.length - 1) out.push([n[0]!, n[1]!]);
  });
  return out;
}

describe("the line", () => {
  it("has one vertex at 0:00 (100%) and one at the end of each scene, straight between them", () => {
    const model = modelOf(early);
    const { part } = mountCurve(model);
    const d = part("line")!.getAttribute("d")!;
    const got = vertices(d);
    const { points, scenes, clipS } = model.audience;
    expect(got).toHaveLength(scenes.length + 1);
    got.forEach(([x, y], i) => {
      const [t, pct] = points[i]!;
      expect(x).toBeCloseTo((t / clipS) * W, 0);
      expect(y).toBeCloseTo(4 + (1 - pct / 100) * (H - 8), 0);
    });
    expect(got[0]).toEqual([0, 4]);
    expect(part("line")!.getAttribute("stroke")).toBe("var(--color-foreground)");
  });

  it("has a soft fill under it and small ticks at the scene borders", () => {
    const model = modelOf(early);
    const { part, parts } = mountCurve(model);
    expect(part("fill")!.getAttribute("fill")).toBe("var(--color-surface-sunken)");
    const ticks = parts("tick");
    expect(ticks).toHaveLength(model.audience.scenes.length - 1);
    expect(ticks[0]!.getAttribute("d")).toBe(`M${((2 / 29) * W).toFixed(1)} ${H - 4}v-5`);
  });

  it("early: the named scene (0:02 to 0:03) is coral on a soft band", () => {
    const { part } = mountCurve(modelOf(early));
    const loss = part("loss")!;
    expect(loss.getAttribute("stroke")).toBe("var(--color-below)");
    expect(loss.getAttribute("d")).toBe(part("line")!.getAttribute("d"));
    const band = part("band")!;
    expect(band.getAttribute("fill")).toBe("var(--color-below-soft)");
    expect(Number(band.getAttribute("x"))).toBeCloseTo((2 / 29) * W, 0);
    expect(Number(band.getAttribute("width"))).toBeCloseTo((1 / 29) * W, 0);
  });

  it("the band is at least 8 wide, so a short scene still shows", () => {
    // opening: the first 3 of 121 seconds, on a narrow line (5px).
    const { part } = mountCurve(modelOf(opening), { width: 200 });
    expect(Number(part("band")!.getAttribute("width"))).toBe(8);
    expect(Number(part("band")!.getAttribute("x"))).toBeCloseTo((3 / 121) * 200 / 2 - 4, 0);
  });

  it("leak: no scene is named, nothing is coral", () => {
    const { container } = mountCurve(modelOf(leak, { frames: true }));
    expect(container.innerHTML).not.toMatch(/--color-below/);
  });

  it("times under it: 0:00 and the clip's length", () => {
    mountCurve(modelOf(opening));
    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.getByText("2:01")).toBeInTheDocument();
  });
});

describe("the playhead", () => {
  it("at rest: a dot at the clip's end on the line, no vertical line, no readout", () => {
    const model = modelOf(early);
    const { part } = mountCurve(model);
    const dot = part("dot")!;
    expect(Number(dot.getAttribute("cx"))).toBeCloseTo(W, 0);
    expect(Number(dot.getAttribute("cy"))).toBeCloseTo(4 + (1 - model.headline.value / 100) * (H - 8), 0);
    expect(part("playhead")).toBeNull();
    expect(part("readout")).toBeNull();
    expect(screen.queryByText(/·/)).toBeNull();
  });

  it("moved to 0:02.5: a vertical line there, and the stored value '71% · 0:03' as a dot at that scene's end", () => {
    const model = modelOf(early);
    const { part } = mountCurve(model);
    act(() => playhead.current.seek(2.5));
    expect(part("readout")!.textContent).toBe("71% · 0:03");
    expect(part("playhead")!.getAttribute("d")).toBe(`M${((2.5 / 29) * W).toFixed(1)} 0V${H}`);
    // The dot is the point the chip names: the end of scene 1 (0:03) at its stored value.
    const dot = part("dot")!;
    expect(Number(dot.getAttribute("cx"))).toBeCloseTo((3 / 29) * W, 0);
    expect(Number(dot.getAttribute("cy"))).toBeCloseTo(4 + (1 - model.audience.points[2]![1] / 100) * (H - 8), 0);
    // The chip is centred above it (x 34.0, right at the clamp 34 inside the plot's left edge).
    expect(parseFloat(part("readout")!.style.left)).toBeCloseTo((3 / 29) * W, 1);
  });

  it.each([
    [4.7, "56% · 0:07", 7, 3],
    [7, "46% · 0:14", 14, 4],
    [20, "46% · 0:21", 21, 5],
  ] as const)("at %s s: dot and chip at the end of the scene under the playhead (%s)", (t, text, end, k) => {
    const model = modelOf(early);
    const { part } = mountCurve(model);
    act(() => playhead.current.seek(t));
    expect(part("readout")!.textContent).toBe(text);
    const x = (end / 29) * W;
    expect(Number(part("dot")!.getAttribute("cx"))).toBeCloseTo(x, 0);
    expect(Number(part("dot")!.getAttribute("cy"))).toBeCloseTo(4 + (1 - model.audience.points[k]![1] / 100) * (H - 8), 0);
    expect(parseFloat(part("readout")!.style.left)).toBeCloseTo(Math.min(W - 34, Math.max(34, x)), 0);
    // The playhead line stays at the playhead's own time.
    expect(part("playhead")!.getAttribute("d")).toBe(`M${((t / 29) * W).toFixed(1)} 0V${H}`);
  });

  it("is a slider: value in seconds, its text the stored value", () => {
    const { slider } = mountCurve(modelOf(early));
    expect(slider()).toHaveAttribute("aria-valuemin", "0");
    expect(slider()).toHaveAttribute("aria-valuemax", "29");
    expect(slider()).toHaveAttribute("aria-valuenow", "29");
    expect(slider()).toHaveAttribute("tabindex", "0");
    act(() => playhead.current.seek(2.5));
    expect(slider()).toHaveAttribute("aria-valuenow", "2.5");
    expect(slider()).toHaveAttribute("aria-valuetext", "0:03, 71% still watching");
  });

  it("arrows step scene by scene; Home goes to 0:00, End back to rest", () => {
    const { slider, part } = mountCurve(modelOf(early));
    const press = (key: string) => fireEvent.keyDown(slider(), { key });
    const now = () => slider().getAttribute("aria-valuenow");

    press("ArrowLeft");
    expect(now()).toBe("24");
    press("ArrowLeft");
    expect(now()).toBe("21");
    press("Home");
    expect(now()).toBe("0");
    press("ArrowRight");
    expect(now()).toBe("2");
    press("ArrowRight");
    expect(now()).toBe("3");
    press("ArrowRight");
    expect(now()).toBe("7");
    press("End");
    expect(now()).toBe("29");
    expect(playhead.current.resting).toBe(true);
    expect(part("readout")).toBeNull();
  });

  it("up and down arrows work like right and left (the slider pattern)", () => {
    const { slider } = mountCurve(modelOf(early));
    const press = (key: string) => fireEvent.keyDown(slider(), { key });
    const now = () => slider().getAttribute("aria-valuenow");
    press("ArrowDown");
    expect(now()).toBe("24");
    press("ArrowDown");
    expect(now()).toBe("21");
    press("ArrowUp");
    expect(now()).toBe("24");
    press("ArrowUp");
    expect(now()).toBe("29");
    expect(playhead.current.resting).toBe(true);
  });

  it("dragging on the line seeks (mouse at once; touch once it moves sideways)", () => {
    const { slider } = mountCurve(modelOf(early));
    const at = (t: number) => (t / 29) * W;

    fireEvent.pointerDown(slider(), { pointerId: 1, pointerType: "mouse", button: 0, clientX: at(7) });
    expect(playhead.current.t).toBeCloseTo(7, 1);
    fireEvent.pointerMove(slider(), { pointerId: 1, pointerType: "mouse", clientX: at(14) });
    expect(playhead.current.t).toBeCloseTo(14, 1);
    fireEvent.pointerUp(slider(), { pointerId: 1, pointerType: "mouse", clientX: at(14) });
    fireEvent.pointerMove(slider(), { pointerId: 1, pointerType: "mouse", clientX: at(20) });
    expect(playhead.current.t).toBeCloseTo(14, 1);

    // A touch that only scrolls the page (it moves up and down) does not move the playhead.
    fireEvent.pointerDown(slider(), { pointerId: 2, pointerType: "touch", clientX: at(3), clientY: 50 });
    fireEvent.pointerMove(slider(), { pointerId: 2, pointerType: "touch", clientX: at(3) + 1, clientY: 80 });
    fireEvent.pointerCancel(slider(), { pointerId: 2, pointerType: "touch" });
    expect(playhead.current.t).toBeCloseTo(14, 1);

    // A sideways touch drags; a tap seeks.
    fireEvent.pointerDown(slider(), { pointerId: 3, pointerType: "touch", clientX: at(3), clientY: 50 });
    fireEvent.pointerMove(slider(), { pointerId: 3, pointerType: "touch", clientX: at(10), clientY: 52 });
    expect(playhead.current.t).toBeCloseTo(10, 1);
    fireEvent.pointerUp(slider(), { pointerId: 3, pointerType: "touch", clientX: at(10), clientY: 52 });
    fireEvent.pointerDown(slider(), { pointerId: 4, pointerType: "touch", clientX: at(21), clientY: 50 });
    fireEvent.pointerUp(slider(), { pointerId: 4, pointerType: "touch", clientX: at(21), clientY: 50 });
    expect(playhead.current.t).toBeCloseTo(21, 1);

    // Past the end is the end: rest.
    fireEvent.pointerDown(slider(), { pointerId: 5, pointerType: "mouse", button: 0, clientX: W + 40 });
    expect(playhead.current.resting).toBe(true);
  });
});

describe("the strip", () => {
  it("no frames: no strip", () => {
    const { container } = mountCurve(modelOf(middle));
    expect(container.querySelector('[data-result="strip"]')).toBeNull();
  });

  it("not asked for (the compact player): no strip", () => {
    const { container } = mountCurve(modelOf(early, { frames: true }), { strip: false });
    expect(container.querySelector('[data-result="strip"]')).toBeNull();
  });

  it("with frames: one tile per scene on the line's time axis, 3 apart, 38 tall; the named scene marked", () => {
    const model = modelOf(early, { frames: true });
    const { container } = mountCurve(model);
    const strip = container.querySelector<HTMLElement>('[data-result="strip"]')!;
    expect(strip.style.height).toBe("38px");
    expect(strip.style.width).toBe(`${W}px`);
    const tiles = [...strip.querySelectorAll<HTMLElement>("[data-scene]")];
    expect(tiles).toHaveLength(7);
    const x = (t: number) => (t / 29) * W;
    expect(parseFloat(tiles[2]!.style.left)).toBeCloseTo(x(3), 0);
    expect(parseFloat(tiles[2]!.style.width)).toBeCloseTo(x(7) - x(3) - 3, 0);
    expect(parseFloat(tiles[6]!.style.width)).toBeCloseTo(x(29) - x(24), 0);
    // The frame repeats to fill the tile.
    const wide = tiles[3]!.querySelectorAll("img");
    expect(wide.length).toBeGreaterThan(1);
    expect(wide[0]!.getAttribute("src")).toBe(`${FRAME_BASE}/3.jpg`);
    // Coral: only the named scene.
    const marked = strip.querySelectorAll('[data-part="mark"]');
    expect(marked).toHaveLength(1);
    expect(tiles[1]!.contains(marked[0]!)).toBe(true);
  });

  it("46 tall on a line wider than 400 (desktop)", () => {
    const { container } = mountCurve(modelOf(early, { frames: true }), { width: 540, height: 104 });
    expect(container.querySelector<HTMLElement>('[data-result="strip"]')!.style.height).toBe("46px");
  });
});
