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
import { CardEyebrow } from './card-primitives';

export interface SkillResultCardProps {
  skillLabel: string;
  audienceLabel: string;
  /**
   * The framing hero — the payoff of the result, e.g. "12 outliers, scored for your
   * audience" (§0.5.2, the deliverable reads first). Omit ⇒ eyebrow-only header.
   */
  hero?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SkillResultCard({
  skillLabel,
  audienceLabel,
  hero,
  children,
  className,
}: SkillResultCardProps) {
  return (
    <div
      className={cn(
        'min-w-0 overflow-hidden rounded-xl border border-white/[0.06] bg-surface-thread',
        className,
      )}
    >
      <header className="flex flex-col gap-1.5 border-b border-white/[0.06] px-4 py-3">
        <CardEyebrow
          kicker={skillLabel}
          dotColor="var(--color-foreground-muted)"
          meta={<span className="text-[12px] text-foreground-muted">{audienceLabel}</span>}
        />
        {hero && (
          <p className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
            {hero}
          </p>
        )}
      </header>
      <div className="min-w-0 overflow-x-auto p-4">{children}</div>
    </div>
  );
}
