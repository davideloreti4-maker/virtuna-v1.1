import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createScrapingProvider } from "@/lib/scraping";

/** Vercel function timeout — 60s default, 300s available on Pro with confirmation */
export const maxDuration = 60;

/**
 * GET /api/cron/refresh-competitors
 *
 * Daily batch re-scraping of all tracked competitor profiles.
 * - Updates profile data (display name, bio, metrics)
 * - Upserts daily snapshot for time-series charts
 * - Isolates per-handle failures (one failure doesn't block the batch)
 *
 * Protected by CRON_SECRET Bearer token. Triggered by Vercel Cron at 6:00 AM UTC.
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const supabase = createServiceClient();
  const scraper = createScrapingProvider();

  // Fetch all competitor profiles (service client bypasses RLS)
  const { data: profiles, error: fetchError } = await supabase
    .from("competitor_profiles")
    .select("id, tiktok_handle");

  if (fetchError) {
    console.error("[refresh-competitors] Failed to fetch profiles:", fetchError);
    return NextResponse.json(
      { error: "Failed to fetch competitor profiles" },
      { status: 500 }
    );
  }

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ refreshed: 0, failed: 0, total: 0 });
  }

  let refreshed = 0;
  let failed = 0;

  for (const profile of profiles) {
    try {
      const profileData = await scraper.scrapeProfile(profile.tiktok_handle);

      // Update competitor profile with fresh data
      await supabase
        .from("competitor_profiles")
        .update({
          display_name: profileData.displayName,
          bio: profileData.bio,
          avatar_url: profileData.avatarUrl,
          verified: profileData.verified,
          follower_count: profileData.followerCount,
          following_count: profileData.followingCount,
          heart_count: profileData.heartCount,
          video_count: profileData.videoCount,
          last_scraped_at: new Date().toISOString(),
          scrape_status: "success" as const,
        })
        .eq("id", profile.id);

      // Upsert daily snapshot (one per competitor per day)
      await supabase.from("competitor_snapshots").upsert(
        {
          competitor_id: profile.id,
          follower_count: profileData.followerCount,
          following_count: profileData.followingCount,
          heart_count: profileData.heartCount,
          video_count: profileData.videoCount,
          snapshot_date: new Date().toISOString().split("T")[0],
        },
        { onConflict: "competitor_id,snapshot_date" }
      );

      refreshed++;
    } catch (error) {
      console.error(
        `[refresh-competitors] Failed for ${profile.tiktok_handle}:`,
        error
      );

      // Mark profile as failed but continue to next profile
      await supabase
        .from("competitor_profiles")
        .update({ scrape_status: "failed" as const })
        .eq("id", profile.id);

      failed++;
      // Continue to next profile — do NOT break or rethrow
    }
  }

  // Revalidate competitors page cache after batch processing
  revalidatePath("/competitors");

  return NextResponse.json({
    refreshed,
    failed,
    total: profiles.length,
  });
}
