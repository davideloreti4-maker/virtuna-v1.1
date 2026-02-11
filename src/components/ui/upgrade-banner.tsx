"use client";

import { Zap } from "lucide-react";
import type { VirtunaTier } from "@/lib/whop/config";

interface UpgradeBannerProps {
  requiredTier: VirtunaTier;
  onUpgrade: (tier: VirtunaTier) => void;
}

export function UpgradeBanner({ requiredTier, onUpgrade }: UpgradeBannerProps) {
  const tierLabel = requiredTier === "pro" ? "Pro" : "Starter";

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#FF7F50]/10">
        <Zap className="h-5 w-5 text-[#FF7F50]" />
      </div>
      <h3 className="text-sm font-medium text-white">
        {tierLabel} Feature
      </h3>
      <p className="mt-1 text-sm text-zinc-400">
        Upgrade to {tierLabel} to unlock this feature.
      </p>
      <button
        type="button"
        onClick={() => onUpgrade(requiredTier)}
        className="mt-4 rounded-lg bg-[#FF7F50] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#FF7F50]/90"
      >
        Upgrade to {tierLabel}
      </button>
    </div>
  );
}
