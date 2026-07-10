import type { ComponentProps } from "react";
import type { createClient } from "@/lib/supabase/server";
import type { CompetitorsClient } from "@/app/(app)/competitors/competitors-client";

/**
 * getCompetitorsData — the competitor board's server read, lifted out of the old
 * /competitors page so the DISCOVER hub (Surfaces IA rationalization) can fetch it for
 * its Competitors tab. `/competitors` is now a redirect into the hub; the hub page owns
 * this fetch. RLS scopes user_competitors to the caller, so no explicit user filter.
 *
 * Return shape is pinned to CompetitorsClient's props (type-only import, erased at build)
 * so the hub can hand the result straight through without a second set of types.
 */
type ServerClient = Awaited<ReturnType<typeof createClient>>;
type CompetitorsProps = ComponentProps<typeof CompetitorsClient>;
export type CompetitorsData = Pick<
  CompetitorsProps,
  "competitors" | "snapshotMap" | "videosMap"
>;

export async function getCompetitorsData(
  supabase: ServerClient,
): Promise<CompetitorsData> {
  // User's competitors with joined profile data (RLS-scoped to the caller).
  const { data: userCompetitors } = await supabase
    .from("user_competitors")
    .select(
      "id, competitor_id, added_at, competitor_profiles (id, tiktok_handle, display_name, avatar_url, follower_count, following_count, heart_count, video_count, last_scraped_at, scrape_status)",
    )
    .order("added_at", { ascending: false });

  const competitors = userCompetitors ?? [];
  const competitorIds = competitors.map((c) => c.competitor_id);

  // Skip the snapshot/video reads entirely when nothing is tracked.
  if (competitorIds.length === 0) {
    return { competitors: [], snapshotMap: {}, videosMap: {} };
  }

  // Snapshots from the last 14 days (follower sparkline).
  const fourteenDaysAgo = new Date(
    Date.now() - 14 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: snapshots } = await supabase
    .from("competitor_snapshots")
    .select("competitor_id, follower_count, snapshot_date")
    .in("competitor_id", competitorIds)
    .gte("snapshot_date", fourteenDaysAgo)
    .order("snapshot_date", { ascending: true });

  // Video metrics (engagement-rate calc).
  const { data: videos } = await supabase
    .from("competitor_videos")
    .select("competitor_id, views, likes, comments, shares, posted_at, cover_url")
    .in("competitor_id", competitorIds);

  const snapshotMap: CompetitorsData["snapshotMap"] = {};
  for (const s of snapshots ?? []) {
    (snapshotMap[s.competitor_id] ??= []).push({
      follower_count: s.follower_count,
      snapshot_date: s.snapshot_date,
    });
  }

  const videosMap: CompetitorsData["videosMap"] = {};
  for (const v of videos ?? []) {
    (videosMap[v.competitor_id] ??= []).push({
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      shares: v.shares,
      posted_at: v.posted_at,
      cover_url: v.cover_url ?? null,
    });
  }

  return { competitors, snapshotMap, videosMap };
}
