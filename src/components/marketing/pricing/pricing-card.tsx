import Link from "next/link";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SIGNUP_URL } from "@/lib/routes";

export interface PricingCardProps {
  /** Tier name, e.g. "Starter" or "Pro" */
  name: string;
  /** Price display, e.g. "Free" or "$19" */
  price: string;
  /** Price suffix, e.g. "to start" or "/mo" */
  priceSuffix?: string;
  /** Optional badge text, e.g. "Most popular" */
  badge?: string;
  /** Badge variant — accent (coral) for "Most popular", secondary for trial pills */
  badgeVariant?: "accent" | "secondary";
  /** Optional secondary badge text, e.g. "7-day free trial" */
  trialBadge?: string;
  /** Whether this card is the highlighted tier (Pro) */
  highlighted?: boolean;
  /** 3–4 benefit bullets */
  bullets: string[];
  /** CTA label, e.g. "Try it free" */
  ctaLabel?: string;
  /** Risk-reducer microcopy under the CTA. Tier-specific (CR-03): the Pro card
   *  charges after the trial, so it must NOT claim "no credit card". */
  microcopy?: string;
}

/**
 * Bespoke flat-warm pricing tier card.
 *
 * Pure RSC — no "use client". All CTAs route to SIGNUP_URL (/signup) via Link.
 * Coral is confined to the primary CTA and the "Most popular" badge (CONVERT-01).
 * No Supabase, Whop, CheckoutModal, or useSubscription imports (D-10).
 */
export function PricingCard({
  name,
  price,
  priceSuffix,
  badge,
  badgeVariant = "accent",
  trialBadge,
  highlighted = false,
  bullets,
  ctaLabel = "Try it free",
  microcopy,
}: PricingCardProps) {
  return (
    <article
      className={cn(
        "flex flex-col rounded-[--radius-lg] border bg-transparent p-8",
        highlighted
          ? "border-border-hover/25 ring-1 ring-accent/20"
          : "border-border"
      )}
      style={{ boxShadow: "rgba(255, 255, 255, 0.05) 0px 1px 0px 0px inset" }}
    >
      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2">
        {badge && (
          <Badge variant={badgeVariant} size="sm">
            {badge}
          </Badge>
        )}
        {trialBadge && (
          <Badge variant="secondary" size="sm">
            {trialBadge}
          </Badge>
        )}
      </div>

      {/* Tier name */}
      <h3 className="mt-4 text-xl font-semibold text-foreground">{name}</h3>

      {/* Price */}
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-4xl font-bold text-foreground">{price}</span>
        {priceSuffix && (
          <span className="text-base text-foreground-secondary">
            {priceSuffix}
          </span>
        )}
      </div>

      {/* Benefit bullets */}
      <ul className="mt-6 flex flex-col gap-3" role="list">
        {bullets.map((bullet) => (
          <li
            key={bullet}
            className="flex items-start gap-2 text-sm text-foreground-secondary"
            data-testid="pricing-bullet"
          >
            <span aria-hidden="true" className="mt-0.5 shrink-0 text-foreground-muted">
              ✓
            </span>
            {bullet}
          </li>
        ))}
      </ul>

      {/* CTA + risk-reducer microcopy */}
      <div className="mt-8 flex flex-col gap-3">
        <Button asChild variant="primary" size="lg">
          <Link href={SIGNUP_URL}>{ctaLabel}</Link>
        </Button>
        {microcopy && (
          <p className="text-center text-xs text-foreground-muted">
            {microcopy}
          </p>
        )}
      </div>
    </article>
  );
}
