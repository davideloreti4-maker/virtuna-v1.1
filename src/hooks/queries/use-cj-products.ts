"use client";

import { useQuery } from "@tanstack/react-query";
import type { AffiliateProgram } from "@/types/brand-deals";

interface CJProductsResponse {
  available: boolean;
  data: AffiliateProgram[];
  total: number;
}

interface UseCJProductsOptions {
  category?: string;
  limit?: number;
  enabled?: boolean;
}

/**
 * Fetches CJ Affiliate product search results from /api/programs/cj.
 * Returns empty results when CJ is not configured (no error state).
 */
export function useCJProducts(query: string, options: UseCJProductsOptions = {}) {
  const { category, limit = 20, enabled = true } = options;

  return useQuery({
    queryKey: ["cj", "products", query, category, limit],
    queryFn: async (): Promise<CJProductsResponse> => {
      const params = new URLSearchParams({ q: query, limit: String(limit) });
      if (category) params.set("category", category);

      const res = await fetch(`/api/programs/cj?${params}`);
      if (!res.ok) return { available: false, data: [], total: 0 };
      return res.json() as Promise<CJProductsResponse>;
    },
    enabled: enabled && query.trim().length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes to match server cache
  });
}
