/**
 * pages.ts — how a run's words become caption pages. Pure: words in, pages out.
 *
 * A page holds a few words that are read together. A new page starts after a pause in the speech, after the end of a
 * sentence, and when the page is full or, for captions set as a sentence, where its stretch of speech is evenly cut
 * (`evenGroups`). Nothing here draws.
 */
import type { SaidWord } from "../../lib/edit";
import type { Captions } from "../../lib/edit/doc";
import { sentenceSet } from "./layout";

/** A silence this long between two words starts a new page: four tenths of a second. */
const PAUSE = 12;
/** A page stays this long after its last word when nothing follows at once: a third of a second. */
const HOLD = 10;
/** A sentence's end at a word's end. */
const SENTENCE_END = /[.!?]$/;
/** A clause's end at a word's end: a comma, a semicolon or a colon. */
const CLAUSE_END = /[,;:]$/;
/**
 * What a break after a clause's end is worth, in words of unevenness squared: two and a half. So it moves a break by a word.
 * It could outweigh a page of one word at three a page (2 + 2 into 1 + 3 costs only 2), so no such page is tried where a cut
 * without one exists (`evenGroups`, the fix wave): it never leaves a word alone there.
 */
const CLAUSE_WORTH = 2.5;

/** A page of captions: the frames it shows on, counted from its run's first frame up to but not including `to`, and its words. */
export interface CaptionPage {
  from: number;
  to: number;
  words: SaidWord[];
}

/**
 * One stretch of speech on the fewest pages of at most `maxWords` words, evened out (ruled 2026-11-24, S1): the cut whose
 * pages are nearest alike in length, less what its breaks are worth (a break after a clause's end, and a break in a
 * silence, by its length up to `PAUSE`); between cuts that come out alike, the earlier break. Whole numbers throughout
 * (every cost times 24 k²), so that a tie is a tie in every engine.
 */
export function evenGroups(stretch: readonly SaidWord[], maxWords: number): SaidWord[][] {
  const [n, cap] = [stretch.length, Math.max(1, Math.floor(maxWords))];
  const k = Math.ceil(n / cap);
  if (k <= 1) return n > 0 ? [[...stretch]] : [];
  if (cap === 1) return stretch.map((word) => [word]); // one cut only, and its tables would be k × n
  // With at least two words for every page, a cut with no page of one word exists (2k ≤ n ≤ k × cap): no such page is tried.
  const shortest = n >= 2 * k ? 2 : 1;
  const uneven = (length: number) => 24 * (length * k - n) ** 2;
  const worth = (after: number) => {
    const [last, next] = [stretch[after]!, stretch[after + 1]!];
    return (CLAUSE_END.test(last.text) ? 24 * CLAUSE_WORTH * k * k : 0) + 2 * k * k * Math.max(0, Math.min(PAUSE, next.from - last.to));
  };
  // cost[j][i]: the least cost of setting the words from `i` on, on `j` pages; first[j][i]: that cut's first page's length.
  const cost = Array.from({ length: k + 1 }, () => Array<number>(n + 1).fill(Number.POSITIVE_INFINITY));
  const first = Array.from({ length: k + 1 }, () => Array<number>(n + 1).fill(0));
  cost[0]![n] = 0;
  for (let j = 1; j <= k; j++) {
    for (let i = n - j; i >= 0; i--) {
      for (let length = shortest; length <= cap && i + length <= n; length++) { // from the shortest: between equals the earlier break stands
        const rest = cost[j - 1]![i + length]!;
        if (rest === Number.POSITIVE_INFINITY) continue;
        const total = uneven(length) + rest - (j > 1 ? worth(i + length - 1) : 0);
        if (total < cost[j]![i]!) {
          cost[j]![i] = total;
          first[j]![i] = length;
        }
      }
    }
  }
  const groups: SaidWord[][] = [];
  for (let j = k, i = 0; j >= 1; j--) {
    const length = first[j]![i]!;
    groups.push(stretch.slice(i, i + length));
    i += length;
  }
  return groups;
}

/**
 * A run's words as caption pages of at most `maxWords` words, none shown past the run's `runFrames`. With `balanced`,
 * each stretch between two pauses or sentence ends is evened out over its pages (`evenGroups`); with `false`, a page is
 * filled before the next starts, as every edit made before 2026-11-24 is paged. `balanced` has no default, so that no
 * caller pages by itself without saying how: outside this file and its test, call `pagesFor` (S2).
 */
export function pagesOf(words: readonly SaidWord[], maxWords: number, runFrames: number, balanced: boolean): CaptionPage[] {
  const groups: SaidWord[][] = [];
  if (balanced) {
    let stretch: SaidWord[] = [];
    for (const word of words) {
      const before = stretch[stretch.length - 1];
      if (before && (word.from - before.to >= PAUSE || SENTENCE_END.test(before.text))) {
        groups.push(...evenGroups(stretch, maxWords));
        stretch = [];
      }
      stretch.push(word);
    }
    groups.push(...evenGroups(stretch, maxWords));
  } else {
    for (const word of words) {
      const page = groups[groups.length - 1];
      const before = page?.[page.length - 1];
      const starts = !page || !before || page.length >= maxWords || word.from - before.to >= PAUSE || SENTENCE_END.test(before.text);
      if (starts) groups.push([word]);
      else page.push(word);
    }
  }
  return groups.flatMap((group, i) => {
    const [first, last, next] = [group[0], group[group.length - 1], groups[i + 1]?.[0]];
    if (!first || !last) return [];
    return [{ from: first.from, to: Math.min(runFrames, next ? Math.max(first.from + 1, Math.min(next.from, last.to + HOLD)) : last.to + HOLD), words: group }];
  });
}

/** The pages of a run's words for these captions: evened out where they are set as a sentence (`sentenceSet`), else filled. The one way in for the kit, the review and the fit (S2). */
export function pagesFor(captions: Pick<Captions, "look" | "weight" | "maxWords">, words: readonly SaidWord[], runFrames: number): CaptionPage[] {
  return pagesOf(words, captions.maxWords, runFrames, sentenceSet(captions));
}
