/** @vitest-environment happy-dom */
/**
 * label-shape.test.tsx — a label of two or three lines is one shape (ruled 2026-11-24, S3): `Title.tsx` draws its lines'
 * outline as one SVG path (`labelShape`, shape.ts) under the letters, and the lines take no box of their own. A label of one
 * line keeps its own rounded box as before, and the other looks draw no shape (S7). Drawn one frame at a time (`Thumbnail`),
 * measuring with the server's width tables where the browser's measure needs a layout engine happy-dom does not have (as in
 * label-light.test.tsx). The words are made up.
 */
import { Thumbnail } from "@remotion/player";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { STAGE } from "../../../lib/edit/doc";
import { measure, type FontId } from "../../../lib/edit/measure";
import { labelFill, lineSpans, titleBox, type Measure, type TitleProps } from "../layout";
import { Title } from "../parts/Title";
import { labelShape, snapped } from "../shape";

vi.mock("../fonts", async (real) => {
  const { measure: tables } = await import("../../../lib/edit/measure");
  return {
    ...(await real<typeof import("../fonts")>()),
    measuredIn: (font: FontId) => (text: string, weight: number, size: number, trackingEm?: number) => tables(text, font, weight, size, trackingEm) ?? Number.NaN,
  };
});
const tables: Measure = (text, weight, size, trackingEm) => {
  const width = measure(text, "tiktok", weight, size, trackingEm);
  if (width === null) throw new Error(`the tables cannot measure ${JSON.stringify(text)}`);
  return width;
};

/** Made up: two lines of different width at 72 px, one line at 72 px. */
const TWO_LINES = "Five quiet rules for better mornings";
const ONE_LINE = "Save this for later";
/** Dark letters (the light box) and light letters (the dark box). */
const COLOURS = ["#111111", "#ffffff"];

const title = (over: Partial<TitleProps> = {}): TitleProps => ({ text: TWO_LINES, font: "tiktok", look: "label", y: 0.2, size: 72, color: "#111111", accent: null, ...over });
const shown = { at: 0, frames: 60, skip: 0, toEnd: false, src: null, kind: null, fileMs: null } as const;

/** A title drawn on frame 20, at rest: its element. */
function drawn(settings: TitleProps): HTMLElement {
  const { container } = render(<Thumbnail component={Title} inputProps={{ ...shown, settings }} compositionWidth={STAGE.w} compositionHeight={STAGE.h} fps={30} durationInFrames={60} frameToDisplay={20} />);
  const element = container.querySelector<HTMLElement>('[data-part="title"]');
  if (!element) throw new Error("no title drawn");
  return element;
}
/** Its lines; never none, so a check over every line is never passed by no line. */
function linesOf(element: HTMLElement): HTMLElement[] {
  const lines = [...element.querySelectorAll<HTMLElement>("[data-line]")];
  expect(lines.length, "lines drawn").toBeGreaterThan(0);
  return lines;
}
/** Each line's box across inside the title's own box, as `margin: 0 auto` sets it: the one rule `titleBox` places it by (`lineSpans`). */
function spansOf(settings: TitleProps) {
  const laid = titleBox(settings, tables);
  return lineSpans(laid.lines, laid.side, laid.room);
}

describe("a label of two or three lines as the kit draws it", () => {
  it("draws one path under its lines, of the label's own fill, the lines' outline, and no box on any line", () => {
    for (const color of COLOURS) {
      const settings = title({ color });
      const laid = titleBox(settings, tables);
      expect(laid.lines.length, color).toBe(2);
      const spans = spansOf(settings);
      expect(snapped(spans, Math.round(0.24 * laid.size)), "a step at each side, not snapped").toEqual(spans);
      expect(spans[0]!.right - spans[0]!.left, "lines of different width").not.toBe(spans[1]!.right - spans[1]!.left);

      const element = drawn(settings);
      const paths = element.querySelectorAll("svg path");
      expect(paths, color).toHaveLength(1);
      const path = paths[0]!;
      expect(path.getAttribute("fill"), color).toBe(labelFill(color, 0.78));
      expect(path.getAttribute("d"), color).toBe(labelShape(spans, laid.pitch, Math.round(0.24 * laid.size)));
      const svg = element.querySelector("svg")!;
      expect([svg.getAttribute("width"), svg.getAttribute("height")], color).toEqual([String(laid.room), String(laid.lines.length * laid.pitch)]);
      for (const line of linesOf(element)) {
        expect(line.style.backgroundColor, color).toBe("");
        expect(line.style.borderRadius, color).toBe("");
      }
    }
  });

  it("gives the light box under dark letters and the dark box under light ones", () => {
    expect(drawn(title({ color: "#111111" })).querySelector("svg path")?.getAttribute("fill")).toBe("rgba(250, 250, 250, 0.92)");
    expect(drawn(title({ color: "#ffffff" })).querySelector("svg path")?.getAttribute("fill")).toBe("rgba(0, 0, 0, 0.78)");
  });

  it("keeps a label of one line on its own rounded box, as before, with no shape", () => {
    for (const color of COLOURS) {
      const settings = title({ text: ONE_LINE, color });
      expect(titleBox(settings, tables).lines.length, color).toBe(1);
      const element = drawn(settings);
      expect(element.querySelector("svg"), color).toBeNull();
      const lines = linesOf(element);
      expect(lines, color).toHaveLength(1);
      expect(lines[0]!.style.backgroundColor, color).toBe(labelFill(color, 0.78));
      expect(lines[0]!.style.borderRadius, color).toBe(`${Math.round(0.24 * 72)}px`);
      expect(lines[0]!.style.position, color).toBe("");
    }
  });

  it("draws no shape and no box for a bold title of two lines", () => {
    const settings = title({ look: "bold", text: "Three things nobody tells you before your first video" });
    expect(titleBox(settings, tables).lines.length).toBeGreaterThanOrEqual(2);
    const element = drawn(settings);
    expect(element.querySelector("svg")).toBeNull();
    for (const line of linesOf(element)) {
      expect(line.style.backgroundColor).toBe("");
      expect(line.style.position).toBe("");
    }
  });

  it("paints the letters above the shape: the shape comes first, and every line is positioned after it", () => {
    const element = drawn(title());
    expect(element.firstElementChild?.tagName.toLowerCase()).toBe("svg");
    for (const line of linesOf(element)) expect(line.style.position).toBe("relative");
  });
});
