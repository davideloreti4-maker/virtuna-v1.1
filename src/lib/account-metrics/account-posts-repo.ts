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

const POST_SELECT =
  "post_id, caption, posted_at, views, likes, comments, shares, saves, hashtags, is_pinned, pillar_id";

function normalizePost(r: Record<string, unknown>): AccountPost {
  return {
    post_id: String(r.post_id),
    caption: (r.caption as string) ?? "",
    posted_at: (r.posted_at as string) ?? null,
    views: Number(r.views ?? 0),
    likes: Number(r.likes ?? 0),
    comments: Number(r.comments ?? 0),
    shares: Number(r.shares ?? 0),
    saves: Number(r.saves ?? 0),
    hashtags: Array.isArray(r.hashtags) ? (r.hashtags as string[]) : [],
    is_pinned: Boolean(r.is_pinned),
    pillar_id: (r.pillar_id as string) ?? null,
  };
}

/**
 * Read a user's persisted posts, newest first (nulls last), capped. This is the
 * shared input for BOTH clustering (captions → pillars) and the pillar builder
 * (share / cadence / tone). We only persist the recent scrape window (~30/scrape),
 * so "all persisted" is effectively "recent" — no separate time window needed.
 * RLS-scoped when called with a user client; the cron passes the service client.
 */
export async function listAllPosts(
  supabase: SupabaseClient,
  userId: string,
  cap = 80,
): Promise<AccountPost[]> {
  const { data, error } = await (supabase as unknown as UntypedClient)
    .from("account_posts")
    .select(POST_SELECT)
    .eq("user_id", userId)
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(cap);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(normalizePost);
}

/**
 * Assign a batch of posts to one pillar (clustering output). Scoped by user_id so
 * the service client can't cross users. Best-effort — the caller isolates.
 */
export async function assignPostsToPillar(
  supabase: SupabaseClient,
  userId: string,
  pillarId: string,
  postIds: string[],
): Promise<void> {
  if (postIds.length === 0) return;
  await (supabase as unknown as UntypedClient)
    .from("account_posts")
    .update({ pillar_id: pillarId, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("post_id", postIds);
}
