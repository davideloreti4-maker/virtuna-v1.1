"use client";

/**
 * FeedClient — Discover Feed Phase 2.2 orchestrator for /feed.
 *
 * The persistent Videos feed: a Watched | Trending tab switch over GET /api/feed, a
 * filter sidebar, a sort menu, and an infinite-scroll tile grid (DiscoverGrid/OutlierTile
 * reused verbatim). Every tile keeps the moat actions — Remix → Read launches the
 * discover→remix chain (CHAIN_HANDOFFS, mirrors discover-client), Save persists to the
 * Library shelf (self-contained in the tile), and Track adds the channel to the watchlist.
 *
 * Tab-aware by construction: trending rows carry no outlier_multiplier, so the trending tab
 * drops the outlier sort/filter and per-channel narrowing (otherwise the NOT-NULL keyset
 * would empty the grid). The tracked-handle set is read from the Channels watchlist cache so
 * a Track here lights up the tile and the Channels page together.
 */
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { handoffsFor } from "@/lib/tools/chain-handoff";
import { useChannelWatchlist } from "@/hooks/queries/use-channels";
import {
  useFeed,
  useTrackAccount,
  type FeedFilterState,
} from "@/hooks/queries/use-feed";
import type { FeedTab, FeedSort, FeedTile } from "@/lib/feed/feed-query";
import type { OutlierTileData } from "@/components/discover/outlier-tile";
import { FeedToolbar, type SortOption } from "@/components/feed/feed-toolbar";
import { FeedFilters, type WatchedChannelOption } from "@/components/feed/feed-filters";
import { FeedResults } from "@/components/feed/feed-results";

const DEFAULT_PLATFORM = "tiktok";

// Sort options per tab. Trending has no outlier_multiplier → no "Biggest outlier".
const WATCHED_SORTS: SortOption[] = [
  { value: "outlier", label: "Biggest outlier" },
  { value: "recent", label: "Most recent" },
  { value: "views", label: "Most viewed" },
  { value: "engagement", label: "Most engaging" },
];
const TRENDING_SORTS: SortOption[] = [
  { value: "views", label: "Most viewed" },
  { value: "recent", label: "Most recent" },
  { value: "engagement", label: "Most engaging" },
];

