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

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/u)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
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
