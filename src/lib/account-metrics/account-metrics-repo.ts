/**
 * account-metrics-repo — persistence for account_snapshots (the own-account
 * daily time-series behind the /start stat-row).
 *
 * Producers call upsertAccountSnapshot (calibration capture with the user's
 * server client under RLS; the daily cron with the service client). The /start
 * server component calls getAccountSnapshots (RLS-scoped to the session user).
 *
 * Cast convention (mirrors audience-repo): account_snapshots is not yet in
 * database.types.ts, so the query builder is cast until types are regenerated.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountSnapshot } from "./account-metrics";

export interface AccountSnapshotInput {
  accountId: string; // connected_accounts.id — the series discriminator (upsert key)
  userId: string;
  platform: "tiktok" | "instagram" | "youtube";
  handle: string; // no leading '@', lowercased
  followerCount: number;
  followingCount?: number | null; // null on the calibration reveal path
  heartCount: number;
  videoCount: number;
  /**
   * Sum of public views across posts in the trailing window (daily cron video
   * scrape). Omitted/null on the calibration-capture path (no video sum) and on a
   * day the video scrape failed → the /start Views tile is omitted for that row.
   */
  recentViews?: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedClient = { from: (t: string) => any };

/**
 * Upsert today's snapshot for a connected account (one row per account per day).
 * Keyed to account_id so a creator's TikTok + Instagram series never collide.
 * Best-effort — callers isolate.
 */
export async function upsertAccountSnapshot(
  supabase: SupabaseClient,
  input: AccountSnapshotInput,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await (supabase as unknown as UntypedClient).from("account_snapshots").upsert(
    {
      account_id: input.accountId,
      user_id: input.userId,
      platform: input.platform,
      handle: input.handle.replace(/^@/, "").toLowerCase(),
      follower_count: input.followerCount,
      following_count: input.followingCount ?? null,
      heart_count: input.heartCount,
      video_count: input.videoCount,
      recent_views: input.recentViews ?? null,
      snapshot_date: today,
    },
    { onConflict: "account_id,snapshot_date" },
  );
}

/**
 * Read one connected account's snapshot series (newest first, capped). RLS scopes
 * to the caller; filtering by account_id keeps each platform/handle its own series.
 */
export async function getAccountSnapshots(
  supabase: SupabaseClient,
  accountId: string,
  limit = 8,
): Promise<AccountSnapshot[]> {
  const { data, error } = await (supabase as unknown as UntypedClient)
    .from("account_snapshots")
    .select("snapshot_date, follower_count, heart_count, video_count, recent_views")
    .eq("account_id", accountId)
    .order("snapshot_date", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as AccountSnapshot[]).map((r) => ({
    snapshot_date: r.snapshot_date,
    follower_count: Number(r.follower_count),
    heart_count: Number(r.heart_count),
    video_count: Number(r.video_count),
    recent_views: r.recent_views == null ? null : Number(r.recent_views),
  }));
}
