'use client';

/**
 * SkillResultCard — bounded output frame for home skill thread views (P0).
 *
 * Header: skill name + audience context. Body: overflow-contained payload.
 * Matches Reading card chrome (12px radius, 6% border).
 */

import { cn } from '@/lib/utils';

export interface SkillResultCardProps {
  skillLabel: string;
  audienceLabel: string;
  children: React.ReactNode;
  className?: string;
}

export function SkillResultCard({
  skillLabel,
  audienceLabel,
  children,
  className,
}: SkillResultCardProps) {
  return (
    <div
      className={cn(
        'min-w-0 overflow-hidden rounded-xl border border-white/[0.06] bg-surface-elevated',
        className,
      )}
    >
      <header className="border-b border-white/[0.06] px-4 py-3">
        <p className="text-xs text-foreground-muted">
          {skillLabel} · {audienceLabel}
        </p>
      </header>
      <div className="min-w-0 overflow-x-auto p-4">{children}</div>
    </div>
  );
}
