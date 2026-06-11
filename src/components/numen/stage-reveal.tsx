"use client";

/**
 * stage-reveal.tsx — DS-07 the ONE key motion moment of the Numen kit.
 *
 * Each completed engine stage's block materializes via:
 *   - opacity: a calm TWEEN (cubic-bezier(0.215, 0.61, 0.355, 1) — the
 *     `--numen-ease-calm` token in globals.css), and
 *   - translate: a high-damping SPRING (damping 30 / stiffness 220 → damping
 *     ratio ≥ 1 → critically/over-damped → NO overshoot, NO bounce).
 *
 * NEVER uses the forbidden bouncy `--ease-spring` token (an overshooting
 * cubic-bezier whose control point exceeds 1), which §6 of the UI spec forbids.
 *
 * Accessibility (D-14, hard requirement): when `useReducedMotion()` is true the
 * reveal degrades to a STATIC opacity appear with NO translate/slide (the `y`
 * is zeroed and its transition duration is 0). This is asserted by
 * tests/numen/stage-reveal.test.ts and mitigates the vestibular-motion threat
 * (T-03-01) in the plan's threat register.
 *
 * This is the SINGLE load-bearing motion of the product — Phase 4's Reading
 * reveal builds on it. Do NOT add presence/entrance theater to other primitives.
 *
 * Built on `motion` (not framer-motion) per D-10. Import path verified:
 * `import { AnimatePresence, motion, useReducedMotion } from "motion/react"`.
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/** Calm tween easing for opacity — mirrors the `--numen-ease-calm` token. */
const NUMEN_EASE_CALM = [0.215, 0.61, 0.355, 1] as const;

export interface StageBlockProps {
  /** When true, the stage block is present and reveals; false animates it out. */
  show: boolean;
  children: React.ReactNode;
}

/**
 * StageBlock — reveals a completed engine stage's block (DS-07).
 *
 * @example
 * ```tsx
 * <StageBlock show={stage.done}>
 *   <StageContent stage={stage} />
 * </StageBlock>
 * ```
 */
export function StageBlock({ show, children }: StageBlockProps) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 12 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: {
              // opacity = calm tween (base tier ~400ms)
              opacity: { duration: 0.4, ease: NUMEN_EASE_CALM },
              // translate = high-damping spring (ratio ≥ 1 → no overshoot);
              // reduced-motion zeroes it → static opacity appear (D-14).
              y: reduce
                ? { duration: 0 }
                : { type: "spring", stiffness: 220, damping: 30 },
            },
          }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
