/**
 * threads.ts — thread persistence helpers
 *
 * Provides:
 *   createOpenThreadLazy(userId) — idempotent get-or-create for the user's open thread
 *   getOpenThread(userId) — fetch the user's open (reading_id IS NULL) thread
 *
 * Design notes:
 * - userId is ALWAYS passed from the authenticated session server-side; it is
 *   NEVER sourced from a request body (analysis_chats RLS pattern trust boundary).
 * - Writes go through createServiceClient (bypasses RLS for server-side inserts).
 *   Because the service client bypasses RLS, every read-back MUST scope by
 *   user_id explicitly — the DB will not enforce ownership for us here (CR-01).
 * - The partial UNIQUE index on the open-thread key (user_id WHERE reading_id IS
 *   NULL) makes concurrent first-opens collide on the constraint (unique_violation
 *   23505) rather than race to two rows; we catch that and fetch the winner. We do
 *   NOT use ON CONFLICT — Postgres cannot use a *partial* unique index as a conflict
 *   arbiter without its predicate (42P10).
 *
 * Row types derive from the regenerated database.types.ts (Task 3).
 * reading_id is `string | null` — analysis_results.id is `text` on the live DB
 * (not uuid as Pitfall #3 assumed), so the FK resolves to a text/string column.
 */

import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/database.types";

// ─── Row type derived from the regenerated database types (Task 3) ────────────

export type ThreadRow = Database["public"]["Tables"]["threads"]["Row"];

// ─── createOpenThreadLazy ──────────────────────────────────────────────────────
/**
 * Idempotent get-or-create for the user's open thread (type:"open", reading_id IS NULL).
 *
 * GET-FIRST (must mirror the reader). `getOpenThread` (and GET /api/threads/open)
 * resolves the OLDEST open thread; this writer MUST resolve the SAME row so every
 * tool writes into, and the composer reads back from, ONE canonical open thread.
 * The earlier insert-first shape diverged whenever the partial unique index
 * (threads_open_user_unique_idx, user_id WHERE reading_id IS NULL) was absent or
 * non-enforcing on the DB: each call minted a brand-new open thread (the insert
 * never hit 23505) while readers kept reading the oldest, so freshly-written blocks
 * (e.g. the Phase 5 profile-read) never surfaced. Selecting first keeps writer and
 * reader on the same thread and stops duplicate open threads from accumulating.
 *
 * Service-client + user_id-scoped idempotent pattern:
 * - Existing open thread → return it (no insert).
 * - None yet → insert the first open thread.
 * - 23505 unique_violation (concurrent first-open won the race between our select
 *   miss and this insert) → re-select scoped by user_id (CR-01).
 * - Non-conflict insert error → rethrow.
 *
 * Ownership: user_id is always passed from the authenticated session, never from a
 * request body (CR-01 trust boundary). Service client bypasses RLS; every read-back
 * is scoped by user_id to enforce ownership explicitly.
 *
 * @param userId  Session user_id (from supabase.auth.getUser(), never from body).
 * @returns The existing or newly-created open thread row.
 */
export async function createOpenThreadLazy(userId: string): Promise<ThreadRow> {
  // Get-first: return the user's canonical (oldest) open thread if one exists —
  // the exact row GET /api/threads/open reads back (writer/reader alignment).
  const existing = await getOpenThread(userId);
  if (existing) {
    return existing;
  }

  const supabase = createServiceClient();

  // No open thread yet — create the first one for this user.
  const { data: inserted, error: insertError } = await supabase
    .from("threads")
    .insert({ type: "open" as const, reading_id: null, user_id: userId })
    .select("*")
    .single();

  if (inserted) {
    return inserted;
  }

  // 23505 = unique_violation: a concurrent first-open won the race between the
  // getOpenThread miss above and this insert. Re-select the winner, scoped by
  // user_id (CR-01 ownership guard).
  if (insertError?.code === "23505") {
    const winner = await getOpenThread(userId);

    if (winner) {
      return winner;
    }

    throw new Error(
      `createOpenThreadLazy: an open thread exists but is not owned by userId=${userId}. ` +
        `Service client bypasses RLS; ownership scoped to user_id (CR-01).`,
    );
  }

  throw new Error(
    `createOpenThreadLazy: failed to create open thread for userId=${userId}: ${insertError?.message ?? "no data returned"}`,
  );
}

// ─── getOpenThread ────────────────────────────────────────────────────────────
/**
 * Fetch the user's open thread (reading_id IS NULL).
 * Returns null if none exists yet — callers create one lazily when needed.
 * Uses the service client so it can query by user_id without needing an
 * RLS session (server-side caller passes userId from the session).
 *
 * Defensive duplicate tolerance: orders by created_at ASC and takes the
 * first row (oldest = canonical). Before the threads_open_user_unique_idx
 * constraint was applied (migration 20260618000000), duplicate open threads
 * could accumulate. Using .maybeSingle() would throw PGRST116 ("multiple rows
 * returned") in that state — this query shape is safe under both old and new
 * DB state. After the migration the index ensures at most one row matches, so
 * order+limit adds no cost.
 */
export async function getOpenThread(userId: string): Promise<ThreadRow | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("threads")
    .select("*")
    .eq("user_id", userId)
    .eq("type", "open")
    .is("reading_id", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`getOpenThread: failed for userId=${userId}: ${error.message}`);
  }

  return data ?? null;
}
