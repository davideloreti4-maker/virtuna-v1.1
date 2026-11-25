/**
 * captions.ts — the captions put where they cover neither the mouth nor the eyes and no app's
 * buttons hide them (N8). Pure, and judged by `review` itself.
 *
 * First (Task K1): while any page runs to more than three rows at the captions' size (review's `caption-rows`), a page holds
 * one word fewer (`maxWords`, never under 1). Everything after is judged with those words a page, and the one operation sets
 * `maxWords` too when it changed.
 *
 * Then the rule, as built (the brief, as amended after Task 3, Task 10's fix round 1, I1, and Task 10b's ruling a; the native
 * default's Task 5, R5, R6 and X126): the captions' errors are `on-face` (the mouth or the eyes) and `under-buttons` (an app's
 * zone hides them); their warnings (the chin, a touch of a zone) are allowed. Where the captions are has none: nothing changes.
 * Otherwise the places of the band their own `y` is in (low, from 0.5 down: `LOW_YS`; high: `HIGH_YS`) are tried in
 * `CAPTION_YS`' order, at each size of `captionSizes` from the largest, and at each size with each count of words a page of
 * `wordCounts`, from the most, less a count whose pages come out the same as the count before's (`countsTried`: the same pages
 * are judged the same); then the other band, again from their own size and words. The first with none is taken.
 * - Plain and pill lose words before size: at their size, a page holds one word fewer at a time, down to four
 *   (`FEWEST_WORDS`; never more than they hold), and only then are the letters made smaller, by 4 px at a time
 *   (`SIZE_STEP`: the asked size, then each multiple of 4 below it), down to the schema's least, where each count is tried
 *   again from the most. The sizes are absolute, so a larger size asked tries every size of the grid a smaller one does,
 *   in the same order, and never ends more than 3 px (the step less one) smaller than a smaller size asked: that one may end
 *   at its own size off the grid, where the larger goes down to the grid (asked 63 can end at 63, asked 64 at 60). This holds
 *   while a smaller box is clear wherever a larger one is.
 * - Pop and highlight keep their words a page and are tried at their size, then at 0.85 and 0.72 of it (`sizesFrom`, never
 *   under the schema's least), as before.
 * A smaller box can pass between the eyes and the mouth: so low captions are made shorter, then a little smaller, before they
 * are taken up over the face, and a style's high captions stay high. If no place is clear at any of these, the one with the
 * fewest error frames (`textErrorFrames`) at their own size and words is taken, the first in the order among equals, and only
 * if it has fewer than where the captions already are. Width and look stay as they are: the one operation sets `y`, `size`
 * when it is made smaller and `maxWords` when a page holds fewer.
 *
 * Shared with `placeTitle` (title.ts): the sizes a text is tried at (`sizesFrom`), and how review judges one text.
 */
import { pagesFor } from "../../../edit/film/pages";
import type { Analyses } from "../analysis";
import { layout, runWords } from "../derive";
import { CaptionsSchema, type Captions, type Edit } from "../doc";
import type { Op } from "../ops";
import { CAPTIONS, review, textErrorFrames, type Finding } from "../review";

/** Where the captions' line may sit, as a share of the stage's height, in the order they are tried: low first, as creators set them. */
export const CAPTION_YS = [0.72, 0.74, 0.76, 0.7, 0.68, 0.66, 0.64, 0.62, 0.6, 0.3, 0.26, 0.22, 0.18] as const;
/** Where captions are low (below the face), and where high (above it), as `CAPTION_YS` orders them. */
const LOW = 0.5;
const LOW_YS = CAPTION_YS.filter((y) => y >= LOW);
const HIGH_YS = CAPTION_YS.filter((y) => y < LOW);

/** What a text is made, as a share of its size, when no place is free of errors at its own. */
export const SHRINK = [0.85, 0.72] as const;
/** The captions' least size: what stays readable on a phone. */
const LEAST = CaptionsSchema.shape.size.minValue ?? 44;

/** The sizes a text is tried at: its own, then each of `SHRINK` of it, whole, never under `least`; each once. */
export function sizesFrom(size: number, least: number): number[] {
  return [...new Set([size, ...SHRINK.map((share) => Math.max(least, Math.round(size * share)))])];
}

/** Plain and pill sizes are tried on this grid, in px (X126). */
export const SIZE_STEP = 4;
/** Plain and pill pages lose words down to this many before their letters are made smaller (ruled). */
export const FEWEST_WORDS = 4;

