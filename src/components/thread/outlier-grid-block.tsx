"use client";

/**
 * OutlierGridBlockRenderer — in-thread renderer for the `outlier-grid` block
 * (Phase 08, Plan 03 — D-13/D-14; UPGRADED Phase 11, Plan 05, Task 3 — Pitfall 2).
 *
 * The Discover grid is primarily its OWN browsable view (DiscoverClient), but the typed-tile shape
 * also lets a pull render in-thread (UI-SPEC B2). This renderer maps the validated OutlierGridBlock
 * props onto the same DiscoverGrid (results state) so the in-thread tiles reuse the exact tile
 * layout — no model-generated UI (THREAD-04).
 *
 * ACTIONS COME FROM CONTEXT NOW (thread unification). They used to arrive only as PROPS, wired by
 * ExploreThreadView — and since `MessageBlocks` passes nothing but `block` to a renderer, a
 * persisted grid rehydrated through the unified stream rendered INERT tiles. That single gap is why
 * `outlier-grid` had to be filtered out of the unified stream and rendered by a separate per-skill
 * view, which is the split that lost work on a skill switch. Reading `OutlierGridActionsContext`
 * lets the grid live in the one stream like every other card.
 *
 * Props still WIN over context, so the Discover-page static reference (passes neither) and any
 * direct caller keep their exact behavior.
 *
 * The count hero + card frame live HERE rather than in a view, because both derive from
 * `block.props.tiles` — so they render identically for a live pull and a reloaded one. In the old
 * split, the hero was view-only and silently vanished the moment the grid rehydrated elsewhere.
 *
 * The block type is the single source of truth from blocks.ts (no local interface), so the Phase 11
 * tile fields (fit / trackable / trackHandle) flow through automatically.
 */

import { DiscoverGrid } from "@/components/discover/discover-grid";
import { SkillResultCard } from "@/components/thread/skill-result-card";
import { useOutlierGridActions } from "@/lib/hook-test-context";
import type { OutlierTileData } from "@/components/discover/outlier-tile";
import type { OutlierGridBlock } from "@/lib/tools/blocks";

interface OutlierGridBlockRendererProps {
  block: OutlierGridBlock;
  /**
   * Launches the discover→remix chain for a tile (CHAIN_HANDOFFS "Remix → Read").
   * Overrides context; omitted on the static Discover-page reference.
   */
  onRemix?: (tile: OutlierTileData) => void;
  /** Writes the watchlist row for a tile's account (EXPLORE-05 / D-08). Overrides context. */
  onTrack?: (tile: OutlierTileData) => void;
  /** The platformVideoId whose remix launch is in flight (disables that tile's CTA). */
  remixPendingId?: string | null;
  /** The platformVideoId whose track write is in flight (disables that tile's track button). */
  trackPendingId?: string | null;
  /** The set of already-tracked handles — drives each tile's "Tracking ✓" state. */
  trackedIds?: Set<string>;
  /**
   * Tile chrome variant. Defaults to `'thread'` here — this renderer only runs in-thread, so its
   * tiles wear the quiet tonal primary that matches the sibling thread cards. The Discover PAGE
   * renders DiscoverGrid directly (cream), never this block.
   */
  variant?: "grid" | "thread";
  /** Hide the count hero (a caller that draws its own heading). Default false. */
  hideHero?: boolean;
}

export function OutlierGridBlockRenderer({
  block,
  onRemix,
  onTrack,
  remixPendingId,
  trackPendingId,
  trackedIds,
  variant = "thread",
  hideHero = false,
}: OutlierGridBlockRendererProps) {
  const ctx = useOutlierGridActions();

  // Props win over context: a direct caller keeps full control, the thread gets live tiles for free.
  const resolvedRemix = onRemix ?? (ctx?.onRemix as ((tile: OutlierTileData) => void) | undefined);
  const resolvedTrack = onTrack ?? (ctx?.onTrack as ((tile: OutlierTileData) => void) | undefined);
  const resolvedRemixPending = remixPendingId ?? ctx?.remixPendingId ?? null;
  const resolvedTrackPending = trackPendingId ?? ctx?.trackPendingId ?? null;
  const resolvedTrackedIds = trackedIds ?? ctx?.trackedIds;

  // Finding-first framing (§0.5.2): how many measured outliers this pull surfaced, so the grid
  // reads as a result instead of an unlabelled wall of tiles.
  const count = block.props.tiles.length;
  const hero =
    !hideHero && count > 0
      ? `${count} ${count === 1 ? "outlier" : "outliers"}, scored for your audience`
      : null;

  const grid = (
    <DiscoverGrid
      state="results"
      tiles={block.props.tiles}
      sourceLabel={block.props.mode === "niche" ? "niche" : "handle"}
      variant={variant}
      onRemix={resolvedRemix}
      onTrack={resolvedTrack}
      remixPendingId={resolvedRemixPending}
      trackPendingId={resolvedTrackPending}
      trackedIds={resolvedTrackedIds}
    />
  );

  if (hideHero) return grid;

  return (
    <div className="flex flex-col gap-3">
      {hero && (
        <p className="text-reading font-semibold leading-snug tracking-[-0.01em] text-foreground">
          {hero}
        </p>
      )}
      <SkillResultCard>{grid}</SkillResultCard>
    </div>
  );
}
