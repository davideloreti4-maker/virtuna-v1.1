"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BookmarkSimple, Lightning, Repeat } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassPill } from "@/components/primitives/GlassPill";
import { TikTokEmbed } from "./tiktok-embed";
import { useBookmarkStore } from "@/stores/bookmark-store";
import { useModalKeyboardNav } from "@/hooks/use-modal-keyboard-nav";
import type { TrendingVideo } from "@/types/trending";

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface VideoDetailModalProps {
  /** Video data to display, or null when closed */
  video: TrendingVideo | null;
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes (for controlled dialog) */
  onOpenChange: (open: boolean) => void;
  /** Callback to navigate between videos */
  onNavigate: (direction: "prev" | "next") => void;
  /** Whether there's a previous video to navigate to */
  hasPrevious: boolean;
  /** Whether there's a next video to navigate to */
  hasNext: boolean;
}

/**
 * VideoDetailModal - Full video detail modal with TikTok embed and actions.
 *
 * Features:
 * - TikTok embed on the left (desktop) or top (mobile)
 * - Full metadata: creator, title, stats, hashtags
 * - Action buttons: Analyze, Bookmark, Remix (disabled)
 * - Keyboard navigation: arrow keys for prev/next
 * - Closes via overlay click or escape key
 *
 * @example
 * ```tsx
 * <VideoDetailModal
 *   video={selectedVideo}
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   onNavigate={(dir) => navigateVideo(dir)}
 *   hasPrevious={currentIndex > 0}
 *   hasNext={currentIndex < videos.length - 1}
 * />
 * ```
 */
export function VideoDetailModal({
  video,
  open,
  onOpenChange,
  onNavigate,
  hasPrevious,
  hasNext,
}: VideoDetailModalProps) {
  const router = useRouter();
  const { toggleBookmark, isBookmarked, _hydrate, _isHydrated } = useBookmarkStore();

  // Hydrate bookmark store on mount (SSR safety)
  useEffect(() => {
    _hydrate();
  }, [_hydrate]);

  // Wire up keyboard navigation
  useModalKeyboardNav({
    isOpen: open,
    onPrevious: () => onNavigate("prev"),
    onNext: () => onNavigate("next"),
    hasPrevious,
    hasNext,
  });

  // Handlers
  const handleAnalyze = () => {
    if (!video) return;
    const url = `/viral-predictor?url=${encodeURIComponent(video.tiktokUrl)}`;
    router.push(url);
    onOpenChange(false);
  };

  const handleBookmark = () => {
    if (!video) return;
    toggleBookmark(video.id);
  };

  // Don't render if no video
  if (!video) return null;

  // Check bookmark state (show neutral until hydrated)
  const bookmarked = _isHydrated && isBookmarked(video.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="full"
        className="max-w-4xl p-0 overflow-hidden"
        aria-describedby={undefined}
      >
        {/* Hidden title for accessibility */}
        <DialogTitle className="sr-only">
          Video Details: {video.title}
        </DialogTitle>

        <div className="flex flex-col lg:flex-row">
          {/* TikTok Embed Section */}
          <div className="shrink-0 bg-black/40 p-4 lg:p-6 flex items-center justify-center">
            <TikTokEmbed
              videoUrl={video.tiktokUrl}
              videoId={video.id}
            />
          </div>

          {/* Metadata Section */}
          <div className="flex-1 flex flex-col p-4 lg:p-6 min-w-0">
            {/* Creator info */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full">
                <Image
                  src={video.creator.avatarUrl}
                  alt={video.creator.displayName}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-foreground truncate">
                  {video.creator.displayName}
                </div>
                <div className="text-sm text-foreground-muted">
                  {video.creator.handle}
                </div>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-lg font-medium text-foreground mb-4 line-clamp-3">
              {video.title}
            </h2>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-foreground-secondary mb-4">
              <span>{formatCompactNumber(video.views)} views</span>
              <span className="text-foreground-muted">{"\u00B7"}</span>
              <span>{formatCompactNumber(video.likes)} likes</span>
              <span className="text-foreground-muted">{"\u00B7"}</span>
              <span>{formatCompactNumber(video.shares)} shares</span>
              <span className="text-foreground-muted">{"\u00B7"}</span>
              <span>{formatRelativeDate(video.date)}</span>
            </div>

            {/* Hashtags */}
            {video.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {video.hashtags.map((tag) => (
                  <GlassPill key={tag} color="blue" size="sm">
                    {tag}
                  </GlassPill>
                ))}
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-border-glass">
              {/* Analyze button */}
              <Button
                variant="primary"
                onClick={handleAnalyze}
                className="gap-2"
              >
                <Lightning weight="fill" className="h-4 w-4" />
                Analyze
              </Button>

              {/* Bookmark button */}
              <Button
                variant="secondary"
                onClick={handleBookmark}
                className="gap-2"
              >
                <BookmarkSimple
                  weight={bookmarked ? "fill" : "regular"}
                  className="h-4 w-4"
                />
                {bookmarked ? "Bookmarked" : "Bookmark"}
              </Button>

              {/* Remix button (disabled) */}
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  disabled
                  className="gap-2"
                >
                  <Repeat className="h-4 w-4" />
                  Remix
                </Button>
                <Badge variant="info" size="sm">
                  Coming Soon
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
