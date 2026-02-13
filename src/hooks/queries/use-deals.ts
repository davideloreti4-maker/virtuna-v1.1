"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";
import type { Tables } from "@/types/database.types";

type Deal = Tables<"deals">;
type DealEnrollment = Tables<"deal_enrollments">;

interface DealsResponse {
  data: Deal[];
  next_cursor: string | null;
  has_more: boolean;
}

interface EnrollmentsResponse {
  data: DealEnrollment[];
  next_cursor: string | null;
  has_more: boolean;
}

/**
 * QUERY-05: Filtered deal listings with pagination
 */
export function useDeals(filters?: { status?: string; tier?: string }) {
  return useInfiniteQuery({
    queryKey: queryKeys.deals.list(filters),
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "12" });
      if (filters?.status) params.set("status", filters.status);
      if (filters?.tier) params.set("tier", filters.tier);
      if (pageParam) params.set("cursor", pageParam);

      const res = await fetch(`/api/deals?${params}`);
      if (!res.ok) throw new Error("Failed to fetch deals");
      return res.json() as Promise<DealsResponse>;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

/**
 * QUERY-08 partial: User's deal enrollments
 */
export function useDealEnrollments() {
  return useQuery({
    queryKey: queryKeys.deals.enrollments(),
    queryFn: async () => {
      const res = await fetch("/api/deals/enrollments");
      if (!res.ok) throw new Error("Failed to fetch enrollments");
      return res.json() as Promise<EnrollmentsResponse>;
    },
  });
}

/**
 * Apply to a deal, invalidates enrollments cache
 */
export function useApplyToDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dealId,
      applicationNote,
    }: {
      dealId: string;
      applicationNote?: string;
    }) => {
      const res = await fetch(`/api/deals/${dealId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_note: applicationNote }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error ?? "Failed to apply");
      }
      return res.json() as Promise<DealEnrollment>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.enrollments() });
    },
  });
}
