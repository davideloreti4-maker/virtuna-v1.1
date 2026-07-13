"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { NumenTier } from "@/lib/whop/config";

/**
 * The Reading balance — the meter the plans are sold on. Present whether or not enforcement
 * is switched on (`enforced`); the numbers are honest either way, and the UI shows a customer
 * their balance as soon as they have a plan. See lib/billing/quota.ts.
 */
export interface UsageData {
  used: number;
  /** null = unlimited (Studio, outside a trial). */
  limit: number | null;
  /** null = unlimited. Never negative. */
  remaining: number | null;
  /** Whether hitting the limit would actually block (BILLING_ENFORCE_QUOTA). */
  enforced: boolean;
  /** Whether the 5-Reading $1-trial pool is what's being measured. */
  inTrial: boolean;
  /** When the allowance resets — the renewal date, or the day the trial converts. */
  renewsAt: string | null;
  periodStart: string | null;
}

interface SubscriptionData {
  tier: NumenTier;
  status: string;
  isTrial: boolean;
  trialEndsAt: string | null;
  whopConnected: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  usage: UsageData | null;
}

/**
 * One mapper for both read paths (initial fetch + the post-checkout tier poll) — they were
 * two hand-rolled copies of the same object literal, so a field added to one silently went
 * missing from the other.
 */
function toSubscriptionData(json: Record<string, unknown>): SubscriptionData {
  const usage = json.usage as UsageData | undefined;
  return {
    tier: (json.tier as NumenTier) ?? "free",
    status: (json.status as string) ?? "active",
    isTrial: (json.isTrial as boolean) ?? false,
    trialEndsAt: (json.trialEndsAt as string | null) ?? null,
    whopConnected: (json.whopConnected as boolean) ?? false,
    cancelAtPeriodEnd: (json.cancelAtPeriodEnd as boolean) ?? false,
    currentPeriodEnd: (json.currentPeriodEnd as string | null) ?? null,
    usage: usage ?? null,
  };
}

export function useSubscription() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      const res = await fetch("/api/subscription");
      if (!res.ok) throw new Error("Failed to fetch subscription");
      const json = await res.json();
      setData(toSubscriptionData(json));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const refetch = useCallback(async () => {
    await fetchSubscription();
  }, [fetchSubscription]);

  const pollForTierChange = useCallback(
    (currentTier: NumenTier): Promise<NumenTier> => {
      return new Promise((resolve) => {
        setIsPolling(true);
        const startTime = Date.now();

        pollingRef.current = setInterval(async () => {
          try {
            const res = await fetch("/api/subscription");
            if (res.ok) {
              const json = await res.json();
              const newTier = (json.tier ?? "free") as NumenTier;

              if (newTier !== currentTier) {
                if (pollingRef.current) clearInterval(pollingRef.current);
                pollingRef.current = null;
                setData(toSubscriptionData(json));
                setIsPolling(false);
                resolve(newTier);
                return;
              }
            }
          } catch {
            // Continue polling on error
          }

          if (Date.now() - startTime >= 30000) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            setIsPolling(false);
            resolve(currentTier);
          }
        }, 2000);
      });
    },
    []
  );

  const trialDaysRemaining =
    data?.trialEndsAt
      ? Math.max(
          0,
          Math.ceil(
            (new Date(data.trialEndsAt).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : null;

  return {
    tier: (data?.tier ?? "free") as NumenTier,
    status: data?.status ?? "active",
    isTrial: data?.isTrial ?? false,
    trialEndsAt: data?.trialEndsAt ?? null,
    trialDaysRemaining,
    usage: data?.usage ?? null,
    // The subscription row's own fields. BillingSection used to fetch /api/subscription a
    // SECOND time just to read these three — one hook, one fetch, one shape.
    whopConnected: data?.whopConnected ?? false,
    cancelAtPeriodEnd: data?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: data?.currentPeriodEnd ?? null,
    isLoading,
    error,
    refetch,
    pollForTierChange,
    isPolling,
  };
}
