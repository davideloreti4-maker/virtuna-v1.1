/**
 * time.ts — how an edit counts time.
 *
 * On the film, positions and lengths are whole FRAMES at 30 frames/s. Inside a source file they
 * are whole MILLISECONDS. OpenFilm writes film times in milliseconds and puts a clip on from the
 * first frame AT OR AFTER its start, so a frame's time is FLOORED to the millisecond, never
 * rounded: frame 56 is 1866.67 ms; written as 1867 the cut lands on frame 57 (measured
 * 2026-11-11: 5 of 10 cuts one frame late).
 *
 * Spec: docs/superpowers/specs/2026-11-11-edit-format-design.md §2 (R1 to R3).
 */
export const FPS = 30;
/** The shortest clip an edit may hold, in frames. */
export const MIN_LEN = 3;
/** The longest film: 10 minutes, TikTok's API limit. */
export const MAX_FRAMES = 18_000;

/** A frame's time on the film in whole milliseconds, floored (R2). */
export function frameMs(frame: number): number {
  return Math.floor((frame * 1000) / FPS);
}

/** How long the frames [start, start + len) last on the film, in milliseconds. */
export function spanMs(start: number, len: number): number {
  return frameMs(start + len) - frameMs(start);
}

/** The source milliseconds a clip over those frames uses at a speed, floored so it never overruns (R3). */
export function sourceMs(start: number, len: number, speed: number): number {
  return Math.floor(spanMs(start, len) * speed);
}

/** Milliseconds as film.html writes seconds: at most three decimals, no trailing zeros. */
export function sec(ms: number): string {
  return String(Number((ms / 1000).toFixed(3)));
}
