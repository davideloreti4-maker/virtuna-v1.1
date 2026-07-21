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
 *   - NEW (Plan 11-05, EXPLORE-03): an audience-fit BAR — a thin 3-level estimate gauge
 *     ("FIT · {Strong|Fair|Weak}" + "predicted" sub-line) between the multiplier and the
 *     metrics grid. It is DATA, never the action: neutral cream + a score-zone tone
 *     (green/amber/muted), NEVER coral (one-accent law). Omitted ENTIRELY when fit is
 *     null/absent (the honest degrade gate, D-02) — never an empty/zero bar, never a
 *     fabricated level, never a persona quote (the real reaction is lazy, on tap).
 *   - NEW (Plan 11-05, EXPLORE-05): a "+ Track account" button (appears only when
 *     trackable) — a quiet, non-accent text-button that writes the watchlist row and
 *     toggles to "Tracking" with a check. Secondary to Remix; NEVER coral.
 *   - Primary CTA "Remix → Read": the SINGLE coral element on the tile (board-kit accent law —
 *     if two things are coral, one is wrong). Launches the discover→remix chain via the
 *     onRemix callback the grid/client wires from CHAIN_HANDOFFS (no card-component edit needed).
 *
 * The tile owns ALL layout (fixed renderer, THREAD-04). The model/route emits validated
 * props only (OutlierGridBlock.props.tiles[*]).
 */

import { Check, Eye, Heart, ChatCircle, ShareNetwork } from "@phosphor-icons/react";
import { SaveAffordance } from "@/components/thread/save-affordance";
import { CoverFill } from "@/components/primitives/CoverFill";
import { formatCount } from "@/lib/competitors-utils";
import type { FitLevel } from "@/lib/discover/explore-rank";

/** One Discover outlier tile — mirrors OutlierGridBlock.props.tiles[*] (blocks.ts). */
export interface OutlierTileData {
  platformVideoId: string;
  videoUrl: string;
  caption: string;
  /**
   * Cover thumbnail (clockworks videoMeta.coverUrl) — ephemeral CDN image, display-only.
   * Optional: absent → the tile renders with no cover banner (degrades to today's layout).
   */
  coverUrl?: string;
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
  /**
   * EXPLORE-03 (D-01): the audience-relative fit ESTIMATE (re-ranked math from
   * rankWithAudienceFit — NOT a SIM verdict). Level WORD only (Strong|Fair|Weak).
   * `null`/absent → the renderer OMITS the fit bar entirely (honest degrade, D-02).
   */
  fit?: { level: FitLevel } | null;
  /** EXPLORE-05 (D-08): whether this tile offers the "+ Track account" affordance. */
  trackable?: boolean;
  /** The @handle the track button writes (no '@', lowercased) — present only when trackable. */
  trackHandle?: string;
}

/**
 * Fit-bar fill geometry + tone by level (UI-SPEC §Color "Fit-score visual encoding").
 * Tones are score-zone, NEVER coral: Strong→success, Fair→warning, Weak→muted (a weak
 * *fit estimate* is honest under-promise, not an error → muted, not red).
 */
const FIT_BAR: Record<FitLevel, { width: string; color: string }> = {
  Strong: { width: "100%", color: "var(--color-success)" },
  Fair: { width: "66%", color: "var(--color-warning)" },
  Weak: { width: "33%", color: "var(--color-foreground-muted)" },
};

/** Round a multiplier to a clean "{n}×" display (1 decimal under 10×, integer above). */
function formatMultiplier(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return "—";
  if (m >= 10) return `${Math.round(m)}×`;
  return `${m.toFixed(1)}×`;
}

/** Format a duration in seconds as "m:ss" for the cover badge ("" when unknown). */
function formatDuration(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
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
  /**
   * Writes the watchlist row for this tile's account (EXPLORE-05 / D-08). The grid wires
   * this from the thread view; the tile never hard-codes the endpoint. Only invoked from
   * the "+ Track account" button, which renders only when tile.trackable.
   */
  onTrack?: (tile: OutlierTileData) => void;
  /** Disables the track button while a track write is in flight. */
  trackPending?: boolean;
  /** When true, the track button shows the persisted "Tracking ✓" state. */
  tracked?: boolean;
}

