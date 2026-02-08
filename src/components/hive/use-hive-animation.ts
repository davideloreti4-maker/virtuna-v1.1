'use client';

// ---------------------------------------------------------------------------
// use-hive-animation.ts -- Progressive build animation for hive tiers
// ---------------------------------------------------------------------------

import { useEffect, useRef } from 'react';

import { ANIMATION_TIMING } from './hive-constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TierVisibility {
  opacity: number;
  scale: number;
}

interface UseHiveAnimationOptions {
  /** Whether the animation should be active (e.g. layout is available). */
  active: boolean;
  /** Skip animation and show all tiers at full visibility. */
  reducedMotion: boolean;
  /** Callback to trigger a canvas redraw on each animation frame. */
  onFrame: () => void;
}

interface UseHiveAnimationResult {
  /** Current per-tier visibility. Read synchronously from a ref -- always current. */
  readonly visibility: Record<number, TierVisibility>;
  /** Whether the animation loop is currently running. */
  readonly isAnimating: boolean;
  /** Whether the animation has finished (all tiers fully visible). */
  readonly isComplete: boolean;
}

// ---------------------------------------------------------------------------
// Module-level state (persists across re-mounts, resets on page navigation)
// ---------------------------------------------------------------------------

/** Prevents animation from replaying after initial load. */
let globalAnimationComplete = false;

/**
 * Reset the global animation flag so the next mount triggers the build animation.
 * Used by the preview page to allow replaying the animation.
 */
export function resetGlobalAnimation(): void {
  globalAnimationComplete = false;
}

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ---------------------------------------------------------------------------
// Full visibility constant
// ---------------------------------------------------------------------------

const FULL_VISIBILITY: Record<number, TierVisibility> = {
  0: { opacity: 1, scale: 1 },
  1: { opacity: 1, scale: 1 },
  2: { opacity: 1, scale: 1 },
  3: { opacity: 1, scale: 1 },
};

const ZERO_VISIBILITY: Record<number, TierVisibility> = {
  0: { opacity: 0, scale: 0 },
  1: { opacity: 0, scale: 0 },
  2: { opacity: 0, scale: 0 },
  3: { opacity: 0, scale: 0 },
};

// ---------------------------------------------------------------------------
// Tier timing lookup (map tier index to ANIMATION_TIMING keys)
// ---------------------------------------------------------------------------

const TIER_TIMING: Array<{ delay: number; duration: number }> = [
  ANIMATION_TIMING.center,
  ANIMATION_TIMING.tier1,
  ANIMATION_TIMING.tier2,
  ANIMATION_TIMING.tier3,
];

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages a progressive build animation for the hive visualization.
 *
 * Computes per-tier visibility (opacity + scale) over time using
 * requestAnimationFrame. Calls `onFrame` on each tick so the parent
 * component can redraw the canvas without React re-renders.
 *
 * When `reducedMotion` is true, all tiers are immediately fully visible.
 * Animation plays only once on initial render (module-level flag).
 */
export function useHiveAnimation(
  options: UseHiveAnimationOptions,
): UseHiveAnimationResult {
  const { active, reducedMotion, onFrame } = options;

  // Internal mutable state -- NOT React state (avoids per-frame re-renders)
  const visibilityRef = useRef<Record<number, TierVisibility>>(
    globalAnimationComplete || reducedMotion
      ? { ...FULL_VISIBILITY }
      : { ...ZERO_VISIBILITY },
  );
  const isAnimatingRef = useRef(false);
  const isCompleteRef = useRef(globalAnimationComplete);
  const rafIdRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  // Keep latest onFrame in a ref to avoid re-creating the effect
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  useEffect(() => {
    // Reduced motion: show everything immediately
    if (reducedMotion) {
      visibilityRef.current = { ...FULL_VISIBILITY };
      isCompleteRef.current = true;
      isAnimatingRef.current = false;
      globalAnimationComplete = true;
      onFrameRef.current();
      return;
    }

    // Already completed globally: show everything
    if (globalAnimationComplete) {
      visibilityRef.current = { ...FULL_VISIBILITY };
      isCompleteRef.current = true;
      isAnimatingRef.current = false;
      onFrameRef.current();
      return;
    }

    // Not active yet (no layout): do nothing
    if (!active) return;

    // Start animation
    startTimeRef.current = performance.now();
    isAnimatingRef.current = true;

    function tick(now: number): void {
      const elapsed = now - startTimeRef.current;
      let allComplete = true;

      for (let tier = 0; tier < TIER_TIMING.length; tier++) {
        const timing = TIER_TIMING[tier]!;
        const end = timing.delay + timing.duration;

        if (elapsed < timing.delay) {
          // Not started yet
          visibilityRef.current[tier] = { opacity: 0, scale: 0 };
          allComplete = false;
        } else if (elapsed >= end) {
          // Fully visible
          visibilityRef.current[tier] = { opacity: 1, scale: 1 };
        } else {
          // In progress
          const progress = (elapsed - timing.delay) / timing.duration;
          const eased = easeOutCubic(progress);
          visibilityRef.current[tier] = {
            opacity: eased,
            scale: 0.5 + eased * 0.5,
          };
          allComplete = false;
        }
      }

      // Trigger canvas redraw
      onFrameRef.current();

      if (allComplete) {
        isAnimatingRef.current = false;
        isCompleteRef.current = true;
        globalAnimationComplete = true;
        return;
      }

      rafIdRef.current = requestAnimationFrame(tick);
    }

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [active, reducedMotion]);

  // Return a stable object with getters reading from refs
  const resultRef = useRef<UseHiveAnimationResult>(null);
  if (resultRef.current === null) {
    resultRef.current = {
      get visibility() {
        return visibilityRef.current;
      },
      get isAnimating() {
        return isAnimatingRef.current;
      },
      get isComplete() {
        return isCompleteRef.current;
      },
    };
  }

  return resultRef.current;
}