/** The sizes captions are tried at, largest first: plain and pill the asked size then each multiple of SIZE_STEP below it down to 44; pop and highlight `sizesFrom` (today's). */
export function captionSizes(size: number, look: Captions["look"]): number[] {
  if (look === "pop" || look === "highlight") return sizesFrom(size, LEAST);
  const below: number[] = [];
  for (let step = Math.ceil(size / SIZE_STEP) * SIZE_STEP - SIZE_STEP; step >= LEAST; step -= SIZE_STEP) below.push(step);
  return [size, ...below];
}

/** The words a page tried at each size: plain and pill from the asked count down to FEWEST_WORDS (the asked alone when it is no more); pop and highlight the asked. */
export function wordCounts(maxWords: number, look: Captions["look"]): number[] {
  if (look === "pop" || look === "highlight" || maxWords <= FEWEST_WORDS) return [maxWords];
  return Array.from({ length: maxWords - FEWEST_WORDS + 1 }, (_, i) => maxWords - i);
}

/**
 * The counts of words a page `placeCaptions` tries: `wordCounts`, less each whose pages come out the same as the count before's.
 * Review sees `maxWords` only through the pages (`pagesFor`), so the same pages are judged the same at every size and place: a
 * pause or a sentence's end that closes every page at five words makes 8, 7, 6 and 5 one try.
 */
export function countsTried(edit: Edit): number[] {
  const counts = wordCounts(edit.captions.maxWords, edit.captions.look);
  const runs = layout(edit).runs;
  const pagesAt = counts.map((count) => runs.map((run) => pagesFor({ ...edit.captions, maxWords: count }, runWords(edit, run), run.frames).map((page) => page.words.length).join()).join("|"));
  return counts.filter((_, i) => i === 0 || pagesAt[i] !== pagesAt[i - 1]);
}

/** What review says of one text in an edit, its findings picked by `of`: whether one is an error, and whether one is a warning. */
export function judged(edit: Edit, analyses: Analyses, of: (finding: Finding) => boolean): { error: boolean; warn: boolean } {
  const findings = review(edit, analyses).filter(of);
  return { error: findings.some((finding) => finding.severity === "error"), warn: findings.some((finding) => finding.severity === "warn") };
}

/** A captions finding of `on-face` or `under-buttons`: what they are moved for. A captions finding names no mark and no item. */
const placedFor = (finding: Finding): boolean =>
  (finding.code === "on-face" || finding.code === "under-buttons") && finding.where.mark === undefined && finding.where.item === undefined;

/** A captions finding of `caption-rows`: a page set in more than three rows. */
const tooManyRows = (finding: Finding): boolean => finding.code === "caption-rows";

/** `[]`, or the one `captions.set` that sets fewer words a page, moves the captions off the face and out from under the apps' buttons, and last, makes them smaller. */
export function placeCaptions(given: Edit, analyses: Analyses): Op[] {
  if (!given.captions.on) return [];
  // First, the words a page: one fewer while a page runs to more than three rows at the captions' size.
  let edit = given;
  while (edit.captions.maxWords > 1 && judged(edit, analyses, tooManyRows).warn) {
    edit = { ...edit, captions: { ...edit.captions, maxWords: edit.captions.maxWords - 1 } };
  }
  const fewer = edit.captions.maxWords !== given.captions.maxWords ? { maxWords: edit.captions.maxWords } : {};
  const set = (settings: Omit<Extract<Op, { op: "captions.set" }>, "op">): Op[] => (Object.keys(settings).length > 0 ? [{ op: "captions.set", ...settings }] : []);

  const clear = (placed: Edit) => !judged(placed, analyses, placedFor).error;
  if (clear(edit)) return set(fewer);
  const at = (y: number, size = edit.captions.size, maxWords = edit.captions.maxWords): Edit => ({ ...edit, captions: { ...edit.captions, y, size, maxWords } });
  const bands = edit.captions.y >= LOW ? [LOW_YS, HIGH_YS] : [HIGH_YS, LOW_YS];
  const counts = countsTried(edit);
  for (const band of bands) {
    for (const size of captionSizes(edit.captions.size, edit.captions.look)) {
      for (const words of counts) {
        const free = band.find((y) => clear(at(y, size, words)));
        if (free !== undefined) return set({ y: free, ...(size !== edit.captions.size && { size }), ...(words !== given.captions.maxWords && { maxWords: words }) });
      }
    }
  }

  const errorFrames = (placed: Edit) => textErrorFrames(placed, analyses).get(CAPTIONS)?.size ?? 0;
  let best: { y: number; frames: number } | null = null;
  for (const y of CAPTION_YS) {
    const frames = errorFrames(at(y));
    if (!best || frames < best.frames) best = { y, frames };
  }
  return set({ ...(best && best.frames < errorFrames(edit) && { y: best.y }), ...fewer });
}
