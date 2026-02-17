"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";

interface AffiliateLinkRow {
  id: string;
  user_id: string;
  deal_id: string | null;
  product_name: string;
  url: string;
  short_code: string;
  clicks: number;
  conversions: number;
  earnings_cents: number;
  commission_rate_pct: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface AffiliateLinksResponse {
  data: AffiliateLinkRow[];
}

interface CreateLinkInput {
  deal_id?: string | null;
  product_name: string;
  url: string;
  short_code: string;
  commission_rate_pct: number;
}

/**
 * Fetch the authenticated user's affiliate links.
 */
export function useAffiliateLinks() {
  return useQuery({
    queryKey: queryKeys.affiliateLinks.list(),
    queryFn: async () => {
      const res = await fetch("/api/affiliate-links");
      if (!res.ok) throw new Error("Failed to fetch affiliate links");
      return res.json() as Promise<AffiliateLinksResponse>;
    },
  });
}

/**
 * Create a new affiliate link, invalidates the list cache.
 */
export function useCreateAffiliateLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateLinkInput) => {
      const res = await fetch("/api/affiliate-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error ?? "Failed to create affiliate link");
      }
      return res.json() as Promise<AffiliateLinkRow>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.affiliateLinks.all,
      });
    },
  });
}
