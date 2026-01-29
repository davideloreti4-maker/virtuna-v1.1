"use client";

import { CreditCard, ExternalLink, Zap, Calendar } from "lucide-react";
import { useSettingsStore } from "@/stores/settings-store";

export function BillingSection() {
  const billing = useSettingsStore((s) => s.billing);

  const handleManageSubscription = () => {
    // Opens Stripe Customer Portal in new tab
    // In real app: API call creates portal session, returns URL
    window.open("https://billing.stripe.com/p/login/test", "_blank");
  };

  const creditsPercentage = (billing.creditsRemaining / billing.creditsTotal) * 100;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const planColors: Record<typeof billing.plan, string> = {
    free: "text-zinc-400 bg-zinc-400/10",
    pro: "text-emerald-400 bg-emerald-400/10",
    enterprise: "text-purple-400 bg-purple-400/10",
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium text-white">Billing</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Manage your subscription and payment details.
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
              <h3 className="text-2xl font-semibold text-white capitalize">
                {billing.plan}
              </h3>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${planColors[billing.plan]}`}>
                Active
              </span>
            </div>
            <p className="mt-1 text-lg text-zinc-400">
              ${billing.pricePerMonth}
              <span className="text-sm">/month</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleManageSubscription}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
          >
            Manage subscription
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Credits usage */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center gap-3">
          <Zap className="h-5 w-5 text-amber-400" />
          <span className="text-sm font-medium text-white">Credits usage</span>
        </div>
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-white">
              {billing.creditsRemaining.toLocaleString()}
            </span>
            <span className="text-sm text-zinc-400">
              of {billing.creditsTotal.toLocaleString()} credits
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
              style={{ width: `${creditsPercentage}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-zinc-500">
            Credits reset on your billing date
          </p>
        </div>
      </div>

      {/* Billing cycle */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-blue-400" />
          <span className="text-sm font-medium text-white">Next billing date</span>
        </div>
        <p className="mt-2 text-lg text-zinc-300">
          {formatDate(billing.renewalDate)}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          You&apos;ll be charged ${billing.pricePerMonth} on this date
        </p>
      </div>

      {/* Payment method note */}
      <p className="text-sm text-zinc-500">
        To update your payment method or view invoices, click &quot;Manage subscription&quot;
        above to access the Stripe billing portal.
      </p>
    </div>
  );
}
