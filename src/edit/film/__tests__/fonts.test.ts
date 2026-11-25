import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { FONTS } from "../../../lib/edit";
import { OWN } from "../Film";
import { FONT_FILES, MEASURED_AS, OPSZ, SET_AS, fontFamily } from "../fonts";

const kit = join(process.cwd(), "public", "edit");

describe("the kit's typefaces", () => {
  it("has a file for every typeface an edit may name, and for no other", () => {
    expect(Object.keys(FONT_FILES).sort()).toEqual([...FONTS].sort());
  });

  it("keeps each as a real font file of our own, with its open licence beside it", () => {
    for (const id of FONTS) {
      const file = join(kit, FONT_FILES[id].file);
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size, file).toBeGreaterThan(100_000);
      expect(readFileSync(file).subarray(0, 4).toString("hex"), file).toBe("00010000"); // a TrueType font
      expect(readFileSync(join(dirname(file), "OFL.txt"), "utf8"), id).toContain("SIL Open Font License, Version 1.1");
    }
  });

  it("gives each a family name of our own, so a font of the same name on the viewer's machine is never used instead", () => {
    const families = FONTS.map(fontFamily);
    expect(new Set(families).size).toBe(FONTS.length);
    for (const family of families) expect(family).toMatch(/^Edit /);
  });
});

describe("how the kit sets its letters, measured and drawn alike (X94)", () => {
  it("measures each character as itself, at the optical size it draws at, and without kerning", () => {
    expect(SET_AS.fontVariantLigatures).toBe("none");
    expect(SET_AS.fontFeatureSettings).toBe('"liga" 0, "clig" 0, "calt" 0');
    expect(SET_AS.fontVariationSettings).toBe(`"opsz" ${OPSZ}`);
    expect(MEASURED_AS.fontVariantLigatures).toBe(SET_AS.fontVariantLigatures);
    expect(MEASURED_AS.fontVariationSettings).toBe(SET_AS.fontVariationSettings);
    expect(MEASURED_AS.fontFeatureSettings).toContain(SET_AS.fontFeatureSettings);
    expect(MEASURED_AS.fontFeatureSettings).toContain('"kern" 0');
    expect(MEASURED_AS.fontKerning).toBe("none");
  });

  it("draws the film's letters with the same settings, kerned", () => {
    for (const [name, value] of Object.entries(SET_AS)) expect(OWN[name as keyof typeof OWN], name).toBe(value);
    expect(OWN.fontKerning).toBeUndefined(); // kerned as the typeface asks
  });
});
