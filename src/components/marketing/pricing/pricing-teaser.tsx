import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/marketing/section-heading";
import { PricingCard } from "./pricing-card";

/** Tier data — mirrors the real model shape (D-11), compressed to 3-4 bullets (D-09). */
const TIERS = [
  {
    name: "Starter",
    price: "Free",
    priceSuffix: "to start",
    badge: undefined,
    badgeVariant: undefined,
    trialBadge: undefined,
    highlighted: false,
    bullets: [
      "5 simulations per month",
      "Core virality score + the why",
      "Basic trend read",
      "Hook & retention breakdown",
    ],
    ctaLabel: "Try it free",
    microcopy: "Free to start — no credit card",
  },
  {
    name: "Pro",
    price: "$19",
    priceSuffix: "/mo",
    badge: "Most popular",
    badgeVariant: "accent" as const,
    trialBadge: "7-day free trial",
    highlighted: true,
    bullets: [
      "Unlimited simulations",
      "Advanced audience insights",
      "Audience deep-dive + persona cloud",
      "Priority support",
    ],
    ctaLabel: "Try it free",
    microcopy: "7-day free trial — cancel anytime",
  },
] as const;

/**
 * Pricing teaser — 2-up tier grid (Starter + Pro, Pro highlighted "Most popular").
 *
 * Pure RSC — no "use client". Both CTAs route to /signup (D-10).
 * CONVERT-01 Nyquist gate target.
 */
export function PricingTeaser({ className }: { className?: string }) {
  return (
    <div className={cn(className)}>
      {/* Eyebrow kicker + sans-serif heading — serif is voice-only (D-13) */}
      <SectionHeading eyebrow="Pricing" title="Simple pricing" />
      <p className="mt-4 max-w-[60ch] text-base text-foreground-secondary">
        Start free. Upgrade when you&apos;re ready to go unlimited.
      </p>

      {/* 2-up grid — side by side on md+, stacked on mobile (D-08) */}
      <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
        {TIERS.map((tier) => (
          <PricingCard
            key={tier.name}
            name={tier.name}
            price={tier.price}
            priceSuffix={tier.priceSuffix}
            badge={tier.badge}
            badgeVariant={tier.badgeVariant}
            trialBadge={tier.trialBadge}
            highlighted={tier.highlighted}
            bullets={[...tier.bullets]}
            ctaLabel={tier.ctaLabel}
            microcopy={tier.microcopy}
          />
        ))}
      </div>
    </div>
  );
}
