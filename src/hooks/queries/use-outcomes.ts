"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";

interface OutcomeInput {
  analysis_id: string;
  actual_views?: number;
  actual_likes?: number;
  actual_shares?: number;
  actual_engagement_rate?: number;
  actual_score?: number;
  platform?: string;
  platform_post_url?: string;
}

/**
 * QUERY-08: Mutation hook for submitting outcome reports
 */
export function useOutcome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: OutcomeInput) => {
      const res = await fetch("/api/outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error ?? "Failed to submit outcome");
      }

      return res.json();
    },
    onSuccess: () => {
      // QUERY-10: Invalidate outcomes cache after new report
      queryClient.invalidateQueries({ queryKey: queryKeys.outcomes.history() });
    },
  });
}

/**
 * Outcome history query
 */
export function useOutcomeHistory() {
  return useQuery({
    queryKey: queryKeys.outcomes.history(),
    queryFn: async () => {
      const res = await fetch("/api/outcomes");
      if (!res.ok) throw new Error("Failed to fetch outcomes");
      return res.json();
    },
  });
}
