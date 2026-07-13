"use client";

import { useState, useEffect, useCallback } from "react";
import { CreditCard, ExternalLink, Zap, Calendar, Check } from "lucide-react";
import { CheckoutModal } from "@/components/app/checkout-modal";
import { Button } from "@/components/ui";
import type { NumenTier } from "@/lib/whop/config";

interface SubscriptionData {
  tier: NumenTier;
  status: string;
  whopConnected: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

// The PUBLIC names (pricing.ts): the `starter` id is sold as "Creator", and `free` is not a
// plan — it is what you are before you start a trial, or after one lapses.
const TIER_LABELS: Record<NumenTier, string> = {
  free: "No plan",
  starter: "Creator",
  pro: "Pro",
  studio: "Studio",
};

// Plans are neutral (dosage rule — no brand color per tier); a chip, not a hue.
const PLAN_COLORS: Record<NumenTier, string> = {
  free: "text-foreground-secondary bg-[var(--color-charcoal-chip)]",
  starter: "text-foreground-secondary bg-[var(--color-charcoal-chip)]",
  pro: "text-foreground-secondary bg-[var(--color-charcoal-chip)]",
  studio: "text-foreground-secondary bg-[var(--color-charcoal-chip)]",
};

// Status is genuine semantic state → maps to score-zone tokens.
const STATUS_COLORS: Record<string, string> = {
  active: "text-success bg-success/10",
  cancelled: "text-warning bg-warning/10",
  expired: "text-error bg-error/10",
  past_due: "text-error bg-error/10",
};

export function BillingSection() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<"starter" | "pro" | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      const res = await fetch("/api/subscription");
      if (res.ok) {
        setSubscription(await res.json());
      }
    } catch {
      // Fallback to free
      setSubscription({ tier: "free", status: "active", whopConnected: false, cancelAtPeriodEnd: false, currentPeriodEnd: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubscription(); }, [fetchSubscription]);

  const handleCheckoutComplete = () => {
    setCheckoutPlan(null);
    fetchSubscription();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-medium text-foreground">Billing</h2>
          <p className="mt-1 text-sm text-foreground-secondary">Loading subscription details...</p>
        </div>
        <div className="h-32 animate-pulse rounded-lg bg-white/[0.05]" />
      </div>
    );
  }

  const tier = subscription?.tier ?? "free";
  const status = subscription?.status ?? "active";
  const nextTier: "starter" | "pro" | null = tier === "free" ? "starter" : tier === "starter" ? "pro" : null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium text-foreground">Billing</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Manage your subscription and plan.
        </p>
      </div>

      {/* Current plan card */}
      <div
        className="rounded-lg border border-white/[0.06] p-6"
        style={{
          backgroundColor: "var(--color-charcoal-composer)",
          boxShadow: "rgba(255,255,255,0.05) 0 1px 0 0 inset",
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-foreground-muted" />
              <span className="text-sm text-foreground-secondary">Current plan</span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <h3 className="text-2xl font-semibold text-foreground">
                {TIER_LABELS[tier]}
              </h3>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PLAN_COLORS[tier]}`}>
                {TIER_LABELS[tier]}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[status] || STATUS_COLORS.active}`}>
                {status === "past_due" ? "Past Due" : status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
            {subscription?.cancelAtPeriodEnd && (
              <p className="mt-2 text-sm text-warning">
                Your plan will be downgraded at the end of the current period.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {nextTier && (
              <Button
                type="button"
                variant="primary"
                onClick={() => setCheckoutPlan(nextTier)}
              >
                <Zap className="h-4 w-4" />
                Upgrade to {TIER_LABELS[nextTier]}
              </Button>
            )}
            {subscription?.whopConnected && (
              <Button variant="secondary" asChild>
                <a
                  href="https://whop.com/hub/memberships"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Manage on Whop
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Plan features comparison */}
      <div
        className="rounded-lg border border-white/[0.06] p-6"
        style={{
          backgroundColor: "var(--color-charcoal-composer)",
          boxShadow: "rgba(255,255,255,0.05) 0 1px 0 0 inset",
        }}
      >
        <h3 className="text-sm font-medium text-foreground mb-4">Plan features</h3>
        <div className="grid grid-cols-3 gap-4">
          {(["free", "starter", "pro"] as const).map((t) => (
            <div
              key={t}
              className={`rounded-lg border p-4 ${t === tier ? "border-border-hover bg-white/[0.02]" : "border-white/[0.06]"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${t === tier ? "text-foreground" : "text-foreground-secondary"}`}>
                  {TIER_LABELS[t]}
                </span>
                {t === tier && <Check className="h-4 w-4 text-success" />}
              </div>
              <p className="text-xs text-foreground-muted">
                {t === "free" && "Basic access to the platform"}
                {t === "starter" && "Enhanced features for growing creators"}
                {t === "pro" && "Full access to all premium features"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Billing cycle */}
      {subscription?.currentPeriodEnd && (
        <div
        className="rounded-lg border border-white/[0.06] p-6"
        style={{
          backgroundColor: "var(--color-charcoal-composer)",
          boxShadow: "rgba(255,255,255,0.05) 0 1px 0 0 inset",
        }}
      >
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-foreground-muted" />
            <span className="text-sm font-medium text-foreground">Next billing date</span>
          </div>
          <p className="mt-2 text-lg text-foreground-secondary">
            {formatDate(subscription.currentPeriodEnd)}
          </p>
        </div>
      )}

      {/* Checkout modal */}
      {checkoutPlan && (
        <CheckoutModal
          open={!!checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          planId={checkoutPlan}
          onComplete={handleCheckoutComplete}
        />
      )}
    </div>
  );
}
