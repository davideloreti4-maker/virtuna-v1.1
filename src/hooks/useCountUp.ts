"use client";

import { useEffect } from "react";
import { useMotionValue, useTransform, animate } from "motion/react";
import type { MotionValue } from "motion/react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseCountUpOptions {
  /** Target value to count up to */
  to: number;
  /** Animation duration in seconds (default: 2) */
  duration?: number;
  /** Format function applied to the rounded value */
  format?: (value: number) => string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Animates a number from 0 to a target value with easeOut easing.
 *
 * Uses motion's `useMotionValue` + `useTransform` + `animate` to avoid
 * React re-renders on every animation frame.
 *
 * Respects `prefers-reduced-motion` -- when enabled, the value is set
 * immediately without animation via `count.jump(to)`.
 *
 * **IMPORTANT:** The returned value is a `MotionValue<string>`. It MUST be
 * rendered inside a `<motion.span>` (or other `motion.*` element), NOT a
 * regular `<span>`. Regular elements cannot subscribe to MotionValue updates
 * and will render "[object Object]" instead of the formatted number.
 *
 * @example
 * ```tsx
 * import { motion } from "motion/react";
 * import { useCountUp } from "@/hooks/useCountUp";
 * const formatCurrency = (n: number) =>
 *   new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
 *
 * function StatValue({ amount }: { amount: number }) {
 *   const display = useCountUp({ to: amount, format: formatCurrency });
 *   return <motion.span>{display}</motion.span>;
 * }
 * ```
 */
export function useCountUp({
  to,
  duration = 2,
  format,
}: UseCountUpOptions): MotionValue<string> {
  const prefersReducedMotion = usePrefersReducedMotion();
  const count = useMotionValue(0);
  const display = useTransform(count, (latest) => {
    const val = Math.round(latest);
    return format ? format(val) : val.toString();
  });

  useEffect(() => {
    if (prefersReducedMotion) {
      count.jump(to);
      return;
    }

    const animation = animate(count, to, {
      duration,
      ease: "easeOut",
    });

    return () => animation.stop();
  }, [to, duration, prefersReducedMotion, count]);

  return display;
}
