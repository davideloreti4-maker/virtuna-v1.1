"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/primitives";
import { GlassPill } from "@/components/primitives";
import { HoverScale } from "@/components/motion/hover-scale";
import { VelocityIndicator } from "./velocity-indicator";
import {
  CATEGORY_LABELS,
  type TrendingVideo,
  type TrendingCategory,
} from "@/types/trending";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a number compactly: 1200000 -> "1.2M", 45000 -> "45K"
 */
function formatCompactNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Format an ISO date string as relative time: "2d ago", "5h ago", etc.
 */
function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffMonth > 0) return `${diffMonth}mo ago`;
  if (diffWeek > 0) return `${diffWeek}w ago`;
  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHour > 0) return `${diffHour}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return "just now";
}

/**
 * Map category to GlassPill color.
 * - breaking-out: green (growth, new)
 * - trending-now: orange (hot, viral)
 * - rising-again: blue (resurfacing)
 */
const CATEGORY_PILL_COLOR: Record<TrendingCategory, "green" | "orange" | "blue"> = {
  "breaking-out": "green",
  "trending-now": "orange",
  "rising-again": "blue",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface VideoCardProps {
  /** The trending video data to display */
  video: TrendingVideo;
  /** Click handler for the entire card */
  onClick?: () => void;
  /** Additional className for the wrapper */
  className?: string;
}

/**
 * VideoCard - Premium video card for the trending feed.
 *
 * Displays a portrait thumbnail, creator info, title, category pill,
 * velocity indicator, and view count. Composed from design system primitives.
 *
 * @example
 * ```tsx
 * <VideoCard
 *   video={trendingVideo}
 *   onClick={() => openDetailModal(trendingVideo.id)}
 * />
 * ```
 */
export function VideoCard({ video, onClick, className }: VideoCardProps) {
  const pillColor = CATEGORY_PILL_COLOR[video.category];

  return (
    <HoverScale className={cn(onClick && "cursor-pointer", className)}>
      <GlassCard
        color="orange"
        hover="none"
        padding="none"
        onClick={onClick}
        className="overflow-hidden"
      >
        {/* Thumbnail */}
        <div className="relative aspect-[4/5] w-full overflow-hidden">
          <Image
            src={video.thumbnailUrl}
            alt={video.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
          {/* Gradient overlay for text readability */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
            }}
          />
        </div>

        {/* Content area */}
        <div className="space-y-2.5 p-3">
          {/* Creator row */}
          <div className="flex items-center gap-2">
            <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full">
              <Image
                src={video.creator.avatarUrl}
                alt={video.creator.displayName}
                fill
                sizes="28px"
                className="object-cover"
              />
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="truncate text-sm font-medium text-foreground">
                {video.creator.displayName}
              </span>
              <span className="shrink-0 text-xs text-foreground-muted">
                {video.creator.handle}
              </span>
            </div>
            <span className="shrink-0 text-xs text-foreground-muted">
              {formatRelativeDate(video.date)}
            </span>
          </div>

          {/* Title */}
          <h3 className="line-clamp-2 text-[15px] font-medium leading-snug text-foreground">
            {video.title}
          </h3>

          {/* Bottom row: category pill, velocity, view count */}
          <div className="flex items-center justify-between">
            <GlassPill color={pillColor} size="sm">
              {CATEGORY_LABELS[video.category]}
            </GlassPill>

            <div className="flex items-center gap-2.5">
              <VelocityIndicator velocity={video.velocity} />
              <span className="text-xs text-foreground-muted">
                {formatCompactNumber(video.views)} views
              </span>
            </div>
          </div>
        </div>
      </GlassCard>
    </HoverScale>
  );
}
