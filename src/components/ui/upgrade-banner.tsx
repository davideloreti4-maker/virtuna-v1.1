"use client";

import { Zap } from "lucide-react";
import type { NumenTier } from "@/lib/whop/config";
import { getPlan, isPaidPlanId } from "@/lib/pricing";
import { Button } from "@/components/ui/button";

interface UpgradeBannerProps {
  requiredTier: NumenTier;
  onUpgrade: (tier: NumenTier) => void;
}

export function UpgradeBanner({ requiredTier, onUpgrade }: UpgradeBannerProps) {
  // The PUBLIC plan name, from the pricing SSOT. This used to be
  // `requiredTier === "pro" ? "Pro" : "Starter"`, which labelled BOTH Creator and Studio
  // as "Starter" — a plan we do not sell.
  const tierLabel = isPaidPlanId(requiredTier) ? getPlan(requiredTier).name : "a plan";

  return (
    <div className="rounded-lg border border-white/[0.06] bg-surface p-6 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06]">
        <Zap className="h-5 w-5 text-foreground-muted" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-medium text-foreground">
        {tierLabel} Feature
      </h3>
      <p className="mt-1 text-sm text-foreground-muted">
        Upgrade to {tierLabel} to unlock this feature.
      </p>
      <Button
        variant="primary"
        size="md"
        onClick={() => onUpgrade(requiredTier)}
        className="mt-4"
      >
        Upgrade to {tierLabel}
      </Button>
    </div>
  );
}
