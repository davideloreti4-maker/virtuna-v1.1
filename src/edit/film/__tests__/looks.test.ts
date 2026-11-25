import { describe, expect, it } from "vitest";
import { LOOK_IDS, NEUTRAL, NO_LOOK } from "../../../lib/edit";
import { LOOKS, gradeOf, standInOf, type Grade } from "../looks";

describe("the kit's looks", () => {
  it("has values for every preset an edit may name, each inside the scale", () => {
    expect(Object.keys(LOOKS).sort()).toEqual([...LOOK_IDS].sort());
    for (const id of LOOK_IDS) for (const value of Object.values(LOOKS[id])) expect(Math.abs(value), id).toBeLessThanOrEqual(1);
    expect(LOOKS.natural).toEqual(NEUTRAL);
  });

  it("asks for no colour pass at all when a look changes nothing", () => {
    expect(gradeOf(NO_LOOK)).toBeNull();
    expect(gradeOf({ preset: "natural", adjust: { ...NEUTRAL, exposure: 0.2 } })).not.toBeNull();
    expect(gradeOf({ preset: "warm", adjust: NEUTRAL })).not.toBeNull();
  });

  it("adds the adjustments to the preset, holds each inside the scale, and turns them into what one colour pass takes", () => {
    expect(gradeOf({ preset: "natural", adjust: { ...NEUTRAL, exposure: 1, warmth: -1, contrast: 1, saturation: -1 } }))
      .toEqual({ exposure: 1.5, temperature: -0.6, tint: 0, shadows: 0, highlights: 0, contrast: 1.5, saturation: 0, vibrance: 0 });
    expect(gradeOf({ preset: "mono", adjust: NEUTRAL })!.saturation).toBe(0); // no colour left
    expect(gradeOf({ preset: "mono", adjust: { ...NEUTRAL, saturation: -1 } })!.saturation).toBe(0); // and no further
    expect(gradeOf({ preset: "natural", adjust: { ...NEUTRAL, saturation: 1 } })!.saturation).toBe(2);
  });

  it("asks the colour pass for little vibrance on the way up, where it adds colour to grey, and all of it on the way down", () => {
    expect(gradeOf({ preset: "natural", adjust: { ...NEUTRAL, vibrance: 1 } })!.vibrance).toBeCloseTo(0.12, 9);
    expect(gradeOf({ preset: "natural", adjust: { ...NEUTRAL, vibrance: 0.5 } })!.vibrance).toBeCloseTo(0.06, 9);
    expect(gradeOf({ preset: "natural", adjust: { ...NEUTRAL, vibrance: -1 } })!.vibrance).toBe(-1);
    expect(gradeOf({ preset: "natural", adjust: { ...NEUTRAL, vibrance: -0.5 } })!.vibrance).toBe(-0.5);
  });
});

describe("the stand-in for a colour pass, where a browser cannot run one", () => {
  const PLAIN: Grade = { exposure: 0, temperature: 0, tint: 0, shadows: 0, highlights: 0, contrast: 1, saturation: 1, vibrance: 0 };
  /** One colour through a colour matrix of four rows of five, as a filter applies it. */
  const through = (matrix: number[], [r, g, b]: [number, number, number]) => [0, 1, 2].map((row) => matrix[row * 5]! * r + matrix[row * 5 + 1]! * g + matrix[row * 5 + 2]! * b + matrix[row * 5 + 4]!);
  const close = (got: number[], want: number[]) => got.forEach((value, i) => expect(value).toBeCloseTo(want[i]!, 9));
  const IDENTITY = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

  it("changes nothing for a grade that changes nothing, and never touches how see-through a pixel is", () => {
    close(standInOf(PLAIN).light, IDENTITY);
    close(standInOf(PLAIN).encoded, IDENTITY);
    for (const matrix of Object.values(standInOf({ ...PLAIN, exposure: 1, temperature: 0.4, contrast: 1.3, saturation: 0.5, vibrance: 0.2 }))) expect(matrix.slice(15)).toEqual([0, 0, 0, 1, 0]);
  });

  it("gives one stop of exposure as twice the light, as the colour pass does", () => {
    close(through(standInOf({ ...PLAIN, exposure: 1 }).light, [0.1, 0.2, 0.3]), [0.2, 0.4, 0.6]);
    close(standInOf({ ...PLAIN, exposure: 1 }).encoded, IDENTITY);
  });

  it("warms and tints with the colour pass's own gains, which leave a grey as bright as it was", () => {
    // The colour pass: gains = 2^((0.3, 0, -0.3) x temperature + (0.15, -0.3, 0.15) x tint), divided by their own brightness.
    const raw = [2 ** (0.3 * 0.6 + 0.15 * 0.2), 2 ** (-0.3 * 0.2), 2 ** (-0.3 * 0.6 + 0.15 * 0.2)];
    const brightness = 0.2126 * raw[0]! + 0.7152 * raw[1]! + 0.0722 * raw[2]!;
    const { light } = standInOf({ ...PLAIN, temperature: 0.6, tint: 0.2 });
    close(through(light, [1, 1, 1]), raw.map((gain) => gain / brightness));
    const [r, g, b] = through(light, [0.5, 0.5, 0.5]);
    expect(0.2126 * r! + 0.7152 * g! + 0.0722 * b!).toBeCloseTo(0.5, 9);
    expect(r).toBeGreaterThan(b!); // warmer: more red than blue
  });

  it("turns contrast about the middle grey, as the colour pass does", () => {
    const { encoded } = standInOf({ ...PLAIN, contrast: 1.5 });
    close(through(encoded, [0.5, 0.5, 0.5]), [0.5, 0.5, 0.5]);
    close(through(encoded, [0.7, 0.7, 0.7]), [0.8, 0.8, 0.8]);
    close(through(encoded, [0.3, 0.3, 0.3]), [0.2, 0.2, 0.2]);
  });

  it("takes colour out towards each pixel's own brightness, as the colour pass does", () => {
    const grey = 0.213 * 0.9 + 0.715 * 0.4 + 0.072 * 0.1;
    close(through(standInOf({ ...PLAIN, saturation: 0 }).encoded, [0.9, 0.4, 0.1]), [grey, grey, grey]);
    close(through(standInOf({ ...PLAIN, saturation: 2 }).encoded, [0.9, 0.4, 0.1]), [grey + 2 * (0.9 - grey), grey + 2 * (0.4 - grey), grey + 2 * (0.1 - grey)]);
  });

  it("stands vibrance in with some saturation, more for more and less for less", () => {
    const spread = (vibrance: number) => {
      const [r, , b] = through(standInOf({ ...PLAIN, vibrance }).encoded, [0.9, 0.4, 0.1]);
      return r! - b!;
    };
    expect(spread(0.5)).toBeGreaterThan(spread(0));
    expect(spread(-0.5)).toBeLessThan(spread(0));
    expect(spread(0)).toBeCloseTo(0.8, 9);
    expect(spread(-1)).toBeCloseTo(0, 9); // all the way down leaves no colour, as in the colour pass
  });

  it("applies contrast before saturation, in the colour pass's order", () => {
    // Contrast 2 on (0.6, 0.5, 0.5) gives (0.7, 0.5, 0.5); taking all colour out of that leaves its brightness.
    const grey = 0.213 * 0.7 + 0.715 * 0.5 + 0.072 * 0.5;
    close(through(standInOf({ ...PLAIN, contrast: 2, saturation: 0 }).encoded, [0.6, 0.5, 0.5]), [grey, grey, grey]);
  });
});
