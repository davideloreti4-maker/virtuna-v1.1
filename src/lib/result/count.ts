import { watchingAt } from "./curve";
import type { Audience } from "./types";

/**
 * The count under the video and on the Engagement page: the simulated audience counted as 1,000
 * viewers. A count is a stored share (0 to 100) times ten, rounded, and nothing else is counted. It is
 * never read off the headline's rounded percent: a whole percent times ten sits up to five viewers
 * away from the line it stands for.
 */

/** How many viewers a share of 100 is. */
export const VIEWERS = 1000;
/** The opening Engagement's first row is read at ("Past the first 3 seconds"). */
export const OPENING_S = 3;
/** The words beside a count. */
export const COUNT_WORDS = { end: "watched to the end", now: "still watching" } as const;
export type CountWords = (typeof COUNT_WORDS)[keyof typeof COUNT_WORDS];

export interface Count {
  n: number;
  words: CountWords;
}

/** Before the words of every count. */
export const OF_VIEWERS = "of 1,000";

/** A share (0 to 100) as a count of 1,000. */
export function toCount(pct: number): number {
  return Math.round(pct * 10);
}

/** A count as shown: `1,000`, `461`. */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/** The count at the clip's end: the share stored at the end of the last scene. */
export function endCount(audience: Audience): number {
  return toCount(audience.points[audience.points.length - 1]![1]);
}

/**
 * The count at a moment. At rest, the clip's end ("watched to the end"); at any other moment (playing,
 * or stopped somewhere) the line's value there ("still watching").
 */
export function countAt(audience: Audience, t: number, resting: boolean): Count {
  if (resting) return { n: endCount(audience), words: COUNT_WORDS.end };
  return { n: toCount(watchingAt(audience.points, t)), words: COUNT_WORDS.now };
}

/** Still watching after the opening: the count at 0:03, or at the clip's end for a shorter clip. */
export function pastOpening(audience: Audience): number {
  return toCount(watchingAt(audience.points, Math.min(OPENING_S, audience.clipS)));
}

/** How long the count rolls when a result lands. */
export const ROLL_MS = 1500;

/** The number a roll shows `elapsedMs` in: from `from` to `to`, ease-out (cubic), whole numbers. */
export function rolledAt(from: number, to: number, elapsedMs: number): number {
  const k = Math.min(1, Math.max(0, elapsedMs / ROLL_MS));
  return Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
}
