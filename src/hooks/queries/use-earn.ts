"use client";

/**
 * use-earn — the Earn page's read and its one write (plan 2026-11-24-earn, steps A and B; ruling 21).
 *
 * `useEarn` reads `GET /api/earn` (the link, the code, the name for the share card, the count of creators
 * who joined, the payment side) under `earnKeys`. Kept for five minutes: the link does not change, and the
 * numbers move slowly. It asks once: a refusal (signed out, a funnel visitor, the flag off, a server error)
 * does not get better by asking again, so there is no retry, no read when the window regains focus, and a
 * refused answer is not asked again whenever another part (Home's panel) mounts.
 *
 * `useEnrolWhop` sends `POST /api/earn/whop` (`{ username }`, or `{}` to enrol by the Whop account the app
 * knows) and puts the page it answers in place. A refusal rejects with an `EnrolError` naming it.
 */
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";

import type { EarnPage, EnrolRefusal } from "@/lib/earn/earn";

export type { EnrolRefusal };

export const earnKeys = {
  all: ["earn"] as const,
  page: ["earn", "page"] as const,
};

export const EARN_STALE_MS = 5 * 60_000;

export function useEarn(): UseQueryResult<EarnPage> {
  return useQuery({
    queryKey: earnKeys.page,
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/earn", { signal });
      if (!res.ok) throw new Error(`Earn request failed (${res.status})`);
      return (await res.json()) as EarnPage;
    },
    staleTime: EARN_STALE_MS,
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/** What `POST /api/earn/whop` refused; anything the route does not name (500, 429, no answer) is `failed`. */
const NAMED: readonly EnrolRefusal[] = ["not_found", "invalid_username", "no_account", "not_available", "already_connected", "failed"];

export class EnrolError extends Error {
  constructor(readonly refusal: EnrolRefusal) {
    super(`Enrol refused (${refusal})`);
    this.name = "EnrolError";
  }
}

/** Enrol at Whop: a typed username, or undefined for the Whop account the app knows (a paying customer). */
export function useEnrolWhop(): UseMutationResult<EarnPage, EnrolError, string | undefined> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (username) => {
      let res: Response;
      try {
        res = await fetch("/api/earn/whop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(username === undefined ? {} : { username }),
        });
      } catch {
        throw new EnrolError("failed");
      }
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const named = (body as { error?: unknown } | null)?.error;
        throw new EnrolError(NAMED.includes(named as EnrolRefusal) ? (named as EnrolRefusal) : "failed");
      }
      return body as EarnPage;
    },
    onSuccess: (page) => {
      client.setQueryData(earnKeys.page, page);
    },
  });
}
