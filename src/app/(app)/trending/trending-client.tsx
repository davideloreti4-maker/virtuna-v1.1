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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format large numbers compactly: 1200000 -> "1.2M", 45000 -> "45K" */
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

/** Tab icon map (includes saved) */
const TAB_ICONS: Record<FilterTab, React.ReactNode> = {
  "breaking-out": <TrendingUp className="h-3.5 w-3.5" />,
  "trending-now": <Flame className="h-3.5 w-3.5" />,
  "rising-again": <RotateCcw className="h-3.5 w-3.5" />,
  saved: <BookmarkSimple weight="fill" className="h-3.5 w-3.5" />,
};

/** Tab labels (extends CATEGORY_LABELS with saved) */
const TAB_LABELS: Record<FilterTab, string> = {
  ...CATEGORY_LABELS,
  saved: "Saved",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Stats bar showing category counts and aggregate metrics. */
function StatsBar({ stats }: { stats: TrendingStats }) {
  const categoryParts = VALID_TABS.map(
    (tab) => `${CATEGORY_LABELS[tab]} (${stats.byCategory[tab].count})`
  );

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-1.5 text-sm text-foreground-muted">
      <span>{categoryParts.join(" \u00B7 ")}</span>
      <span className="hidden sm:inline">{"\u00B7"}</span>
      <span className="mt-0.5 w-full sm:mt-0 sm:w-auto">
        {stats.totalVideos} videos {"\u00B7"} {formatCompactNumber(stats.totalViews)} total views
      </span>
    </div>
  );
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface TrendingClientProps {
  defaultTab: FilterTab;
}

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

  // Bookmark store hydration is now handled by the VideoGrid component
  // via the useBookmarks() TanStack Query hook

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
      {
        value: "saved" as const,
        label: TAB_LABELS.saved,
        icon: TAB_ICONS.saved,
        // No count for saved per CONTEXT.md
      },
    ],
    [stats]
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
    <div className="mx-auto max-w-[1280px] px-6 py-8 md:px-8">
      {/* Page heading */}
      <Heading level={1} size={3}>
        Trending
      </Heading>

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
          categories={categories}
          value={activeTab}
          onValueChange={handleTabChange}
          className="[&_[data-state=active]]:bg-accent/10 [&_[data-state=active]]:text-accent [&_[data-state=active]]:border-accent/20"
        >
          {FILTER_TABS.map((tab) => (
            <TabsContent key={tab} value={tab}>
              {/* Content renders outside sticky bar */}
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
