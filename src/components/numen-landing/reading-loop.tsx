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
  const STAGES = [
    // 1 — the real creator keyframe (the content-as-hero artifact).
    <div key="keyframe" className="overflow-hidden rounded-[12px] border border-border">
      <Image
        src={heroKeyframe}
        alt="A real Reading of a creator video showing an honest 'likely to land' verdict and why."
        placeholder="blur"
        preload
        className="h-auto w-full"
        sizes="(min-width: 768px) 768px, 100vw"
      />
    </div>,
    // 2 — a real stage-read excerpt line about *their* video (VOICE-clean, no jargon).
    <p
      key="read"
      className="text-sm leading-relaxed text-text-muted md:text-base"
    >
      Watching how the first seconds land for your audience…
    </p>,
    // 3 — the verdict throne (band + one-line why, no naked number).
    <VerdictThrone key="verdict" />,
  ];

  // HERO-04 HARD: under reduced motion, paint the full end-state immediately.
  const [revealed, setRevealed] = useState(reduce ? STAGES.length : 0);

  useEffect(() => {
    if (reduce) return; // HARD: no interval — completed end-state already painted.

    let i = 0;
    let id: ReturnType<typeof setTimeout>;

    const advance = () => {
      i = i + 1;
      if (i > STAGES.length) i = 0; // reset → calm replay
      setRevealed(i);
      // Dwell longer once the verdict throne is the final revealed stage.
      const delay = i >= STAGES.length ? VERDICT_DWELL_MS : STEP_MS;
      id = setTimeout(advance, delay);
    };

    id = setTimeout(advance, STEP_MS);
    return () => clearTimeout(id);
    // STAGES.length is a stable constant for the lifetime of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  return (
    <div className={className}>
      {/* Reserve height before paint (Pitfall 4 — zero CLS). The real still is
          vertical 9:16; the framed artifact holds a calm landscape ratio so the
          stacked stages have room without layout shift. */}
      <div className="mx-auto flex max-w-md flex-col gap-4">
        {STAGES.map((stage, idx) => (
          <StageBlock key={idx} show={reduce ? true : idx < revealed}>
            {stage}
          </StageBlock>
        ))}
      </div>
    </div>
  );
}
