/** @vitest-environment happy-dom */
/**
 * label-light.test.tsx — a label that reads on any picture (Task K1): its box is dark under light letters, as it always was,
 * and near-white under dark ones, at the same strength. Decided by the letters' colour alone (`labelFill`, one named
 * threshold on its luma); there is no setting of its own. Drawn by `Title.tsx` and `Callout.tsx` themselves, one frame at a
 * time (`Thumbnail`), measuring with the server's width tables where the browser's measure needs a layout engine happy-dom
 * does not have (as in sentence-pages.test.tsx). The words are made up.
 *
 * Fix rounds 1 and 2: a label's accent (`accentFill`). The light box is stronger than the dark one (0.92 against 0.78 or
 * 0.8). An accent that holds 3 to 1 against its box is drawn as coloured letters, as before; one that does not is drawn as a
 * marker, a block of its own colour behind the word with the word in the label's letter colour, which takes no room. The
 * box is judged where it is weakest: the light box over a black picture, the dark box over a white one. The contrast here is
 * WCAG's, worked out in this file, not the kit's.
 */
import { Thumbnail } from "@remotion/player";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { STAGE } from "../../../lib/edit/doc";
import type { FontId } from "../../../lib/edit/measure";
import { LIGHT_LETTERS, accentFill, labelFill, lumaOf, type CalloutProps, type TitleProps } from "../layout";
import { Callout } from "../parts/Callout";
import { Title } from "../parts/Title";

vi.mock("../fonts", async (real) => {
  const { measure: tables } = await import("../../../lib/edit/measure");
  return {
    ...(await real<typeof import("../fonts")>()),
    measuredIn: (font: FontId) => (text: string, weight: number, size: number, trackingEm?: number) => tables(text, font, weight, size, trackingEm) ?? Number.NaN,
  };
});

const DARK_BOX = { title: "rgba(0, 0, 0, 0.78)", callout: "rgba(0, 0, 0, 0.8)" };
const LIGHT_BOX = { title: "rgba(250, 250, 250, 0.92)", callout: "rgba(250, 250, 250, 0.92)" };
/** Light letters: white, the kit's yellow, a pale grey, a pale pink; and dark ones: near-black, navy, a deep red, a dark green. */
const LIGHT = ["#ffffff", "#ffe14a", "#cccccc", "#ffb3c1"];
const DARK = ["#111111", "#1e3a8a", "#b91c1c", "#14532d"];

const title = (over: Partial<TitleProps> = {}): TitleProps => ({ text: "Stop *scrolling* for one second", font: "tiktok", look: "label", y: 0.2, size: 48, color: "#111111", accent: null, ...over });
const callout = (over: Partial<CalloutProps> = {}): CalloutProps => ({ text: "Look here", font: "tiktok", look: "label", x: 0.5, y: 0.4, size: 90, color: "#111111", ...over });
const shown = { at: 0, frames: 60, skip: 0, toEnd: false, src: null, kind: null, fileMs: null } as const;

/** What one part draws on frame 20, at rest: its element. */
function drawn(part: "title" | "callout", settings: TitleProps | CalloutProps): HTMLElement {
  const { container } = render(
    part === "title"
      ? <Thumbnail component={Title} inputProps={{ ...shown, settings: settings as TitleProps }} compositionWidth={STAGE.w} compositionHeight={STAGE.h} fps={30} durationInFrames={60} frameToDisplay={20} />
      : <Thumbnail component={Callout} inputProps={{ ...shown, settings: settings as CalloutProps }} compositionWidth={STAGE.w} compositionHeight={STAGE.h} fps={30} durationInFrames={60} frameToDisplay={20} />,
  );
  const element = container.querySelector<HTMLElement>(`[data-part="${part}"]`);
  if (!element) throw new Error(`no ${part} drawn`);
  return element;
}
/** The boxes a title's lines sit on, one a line; never none, so a check over every line is never passed by no line. */
function lineBoxes(element: HTMLElement): string[] {
  const boxes = [...element.querySelectorAll<HTMLElement>("[data-line]")].map((line) => line.style.backgroundColor);
  expect(boxes.length, "lines drawn").toBeGreaterThan(0);
  return boxes;
}

/* ── contrast, as WCAG works it out ───────────────────────────────────────────────────────────── */

