"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { TrendingUp, Flame, RotateCcw } from "lucide-react";
import { BookmarkSimple } from "@phosphor-icons/react";
import { Heading } from "@/components/ui/typography";
import { CategoryTabs } from "@/components/ui/category-tabs";
import { TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useTrendingStats } from "@/hooks/queries";
import { VideoGrid, VideoDetailModal } from "@/components/trending";
import { useBookmarkStore } from "@/stores/bookmark-store";
import {
  CATEGORY_LABELS,
  VALID_TABS,
  FILTER_TABS,
  type FilterTab,
  type TrendingCategory,
  type TrendingStats,
  type CategoryStats,
  type TrendingVideo,
} from "@/types/trending";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryTabs, TabsContent } from "@/components/ui/category-tabs";

/* ============================================
 * TYPES
 * ============================================ */

interface TrendingVideo {
  id: string;
  title: string;
  creator: string;
  views: number;
  likes: number;
  trendPercent: number;
  trendDirection: "up" | "steady";
  category: "dance" | "comedy" | "education" | "music" | "food";
  thumbnailGradient: string;
}

/* ============================================
 * MOCK DATA — 12 trending videos across 5 categories
 * ============================================ */

const TRENDING_VIDEOS: TrendingVideo[] = [
  {
    id: "1",
    title: "POV: When the beat drops perfectly",
    creator: "dancequeen_maya",
    views: 2_400_000,
    likes: 342_000,
    trendPercent: 42,
    trendDirection: "up",
    category: "dance",
    thumbnailGradient: "bg-gradient-to-br from-coral-900/20 to-surface",
  },
  {
    id: "2",
    title: "Things your teacher never told you about space",
    creator: "sciencewithsam",
    views: 890_000,
    likes: 124_000,
    trendPercent: 28,
    trendDirection: "up",
    category: "education",
    thumbnailGradient: "bg-gradient-to-br from-blue-900/20 to-surface",
  },
  {
    id: "3",
    title: "5-minute pasta that changed my life",
    creator: "chef_luna",
    views: 1_100_000,
    likes: 198_000,
    trendPercent: 35,
    trendDirection: "up",
    category: "food",
    thumbnailGradient: "bg-gradient-to-br from-amber-900/20 to-surface",
  },
  {
    id: "4",
    title: "When your mom finds your report card",
    creator: "funnycarlos",
    views: 3_200_000,
    likes: 521_000,
    trendPercent: 67,
    trendDirection: "up",
    category: "comedy",
    thumbnailGradient: "bg-gradient-to-br from-purple-900/20 to-surface",
  },
  {
    id: "5",
    title: "This song has been stuck in my head for 3 days",
    creator: "melodymaker_j",
    views: 1_800_000,
    likes: 287_000,
    trendPercent: 18,
    trendDirection: "up",
    category: "music",
    thumbnailGradient: "bg-gradient-to-br from-emerald-900/20 to-surface",
  },
  {
    id: "6",
    title: "Tutorial: The shuffle everyone is doing wrong",
    creator: "dancelab_official",
    views: 960_000,
    likes: 142_000,
    trendPercent: 12,
    trendDirection: "steady",
    category: "dance",
    thumbnailGradient: "bg-gradient-to-br from-coral-900/30 to-surface",
  },
  {
    id: "7",
    title: "I tried cooking with only gas station ingredients",
    creator: "foodie_experiments",
    views: 2_100_000,
    likes: 315_000,
    trendPercent: 53,
    trendDirection: "up",
    category: "food",
    thumbnailGradient: "bg-gradient-to-br from-amber-900/30 to-surface",
  },
  {
    id: "8",
    title: "Why do we dream? The real answer",
    creator: "mindblown_edu",
    views: 670_000,
    likes: 89_000,
    trendPercent: 8,
    trendDirection: "steady",
    category: "education",
    thumbnailGradient: "bg-gradient-to-br from-blue-900/30 to-surface",
  },
  {
    id: "9",
    title: "Telling strangers they look like celebrities",
    creator: "prankster_pete",
    views: 4_500_000,
    likes: 720_000,
    trendPercent: 89,
    trendDirection: "up",
    category: "comedy",
    thumbnailGradient: "bg-gradient-to-br from-purple-900/30 to-surface",
  },
  {
    id: "10",
    title: "I made a beat using only kitchen sounds",
    creator: "beatsmith_audio",
    views: 1_300_000,
    likes: 201_000,
    trendPercent: 31,
    trendDirection: "up",
    category: "music",
    thumbnailGradient: "bg-gradient-to-br from-emerald-900/30 to-surface",
  },
  {
    id: "11",
    title: "The smoothest transition you'll ever see",
    creator: "transition_king",
    views: 5_200_000,
    likes: 890_000,
    trendPercent: 95,
    trendDirection: "up",
    category: "dance",
    thumbnailGradient: "bg-gradient-to-br from-coral-900/20 to-surface",
  },
  {
    id: "12",
    title: "Why your avocado toast costs $18 — explained",
    creator: "economics_101",
    views: 420_000,
    likes: 67_000,
    trendPercent: 5,
    trendDirection: "steady",
    category: "education",
    thumbnailGradient: "bg-gradient-to-br from-blue-900/20 to-surface",
  },
];

