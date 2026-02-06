"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { TrendingUp, Flame, RotateCcw } from "lucide-react";
import { BookmarkSimple } from "@phosphor-icons/react";
import { Heading } from "@/components/ui/typography";
import { CategoryTabs } from "@/components/ui/category-tabs";
import { TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getTrendingStats, getAllVideos } from "@/lib/trending-mock-data";
import { VideoGrid, VideoDetailModal } from "@/components/trending";
import { useBookmarkStore } from "@/stores/bookmark-store";
import {
  CATEGORY_LABELS,
  VALID_TABS,
  FILTER_TABS,
  type FilterTab,
  type TrendingStats,
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

/** Skeleton grid shown during loading transition. */
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-52 w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4 rounded-md" />
          <Skeleton className="h-3 w-1/2 rounded-md" />
        </div>
      ))}
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
 * Includes video detail modal with keyboard navigation.
 */
export function TrendingClient({ defaultTab }: TrendingClientProps) {
  const searchParams = useSearchParams();

  // Tab state: derive initial from URL, fallback to server-provided default
  const initialTab = (searchParams.get("tab") as FilterTab) || defaultTab;
  const [activeTab, setActiveTab] = useState<FilterTab>(initialTab);
  const [isLoading, setIsLoading] = useState(false);

  // Modal state
  const [selectedVideo, setSelectedVideo] = useState<TrendingVideo | null>(null);
  const isModalOpen = selectedVideo !== null;

  // Hydrate bookmark store on mount
  useEffect(() => {
    useBookmarkStore.getState()._hydrate();
  }, []);

  // Compute stats once (mock data is static)
  const stats = useMemo(() => getTrendingStats(), []);

  // Get bookmarked IDs for saved tab filtering
  const bookmarkedIds = useBookmarkStore((s) => s.bookmarkedIds);

  // Get current videos for modal navigation
  const currentVideos = useMemo(() => {
    if (activeTab === "saved") {
      return getAllVideos().filter((v) => bookmarkedIds.has(v.id));
    }
    return getAllVideos().filter((v) => v.category === activeTab);
  }, [activeTab, bookmarkedIds]);

  // Modal navigation
  const currentIndex = selectedVideo
    ? currentVideos.findIndex((v) => v.id === selectedVideo.id)
    : -1;

  const handleNavigate = useCallback(
    (direction: "prev" | "next") => {
      if (direction === "prev" && currentIndex > 0) {
        const prevVideo = currentVideos[currentIndex - 1];
        if (prevVideo) setSelectedVideo(prevVideo);
      } else if (direction === "next" && currentIndex < currentVideos.length - 1) {
        const nextVideo = currentVideos[currentIndex + 1];
        if (nextVideo) setSelectedVideo(nextVideo);
      }
    },
    [currentIndex, currentVideos]
  );

  // Build tab definitions with counts and icons
  const categories = useMemo(
    () => [
      ...VALID_TABS.map((tab) => ({
        value: tab,
        label: TAB_LABELS[tab],
        icon: TAB_ICONS[tab],
        count: stats.byCategory[tab].count,
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
    setIsLoading(true);
    setActiveTab(newTab);
    window.history.pushState(null, "", `/trending?tab=${newTab}`);

    // Brief skeleton flash for perceived loading
    setTimeout(() => setIsLoading(false), 250);
  }, []);

  // Sync active tab with browser back/forward navigation
  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab") as FilterTab | null;
      if (tab && (FILTER_TABS as readonly string[]).includes(tab)) {
        setIsLoading(true);
        setActiveTab(tab);
        setTimeout(() => setIsLoading(false), 250);
      } else {
        setActiveTab("breaking-out");
      }
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-8 md:px-8">
      {/* Page heading */}
      <Heading level={1} size={3} className="font-display">
        Trending
      </Heading>

      {/* Stats bar */}
      <StatsBar stats={stats} />

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

      {/* Tab content area */}
      <div className="mt-6">
        {isLoading ? (
          <SkeletonGrid />
        ) : (
          <VideoGrid
            filterTab={activeTab}
            onVideoClick={(video) => setSelectedVideo(video)}
          />
        )}
      </div>

      {/* Video detail modal */}
      <VideoDetailModal
        video={selectedVideo}
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!open) setSelectedVideo(null);
        }}
        onNavigate={handleNavigate}
        hasPrevious={currentIndex > 0}
        hasNext={currentIndex < currentVideos.length - 1}
      />
    </div>
  );
}