const rgbOf = (hex: string): number[] => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255);
const linear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = ([r = 0, g = 0, b = 0]: number[]): number => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
const contrast = (one: number[], other: number[]): number => {
  const [light, dark] = [luminance(one), luminance(other)].sort((a, b) => b - a) as [number, number];
  return (light + 0.05) / (dark + 0.05);
};
/** The light box at its darkest: 250 at 0.92 over a black picture, 230. The title's dark box at its lightest: black at 0.78 over a white picture, 0.22 of 255. */
const LIGHT_BOX_DARKEST = [230 / 255, 230 / 255, 230 / 255];
const DARK_BOX_LIGHTEST = [0.22, 0.22, 0.22];
/** Accents lighter than the light box can bear, and darker than the dark box can. */
const PALE_ACCENTS = ["#ffe14a", "#4ade80", "#ffd400", "#7dd3fc", "#f9a8d4", "#ffffff"];
const DEEP_ACCENTS = ["#b91c1c", "#111111", "#1e3a8a", "#14532d"];

describe("labelFill: the box a label's letters sit on", () => {
  it("is dark under light letters and near-white under dark ones, at the strength given", () => {
    for (const color of LIGHT) expect(labelFill(color, 0.78), color).toBe(DARK_BOX.title);
    for (const color of DARK) expect(labelFill(color, 0.78), color).toBe(LIGHT_BOX.title);
    expect(labelFill("#ffffff", 0.8)).toBe(DARK_BOX.callout);
    expect(labelFill("#000000", 0.8)).toBe(LIGHT_BOX.callout);
  });

  it("decides by the letters' luma (Rec. 709 on the colour as written) against one threshold, half of white's", () => {
    expect(LIGHT_LETTERS).toBe(0.5);
    expect(lumaOf("#ffffff")).toBe(1);
    expect(lumaOf("#000000")).toBe(0);
    expect(lumaOf("#00ff00")).toBeCloseTo(0.7152, 6); // green weighs most
    expect(lumaOf("#ff0000")).toBeCloseTo(0.2126, 6);
    expect(lumaOf("#0000FF")).toBeCloseTo(0.0722, 6); // either case
    // Either side of the threshold: a grey of 128 is light letters on the dark box, a grey of 127 dark letters on the light one.
    expect(lumaOf("#808080")).toBeGreaterThanOrEqual(LIGHT_LETTERS);
    expect(labelFill("#808080", 0.78)).toBe(DARK_BOX.title);
    expect(lumaOf("#7f7f7f")).toBeLessThan(LIGHT_LETTERS);
    expect(labelFill("#7f7f7f", 0.78)).toBe(LIGHT_BOX.title);
  });
});

describe("a label as the kit draws it", () => {
  it("sets a title's dark letters on a near-white box, one shape under a label of two lines, and light letters on the dark box as before", () => {
    const long = drawn("title", title({ text: "Three things nobody tells you before your first video", size: 48 }));
    expect(long.style.color).toBe("#111111");
    // Two lines: one shape under them, of the near-white box, and no box of their own (2026-11-24, S3; label-shape.test.tsx).
    expect(lineBoxes(long).length).toBeGreaterThan(1);
    expect(long.querySelector("svg path")?.getAttribute("fill")).toBe(LIGHT_BOX.title);
    expect(lineBoxes(long).every((box) => box === "")).toBe(true);
    for (const color of DARK) expect(lineBoxes(drawn("title", title({ color }))), color).toEqual(lineBoxes(drawn("title", title({ color }))).map(() => LIGHT_BOX.title));
    for (const color of LIGHT) expect(lineBoxes(drawn("title", title({ color }))), color).toEqual(lineBoxes(drawn("title", title({ color }))).map(() => DARK_BOX.title));
  });

  it("gives the bold and outline titles no box, whatever their colour (each drawn with its lines)", () => {
    for (const look of ["bold", "outline"] as const) for (const color of [...LIGHT, ...DARK]) expect(lineBoxes(drawn("title", title({ look, color }))).every((box) => box === ""), `${look} ${color}`).toBe(true);
  });

  it("draws an accent that does not hold as a marker behind the word, in the label's letter colour, taking no room; one that holds as coloured letters", () => {
    /** Each marked bit as drawn: its letters' colour, its block's colour, and the room its padding and margin take together. */
    const marked = (element: HTMLElement) => {
      const bits = [...element.querySelectorAll<HTMLElement>("[data-line] span span")].map((span) => ({
        letters: span.style.color, block: span.style.backgroundColor,
        room: Number.parseFloat(span.style.paddingLeft || "0") + Number.parseFloat(span.style.marginLeft || "0") + Number.parseFloat(span.style.paddingRight || "0") + Number.parseFloat(span.style.marginRight || "0"),
        reach: Number.parseFloat(span.style.paddingLeft || "0"), rounded: span.style.borderRadius,
      }));
      expect(bits.length, "marked words drawn").toBeGreaterThan(0);
      return bits;
    };
    // The yellow on the light box: a yellow marker, the word near-black on it.
    for (const bit of marked(drawn("title", title({ color: "#111111", accent: "#ffe14a" })))) {
      expect(bit).toMatchObject({ letters: "#111111", block: "#ffe14a", room: 0 });
      expect(bit.reach).toBeGreaterThan(0);
      expect(bit.rounded).not.toBe("");
    }
    // A deep red on the dark box: a red marker, the word white on it.
    for (const bit of marked(drawn("title", title({ color: "#ffffff", accent: "#b91c1c" })))) expect(bit).toMatchObject({ letters: "#ffffff", block: "#b91c1c", room: 0 });
    // Accents that hold: coloured letters, no block, as before.
    for (const [color, accent] of [["#ffffff", "#ffe14a"], ["#111111", "#b91c1c"]] as const) {
      for (const bit of marked(drawn("title", title({ color, accent })))) expect(bit, `${accent} on ${color}`).toMatchObject({ letters: accent, block: "", room: 0 });
    }
    // A bold title has no box: its accent is letters, whatever it is. No accent: the marked words take the letters' colour.
    for (const bit of marked(drawn("title", title({ look: "bold", color: "#111111", accent: "#ffe14a" })))) expect(bit).toMatchObject({ letters: "#ffe14a", block: "" });
    for (const bit of marked(drawn("title", title({ color: "#808080", accent: null })))) expect(bit).toMatchObject({ letters: "#808080", block: "" });
  });

  it("sets a call-out label's dark letters on a near-white box too, and light ones on the dark box as before; a pop call-out has none", () => {
    for (const color of DARK) expect(drawn("callout", callout({ color })).style.backgroundColor, color).toBe(LIGHT_BOX.callout);
    for (const color of LIGHT) expect(drawn("callout", callout({ color })).style.backgroundColor, color).toBe(DARK_BOX.callout);
    for (const color of [...LIGHT, ...DARK]) expect(drawn("callout", callout({ look: "pop", color })).style.backgroundColor, color).toBe("");
  });
});

