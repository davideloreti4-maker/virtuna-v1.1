"use client";

/**
 * use-feed — react-query hooks for the Videos feed (Discover Feed Phase 2.2).
 *
 *  - useFeed         : infinite query over GET /api/feed (keyset-paginated on nextCursor).
 *                      Keyed by tab + sort + the full filter set, so any change starts a
 *                      fresh query rather than appending to a mismatched page list.
 *  - useTrackAccount : POST /api/tracked-accounts — track a channel straight from a feed
 *                      tile (idempotent). Invalidates the Channels watchlist so the tile's
 *                      "Tracking ✓" state and the Channels page stay in sync.
 *
 * The feed page derives the already-tracked handle set from useChannelWatchlist (the same
 * cache the Channels page uses), so a track here lights up the tile and the watchlist row.
 */
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";
import type { FeedTab, FeedSort, FeedTile } from "@/lib/feed/feed-query";

/** The client-side filter state the toolbar/sidebar drive (q is the debounced value). */
export interface FeedFilterState {
  q?: string;
  minOutlier?: number;
  minViews?: number;
  minEngagement?: number;
  postedWithinDays?: number;
  /** creator_handle narrowing (watched tab only) — intersects with the watched set. */
  channels?: string[];
}

export interface UseFeedArgs {
  tab: FeedTab;
  sort: FeedSort;
  filters: FeedFilterState;
}

/** GET /api/feed success body (mirrors FeedPage + the route's empty-watchlist short-circuit). */
export interface FeedPageResponse {
  tiles: FeedTile[];
  total: number;
  nextCursor: string | null;
  watchedEmpty?: boolean;
}

/** Build the /api/feed query string from the current args (+ optional keyset cursor). */
export function buildFeedQuery(args: UseFeedArgs, cursor?: string): string {
  const sp = new URLSearchParams();
  sp.set("tab", args.tab);
  sp.set("sort", args.sort);
  if (cursor) sp.set("cursor", cursor);

  const f = args.filters;
  if (f.q && f.q.trim()) sp.set("q", f.q.trim());
  if (f.minOutlier != null) sp.set("minOutlier", String(f.minOutlier));
  if (f.minViews != null) sp.set("minViews", String(f.minViews));
  if (f.minEngagement != null) sp.set("minEngagement", String(f.minEngagement));
  if (f.postedWithinDays != null) sp.set("postedWithinDays", String(f.postedWithinDays));
  if (f.channels && f.channels.length > 0) sp.set("channels", f.channels.join(","));

  return sp.toString();
}

/** QUERY: the infinite Videos feed (keyset pagination on nextCursor). */
export function useFeed(args: UseFeedArgs) {
  return useInfiniteQuery({
    queryKey: queryKeys.feed.list(args),
    queryFn: async ({ pageParam }) => {
      const res = await fetch(`/api/feed?${buildFeedQuery(args, pageParam)}`);
      if (!res.ok) throw new Error("Failed to load feed");
      return (await res.json()) as FeedPageResponse;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/**
 * MUTATION: track a channel from a feed tile (idempotent upsert).
 * Invalidates the channels namespace so the watchlist-derived tracked set updates
 * (the tile flips to "Tracking ✓") and the Channels page reflects the new row.
 */
export function useTrackAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (handle: string): Promise<{ handle: string }> => {
      const res = await fetch("/api/tracked-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "tiktok", handle }),
      });
      if (!res.ok) throw new Error("Could not track this channel");
      return { handle };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.channels.all });
    },
  });
}
