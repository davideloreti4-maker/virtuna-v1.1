"use client";

/**
 * DiscoverGrid — the responsive outlier-tile grid + its three states
 * (Phase 08, Plan 03, Task 2 — D-13/D-16).
 *
 * Tiles are a NORMAL responsive CSS grid laid OVER the DottedGrid surface — they are
 * NOT drag-pannable (the DottedGrid base layer pans; the tiles do not). Tile min-width
 * ~164px so ~2-up at 390px, 3–4-up on wider (UI-SPEC Spacing).
 *
 * States (all copy is verbatim from the UI-SPEC Copywriting Contract):
 *   - loading  → tile skeletons, NO fake progress % (slow Apify pull, ~minutes)
 *   - error    → inline banner + Retry (reuses the ScrapeErrorBanner shape with an onRetry seam)
 *   - empty    → zero-result message (valid pull, no standout outliers)
 *   - results  → the outlier tile grid
 *
 * Reuse map:
 *   - Skeleton (src/components/ui/skeleton) — tile-shaped shimmer
 *   - ScrapeErrorBanner shape — inline error + Retry button (the original is bound to a
 *     server action, so we reuse its visual shape with an onRetry callback for the route)
 *   - CompetitorEmptyState centered-tile shape — the empty/zero state
 */

import { Compass } from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/skeleton";
import { SurfaceEmptyState, EmptyStateIcon } from "@/components/ui/surface-empty-state";
import { SurfaceErrorState } from "@/components/ui/surface-error-state";
import { OutlierTile, type OutlierTileData } from "./outlier-tile";

export type DiscoverGridState = "idle" | "loading" | "error" | "results";

interface DiscoverGridProps {
  state: DiscoverGridState;
  tiles: OutlierTileData[];
  /** The source the pull was for (handle or niche) — used in the zero-result copy. */
  sourceLabel?: string;
  /** Launches the discover→remix chain for a tile (wired from CHAIN_HANDOFFS by the client). */
  onRemix?: (tile: OutlierTileData) => void;
  /** The platformVideoId currently launching a remix (disables that tile's CTA). */
  remixPendingId?: string | null;
  /**
   * Writes the watchlist row for a tile's account (EXPLORE-05 / D-08). Forwarded to each
   * OutlierTile; the "+ Track account" button only renders when the tile is trackable.
   */
  onTrack?: (tile: OutlierTileData) => void;
  /** The platformVideoId whose track write is in flight (disables that tile's track button). */
  trackPendingId?: string | null;
  /** The set of already-tracked handles — drives each tile's "Tracking ✓" state. */
  trackedIds?: Set<string>;
  /** Re-runs the last pull (error Retry). */
  onRetry?: () => void;
  /**
   * Tile chrome variant, forwarded to every OutlierTile. `'grid'` (default) = the Discover-page
   * cream primary; `'thread'` = the in-thread Explore card's quiet tonal primary (matches its
   * sibling thread cards). See OutlierTile `variant`.
   */
  variant?: "grid" | "thread";
}

const GRID_CLASS =
  "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(164px,1fr))]";

/** One skeleton tile matching the OutlierTile footprint (badge row + card + CTA). */
function OutlierTileSkeleton() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-16 rounded" />
        <Skeleton className="h-4 w-14 rounded" />
      </div>
      <div className="border border-white/[0.06] rounded-xl p-4 space-y-3">
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-3/4 rounded" />
        <div className="grid grid-cols-4 gap-2">
          <Skeleton className="h-8 rounded" />
          <Skeleton className="h-8 rounded" />
          <Skeleton className="h-8 rounded" />
          <Skeleton className="h-8 rounded" />
        </div>
      </div>
      <Skeleton className="h-[46px] w-full rounded-lg" />
    </div>
  );
}

export function DiscoverGrid({
  state,
  tiles,
  sourceLabel,
  onRemix,
  remixPendingId,
  onTrack,
  trackPendingId,
  trackedIds,
  onRetry,
  variant = "grid",
}: DiscoverGridProps) {
  // ── Loading — tile skeletons, NO fake progress % (slow Apify pull) ──────────
  if (state === "loading") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-foreground-muted">
          Pulling outliers… this can take a few minutes.
        </p>
        <div className={GRID_CLASS} aria-busy="true" aria-label="Loading outliers">
          {Array.from({ length: 8 }).map((_, i) => (
            <OutlierTileSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // ── Error — inline banner + Retry (ScrapeErrorBanner shape) ─────────────────
  if (state === "error") {
    return (
      <SurfaceErrorState
        message="Couldn't reach that source. Check the handle or try a different niche."
        onRetry={onRetry}
      />
    );
  }

  // ── Empty / zero-result (valid pull, no standout outliers) ──────────────────
  if (state === "results" && tiles.length === 0) {
    return (
      <SurfaceEmptyState
        icon={
          <EmptyStateIcon>
            <Compass size={32} weight="thin" />
          </EmptyStateIcon>
        }
      >
        No standout outliers found for this {sourceLabel ?? "source"}. Try a broader
        niche or another handle.
      </SurfaceEmptyState>
    );
  }

  // ── Idle (pre-pull) — let the entry/empty heading carry the screen ──────────
  if (state === "idle") {
    return null;
  }

  // ── Results — the outlier tile grid over the DottedGrid surface ─────────────
  return (
    <div className={GRID_CLASS}>
      {tiles.map((tile) => (
        <OutlierTile
          key={tile.platformVideoId}
          tile={tile}
          variant={variant}
          onRemix={onRemix}
          remixPending={remixPendingId === tile.platformVideoId}
          onTrack={onTrack}
          trackPending={trackPendingId === tile.platformVideoId}
          tracked={tile.trackHandle != null && trackedIds?.has(tile.trackHandle) === true}
        />
      ))}
    </div>
  );
}
