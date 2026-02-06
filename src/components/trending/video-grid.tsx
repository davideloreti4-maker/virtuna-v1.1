"use client";

import { useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { StaggerReveal } from "@/components/motion";
import { useInfiniteVideos } from "@/hooks/use-infinite-videos";
import { VideoCard } from "./video-card";
import { VideoCardSkeleton } from "./video-card-skeleton";
import { EmptyState } from "./empty-state";
import type { TrendingCategory } from "@/types/trending";

interface VideoGridProps {
  category: TrendingCategory;
}

/**
 * VideoGrid - Responsive grid of video cards with infinite scroll.
 *
 * Uses useInfiniteVideos hook for paginated data, StaggerReveal for
 * entrance animations, and useInView for infinite scroll sentinel.
 *
 * @example
 * ```tsx
 * <VideoGrid category="trending-now" />
 * ```
 */
export function VideoGrid({ category }: VideoGridProps) {
  const { videos, hasMore, loadMore, isLoadingMore } = useInfiniteVideos(category);
  const { ref: sentinelRef, inView } = useInView({
    threshold: 0,
    rootMargin: "200px", // Trigger 200px before sentinel enters viewport
  });

  // Trigger loadMore when sentinel is visible
  useEffect(() => {
    if (inView && hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [inView, hasMore, isLoadingMore, loadMore]);

  // Empty state when no videos match category
  if (videos.length === 0) {
    return <EmptyState category={category} />;
  }

  return (
    <div>
      {/* Responsive grid with stagger animation */}
      <StaggerReveal className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video) => (
          <StaggerReveal.Item key={video.id}>
            <VideoCard
              video={video}
              onClick={() => {
                // Phase 52 will wire this to the detail modal
                console.log("[VideoCard] clicked:", video.id, video.title);
              }}
            />
          </StaggerReveal.Item>
        ))}
      </StaggerReveal>

      {/* Infinite scroll sentinel + skeleton loading */}
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
