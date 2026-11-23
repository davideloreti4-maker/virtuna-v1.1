/**
 * first-sentence.ts — the first sentence of a stored text, for cards that show one short line and keep the
 * whole text behind "Show all" (idea lines, fallback lines).
 *
 * A sentence ends at . ! or ? (and any closing quote or bracket right after it) followed by a space and a
 * capital letter, a digit or an opening quote, so "e.g. a startup" and "5.30" do not end one. A full stop
 * after a title or common abbreviation ("Dr.", "vs.", "No.", "U.S."), a bare number ("1.", "Step 2.") or a
 * single letter ("Plan A.") does not end one either. Never cuts mid-word. Blank gives null.
 *
 * Pure: no React.
 */

/** Where a sentence may end: the punctuation and any closing quotes, before a space and a new start. */
const CANDIDATE_END = /[.!?]["'”’)\]]*(?=\s+["'“‘(]?[A-Z0-9])/g;

/** The text before a full stop that does NOT end a sentence there. */
const NOT_AN_END = /(?:^|[\s("'“‘])(?:mr|mrs|ms|dr|st|vs|no|etc|e\.g|i\.e|u\.s|a\.m|p\.m|[a-z]|\d+)$/i;

export function firstSentence(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  for (const m of t.matchAll(CANDIDATE_END)) {
    if (t[m.index] === "." && NOT_AN_END.test(t.slice(0, m.index))) continue;
    return t.slice(0, m.index + m[0].length);
  }
  return t;
}

/** The longest a folded lead runs before "More": about two lines of a phone's sheet. */
export const FOLD_MAX = 120;

/**
 * What a folded text shows before "More", or null when it needs no fold.
 *
 * Its first sentence, when the text goes on after it and the sentence fits in `max`. A text that is
 * one long sentence, or opens on one, is cut at the last whole word inside `max` and ends on "…":
 * real "why it works" lines are a single 40-word sentence, which a fold by sentence alone showed in
 * full (review 2026-11-23). A text that fits in `max` and is one sentence needs no fold.
 */
export function foldLead(text: string, max: number = FOLD_MAX): string | null {
  const whole = text.trim();
  if (!whole) return null;
  const first = firstSentence(whole) ?? whole;
  if (first !== whole && first.length <= max) return first;
  if (whole.length <= max) return null;
  const head = whole.slice(0, max + 1);
  const lastSpace = head.lastIndexOf(" ");
  // No space in the second half: one long token; cut it at `max`.
  const lead = lastSpace >= max / 2 ? head.slice(0, lastSpace) : whole.slice(0, max);
  return `${lead.replace(/[\s,;:.!?–—(-]+$/, "")}…`;
}
