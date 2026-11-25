/**
 * posted-repo.ts — the `piece_posts` table's reads and writes (plan 2026-11-24-after-posting, Task 1).
 *
 * SERVER ONLY in use (it takes a Supabase client; it never makes one). Every query is scoped by hand to the
 * caller's `user_id` as well as by row level security, so the service client (which bypasses it) reaches
 * only the caller's rows too. Ids that are not uuids are refused before any query.
 *
 * Removing a link keeps its row (`removePost` sets `removed_at`, ruling 5): every lookup, listing, due and
 * per-account read, and every change, takes live rows only (`removed_at is null`); only `linksInLastDay`
 * counts removed rows too, so removing a link never lowers the day's cap.
 *
 * What Maven said (`said_*`) is written once, by `insertPost`: `updatePost` cannot change it, nor the piece,
 * the person or the removal (`PostPatch`). Error messages carry the database's message, never the pasted link.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database.types";
import { ANALYSIS_ID_PATTERN, HANDLE_PATTERN, READS_KEPT, UUID_PATTERN, isBeingRead, isDue, type PiecePostRow, type PostedPieceKind } from "./posted";

type Db = SupabaseClient<Database>;

/** Every column, held equal to the migration by `__tests__/posted-repo.test.ts`. */
export const PIECE_POST_SELECT =
  "id, user_id, thread_id, piece_key, piece_kind, said_number, said_measure, said_at, platform, post_url, post_id, handle, posted_at, views, likes, comments, shares, saves, read_at, reads, settled_at, usual_views, usual_posts, attempts, read_error, last_attempt_at, removed_at, created_at, updated_at";

const isUuid = (id: unknown): id is string => typeof id === "string" && UUID_PATTERN.test(id);
const DAY_MS = 24 * 3_600_000;
/** Postgres's unique violation: the piece already has a post. */
const UNIQUE_VIOLATION = "23505";

function fail(what: string, error: { message: string }): never {
  throw new Error(`piece_posts ${what} failed: ${error.message}`);
}

// ─── Writes ─────────────────────────────────────────────────────────────────

/** A new link: the piece, what Maven said about it, and the link as pasted (already through `parsePostLink`). */
export interface NewPost {
  threadId: string | null;
  pieceKey: string;
  pieceKind: PostedPieceKind;
  said: { number: number; measure: "stop" | "end"; at: string | null };
  postUrl: string;
}

/** Inserts the caller's link and returns the stored row; null when the piece already has a live post. */
export async function insertPost(client: Db, userId: string, post: NewPost): Promise<PiecePostRow | null> {
  const { data, error } = await client
    .from("piece_posts")
    .insert({
      user_id: userId,
      thread_id: post.threadId,
      piece_key: post.pieceKey,
      piece_kind: post.pieceKind,
      said_number: post.said.number,
      said_measure: post.said.measure,
      said_at: post.said.at,
      platform: "tiktok",
      post_url: post.postUrl,
    })
    .select(PIECE_POST_SELECT)
    .single();
  if (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) return null;
    fail("insert", error);
  }
  return data;
}

/** What a read may change. Never the person, the piece, what Maven said, when it was linked, or its removal. */
export type PostPatch = Partial<
  Pick<
    PiecePostRow,
    | "post_url"
    | "post_id"
    | "handle"
    | "posted_at"
    | "views"
    | "likes"
    | "comments"
    | "shares"
    | "saves"
    | "read_at"
    | "reads"
    | "settled_at"
    | "usual_views"
    | "usual_posts"
    | "attempts"
    | "read_error"
    | "last_attempt_at"
  >
>;

/** Writes the patch (and `updated_at = now`) to the caller's live row; the row after, or null when there is
 *  no live row of theirs with that id. */
export async function updatePost(client: Db, userId: string, id: string, patch: PostPatch, now: Date = new Date()): Promise<PiecePostRow | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await client
    .from("piece_posts")
    .update({ ...patch, updated_at: now.toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .is("removed_at", null)
    .select(PIECE_POST_SELECT)
    .maybeSingle();
  if (error) fail("update", error);
  return data;
}

/** A `timestamptz` as PostgREST writes it; only such a time is put into a filter. */
const STORED_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::\d{2}){0,2})$/;

