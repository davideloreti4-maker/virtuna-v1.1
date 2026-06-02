"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";
import type { AdaptConcept, AdaptInput } from "@/lib/engine/remix/decode-types";

/**
 * Input shape for the useAdaptConcepts mutation.
 *
 * `decode` carries the 4 structural fields + repeatable[] from AdaptInput
 * (luck[] deliberately excluded — D-01 structural content-leak guard).
 * `niche` is the creator-profile niche label string.
 * `analysis_id` is the UUID of the analysis row to persist concepts into.
 */
export interface AdaptMutationInput {
  analysis_id: string;
  decode: Omit<AdaptInput, 'niche'>;
  niche: string;
}

/**
 * useAdaptConcepts — TanStack mutation hook for POST /api/remix/adapt.
 *
 * Analog: src/hooks/queries/use-creator-profile.ts:75-101 (mutation + cache invalidation).
 *
 * On mutate: POSTs to /api/remix/adapt with JSON Content-Type + body { analysis_id, decode, niche }.
 * On !res.ok: throws with the server error message.
 * On success: invalidates the analysis-by-id query so permalink rehydration picks up
 *             variants.remix.adapt (Pitfall 3 guard — rehydrate-no-regen).
 *
 * `decode` type is Omit<AdaptInput, 'niche'> which is Pick<DecodeOutput, structural fields + repeatable>
 * — luck[] is structurally excluded at the type level (D-01, T-04-11).
 */
export function useAdaptConcepts(analysisId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AdaptMutationInput): Promise<{ concepts: AdaptConcept[] }> => {
      const res = await fetch("/api/remix/adapt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to generate adapt concepts");
      }
      return res.json() as Promise<{ concepts: AdaptConcept[] }>;
    },
    onSuccess: () => {
      // Invalidate the analysis query so permalink rehydration picks up
      // variants.remix.adapt — prevents re-generation on next mount (Pitfall 3).
      queryClient.invalidateQueries({
        queryKey: queryKeys.analysis.detail(analysisId),
      });
    },
  });
}
