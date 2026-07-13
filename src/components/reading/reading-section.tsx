'use client';

import type { ReactNode, ReactElement } from 'react';

// ReadingSection — the shared "quiet uppercase label over a contained card" unit
// the redesigned Reading is built from (hero v6 / audience-orbit sketches, LOCKED
// 2026-06-15). Every block on /analyze/[id] is one of these: a muted section label
// (The read · Score drivers · Your audience · Audience & context) above a single
// flat-warm surface card. Children own their internal padding so the same wrapper
// fits the scorecard, the orbit, and the accordion rows.

export interface ReadingSectionProps {
  /** Quiet uppercase section label rendered above the card. */
  label: string;
  /** Optional inline element rendered after the label (e.g. "powered by SIM-1 Max" tag). */
  labelSuffix?: ReactElement;
  /** Wrap children in the standard surface card (default). Pass false to render
   *  the children bare under the label. */
  card?: boolean;
  className?: string;
  children: ReactNode;
}

/** The flat-warm surface card: #1a1a19 surface, 6% hairline, 16px radius (--radius-xl). */
export const READING_CARD =
  'overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]';

export function ReadingSection({ label, labelSuffix, card = true, className, children }: ReadingSectionProps) {
  return (
    <section className={className}>
      <p className="mb-[11px] ml-0.5 flex items-center text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
        {label}
        {labelSuffix}
      </p>
      {card ? <div className={READING_CARD}>{children}</div> : children}
    </section>
  );
}

ReadingSection.displayName = 'ReadingSection';