/**
 * Claims the caller's live, unsettled rows for a read, in ONE statement (rulings 18 and 22), and returns the
 * rows it got, as stored after: it sets `last_attempt_at = now` and `read_error = null`, so a claimed row reads
 * as in progress (`isBeingRead`) to every other caller until its read writes its end.
 *
 * A row is taken when no read is on it as the caller last read it (`isBeingRead` false: no attempt, one a
 * `CLAIM_SECONDS` old or older, or one that ended) AND it has not changed since: the statement is a compare-and-set on
 * the `last_attempt_at` the caller saw (every claim and every end of a read writes it). PostgREST cannot
 * compare two columns, so "ended" (`read_at >= last_attempt_at`) is decided on the row as read; the
 * compare-and-set makes that decision hold at the moment of the write. A row it did not get is another run's.
 */
export async function claimPosts(client: Db, userId: string, rows: readonly PiecePostRow[], now: Date): Promise<PiecePostRow[]> {
  const seen = new Map<string, string | null>();
  for (const row of rows) {
    if (!isUuid(row.id) || seen.has(row.id) || isBeingRead(row, now)) continue;
    if (row.last_attempt_at !== null && !STORED_TIME.test(row.last_attempt_at)) continue;
    seen.set(row.id, row.last_attempt_at);
  }
  if (seen.size === 0) return [];
  const at = now.toISOString();
  // One `and(...)` per row: its id and the attempt time as seen (quoted: a time holds `:` and `.`).
  const unchanged = [...seen].map(([id, attempt]) =>
    attempt === null ? `and(id.eq.${id},last_attempt_at.is.null)` : `and(id.eq.${id},last_attempt_at.eq."${attempt}")`,
  );
  const { data, error } = await client
    .from("piece_posts")
    .update({ last_attempt_at: at, read_error: null, updated_at: at })
    .eq("user_id", userId)
    .is("removed_at", null)
    .is("settled_at", null)
    .in("id", [...seen.keys()])
    .or(unchanged.join(","))
    .select(PIECE_POST_SELECT);
  if (error) fail("claim", error);
  return data ?? [];
}

/**
 * Gives back posts a run claimed and did not read (ruling 26; the 3-call cap, or a run that failed after its
 * claim): puts back the `last_attempt_at` and `read_error` each had before the claim (`before`: the rows as the
 * run read them before claiming). Guarded: only a row that still holds what this run's claim wrote (the
 * claim's time, no error) is changed, so a read that ended it, or another claim, is never undone. One
 * statement per post.
 */
export async function releasePosts(client: Db, userId: string, before: readonly PiecePostRow[], now: Date): Promise<void> {
  const claimedAt = now.toISOString();
  for (const row of before) {
    if (!isUuid(row.id)) continue;
    const { error } = await client
      .from("piece_posts")
      .update({ last_attempt_at: row.last_attempt_at, read_error: row.read_error, updated_at: claimedAt })
      .eq("id", row.id)
      .eq("user_id", userId)
      .is("removed_at", null)
      .eq("last_attempt_at", claimedAt)
      .is("read_error", null);
    if (error) fail("release", error);
  }
}

/** Removes the caller's link: sets `removed_at` and keeps the row. True when a live row of theirs was found. */
export async function removePost(client: Db, userId: string, id: string, now: Date = new Date()): Promise<boolean> {
  if (!isUuid(id)) return false;
  const at = now.toISOString();
  const { data, error } = await client
    .from("piece_posts")
    .update({ removed_at: at, updated_at: at })
    .eq("id", id)
    .eq("user_id", userId)
    .is("removed_at", null)
    .select("id");
  if (error) fail("remove", error);
  return (data ?? []).length > 0;
}

// ─── Reads ──────────────────────────────────────────────────────────────────

/** The caller's live post of one piece (a chat's, or one outside a chat when `threadId` is null), or null. */
export async function postOfPiece(client: Db, userId: string, piece: { threadId: string | null; pieceKey: string }): Promise<PiecePostRow | null> {
  if (piece.threadId !== null && !isUuid(piece.threadId)) return null;
  const base = client.from("piece_posts").select(PIECE_POST_SELECT).eq("user_id", userId).is("removed_at", null);
  const scoped = piece.threadId === null ? base.is("thread_id", null) : base.eq("thread_id", piece.threadId);
  const { data, error } = await scoped.eq("piece_key", piece.pieceKey).maybeSingle();
  if (error) fail("read", error);
  return data;
}

