import { describe, expect, it } from "vitest";
import { DEFAULT_CAPTIONS } from "../../doc";
import { PARTS } from "../../parts";
import { DEFAULT_STYLE, StyleProfileSchema, type StyleProfile } from "../profile";

const A_STYLE: StyleProfile = {
  source: { kind: "reference", name: "reference 1" },
  pace: { pauseMs: 180, cutsPerMin: 14.5 },
  captions: { on: true, look: "highlight", font: "montserrat", size: 80, y: 0.62, maxWords: 3, highlight: "#ffe14a" },
  title: { on: true, y: 0.18, frames: 60, look: "bold", size: 120 },
  punchIns: { perMin: 6, zoom: 1.2 },
  look: { preset: "warm" },
  notMatched: ["captions in capitals", "emoji"],
};

describe("StyleProfileSchema: a style in the kit's own terms", () => {
  it("takes a whole style, and the default", () => {
    expect(StyleProfileSchema.parse(A_STYLE)).toEqual(A_STYLE);
    expect(StyleProfileSchema.parse(DEFAULT_STYLE)).toEqual(DEFAULT_STYLE);
  });

  it("holds the default to the kit's own captions (less their width), no title, no punch-ins and the natural look", () => {
    const { width: _width, ...captions } = DEFAULT_CAPTIONS;
    expect(DEFAULT_STYLE).toEqual({
      source: { kind: "default", name: null }, pace: { pauseMs: 250, cutsPerMin: null }, captions, title: null, punchIns: null, look: { preset: "natural" }, notMatched: [],
    });
  });

  it("takes the pace's quiet share (X104), 0 to 0.6, as optional and nullable", () => {
    expect(StyleProfileSchema.parse({ ...A_STYLE, pace: { ...A_STYLE.pace, quiet: 0.12 } }).pace.quiet).toBe(0.12);
    expect(StyleProfileSchema.parse({ ...A_STYLE, pace: { ...A_STYLE.pace, quiet: null } }).pace.quiet).toBeNull();
    expect(StyleProfileSchema.parse(A_STYLE).pace).not.toHaveProperty("quiet");
    expect(StyleProfileSchema.safeParse({ ...A_STYLE, pace: { ...A_STYLE.pace, quiet: 0.61 } }).success).toBe(false);
    expect(StyleProfileSchema.safeParse({ ...A_STYLE, pace: { ...A_STYLE.pace, quiet: -0.01 } }).success).toBe(false);
  });

  it("holds a weight in a style's captions and title, or none", () => {
    const style = { ...A_STYLE, captions: { ...A_STYLE.captions, weight: 600 }, title: { ...A_STYLE.title!, weight: 600 } };
    expect(StyleProfileSchema.parse(style)).toEqual(style);
    expect(StyleProfileSchema.safeParse({ ...A_STYLE, captions: { ...A_STYLE.captions, weight: 650 } }).success).toBe(false);
    expect(StyleProfileSchema.safeParse({ ...A_STYLE, title: { ...A_STYLE.title!, weight: 650 } }).success).toBe(false);
    expect(DEFAULT_STYLE.captions).not.toHaveProperty("weight");
    expect(DEFAULT_STYLE.title).toBeNull();
  });

  it("takes up to 16 words a page, a title that stays to the end with its ink, up to 20 s (Task 9c)", () => {
    const style = { ...A_STYLE, captions: { ...A_STYLE.captions, maxWords: 16 }, title: { ...A_STYLE.title!, stays: true, ink: "#111111", frames: 600 } };
    expect(StyleProfileSchema.parse(style)).toEqual(style);
    expect(StyleProfileSchema.parse(A_STYLE).title).not.toHaveProperty("stays");
    expect(StyleProfileSchema.safeParse({ ...A_STYLE, captions: { ...A_STYLE.captions, maxWords: 17 } }).success).toBe(false);
    expect(StyleProfileSchema.safeParse({ ...A_STYLE, title: { ...A_STYLE.title!, frames: 601 } }).success).toBe(false);
    expect(StyleProfileSchema.safeParse({ ...A_STYLE, title: { ...A_STYLE.title!, ink: "black" } }).success).toBe(false);
  });

  it("refuses what the kit cannot do: a pause out of tighten's range, a title too long or too small, a punch-in past 1.3, a caption width, an unknown key", () => {
    const bad = (change: (style: StyleProfile) => unknown) => StyleProfileSchema.safeParse(change(structuredClone(A_STYLE))).success;
    expect(bad((style) => ({ ...style, pace: { pauseMs: 100, cutsPerMin: null } }))).toBe(false);
    expect(bad((style) => ({ ...style, pace: { pauseMs: 180.5, cutsPerMin: null } }))).toBe(false);
    expect(bad((style) => ({ ...style, title: { ...style.title!, frames: 14 } }))).toBe(false);
    expect(bad((style) => ({ ...style, title: { ...style.title!, size: PARTS.title.props.shape.size.minValue! - 1 } }))).toBe(false);
    expect(bad((style) => ({ ...style, punchIns: { perMin: 6, zoom: 1.31 } }))).toBe(false);
    expect(bad((style) => ({ ...style, captions: { ...style.captions, width: 0.8 } }))).toBe(false);
    expect(bad((style) => ({ ...style, look: { preset: "warm", adjust: {} } }))).toBe(false);
    expect(bad((style) => ({ ...style, notMatched: Array.from({ length: 21 }, (_, i) => `thing ${i}`) }))).toBe(false);
  });
});
