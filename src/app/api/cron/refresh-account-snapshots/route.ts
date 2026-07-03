import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createScrapingProvider } from "@/lib/scraping";
import {
  listTrackedAccounts,
  upsertAccountSnapshot,
} from "@/lib/account-metrics/account-metrics-repo";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "cron/refresh-account-snapshots" });

/** Vercel function timeout — 60s default, 300s available on Pro with confirmation */
export const maxDuration = 60;

/**
 * GET /api/cron/refresh-account-snapshots
 *
 * Daily append to the own-account time-series (account_snapshots) that powers the
 * /start stat-row's weekly deltas + sparklines. Mirrors refresh-competitors:
 * - self-driving from the table (the latest handle per user; an account enters
 *   the loop once calibration captures its first snapshot)
 * - upserts one snapshot per user per day (full profile counters incl. following)
 * - isolates per-account failures (one bad handle doesn't block the batch)
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
      await upsertAccountSnapshot(supabase, {
        userId: account.user_id,
        platform: account.platform,
        handle: account.handle,
        followerCount: profile.followerCount,
        followingCount: profile.followingCount,
        heartCount: profile.heartCount,
        videoCount: profile.videoCount,
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
