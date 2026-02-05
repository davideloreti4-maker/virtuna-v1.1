"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Inbox, TrendingUp, Flame, RotateCcw } from "lucide-react";
import { Heading } from "@/components/ui/typography";
import { CategoryTabs } from "@/components/ui/category-tabs";
import { TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getVideosByCategory, getTrendingStats } from "@/lib/trending-mock-data";
import {
  CATEGORY_LABELS,
  VALID_TABS,
  type TrendingCategory,
  type ValidTab,
  type TrendingStats,
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

/** Category icon map */
const CATEGORY_ICONS: Record<TrendingCategory, React.ReactNode> = {
  "breaking-out": <TrendingUp className="h-3.5 w-3.5" />,
  "trending-now": <Flame className="h-3.5 w-3.5" />,
  "rising-again": <RotateCcw className="h-3.5 w-3.5" />,
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
      <span className="hidden sm:inline">\u00B7</span>
      <span className="mt-0.5 w-full sm:mt-0 sm:w-auto">
        {stats.totalVideos} videos \u00B7 {formatCompactNumber(stats.totalViews)} total views
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

/** Empty state for categories with no videos. */
function EmptyState({ category }: { category: TrendingCategory }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border-glass bg-surface px-6 py-16">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-elevated">
        <Inbox className="h-7 w-7 text-foreground-muted" />
      </div>
      <p className="text-sm font-medium text-foreground-secondary">
        No videos {CATEGORY_LABELS[category].toLowerCase()} right now
      </p>
      <p className="mt-1 text-xs text-foreground-muted">Check back soon</p>
    </div>
  );
}

/** Placeholder content showing video count per category (cards come in Phase 51). */
function VideoPlaceholder({ category }: { category: TrendingCategory }) {
  const videos = getVideosByCategory(category);

  if (videos.length === 0) {
    return <EmptyState category={category} />;
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border-glass bg-surface/50 px-6 py-16">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
        <span className="text-lg font-semibold text-accent">{videos.length}</span>
      </div>
      <p className="text-sm font-medium text-foreground-secondary">
        {videos.length} videos ready
      </p>
      <p className="mt-1 text-xs text-foreground-muted">
        Video cards coming in Phase 51
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface TrendingClientProps {
  defaultTab: ValidTab;
}

/**
 * TrendingClient -- client shell for the /trending page.
 *
 * Renders heading, stats bar, category tabs with coral accent,
 * and manages tab state synced to URL search params.
 */
export function TrendingClient({ defaultTab }: TrendingClientProps) {
  const searchParams = useSearchParams();

  // Tab state: derive initial from URL, fallback to server-provided default
  const initialTab = (searchParams.get("tab") as ValidTab) || defaultTab;
  const [activeTab, setActiveTab] = useState<ValidTab>(initialTab);
  const [isLoading, setIsLoading] = useState(false);

  // Compute stats once (mock data is static)
  const stats = useMemo(() => getTrendingStats(), []);

  // Build category tab definitions with counts and icons
  const categories = useMemo(
    () =>
      VALID_TABS.map((tab) => ({
        value: tab,
        label: CATEGORY_LABELS[tab],
        icon: CATEGORY_ICONS[tab],
        count: stats.byCategory[tab].count,
      })),
    [stats]
  );

  // Handle tab change: update local state + push to URL (shallow, no server re-render)
  const handleTabChange = useCallback((value: string) => {
    const newTab = value as ValidTab;
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
      const tab = params.get("tab") as ValidTab | null;
      if (tab && VALID_TABS.includes(tab)) {
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
          {VALID_TABS.map((tab) => (
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
          <VideoPlaceholder category={activeTab} />
        )}
      </div>
    </div>
  );
}
