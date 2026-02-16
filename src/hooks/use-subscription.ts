"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { VirtunaTier } from "@/lib/whop/config";

interface SubscriptionData {
  tier: VirtunaTier;
  status: string;
  isTrial: boolean;
  trialEndsAt: string | null;
  whopConnected: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
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
      setData({
        tier: json.tier ?? "free",
        status: json.status ?? "active",
        isTrial: json.isTrial ?? false,
        trialEndsAt: json.trialEndsAt ?? null,
        whopConnected: json.whopConnected ?? false,
        cancelAtPeriodEnd: json.cancelAtPeriodEnd ?? false,
        currentPeriodEnd: json.currentPeriodEnd ?? null,
      });
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
    (currentTier: VirtunaTier): Promise<VirtunaTier> => {
      return new Promise((resolve) => {
        setIsPolling(true);
        const startTime = Date.now();

        pollingRef.current = setInterval(async () => {
          try {
            const res = await fetch("/api/subscription");
            if (res.ok) {
              const json = await res.json();
              const newTier = (json.tier ?? "free") as VirtunaTier;

              if (newTier !== currentTier) {
                if (pollingRef.current) clearInterval(pollingRef.current);
                pollingRef.current = null;
                setData({
                  tier: newTier,
                  status: json.status ?? "active",
                  isTrial: json.isTrial ?? false,
                  trialEndsAt: json.trialEndsAt ?? null,
                  whopConnected: json.whopConnected ?? false,
                  cancelAtPeriodEnd: json.cancelAtPeriodEnd ?? false,
                  currentPeriodEnd: json.currentPeriodEnd ?? null,
                });
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
    tier: (data?.tier ?? "free") as VirtunaTier,
    status: data?.status ?? "active",
    isTrial: data?.isTrial ?? false,
    trialEndsAt: data?.trialEndsAt ?? null,
    trialDaysRemaining,
    isLoading,
    error,
    refetch,
    pollForTierChange,
    isPolling,
  };
}
