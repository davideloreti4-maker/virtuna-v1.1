'use client';

/**
 * SkillResultCard — bounded output frame for a grid-shaped skill result (Explore's
 * outlier grid). Header follows THE CARD CONTRACT (§0.5): a quiet <CardEyebrow> (skill
 * kicker + audience meta) with an optional framing hero line stating what was found — so
 * the result reads finding-first, not as an unlabelled grid under a `text-xs` caption.
 * Matches the thread-card chrome (12px radius, 6% border).
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SkillResultCardProps {
  /**
   * The framing hero — the payoff of the result, e.g. "12 outliers, scored for your
   * audience" (§0.5.2, the deliverable reads first). Omit ⇒ no header (bare grid).
   */
  hero?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SkillResultCard({ hero, children, className }: SkillResultCardProps) {
  return (
    <div
      className={cn(
        // bg-surface-sunken (#1a1a19) is the one in-thread card fill — every sibling thread card
        // (hook/script/remix/idea/video-test/text-read) uses it. Was bg-surface-thread (#252524),
        // which read a shade lighter/lifted than the rest and made Explore look like a different card.
        'min-w-0 overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken',
        className,
      )}
    >
      {/* The card opens on the hero (the payoff) — the skill kicker + audience eyebrow was removed
          2026-07-21: in-thread the run capsule above already names the skill + audience, so the
          eyebrow was pure restatement. */}
      {hero && (
        <header className="border-b border-white/[0.06] px-4 py-3">
          <p className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
            {hero}
          </p>
        </header>
      )}
      <div className="min-w-0 overflow-x-auto p-4">{children}</div>
    </div>
  );
}
