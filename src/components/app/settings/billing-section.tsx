"use client";

import { useState } from "react";
import { CreditCard, ExternalLink, Calendar, Check } from "lucide-react";
import { CheckoutModal } from "@/components/app/checkout-modal";
import { Button } from "@/components/ui";
import { useSubscription, type UsageData } from "@/hooks/use-subscription";
import {
  PLANS,
  TRIAL,
  getPlan,
  isPaidPlanId,
  creditsLabel,
  creditsRemainingLabel,
  type PaidPlanId,
} from "@/lib/pricing";
import type { NumenTier } from "@/lib/whop/config";

/**
 * BILLING — the plan, and the balance.
 *
 * The balance is the point. A customer buys "500 credits a month" and until now had no way to
 * see how many were left: the number existed only inside the quota check, on the server.
 *
 * It renders whenever they have something to spend (a plan, or a trial pool) — NOT gated on
 * `usage.enforced`. Enforcement decides whether we BLOCK; it has nothing to do with whether a
 * customer may see what they bought. A `free` user has no balance to show at all (allowance 0,
 * by design — there is no free plan), so they get the plans instead of a dispiriting "0 of 0".
 *
 * Everything here reads from src/lib/pricing.ts. The old hardcoded grid had drifted badly: it
 * listed a "Free" plan that does not exist, omitted Studio entirely, and sold the plans on
 * generic copy ("Enhanced features for growing creators") rather than the meter they are
 * actually priced on.
 */

// The tier chip. `starter` is SOLD AS "Creator" — never print a tier id (see pricing.ts).
const TIER_LABELS: Record<NumenTier, string> = {
  free: "No plan",
  starter: "Creator",
  pro: "Pro",
  studio: "Studio",
};

// Status is genuine semantic state → score-zone tokens. Plans stay neutral (the dosage rule:
// no brand colour per tier).
const STATUS_COLORS: Record<string, string> = {
  active: "text-success bg-success/10",
  cancelled: "text-warning bg-warning/10",
  expired: "text-error bg-error/10",
  past_due: "text-error bg-error/10",
};

const CARD = "rounded-lg border border-white/[0.06] p-6";
const CARD_STYLE = {
  backgroundColor: "var(--color-charcoal-composer)",
  boxShadow: "rgba(255,255,255,0.05) 0 1px 0 0 inset",
} as const;

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function BillingSection() {
  const {
    tier,
    status,
    usage,
    isTrial,
    currentPeriodEnd,
    whopConnected,
    cancelAtPeriodEnd,
    isLoading,
    refetch,
  } = useSubscription();
  const [checkoutPlan, setCheckoutPlan] = useState<PaidPlanId | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-medium text-foreground">Billing</h2>
          <p className="mt-1 text-sm text-foreground-secondary">Loading subscription details…</p>
        </div>
        <div className="h-32 animate-pulse rounded-lg bg-white/[0.05]" />
      </div>
    );
  }

  const plan = isPaidPlanId(tier) ? getPlan(tier) : null;
  // Something to spend = a paid plan, or a trial pool. `free` has neither.
  const hasBalance = usage !== null && (plan !== null || isTrial);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium text-foreground">Billing</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Your plan, and the credits it buys.
        </p>
      </div>

      {/* Current plan */}
      <div className={CARD} style={CARD_STYLE}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-foreground-muted" />
              <span className="text-sm text-foreground-secondary">Current plan</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h3 className="text-2xl font-semibold text-foreground">{TIER_LABELS[tier]}</h3>
              {plan && (
                <span className="text-sm text-foreground-muted">
                  {plan.price}
                  {plan.priceSuffix}
                </span>
              )}
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  STATUS_COLORS[status] ?? STATUS_COLORS.active
                }`}
              >
                {status === "past_due"
                  ? "Past due"
                  : status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
              {isTrial && (
                <span className="rounded-full bg-[var(--color-charcoal-chip)] px-2.5 py-1 text-xs font-medium text-foreground-secondary">
                  {TRIAL.badge}
                </span>
              )}
            </div>
            {cancelAtPeriodEnd && (
              <p className="mt-2 text-sm text-warning">
                Your plan ends at the end of the current period.
              </p>
            )}
            {tier === "free" && (
              <p className="mt-2 text-sm text-foreground-secondary">
                Start any plan for {TRIAL.price} — {TRIAL.credits} credits over {TRIAL.days} days.
              </p>
            )}
          </div>
          {whopConnected && (
            <Button variant="secondary" asChild>
              <a href="https://whop.com/hub/memberships" target="_blank" rel="noopener noreferrer">
                Manage on Whop
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* The balance */}
      {hasBalance && usage && <UsageCard usage={usage} planName={plan?.name ?? null} />}

      {/* Plans — the meter is the headline, because it is what they are buying. */}
      <div className={CARD} style={CARD_STYLE}>
        <h3 className="mb-4 text-sm font-medium text-foreground">
          {tier === "free" ? "Choose a plan" : "Plans"}
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((p) => {
            const isCurrent = p.id === tier;
            return (
              <div
                key={p.id}
                className={`flex flex-col rounded-lg border p-4 ${
                  isCurrent ? "border-border-hover bg-white/[0.02]" : "border-white/[0.06]"
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`text-sm font-medium ${
                      isCurrent ? "text-foreground" : "text-foreground-secondary"
                    }`}
                  >
                    {p.name}
                  </span>
                  {isCurrent && <Check className="h-4 w-4 text-success" />}
                </div>
                <p className="text-sm text-foreground">
                  {p.price}
                  <span className="text-foreground-muted">{p.priceSuffix}</span>
                </p>
                <p className="mt-1 text-xs text-foreground-muted">{creditsLabel(p)}</p>
                {!isCurrent && (
                  <Button
                    type="button"
                    variant={p.highlighted ? "primary" : "secondary"}
                    size="sm"
                    className="mt-4 w-full"
                    onClick={() => setCheckoutPlan(p.id)}
                  >
                    {tier === "free" ? `Start for ${TRIAL.price}` : `Switch to ${p.name}`}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Next billing date */}
      {currentPeriodEnd && (
        <div className={CARD} style={CARD_STYLE}>
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-foreground-muted" />
            <span className="text-sm font-medium text-foreground">Next billing date</span>
          </div>
          <p className="mt-2 text-lg text-foreground-secondary">{formatDate(currentPeriodEnd)}</p>
        </div>
      )}

      {checkoutPlan && (
        <CheckoutModal
          open={!!checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          planId={checkoutPlan}
          // Everyone without a plan comes in through the $1 trial — it is the only door.
          trial={tier === "free"}
          onComplete={() => {
            setCheckoutPlan(null);
            void refetch();
          }}
        />
      )}
    </div>
  );
}

