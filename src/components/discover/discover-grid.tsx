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
  /** Re-runs the last pull (error Retry). */
  onRetry?: () => void;
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
  onRetry,
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
      <div className="border border-red-500/20 bg-red-500/[0.05] rounded-lg p-3 flex items-center justify-between">
        <span className="text-sm text-red-400">
          Couldn&apos;t reach that source. Check the handle or try a different niche.
        </span>
        <button
          type="button"
          onClick={onRetry}
          disabled={!onRetry}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-white/[0.06] text-foreground hover:bg-white/[0.02] disabled:opacity-50 transition-colors shrink-0 ml-3"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Empty / zero-result (valid pull, no standout outliers) ──────────────────
  if (state === "results" && tiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] mb-4">
          <Compass size={32} weight="thin" className="text-foreground-muted" />
        </div>
        <p className="text-sm text-foreground-muted text-center max-w-sm">
          No standout outliers found for this {sourceLabel ?? "source"}. Try a broader
          niche or another handle.
        </p>
      </div>
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
          onRemix={onRemix}
          remixPending={remixPendingId === tile.platformVideoId}
        />
      ))}
    </div>
  );
}
