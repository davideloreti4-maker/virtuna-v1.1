import { Play } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface CoverFillProps {
  /** Ephemeral CDN cover URL (TikTok/clockworks). Absent OR failing to load → the play-tile
   *  placeholder shows through. */
  coverUrl?: string | null;
  /** Phosphor Play glyph size (px) — scale to the slot (small strip ~14, tile ~18, banner ~24). */
  playSize?: number;
  /** Alt text — covers are decorative here, so default empty. */
  alt?: string;
  /** Extra classes merged onto the <img> (e.g. a group-hover opacity transition). */
  className?: string;
}

/**
 * CoverFill — the two absolutely-positioned layers of a video-cover slot: an always-present
 * neutral Play-tile placeholder, and (when a URL is given) the ephemeral CDN cover on top. A
 * missing or expired cover hides the <img> via onError, so the placeholder shows through — a
 * cover slot is NEVER an empty/broken box.
 *
 * Usage: drop inside a `relative overflow-hidden` sized parent; render any overlays (view count,
 * duration badge) as siblings AFTER this so they sit above the cover. Matte/neutral — no accent
 * (design-system safe: reskin-matte guard stays green).
 *
 * Extracted from the grounded hook proof receipt (hook-card-block) so Account Read covers and
 * Discover outlier tiles degrade the same graceful way instead of collapsing to an empty tile.
 */
export function CoverFill({ coverUrl, playSize = 16, alt = "", className }: CoverFillProps) {
  return (
    <>
      <span
        className="absolute inset-0 flex items-center justify-center bg-white/[0.05] text-foreground-muted"
        aria-hidden="true"
      >
        <Play size={playSize} weight="fill" />
      </span>
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- ephemeral CDN cover, not a static asset
        <img
          src={coverUrl}
          alt={alt}
          loading="lazy"
          className={cn("absolute inset-0 h-full w-full object-cover", className)}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}
    </>
  );
}
