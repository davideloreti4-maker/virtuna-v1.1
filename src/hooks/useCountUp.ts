"use client";

import { useEffect, useRef, useState } from "react";

interface UseCountUpOptions {
  /** Target number to count up to */
  end: number;
  /** Animation duration in ms (default: 2000) */
  duration?: number;
  /** Suffix appended to the displayed value (e.g., "K+", "M+", "%") */
  suffix?: string;
  /** Prefix prepended to the displayed value (e.g., "$") */
  prefix?: string;
}

/**
 * Hook that animates a number counting up from 0 to `end` when the
 * attached ref enters the viewport. Fires once. Respects
 * prefers-reduced-motion by showing the final value immediately.
 *
 * Returns `{ ref, display }` — attach `ref` to the DOM element that
 * should trigger the animation, and render `display` as the formatted string.
 */
export function useCountUp({
  end,
  duration = 2000,
  suffix = "",
  prefix = "",
}: UseCountUpOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Respect prefers-reduced-motion
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReduced) {
      // Show final value immediately — no animation
      hasAnimated.current = true;
      // Use rAF to avoid direct setState in effect body (lint rule)
      requestAnimationFrame(() => setCurrent(end));
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          observer.disconnect();

          const startTime = performance.now();

          function animate(now: number) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic for a natural deceleration
            const eased = 1 - Math.pow(1 - progress, 3);
            setCurrent(Math.round(eased * end));

            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          }

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [end, duration]);

  const display = `${prefix}${current.toLocaleString()}${suffix}`;

  return { ref, display };
}
