"use client";

/**
 * FeedCard — the cover-forward Videos-feed tile (Discover Feed Phase 2.2 redesign, v2).
 *
 * Modeled on the Sandcastles videos grid: a full 9:16 cover leads, a platform badge sits
 * top-right, the moat actions live in a hover bar over the cover bottom (Remix → Read +
 * open + Save + Track), and the measured signals read as a pill row BELOW the cover —
 * outlier with a green ▲ / red ▼ direction, views, and engagement %. Relative post time
 * rides next to the @handle.
 *
 * Its own component (NOT the dense /discover OutlierTile, which stays as-is for /discover +
 * in-thread). The hover bar uses an @media(hover:hover) gate: hover-revealed on pointers,
 * always-visible on touch (so the actions never become unreachable). White-on-scrim over
 * photos is the house pattern; only the outlier pill carries semantic color — views +
 * engagement stay neutral matte (restrained vs Sandcastles' rainbow).
 *
 * Cover-less rows (much of Trending) AND rows whose ephemeral CDN cover 403s at render
 * (expired TikTok signatures) degrade to a designed caption POSTER — the caption on a cream
 * serif card over a matte gradient (the /start OutlierCard idiom), never a broken/blank box.
 * The poster carries the caption, so the body drops its caption line to avoid the echo.
 */
import { useState } from "react";
import {
  Check,
  Plus,
  Eye,
  Lightning,
  TrendUp,
  TrendDown,
  Play,
} from "@phosphor-icons/react";
import { SaveAffordance } from "@/components/thread/save-affordance";
import type { FeedTile } from "@/lib/feed/feed-query";
import { formatCount, formatRelativeTime } from "@/lib/competitors-utils";
import { PLATFORM_ICON, platformBadgeStyle, platformLabel } from "@/lib/platforms";
import { cn } from "@/lib/utils";

/** "{n}×" — 1 decimal under 10×, integer above. */
function formatMultiplier(m: number): string {
  return m >= 10 ? `${Math.round(m)}×` : `${m.toFixed(1)}×`;
}

/** Engagement % from the raw counts ("—" when there are no views to divide by). */
function engagementPct(t: FeedTile): string {
  if (!t.views || t.views <= 0) return "—";
  const rate = (t.likes + t.comments + t.shares) / t.views;
  return `${Math.round(rate * 100)}%`;
}

const PILL =
  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums";
/** Secondary chrome — views / engagement sit quieter than the outlier hero metric. */
const PILL_SECONDARY = cn(PILL, "bg-white/[0.06] text-foreground-muted");
/** Outlier hero — slightly heavier type so × baseline leads the row. */
const PILL_OUTLIER = cn(PILL, "text-xs font-semibold");

interface FeedCardProps {
  tile: FeedTile;
  onRemix: (tile: FeedTile) => void;
  remixPending: boolean;
  onTrack: (tile: FeedTile) => void;
  trackPending: boolean;
  tracked: boolean;
}

/** The outlier pill — green ▲ above baseline, red ▼ below, neutral at parity, null when absent. */
function OutlierPill({ m }: { m: number }) {
  if (!Number.isFinite(m) || m <= 0) return null;
  const label = formatMultiplier(m);
  const aria = `${label} account baseline`;
  if (m > 1.05) {
    return (
      <span
        className={cn(PILL_OUTLIER, "bg-success/10 text-success")}
        title={aria}
        aria-label={aria}
      >
        <TrendUp size={13} weight="bold" aria-hidden="true" />
        {label}
      </span>
    );
  }
  if (m < 0.95) {
    return (
      <span
        className={cn(PILL_OUTLIER, "bg-error/10 text-error")}
        title={aria}
        aria-label={aria}
      >
        <TrendDown size={13} weight="bold" aria-hidden="true" />
        {label}
      </span>
    );
  }
  return (
    <span
      className={cn(PILL_OUTLIER, "bg-white/[0.06] text-foreground-secondary")}
      title={aria}
      aria-label={aria}
    >
      {label}
    </span>
  );
}

