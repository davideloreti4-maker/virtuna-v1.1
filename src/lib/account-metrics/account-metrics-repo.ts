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

/** The (user, handle) pair the cron re-scrapes daily. */
export interface TrackedAccount {
  user_id: string;
  platform: "tiktok" | "instagram" | "youtube";
  handle: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedClient = { from: (t: string) => any };

/** Upsert today's snapshot (one row per user per day). Best-effort — callers isolate. */
export async function upsertAccountSnapshot(
  supabase: SupabaseClient,
  input: AccountSnapshotInput,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await (supabase as unknown as UntypedClient).from("account_snapshots").upsert(
    {
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
    { onConflict: "user_id,snapshot_date" },
  );
}

/** Read a user's snapshot series (newest first, capped). RLS scopes to the caller. */
export async function getAccountSnapshots(
  supabase: SupabaseClient,
  userId: string,
  limit = 8,
): Promise<AccountSnapshot[]> {
  const { data, error } = await (supabase as unknown as UntypedClient)
    .from("account_snapshots")
    .select("snapshot_date, follower_count, heart_count, video_count, recent_views")
    .eq("user_id", userId)
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

/**
 * The distinct accounts to re-scrape daily = the latest handle per user across
 * all snapshots. Self-driving from the table: an account enters the loop once
 * calibration captures its first snapshot. Service-client only (cron).
 */
export async function listTrackedAccounts(
  serviceClient: SupabaseClient,
): Promise<TrackedAccount[]> {
  const { data, error } = await (serviceClient as unknown as UntypedClient)
    .from("account_snapshots")
    .select("user_id, platform, handle, snapshot_date")
    .order("snapshot_date", { ascending: false });

  if (error || !data) return [];

  // Reduce to the most-recent (user_id → handle/platform) pair.
  const latest = new Map<string, TrackedAccount>();
  for (const row of data as Array<TrackedAccount & { snapshot_date: string }>) {
    if (!latest.has(row.user_id)) {
      latest.set(row.user_id, {
        user_id: row.user_id,
        platform: row.platform,
        handle: row.handle,
      });
    }
  }
  return [...latest.values()];
}
