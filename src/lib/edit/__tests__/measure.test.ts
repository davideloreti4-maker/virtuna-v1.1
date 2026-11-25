import { describe, expect, it } from "vitest";
import spaces from "../../../edit/film/spaces.json";
import widths from "../../../edit/film/widths.json";
import { FONTS } from "../parts";
import { MEASURED_WEIGHTS, measure, measureWide, type FontId } from "../measure";

describe("measure", () => {
  it("gives nothing its own width", () => {
    expect(measure("", "inter", 800, 72)).toBe(0);
  });

  it("gives a line the sum of its characters' advances, at the size", () => {
    // Montserrat's em is 1000 units, so at 1000 px a width is in font units.
    const { advances } = widths.montserrat["900"];
    expect(measure("Hi!", "montserrat", 900, 1000)).toBeCloseTo(advances.H + advances.i + advances["!"], 9);
    expect(measure("Hi!", "montserrat", 900, 100)).toBeCloseTo((advances.H + advances.i + advances["!"]) / 10, 9);
  });

  it("grows in step with the size", () => {
    const at72 = measure("Hello", "inter", 800, 72);
    const at144 = measure("Hello", "inter", 800, 144);
    expect(at72).not.toBeNull();
    expect(at72).toBeGreaterThan(0);
    expect(Math.abs((at144 ?? 0) - 2 * (at72 ?? 0))).toBeLessThan(1e-9);
  });

  it("adds the tracking after every character, as CSS letter-spacing does", () => {
    const plain = measure("ab", "tiktok", 800, 100);
    const tracked = measure("ab", "tiktok", 800, 100, -0.01);
    expect(plain).not.toBeNull();
    expect(Math.abs((tracked ?? 0) - ((plain ?? 0) - 2))).toBeLessThan(1e-9);
  });

  it("measures text as NFC: a letter written as a base and a combining mark is the letter (final fix wave)", () => {
    const decomposed = "nai\u0308ve";
    expect(decomposed).not.toBe("naïve");
    expect(measure(decomposed, "tiktok", 800, 72)).toBe(measure("naïve", "tiktok", 800, 72));
    expect(measure(decomposed, "tiktok", 800, 72)).not.toBeNull();
  });

  it("measureWide: takes a character the table lacks as wide as the font's widest letter at that weight, and names it (final fix wave)", () => {
    for (const font of FONTS) {
      for (const weight of MEASURED_WEIGHTS[font]) {
        const { advances, unitsPerEm } = (widths as Record<string, Record<string, { advances: Record<string, number>; unitsPerEm: number }>>)[font]![String(weight)]!;
        const widest = Math.max(...Object.entries(advances).filter(([character]) => /\p{L}/u.test(character)).map(([, advance]) => advance));
        const at = (text: string) => measureWide(text, font, weight, 100);
        // A known text: as measure gives it, nothing unknown.
        expect(at("Brand")).toEqual({ width: measure("Brand", font, weight, 100), unknown: [] });
        // "™" and "ș" are not in the tables: each is the widest letter, so the box errs wide; each named once, in order.
        expect(at("Brand™").width).toBeCloseTo((measure("Brand", font, weight, 100) ?? 0) + (widest * 100) / unitsPerEm, 9);
        expect(at("Brand™").width).toBeGreaterThanOrEqual(at("BrandW").width);
        expect(at("Brașov ™ ș").unknown).toEqual(["ș", "™"]);
        // An emoji, one code point of two UTF-16 units, is one character.
        expect(at("Wow 👋").unknown).toEqual(["👋"]);
        // Tracking after every character, the unknown ones too.
        expect(measureWide("a™", font, weight, 100, -0.01).width).toBeCloseTo(at("a™").width - 2, 9);
      }
    }
  });

  it("gives null for text with a character the table does not hold", () => {
    expect(measure("👋", "inter", 800, 72)).toBeNull();
    expect(measure("Hi 👋", "montserrat", 800, 72)).toBeNull();
    // TikTok Sans draws no micro sign; Inter does.
    expect(measure("5 µs", "tiktok", 800, 72)).toBeNull();
    expect(measure("5 µs", "inter", 800, 72)).toBeGreaterThan(0);
  });

  it("measures the quotes and the capital sharp s German and Italian captions are typed with, in every typeface", () => {
    for (const font of FONTS) {
      for (const line of ["„So geht’s“", "‚ja‘", "«ciao»", "‹oui›", "GROẞ", "“no”"]) expect(measure(line, font, 800, 72), `${font} ${line}`).toBeGreaterThan(0);
    }
    // The reversed quotes: Inter draws them, Montserrat and TikTok Sans do not.
    expect(measure("‛‟", "inter", 800, 72)).toBeGreaterThan(0);
    expect(measure("‛‟", "montserrat", 800, 72)).toBeNull();
    expect(measure("‛‟", "tiktok", 800, 72)).toBeNull();
  });

  it("refuses a weight the table does not hold, naming the font and the weight", () => {
    // Inter and TikTok Sans both draw 300; the table does not hold it.
    expect(() => measure("Hello", "inter", 300, 72)).toThrow(/inter.*300/);
    expect(() => measure("Hello", "tiktok", 850, 72)).toThrow(/tiktok.*850/);
  });

  it("refuses a typeface it has no table for, by name, including the names every object answers to", () => {
    for (const font of ["arial", "constructor", "toString", "__proto__"]) {
      expect(() => measure("Hello", font as FontId, 800, 72)).toThrow(`no widths for ${font} at weight 800`);
    }
  });

  it("refuses a size that is not a number above 0", () => {
    for (const size of [0, -72, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => measure("Hello", "inter", 800, size)).toThrow(`no width at size ${size}`);
    }
  });

  it("holds every weight the kit draws with, in every typeface: 400 to 900 in hundreds", () => {
    for (const font of FONTS) expect(MEASURED_WEIGHTS[font]).toEqual([400, 500, 600, 700, 800, 900]);
  });

  it("sets lighter letters no wider than heavier ones", () => {
    for (const font of FONTS) {
      const at = [400, 500, 600, 700, 800, 900].map((weight) => measure("Stop and look at this", font, weight, 64) ?? Number.NaN);
      for (let i = 1; i < at.length; i++) expect(at[i]!, `${font}: ${at.join(", ")}`).toBeGreaterThanOrEqual(at[i - 1]!);
      expect(at[0]!, font).toBeLessThan(at[at.length - 1]!);
    }
  });

  it("writes each typeface's own space beside the width tables", () => {
    const own: Record<FontId, Record<string, number>> = spaces;
    const tables: Record<FontId, Record<string, { unitsPerEm: number; advances: Record<string, number> }>> = widths;
    for (const font of FONTS) {
      expect(Object.keys(own[font]).map(Number), font).toEqual([...MEASURED_WEIGHTS[font]]);
      for (const weight of MEASURED_WEIGHTS[font]) {
        const table = tables[font][String(weight)]!;
        expect(own[font][String(weight)], `${font} ${weight}`).toBe(table.advances[" "]! / table.unitsPerEm);
      }
    }
  });
});
