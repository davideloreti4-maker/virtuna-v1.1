import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createScrapingProvider } from "@/lib/scraping";
import { rehostAvatar } from "@/lib/scraping/rehost-cover";
import { mapWithConcurrency } from "@/lib/concurrency";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "cron/refresh-competitors" });

/**
 * Vercel function timeout. Each TikTok profile scrape takes ~40s; the batch runs them with bounded
 * concurrency (below), but a large watchlist still needs headroom — 300s is available on Pro (the
 * engine functions already rely on it). Profiles are refreshed stalest-first, so if the window is
 * still exhausted the freshest data is what gets left for the next run. See issue #223.
 */
export const maxDuration = 300;

/** Concurrent profile scrapes. Bounded to stay friendly to the upstream scraper + DB pool. */
const CONCURRENCY = 5;

type Profile = { id: string; tiktok_handle: string };
type Supabase = ReturnType<typeof createServiceClient>;
type Scraper = ReturnType<typeof createScrapingProvider>;

/** Re-scrape + persist one competitor. Returns 'refreshed' | 'failed' (never throws). */
async function refreshOne(
  supabase: Supabase,
  scraper: Scraper,
  profile: Profile,
): Promise<"refreshed" | "failed"> {
  try {
    const profileData = await scraper.scrapeProfile(profile.tiktok_handle);

    // Durable avatar: re-host the freshly-scraped (still-signed) avatar into the public `avatars`
    // bucket. WITHOUT this the daily cron re-stamps an ephemeral TikTok URL that 403s within days,
    // dropping the card to initials. Degrades to the ephemeral URL on failure (never a dead null).
    const avatarUrl =
      (await rehostAvatar(supabase, profileData.avatarUrl, profile.tiktok_handle)) ??
      profileData.avatarUrl;

    // Update competitor profile with fresh data
    await supabase
      .from("competitor_profiles")
      .update({
        display_name: profileData.displayName,
        bio: profileData.bio,
        avatar_url: avatarUrl,
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

    return "refreshed";
  } catch (error) {
    log.error("Failed to refresh profile", {
      handle: profile.tiktok_handle,
      error: error instanceof Error ? error.message : String(error),
    });

    // Mark profile as failed but continue — do NOT rethrow (one failure never blocks the batch)
    await supabase
      .from("competitor_profiles")
      .update({ scrape_status: "failed" as const })
      .eq("id", profile.id);

    return "failed";
  }
}

/**
 * GET /api/cron/refresh-competitors
 *
 * Daily batch re-scraping of all tracked competitor profiles.
 * - Updates profile data (display name, bio, metrics) + re-hosts a durable avatar
 * - Upserts daily snapshot for time-series charts
 * - Runs with bounded concurrency, stalest-first, so the batch fits the function window (#223)
 * - Isolates per-handle failures (one failure doesn't block the batch)
 *
 * Protected by CRON_SECRET Bearer token. Triggered by Vercel Cron at 6:00 AM UTC.
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const supabase = createServiceClient();
  const scraper = createScrapingProvider();

  // Fetch all competitor profiles (service client bypasses RLS). Stalest-first (nulls first) so a
  // partial run under the time budget still refreshes the most out-of-date profiles.
  const { data: profiles, error: fetchError } = await supabase
    .from("competitor_profiles")
    .select("id, tiktok_handle")
    .order("last_scraped_at", { ascending: true, nullsFirst: true });

  if (fetchError) {
    log.error("Failed to fetch profiles", { error: fetchError.message });
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

  await mapWithConcurrency(profiles, CONCURRENCY, async (profile) => {
    const outcome = await refreshOne(supabase, scraper, profile);
    if (outcome === "refreshed") refreshed++;
    else failed++;
  });

  // Revalidate competitors page cache after batch processing
  revalidatePath("/competitors");

  return NextResponse.json({
    refreshed,
    failed,
    total: profiles.length,
  });
}
