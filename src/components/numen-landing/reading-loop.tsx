"use client";

import { useEffect, useState } from "react";

import Image from "next/image";
import { useReducedMotion } from "motion/react";

import { StageBlock } from "@/components/numen/stage-reveal";
import { VerdictThrone } from "@/components/numen-landing/verdict-throne";
import heroKeyframe from "@/../public/images/landing/hero/keyframe.webp";

/**
 * ReadingLoop — HERO-02 / HERO-04, the load-bearing interaction of the phase.
 *
 * Replays one real captured Reading over the full-bleed creator keyframe as a
 * CALM auto-reveal loop (D-01, resolves D-L2): the keyframe paints, a real
 * stage-read line materializes, then the <VerdictThrone /> reveals and the loop
 * DWELLS on the verdict (≥ ~4s) before resetting and replaying. Each stage
 * materializes via `StageBlock` (the ONE key motion) — this controller only
 * toggles `show`; it owns NO easing curves (StageBlock owns the calm tween +
 * high-damping spring; the forbidden bouncy easing never appears here).
 *
 * HERO-04 / D-14 (HARD — vestibular safety, threat T-02-04): the controller is
 * SEPARATE code from StageBlock. StageBlock already zeroes translate under
 * reduced motion, but the controller must ALSO not auto-cycle: it initializes
 * `revealed` to the full stage count AND `return`s before any setInterval, so
 * the completed end-state (verdict throne label) paints directly at rest — no
 * interval, no flicker, no replay. Asserted by reading-loop.test.tsx mocking
 * `useReducedMotion => true`.
 *
 * Color by token NAME only — no hex in JSX. Renders inside the `.numen-surface`
 * scope mounted by the marketing layout; never portals out.
 */

// Reveal cadence. Non-verdict stages advance on STEP_MS; the verdict (final
// stage) DWELLS for VERDICT_DWELL_MS so a visitor reads the band + why before
// the loop quietly resets. Calm — no rapid cycling.
const STEP_MS = 2200;
const VERDICT_DWELL_MS = 4600;

export interface ReadingLoopProps {
  /** Layout override merged onto the full-bleed artifact wrapper. */
  className?: string;
}

export function ReadingLoop({ className }: ReadingLoopProps) {
  const reduce = useReducedMotion();

  // The three captured stages of the real Reading.
  // The keyframe is the always-present BASE layer — it paints on first render so
  // it is the fast LCP element (UI-SPEC LCP note: "Ship a poster/first-frame that
  // paints fast; the loop may hydrate after"). It is NOT a revealed stage.
  // Only the OVERLAY stages (the real stage-read line, then the verdict throne)
  // reveal in sequence over it via StageBlock.
  const OVERLAYS = [
    // 1 — a real stage-read excerpt line about *their* video (VOICE-clean, no jargon).
    <p
      key="read"
      className="text-sm leading-relaxed text-text-muted md:text-base"
    >
      Watching how the first seconds land for your audience…
    </p>,
    // 2 — the verdict throne (band + one-line why, no naked number).
    <VerdictThrone key="verdict" />,
  ];

  // HERO-04 HARD: under reduced motion, paint the full end-state immediately.
  const [revealed, setRevealed] = useState(reduce ? OVERLAYS.length : 0);

  useEffect(() => {
    if (reduce) return; // HARD: no interval — completed end-state already painted.

    let i = 0;
    let id: ReturnType<typeof setTimeout>;

    const advance = () => {
      i = i + 1;
      if (i > OVERLAYS.length) i = 0; // reset → calm replay
      setRevealed(i);
      // Dwell longer once the verdict throne is the final revealed overlay.
      const delay = i >= OVERLAYS.length ? VERDICT_DWELL_MS : STEP_MS;
      id = setTimeout(advance, delay);
    };

    id = setTimeout(advance, STEP_MS);
    return () => clearTimeout(id);
    // OVERLAYS.length is a stable constant for the lifetime of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  return (
    <div className={className}>
      <div className="mx-auto flex max-w-md flex-col gap-4">
        {/* Base layer — always present, paints first (LCP), reserves height (zero CLS). */}
        <div className="overflow-hidden rounded-[12px] border border-border">
          <Image
            src={heroKeyframe}
            alt="A real Reading of a creator video showing an honest 'likely to land' verdict and why."
            placeholder="blur"
            preload
            className="h-auto w-full"
            sizes="(min-width: 768px) 448px, 100vw"
          />
        </div>
        {/* Overlay stages reveal in sequence over the keyframe. */}
        {OVERLAYS.map((overlay, idx) => (
          <StageBlock key={idx} show={reduce ? true : idx < revealed}>
            {overlay}
          </StageBlock>
        ))}
      </div>
    </div>
  );
}
