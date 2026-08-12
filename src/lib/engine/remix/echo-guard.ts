/**
 * echo-guard.ts — the mechanical guard on the D-01 reversal.
 *
 * D-01 (decode-types.ts:155) prevented the adapt call from ever seeing the source's content, so
 * it could only borrow format. The owner's fidelity ruling (D2, 2026-08-10) requires adapt to see
 * `spoken_text`, which removes that guarantee. This restores the intent by a different route:
 * STRUCTURAL echo (duration, cadence, beat count) is what we want; TOPICAL echo is the failure.
 *
 * Deliberately a stopword approximation, not POS tagging — there is no NLP dependency in this
 * tree and adding one for a test would be the wrong trade.
 */

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "than", "so", "because",
  "of", "to", "in", "on", "at", "by", "for", "with", "from", "into", "about",
  "is", "are", "was", "were", "be", "been", "being", "am",
  "do", "does", "did", "doing", "have", "has", "had", "having",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
  "my", "your", "his", "its", "our", "their", "this", "that", "these", "those",
  "not", "no", "yes", "all", "any", "every", "more", "most", "some", "such",
  "will", "would", "can", "could", "should", "may", "might", "must",
  "what", "when", "where", "who", "why", "how", "which",
  "up", "out", "down", "over", "under", "just", "only", "very", "really",
]);

/**
 * The rhetorical frame — time units, comparison adverbs, togetherness.
 *
 * These are exactly what this guard is NOT looking for. The contract at the top of this file
 * draws the line: structural echo is wanted, topical echo is the failure. A turn beat shaped
 * "we've done X together for N years… and he still doesn't know Y" is a FORM, and reproducing
 * it in another niche is the product working.
 *
 * MEASURED 2026-08-12 (spec §11): a live check failed on `years`, `never`, `once` and
 * `together` between a friendship source and a gym adaptation whose subject matter — protein,
 * macros, VO2 max vs. birthdays and surnames — overlapped in nothing at all.
 *
 * Kept SEPARATE from STOPWORDS, which are grammatical function words. These are content-shaped
 * words deliberately exempted, and the distinction should stay visible to whoever reads this next.
 */
const FRAME_WORDS = new Set([
  "never", "once", "always", "ever", "still", "again", "together", "already", "yet",
  "second", "seconds", "minute", "minutes", "hour", "hours", "day", "days",
  "week", "weeks", "month", "months", "year", "years", "time", "times",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    // Contractions FIRST — while the apostrophe is still there to identify them. Stripping
    // punctuation first turns "we've" into "we ve": `we` falls out as a stopword and `ve`
    // survives as a "content token", so ANY two lines sharing a contraction collide. Against a
    // gate of "more than one shared token" that is most of a false failure on its own, and it
    // caused one (spec §11).
    .replace(/\bcan['’]t\b/gu, "can not")   // "ca" + "not" would leak `ca`
    .replace(/\bwon['’]t\b/gu, "will not")  // "wo" + "not" would leak `wo`
    .replace(/n['’]t\b/gu, " not")          // doesn't → does not; isn't → is not
    .replace(/['’](ve|ll|re|d|s|m)\b/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/u)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && !FRAME_WORDS.has(t));
}

/**
 * Every word of a line, lowercased, punctuation stripped. Case is DISCARDED here on purpose —
 * this is the haystack side, and a name is leakage whether or not the writer capitalised it.
 */
function allTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/u)
    .filter((t) => t.length > 1);
}

/**
 * The proper nouns of a line: capitalised words that do NOT open a sentence.
 *
 * A capital is the only signal available — there is no POS tagger in this tree and §7 forbids
 * adding one — so position does the disambiguating. "Best friends forever" opens with a capital
 * and is not a name; "is Emily Rose Johnson" is three.
 *
 * Under-reads by design: a name in sentence-initial position is missed rather than guessed at.
 * A false positive here accuses a faithful remix of plagiarism, which is the failure that cost
 * this lane a session — so the bias is deliberate.
 */
function properNouns(text: string): string[] {
  const names: string[] = [];
  for (const sentence of text.split(/[.!?\n]+/u)) {
    const words = sentence.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/u).filter(Boolean);
    // Skip index 0 — a sentence's first word is capitalised by grammar, not by being a name.
    for (let i = 1; i < words.length; i++) {
      const w = words[i]!;
      if (/^\p{Lu}/u.test(w) && w.length > 1) names.push(w.toLowerCase());
    }
  }
  return names;
}

/**
 * The source's SUBJECT surviving into the adapted line — the only echo that is a defect.
 *
 * OWNER RULING (2026-08-12): a remix copies the source ~1:1 and swaps it for the creator's
 * niche, "otherwise the reason the video went viral doesn't retain". That is D2, which rejected
 * a narrower structure-only fidelity outright.
 *
 * `sharedContentTokens` below implements spec §7 — no beat may share more than one content
 * token — and the two cannot both be right. Measured against live output, §7's gate failed the
 * model for reproducing the joke's own skeleton ("…? I have no idea.") while the topic had
 * separated cleanly. Enforcing it would push the model AWAY from fidelity, run after run.
 *
 * So the gate narrows to what genuinely must not survive: the people, places and brands the
 * source was about. Shared cadence, shared sentence shape, shared rhetorical frame — all of that
 * is the asset being copied, and none of it is measured here.
 *
 * @param exclude terms the creator asked for in the brief — a name they requested is not leakage.
 */
export function survivingSubjectTokens(source: string, adapted: string, exclude = ""): string[] {
  if (!source || !adapted) return [];
  const excluded = new Set(allTokens(exclude));
  const inAdapted = new Set(allTokens(adapted));
  const names = properNouns(source).filter((n) => !excluded.has(n));
  return [...new Set(names)].filter((n) => inAdapted.has(n));
}

/**
 * Content tokens present in BOTH strings.
 *
 * @param exclude terms the creator explicitly asked for (the brief) — shared use of those is
 *                what they requested, not an echo.
 */
export function sharedContentTokens(a: string, b: string, exclude = ""): string[] {
  if (!a || !b) return [];
  const excluded = new Set(tokenize(exclude));
  const left = new Set(tokenize(a).filter((t) => !excluded.has(t)));
  const right = new Set(tokenize(b).filter((t) => !excluded.has(t)));
  return [...left].filter((t) => right.has(t));
}
