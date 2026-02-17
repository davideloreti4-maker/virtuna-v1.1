import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { addCompetitor } from "@/app/actions/competitors/add";
import {
  computeGrowthVelocity,
  computeEngagementRate,
  computePostingCadence,
  computeAverageViews,
} from "@/lib/competitors-utils";
import { ComparisonClient } from "./comparison-client";

export const metadata: Metadata = {
  title: "Compare | Competitors | Virtuna",
};

export interface ComparisonData {
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  followers: number | null;
  likes: number | null;
  videos: number | null;
  engagementRate: number | null;
  growthVelocity: {
    percentage: number;
    direction: "up" | "down" | "flat";
  } | null;
  postingCadence: { postsPerWeek: number; postsPerMonth: number } | null;
  avgViews: number | null;
  snapshotTimeSeries: { date: string; followers: number }[];
  lastScrapedAt: string | null;
}

interface ComparePageProps {
  searchParams: Promise<{ a?: string; b?: string }>;
}

/**
 * Fetch full competitor data for comparison.
 *
 * Looks up profile by handle, verifies junction exists for user,
 * then parallel-fetches snapshots and videos. Returns ComparisonData or null.
 */
async function fetchCompetitorData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  handle: string
): Promise<ComparisonData | null> {
  // Look up profile by handle
  const { data: profile } = await supabase
    .from("competitor_profiles")
    .select("*")
    .eq("tiktok_handle", handle)
    .single();

  if (!profile) return null;

  // Verify user tracks this competitor
  const { data: junction } = await supabase
    .from("user_competitors")
    .select("id")
    .eq("competitor_id", profile.id)
    .eq("user_id", userId)
    .single();

  if (!junction) return null;

  // Parallel fetch snapshots + videos
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

  // Pre-compute analytics
  const growthVelocity = computeGrowthVelocity(
    safeSnapshots.map((s) => ({
      follower_count: s.follower_count,
      snapshot_date: s.snapshot_date,
    }))
  );

  const engagementRate = computeEngagementRate(safeVideos);
  const postingCadence = computePostingCadence(safeVideos);
  const avgViews = computeAverageViews(safeVideos);

  const snapshotTimeSeries = safeSnapshots.map((s) => ({
    date: s.snapshot_date,
    followers: s.follower_count,
  }));

  return {
    handle: profile.tiktok_handle,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    followers: profile.follower_count,
    likes: profile.heart_count,
    videos: profile.video_count,
    engagementRate,
    growthVelocity,
    postingCadence,
    avgViews,
    snapshotTimeSeries,
    lastScrapedAt: profile.last_scraped_at,
  };
}

/**
 * Comparison page server component.
 *
 * Reads searchParams `a` and `b` for competitor handles,
 * fetches data in parallel, pre-computes metrics, and passes
 * ComparisonData to the client shell.
 */
export default async function ComparePage({ searchParams }: ComparePageProps) {
  const { a, b } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch user's TikTok handle for self-benchmarking
  const { data: creatorProfile } = await supabase
    .from("creator_profiles")
    .select("tiktok_handle")
    .eq("id", user.id)
    .single();

  const userHandle = creatorProfile?.tiktok_handle ?? null;

  // Fetch all tracked competitors for selector dropdowns
  const { data: userCompetitors } = await supabase
    .from("user_competitors")
    .select(
      "competitor_id, competitor_profiles (tiktok_handle, display_name, avatar_url)"
    )
    .order("added_at", { ascending: false });

  const competitors = (userCompetitors ?? [])
    .map((uc) => {
      const p = uc.competitor_profiles as unknown as {
        tiktok_handle: string;
        display_name: string | null;
        avatar_url: string | null;
      } | null;
      if (!p) return null;
      return {
        handle: p.tiktok_handle,
        displayName: p.display_name,
        avatarUrl: p.avatar_url,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // Helper: resolve a searchParam value to a handle (handles "me" case)
  async function resolveHandle(
    paramValue: string | undefined
  ): Promise<string | null> {
    if (!paramValue) return null;

    if (paramValue === "me") {
      if (!userHandle) return null;

      // Check if user's handle already exists in competitor_profiles
      const { data: existing } = await supabase
        .from("competitor_profiles")
        .select("id")
        .eq("tiktok_handle", userHandle)
        .maybeSingle();

      if (existing) {
        // Check if junction row exists for this user
        const { data: junctionExists } = await supabase
          .from("user_competitors")
          .select("id")
          .eq("competitor_id", existing.id)
          .eq("user_id", user!.id)
          .maybeSingle();

        if (!junctionExists) {
          // Create junction row with authenticated client
          await supabase
            .from("user_competitors")
            .insert({ user_id: user!.id, competitor_id: existing.id });
        }
      } else {
        // Profile doesn't exist -- scrape via addCompetitor server action
        await addCompetitor(userHandle);
      }

      return userHandle;
    }

    return paramValue;
  }

  // Resolve handles (handles "me" self-benchmarking)
  const [handleA, handleB] = await Promise.all([
    resolveHandle(a),
    resolveHandle(b),
  ]);

  // Fetch comparison data for both sides in parallel
  const [dataA, dataB] = await Promise.all([
    handleA ? fetchCompetitorData(supabase, user.id, handleA) : null,
    handleB ? fetchCompetitorData(supabase, user.id, handleB) : null,
  ]);

  return (
    <ComparisonClient
      dataA={dataA}
      dataB={dataB}
      competitors={competitors}
      selectedA={a}
      selectedB={b}
      userHandle={userHandle}
    />
  );
}
