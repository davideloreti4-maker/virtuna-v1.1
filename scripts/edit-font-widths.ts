/**
 * edit-font-widths.ts — the width tables the server measures text with (X90): for each of the
 * kit's typefaces, at each weight the kit draws it in, how far every character moves the pen,
 * unkerned, read from the kit's own font file. `src/lib/edit/measure.ts` reads them.
 *
 * A character's width is the font's for that character set alone, as the kit sets text (`SET_AS`
 * in `src/edit/film/fonts.ts`, X94): no ligatures, no contextual alternates, no kerning. The
 * substitutions a font makes on one character by itself stay in. Montserrat sets "Ŀ", "ŀ" and "ŉ"
 * as two glyphs each (ccmp), in every browser and whatever the settings (Safari does not let
 * `"ccmp" 0` turn it off), so their widths are those of the two.
 *
 * The weights the kit draws text in (read from the parts, 2026-11-21; a set weight from 2026-11-24, X122):
 *   - captions (`Captions.tsx`): 800 and a stressed word 900, or the captions' own weight and a
 *     stressed word one step (100) more, at most 900; on a plain page with a weight and no highlight colour, every word at
 *     the captions' own weight (Task 3);
 *   - title (`parts/Title.tsx`): 700 as a label, else 800 (bold, outline), or the title's own
 *     weight; with letter-spacing -0.01em;
 *   - call-out (`parts/Callout.tsx`): 800;
 *   - progress bar (`parts/Progress.tsx`): no text.
 * A caption's or a title's own weight is one of 400 to 900 in hundreds, and every part may set any
 * of the three typefaces, so each is tabled at 400, 500, 600, 700, 800 and 900.
 *
 * Each file is a variable font. It is set at the weight, at the width and slant the kit's measure
 * asks for (`fontStretch: 100%`, upright: each axis' default), and at the optical size the kit
 * holds it at, every size (`OPSZ`, X94), taken into the axis' range as a browser takes it: Inter's
 * axis runs 14 to 32 and TikTok Sans' 12 to 36; Montserrat has none.
 *
 * A character is in a table only when the font draws it: one the font has no glyph for (it would
 * be drawn in another typeface, or not at all, like the soft hyphen) is left out, and
 * `measure` gives null for text that holds it.
 *
 * Beside the tables it writes `src/edit/film/spaces.json`: each typeface's own space at each
 * weight, in ems (its advance over the em), the gap the kit sets between the words of a plain
 * sentence (X125). The kit reads that small file; it never carries the whole tables.
 *
 * Usage:  pnpm exec tsx scripts/edit-font-widths.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import * as fontkit from "fontkit";
import { FONT_FILES, MEASURED_AS, OPSZ, type FontId } from "../src/edit/film/fonts";

/** The weights each typeface is tabled at: every weight a caption or a title may be set in (400 to 900 in hundreds, X122). */
const WEIGHTS = [400, 500, 600, 700, 800, 900] as const;

/**
 * The characters tabled: printable ASCII, Latin-1 and Latin Extended-A, and what else a caption
 * is typed with: the dashes, every curly and low quote (U+2018 to U+201F), the single guillemets,
 * the ellipsis, the bullet, the euro and the capital sharp s.
 */
const CHARACTERS: string[] = [
  ...range(0x20, 0x7e),
  ...range(0xa0, 0x17f),
  ..."–—",
  ...range(0x2018, 0x201f),
  ..."‹›…•€ẞ",
];

/** Set as the kit measures text: the features `MEASURED_AS` turns off (ligatures, contextual alternates, kerning) off, the rest as the font asks. */
const FEATURES = Object.fromEntries([...(MEASURED_AS.fontFeatureSettings ?? "").matchAll(/"(\w{4})" (\d+)/g)].map(([, tag = "", value]) => [tag, value !== "0"]));

const OUT = "src/edit/film/widths.json";
/** Each typeface's own space (U+0020) at each weight, in ems, from the same instances (X125): the gap between the words of a plain sentence (`spaceEm` in `src/edit/film/layout.ts`). */
const SPACES = "src/edit/film/spaces.json";

function range(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i));
}

interface Table {
  unitsPerEm: number;
  /** How far each character moves the pen, in font units, to a thousandth. */
  advances: Record<string, number>;
}

function tableOf(id: FontId, weight: number): { table: Table; missing: string[] } {
  const font = fontkit.openSync(join("public/edit", FONT_FILES[id].file));
  const wght = font.variationAxes.wght;
  if (!wght || weight < wght.min || weight > wght.max) throw new Error(`${id}: the file holds no weight ${weight}`);
  const opsz = font.variationAxes.opsz;
  const instance = font.getVariation({ wght: weight, ...(opsz ? { opsz: Math.min(opsz.max, Math.max(opsz.min, OPSZ)) } : {}) });
  const advances: Record<string, number> = {};
  const missing: string[] = [];
  for (const character of CHARACTERS) {
    if (instance.glyphForCodePoint(character.codePointAt(0) ?? 0).id === 0) missing.push(character);
    else advances[character] = Math.round(instance.layout(character, FEATURES).advanceWidth * 1000) / 1000;
  }
  return { table: { unitsPerEm: font.unitsPerEm, advances }, missing };
}

function main(): void {
  const lines: string[] = [];
  const spaces: Record<string, Record<string, number>> = {};
  const fonts = Object.keys(FONT_FILES) as FontId[];
  fonts.forEach((id, f) => {
    lines.push(`  ${JSON.stringify(id)}: {`);
    spaces[id] = {};
    WEIGHTS.forEach((weight, w) => {
      const { table, missing } = tableOf(id, weight);
      lines.push(`    "${weight}": ${JSON.stringify(table)}${w < WEIGHTS.length - 1 ? "," : ""}`);
      const space = table.advances[" "];
      if (space === undefined) throw new Error(`${id} ${weight}: the font draws no space`);
      spaces[id]![String(weight)] = space / table.unitsPerEm;
      const shown = missing.map((character) => `U+${(character.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`);
      console.log(`${id} ${weight}: ${Object.keys(table.advances).length} characters${missing.length > 0 ? `; not in the font: ${shown.join(" ")}` : ""}`);
    });
    lines.push(`  }${f < fonts.length - 1 ? "," : ""}`);
  });
  writeFileSync(OUT, `{\n${lines.join("\n")}\n}\n`);
  console.log(`wrote ${OUT}`);
  writeFileSync(SPACES, `${JSON.stringify(spaces, null, 2)}\n`);
  console.log(`wrote ${SPACES}`);
}

main();
