"use client";

/**
 * use-channels — react-query hooks for the Channels page (Discover Feed Phase 1.2).
 *
 * Composes the Phase 1.1 ingest route with the existing tracked_accounts API:
 *  - useChannelWatchlist : GET /api/channels/watchlist (enriched list)
 *  - useChannelSearch    : GET /api/channels/search?q= (shared-corpus search)
 *  - useAddChannel       : POST /api/channels/ingest  → POST /api/tracked-accounts
 *                          (scrape-or-cache, then idempotently add to the watchlist)
 *  - useUntrackChannel   : DELETE /api/tracked-accounts?id= (optimistic remove)
 *
 * Mirrors use-saved-items: list query + mutations that invalidate on settle.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";
import type { ChannelWatchlistEntry } from "@/app/api/channels/watchlist/route";
import type { ChannelSearchResult } from "@/app/api/channels/search/route";

export type { ChannelWatchlistEntry, ChannelSearchResult };

interface WatchlistResponse {
  channels: ChannelWatchlistEntry[];
}

/** The ingest route's success body (Phase 1.1 ChannelIngestResult, trimmed to what the UI reads). */
export interface AddChannelResult {
  status: "scraped" | "cached";
  handle: string;
  profile: {
    handle: string;
    displayName: string;
    avatarUrl: string;
    followerCount: number;
    videoCount: number;
  };
  videosUpserted: number;
}

/** QUERY: the enriched Channels watchlist. */
export function useChannelWatchlist() {
  return useQuery({
    queryKey: queryKeys.channels.watchlist(),
    queryFn: async () => {
      const res = await fetch("/api/channels/watchlist");
      if (!res.ok) throw new Error("Failed to load watchlist");
      return (await res.json()) as WatchlistResponse;
    },
  });
}

/** QUERY: search the shared channel corpus (disabled below 2 chars). */
export function useChannelSearch(q: string) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: queryKeys.channels.search(trimmed),
    enabled: trimmed.length >= 2,
    queryFn: async () => {
      const res = await fetch(`/api/channels/search?q=${encodeURIComponent(trimmed)}`);
      if (!res.ok) throw new Error("Search failed");
      return (await res.json()) as { results: ChannelSearchResult[] };
    },
  });
}

/**
 * MUTATION: add a channel = ingest (scrape-or-cache) then track (idempotent).
 * Surfaces the ingest route's typed error message (e.g. channel_not_found) so the
 * caller can toast it verbatim.
 */
export function useAddChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (handle: string): Promise<AddChannelResult> => {
      const ingestRes = await fetch("/api/channels/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      if (!ingestRes.ok) {
        const body = (await ingestRes.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(body?.message ?? "Could not add this channel");
      }
      const ingest = (await ingestRes.json()) as AddChannelResult;

      // Track the NORMALIZED handle the ingest resolved (idempotent upsert).
      const trackRes = await fetch("/api/tracked-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "tiktok", handle: ingest.handle }),
      });
      if (!trackRes.ok) throw new Error("Added the channel but couldn't track it");

      return ingest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.channels.all });
    },
  });
}

/** MUTATION: remove a channel from the watchlist (optimistic). */
export function useUntrackChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tracked-accounts?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not remove this channel");
      return { id };
    },
    onMutate: async (id) => {
      const key = queryKeys.channels.watchlist();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<WatchlistResponse>(key);
      queryClient.setQueryData<WatchlistResponse>(key, (old) =>
        old ? { channels: old.channels.filter((c) => c.id !== id) } : old,
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.channels.watchlist(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.channels.all });
    },
  });
}
