"use client";

import { MotionConfig } from "motion/react";

export interface MotionConfigShellProps {
  children: React.ReactNode;
}

/**
 * Global motion boundary for the landing tree (FOUND-04, CONTEXT D-17 layer 1).
 *
 * Wraps the marketing subtree in `<MotionConfig reducedMotion="user">` so that
 * EVERY descendant `motion.*` element automatically respects the OS
 * `prefers-reduced-motion` setting: transform/layout animations are disabled
 * under reduce while opacity/color are preserved (a calm, non-jarring fallback).
 *
 * This is the two-layer reduced-motion strategy's first layer. It COMPLEMENTS —
 * does not replace — the `motion/*` wrappers' own `useReducedMotion()`
 * self-gating, and pairs with the CSS `@media (prefers-reduced-motion: reduce)`
 * block in `globals.css` (layer 2) that covers the NON-Framer animations
 * (skeleton-breathe, shimmer, marquee) which `MotionConfig` cannot reach.
 *
 * Marked `"use client"` because `MotionConfig` uses React context. The page
 * that mounts it stays a server component; only this boundary is client.
 */
export function MotionConfigShell({ children }: MotionConfigShellProps) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
