/**
 * idea-line.ts — the one grey line under an idea's title in the idea pack (spec §4.2, drawing P12):
 * the first sentence of the idea's `take`, else of its `angle`, else none.
 *
 * Why `take` first: stored `angle`s are paragraphs (median ~200 characters, some carry segment ids such as
 * "niche_deep_buyer"); `take` is never empty and runs ~80 characters, and the drawing's line is its first
 * sentence.
 *
 * Pure: no React.
 */

import { firstSentence } from "./first-sentence";

export function ideaLineOf(props: { take: string; angle: string }): string | null {
  return firstSentence(props.take) ?? firstSentence(props.angle);
}
