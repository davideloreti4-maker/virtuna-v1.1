/**
 * measure.ts — how wide a line of text is in one of the kit's typefaces, on the server, where
 * there is no browser to ask (X90).
 *
 * The kit measures in the browser, with `measureText` and `MEASURED_AS` (`src/edit/film/fonts.ts`):
 * kerning left out, each character set as itself (no ligatures, no contextual alternates) and
 * every size in the design of large type (X94). So a line is as wide as its characters' advances
 * added up, and a table of advances, read from the kit's own font files at the optical size the
 * kit holds them at (`scripts/edit-font-widths.ts`), gives the same width at every size.
 * `scripts/edit-measure-proof.ts` holds the two side by side in Chromium and WebKit.
 */
import widths from "../../edit/film/widths.json";
import type { FONTS } from "./parts";

export type FontId = (typeof FONTS)[number];

interface Table {
  unitsPerEm: number;
  /** How far each character moves the pen, in font units. */
  advances: Record<string, number>;
}

const TABLES: Record<FontId, Record<string, Table>> = widths;

/** The weights the table holds for each font (every weight the kit draws with). */
export const MEASURED_WEIGHTS: Record<FontId, readonly number[]> = {
  inter: weightsOf("inter"),
  montserrat: weightsOf("montserrat"),
  tiktok: weightsOf("tiktok"),
};

function weightsOf(font: FontId): readonly number[] {
  return Object.freeze(Object.keys(TABLES[font]).map(Number).sort((a, b) => a - b));
}

/** The table of one font at one weight. Throws for a font or a weight the kit does not draw with. */
function tableOf(font: FontId, weight: number): Table {
  const known = Object.hasOwn(TABLES, font);
  const table = known && Object.hasOwn(TABLES[font], String(weight)) ? TABLES[font][String(weight)] : undefined;
  if (!table) throw new Error(`no widths for ${font} at weight ${weight}: ${known ? `the table holds ${MEASURED_WEIGHTS[font].join(", ")}` : "no such typeface"}`);
  return table;
}

/** Each table's widest letter, in font units: what a character it lacks is taken as. */
const WIDEST = new Map<Table, number>();
function widestOf(table: Table): number {
  let widest = WIDEST.get(table);
  if (widest === undefined) {
    widest = Math.max(...Object.entries(table.advances).filter(([character]) => /\p{L}/u.test(character)).map(([, advance]) => advance));
    WIDEST.set(table, widest);
  }
  return widest;
}

/**
 * Unkerned width in px, as the kit measures with MEASURED_AS, of the text as NFC (a letter written as a base and a combining
 * mark is the letter, as a browser draws it); and the characters the table lacks, in the order they first come, each once.
 * Each of those is taken as wide as the font's widest letter at that weight, so the box errs wide (the final fix wave: one
 * character the table lacked used to leave a whole run of captions unjudged). An emoji, drawn in the system's own font, can
 * still come out a little wider. `trackingEm` is letter-spacing in ems, added after every character as CSS adds it, the last
 * one too.
 */
export function measureWide(text: string, font: FontId, weight: number, size: number, trackingEm = 0): { width: number; unknown: string[] } {
  const table = tableOf(font, weight);
  if (!(Number.isFinite(size) && size > 0)) throw new Error(`no width at size ${size}: a size is a number of px above 0`);
  let units = 0;
  let characters = 0;
  const unknown: string[] = [];
  for (const character of text.normalize("NFC")) {
    const advance = table.advances[character];
    if (advance === undefined && !unknown.includes(character)) unknown.push(character);
    units += advance ?? widestOf(table);
    characters += 1;
  }
  return { width: (units * size) / table.unitsPerEm + trackingEm * size * characters, unknown };
}

/** Unkerned width in px of the text as NFC, as `measureWide` gives it; null when a character is not in the table. */
export function measure(text: string, font: FontId, weight: number, size: number, trackingEm = 0): number | null {
  const { width, unknown } = measureWide(text, font, weight, size, trackingEm);
  return unknown.length > 0 ? null : width;
}
