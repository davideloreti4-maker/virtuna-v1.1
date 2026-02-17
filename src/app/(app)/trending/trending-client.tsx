"use client";

import { useState, useMemo } from "react";
import { Play, Heart, TrendUp, ArrowUp } from "@phosphor-icons/react";

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

const CATEGORIES = ["all", "dance", "comedy", "education", "music", "food"] as const;

type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  all: "All",
  dance: "Dance",
  comedy: "Comedy",
  education: "Education",
  music: "Music",
  food: "Food",
};

/* ============================================
 * VIDEO CARD
 * ============================================ */

function VideoCard({ video }: { video: TrendingVideo }) {
  return (
    <Card className="overflow-hidden">
      {/* Thumbnail */}
      <div className={`relative aspect-video rounded-t-[12px] ${video.thumbnailGradient}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <Play size={20} weight="fill" className="text-foreground" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-sm font-medium text-foreground line-clamp-2">
          {video.title}
        </h3>
        <p className="mt-1 text-xs text-foreground-muted">
          @{video.creator}
        </p>

        {/* Metrics row */}
        <div className="mt-3 flex items-center gap-3 text-xs text-foreground-muted">
          <span>{formatCount(video.views)} views</span>
          <span className="flex items-center gap-1">
            <Heart size={12} weight="fill" />
            {formatCount(video.likes)}
          </span>
          <Badge
            variant={video.trendDirection === "up" ? "accent" : "success"}
            size="sm"
          >
            {video.trendDirection === "up" ? (
              <ArrowUp size={10} weight="bold" className="mr-0.5" />
            ) : (
              <TrendUp size={10} weight="bold" className="mr-0.5" />
            )}
            +{video.trendPercent}%
          </Badge>
        </div>

        {/* Category pill */}
        <div className="mt-3">
          <Badge variant="default" size="sm">
            {CATEGORY_LABELS[video.category]}
          </Badge>
        </div>
      </div>
    </Card>
  );
}

/* ============================================
 * TRENDING CLIENT — Main page component
 * ============================================ */

export function TrendingClient() {
  const [activeCategory, setActiveCategory] = useState<Category>("all");

  const filteredVideos = useMemo(() => {
    if (activeCategory === "all") return TRENDING_VIDEOS;
    return TRENDING_VIDEOS.filter((v) => v.category === activeCategory);
  }, [activeCategory]);

  const categoryTabs = useMemo(
    () =>
      CATEGORIES.map((cat) => ({
        value: cat,
        label: CATEGORY_LABELS[cat],
        count:
          cat === "all"
            ? TRENDING_VIDEOS.length
            : TRENDING_VIDEOS.filter((v) => v.category === cat).length,
      })),
    [],
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:p-6">
      {/* Page header */}
      <h1 className="text-3xl font-bold text-foreground">Trending</h1>
      <p className="mt-1 text-sm text-foreground-muted">
        Discover what&apos;s trending on TikTok right now
      </p>

      {/* Category tabs + filtered grid */}
      <div className="mt-6">
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
    </div>
  );
}
