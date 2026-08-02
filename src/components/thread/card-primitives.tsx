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
 *   - <CardHero>          THE HEADER CONTRACT — the one opening row every card wears
 *   - <CopyAffordance>    the one-tap copy button (was hand-rolled three times)
 *   - <CardPrimaryAction> §0.5.7 — the ONE cream forward-chain button (was 7 copies of a
 *                         200-char class string, each drifting by a `transition-*` / `disabled:*`)
 *   - <CardActionBar>     §0.5.7 — the footer row: primary first, Save as an ml-auto icon
 *   - SECTION_LABEL       §0.5 "Type + geometry" — the canonical 11px/0.05em label className
 *
 * Guarded by section-label-scale.test.ts (the label idiom) + radius-scale.test.ts (corners).
 */

import { useState, type ReactNode } from 'react';
import { Copy, Check } from '@phosphor-icons/react';
import Link from 'next/link';

/**
 * THE canonical section-label className (§0.5 "Type + geometry"):
 * `text-caption uppercase tracking-[0.05em] text-foreground-muted`. Use for every sub-label
 * inside a card (e.g. "Posts we read", "Recurring hooks") so the whole app runs one stack —
 * NOT 0.06em, not 10px, not a mono face. The section-label guard enforces it.
 */
export const SECTION_LABEL =
  'text-caption uppercase tracking-[0.05em] text-foreground-muted';

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
 * CardHero — THE HEADER CONTRACT (2026-08-02). Every actively-generating card opens with the
 * SAME row, so a thread of mixed cards reads as one system.
 *
 * The owner flagged five cards opening five different ways: the hook led with `#N · serif line ·
 * Copy`, the idea with a bare serif title, the script with an uppercase meta strip, the remix
 * with its source zone (its own serif deliverable buried mid-map), the Test card with a label
 * strip. The fix is a PRIMITIVE, not five hand-rolled rows — the same move that stopped the FEET
 * drifting (<CardActionBar>).
 *
 * The row: an optional left gutter meta (the hook's rank), the SERIF hero — the card's authored
 * deliverable, set in Newsreader, the brand's voice-moment face, at 21px — and an optional right
 * affordance (usually <CopyAffordance>). Baseline-aligned so the gutter numeral and the Copy
 * label sit on the hero's first-line baseline.
 *
 * The serif is deliberate and load-bearing: it is the one place the design system sanctions a
 * voice-moment face, and it is what marks "this line is the thing you take away" versus the
 * Inter chrome around it. A card with no authored line has NOTHING to hero — it must keep its
 * eyebrow rather than fabricate a voice (the video Test card is that sanctioned exception).
 */
export function CardHero({
  gutter,
  children,
  affordance,
  as: Tag = 'p',
  className,
}: {
  /** Optional left-gutter meta — the hook's `#N` rank. Omit ⇒ the hero starts at the edge. */
  gutter?: ReactNode;
  /** The hero line itself (the authored deliverable). */
  children: ReactNode;
  /** Optional right-pinned affordance — <CopyAffordance> on every card that ships a liftable line. */
  affordance?: ReactNode;
  /** `h3` for a card whose hero is a genuine TITLE (the idea brief); `p` for a quoted line. */
  as?: 'p' | 'h3';
  className?: string;
}) {
  return (
    <div className={`flex items-baseline gap-3${className ? ` ${className}` : ''}`}>
      {gutter != null && (
        <span className="shrink-0 text-label font-semibold tabular-nums text-foreground-muted">
          {gutter}
        </span>
      )}
      <Tag className="min-w-0 flex-1 font-serif text-heading font-medium leading-[1.3] tracking-[-0.005em] text-foreground">
        {children}
      </Tag>
      {affordance != null && <span className="shrink-0">{affordance}</span>}
    </div>
  );
}

/**
 * CopyAffordance — the one-tap copy button. A card's hero is a line the creator came here to
 * USE, so it ships with copy; this was hand-rolled three times (hook line, script beat sheet,
 * remix adapted hook) and each copy was free to drift.
 *
 * The visible label stays "Copy" everywhere — the header row is uniform by design; WHAT gets
 * copied is carried by `aria-label`, not by five different button words. Flips to `Check +
 * Copied` for 1600ms. The clipboard call is guarded: `navigator.clipboard` is absent in the
 * happy-dom test env, and an unguarded read throws there.
 */
export function CopyAffordance({
  text,
  'aria-label': ariaLabel,
  className,
}: {
  /** The exact string written to the clipboard. */
  text: string;
  /** Names what is copied ("Copy the full script to clipboard") — the visible label is just "Copy". */
  'aria-label': string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => {},
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={ariaLabel}
      className={`inline-flex shrink-0 items-center gap-1 text-label font-medium text-foreground-muted transition-colors hover:text-foreground-secondary${className ? ` ${className}` : ''}`}
    >
      {copied ? (
        <>
          <Check size={13} weight="bold" aria-hidden="true" />
          Copied
        </>
      ) : (
        <>
          <Copy size={13} aria-hidden="true" />
          Copy
        </>
      )}
    </button>
  );
}

/**
 * CardPrimaryAction — §0.5.7, the ONE forward-chain button. One definition for the whole thread
 * so `Write the script →`, `Write hooks for this →`, `Predict an outcome →`, `Simulate with your
 * audience →` are identical.
 *
 * Restyled 2026-07-22 (owner: "not a fan of all the white buttons"): the loud CREAM fill
 * (`--color-action`, #ece7de) is retired here for a quiet MATTE tonal button — a soft raised
 * surface (white 5% fill · hairline border · cream text + arrow) that reads clearly as "the next
 * step" without a bright block on every stacked card. It sits one tonal step above the ghost
 * secondary chip (white 2%) so the primary still wins the glance. NOTE: only the in-thread cards
 * change — the global `--color-action` cream stays as-is for calendar/discover/feed CTAs, which
 * the owner did not flag. `disabled` dims to 40%. Extra `className` appends (e.g. `w-full`,
 * `shrink-0` for an inline submit beside an input).
 */
export function CardPrimaryAction({
  children,
  onClick,
  disabled,
  type = 'button',
  href,
  className,
  'aria-label': ariaLabel,
  'data-testid': dataTestid,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  /** Render as a <Link> instead of a <button> — a primary that navigates (e.g. the Test
   *  card's "See the full breakdown →" door). Mutually exclusive with onClick/disabled. */
  href?: string;
  className?: string;
  'aria-label'?: string;
  'data-testid'?: string;
  title?: string;
}) {
  const cls =
    'inline-flex items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.05] px-3.5 py-2 text-body font-semibold text-foreground transition-colors hover:border-white/[0.12] hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/15 disabled:cursor-default disabled:opacity-40 disabled:hover:border-white/[0.08] disabled:hover:bg-white/[0.05]' +
    (className ? ` ${className}` : '');

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} data-testid={dataTestid} title={title} className={cls}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      data-testid={dataTestid}
      title={title}
      className={cls}
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
      className={`flex items-center gap-3.5 border-t border-white/[0.06] px-4 py-2.5${className ? ` ${className}` : ''}`}
    >
      {children}
    </div>
  );
}
