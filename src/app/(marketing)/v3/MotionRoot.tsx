'use client';

import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Page-root MotionConfig wrapper for Landing v1 (FOUND-09 / UI-SPEC § MotionConfig Root Contract).
 *
 * `reducedMotion="user"` makes motion/react read the OS prefers-reduced-motion media query
 * automatically — a single kill-switch for all motion/react-powered animations on the landing.
 *
 * Import path is `motion/react` (NOT `framer-motion`), per PITFALLS.md Pitfall 1 and the
 * pnpm.overrides alias set in Plan 01.
 */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
