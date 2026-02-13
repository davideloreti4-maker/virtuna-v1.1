"use client";

import { useState } from "react";
import { Lightning, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { CheckoutModal } from "@/components/app/checkout-modal";
import { useSubscription } from "@/hooks/use-subscription";

export function UpgradePrompt() {
  const { isTrial, trialDaysRemaining } = useSubscription();
  const [dismissed, setDismissed] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<"pro" | null>(null);

  if (!isTrial || trialDaysRemaining === null || trialDaysRemaining > 3 || dismissed) {
    return null;
  }

  return (
    <>
      <div className="mx-4 mb-4 flex items-center justify-between rounded-xl border border-warning/20 bg-warning/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <Lightning size={18} className="text-warning" />
          <div>
            <p className="text-sm font-medium text-white">
              Your trial ends in {trialDaysRemaining}{" "}
              {trialDaysRemaining === 1 ? "day" : "days"}
            </p>
            <p className="text-xs text-foreground-muted">
              Upgrade now to keep Pro features
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCheckoutPlan("pro")}
          >
            Upgrade now
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-foreground-muted hover:text-foreground p-1"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      {checkoutPlan && (
        <CheckoutModal
          open={!!checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          planId={checkoutPlan}
        />
      )}
    </>
  );
}