/* ============================================
 * HELPERS
 * ============================================ */

function formatCount(n: number): string {
  if (n >= 1_000_000) {
    const value = n / 1_000_000;
    return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const value = n / 1_000;
    return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}K`;
  }
  return String(n);
}

/** Skeleton placeholder for the stats bar while loading. */
function StatsBarSkeleton() {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-1.5">
      <Skeleton className="h-4 w-64 rounded-md" />
      <Skeleton className="h-4 w-40 rounded-md" />
    </div>
  );
}

/* ============================================
 * TRENDING CLIENT — Main page component
 * ============================================ */

export function TrendingClient() {
  const [activeCategory, setActiveCategory] = useState<Category>("all");

/**
 * TrendingClient -- client shell for the /trending page.
 *
 * Renders heading, stats bar, category tabs with coral accent,
 * and manages tab state synced to URL search params.
 * Includes video detail modal for single video viewing.
 */
export function TrendingClient({ defaultTab }: TrendingClientProps) {
  const searchParams = useSearchParams();

  // Tab state: derive initial from URL, fallback to server-provided default
  const initialTab = (searchParams.get("tab") as FilterTab) || defaultTab;
  const [activeTab, setActiveTab] = useState<FilterTab>(initialTab);

  // Modal state
  const [selectedVideo, setSelectedVideo] = useState<TrendingVideo | null>(null);
  const isModalOpen = selectedVideo !== null;

  // Hydrate bookmark store on mount
  useEffect(() => {
    useBookmarkStore.getState()._hydrate();
  }, []);

  // Fetch real stats from /api/trending/stats
  const { data: statsData, isLoading: statsLoading } = useTrendingStats();

  // Adapt API stats shape to UI TrendingStats type
  const stats: TrendingStats | null = useMemo(() => {
    if (!statsData) return null;
    const byCategory = {} as Record<TrendingCategory, CategoryStats>;
    let totalViews = 0;
    for (const cat of statsData.categories) {
      const key = cat.category as TrendingCategory;
      if ((VALID_TABS as readonly string[]).includes(key)) {
        byCategory[key] = {
          count: cat.video_count,
          totalViews: cat.avg_views * cat.video_count,
        };
        totalViews += cat.avg_views * cat.video_count;
      }
    }
    // Ensure all categories exist with defaults
    for (const tab of VALID_TABS) {
      if (!byCategory[tab]) byCategory[tab] = { count: 0, totalViews: 0 };
    }
    return { totalVideos: statsData.total_videos, totalViews, byCategory };
  }, [statsData]);

  // Build tab definitions with counts and icons
  const categories = useMemo(
    () => [
      ...VALID_TABS.map((tab) => ({
        value: tab,
        label: TAB_LABELS[tab],
        icon: TAB_ICONS[tab],
        count: stats?.byCategory[tab].count,
      })),
    [],
  );

  // Handle tab change: update local state + push to URL (shallow, no server re-render)
  const handleTabChange = useCallback((value: string) => {
    const newTab = value as FilterTab;
    setActiveTab(newTab);
    window.history.pushState(null, "", `/trending?tab=${newTab}`);
  }, []);

  // Sync active tab with browser back/forward navigation
  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab") as FilterTab | null;
      if (tab && (FILTER_TABS as readonly string[]).includes(tab)) {
        setActiveTab(tab);
      } else {
        setActiveTab("breaking-out");
      }
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // TODO: Re-implement modal navigation with API data
  const handleNavigate = useCallback((_direction: "prev" | "next") => {
    // Navigation temporarily disabled -- modal still opens for single video viewing
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:p-6">
      {/* Page header */}
      <h1 className="text-3xl font-bold text-foreground">Trending</h1>
      <p className="mt-1 text-sm text-foreground-muted">
        Discover what&apos;s trending on TikTok right now
      </p>

      {/* Stats bar */}
      {statsLoading || !stats ? <StatsBarSkeleton /> : <StatsBar stats={stats} />}

      {/* Sticky tab bar with blurred background */}
      <div
        className="sticky top-0 z-10 -mx-6 mt-6 bg-background/80 px-6 pb-3 pt-2 md:-mx-8 md:px-8"
        style={{
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <CategoryTabs
          categories={categoryTabs}
          value={activeCategory}
          onValueChange={(val) => setActiveCategory(val as Category)}
        >
          {CATEGORIES.map((cat) => (
            <TabsContent key={cat} value={cat}>
              {filteredVideos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredVideos.map((video) => (
                    <VideoCard key={video.id} video={video} />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-16">
                  <p className="text-sm text-foreground-muted">
                    No trending content in this category yet
                  </p>
                </div>
              )}
            </TabsContent>
          ))}
        </CategoryTabs>
      </div>

      {/* Tab content area -- VideoGrid handles its own loading state */}
      <div className="mt-6">
        <VideoGrid
          filterTab={activeTab}
          onVideoClick={(video) => setSelectedVideo(video)}
        />
      </div>

      {/* Video detail modal */}
      <VideoDetailModal
        video={selectedVideo}
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!open) setSelectedVideo(null);
        }}
        onNavigate={handleNavigate}
        hasPrevious={false}
        hasNext={false}
      />
    </div>
  );
}