/** The caller's live post with this id, or null. */
export async function postOfId(client: Db, userId: string, id: string): Promise<PiecePostRow | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await client
    .from("piece_posts")
    .select(PIECE_POST_SELECT)
    .eq("user_id", userId)
    .is("removed_at", null)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("read", error);
  return data;
}

/**
 * The caller's live post of a video (its analysis id), in whichever chat it was linked from or in none;
 * the one linked last when there are several. A video is one piece wherever its card sits, so this is how
 * a video's post is found, not `postOfPiece`.
 */
export async function postOfVideo(client: Db, userId: string, analysisId: string): Promise<PiecePostRow | null> {
  if (typeof analysisId !== "string" || !ANALYSIS_ID_PATTERN.test(analysisId)) return null;
  const { data, error } = await client
    .from("piece_posts")
    .select(PIECE_POST_SELECT)
    .eq("user_id", userId)
    .is("removed_at", null)
    .eq("piece_kind", "video")
    .eq("piece_key", analysisId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);
  if (error) fail("read", error);
  return data?.[0] ?? null;
}

/** The caller's live posts of these chats in one select, linked last first. */
export async function postsOfThreads(client: Db, userId: string, threadIds: readonly string[]): Promise<PiecePostRow[]> {
  const ids = [...new Set(threadIds.filter(isUuid))];
  if (ids.length === 0) return [];
  const { data, error } = await client
    .from("piece_posts")
    .select(PIECE_POST_SELECT)
    .eq("user_id", userId)
    .is("removed_at", null)
    .in("thread_id", ids)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) fail("read", error);
  return data ?? [];
}

/**
 * The caller's live posts a read is owed for now (`isDue`), oldest linked first. The select leaves out settled
 * posts and gone ones (ruling 14: a post with numbers whose reads failed is still read again, more slowly);
 * `isDue` decides the rest by the clock.
 */
export async function duePosts(client: Db, userId: string, now: Date): Promise<PiecePostRow[]> {
  const { data, error } = await client
    .from("piece_posts")
    .select(PIECE_POST_SELECT)
    .eq("user_id", userId)
    .is("removed_at", null)
    .is("settled_at", null)
    // `neq` alone would leave out null too (SQL: null <> 'gone' is not true).
    .or("read_error.is.null,read_error.neq.gone")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) fail("read", error);
  return (data ?? []).filter((row) => isDue(row, now));
}

/** The caller's live posts of one account that are not settled yet (a settled post's numbers never change). */
export async function postsOfHandle(client: Db, userId: string, handle: string): Promise<PiecePostRow[]> {
  if (!HANDLE_PATTERN.test(handle)) return [];
  const { data, error } = await client
    .from("piece_posts")
    .select(PIECE_POST_SELECT)
    .eq("user_id", userId)
    .is("removed_at", null)
    .eq("handle", handle)
    .is("settled_at", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) fail("read", error);
  return data ?? [];
}

/** How many links the caller added in the 24 hours before `now`, removed ones included (ruling 5). */
export async function linksInLastDay(client: Db, userId: string, now: Date): Promise<number> {
  const since = new Date(now.getTime() - DAY_MS).toISOString();
  const { count, error } = await client
    .from("piece_posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gt("created_at", since);
  if (error) fail("count", error);
  return count ?? 0;
}

// ─── Kept reads ─────────────────────────────────────────────────────────────

/** One kept read of a post's numbers. A type (not an interface) so it is a `Json` value. */
export type PostedRead = {
  at: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
};

const COUNT_KEYS = ["views", "likes", "comments", "shares", "saves"] as const;

function readOf(value: unknown): PostedRead | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.at !== "string" || !Number.isFinite(Date.parse(v.at))) return null;
  if (!COUNT_KEYS.every((k) => typeof v[k] === "number" && Number.isFinite(v[k]) && (v[k] as number) >= 0)) return null;
  return { at: v.at, views: v.views as number, likes: v.likes as number, comments: v.comments as number, shares: v.shares as number, saves: v.saves as number };
}

/** The stored reads with `read` added: in time order, newest last, the newest `READS_KEPT` kept. What is not
 *  a read is dropped. */
export function appendRead(reads: Json | null | undefined, read: PostedRead): PostedRead[] {
  const kept = (Array.isArray(reads) ? reads : []).map(readOf).filter((r): r is PostedRead => r !== null);
  return [...kept, read].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(-READS_KEPT);
}
