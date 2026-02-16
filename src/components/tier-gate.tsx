"use client";

import { useState, type ReactNode } from "react";
import { useSubscription } from "@/hooks/use-subscription";
import { hasAccessToTier, type VirtunaTier } from "@/lib/whop/config";
import { UpgradeBanner } from "@/components/ui/upgrade-banner";
import { CheckoutModal } from "@/components/app/checkout-modal";

interface TierGateProps {
  requiredTier: VirtunaTier;
  children: ReactNode;
  fallback?: ReactNode;
}

export function TierGate({ requiredTier, children, fallback }: TierGateProps) {
  const { tier, isLoading } = useSubscription();
  const [checkoutPlan, setCheckoutPlan] = useState<"starter" | "pro" | null>(null);

  if (isLoading) return null;

  if (hasAccessToTier(tier, requiredTier)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <>
      <UpgradeBanner
        requiredTier={requiredTier}
        onUpgrade={(t) => setCheckoutPlan(t === "pro" ? "pro" : "starter")}
      />
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
