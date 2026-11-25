/**
 * asksToSell — whether a writer's ask is about selling, so the "What you sell" line belongs in its
 * bundle (plan 2026-11-24-you, the controller's ruling 15).
 *
 * Why the code decides and not the wording: in real runs on the writers' model, with the line printed
 * for every ask, one of four ideas for "5 video ideas about cooking for flatmates" pitched the offer
 * with its price; with stronger "leave it out" wording the offer vanished from "5 video ideas to sell
 * my meal plan" too. So hooks, idea and script print the line only when this is true (chat always
 * prints it: a conversation about pricing or offers has no "ask to sell").
 *
 * True when either holds:
 *   a. the ask has a selling word (SELLING_WORDS, SELLING_PAIRS), as a whole word, in any case;
 *   b. the ask names the offer: it shares with the sells text a run of two or more consecutive words,
 *      compared without case and punctuation, each word three characters or longer and not a common
 *      function word (FUNCTION_WORDS). "ideas about my meal plan" names "A 12-week budget meal plan, $19."
 *
 * Pure, no I/O. Exported for the assembler and for remix's creator block.
 */

/** Selling words, matched as whole words (lower case). */
const SELLING_WORDS: ReadonlySet<string> = new Set([
  "sell", "sells", "selling", "sold", "sale", "sales",
  "promote", "promotes", "promoting", "promo", "promotion",
  "launch", "launches", "launching",
  "pitch", "pitching",
  "advertise", "advertising",
  "buy", "buying", "buyers", "purchase", "purchasing",
  "customers", "clients",
  "signups",
  "convert", "converting", "conversion", "conversions",
  "checkout",
  "discount", "discounting",
  "waitlist",
  "preorder", "preordering",
  "affiliate",
  "sponsor", "sponsored", "sponsoring", "sponsorship",
  "monetise", "monetize", "monetising", "monetizing", "monetisation", "monetization",
]);

/** Selling words written as two (with a hyphen or a space): "sign-ups", "sign ups", "pre-order". */
const SELLING_PAIRS: readonly (readonly [string, string])[] = [
  ["sign", "ups"],
  ["pre", "order"],
  ["pre", "ordering"],
];

/** Common function words: never part of an offer's name. */
const FUNCTION_WORDS: ReadonlySet<string> = new Set([
  "the", "and", "for", "with", "your", "from", "this", "that", "into", "about",
  "are", "was", "were", "been", "being", "have", "has", "had", "does", "did",
  "not", "but", "you", "our", "ours", "yours", "out", "all", "any", "can", "could",
  "will", "would", "should", "just", "more", "most", "some", "than", "then",
  "them", "they", "their", "there", "these", "those", "what", "when", "where",
  "which", "who", "whom", "why", "how", "very", "also", "over", "under", "after",
  "before", "each", "every", "here", "its", "his", "her", "him", "she", "off",
  "onto", "upon", "via", "per", "like", "only", "own", "same", "such", "too",
]);

/** Lower-cased words: letters and digits, everything else (punctuation, "$", hyphens) splits. */
function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** A word that can be part of an offer's name. */
const nameWord = (word: string) => word.length >= 3 && !FUNCTION_WORDS.has(word);

export function asksToSell(ask: string, sells: string): boolean {
  const asked = words(ask);
  if (asked.some((word) => SELLING_WORDS.has(word))) return true;
  for (let i = 0; i + 1 < asked.length; i++) {
    if (SELLING_PAIRS.some(([a, b]) => asked[i] === a && asked[i + 1] === b)) return true;
  }

  const offer = words(sells);
  for (let i = 0; i + 1 < asked.length; i++) {
    if (!nameWord(asked[i]!) || !nameWord(asked[i + 1]!)) continue;
    for (let j = 0; j + 1 < offer.length; j++) {
      if (asked[i] === offer[j] && asked[i + 1] === offer[j + 1]) return true;
    }
  }
  return false;
}
