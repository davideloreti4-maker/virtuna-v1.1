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
import { rehostAccountCovers } from "@/lib/scraping/rehost-cover";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "account-metrics.account-posts-repo" });

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
  /** Cover thumbnail — OUR storage URL (rehosted), never a raw CDN URL. Null: none. */
  cover_url?: string | null;
}

/**
 * Rehost the covers of `videos` that don't have one stored yet. Returns post_id → our URL for the
 * covers that landed. Best-effort: any failure (no service client, read error, rehost error) yields
 * fewer entries, never a throw. Posts that already carry a cover_url are skipped (no daily re-fetch
 * of ~30 images per account); a cover that failed before is retried on the next upsert.
 */
async function coversToStore(
  db: UntypedClient,
  storage: SupabaseClient | null,
  accountId: string,
  platform: string,
  videos: VideoData[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!storage) return out;
  const withCover = videos.filter((v) => v.platformVideoId && v.coverUrl);
  if (withCover.length === 0) return out;
  try {
    const { data, error } = await db
      .from("account_posts")
      .select("post_id")
      .eq("account_id", accountId)
      .in("post_id", withCover.map((v) => v.platformVideoId))
      .not("cover_url", "is", null);
    if (error) log.warn("existing covers read failed — rehosting all", { error: error.message });
    const have = new Set(((data as { post_id: string }[] | null) ?? []).map((r) => String(r.post_id)));
    const todo = withCover.filter((v) => !have.has(v.platformVideoId));
    const urls = await rehostAccountCovers(
      storage,
      platform,
      todo.map((v) => ({ postId: v.platformVideoId, sourceUrl: v.coverUrl })),
    );
    todo.forEach((v, i) => {
      const url = urls[i];
      if (url) out.set(v.platformVideoId, url);
    });
  } catch (err) {
    log.warn("cover rehost failed — posts stored without new covers", { error: String(err) });
  }
  return out;
}

function defaultStorage(): SupabaseClient | null {
  try {
    return createServiceClient() as unknown as SupabaseClient;
  } catch {
    return null;
  }
}

/**
 * Upsert the creator's recent posts (one row per platform video). Idempotent on
 * (account_id, post_id): a re-scrape refreshes metrics/caption but PRESERVES an
 * existing pillar_id + created_at (clustering owns pillar_id; created_at is first-seen)
 * because neither is in the row payload → they stay out of the ON CONFLICT UPDATE SET.
 * Best-effort — the caller isolates this from the snapshot write.
 */
export async function upsertAccountPosts(
  supabase: SupabaseClient,
  accountId: string,
  userId: string,
  platform: string,
  handle: string,
  videos: VideoData[],
  opts: {
    /** Client that writes the `covers` bucket (the service client). Omitted: one is created.
     *  null: skip cover rehosting. */
    storage?: SupabaseClient | null;
  } = {},
): Promise<void> {
  if (videos.length === 0) return;
  const db = supabase as unknown as UntypedClient;
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage;
  const covers = await coversToStore(db, storage, accountId, platform, videos);
  const now = new Date().toISOString();
  const normalizedHandle = handle.replace(/^@/, "").toLowerCase();
  const rows = videos.map((v) => ({
    account_id: accountId,
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
  // Two upserts: rows with a NEW cover carry cover_url; the rest omit the column entirely so the
  // ON CONFLICT UPDATE never overwrites a cover stored earlier with null (a column absent from the
  // payload stays out of the UPDATE SET, as pillar_id does).
  const withCover = rows
    .filter((r) => covers.has(r.post_id))
    .map((r) => ({ ...r, cover_url: covers.get(r.post_id)! }));
  const withoutCover = rows.filter((r) => !covers.has(r.post_id));
  for (const batch of [withoutCover, withCover]) {
    if (batch.length === 0) continue;
    const { error } = await db.from("account_posts").upsert(batch, { onConflict: "account_id,post_id" });
    // supabase-js RETURNS write errors; log rather than throw to keep the old non-throwing contract.
    if (error) log.error("account_posts upsert failed", { accountId, rows: batch.length, error: error.message });
  }
}

const POST_SELECT =
  "post_id, caption, posted_at, views, likes, comments, shares, saves, hashtags, is_pinned, pillar_id, cover_url";

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
    cover_url: typeof r.cover_url === "string" && r.cover_url ? r.cover_url : null,
  };
}

/**
 * Read one connected account's persisted posts, newest first (nulls last), capped.
 * The shared input for BOTH clustering (captions → pillars) and the pillar builder
 * (share / cadence / tone). We only persist the recent scrape window (~30/scrape),
 * so "all persisted" is effectively "recent" — no separate time window needed.
 * Scoped by account_id so pillars are per-account, never merged across handles.
 * RLS-scoped when called with a user client; the cron passes the service client.
 */
export async function listAllPosts(
  supabase: SupabaseClient,
  accountId: string,
  cap = 80,
): Promise<AccountPost[]> {
  const { data, error } = await (supabase as unknown as UntypedClient)
    .from("account_posts")
    .select(POST_SELECT)
    .eq("account_id", accountId)
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(cap);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(normalizePost);
}

/**
 * Assign a batch of posts to one pillar (clustering output). Scoped by account_id so
 * the service client can't cross accounts. Best-effort — the caller isolates.
 */
export async function assignPostsToPillar(
  supabase: SupabaseClient,
  accountId: string,
  pillarId: string,
  postIds: string[],
): Promise<void> {
  if (postIds.length === 0) return;
  await (supabase as unknown as UntypedClient)
    .from("account_posts")
    .update({ pillar_id: pillarId, updated_at: new Date().toISOString() })
    .eq("account_id", accountId)
    .in("post_id", postIds);
}
