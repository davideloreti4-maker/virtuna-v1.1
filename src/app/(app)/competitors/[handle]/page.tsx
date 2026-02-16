import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeGrowthVelocity,
  computeAverageViews,
  computeEngagementRate,
  computeVideoEngagementRate,
  computePostingCadence,
  computeHashtagFrequency,
  computePostingTimeGrid,
  computeDurationBreakdown,
} from "@/lib/competitors-utils";
import { DetailHeader } from "@/components/competitors/detail/detail-header";
import { GrowthSection } from "@/components/competitors/detail/growth-section";
import { EngagementSection } from "@/components/competitors/detail/engagement-section";
import { TopVideosSection } from "@/components/competitors/detail/top-videos-section";
import { ContentAnalysisSection } from "@/components/competitors/detail/content-analysis-section";
import type { VideoCardData } from "@/components/competitors/detail/video-card";

interface DetailPageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({
  params,
}: DetailPageProps): Promise<Metadata> {
  const { handle } = await params;
  return {
    title: `@${handle} | Competitors | Virtuna`,
  };
}

/**
 * Competitor detail page with profile header, growth charts,
 * and engagement analytics.
 *
 * Server component that fetches profile, snapshots, and videos
 * in parallel via Supabase, pre-computes all analytics, and
 * passes data as props to client chart sections.
 */
export default async function CompetitorDetailPage({
  params,
}: DetailPageProps) {
  const { handle } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch profile by handle
  const { data: profile } = await supabase
    .from("competitor_profiles")
    .select("*")
    .eq("tiktok_handle", handle)
    .single();

  if (!profile) notFound();

  // Verify user tracks this competitor (prevents accessing others' competitors)
  const { data: junction } = await supabase
    .from("user_competitors")
    .select("id")
    .eq("competitor_id", profile.id)
    .eq("user_id", user.id)
    .single();

  if (!junction) notFound();

  // Parallel fetch: snapshots (all time, ascending) + videos (all, descending by posted_at)
  const [{ data: snapshots }, { data: videos }] = await Promise.all([
    supabase
      .from("competitor_snapshots")
      .select("*")
      .eq("competitor_id", profile.id)
      .order("snapshot_date", { ascending: true }),
    supabase
      .from("competitor_videos")
      .select("*")
      .eq("competitor_id", profile.id)
      .order("posted_at", { ascending: false }),
  ]);

  const safeSnapshots = snapshots ?? [];
  const safeVideos = videos ?? [];

  // Pre-compute analytics server-side
  const chartData = safeSnapshots.map((s) => ({
    date: s.snapshot_date,
    followers: s.follower_count,
  }));

  const growthVelocity = computeGrowthVelocity(
    safeSnapshots.map((s) => ({
      follower_count: s.follower_count,
      snapshot_date: s.snapshot_date,
    }))
  );

  const averageViews = computeAverageViews(safeVideos);

  // Top 20 videos by views for engagement chart
  const topVideos = [...safeVideos]
    .filter((v) => v.views !== null && v.views > 0)
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 20);

  const engagementChartData = topVideos.map((v) => ({
    caption: v.caption || "Untitled",
    views: v.views ?? 0,
    likes: v.likes ?? 0,
    comments: v.comments ?? 0,
    shares: v.shares ?? 0,
    engagementRate: computeVideoEngagementRate({
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      shares: v.shares,
    }),
  }));

  const averageEngagementRate = computeEngagementRate(safeVideos);

  // --- Content analysis data (04-02) ---

  // Top 10 videos by views for video feed
  const topVideoCards: VideoCardData[] = [...safeVideos]
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 10)
    .map((v) => ({
      caption: v.caption,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      shares: v.shares,
      saves: v.saves,
      duration_seconds: v.duration_seconds,
      posted_at: v.posted_at,
      video_url: v.video_url,
      engagementRate: computeVideoEngagementRate(v),
    }));

  // Recent 20 videos chronologically (already sorted desc by posted_at)
  const recentVideoCards: VideoCardData[] = safeVideos
    .slice(0, 20)
    .map((v) => ({
      caption: v.caption,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      shares: v.shares,
      saves: v.saves,
      duration_seconds: v.duration_seconds,
      posted_at: v.posted_at,
      video_url: v.video_url,
      engagementRate: computeVideoEngagementRate(v),
    }));

  // Posting cadence
  const cadence = computePostingCadence(safeVideos);

  // Hashtag frequency
  const hashtags = computeHashtagFrequency(safeVideos);

  // Posting time heatmap grid
  const heatmapGrid = computePostingTimeGrid(safeVideos);

  // Duration breakdown
  const durationBreakdown = computeDurationBreakdown(safeVideos);

  return (
    <div className="space-y-8 pb-8">
      <DetailHeader profile={profile} />
      <GrowthSection
        chartData={chartData}
        averageViews={averageViews}
        growthVelocity={growthVelocity}
      />
      <EngagementSection
        chartData={engagementChartData}
        averageEngagementRate={averageEngagementRate}
      />
      <TopVideosSection
        topVideos={topVideoCards}
        recentVideos={recentVideoCards}
        cadence={cadence}
      />
      <ContentAnalysisSection
        hashtags={hashtags}
        heatmapGrid={heatmapGrid}
        durationBreakdown={durationBreakdown}
      />
    </div>
  );
}
