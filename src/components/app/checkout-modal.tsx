"use client";

import { useState, useEffect } from "react";
import { WhopCheckoutEmbed } from "@whop/checkout/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getPlan, TRIAL, type PaidPlanId } from "@/lib/pricing";

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  /** Persisted tier id. The dialog shows the plan's PUBLIC name (`starter` → "Creator"). */
  planId: PaidPlanId;
  /**
   * Buy the $1 / 3-day trial SKU instead of the full-price plan. The API resolves this to
   * a different Whop plan; if that plan isn't configured it falls back to full price, so
   * a buyer is never charged less than what the button promised.
   */
  trial?: boolean;
  onComplete?: () => void;
}

export function CheckoutModal({
  open,
  onClose,
  planId,
  trial = false,
  onComplete,
}: CheckoutModalProps) {
  const plan = getPlan(planId);
  const [checkoutConfigId, setCheckoutConfigId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What the server actually RESOLVED — false when the $1 trial was denied (one per
  // account) or its SKU isn't configured. The heading must match the price in the embed,
  // not the price the button hoped for.
  const [trialApplied, setTrialApplied] = useState(trial);

  // Fetch checkout config when modal opens
  useEffect(() => {
    if (!open) return;

    const fetchCheckoutConfig = async () => {
      setLoading(true);
      setError(null);
      setCheckoutConfigId(null);
      setTrialApplied(trial);

      try {
        const res = await fetch("/api/whop/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId, trial }),
        });

        if (!res.ok) {
          throw new Error(`Failed to create checkout session: ${res.statusText}`);
        }

        const data = await res.json();
        setCheckoutConfigId(data.checkoutConfigId);
        setTrialApplied(Boolean(data.trialApplied));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load checkout");
      } finally {
        setLoading(false);
      }
    };

    fetchCheckoutConfig();
  }, [open, planId, trial]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setCheckoutConfigId(null);
      setLoading(false);
      setError(null);
      setTrialApplied(trial);
    }
  }, [open, trial]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  const handleComplete = () => {
    onComplete?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg" className="p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>
            {trialApplied
              ? `Start ${plan.name} for ${TRIAL.price}`
              : trial
                ? `Get ${plan.name}`
                : `Upgrade to ${plan.name}`}
          </DialogTitle>
          <DialogDescription>
            {trialApplied
              ? `${TRIAL.price} for ${TRIAL.days} days, then ${plan.price}${plan.priceSuffix}. Cancel anytime.`
              : trial
                ? `Your account has already used its $1 trial — ${plan.name} is ${plan.price}${plan.priceSuffix}.`
                : `Complete your payment to unlock ${plan.name}.`}
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-sm text-zinc-400">Loading checkout...</div>
            </div>
          )}
          {error && (
            <div className="text-sm text-red-400 py-4">{error}</div>
          )}
          {checkoutConfigId && (
            <WhopCheckoutEmbed
              sessionId={checkoutConfigId}
              theme="dark"
              skipRedirect
              onComplete={handleComplete}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
