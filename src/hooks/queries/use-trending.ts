"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";
import type { Tables } from "@/types/database.types";

type ScrapedVideo = Tables<"scraped_videos">;

interface TrendingResponse {
  data: ScrapedVideo[];
  next_cursor: string | null;
  has_more: boolean;
}

interface TrendingStats {
  categories: Array<{
    category: string;
    video_count: number;
    avg_views: number;
    top_sounds: Array<{ name: string; count: number }>;
  }>;
  total_videos: number;
}

/**
 * QUERY-03: Infinite query for trending videos with cursor pagination
 */
export function useTrendingVideos(category: string = "trending-now") {
  return useInfiniteQuery({
    queryKey: queryKeys.trending.videos(category),
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ category, limit: "12" });
      if (pageParam) params.set("cursor", pageParam);

      const res = await fetch(`/api/trending?${params}`);
      if (!res.ok) throw new Error("Failed to fetch trending videos");
      return res.json() as Promise<TrendingResponse>;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

/**
 * QUERY-04: Stats for trending categories
 */
export function useTrendingStats() {
  return useQuery({
    queryKey: queryKeys.trending.stats(),
    queryFn: async () => {
      const res = await fetch("/api/trending/stats");
      if (!res.ok) throw new Error("Failed to fetch trending stats");
      return res.json() as Promise<TrendingStats>;
    },
  });
}
