"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createScrapingProvider } from "@/lib/scraping";

/**
 * Re-scrape a single competitor profile and update data.
 * Profile-only retry (no video re-scrape) matching cron behavior.
 */
export async function retryScrape(
  handle: string
): Promise<{ error?: string }> {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Verify competitor exists and user tracks it (user client respects RLS via junction)
  const { data: competitor, error: lookupError } = await supabase
    .from("competitor_profiles")
    .select("id, tiktok_handle")
    .eq("tiktok_handle", handle)
    .maybeSingle();

  if (lookupError || !competitor) {
    return { error: "Competitor not found" };
  }

  try {
    const scraper = createScrapingProvider();
    const profileData = await scraper.scrapeProfile(handle);

    // Service client for writes (bypasses RLS)
    const serviceClient = createServiceClient();

    // Update competitor profile with fresh data (same pattern as refresh-competitors cron)
    await serviceClient
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
      .eq("id", competitor.id);

    // Upsert daily snapshot (one per competitor per day)
    await serviceClient.from("competitor_snapshots").upsert(
      {
        competitor_id: competitor.id,
        follower_count: profileData.followerCount,
        following_count: profileData.followingCount,
        heart_count: profileData.heartCount,
        video_count: profileData.videoCount,
        snapshot_date: new Date().toISOString().split("T")[0],
      },
      { onConflict: "competitor_id,snapshot_date" }
    );

    // Revalidate affected paths
    revalidatePath("/competitors");
    revalidatePath(`/competitors/${handle}`);

    return {};
  } catch (error) {
    console.error(`[retryScrape] Failed for ${handle}:`, error);
    return { error: "Scrape failed -- please try again later" };
  }
}
