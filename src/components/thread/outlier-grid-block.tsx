"use client";

/**
 * OutlierGridBlockRenderer — in-thread renderer for the `outlier-grid` block
 * (Phase 08, Plan 03 — D-13/D-14; UPGRADED Phase 11, Plan 05, Task 3 — Pitfall 2).
 *
 * The Discover grid is primarily its OWN browsable view (DiscoverClient), but the
 * typed-tile shape also lets a pull render in-thread (UI-SPEC B2). This renderer maps
 * the validated OutlierGridBlock props onto the same DiscoverGrid (results state) so the
 * in-thread tiles reuse the exact tile layout — no model-generated UI (THREAD-04).
 *
 * Phase 11 (Pitfall 2): this is no longer a STATIC reference. In the Explore thread,
 * ExploreThreadView owns the handlers and passes onRemix / onTrack (+ the per-tile
 * pending / tracked state) through here to the grid, so the tiles' "Remix → Read" and
 * "+ Track account" CTAs are LIVE. It remains a static reference ONLY when those
 * callbacks are omitted — the Discover-page reuse stays unchanged (callbacks optional).
 *
 * The block type is the single source of truth from blocks.ts (no local interface), so
 * the Phase 11 tile fields (fit / trackable / trackHandle) flow through automatically.
 */

import { DiscoverGrid } from "@/components/discover/discover-grid";
import type { OutlierTileData } from "@/components/discover/outlier-tile";
import type { OutlierGridBlock } from "@/lib/tools/blocks";

interface OutlierGridBlockRendererProps {
  block: OutlierGridBlock;
  /**
   * Launches the discover→remix chain for a tile (CHAIN_HANDOFFS "Remix → Read").
   * Wired by ExploreThreadView; omitted on the static Discover-page reference.
   */
  onRemix?: (tile: OutlierTileData) => void;
  /** Writes the watchlist row for a tile's account (EXPLORE-05 / D-08). */
  onTrack?: (tile: OutlierTileData) => void;
  /** The platformVideoId whose remix launch is in flight (disables that tile's CTA). */
  remixPendingId?: string | null;
  /** The platformVideoId whose track write is in flight (disables that tile's track button). */
  trackPendingId?: string | null;
  /** The set of already-tracked handles — drives each tile's "Tracking ✓" state. */
  trackedIds?: Set<string>;
  /**
   * Tile chrome variant. Defaults to `'thread'` here — this renderer only runs in-thread
   * (ExploreThreadView), so its tiles wear the quiet tonal primary that matches the sibling
   * thread cards. The Discover PAGE renders DiscoverGrid directly (cream), never this block.
   */
  variant?: "grid" | "thread";
}

export function OutlierGridBlockRenderer({
  block,
  onRemix,
  onTrack,
  remixPendingId,
  trackPendingId,
  trackedIds,
  variant = "thread",
}: OutlierGridBlockRendererProps) {
  return (
    <DiscoverGrid
      state="results"
      tiles={block.props.tiles}
      sourceLabel={block.props.mode === "niche" ? "niche" : "handle"}
      variant={variant}
      onRemix={onRemix}
      onTrack={onTrack}
      remixPendingId={remixPendingId}
      trackPendingId={trackPendingId}
      trackedIds={trackedIds}
    />
  );
}
