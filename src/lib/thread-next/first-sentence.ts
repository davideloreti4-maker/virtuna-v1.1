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
