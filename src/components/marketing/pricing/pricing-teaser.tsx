import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/marketing/section-heading";
import { PLANS, TRIAL } from "@/lib/pricing";

import { PricingCard } from "./pricing-card";

/**
 * Pricing teaser — the three paid plans, read straight off the pricing SSOT
 * (`src/lib/pricing.ts`). Owner-locked 2026-07-13: Creator $49 · Pro $99 (best value) ·
 * Studio $499, each startable for $1 for 3 days.
 *
 * There is no free plan on the page any more: the $1 trial IS the way in. So the section
 * promises a cheap try, not a free tier — and every CTA says what it costs.
 *
 * Cards render the PUBLIC plan name (`plan.name`), never the persisted tier id — the id
 * `starter` is sold as "Creator" (see pricing.ts).
 *
 * Pure RSC — no "use client". Every CTA routes to /signup (D-10).
 * CONVERT-01 Nyquist gate target.
 */
export function PricingTeaser({ className }: { className?: string }) {
  return (
    <div className={cn(className)}>
      {/* Eyebrow kicker + sans-serif heading — serif is voice-only (D-13) */}
      <SectionHeading eyebrow="Pricing" title="Simple pricing" />
      <p className="mt-4 max-w-[60ch] text-base text-foreground-secondary">
        Every plan starts at {TRIAL.price} for {TRIAL.days} days — {TRIAL.readings}{" "}
        Readings to judge it on your own videos. Cancel before it renews and you&apos;ve
        spent a dollar.
      </p>

      {/* 3-up grid — side by side on md+, stacked on mobile (D-08). */}
      <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
        {PLANS.map((plan) => (
          <PricingCard
            key={plan.id}
            name={plan.name}
            price={plan.price}
            priceSuffix={plan.priceSuffix}
            badge={plan.badge}
            badgeVariant={plan.badge ? "accent" : undefined}
            trialBadge={TRIAL.badge}
            highlighted={plan.highlighted}
            bullets={[...plan.bullets]}
            ctaLabel={`Start for ${TRIAL.price}`}
            microcopy={TRIAL.microcopy}
          />
        ))}
      </div>
    </div>
  );
}