export function FeedCard({
  tile,
  onRemix,
  remixPending,
  onTrack,
  trackPending,
  tracked,
}: FeedCardProps) {
  // The cover is an ephemeral CDN URL (TikTok signatures expire → 403 at render). Track a
  // load failure so a dead cover falls through to the designed poster, not a blank box.
  const [coverFailed, setCoverFailed] = useState(false);
  const showCover = Boolean(tile.coverUrl) && !coverFailed;
  const PlatformIcon = PLATFORM_ICON[tile.platform] ?? PLATFORM_ICON.tiktok!;

  // Hover bar: hover-revealed on pointer devices, always-on for touch (no unreachable actions).
  const hoverBar =
    "opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100";

  return (
    <article className="elev-lift group flex flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-background-elevated hover:border-white/[0.12]">
      {/* Cover (div, not a link — the hover bar holds the interactive bits, no nested <a>). */}
      <div className="relative aspect-[9/16] overflow-hidden bg-white/[0.03]">
        {showCover ? (
          // eslint-disable-next-line @next/next/no-img-element -- ephemeral CDN cover, not a static asset
          <img
            src={tile.coverUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            onError={() => setCoverFailed(true)}
          />
        ) : (
          // Designed poster — the caption on a cream serif card over a matte gradient
          // (echoes /start's OutlierCard). Turns a missing/expired cover into an editorial
          // tile instead of a broken image.
          <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(160deg,#312f2b,#181715)] p-3">
            <p className="line-clamp-5 rounded-md bg-[#f4f1ea] px-3 py-2.5 text-center font-serif text-[12px] font-semibold leading-[1.3] text-[#17150f]">
              {tile.caption || "Untitled"}
            </p>
          </div>
        )}

        {/* Platform badge — top-right, brand-colored mark (IG gradient / TikTok black /
            YouTube red) with a white glyph + hairline ring for separation over photos. */}
        <span
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-white ring-1 ring-white/20"
          style={platformBadgeStyle(tile.platform)}
          title={platformLabel(tile.platform)}
        >
          <PlatformIcon size={13} weight="fill" />
        </span>

        {/* Hover action bar — Remix (primary) + open + Save + Track over a bottom scrim. */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2 pb-2 pt-8 transition-opacity duration-200",
            hoverBar,
          )}
        >
          <button
            type="button"
            onClick={() => onRemix(tile)}
            disabled={remixPending}
            aria-label="Remix this outlier into a Read"
            className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-[color:var(--color-action)] px-2 text-xs font-semibold text-[color:var(--color-action-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {remixPending ? "Remixing…" : "Remix → Read"}
          </button>
          {tile.videoUrl && (
            <a
              href={tile.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Watch on source"
              title="Watch on source"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/95 transition-colors hover:bg-white/20"
            >
              <Play size={15} weight="fill" />
            </a>
          )}
          {tile.trackable && (
            <button
              type="button"
              onClick={() => onTrack(tile)}
              disabled={trackPending || tracked}
              aria-label={tracked ? "Account tracked" : "Track this account"}
              aria-pressed={tracked}
              title={tracked ? "Tracking this account" : "Track this account"}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/95 transition-colors hover:bg-white/20 disabled:opacity-60"
            >
              {tracked ? <Check size={15} weight="bold" /> : <Plus size={15} weight="bold" />}
            </button>
          )}
          <SaveAffordance
            iconOnly
            className="h-8 w-8 shrink-0 justify-center rounded-lg bg-white/10 !text-white/95 hover:bg-white/20"
            item_type="outlier"
            title={tile.caption}
            snapshot={{ ...tile }}
          />
        </div>
      </div>

      {/* Body — title (only when the cover carries the image; the poster already shows the
          caption), handle + relative time, then the measured pill row. */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {showCover && (
          <p className="line-clamp-1 text-sm text-foreground" title={tile.caption || undefined}>
            {tile.caption || "Untitled"}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 text-xs text-foreground-muted">
          <span className="min-w-0 truncate">{tile.source}</span>
          {tile.postedAt && (
            <span className="shrink-0">{formatRelativeTime(tile.postedAt)}</span>
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-0.5">
          <OutlierPill m={tile.multiplier} />
          <span
            className={PILL_SECONDARY}
            title={`${formatCount(tile.views)} views`}
            aria-label={`${formatCount(tile.views)} views`}
          >
            <Eye size={12} weight="fill" className="opacity-70" aria-hidden="true" />
            {formatCount(tile.views)}
          </span>
          <span
            className={PILL_SECONDARY}
            title={`${engagementPct(tile)} engagement`}
            aria-label={`${engagementPct(tile)} engagement`}
          >
            <Lightning size={12} weight="fill" className="opacity-70" aria-hidden="true" />
            {engagementPct(tile)}
          </span>
        </div>
      </div>
    </article>
  );
}
