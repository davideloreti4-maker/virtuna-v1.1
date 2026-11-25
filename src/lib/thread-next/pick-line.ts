/**
 * pick-line.ts — which hook Maven would post, and why (spec 2026-11-25-maven-pick-design.md §3).
 *
 * The hooks writer ranks its hooks (`rank` 1 is its own first choice) and gives each one plain reason
 * (`why`). Under a pack of hooks, before the numbers are in, the line says which one it would post and
 * that reason: "Maven would post hook 1. It dares a friend by name, so you wait to hear why." Once
 * every row is simulated the measured line takes the place ("Hook 2 leads by 5 points."): the numbers
 * win, even when they name another hook.
 *
 * Pure: no React.
 */

/** The most characters a reason shows, counted as shown (spec §3). */
export const WHY_MAX = 140;

/** A line break of any kind: a reason is one line. */
const LINE_BREAK = /[\r\n\u2028\u2029]/;

/** A web address: "http://", "https://" or "www." at a word's start (not letters inside a word). */
const WEB_ADDRESS = /(?<![\p{L}\p{N}])(?:https?:\/\/|www\.)/iu;

/** An em dash or an en dash with the spaces round it, and dashes at either end (the copy has no dashes). */
const DASH = /\s*[\u2014\u2013]\s*/g;
const END_DASHES = /^[\s\u2014\u2013]+|[\s\u2014\u2013]+$/g;

/** The fewest words, each with a letter in it, that make a reason: ".", "n/a" and "ok." do not. */
const MIN_WORDS = 3;
const HAS_LETTER = /\p{L}/u;
/** Writing without spaces (Japanese, Chinese, Thai) is one "word" by spaces: it needs this many letters instead. */
const MIN_LETTERS_UNSPACED = 8;
/** The scripts written without spaces. Any other (Latin, Cyrillic, Greek, Arabic, Hangul) still needs three words. */
const UNSPACED_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;

/** The first word, after any opening quotes, when it starts with a small letter: its letter and the rest of it. */
const FIRST_WORD = /^(["'“‘(\[]*)(\p{Ll})(\S*)/u;

/** Already ends a sentence: a full stop, a question mark or an exclamation mark (also the full-width ones of
 *  writing without spaces), and any closing quotes after it. */
const ENDS_A_SENTENCE = /[.?!。？！]["'”’)\]」』]*$/;

/** A text's words in lower case, curly quotes and apostrophes made straight, without the punctuation at
 *  their ends: what "the same words" compares. */
function wordsOf(text: string): string {
  return text
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean)
    .join(" ");
}

/** Enough words to be a reason: three with a letter in each or, written without spaces, eight letters. */
function hasEnoughWords(text: string): boolean {
  if (text.split(/\s+/).filter((w) => HAS_LETTER.test(w)).length >= MIN_WORDS) return true;
  return UNSPACED_SCRIPT.test(text) && !/\s/.test(text) && (text.match(/\p{L}/gu)?.length ?? 0) >= MIN_LETTERS_UNSPACED;
}

/**
 * A writer's reason as the creator reads it, or null when it is not usable: trimmed, it is one line,
 * has no web address, is not the hook itself (`hook`: the same words, whatever the case, the end
 * punctuation and the kind of quotes) and has enough words. It is shown as a sentence: a dash becomes
 * a comma and a space; the first letter a capital when the first word is all lower case ("it dares"
 * becomes "It dares", "iPhone" stays); a full stop at the end unless it already ends a sentence. What
 * is shown is at most `WHY_MAX` characters.
 */
export function usableWhy(why: string | null | undefined, hook?: string | null): string | null {
  if (typeof why !== "string") return null;
  const t = why.trim();
  if (!t || LINE_BREAK.test(t) || WEB_ADDRESS.test(t)) return null;
  if (hook && wordsOf(t) === wordsOf(hook)) return null;
  // The dashes out, and commas side by side made one.
  const text = t.replace(END_DASHES, "").replace(DASH, ", ").replace(/,(?:\s*,)+/g, ",");
  if (!hasEnoughWords(text)) return null;
  const capital = text.replace(FIRST_WORD, (word: string, open: string, letter: string, rest: string) =>
    rest === rest.toLowerCase() ? open + letter.toUpperCase() + rest : word,
  );
  const shown = ENDS_A_SENTENCE.test(capital) ? capital : `${capital}.`;
  return [...shown].length > WHY_MAX ? null : shown;
}

/** What the line needs of a row: its rank (hooks have one), its reason, its hook's line, and whether it is simulated. */
export interface PickRow {
  rank?: number | null;
  why?: string | null;
  /** The hook's own line: a reason that only repeats it is not one. */
  text?: string | null;
  simulated: boolean;
}

/**
 * The line under a pack of hooks, or null (spec §3.1): for two or more hooks, while any row is not
 * simulated, when the first-ranked row (the lowest `rank`, the first of them on a tie) has a usable
 * reason (`usableWhy`, checked against that row's own hook). The number is that row's place on the card.
 */
export function pickLine(rows: readonly PickRow[]): string | null {
  if (rows.length < 2 || rows.every((r) => r.simulated)) return null;
  let pick: { place: number; rank: number; row: PickRow } | null = null;
  for (const [i, row] of rows.entries()) {
    const { rank } = row;
    if (typeof rank === "number" && Number.isFinite(rank) && (!pick || rank < pick.rank)) pick = { place: i + 1, rank, row };
  }
  if (!pick) return null;
  const why = usableWhy(pick.row.why, pick.row.text);
  return why ? `Maven would post hook ${pick.place}. ${why}` : null;
}
