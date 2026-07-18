'use client';

/**
 * Shared skill-card primitives — the written-down spine of THE CARD CONTRACT
 * (docs/subsystems/ui-skill-cards.md §0.5). Extracted 2026-07-18 during the full-sweep
 * polish pass, for the reason the SSOT names over and over: the cards drifted because each
 * was built alone with nothing to conform to. The hook card was the bar; everyone else
 * hand-rolled the eyebrow, the cream primary and the action bar and drifted a few px each.
 *
 * These are the shapes the cards now import instead of re-declaring:
 *   - <CardEyebrow>       §0.5.1 — the quiet kicker row (dot + uppercase label + right meta)
 *   - <CardPrimaryAction> §0.5.7 — the ONE cream forward-chain button (was 7 copies of a
 *                         200-char class string, each drifting by a `transition-*` / `disabled:*`)
 *   - <CardActionBar>     §0.5.7 — the footer row: primary first, Save as an ml-auto icon
 *   - SECTION_LABEL       §0.5 "Type + geometry" — the canonical 11px/0.05em label className
 *
 * Guarded by section-label-scale.test.ts (the label idiom) + radius-scale.test.ts (corners).
 */

import type { ReactNode } from 'react';

/**
 * THE canonical section-label className (§0.5 "Type + geometry"):
 * `text-[11px] uppercase tracking-[0.05em] text-foreground-muted`. Use for every sub-label
 * inside a card (e.g. "Posts we read", "Recurring hooks") so the whole app runs one stack —
 * NOT 0.06em, not 10px, not a mono face. The section-label guard enforces it.
 */
export const SECTION_LABEL =
  'text-[11px] uppercase tracking-[0.05em] text-foreground-muted';

/**
 * CardEyebrow — §0.5.1, the quiet kicker at the top of a card. An optional band-colored dot,
 * an uppercase kicker (the archetype / context — "who this is for", NOT provenance), and one
 * optional meta item pinned right (rank or trust tier). The hook card is the reference; this
 * is that eyebrow, once, so every card's kicker is pixel-identical.
 */
export function CardEyebrow({
  kicker,
  dotColor,
  meta,
  className,
}: {
  /** The uppercase kicker text/node (rendered inside the label span). */
  kicker: ReactNode;
  /** When set, a 6px dot in this color leads the kicker (the band tint). Omit ⇒ no dot. */
  dotColor?: string;
  /** One optional right-aligned meta item (rank "#1", a <TrustBadge>, a @handle). */
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3${className ? ` ${className}` : ''}`}>
      <span className={`flex items-center gap-1.5 ${SECTION_LABEL}`}>
        {dotColor && (
          <span
            className="h-[6px] w-[6px] shrink-0 rounded-full"
            style={{ backgroundColor: dotColor }}
            aria-hidden="true"
          />
        )}
        {kicker}
      </span>
      {meta != null && <span className="shrink-0">{meta}</span>}
    </div>
  );
}

/**
 * CardPrimaryAction — §0.5.7, the ONE cream forward-chain button (primary ≠ accent). One
 * definition for the whole thread so `Write script →`, `Develop into hooks →`, `Predict an
 * outcome →`, `Write to my strengths →` are identical. `disabled` dims to 40% (the cream
 * itself, never a grey swap). Extra `className` appends (e.g. `w-full` for a tile CTA).
 */
export function CardPrimaryAction({
  children,
  onClick,
  disabled,
  type = 'button',
  className,
  'aria-label': ariaLabel,
  'data-testid': dataTestid,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  'aria-label'?: string;
  'data-testid'?: string;
  title?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      data-testid={dataTestid}
      title={title}
      className={
        'rounded-md bg-[var(--color-action)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-action-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 disabled:cursor-default disabled:opacity-40' +
        (className ? ` ${className}` : '')
      }
    >
      {children}
    </button>
  );
}

/**
 * CardActionBar — §0.5.7, the card footer. A single row divided from the body: the forward
 * chain step first (the cream <CardPrimaryAction>), then Save as an ml-auto icon. Pass the
 * <SaveAffordance className="ml-auto"> as a child after the primary. Never stack Save above
 * the primary and never make Save its own row.
 */
export function CardActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3.5 border-t border-white/[0.06] px-4 py-3${className ? ` ${className}` : ''}`}
    >
      {children}
    </div>
  );
}
