"use client";

import { Clock } from "@phosphor-icons/react";
import { useSubscription } from "@/hooks/use-subscription";

export function TrialCountdown() {
  const { isTrial, trialDaysRemaining } = useSubscription();

  if (!isTrial || trialDaysRemaining === null) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-sm">
      <Clock
        size={16}
        className={trialDaysRemaining <= 3 ? "text-warning" : "text-foreground-muted"}
      />
      <span
        className={trialDaysRemaining <= 3 ? "text-warning" : "text-foreground-secondary"}
      >
        {trialDaysRemaining} {trialDaysRemaining === 1 ? "day" : "days"} left in trial
      </span>
    </div>
  );
}
