/**
 * lines.ts — where the kit breaks a line.
 *
 * The kit breaks its own lines, from measured widths, and draws each line as it decided. Left to
 * the browser, the same title broke after "do" in Chrome and before it in Safari, so a preview
 * could differ from the posted film (2026-11-19). Nothing here measures: the caller says how wide
 * any run of words is.
 */

/** The width of the words from `from` up to, not including, `to`, set as one line. */
export type WidthOf = (from: number, to: number) => number;

/**
 * How much shorter the longest line must come out for a way of breaking to be taken over one that
 * fills the earlier lines more: half a percent. Two browsers measure the same words a hair
 * apart; a difference that small must not decide where a line breaks.
 */
const CLEARLY = 0.005;

/** The longest line of a breaking, given as the word each line starts with. */
export function longest(breaks: readonly number[], count: number, widthOf: WidthOf): number {
  return breaks.reduce((most, from, i) => Math.max(most, widthOf(from, breaks[i + 1] ?? count)), 0);
}

/**
 * Breaks `count` words into `lines` lines (fewer if there are fewer words) so that the block
 * comes out even: the longest line as short as it can be, then the next longest, and so on. Gives
 * the word each line starts with. Where two ways are as good as each other, the one that fills
 * the earlier lines.
 */
export function evenBreaks(count: number, lines: number, widthOf: WidthOf): number[] {
  const wanted = Math.min(lines, count);
  let best: number[] = [];
  let least: number[] = [];
  /** Whether lines of these widths, longest first, are clearly more even than the best so far. */
  const better = (widths: number[]): boolean => {
    const hair = CLEARLY * Math.max(widths[0] ?? 0, least[0] ?? 0);
    for (const [i, width] of widths.entries()) {
      const held = least[i] ?? Infinity;
      if (width < held - hair) return true;
      if (width > held + hair) return false;
    }
    return false;
  };
  // Every way of breaking, those that fill the earlier lines first: a later one must be clearly better to be taken.
  const walk = (breaks: number[]): void => {
    if (breaks.length === wanted) {
      const widths = breaks.map((from, i) => widthOf(from, breaks[i + 1] ?? count)).sort((one, other) => other - one);
      if (best.length === 0 || better(widths)) [best, least] = [breaks, widths];
      return;
    }
    const after = breaks[breaks.length - 1] ?? -1;
    for (let next = count - (wanted - breaks.length); next > after; next--) walk([...breaks, next]);
  };
  if (wanted > 0) walk([0]);
  return best;
}

/**
 * The fewest rows the words fit in, each row no wider than `room`, evened out. A single word
 * wider than the room gets a row of its own and still does not fit: making it fit is the
 * caller's (it sets the type smaller).
 */
export function rowsWithin(count: number, room: number, widthOf: WidthOf): number[] {
  const held: WidthOf = (from, to) => (to - from === 1 ? Math.min(widthOf(from, to), room) : widthOf(from, to));
  for (let rows = 1; rows < count; rows++) {
    const breaks = evenBreaks(count, rows, held);
    if (longest(breaks, count, held) <= room) return breaks;
  }
  return evenBreaks(count, count, held);
}

/**
 * Sets a block of words as large as its room allows, in whole pixels and no larger than `size`:
 * on the fewest lines that let the type be as large as asked, or, when the words are too many for
 * that, on as many lines as it may have, smaller. `widthOf` measures for one pixel of type size;
 * `sides` is the room kept free at the two ends of every line together, in type sizes (a label's
 * padding).
 */
export function fitLines(count: number, lines: number, room: number, size: number, sides: number, widthOf: WidthOf): { size: number; breaks: number[] } {
  let best = { size: Math.floor(size), breaks: [] as number[] };
  let most = 0;
  for (let n = 1; n <= Math.min(lines, count); n++) {
    const breaks = evenBreaks(count, n, widthOf);
    const fits = room / (longest(breaks, count, widthOf) + sides);
    if (fits >= size) return { size: Math.floor(size), breaks };
    if (fits > most) [best, most] = [{ size: Math.floor(fits), breaks }, fits];
  }
  return best;
}

/** A word of a title: its letters, and which stretches of them are marked. */
export interface MarkedWord {
  text: string;
  bits: { text: string; marked: boolean }[];
}

/** The words of a title. What stands between two asterisks is marked (it takes the accent colour); a mark may run over several words or over a part of one. */
export function markedWords(text: string): MarkedWord[] {
  const words: MarkedWord[] = [];
  let growing = false; // whether the last word goes on in the next bit
  text.split("*").forEach((piece, i) => {
    const marked = i % 2 === 1;
    for (const bit of piece.split(/(\s+)/)) {
      if (bit === "") continue;
      if (bit.trim() === "") {
        growing = false;
        continue;
      }
      const word = growing ? words[words.length - 1] : undefined;
      if (word) {
        word.text += bit;
        word.bits.push({ text: bit, marked });
      } else {
        words.push({ text: bit, bits: [{ text: bit, marked }] });
      }
      growing = true;
    }
  });
  return words;
}
