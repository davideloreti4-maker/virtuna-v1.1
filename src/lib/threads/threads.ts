/**
 * threads.ts — thread persistence helpers
 *
 * Provides:
 *   createGroundedThreadLazy(readingId, userId) — idempotent upsert via
 *     onConflict: reading_id + ignoreDuplicates (D-15 / THREAD-01)
 *   getThread(id)        — fetch a single thread by id
 *   getOpenThread(userId) — fetch the user's open (reading_id IS NULL) thread
 *
 * Design notes:
 * - userId is ALWAYS passed from the authenticated session server-side; it is
 *   NEVER sourced from a request body (analysis_chats RLS pattern trust boundary).
 * - Writes go through createServiceClient (bypasses RLS for server-side inserts).
 * - Reads go through the RLS-scoped session client so the DB enforces ownership.
 * - The UNIQUE partial index on reading_id makes concurrent first-opens collide
 *   on the constraint rather than race; ignoreDuplicates handles the collision.
 *
 * NOTE: threads/messages Row types will appear after Task 3 regenerates
 * database.types.ts from the live DB. Until then the return types are manually
 * matched to the migration schema shape.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

// ─── Shape (mirrors migration schema; replaced by generated types after Task 3) ─

export interface ThreadRow {
  id: string;
  user_id: string;
  type: "grounded" | "open";
  reading_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── createGroundedThreadLazy ──────────────────────────────────────────────────
/**
 * Idempotent upsert: if a grounded thread for this readingId already exists,
 * returns it; otherwise inserts a new one.
 *
 * Uses onConflict: 'reading_id' + ignoreDuplicates so that concurrent
 * first-opens (two tabs opening the same Reading simultaneously) collide on the
 * UNIQUE partial index instead of racing to two rows (D-15).
 *
 * After the upsert/no-op, selects the guaranteed-existing row by reading_id and
 * returns it. Uses the service client so the INSERT bypasses RLS (user_id is
 * passed explicitly from the session, never from the request body).
 */
export async function createGroundedThreadLazy(
  readingId: string,
  userId: string,
): Promise<ThreadRow> {
  const supabase = createServiceClient();

  // Upsert: on conflict on reading_id, do nothing (idempotent).
  await supabase
    .from("threads")
    .upsert(
      { type: "grounded" as const, reading_id: readingId, user_id: userId },
      { onConflict: "reading_id", ignoreDuplicates: true },
    );

  // Select the now-guaranteed row (works whether we inserted or hit the conflict).
  const { data, error } = await supabase
    .from("threads")
    .select("*")
    .eq("reading_id", readingId)
    .single();

  if (error || !data) {
    throw new Error(
      `createGroundedThreadLazy: failed to fetch thread for reading_id=${readingId}: ${error?.message ?? "no data"}`,
    );
  }

  return data as ThreadRow;
}

// ─── getThread ────────────────────────────────────────────────────────────────
/**
 * Fetch a single thread by id.
 * Uses the RLS-scoped session client — the DB enforces ownership.
 */
export async function getThread(id: string): Promise<ThreadRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("threads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`getThread: failed for id=${id}: ${error.message}`);
  }

  return (data as ThreadRow | null) ?? null;
}

// ─── getOpenThread ────────────────────────────────────────────────────────────
/**
 * Fetch the user's open thread (reading_id IS NULL).
 * Returns null if none exists yet — callers create one lazily when needed.
 * Uses the service client so it can query by user_id without needing an
 * RLS session (server-side caller passes userId from the session).
 */
export async function getOpenThread(userId: string): Promise<ThreadRow | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("threads")
    .select("*")
    .eq("user_id", userId)
    .eq("type", "open")
    .is("reading_id", null)
    .maybeSingle();

  if (error) {
    throw new Error(`getOpenThread: failed for userId=${userId}: ${error.message}`);
  }

  return (data as ThreadRow | null) ?? null;
}
