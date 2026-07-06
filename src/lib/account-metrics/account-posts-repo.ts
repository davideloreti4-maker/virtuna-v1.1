/**
 * account-posts-repo — persistence for account_posts (the own-account per-post
 * archive behind content pillars).
 *
 * Producer: the refresh-account-snapshots cron upserts the recent videos it already
 * scrapes (best-effort, isolated from the snapshot write). The pillar builder +
 * clustering read a user's recent window (RLS-scoped). Cast convention mirrors
 * account-metrics-repo (account_posts isn't in database.types.ts yet).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { VideoData } from "@/lib/scraping/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedClient = { from: (t: string) => any };

/** One archived own-account post (the pillar builder's + clustering input row). */
export interface AccountPost {
  post_id: string;
  caption: string;
  posted_at: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  hashtags: string[];
  is_pinned: boolean;
  pillar_id: string | null;
}

/**
 * Upsert the creator's recent posts (one row per platform video). Idempotent on
 * (user, platform, post_id): a re-scrape refreshes metrics/caption but PRESERVES an
 * existing pillar_id + created_at (clustering owns pillar_id; created_at is first-seen)
 * because neither is in the row payload → they stay out of the ON CONFLICT UPDATE SET.
 * Best-effort — the caller isolates this from the snapshot write.
 */
export async function upsertAccountPosts(
  supabase: SupabaseClient,
  userId: string,
  platform: string,
  handle: string,
  videos: VideoData[],
): Promise<void> {
  if (videos.length === 0) return;
  const now = new Date().toISOString();
  const normalizedHandle = handle.replace(/^@/, "").toLowerCase();
  const rows = videos.map((v) => ({
    user_id: userId,
    platform,
    handle: normalizedHandle,
    post_id: v.platformVideoId,
    caption: v.caption ?? "",
    posted_at: v.postedAt ? v.postedAt.toISOString() : null,
    views: v.views ?? 0,
    likes: v.likes ?? 0,
    comments: v.comments ?? 0,
    shares: v.shares ?? 0,
    saves: v.saves ?? 0,
    hashtags: v.hashtags ?? [],
    is_pinned: v.isPinned ?? false,
    updated_at: now,
  }));
  await (supabase as unknown as UntypedClient)
    .from("account_posts")
    .upsert(rows, { onConflict: "user_id,platform,post_id" });
}
