import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CompetitorsClient } from "./competitors-client";

export const metadata: Metadata = {
  title: "Competitors | Virtuna",
  description: "Track and analyze your TikTok competitors.",
};

/**
 * Server component for /competitors page.
 *
 * Fetches user's tracked competitors, recent snapshots (14 days),
 * and video metrics via Supabase RLS-scoped queries.
 */
export default async function CompetitorsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch user's competitors with joined profile data
  const { data: userCompetitors } = await supabase
    .from("user_competitors")
    .select(
      "id, competitor_id, added_at, competitor_profiles (id, tiktok_handle, display_name, avatar_url, follower_count, following_count, heart_count, video_count, last_scraped_at, scrape_status)"
    )
    .order("added_at", { ascending: false });

  const competitors = userCompetitors ?? [];

  // Extract competitor IDs for batch queries
  const competitorIds = competitors.map((c) => c.competitor_id);

  // Guard: skip snapshot/video queries if no competitors
  if (competitorIds.length === 0) {
    return <CompetitorsClient competitors={[]} snapshotMap={{}} videosMap={{}} />;
  }

  // Fetch snapshots from last 14 days
  const fourteenDaysAgo = new Date(
    Date.now() - 14 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: snapshots } = await supabase
    .from("competitor_snapshots")
    .select("competitor_id, follower_count, snapshot_date")
    .in("competitor_id", competitorIds)
    .gte("snapshot_date", fourteenDaysAgo)
    .order("snapshot_date", { ascending: true });

  // Fetch video metrics for engagement rate calculation
  const { data: videos } = await supabase
    .from("competitor_videos")
    .select("competitor_id, views, likes, comments, shares")
    .in("competitor_id", competitorIds);

  // Group snapshots by competitor_id
  const snapshotMap: Record<
    string,
    { follower_count: number; snapshot_date: string }[]
  > = {};
  for (const s of snapshots ?? []) {
    const arr = snapshotMap[s.competitor_id] ?? [];
    arr.push({
      follower_count: s.follower_count,
      snapshot_date: s.snapshot_date,
    });
    snapshotMap[s.competitor_id] = arr;
  }

  // Group videos by competitor_id
  const videosMap: Record<
    string,
    {
      views: number | null;
      likes: number | null;
      comments: number | null;
      shares: number | null;
    }[]
  > = {};
  for (const v of videos ?? []) {
    const arr = videosMap[v.competitor_id] ?? [];
    arr.push({
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      shares: v.shares,
    });
    videosMap[v.competitor_id] = arr;
  }

  return (
    <CompetitorsClient
      competitors={competitors}
      snapshotMap={snapshotMap}
      videosMap={videosMap}
    />
  );
}