/**
 * The balance, counted DOWN. "380 of 500 credits left" answers the question a customer actually
 * has; "12 used" makes them do the subtraction themselves.
 */
function UsageCard({ usage, planName }: { usage: UsageData; planName: string | null }) {
  const unlimited = usage.limit === null;
  const remaining = usage.remaining ?? 0;
  const pctUsed =
    unlimited || !usage.limit ? 0 : Math.min(100, (usage.used / usage.limit) * 100);

  // Running out IS genuine semantic state, so it earns a score-zone token. Above that
  // threshold the meter stays neutral — a progress bar is not a place for brand colour.
  const zone =
    unlimited || usage.limit === null
      ? { bar: "bg-foreground-secondary", text: "text-foreground" }
      : remaining === 0
        ? { bar: "bg-error", text: "text-error" }
        : remaining <= Math.max(1, usage.limit * 0.2)
          ? { bar: "bg-warning", text: "text-warning" }
          : { bar: "bg-foreground-secondary", text: "text-foreground" };

  return (
    <div className={CARD} style={CARD_STYLE}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm text-foreground-secondary">
          {usage.inTrial ? "Trial credits" : "Credits this period"}
        </span>
        {usage.renewsAt && (
          <span className="text-xs text-foreground-muted">
            {usage.inTrial ? "Plan starts" : "Resets"} {formatDate(usage.renewsAt)}
          </span>
        )}
      </div>

      <p className={`mt-2 text-2xl font-semibold ${zone.text}`}>{creditsRemainingLabel(usage)}</p>

      {!unlimited && (
        <div
          className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]"
          role="progressbar"
          aria-valuenow={usage.used}
          aria-valuemin={0}
          aria-valuemax={usage.limit ?? 0}
          aria-label="Credits used"
        >
          <div className={`h-full rounded-full ${zone.bar}`} style={{ width: `${pctUsed}%` }} />
        </div>
      )}

      {usage.inTrial && planName && (
        <p className="mt-3 text-xs text-foreground-muted">
          Your {planName} allowance starts when the trial converts.
        </p>
      )}
      {!usage.enforced && (
        // Honesty beats a tidy number: while the flag is off nothing is actually blocked, and
        // anyone reading this page deserves to know the meter is running but not armed.
        <p className="mt-3 text-xs text-foreground-muted">
          Limits aren&apos;t enforced yet — you won&apos;t be blocked at zero.
        </p>
      )}
    </div>
  );
}
