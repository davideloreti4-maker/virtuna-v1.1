"use client";

/**
 * FeedResults — the Videos feed grid + its states (Discover Feed Phase 2.2 redesign, v2).
 *
 * Cover-forward 9:16 grid of FeedCard (its own component — /discover keeps the dense
 * OutlierTile). This component owns the shell around the grid:
 *   - first-load skeletons shaped like the 9:16 card
 *   - error + Retry
 *   - watched-empty → "watch channels" CTA to /feed/channels
 *   - filtered-empty → Clear filters (tab-aware copy)
 *   - infinite scroll: an IntersectionObserver sentinel below the grid calls onLoadMore
 *     when the next keyset page is available.
 */
import { useEffect, useRef } from "react";
import Link from "next/link";
import { FilmStrip, FunnelSimple, CircleNotch } from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FeedCard } from "@/components/feed/feed-card";
import type { FeedTile, FeedTab } from "@/lib/feed/feed-query";

const GRID_CLASS = "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]";

interface FeedResultsProps {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  tiles: FeedTile[];
  tab: FeedTab;
  /** Watched tab with no tracked channels — show the "watch channels" CTA. */
  watchedEmpty: boolean;
  filtersActive: boolean;
  onClearFilters: () => void;
  onRemix: (tile: FeedTile) => void;
  remixPendingId: string | null;
  onTrack: (tile: FeedTile) => void;
  trackPendingId: string | null;
  trackedIds: Set<string>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

/** One skeleton shaped like the 9:16 FeedCard (tall cover + title + handle + pill row). */
function FeedCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06]">
      <Skeleton className="aspect-[9/16] w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-5/6 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
        <div className="flex gap-1.5 pt-0.5">
          <Skeleton className="h-5 w-12 rounded-md" />
          <Skeleton className="h-5 w-12 rounded-md" />
          <Skeleton className="h-5 w-10 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/** Centered icon + message + optional action — the shared empty/CTA shape. */
function EmptyState({
  icon,
  children,
  action,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-background-elevated px-4 py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04]">
        {icon}
      </div>
      <p className="max-w-sm text-sm text-foreground-muted">{children}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function FeedResults({
  isLoading,
  isError,
  onRetry,
  tiles,
  tab,
  watchedEmpty,
  filtersActive,
  onClearFilters,
  onRemix,
  remixPendingId,
  onTrack,
  trackPendingId,
  trackedIds,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: FeedResultsProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Infinite scroll — fetch the next keyset page when the sentinel scrolls into view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          onLoadMore();
        }
      },
      { rootMargin: "800px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  // ── First load ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={GRID_CLASS} aria-busy="true" aria-label="Loading feed">
        {Array.from({ length: 10 }).map((_, i) => (
          <FeedCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/[0.05] p-3">
        <span className="text-sm text-red-400">Couldn&apos;t load your feed. Try again.</span>
        <button
          type="button"
          onClick={onRetry}
          className="ml-3 shrink-0 rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-white/[0.02]"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Watched tab, no channels yet → CTA to Channels ──────────────────────────────
  if (watchedEmpty) {
    return (
      <EmptyState
        icon={<FilmStrip size={32} weight="thin" className="text-foreground-muted" />}
        action={
          <Button asChild variant="primary" size="sm">
            <Link href="/feed/channels">Add channels</Link>
          </Button>
        }
      >
        Watch creators to fill your Videos feed. Add a few channels and their outliers show up
        here.
      </EmptyState>
    );
  }

  // ── Empty result set (filters or an empty corpus) ──────────────────────────────
  if (tiles.length === 0) {
    return (
      <EmptyState
        icon={<FunnelSimple size={32} weight="thin" className="text-foreground-muted" />}
        action={
          filtersActive ? (
            <Button variant="secondary" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : undefined
        }
      >
        {filtersActive
          ? "No videos match these filters. Try loosening them."
          : tab === "watched"
            ? "No videos from your channels yet — re-scrape from the Channels page."
            : "No trending videos right now. Check back soon."}
      </EmptyState>
    );
  }

  // ── Results — cover-forward grid; the sentinel pages the next set ────────────────
  return (
    <div className="space-y-6">
      <div className={GRID_CLASS}>
        {tiles.map((tile) => (
          <FeedCard
            key={tile.platformVideoId}
            tile={tile}
            onRemix={onRemix}
            remixPending={remixPendingId === tile.platformVideoId}
            onTrack={onTrack}
            trackPending={trackPendingId === tile.platformVideoId}
            tracked={Boolean(tile.trackHandle) && trackedIds.has(tile.trackHandle)}
          />
        ))}
      </div>
      <div ref={sentinelRef} aria-hidden="true" />
      {isFetchingNextPage && (
        <div className="flex items-center justify-center py-4 text-foreground-muted">
          <CircleNotch size={20} className="animate-spin" aria-label="Loading more" />
        </div>
      )}
    </div>
  );
}
