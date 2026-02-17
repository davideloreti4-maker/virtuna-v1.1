"use client";

import { useEffect, useMemo } from "react";
import { useInView } from "react-intersection-observer";
import { StaggerReveal } from "@/components/motion";
import { useTrendingVideos } from "@/hooks/queries";
import { mapScrapedVideoToTrendingVideo } from "@/lib/mappers";
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
 * Uses useTrendingVideos hook for cursor-paginated data from /api/trending,
 * StaggerReveal for entrance animations, and useInView for infinite scroll sentinel.
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

  // For category tabs, use TanStack Query infinite scroll with cursor pagination
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTrendingVideos(isSaved ? "breaking-out" : (filterTab as TrendingCategory));

  // Flatten pages and map DB rows to UI types
  const apiVideos = useMemo(
    () =>
      data?.pages.flatMap((page) =>
        page.data.map(mapScrapedVideoToTrendingVideo)
      ) ?? [],
    [data]
  );

  // For saved tab, get all bookmarked videos
  // TODO: Replace saved tab with API-backed bookmarks query when bookmark API exists
  const bookmarkedIds = useBookmarkStore((s) => s.bookmarkedIds);
  const savedVideos = useMemo(() => {
    if (!isSaved) return [];
    return getAllVideos().filter((v) => bookmarkedIds.has(v.id));
  }, [isSaved, bookmarkedIds]);

  const { ref: sentinelRef, inView } = useInView({
    threshold: 0,
    rootMargin: "200px", // Trigger 200px before sentinel enters viewport
  });

  // Trigger fetchNextPage when sentinel is visible (only for category tabs)
  useEffect(() => {
    if (!isSaved && inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isSaved, inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Determine videos to display
  const videos = isSaved ? savedVideos : apiVideos;
  const hasMore = isSaved ? false : !!hasNextPage;
  const isLoadingMore = isSaved ? false : isFetchingNextPage;

  // Initial loading state for category tabs
  if (isLoading && !isSaved) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <VideoCardSkeleton key={`skeleton-${i}`} />
        ))}
      </div>
    );
  }

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
