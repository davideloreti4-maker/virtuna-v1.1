'use client';

import type { ReactNode } from 'react';

// ReadingSection — the shared "quiet uppercase label over a contained card" unit
// the redesigned Reading is built from (hero v6 / audience-orbit sketches, LOCKED
// 2026-06-15). Every block on /analyze/[id] is one of these: a muted section label
// (The read · Score drivers · Your audience · Audience & context) above a single
// flat-warm surface card. Children own their internal padding so the same wrapper
// fits the scorecard, the orbit, and the accordion rows.

export interface ReadingSectionProps {
  /** Quiet uppercase section label rendered above the card. */
  label: string;
  /** Wrap children in the standard surface card (default). Pass false to render
   *  the children bare under the label. */
  card?: boolean;
  className?: string;
  children: ReactNode;
}

/** The flat-warm surface card: #1e1d1b surface, 6% hairline, 18px radius. */
export const READING_CARD =
  'overflow-hidden rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)]';

export function ReadingSection({ label, card = true, className, children }: ReadingSectionProps) {
  return (
    <section className={className}>
      <p className="mb-[11px] ml-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
        {label}
      </p>
      {card ? <div className={READING_CARD}>{children}</div> : children}
    </section>
  );
}

ReadingSection.displayName = 'ReadingSection';