describe("accentFill: letters or a marker, one rule for both boxes", () => {
  it("draws an accent that holds 3 to 1 against its box, at the box's weakest, as letters", () => {
    for (const accent of DEEP_ACCENTS) {
      expect(contrast(rgbOf(accent), LIGHT_BOX_DARKEST), `${accent} on the light box`).toBeGreaterThanOrEqual(3);
      expect(accentFill(accent, "#111111", 0.78), `${accent} on the light box`).toBe("letters");
    }
    for (const accent of PALE_ACCENTS) {
      expect(contrast(rgbOf(accent), DARK_BOX_LIGHTEST), `${accent} on the dark box`).toBeGreaterThanOrEqual(3);
      expect(accentFill(accent, "#ffffff", 0.78), `${accent} on the dark box`).toBe("letters");
    }
  });

  it("draws one that does not as a marker: the pale accents on the light box, the deep ones on the dark box", () => {
    for (const accent of PALE_ACCENTS) {
      expect(contrast(rgbOf(accent), LIGHT_BOX_DARKEST), `${accent} on the light box`).toBeLessThan(3);
      expect(accentFill(accent, "#111111", 0.78), `${accent} on the light box`).toBe("block");
    }
    for (const accent of DEEP_ACCENTS) {
      expect(contrast(rgbOf(accent), DARK_BOX_LIGHTEST), `${accent} on the dark box`).toBeLessThan(3);
      expect(accentFill(accent, "#ffffff", 0.78), `${accent} on the dark box`).toBe("block");
    }
  });

  it("judges the dark box at the strength given: the call-out's 0.8 over white is darker than the title's 0.78", () => {
    // A grey of 126 holds against 0.2 of white (the call-out's box at its lightest) but not against 0.22 (the title's).
    expect(contrast(rgbOf("#7e7e7e"), [0.2, 0.2, 0.2])).toBeGreaterThanOrEqual(3);
    expect(contrast(rgbOf("#7e7e7e"), DARK_BOX_LIGHTEST)).toBeLessThan(3);
    expect([accentFill("#7e7e7e", "#ffffff", 0.8), accentFill("#7e7e7e", "#ffffff", 0.78)]).toEqual(["letters", "block"]);
  });

  it("never puts the letters on a block of their own colour: an accent no better on the letters than on the box stays letters", () => {
    for (const color of ["#808080", "#7f7f7f", "#111111", "#ffffff"]) expect(accentFill(color, color, 0.78), color).toBe("letters");
  });

  it("refuses a colour that is not #rrggbb, as the schema does, rather than draw from NaN", () => {
    for (const bad of ["white", "#fff", "#ffe14", "ffe14a"]) {
      expect(() => lumaOf(bad), bad).toThrow(/#rrggbb/);
      expect(() => accentFill(bad, "#111111", 0.78), bad).toThrow(/#rrggbb/);
      expect(() => accentFill("#ffe14a", bad, 0.78), bad).toThrow(/#rrggbb/);
    }
  });
});
