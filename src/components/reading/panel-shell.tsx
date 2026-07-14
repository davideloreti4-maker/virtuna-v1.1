'use client';

import { READING_LABEL } from './reading-section';
import type { ReactNode } from 'react';

// PanelShell — the shared inline template every accordion drill-down wraps in
// (UX rework 2026-06-15, "Instrument + legend"). Gives each expanded panel a
// consistent rhythm: a one-line "what this measures" subtitle (plain language,
// muted) → the instrument body → an optional tiny legend keyed to its colors.
//
// Deliberately NO title — the accordion row IS the title. And NO advice/verdict
// prose (D-15): the subtitle states what the panel SHOWS, never what to do.

export interface PanelShellProps {
  /** One-line "what this measures". Plain, muted, descriptive — never advice. */
  subtitle?: string;
  /** Tiny color key rendered at the foot (e.g. coral = drops first). */
  legend?: ReactNode;
  /** Optional caps section label rows live under (used by multi-section panels). */
  children: ReactNode;
}

export function PanelShell({ subtitle, legend, children }: PanelShellProps) {
  return (
    <div className="flex flex-col gap-3 pt-1">
      {subtitle && (
        <p className="text-[12px] leading-snug text-foreground-muted">{subtitle}</p>
      )}
      {children}
      {legend && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] text-foreground-muted">
          {legend}
        </div>
      )}
    </div>
  );
}

/** One legend entry: a colored dot + its meaning. Colors come from THEME-06. */
export function LegendKey({
  tone,
  children,
}: {
  tone: 'accent' | 'cream' | 'amber';
  children: ReactNode;
}) {
  const color =
    tone === 'accent'
      ? 'var(--color-cream-secondary)'
      : tone === 'amber'
        ? 'var(--color-warning)'
        : 'rgba(236, 231, 222, 0.5)';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

/** A captioned section within a multi-part panel (e.g. Retention's 3 visuals).
 *  Caps label → the visual, with consistent vertical rhythm. */
export function PanelSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className={READING_LABEL}>
        {label}
      </h4>
      {children}
    </section>
  );
}

/** Calm per-block degrade (D-13): never an empty SVG / table / fabricated 0. Lives
 *  here (the shell layer) so any panel — including the retention scrubber — can use
 *  it without a circular import back through reading-panels. */
export function PanelEmpty() {
  return <p className="pt-2 text-[13px] text-foreground-muted">Not available for this read.</p>;
}
