"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The answer card and its parts (spec §3 rules 1 and 2; drawing
 * `.scratch/next-look/part3/answers/answers.html`, `.card.tq-card`, `.tq-h`, `cta()` + `price()`):
 * ONE card per result, ONE ink primary per card with its price in the button's `em`.
 *
 * Geometry as drawn: the card is the surface at radius 24 (drawn 26; the scale's nearest), the
 * resting shadow that carries the hairline, padding 6 / 16 / 16 on a phone and 8 / 20 / 20 on a
 * desk. The header row is 10 / 2 / 8 around a 21 line, 13 / 540 in the secondary ink (drawn 12.5:
 * the type roles have no half pixel). The primary is the shared ink `Button` at its large size
 * (50 tall, radius 16, drawn 17; weight 640, drawn 650), the icon and label at the start 9 apart,
 * the price at the end as a pill 30 tall on 14% of the ink's text colour, 13 / 600 (drawn 13.5).
 */

/** The card (`.card.tq-card`). */
export function AnswerCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      data-answer="card"
      className={cn(
        "rounded-3xl bg-surface px-4 pb-4 pt-1.5 text-foreground shadow-[var(--shadow-rest)] md:px-5 md:pb-5 md:pt-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The row that holds the card's primary (`.tq-f`): 8 under the content on a phone, 20 on a desk.
 * The drawing's desktop 20 comes from its `.desk .cta { margin-top: 20px }` collapsing through
 * `.tq-f`; it is what the approved desktop renders show, so it is built.
 */
export function AnswerFoot({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 md:mt-5">{children}</div>;
}

/**
 * Prose in a card: proportional figures, and a hyphenated word kept on one line, as drawn.
 *
 * The new look sets every number tabular on `body`; in Inter that also widens the hyphen
 * ("3 - step"), and the drawing's prose is proportional (only its figures are tabular). A word
 * like "3-step" is never split over two lines in the drawing (`nob()`; its audit counts a split as
 * a fault); words longer than 24 characters may still break, so a long token cannot overflow.
 */
export const PROSE = "proportional-nums";

const HYPHENATED = /(\S+-\S+)/g;

export function keepHyphens(text: string): React.ReactNode {
  const parts = text.split(HYPHENATED);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 && part.length <= 24 ? (
      <span key={i} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/** The card's header row (`.tq-h`): what the numbers mean on the left, a quiet note on the right. */
export function CardHeader({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-0.5 pb-2 pt-2.5 text-meta font-[540] leading-[21px] text-foreground-secondary">
      <span>{left}</span>
      {right != null && <span className="tabular-nums">{right}</span>}
    </div>
  );
}

/** The drawing's arrow (`I.arrow`, stroke 2.2), at the end of a free primary. */
function ArrowGlyph() {
  return (
    <svg
      aria-hidden
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 opacity-70"
    >
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </svg>
  );
}

/** "N credits" (`price()`). */
export function creditsLabel(n: number): string {
  return `${n} credit${n === 1 ? "" : "s"}`;
}

/** Drawn `padding: 0 10px 0 18px`; with an arrow `0 16px 0 18px` (`CTA1`, `CTA2`). */
const PRIMARY = "w-full justify-between gap-3 px-0 pl-[18px] tracking-[-0.014em]";

/**
 * The card's one primary (`cta()`). A price makes it paid ("2 credits" in the `em`); a free one may
 * end on the arrow. A link with `href`, a button with `onClick`, and disabled with neither.
 */
export function AnswerPrimary({
  icon,
  label,
  price,
  onClick,
  href,
  trailingArrow = false,
}: {
  icon: React.ReactNode;
  label: string;
  price?: number;
  onClick?: () => void;
  href?: string;
  trailingArrow?: boolean;
}) {
  const end =
    price != null ? (
      <em className="flex h-[30px] shrink-0 items-center rounded-full bg-[color-mix(in_srgb,var(--color-action-foreground)_14%,transparent)] px-[11px] text-meta font-semibold not-italic leading-none tabular-nums">
        {creditsLabel(price)}
      </em>
    ) : trailingArrow ? (
      <ArrowGlyph />
    ) : null;
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-[9px]">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      {end}
    </>
  );
  const className = cn(PRIMARY, price != null ? "pr-2.5" : "pr-4");
  // Spoken as "Script the best, 2 credits": the two spans would otherwise run together.
  const name = price != null ? `${label}, ${creditsLabel(price)}` : undefined;

  if (href) {
    return (
      <Button asChild variant="primary" size="lg" className={className} aria-label={name}>
        <Link href={href}>{body}</Link>
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant="primary"
      size="lg"
      className={className}
      aria-label={name}
      onClick={onClick}
      disabled={!onClick}
    >
      {body}
    </Button>
  );
}
