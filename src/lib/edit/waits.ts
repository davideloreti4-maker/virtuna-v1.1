/**
 * waits.ts — how long a wait is said to be (spec 2026-11-24-editor-screens-design.md E21; plan 2026-11-24-editor-screens-a,
 * Task 3; the controller's ruling R3 for the upload line): the upload's time left from what it has measured, and estimates of
 * the analysis from the take's length and of the export from the film's. Said in words ("About a minute"), never as a
 * percentage alone. Pure.
 */

/** The longest an export is said to take, in seconds. */
export const MOST_EXPORT_S = 150;

/** The analysis of a take of this many seconds, in seconds: about 30 plus 0.65 a second of take. */
export function analysisSeconds(takeSeconds: number): number {
  return Math.round(30 + 0.65 * Math.max(0, takeSeconds));
}

/** The export of a film of this many seconds, in seconds: about 40 plus 0.8 a second of film, at most `MOST_EXPORT_S`. */
export function exportSeconds(filmSeconds: number): number {
  return Math.min(MOST_EXPORT_S, Math.round(40 + 0.8 * Math.max(0, filmSeconds)));
}

/** An estimated wait (an analysis, an export) in words: "Under a minute", "About a minute", "About N minutes". */
export function waitWords(seconds: number): string {
  if (seconds < 60) return "Under a minute";
  if (seconds < 90) return "About a minute";
  return `About ${Math.round(seconds / 60)} minutes`;
}

/**
 * The upload line's words for a measured time left (R3). An upload's time is measured, so under a minute it is said in
 * seconds: "20 seconds left", to the nearest five and never fewer than five; from 55 s "About a minute left"; from 90 s
 * "About N minutes left", never fewer than two.
 */
export function leftWords(seconds: number): string {
  if (seconds < 55) return `${Math.max(5, Math.round(seconds / 5) * 5)} seconds left`;
  if (seconds < 90) return "About a minute left";
  return `About ${Math.max(2, Math.round(seconds / 60))} minutes left`;
}

/** What an upload had sent, and when (ms). */
export interface Sample {
  at: number;
  sent: number;
}

/** How far back the upload's rate is measured: a connection that speeds up or slows down is followed. */
export const RATE_WINDOW_MS = 8000;

/**
 * The upload's seconds left: what is left, at the rate measured over the last `RATE_WINDOW_MS`; 0 once all is sent; null
 * until a second of it has been measured. Where the newest sample is alone in the window (reports further apart than the
 * window), the rate is measured from the sample before it.
 */
export function uploadSecondsLeft(samples: readonly Sample[], total: number): number | null {
  const last = samples.at(-1);
  if (!last) return null;
  if (last.sent >= total) return 0;
  const first = samples.findIndex((sample) => sample.at >= last.at - RATE_WINDOW_MS);
  const from = samples[first === samples.length - 1 ? first - 1 : first];
  if (!from) return null; // one sample only: no rate yet
  const ms = last.at - from.at;
  const bytes = last.sent - from.sent;
  if (ms < 1000 || bytes <= 0) return null;
  return Math.ceil(((total - last.sent) / bytes) * (ms / 1000));
}
