"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createScrapingProvider } from "@/lib/scraping";
import type { ProfileData } from "@/lib/scraping";
import { normalizeHandle } from "@/lib/schemas/competitor";

type ActionResult = {
  error?: string;
  data?: { competitorId: string; handle: string };
};

export async function addCompetitor(handle: string): Promise<ActionResult> {
  // 1. Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // 2. Normalize handle
  const normalized = normalizeHandle(handle);
  if (!normalized || normalized.length < 2) {
    return { error: "Invalid TikTok handle" };
  }

  // 3. Service client profile lookup (bypasses RLS)
  const serviceClient = createServiceClient();
  const { data: existingProfile, error: lookupError } = await serviceClient
    .from("competitor_profiles")
    .select("id")
    .eq("tiktok_handle", normalized)
    .maybeSingle();

  if (lookupError) {
    return { error: "Failed to look up competitor profile" };
  }

  let profileId: string;

  if (existingProfile) {
    // 4a. Profile exists -- skip scraping
    profileId = existingProfile.id;
  } else {
    // 4b. Profile does NOT exist -- scrape and create
    let profileData: ProfileData;
    const scraper = createScrapingProvider();

    try {
      profileData = await scraper.scrapeProfile(normalized);
    } catch {
      return {
        error: "TikTok handle not found or could not be scraped",
      };
    }

    // Upsert profile with service client
    const { data: profile, error: upsertError } = await serviceClient
      .from("competitor_profiles")
      .upsert(
        {
          tiktok_handle: normalized,
          display_name: profileData.displayName,
          bio: profileData.bio,
          avatar_url: profileData.avatarUrl,
          verified: profileData.verified,
          follower_count: profileData.followerCount,
          following_count: profileData.followingCount,
          heart_count: profileData.heartCount,
          video_count: profileData.videoCount,
          last_scraped_at: new Date().toISOString(),
          scrape_status: "success",
        },
        { onConflict: "tiktok_handle" }
      )
      .select("id")
      .single();

    if (upsertError || !profile) {
      return { error: "Failed to create competitor profile" };
    }

    profileId = profile.id;

    // Insert initial snapshot with service client
    await serviceClient.from("competitor_snapshots").upsert(
      {
        competitor_id: profileId,
        follower_count: profileData.followerCount,
        following_count: profileData.followingCount,
        heart_count: profileData.heartCount,
        video_count: profileData.videoCount,
        snapshot_date: new Date().toISOString().split("T")[0],
      },
      { onConflict: "competitor_id,snapshot_date" }
    );

    // Scrape and insert videos (non-fatal)
    try {
      const videos = await scraper.scrapeVideos(normalized);
      if (videos.length > 0) {
        await serviceClient.from("competitor_videos").upsert(
          videos.map((v) => ({
            competitor_id: profileId,
            platform_video_id: v.platformVideoId,
            video_url: v.videoUrl,
            caption: v.caption,
            views: v.views,
            likes: v.likes,
            comments: v.comments,
            shares: v.shares,
            saves: v.saves,
            hashtags: v.hashtags,
            duration_seconds: v.durationSeconds,
            posted_at: v.postedAt.toISOString(),
          })),
          { onConflict: "competitor_id,platform_video_id" }
        );
      }
    } catch (e) {
      console.warn("[addCompetitor] Video scraping failed (non-fatal):", e);
    }
  }

  // 5. Insert junction row using authenticated client
  const { error: junctionError } = await supabase
    .from("user_competitors")
    .insert({ user_id: user.id, competitor_id: profileId });

  if (junctionError) {
    // Postgres unique violation = already tracking
    if (junctionError.code === "23505") {
      return { error: "You are already tracking this competitor" };
    }
    return { error: "Failed to track competitor" };
  }

  // 6. Revalidate and return
  revalidatePath("/competitors");
  return { data: { competitorId: profileId, handle: normalized } };
}
