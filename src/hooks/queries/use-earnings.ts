"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";

interface EarningsSummaryResponse {
  totalEarned: number;
  pendingPayout: number;
  thisMonth: number;
  monthlyBreakdown: Array<{ month: string; amount: number }>;
  topSources: Array<{
    brandName: string;
    brandLogo: string;
    totalEarned: number;
    clicks: number;
    conversions: number;
    dealCount: number;
  }>;
}

/**
 * Fetch aggregated earnings for the authenticated user.
 * All amounts in cents.
 */
export function useEarnings() {
  return useQuery({
    queryKey: queryKeys.earnings.summary(),
    queryFn: async () => {
      const res = await fetch("/api/earnings");
      if (!res.ok) throw new Error("Failed to fetch earnings");
      return res.json() as Promise<EarningsSummaryResponse>;
    },
  });
}
