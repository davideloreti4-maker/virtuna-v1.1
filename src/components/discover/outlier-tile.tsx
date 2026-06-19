"use client";

/**
 * OutlierTile — a single Discover outlier tile (Phase 08, Plan 03, Task 2 — D-13/D-14/D-16).
 *
 * Composition (REUSE-first — does NOT re-roll the metrics grid):
 *   - VideoCard metrics grid (4-col Eye/Heart/MessageCircle/Share2) — reused verbatim.
 *   - Outlier-multiplier badge: "{n}× vs own" | "{n}× vs niche" — 20px/600 tabular-nums,
 *     NEUTRAL foreground, NEVER coral, NEVER a bare "{n}×" (D-05 / UI-SPEC Color rules).
 *     The multiplier is MEASURED scrape arithmetic (views/baseline), NOT a SIM score (Pitfall 5).
 *   - Source sub-tag: "Your channel" | "Competitor" (profile, D-15) / niche label (niche).
 *   - Primary CTA "Remix → Read": the SINGLE coral element on the tile (board-kit accent law —
 *     if two things are coral, one is wrong). Launches the discover→remix chain via the
 *     onRemix callback the grid/client wires from CHAIN_HANDOFFS (no card-component edit needed).
 *
 * The tile owns ALL layout (fixed renderer, THREAD-04). The model/route emits validated
 * props only (OutlierGridBlock.props.tiles[*]).
 */

import { VideoCard } from "@/components/competitors/detail/video-card";

/** One Discover outlier tile — mirrors OutlierGridBlock.props.tiles[*] (blocks.ts). */
export interface OutlierTileData {
  platformVideoId: string;
  videoUrl: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  durationSeconds: number;
  postedAt: string; // ISO string
  /** Measured outlier signal (views / baseline) — NOT a SIM score. */
  multiplier: number;
  /** D-05 honesty label — renderer NEVER shows a bare multiplier. */
  baselineLabel: "vs own" | "vs niche";
  /** D-15 source tag: "Your channel" | "Competitor" | niche label. */
  source: string;
}

/** Round a multiplier to a clean "{n}×" display (1 decimal under 10×, integer above). */
function formatMultiplier(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return "—";
  if (m >= 10) return `${Math.round(m)}×`;
  return `${m.toFixed(1)}×`;
}

interface OutlierTileProps {
  tile: OutlierTileData;
  /**
   * Launches the discover→remix chain (CHAIN_HANDOFFS "Remix → Read").
   * The grid/client wires this from the registry; the tile never hard-codes the endpoint.
   * Receives the tile's videoUrl (the rehost anchor) + the platformVideoId for dedupe.
   */
  onRemix?: (tile: OutlierTileData) => void;
  /** Disables the CTA while a remix launch is in flight. */
  remixPending?: boolean;
}

export function OutlierTile({ tile, onRemix, remixPending = false }: OutlierTileProps) {
  return (
    <div className="space-y-2">
      {/* Multiplier badge (neutral — data, NOT the action) + source sub-tag */}
      <div className="flex items-start justify-between gap-2">
        {/* D-05: ALWAYS render the multiplier WITH its baseline label — never bare. */}
        <span className="flex items-baseline gap-1">
          <span
            className="text-xl font-semibold text-foreground leading-none"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatMultiplier(tile.multiplier)}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
            {tile.baselineLabel}
          </span>
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted px-1.5 py-0.5 rounded bg-white/[0.04] shrink-0">
          {tile.source}
        </span>
      </div>

      {/* Caption + 4-col metrics grid — REUSE VideoCard verbatim (do NOT re-roll the grid).
          video_url is null so VideoCard renders as a plain div (no whole-tile link) —
          the "Remix → Read" CTA below owns the tile's single action. */}
      <VideoCard
        video={{
          caption: tile.caption || null,
          views: tile.views,
          likes: tile.likes,
          comments: tile.comments,
          shares: tile.shares,
          saves: tile.saves,
          duration_seconds: tile.durationSeconds,
          posted_at: tile.postedAt,
          video_url: null,
          engagementRate: null,
        }}
      />

      {/* Primary CTA — "Remix → Read": the ONE coral element on the tile (accent law). */}
      <button
        type="button"
        onClick={() => onRemix?.(tile)}
        disabled={!onRemix || remixPending}
        aria-label="Remix this outlier into a Read"
        className="w-full inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
        style={{
          minHeight: "46px",
          color: "#FF7F50",
          backgroundColor: "rgba(255,127,80,0.08)",
          border: "1px solid rgba(255,127,80,0.30)",
          cursor: onRemix && !remixPending ? "pointer" : "default",
        }}
      >
        {remixPending ? "Remixing…" : "Remix → Read"}
      </button>
    </div>
  );
}
