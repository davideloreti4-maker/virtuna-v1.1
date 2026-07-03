import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createScrapingProvider } from "@/lib/scraping";
import {
  listTrackedAccounts,
  upsertAccountSnapshot,
} from "@/lib/account-metrics/account-metrics-repo";
import { sumRecentViews } from "@/lib/account-metrics/account-metrics";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "cron/refresh-account-snapshots" });

/**
 * Vercel function timeout. Bumped from 60 → 300 because this cron now runs a SECOND
 * Apify actor per account (the video scrape for recent_views, waitSecs up to 120) on
 * top of the profile scrape — 60s could be killed mid-run. 300s is the Pro headroom.
 * (Plan-tier reconciliation rides the existing pre-`main` infra gate; preview deploys
 * on milestone/surfaces already fail on a separate memory limit.)
 */
export const maxDuration = 300;

/** "Recent posts" = the trailing 4 weeks (matches the /start month framing). */
const RECENT_WINDOW_DAYS = 28;
/** Scrape cap for the views sum — covers ~1 post/day over the window. Prolific
 *  creators are honestly undercounted (a real sum over the posts we can see), never
 *  fabricated up. */
const RECENT_VIDEOS_LIMIT = 30;

/**
 * GET /api/cron/refresh-account-snapshots
 *
 * Daily append to the own-account time-series (account_snapshots) that powers the
 * /start stat-row's weekly deltas + sparklines. Mirrors refresh-competitors:
 * - self-driving from the table (the latest handle per user; an account enters
 *   the loop once calibration captures its first snapshot)
 * - upserts one snapshot per user per day (full profile counters incl. following,
 *   plus recent_views = the summed views of recent posts, via a second video scrape)
 * - isolates per-account failures (one bad handle doesn't block the batch), and
 *   isolates the video scrape within each account (a video failure still writes the
 *   profile counters; recent_views just goes null → the Views tile is omitted)
 *
 * Protected by CRON_SECRET Bearer token. Triggered by Vercel Cron at 7:00 AM UTC
 * (offset from refresh-competitors at 6:00 to spread Apify load).
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const supabase = createServiceClient();
  const scraper = createScrapingProvider();

  const accounts = await listTrackedAccounts(supabase);

  if (accounts.length === 0) {
    return NextResponse.json({ refreshed: 0, failed: 0, total: 0 });
  }

  let refreshed = 0;
  let failed = 0;

  for (const account of accounts) {
    // TikTok-only scraper today — skip other platforms until their provider lands.
    if (account.platform !== "tiktok") continue;
    try {
      const profile = await scraper.scrapeProfile(account.handle);

      // Views tile source: sum public views across the creator's recent posts. A
      // SECOND scrape, isolated so a video-only failure never loses the profile
      // snapshot — recentViews stays null (Views tile omitted; the 4 core tiles are
      // safe). An EMPTY scrape → null too ("no data" ≠ a real 0). Honesty spine.
      let recentViews: number | null = null;
      try {
        const videos = await scraper.scrapeVideos(
          account.handle,
          RECENT_VIDEOS_LIMIT,
          "profile",
        );
        recentViews =
          videos.length > 0
            ? sumRecentViews(videos, RECENT_WINDOW_DAYS, new Date())
            : null;
      } catch (error) {
        log.error("Failed to scrape videos for recent_views (profile snapshot still written)", {
          handle: account.handle,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await upsertAccountSnapshot(supabase, {
        userId: account.user_id,
        platform: account.platform,
        handle: account.handle,
        followerCount: profile.followerCount,
        followingCount: profile.followingCount,
        heartCount: profile.heartCount,
        videoCount: profile.videoCount,
        recentViews,
      });
      refreshed++;
    } catch (error) {
      log.error("Failed to refresh account snapshot", {
        handle: account.handle,
        error: error instanceof Error ? error.message : String(error),
      });
      failed++;
      // Continue to next account — do NOT break or rethrow.
    }
  }

  return NextResponse.json({ refreshed, failed, total: accounts.length });
}
