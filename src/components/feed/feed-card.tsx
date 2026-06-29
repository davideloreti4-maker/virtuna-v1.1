"use client";

/**
 * FeedCard — the cover-forward Videos-feed tile (Discover Feed Phase 2.2 redesign).
 *
 * Discovery feeds lead with the thumbnail, not the metrics table. So this card is its own
 * component (NOT the dense /discover OutlierTile, which stays as-is for /discover + in-thread):
 *  - a tall 4:5 cover carries the card; the measured signals ride ON it as scrim overlays
 *    (outlier multiplier top-left when present, duration top-right, views + likes bottom)
 *  - a compact body: one-line caption + source/@handle, with Save + Track as quiet icons
 *  - "Remix → Read" sits airy at rest (muted text) and lights up to the action fill on hover
 *    — always present so it stays reachable on touch / by keyboard (hover is polish, not a gate)
 *
 * White-on-scrim text over the photo is the house pattern for covers (NOT a chrome text-white
 * swap). No coral, no backdrop-filter glass — black scrims + the cream action token only.
 * Cover-less rows (much of Trending) degrade to a clean muted panel, never a broken image.
 */
import { Check, Plus, Eye, Heart, FilmStrip } from "@phosphor-icons/react";
import { SaveAffordance } from "@/components/thread/save-affordance";
import type { OutlierTileData } from "@/components/discover/outlier-tile";
import { formatCount } from "@/lib/competitors-utils";
import { cn } from "@/lib/utils";

/** "{n}×" — 1 decimal under 10×, integer above; null-ish → no chip (honest omit). */
function formatMultiplier(m: number): string | null {
  if (!Number.isFinite(m) || m <= 0) return null;
  return m >= 10 ? `${Math.round(m)}×` : `${m.toFixed(1)}×`;
}

/** "m:ss" for the cover duration badge ("" when unknown). */
function formatDuration(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

interface FeedCardProps {
  tile: OutlierTileData;
  onRemix: (tile: OutlierTileData) => void;
  remixPending: boolean;
  onTrack: (tile: OutlierTileData) => void;
  trackPending: boolean;
  tracked: boolean;
}

export function FeedCard({
  tile,
  onRemix,
  remixPending,
  onTrack,
  trackPending,
  tracked,
}: FeedCardProps) {
  const multiplier = formatMultiplier(tile.multiplier);
  const duration = formatDuration(tile.durationSeconds);
  const hasCover = Boolean(tile.coverUrl);

  // The cover's overlays — shared between the <a> (has video URL) and <div> (no URL) shells.
  const coverInner = (
    <>
      {hasCover ? (
        // eslint-disable-next-line @next/next/no-img-element -- ephemeral CDN cover, not a static asset
        <img
          src={tile.coverUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <FilmStrip size={36} weight="thin" className="text-foreground-muted/60" />
        </div>
      )}

      {/* Top scrim so the chips stay legible over bright covers. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/55 to-transparent" />

      {/* Outlier multiplier — only when measured (Trending has none → no chip). D-05: with label. */}
      {multiplier && (
        <span className="absolute left-2 top-2 inline-flex items-baseline gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-white/95">
          <span className="text-xs font-semibold tabular-nums">{multiplier}</span>
          <span className="text-[9px] font-semibold uppercase tracking-wide text-white/70">
            {tile.baselineLabel}
          </span>
        </span>
      )}

      {duration && (
        <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white/95">
          {duration}
        </span>
      )}

      {/* Bottom scrim with the headline metrics — views + likes, white-on-photo (house pattern). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-8 text-white/95">
        <span className="inline-flex items-center gap-1 text-xs font-medium tabular-nums">
          <Eye size={13} weight="fill" className="opacity-80" />
          {formatCount(tile.views)}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium tabular-nums">
          <Heart size={13} weight="fill" className="opacity-80" />
          {formatCount(tile.likes)}
        </span>
      </div>
    </>
  );

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-background-elevated transition-colors hover:border-white/[0.12]">
      {tile.videoUrl ? (
        <a
          href={tile.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block aspect-[4/5] overflow-hidden bg-white/[0.03]"
          title={tile.caption || "Watch on TikTok"}
        >
          {coverInner}
        </a>
      ) : (
        <div className="relative aspect-[4/5] overflow-hidden bg-white/[0.03]">{coverInner}</div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-1 text-sm text-foreground" title={tile.caption || undefined}>
          {tile.caption || "Untitled"}
        </p>

        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs text-foreground-muted">{tile.source}</span>
          <div className="flex shrink-0 items-center gap-0.5">
            {tile.trackable && (
              <button
                type="button"
                onClick={() => onTrack(tile)}
                disabled={trackPending || tracked}
                aria-label={tracked ? "Account tracked" : "Track this account"}
                aria-pressed={tracked}
                title={tracked ? "Tracking this account" : "Track this account"}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:opacity-60"
              >
                {tracked ? (
                  <Check size={15} weight="bold" className="text-foreground-secondary" />
                ) : (
                  <Plus size={15} weight="bold" />
                )}
              </button>
            )}
            <SaveAffordance
              iconOnly
              className="h-7 w-7 justify-center rounded-md hover:bg-white/[0.06]"
              item_type="outlier"
              title={tile.caption}
              snapshot={{ ...tile }}
            />
          </div>
        </div>

        {/* Remix → Read — airy at rest (muted text), fills with the action token on hover.
            Always rendered so it stays reachable on touch + keyboard (hover is polish only). */}
        <button
          type="button"
          onClick={() => onRemix(tile)}
          disabled={remixPending}
          aria-label="Remix this outlier into a Read"
          className={cn(
            "mt-auto inline-flex h-9 w-full items-center justify-center rounded-lg text-sm font-semibold transition-colors",
            "text-foreground-muted group-hover:text-[color:var(--color-action-foreground)] group-hover:bg-[color:var(--color-action)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10 disabled:opacity-50",
          )}
        >
          {remixPending ? "Remixing…" : "Remix → Read"}
        </button>
      </div>
    </article>
  );
}
