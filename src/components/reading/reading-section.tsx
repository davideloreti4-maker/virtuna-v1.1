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

/**
 * READING_LABEL — the ONE section-label type stack for /analyze (2026-07-14).
 *
 * `text-[11px] uppercase tracking-[0.05em] text-foreground-muted` — the card contract's §0.5
 * "Type + geometry" rule, verbatim. The 10px/0.14em it replaces is the OLD stack the contract
 * explicitly names as dead.
 *
 * Why a shared constant and not just a fixed <ReadingSection>: a browser sweep of the rendered
 * surface (2026-07-14) found **eight** independent uppercase-label declarations across eight
 * files in `reading/**`, in FIVE different type stacks — 10px/0.14em, 10px/0.1em, 11px/0.08em,
 * 9.5px/0.11em (in a MONO face), 9px/0.1em — and not one of them was the contract's. Fixing
 * ReadingSection alone would have fixed one of eight and left the ladder standing, which is
 * exactly how it got to five in the first place: every block was built alone with nothing to
 * conform to. `reading-labels.test.ts` now fails the build on a sixth.
 */
export const READING_LABEL =
  'text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted';

export function ReadingSection({ label, labelSuffix, card = true, className, children }: ReadingSectionProps) {
  return (
    <section className={className}>
      <p className={`mb-[11px] ml-0.5 flex items-center ${READING_LABEL}`}>
        {label}
        {labelSuffix}
      </p>
      {card ? <div className={READING_CARD}>{children}</div> : children}
    </section>
  );
}

ReadingSection.displayName = 'ReadingSection';
