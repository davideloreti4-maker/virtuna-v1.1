"use client";

import { useEffect, useMemo } from "react";
import { useInView } from "react-intersection-observer";
import { StaggerReveal } from "@/components/motion";
import { useInfiniteVideos } from "@/hooks/use-infinite-videos";
import { useBookmarkStore } from "@/stores/bookmark-store";
import { getAllVideos } from "@/lib/trending-mock-data";
import { VideoCard } from "./video-card";
import { VideoCardSkeleton } from "./video-card-skeleton";
import { EmptyState } from "./empty-state";
import type { FilterTab, TrendingCategory, TrendingVideo } from "@/types/trending";

export interface VideoGridProps {
  /** The filter tab (category or "saved") */
  filterTab: FilterTab;
  /** Callback when a video card is clicked */
  onVideoClick?: (video: TrendingVideo) => void;
}

/**
 * VideoGrid - Responsive grid of video cards with infinite scroll.
 *
 * Uses useInfiniteVideos hook for paginated data, StaggerReveal for
 * entrance animations, and useInView for infinite scroll sentinel.
 *
 * For the "saved" tab, shows bookmarked videos without infinite scroll.
 *
 * @example
 * ```tsx
 * <VideoGrid
 *   filterTab="trending-now"
 *   onVideoClick={(video) => setSelectedVideo(video)}
 * />
 * ```
 */
export function VideoGrid({ filterTab, onVideoClick }: VideoGridProps) {
  const isSaved = filterTab === "saved";

  // For category tabs, use infinite scroll
  const infiniteResult = useInfiniteVideos(
    isSaved ? "breaking-out" : (filterTab as TrendingCategory)
  );

  // For saved tab, get all bookmarked videos
  const bookmarkedIds = useBookmarkStore((s) => s.bookmarkedIds);
  const savedVideos = useMemo(() => {
    if (!isSaved) return [];
    return getAllVideos().filter((v) => bookmarkedIds.has(v.id));
  }, [isSaved, bookmarkedIds]);

  const { ref: sentinelRef, inView } = useInView({
    threshold: 0,
    rootMargin: "200px", // Trigger 200px before sentinel enters viewport
  });

  // Trigger loadMore when sentinel is visible (only for category tabs)
  useEffect(() => {
    if (!isSaved && inView && infiniteResult.hasMore && !infiniteResult.isLoadingMore) {
      infiniteResult.loadMore();
    }
  }, [isSaved, inView, infiniteResult]);

  // Determine videos to display
  const videos = isSaved ? savedVideos : infiniteResult.videos;
  const hasMore = isSaved ? false : infiniteResult.hasMore;
  const isLoadingMore = isSaved ? false : infiniteResult.isLoadingMore;

  // Empty state when no videos match filter
  if (videos.length === 0) {
    return <EmptyState filterTab={filterTab} />;
  }

  return (
    <div>
      {/* Responsive grid with stagger animation */}
      <StaggerReveal className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video) => (
          <StaggerReveal.Item key={video.id}>
            <VideoCard
              video={video}
              onClick={() => onVideoClick?.(video)}
            />
          </StaggerReveal.Item>
        ))}
      </StaggerReveal>

      {/* Infinite scroll sentinel + skeleton loading (only for category tabs) */}
      {hasMore && (
        <div ref={sentinelRef} className="mt-5">
          {isLoadingMore && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <VideoCardSkeleton key={`skeleton-${i}`} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
