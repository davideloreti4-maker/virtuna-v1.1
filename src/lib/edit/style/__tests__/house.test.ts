/** The house style: what a first cut with no style asked for looks like (Task 10b, F; the native default, Task 8). */
import { describe, expect, it } from "vitest";
import { HOUSE_STYLE } from "../house";
import { DEFAULT_STYLE, StyleProfileSchema } from "../profile";

describe("HOUSE_STYLE", () => {
  it("is the native default: plain captions at 64 px and 600, five words, no colour; a light label at 72 px and 600 that stays; four light punch-ins a minute; natural", () => {
    expect(StyleProfileSchema.parse(HOUSE_STYLE)).toEqual(HOUSE_STYLE);
    expect(HOUSE_STYLE).toEqual({
      source: { kind: "default", name: null },
      pace: DEFAULT_STYLE.pace,
      captions: { on: true, look: "plain", font: "tiktok", size: 64, y: 0.72, maxWords: 5, highlight: null, weight: 600 },
      title: { on: true, y: 0.2, frames: 75, look: "label", size: 72, stays: true, ink: "#111111", weight: 600 },
      punchIns: { perMin: 4, zoom: 1.1 },
      look: { preset: "natural" },
      notMatched: [],
    });
  });

  it("leaves DEFAULT_STYLE as it was: the kit's own settings", () => {
    expect(DEFAULT_STYLE.captions.look).toBe("pill");
    expect(DEFAULT_STYLE.title).toBeNull();
    expect(DEFAULT_STYLE.punchIns).toBeNull();
  });
});
