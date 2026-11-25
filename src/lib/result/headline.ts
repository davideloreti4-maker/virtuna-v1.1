import type { Audience, Headline } from "./types";

/**
 * The one number of a video simulation: the share of the simulated audience that watches to the
 * end, the last value of the still-watching line (owner ruling 2026-11-19).
 *
 * Every surface that shows a video simulation's number (this page, thread cards, Library) calls
 * this function, so they cannot disagree. The hook result gets its own function in slice B.
 */
export function headlineOf(audience: Audience): Headline {
  const last = audience.points[audience.points.length - 1]![1];
  return { value: Math.round(last), label: "watch to the end" };
}