export function OutlierTile({
  tile,
  onRemix,
  remixPending = false,
  onTrack,
  trackPending = false,
  tracked = false,
}: OutlierTileProps) {
  const duration = formatDuration(tile.durationSeconds);
  const CoverTag = tile.videoUrl ? "a" : "div";
  return (
    <div className="space-y-2">
      {/* Cover — the native 9:16 vertical-video format (was a fixed 176px landscape banner that
          object-cover cropped the portrait clip INTO — reading as a letterboxed strip, not a clip).
          ALWAYS rendered so a mixed grid never goes ragged: a real scrape thumbnail (clockworks
          videoMeta.coverUrl) when we have one, else a neutral play-tile via <CoverFill>. Duration
          badge (bottom-right) is the one overlay — non-redundant with the counts row below. */}
      <CoverTag
        {...(tile.videoUrl
          ? { href: tile.videoUrl, target: "_blank", rel: "noopener noreferrer" }
          : {})}
        className="group relative block aspect-[9/16] w-full overflow-hidden rounded-[8px] border border-white/[0.06]"
        title={tile.caption || undefined}
      >
        <CoverFill coverUrl={tile.coverUrl} playSize={24} className="transition-opacity group-hover:opacity-90" />
        {duration ? (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[10px] font-medium tabular-nums text-white/90">
            {duration}
          </span>
        ) : null}
      </CoverTag>

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

      {/* NEW (EXPLORE-03 / D-01): the audience-fit BAR — a 3-level estimate gauge between
          the measured multiplier (above) and the metrics grid (below), so the eye reads
          measured-fact → predicted-fit → metrics → CTA.

          HONESTY (D-02): render ONLY when tile.fit != null. On General / no-signal the fit
          is omitted ENTIRELY — no empty/zero bar, no "fit unavailable" placeholder, no
          fabricated level. Color is a DATA MARK used once: the magnitude bar stays NEUTRAL
          cream (width alone carries the level), and the score-zone tone (success/warning/muted)
          rides the leading dot on the label — NEVER the bar fill, NEVER coral (one-accent law). */}
      {tile.fit != null && (
        <div className="space-y-1">
          <div
            className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden"
            role="presentation"
          >
            <div
              className="h-full rounded-full"
              style={{
                width: FIT_BAR[tile.fit.level].width,
                background: "linear-gradient(90deg, rgba(236,231,222,0.22), rgba(236,231,222,0.42))",
              }}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
              <span
                className="h-[6px] w-[6px] shrink-0 rounded-full"
                style={{ backgroundColor: FIT_BAR[tile.fit.level].color }}
                aria-hidden="true"
              />
              FIT · {tile.fit.level}
            </span>
            <span className="text-[11px] text-foreground-muted">
              Fit for your audience · predicted
            </span>
          </div>
        </div>
      )}

      {/* Caption + metrics — DE-BOXED (§0.5): was <VideoCard>, a bordered box-in-a-box that made
          the tile read as a card inside a card. Now a caption line + one quiet inline counts row,
          no border. Duration lives on the cover badge; the posted date trails the row. */}
      <div className="space-y-2">
        <p
          className={`line-clamp-2 text-[13px] leading-snug ${
            tile.caption ? "text-foreground" : "italic text-foreground-muted"
          }`}
        >
          {tile.caption || "No caption"}
        </p>
        <div className="flex items-center gap-3.5 text-[11px] tabular-nums text-foreground-muted">
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3 w-3" aria-hidden="true" />
            {formatCount(tile.views)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3 w-3" aria-hidden="true" />
            {formatCount(tile.likes)}
          </span>
          <span className="inline-flex items-center gap-1">
            <ChatCircle className="h-3 w-3" aria-hidden="true" />
            {formatCount(tile.comments)}
          </span>
          <span className="inline-flex items-center gap-1">
            <ShareNetwork className="h-3 w-3" aria-hidden="true" />
            {formatCount(tile.shares)}
          </span>
        </div>
      </div>

      {/* Hairline before the action row — separates the read (cover → metrics) from the do (Remix). */}
      <div className="border-t border-white/[0.06]" />

      {/* Primary CTA — "Remix →": the forward chain step, the ONE cream primary per tile
          (§0.5.7; primary ≠ accent — the legacy coral fill was retired). Single forward verb;
          it leads, and Save + Track trail BELOW it (never stacked above). */}
      <button
        type="button"
        onClick={() => onRemix?.(tile)}
        disabled={!onRemix || remixPending}
        aria-label="Remix this outlier into a Read"
        className="w-full inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{
          minHeight: "46px",
          color: "var(--color-action-foreground)",
          backgroundColor: "var(--color-action)",
          border: "none",
          cursor: onRemix && !remixPending ? "pointer" : "default",
        }}
      >
        {remixPending ? "Remixing…" : "Remix →"}
      </button>

      {/* Secondary actions — Save (always) + "+ Track account" (only when tile.trackable),
          demoted BELOW the primary (§0.5.7 — the primary leads, Save trails). Quiet NON-accent
          cream chrome — NEVER coral (the Remix CTA owns the tile's one accent). Save persists the
          outlier to the Library shelf; Track writes the watchlist row and toggles to "Tracking ✓". */}
      <div className="flex items-center gap-3">
        {tile.trackable && (
          <button
            type="button"
            onClick={() => onTrack?.(tile)}
            disabled={!onTrack || trackPending || tracked}
            aria-label={tracked ? "Account tracked" : "Track this account"}
            aria-pressed={tracked}
            className="inline-flex items-center gap-1 text-xs font-medium text-foreground-muted transition-opacity hover:text-foreground disabled:opacity-60"
            style={{ cursor: onTrack && !trackPending && !tracked ? "pointer" : "default" }}
          >
            {tracked ? (
              <>
                <Check size={13} weight="bold" aria-hidden="true" />
                Tracking
              </>
            ) : (
              trackPending ? "Tracking…" : "+ Track account"
            )}
          </button>
        )}
        <SaveAffordance
          className="ml-auto text-xs"
          item_type="outlier"
          title={tile.caption}
          snapshot={{ ...tile }}
        />
      </div>
    </div>
  );
}