/** Serialize the loaded tiles to CSV for the Export action (RFC-4180-ish quoting). */
function toCsv(tiles: FeedTile[]): string {
  const header = [
    "source",
    "caption",
    "views",
    "likes",
    "comments",
    "shares",
    "outlier_multiplier",
    "engagement_rate",
    "posted_at",
    "url",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = tiles.map((t) => {
    const engagement =
      t.views > 0 ? ((t.likes + t.comments + t.shares) / t.views).toFixed(4) : "0";
    return [
      t.source,
      t.caption,
      t.views,
      t.likes,
      t.comments,
      t.shares,
      t.multiplier || "",
      engagement,
      t.postedAt,
      t.videoUrl,
    ];
  });
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

export function FeedClient() {
  const router = useRouter();
  const { toast } = useToast();

  const [tab, setTab] = useState<FeedTab>("watched");
  const [sort, setSort] = useState<FeedSort>("outlier");
  const [filters, setFilters] = useState<FeedFilterState>({});
  const [filtersResetKey, setFiltersResetKey] = useState(0);
  const [remixPendingId, setRemixPendingId] = useState<string | null>(null);
  const [trackPendingId, setTrackPendingId] = useState<string | null>(null);
  const [addVideoPending, setAddVideoPending] = useState(false);

  const feed = useFeed({ tab, sort, filters });
  const { data: watchlistData } = useChannelWatchlist();
  const trackAccount = useTrackAccount();

  // Dedup-flatten the keyset pages (defensive — platform_video_id is unique per row).
  const tiles = useMemo<FeedTile[]>(() => {
    const seen = new Set<string>();
    const out: FeedTile[] = [];
    for (const page of feed.data?.pages ?? []) {
      for (const t of page.tiles) {
        if (!seen.has(t.platformVideoId)) {
          seen.add(t.platformVideoId);
          out.push(t);
        }
      }
    }
    return out;
  }, [feed.data]);

  const firstPage = feed.data?.pages?.[0];
  const watchedEmpty = tab === "watched" && firstPage?.watchedEmpty === true;
  const total = firstPage?.total ?? 0;

  // Tracked handles + channel-narrowing options, both derived from the watchlist cache.
  const watchlist = useMemo(() => watchlistData?.channels ?? [], [watchlistData]);
  const trackedIds = useMemo(
    () => new Set(watchlist.map((c) => c.handle)),
    [watchlist],
  );
  const watchedChannels = useMemo<WatchedChannelOption[]>(
    () => watchlist.map((c) => ({ handle: c.handle, label: c.displayName ?? `@${c.handle}` })),
    [watchlist],
  );

  const sortOptions = tab === "watched" ? WATCHED_SORTS : TRENDING_SORTS;

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.q) n++;
    if (filters.minOutlier != null) n++;
    if (filters.minViews != null) n++;
    if (filters.minEngagement != null) n++;
    if (filters.postedWithinDays != null) n++;
    if (filters.channels && filters.channels.length > 0) n++;
    return n;
  }, [filters]);

  const handleTabChange = (next: FeedTab) => {
    if (next === tab) return;
    setTab(next);
    if (next === "trending") {
      // Drop the watched-only dimensions so the trending NOT-NULL keyset isn't emptied.
      if (sort === "outlier") setSort("views");
      setFilters((f) => ({ ...f, minOutlier: undefined, channels: undefined }));
    }
  };

  const patchFilters = useCallback((patch: Partial<FeedFilterState>) => {
    setFilters((f) => ({ ...f, ...patch }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setFiltersResetKey((k) => k + 1); // remount FeedFilters so the search box clears too
  }, []);

  // Launch the discover→remix chain — endpoint from the CHAIN_HANDOFFS registry.
  const launchRemix = useCallback(
    async (url: string, pendingId: string | null) => {
      const handoff = handoffsFor("discover").find((h) => h.to === "remix");
      if (!handoff?.endpoint || !url) {
        toast({ variant: "error", title: "That video has no URL to remix" });
        return;
      }
      if (pendingId) setRemixPendingId(pendingId);
      else setAddVideoPending(true);
      try {
        await fetch(handoff.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, platform: DEFAULT_PLATFORM }),
        });
        router.push("/home");
      } catch {
        setRemixPendingId(null);
        setAddVideoPending(false);
        toast({ variant: "error", title: "Couldn't start that remix" });
      }
    },
    [router, toast],
  );

  const handleRemix = useCallback(
    (tile: OutlierTileData) => void launchRemix(tile.videoUrl, tile.platformVideoId),
    [launchRemix],
  );
  const handleAddVideoUrl = useCallback(
    (url: string) => void launchRemix(url, null),
    [launchRemix],
  );

  const handleTrack = useCallback(
    (tile: OutlierTileData) => {
      const handle = tile.trackHandle;
      if (!handle) return;
      setTrackPendingId(tile.platformVideoId);
      trackAccount.mutate(handle, {
        onSuccess: () => toast({ variant: "success", title: `Tracking @${handle}` }),
        onError: () => toast({ variant: "error", title: "Couldn't track this channel" }),
        onSettled: () => setTrackPendingId(null),
      });
    },
    [trackAccount, toast],
  );

  const handleExport = useCallback(() => {
    if (tiles.length === 0 || typeof document === "undefined") return;
    const blob = new Blob([toCsv(tiles)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feed-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [tiles, tab]);

  const results = (
    <FeedResults
      isLoading={feed.isLoading}
      isError={feed.isError}
      onRetry={() => void feed.refetch()}
      tiles={tiles}
      tab={tab}
      watchedEmpty={watchedEmpty}
      filtersActive={activeCount > 0}
      onClearFilters={clearFilters}
      onRemix={handleRemix}
      remixPendingId={remixPendingId}
      onTrack={handleTrack}
      trackPendingId={trackPendingId}
      trackedIds={trackedIds}
      hasNextPage={feed.hasNextPage}
      isFetchingNextPage={feed.isFetchingNextPage}
      onLoadMore={() => void feed.fetchNextPage()}
    />
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-medium text-foreground">Videos</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Outliers from the channels you watch, plus what&apos;s trending. Remix any winner
          into a Read.
        </p>
      </header>

      <FeedToolbar
        tab={tab}
        onTabChange={handleTabChange}
        sort={sort}
        onSortChange={setSort}
        sortOptions={sortOptions}
        total={total}
        onAddVideoUrl={handleAddVideoUrl}
        addVideoPending={addVideoPending}
        onExport={handleExport}
        exportDisabled={tiles.length === 0}
      />

      <div className="mt-6">
        {watchedEmpty ? (
          results
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[220px_1fr]">
            <FeedFilters
              key={filtersResetKey}
              tab={tab}
              filters={filters}
              onPatch={patchFilters}
              onClear={clearFilters}
              watchedChannels={watchedChannels}
              activeCount={activeCount}
            />
            {results}
          </div>
        )}
      </div>
    </div>
  );
}
