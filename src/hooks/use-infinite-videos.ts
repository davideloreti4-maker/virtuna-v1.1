"use client";

import { useState, useEffect, useCallback } from "react";
import { getVideosByCategory } from "@/lib/trending-mock-data";
import type { TrendingCategory, TrendingVideo } from "@/types/trending";

interface UseInfiniteVideosReturn {
  videos: TrendingVideo[];
  hasMore: boolean;
  loadMore: () => void;
  isLoadingMore: boolean;
  total: number;
}

/**
 * Paginated video hook with category-aware reset.
 *
 * Returns a growing slice of videos for the given category.
 * Each call to `loadMore` appends the next batch. Changing
 * `category` resets to the first page.
 *
 * @param category - Active trending category to filter by
 * @param pageSize - Number of videos per batch (default: 6, fills 2 desktop grid rows)
 */
export function useInfiniteVideos(
  category: TrendingCategory,
  pageSize = 6
): UseInfiniteVideosReturn {
  const [displayCount, setDisplayCount] = useState(pageSize);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const allVideos = getVideosByCategory(category);
  const hasMore = displayCount < allVideos.length;

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    // Brief delay for skeleton flash (perceived loading)
    const timer = setTimeout(() => {
      setDisplayCount((prev) => Math.min(prev + pageSize, allVideos.length));
      setIsLoadingMore(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [hasMore, isLoadingMore, pageSize, allVideos.length]);

  // Reset when category changes
  useEffect(() => {
    setDisplayCount(pageSize);
    setIsLoadingMore(false);
  }, [category, pageSize]);

  return {
    videos: allVideos.slice(0, displayCount),
    hasMore,
    loadMore,
    isLoadingMore,
    total: allVideos.length,
  };
}
