"use client";

import { useState, useEffect } from "react";
import { CreditCard, ExternalLink, Zap, Calendar, Check } from "lucide-react";
import { CheckoutModal } from "@/components/app/checkout-modal";
import type { VirtunaTier } from "@/lib/whop/config";
import { useSubscription } from "@/hooks/use-subscription";

const TIER_LABELS: Record<VirtunaTier, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
};

const PLAN_COLORS: Record<VirtunaTier, string> = {
  free: "text-zinc-400 bg-zinc-400/10",
  starter: "text-emerald-400 bg-emerald-400/10",
  pro: "text-purple-400 bg-purple-400/10",
};

const STATUS_COLORS: Record<string, string> = {
  active: "text-emerald-400 bg-emerald-400/10",
  cancelled: "text-amber-400 bg-amber-400/10",
  expired: "text-red-400 bg-red-400/10",
  past_due: "text-red-400 bg-red-400/10",
};

export function BillingSection() {
  const {
    tier,
    status,
    isTrial,
    trialDaysRemaining,
    pollForTierChange,
    isPolling,
  } = useSubscription();

  const [billingDetails, setBillingDetails] = useState<{
    whopConnected: boolean;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<"starter" | "pro" | null>(null);

  useEffect(() => {
    fetch("/api/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setBillingDetails({
            whopConnected: data.whopConnected ?? false,
            cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
            currentPeriodEnd: data.currentPeriodEnd ?? null,
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCheckoutComplete = async () => {
    const plan = checkoutPlan;
    setCheckoutPlan(null);
    if (plan) {
      await pollForTierChange(tier);
      const res = await fetch("/api/subscription");
      if (res.ok) {
        const data = await res.json();
        setBillingDetails({
          whopConnected: data.whopConnected ?? false,
          cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
          currentPeriodEnd: data.currentPeriodEnd ?? null,
        });
      }
    }
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
          <h2 className="text-lg font-medium text-white">Billing</h2>
          <p className="mt-1 text-sm text-zinc-400">Loading subscription details...</p>
        </div>
        <div className="h-32 animate-pulse rounded-lg bg-zinc-800/50" />
      </div>
    );
  }

  const nextTier: "starter" | "pro" | null = tier === "free" ? "starter" : tier === "starter" ? "pro" : null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium text-white">Billing</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Manage your subscription and plan.
        </p>
      </div>

      {/* Current plan card */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-zinc-400" />
              <span className="text-sm text-zinc-400">Current plan</span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <h3 className="text-2xl font-semibold text-white">
                {TIER_LABELS[tier]}
              </h3>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PLAN_COLORS[tier]}`}>
                {TIER_LABELS[tier]}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[status] || STATUS_COLORS.active}`}>
                {status === "past_due" ? "Past Due" : status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
              {isTrial && trialDaysRemaining !== null && (
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  trialDaysRemaining <= 3 ? "text-warning bg-warning/10" : "text-info bg-info/10"
                }`}>
                  {trialDaysRemaining} {trialDaysRemaining === 1 ? "day" : "days"} left in trial
                </span>
              )}
              {isPolling && (
                <span className="text-xs text-foreground-muted animate-pulse">Updating...</span>
              )}
            </div>
            {billingDetails?.cancelAtPeriodEnd && (
              <p className="mt-2 text-sm text-amber-400">
                Your plan will be downgraded at the end of the current period.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {nextTier && (
              <button
                type="button"
                onClick={() => setCheckoutPlan(nextTier)}
                className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
              >
                <Zap className="h-4 w-4" />
                Upgrade to {TIER_LABELS[nextTier]}
              </button>
            )}
            {billingDetails?.whopConnected && (
              <a
                href="https://whop.com/hub/memberships"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                Manage on Whop
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Plan features comparison */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
        <h3 className="text-sm font-medium text-white mb-4">Plan features</h3>
        <div className="grid grid-cols-3 gap-4">
          {(["free", "starter", "pro"] as const).map((t) => (
            <div
              key={t}
              className={`rounded-lg border p-4 ${t === tier ? "border-white/20 bg-white/[0.02]" : "border-zinc-800"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${PLAN_COLORS[t].split(" ")[0]}`}>
                  {TIER_LABELS[t]}
                </span>
                {t === tier && <Check className="h-4 w-4 text-emerald-400" />}
              </div>
              <p className="text-xs text-zinc-500">
                {t === "free" && "Basic access to the platform"}
                {t === "starter" && "Enhanced features for growing creators"}
                {t === "pro" && "Full access to all premium features"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Billing cycle */}
      {billingDetails?.currentPeriodEnd && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-blue-400" />
            <span className="text-sm font-medium text-white">Next billing date</span>
          </div>
          <p className="mt-2 text-lg text-zinc-300">
            {formatDate(billingDetails.currentPeriodEnd)}
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
