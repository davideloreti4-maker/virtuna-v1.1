/**
 * time.ts — how an edit counts time.
 *
 * A stretch of a file is stored in whole milliseconds, exactly as it was asked for. The film is
 * counted in whole frames at 30 a second, and the frames are worked out, never stored: a moment
 * falls on the frame nearest to it.
 */
export const FPS = 30;
/** The shortest shot, in frames. */
export const MIN_FRAMES = 3;
/** The longest film: three minutes. */
export const MAX_FRAMES = 5400;
/** The shortest mark, in milliseconds. */
export const MIN_MARK_MS = 100;

/**
 * The frame a moment falls on, counted from where its footage starts: `ms` of file after that
 * start, at a playback speed. Negative for a moment before the start.
 */
export function frameAt(ms: number, speed: number): number {
  return Math.round((ms * FPS) / (1000 * speed));
}

/** How much of a file, in milliseconds, `frames` of film cover at a playback speed. Not rounded. */
export function msOf(frames: number, speed: number): number {
  return (frames * 1000 * speed) / FPS;
}
