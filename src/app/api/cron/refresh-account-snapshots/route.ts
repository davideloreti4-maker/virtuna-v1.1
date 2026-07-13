import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createScrapingProvider } from "@/lib/scraping";
import { upsertAccountSnapshot } from "@/lib/account-metrics/account-metrics-repo";
import {
  listAllConnectedAccounts,
  touchAccountSynced,
} from "@/lib/connected-accounts/connected-accounts-repo";
import { upsertAccountPosts } from "@/lib/account-metrics/account-posts-repo";
import { clusterPillarsForAccount } from "@/lib/content-pillars/cluster";
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
 * - self-driving from connected_accounts (one row per (platform, handle); an
 *   account enters the loop the moment it's connected — cross-platform series
 *   never collide because each write is keyed to account_id)
 * - upserts one snapshot per account per day (full profile counters incl. following,
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

  const accounts = await listAllConnectedAccounts(supabase);

  if (accounts.length === 0) {
    return NextResponse.json({ refreshed: 0, failed: 0, total: 0 });
  }

  let refreshed = 0;
  let failed = 0;

  for (const account of accounts) {
    try {
      // ── Instagram / YouTube — profile-only refresh ─────────────────────────
      // No video clustering or content pillars (those stay TikTok-only, consistent with
      // audience calibration). Just snapshot the profile counters + the platform's view
      // total (YT lifetime channelTotalViews via viewCount; IG has none → null → no tile).
      if (account.platform === "instagram" || account.platform === "youtube") {
        if (!scraper.scrapeInstagramProfile || !scraper.scrapeYouTubeChannel) continue;
        const profile =
          account.platform === "instagram"
            ? await scraper.scrapeInstagramProfile(account.handle)
            : await scraper.scrapeYouTubeChannel(account.handle);
        await upsertAccountSnapshot(supabase, {
          accountId: account.id,
          userId: account.user_id,
          platform: account.platform,
          handle: account.handle,
          followerCount: profile.followerCount,
          followingCount: profile.followingCount,
          heartCount: profile.heartCount, // 0 for IG/YT — honest, dropped by the tiles
          videoCount: profile.videoCount,
          recentViews: profile.viewCount ?? null,
        });
        refreshed++;
        try {
          await touchAccountSynced(supabase, account.id);
        } catch {
          /* non-fatal — the snapshot already landed */
        }
        continue;
      }

      // ── TikTok — full bundle path (profile + recent-views video scrape + pillars) ──
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
        // Persist the posts we just scraped (caption + engagement) for content
        // pillars — best-effort, isolated so a persist failure never loses the
        // snapshot or recent_views we already computed.
        if (videos.length > 0) {
          try {
            await upsertAccountPosts(
              supabase,
              account.id,
              account.user_id,
              account.platform,
              account.handle,
              videos,
            );
          } catch (error) {
            log.error("Failed to persist account posts (snapshot still written)", {
              handle: account.handle,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      } catch (error) {
        log.error("Failed to scrape videos for recent_views (profile snapshot still written)", {
          handle: account.handle,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await upsertAccountSnapshot(supabase, {
        accountId: account.id,
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
      // Best-effort: record the sync time (drives the switcher's "updated" hint).
      try {
        await touchAccountSynced(supabase, account.id);
      } catch {
        /* non-fatal — the snapshot already landed */
      }

      // Cluster/refresh THIS account's content pillars from the posts we just
      // persisted — every connected account carries its own pillar set
      // (content_pillars.account_id). Cost-gated (the model only runs on first
      // cluster or when there are unassigned posts; a first cluster is ~15s per
      // account) and isolated so a pillar failure never fails the snapshot.
      try {
        const cluster = await clusterPillarsForAccount(
          supabase,
          account.user_id,
          account.id,
        );
        if (cluster.status !== "noop") {
          log.info("content pillars refreshed", {
            handle: account.handle,
            status: cluster.status,
            pillars: cluster.pillarCount,
            assigned: cluster.assigned,
          });
        }
      } catch (error) {
        log.error("Failed to cluster content pillars (snapshot still written)", {
          handle: account.handle,
          error: error instanceof Error ? error.message : String(error),
        });
      }
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
