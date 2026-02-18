"use client";

import { useQuery } from "@tanstack/react-query";
import type { AffiliateProgram } from "@/types/brand-deals";

interface UseCJProductsOptions {
  enabled?: boolean;
}

/**
 * Stub hook for CJ affiliate product search.
 * Returns AffiliateProgram[] so results can be passed through affiliateProgramToDeal.
 * TODO: Wire to actual CJ API when integration is ready.
 */
export function useCJProducts(
  query: string,
  options?: UseCJProductsOptions
) {
  return useQuery({
    queryKey: ["cj-products", query],
    queryFn: async (): Promise<{ data: AffiliateProgram[] }> => {
      // Placeholder — returns empty results until CJ API is integrated
      return { data: [] };
    },
    enabled: !!query && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
