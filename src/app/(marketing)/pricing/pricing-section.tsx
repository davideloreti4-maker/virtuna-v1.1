"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button, Spinner } from "@/components/ui";
import { FadeIn } from "@/components/motion";
import { Check, X } from "@phosphor-icons/react";
import { CheckoutModal } from "@/components/app/checkout-modal";
import { createClient } from "@/lib/supabase/client";
import { useSubscription } from "@/hooks/use-subscription";
import { hasAccessToTier } from "@/lib/whop/config";
import { PLANS, TRIAL, getPlan, readingsLabel, type PaidPlanId } from "@/lib/pricing";

/**
 * The /pricing page. Owner-locked 2026-07-13: three paid plans — Creator $49 · Pro $99
 * (best value) · Studio $499 — every one of them startable for $1 for 3 days. There is no
 * free plan: the $1 trial is the way in.
 *
 * Prices, names, the meter and the bullets all come from the pricing SSOT
 * (`src/lib/pricing.ts`). Nothing on this page hardcodes a number — change the SSOT and
 * the page, the landing teaser, the checkout dialog and the quota check all move together.
 *
 * Tier ids (`starter`) are persisted and never displayed; `plan.name` ("Creator") is.
 */

interface PricingFeature {
  name: string;
  /** Per-plan cell: `true`/`false` for a tick/cross, or a string for a value. */
  values: Record<PaidPlanId, boolean | string>;
}

const features: PricingFeature[] = [
  {
    // The meter, first — it is what the plans are actually sold on.
    name: "Readings a month",
    values: { starter: "50", pro: "150", studio: "Unlimited" },
  },
  {
    name: "Virality score + the why",
    values: { starter: true, pro: true, studio: true },
  },
  {
    name: "Retention curve — where viewers drop",
    values: { starter: true, pro: true, studio: true },
  },
  {
    name: "Your room reacts",
    values: { starter: "10 personas", pro: "10 personas", studio: "10 personas" },
  },
  {
    name: "Population depth",
    values: { starter: false, pro: "1,000 viewers", studio: "1,000 viewers" },
  },
  {
    name: "Seats",
    values: { starter: "1", pro: "1", studio: "5" },
  },
  {
    name: "API access",
    values: { starter: false, pro: false, studio: true },
  },
  {
    name: "Support",
    values: { starter: "Standard", pro: "Priority", studio: "Dedicated" },
  },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) {
    return <Check size={18} weight="bold" className="text-foreground-secondary mx-auto" />;
  }
  if (value === false) {
    return <X size={18} weight="bold" className="text-foreground-muted/50 mx-auto" />;
  }
  return <span className="text-sm text-foreground">{value}</span>;
}

