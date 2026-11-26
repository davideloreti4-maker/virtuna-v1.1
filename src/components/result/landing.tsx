"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * The landing: a result that arrives while its running screen is open finishes building itself in
 * the wait's place. The count rolls from 1,000 to its value, the line draws itself, the named
 * stretch's coral and its band come in, then the fill and the ticks, and the dot once the line has
 * reached it; the strip's scenes come in where the wait's tiles stood; what lies outside the first
 * block fades in after it. Only for a result that
 * arrives from its run, and only with motion allowed: a result opened directly, or with reduced
 * motion, is all there at once.
 *
 * Opacity and the line's stroke only: an animated transform or filter on an ancestor of the pinned
 * compact player (position: fixed) would make it place itself against that ancestor, not the screen.
 */
const LandingContext = createContext(false);

/** Set by the result page around the result. */
export const LandingProvider = LandingContext.Provider;

/** True while the page's result is landing; false anywhere else. */
export function useLanding(): boolean {
  return useContext(LandingContext);
}

/**
 * Longer than every part of the landing (the longest, the fill, ends at 1.7 s), with room for a slow
 * first paint: when the window ends the classes leave, and a part still on its way would snap.
 */
export const LANDING_MS = 2500;

/**
 * `on`, for `LANDING_MS` after it turned on; then false, so a part mounted after that (the other layout after
 * a resize, the pinned player) shows at once and does not land again. Another arrival (the page kept
 * open across to another run) opens a new window.
 */
export function useLandingWindow(on: boolean): boolean {
  const [over, setOver] = useState(false);
  const [was, setWas] = useState(on);
  if (was !== on) {
    setWas(on);
    if (on) setOver(false);
  }
  useEffect(() => {
    if (!on || over) return;
    const timer = setTimeout(() => setOver(true), LANDING_MS);
    return () => clearTimeout(timer);
  }, [on, over]);
  return on && !over;
}

/** The landing's classes (keyframes `result-draw` and `result-fade` in globals.css), motion-safe only. */
export const LAND = {
  /** The line draws itself in 1.5 s (on a path with `pathLength` 1 and a dash of 1). */
  draw: "motion-safe:animate-[result-draw_1.5s_cubic-bezier(0.3,0.1,0.2,1)_both]",
  /** The named stretch's coral and its band, after 0.5 s. */
  coral: "motion-safe:animate-[result-fade_0.4s_ease-out_0.5s_both]",
  /** The fill under the line and the ticks, after 0.9 s. */
  fill: "motion-safe:animate-[result-fade_0.8s_ease-out_0.9s_both]",
  /** The dot at the line's end, once the line has reached it. */
  dot: "motion-safe:animate-[result-fade_0.3s_ease-out_1.2s_both]",
  /** The strip's scenes, at once, where the wait's tiles stood. */
  strip: "motion-safe:animate-[result-fade_0.5s_ease-out_both]",
  /** Everything outside the first block, after 0.9 s. */
  rest: "motion-safe:animate-[result-fade_0.5s_ease-out_0.9s_both]",
} as const;
