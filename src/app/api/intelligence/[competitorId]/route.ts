/**
 * Intelligence API route.
 *
 * GET: Retrieve all cached AI intelligence for a competitor.
 * POST: Trigger a specific analysis type (strategy, viral, hashtag_gap, recommendations).
 *
 * Auth: Requires authenticated user who tracks the competitor via junction table.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  computeAverageViews,
  computeEngagementRate,
  computeHashtagFrequency,
  computePostingCadence,
  computeGrowthVelocity,
  computeDurationBreakdown,
} from "@/lib/competitors-utils";
import {
  getStrategyAnalysis,
  getViralDetection,
  getHashtagGap,
  getRecommendations,
  getAllIntelligence,
} from "@/lib/ai/intelligence-service";
import type { CompetitorContext, ViralVideoInput } from "@/lib/ai/types";

export const maxDuration = 60;

const VALID_ANALYSIS_TYPES = [
  "strategy",
  "viral",
  "hashtag_gap",
  "recommendations",
] as const;
type AnalysisType = (typeof VALID_ANALYSIS_TYPES)[number];

interface RouteParams {
  params: Promise<{ competitorId: string }>;
}

/**
 * Verify user is authenticated and tracks this competitor.
 * Returns { user, supabase } or a NextResponse error.
 */
async function authenticate(competitorId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  // Verify junction: user tracks this competitor
  const { data: junction } = await supabase
    .from("user_competitors")
    .select("id")
    .eq("competitor_id", competitorId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!junction) {
    return { error: NextResponse.json({ error: "Competitor not found" }, { status: 404 }) };
  }

  return { user, supabase };
}

// --- GET: Retrieve cached intelligence ---

export async function GET(_request: Request, { params }: RouteParams) {
  const { competitorId } = await params;
  const auth = await authenticate(competitorId);

  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  try {
    const intelligence = await getAllIntelligence(supabase, competitorId);
    return NextResponse.json(intelligence);
  } catch (error) {
    console.error("Failed to fetch intelligence:", error);
    return NextResponse.json(
      { error: "Failed to fetch intelligence" },
      { status: 500 }
    );
  }
}

// --- POST: Trigger analysis ---

export async function POST(request: Request, { params }: RouteParams) {
  const { competitorId } = await params;
  const auth = await authenticate(competitorId);

  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  // Parse request body
  let analysisType: AnalysisType;
  try {
    const body = await request.json();
    if (
      !body.analysis_type ||
      !VALID_ANALYSIS_TYPES.includes(body.analysis_type)
    ) {
      return NextResponse.json(
        {
          error: `Invalid analysis_type. Must be one of: ${VALID_ANALYSIS_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }
    analysisType = body.analysis_type;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  try {
    // Fetch competitor profile
    const { data: profile } = await supabase
      .from("competitor_profiles")
      .select("*")
      .eq("id", competitorId)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Competitor profile not found" },
        { status: 404 }
      );
    }

    // Fetch competitor videos
    const { data: videos } = await supabase
      .from("competitor_videos")
      .select("*")
      .eq("competitor_id", competitorId)
      .order("posted_at", { ascending: false });

    const safeVideos = videos ?? [];

    // Fetch snapshots for growth velocity
    const { data: snapshots } = await supabase
      .from("competitor_snapshots")
      .select("follower_count, snapshot_date")
      .eq("competitor_id", competitorId)
      .order("snapshot_date", { ascending: true });

    const safeSnapshots = snapshots ?? [];

    // Build CompetitorContext from existing utils
    const averageViews = computeAverageViews(safeVideos);
    const topHashtags = computeHashtagFrequency(safeVideos).slice(0, 10);
    const cadence = computePostingCadence(safeVideos);
    const engagementRate = computeEngagementRate(safeVideos);
    const growthVelocity = computeGrowthVelocity(safeSnapshots);
    const durationBreakdown = computeDurationBreakdown(safeVideos);

    const topVideoCaptions = [...safeVideos]
      .filter((v) => v.views !== null && v.views > 0)
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .slice(0, 5)
      .map((v) => ({
        caption: (v.caption ?? "").slice(0, 200),
        views: v.views ?? 0,
      }));

    const ctx: CompetitorContext = {
      handle: profile.tiktok_handle,
      followerCount: profile.follower_count,
      heartCount: profile.heart_count,
      videoCount: profile.video_count,
      bio: profile.bio,
      topHashtags,
      cadence,
      engagementRate,
      averageViews,
      growthVelocity,
      topVideoCaptions,
      durationBreakdown: durationBreakdown.map((d) => ({
        label: d.label,
        percentage: d.percentage,
      })),
    };

    // Execute the requested analysis
    switch (analysisType) {
      case "strategy": {
        const result = await getStrategyAnalysis(
          supabase,
          competitorId,
          ctx,
          profile.last_scraped_at
        );
        return NextResponse.json(result);
      }

      case "viral": {
        // Detect viral videos (views > 3x average)
        const viralThreshold = (averageViews ?? 0) * 3;
        const viralVideos: ViralVideoInput[] = safeVideos
          .filter((v) => v.views !== null && v.views > viralThreshold)
          .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
          .slice(0, 5)
          .map((v) => ({
            caption: v.caption,
            views: v.views,
            likes: v.likes,
            comments: v.comments,
            shares: v.shares,
            duration_seconds: v.duration_seconds,
            posted_at: v.posted_at,
            hashtags: v.hashtags,
            viralMultiplier:
              averageViews && averageViews > 0
                ? Math.round(((v.views ?? 0) / averageViews) * 10) / 10
                : 0,
          }));

        const result = await getViralDetection(
          supabase,
          competitorId,
          profile.tiktok_handle,
          viralVideos,
          averageViews ?? 0,
          profile.last_scraped_at
        );
        return NextResponse.json(result);
      }

      case "hashtag_gap": {
        // Need user's own videos for comparison
        const { data: creatorProfile } = await supabase
          .from("creator_profiles")
          .select("tiktok_handle")
          .eq("user_id", user.id)
          .single();

        const userHandle = creatorProfile?.tiktok_handle;
        if (!userHandle) {
          return NextResponse.json(
            {
              error:
                "Set your TikTok handle in settings to enable hashtag gap analysis",
            },
            { status: 400 }
          );
        }

        // Look up user's competitor profile and videos
        const { data: userProfile } = await supabase
          .from("competitor_profiles")
          .select("id")
          .eq("tiktok_handle", userHandle)
          .maybeSingle();

        if (!userProfile) {
          return NextResponse.json(
            {
              error:
                "Track your own account first via the Compare page to enable hashtag gap analysis",
            },
            { status: 400 }
          );
        }

        const { data: userVideos } = await supabase
          .from("competitor_videos")
          .select("hashtags")
          .eq("competitor_id", userProfile.id)
          .order("posted_at", { ascending: false });

        const result = await getHashtagGap(
          supabase,
          competitorId,
          profile.tiktok_handle,
          user.id,
          safeVideos,
          userVideos ?? [],
          profile.last_scraped_at
        );
        return NextResponse.json(result);
      }

      case "recommendations": {
        const result = await getRecommendations(
          supabase,
          competitorId,
          ctx,
          profile.last_scraped_at
        );
        return NextResponse.json(result);
      }
    }
  } catch (error) {
    console.error(`Intelligence analysis (${analysisType}) failed:`, error);
    return NextResponse.json(
      { error: `Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