export function PricingSection() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<PaidPlanId | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<PaidPlanId | null>(null);
  const { tier, pollForTierChange, isPolling } = useSubscription();

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setIsAuthenticated(true);
    };
    checkAuth();
  }, []);

  function renderCTA(planTier: PaidPlanId) {
    const plan = getPlan(planTier);
    const variant = plan.highlighted ? "primary" : "secondary";

    // Signed out → signup owns the hand-off; carry the plan so the flow can resume it.
    if (!isAuthenticated) {
      return (
        <Button variant={variant} size="lg" className="w-full" asChild>
          <Link href={`/signup?plan=${planTier}`}>Start for {TRIAL.price}</Link>
        </Button>
      );
    }

    // Already on this tier (or above it) → nothing to sell.
    if (hasAccessToTier(tier, planTier)) {
      return (
        <Button variant={variant} size="lg" className="w-full" disabled>
          {tier === planTier ? "Current plan" : "Included"}
        </Button>
      );
    }

    // Signed in, not on this plan → the $1 trial (all three plans carry it).
    return (
      <Button
        variant={variant}
        size="lg"
        className="w-full"
        onClick={() => setCheckoutPlan(planTier)}
      >
        Start for {TRIAL.price}
      </Button>
    );
  }

  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <FadeIn>
          <div className="text-center mb-16">
            <h1 className="text-[36px] sm:text-[44px] md:text-[52px] leading-[1.1] font-normal text-foreground">
              Simple, transparent pricing
            </h1>
            <p className="mt-4 text-lg text-foreground-secondary max-w-xl mx-auto">
              Every plan starts at {TRIAL.price} for {TRIAL.days} days — {TRIAL.readings}{" "}
              Readings to judge it on your own videos. Cancel before it renews and
              you&apos;ve spent a dollar.
            </p>
          </div>
        </FadeIn>

        {/* Post-checkout feedback */}
        {isPolling && (
          <div className="mb-8 flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <Spinner size="sm" className="text-foreground-secondary" />
            <span className="text-sm text-foreground-secondary">Confirming your subscription...</span>
          </div>
        )}
        {checkoutSuccess && !isPolling && (
          <div className="mb-8 flex items-center justify-center gap-2 rounded-xl border border-success/20 bg-success/5 px-4 py-3">
            <Check size={18} className="text-success" />
            <span className="text-sm text-foreground">
              Welcome to {getPlan(checkoutSuccess).name}! Your plan is now active.
            </span>
          </div>
        )}

        {/* The three plans */}
        <FadeIn delay={0.1}>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 mb-16">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={
                  plan.highlighted
                    ? "relative rounded-[12px] border border-border-hover/30 p-8"
                    : "rounded-[12px] border border-white/[0.06] p-8"
                }
                style={{
                  boxShadow: "rgba(255, 255, 255, 0.05) 0px 1px 0px 0px inset",
                }}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-8">
                    <span className="rounded-full bg-action px-3 py-1 text-xs font-medium text-action-foreground">
                      {plan.badge}
                    </span>
                  </div>
                )}
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-foreground">{plan.name}</h3>
                  <p className="mt-1 text-sm text-foreground-muted">{plan.tagline}</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-[48px] font-normal text-foreground">
                      {plan.price}
                    </span>
                    <span className="text-foreground-muted">/month</span>
                  </div>
                  {/* The meter, stated on the card — not buried in the table. */}
                  <p className="mt-2 text-sm text-foreground-secondary">
                    {readingsLabel(plan)}
                  </p>
                </div>
                {renderCTA(plan.id)}
                <p className="mt-3 text-center text-xs text-foreground-muted">
                  {TRIAL.microcopy}
                </p>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Comparison table */}
        <FadeIn delay={0.2}>
          <div className="rounded-[12px] border border-white/[0.06] overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="py-4 px-6 text-left text-sm font-medium text-foreground-muted">
                    Feature
                  </th>
                  {PLANS.map((plan) => (
                    <th
                      key={plan.id}
                      className={
                        plan.highlighted
                          ? "py-4 px-6 text-center text-sm font-medium text-foreground w-36"
                          : "py-4 px-6 text-center text-sm font-medium text-foreground-secondary w-36"
                      }
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((feature, index) => (
                  <tr
                    key={feature.name}
                    className={
                      index < features.length - 1
                        ? "border-b border-white/[0.06]"
                        : ""
                    }
                  >
                    <td className="py-4 px-6 text-sm text-foreground">
                      {feature.name}
                    </td>
                    {PLANS.map((plan) => (
                      <td key={plan.id} className="py-4 px-6 text-center">
                        <FeatureValue value={feature.values[plan.id]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeIn>
      </div>

      {checkoutPlan && (
        <CheckoutModal
          open={!!checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          planId={checkoutPlan}
          // Every plan is sold as the $1 / 3-day trial that converts into it.
          trial
          onComplete={async () => {
            const plan = checkoutPlan;
            setCheckoutPlan(null);
            if (plan) {
              const newTier = await pollForTierChange(tier);
              if (newTier !== tier) {
                setCheckoutSuccess(plan);
                setTimeout(() => setCheckoutSuccess(null), 5000);
              }
            }
          }}
        />
      )}
    </section>
  );
}
