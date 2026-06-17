/**
 * threads.ts — thread persistence helpers
 *
 * Provides:
 *   createGroundedThreadLazy(readingId, userId) — idempotent insert-or-fetch,
 *     keyed on the partial UNIQUE index on reading_id (D-15 / THREAD-01)
 *   getThread(id)        — fetch a single thread by id
 *   getOpenThread(userId) — fetch the user's open (reading_id IS NULL) thread
 *
 * Design notes:
 * - userId is ALWAYS passed from the authenticated session server-side; it is
 *   NEVER sourced from a request body (analysis_chats RLS pattern trust boundary).
 * - Writes go through createServiceClient (bypasses RLS for server-side inserts).
 *   Because the service client bypasses RLS, every read-back MUST scope by
 *   user_id explicitly — the DB will not enforce ownership for us here (CR-01).
 * - getThread reads go through the RLS-scoped session client so the DB enforces
 *   ownership.
 * - The partial UNIQUE index on reading_id makes concurrent first-opens collide
 *   on the constraint (unique_violation 23505) rather than race to two rows; we
 *   catch that and fetch the winner. We do NOT use ON CONFLICT — Postgres cannot
 *   use a *partial* unique index as a conflict arbiter without its predicate (42P10).
 *
 * Row types derive from the regenerated database.types.ts (Task 3).
 * reading_id is `string | null` — analysis_results.id is `text` on the live DB
 * (not uuid as Pitfall #3 assumed), so the FK resolves to a text/string column.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

// ─── Row type derived from the regenerated database types (Task 3) ────────────

export type ThreadRow = Database["public"]["Tables"]["threads"]["Row"];

// ─── createGroundedThreadLazy ──────────────────────────────────────────────────
/**
 * Idempotent: if a grounded thread for this readingId already exists, returns
 * it; otherwise inserts a new one.
 *
 * Tries a fresh insert first. The partial UNIQUE index on reading_id (WHERE
 * reading_id IS NOT NULL) makes a second open of the same Reading raise a
 * unique_violation (23505) instead of creating a duplicate row (D-15); we catch
 * that and re-select the existing row. We deliberately avoid ON CONFLICT —
 * Postgres cannot use a *partial* unique index as a conflict arbiter without its
 * predicate, which PostgREST's onConflict does not emit (it would throw 42P10).
 *
 * Uses the service client so the INSERT bypasses RLS (user_id is passed
 * explicitly from the session, never from the request body). Because RLS is
 * bypassed, the conflict read-back is scoped by user_id so a caller passing
 * another user's reading_id is denied rather than handed someone else's thread
 * (CR-01).
 */
export async function createGroundedThreadLazy(
  readingId: string,
  userId: string,
): Promise<ThreadRow> {
  const supabase = createServiceClient();

  // Fresh-insert path: succeeds on the first open of this Reading.
  const { data: inserted, error: insertError } = await supabase
    .from("threads")
    .insert({ type: "grounded" as const, reading_id: readingId, user_id: userId })
    .select("*")
    .single();

  if (inserted) {
    return inserted;
  }

  // 23505 = unique_violation: a grounded thread for this reading_id already
  // exists. Re-select it, SCOPED BY user_id — the service client bypasses RLS,
  // so ownership must be enforced here (CR-01). A reading_id owned by a different
  // user yields no row and is denied below.
  if (insertError?.code === "23505") {
    const { data: existing, error: selectError } = await supabase
      .from("threads")
      .select("*")
      .eq("reading_id", readingId)
      .eq("user_id", userId)
      .single();

    if (existing) {
      return existing;
    }

    throw new Error(
      `createGroundedThreadLazy: a grounded thread exists for reading_id=${readingId} but is not owned by userId=${userId}${selectError ? ` (${selectError.message})` : ""}`,
    );
  }

  throw new Error(
    `createGroundedThreadLazy: failed to create thread for reading_id=${readingId}: ${insertError?.message ?? "no data returned"}`,
  );
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

  return data ?? null;
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

  return data ?? null;
}
