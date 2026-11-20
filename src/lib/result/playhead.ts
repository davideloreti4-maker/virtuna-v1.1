import type { Scene } from "./types";

/**
 * The shared playhead of the result page, as plain rules. `PlayheadProvider`
 * (src/components/result/playhead.tsx) holds the state and drives the video with them.
 *
 * At rest the playhead sits at the clip's end and the gauge is the number; nothing reads a value
 * off the line. Pressing play starts from 0:00.
 */
export interface PlayheadState {
  /** Seconds, 0 to the clip's length. */
  t: number;
  playing: boolean;
}

export function restingAt(clipS: number): PlayheadState {
  return { t: clipS, playing: false };
}

export function isResting(state: PlayheadState, clipS: number): boolean {
  return !state.playing && state.t >= clipS;
}

/**
 * Where an arrow key moves the playhead: scene by scene.
 *  - right: the start of the next scene; from the last scene, the clip's end (rest).
 *  - left: the start of the scene under `t` when `t` is inside it, else the start of the one
 *    before; from rest, the start of the last scene.
 */
export function stepScene(scenes: readonly Scene[], t: number, dir: -1 | 1, clipS: number): number {
  // Counted in scene STARTS rather than scene indexes, so a scene of no length cannot trap a step.
  const starts = scenes.map((scene) => scene.t0);
  if (dir === 1) {
    const next = starts.filter((start) => start > t && start < clipS);
    return next.length > 0 ? Math.min(...next) : clipS;
  }
  const before = starts.filter((start) => start < Math.min(t, clipS));
  return before.length > 0 ? Math.max(...before) : 0;
}
