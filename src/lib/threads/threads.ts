/**
 * threads.ts — thread persistence helpers
 *
 * Multi-thread model (migration 20260626120000_threads_multi_open):
 *   A user owns MANY open threads (one per chat conversation). The ACTIVE thread
 *   is the most-recently-touched open thread (type:"open", reading_id IS NULL,
 *   ORDER BY updated_at DESC). "New Thread" inserts a fresh one; re-opening an
 *   old thread touches its updated_at so it becomes active again.
 *
 * Provides:
 *   createOpenThreadLazy(userId) — get-or-create the user's ACTIVE open thread
 *                                  (idempotent; the ~11 tool routes call this).
 *   getOpenThread(userId)        — fetch the ACTIVE open thread (newest), or null.
 *   createNewThread(userId)      — insert a fresh open thread → newest → active.
 *   touchThread(userId, id)      — bump updated_at so a thread becomes active.
 *   listOpenThreads(userId)      — list the user's open threads, newest-first.
 *
 * Design notes:
 * - userId is ALWAYS passed from the authenticated session server-side; it is
 *   NEVER sourced from a request body (analysis_chats RLS pattern trust boundary).
 * - Writes go through createServiceClient (bypasses RLS for server-side inserts).
 *   Because the service client bypasses RLS, every read/write MUST scope by
 *   user_id explicitly — the DB will not enforce ownership for us here (CR-01).
 *
 * Row types derive from the regenerated database.types.ts.
 * reading_id is `string | null` — analysis_results.id is `text` on the live DB.
 */

import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import { ACTIVE_THREAD_COOKIE, NEW_THREAD_SENTINEL } from "@/lib/threads/active-thread-cookie";
import { cleanThreadTitle } from "@/lib/threads/title";
import type { Database } from "@/types/database.types";

// ─── Row type derived from the regenerated database types ─────────────────────

export type ThreadRow = Database["public"]["Tables"]["threads"]["Row"];

// ─── createOpenThreadLazy ──────────────────────────────────────────────────────
/**
 * Get-or-create the user's ACTIVE open thread (type:"open", reading_id IS NULL).
 *
 * Active = the most-recently-touched open thread. When none exists yet, insert a
 * fresh one. This is the entry point the generative tool routes call to append to
 * "the current thread" — they remain agnostic about which thread is active.
 *
 * Ownership: user_id is always passed from the authenticated session, never from a
 * request body (CR-01 trust boundary). Service client bypasses RLS; reads/inserts
 * are scoped by user_id to enforce ownership explicitly.
 *
 * @param userId  Session user_id (from supabase.auth.getUser(), never from body).
 * @returns The active or newly-created open thread row.
 */
export async function createOpenThreadLazy(userId: string): Promise<ThreadRow> {
  // Active thread already exists → return it (the common path).
  const existing = await getOpenThread(userId);
  if (existing) return existing;

  // None yet → create the user's first open thread.
  const supabase = createServiceClient();
  const { data: inserted, error: insertError } = await supabase
    .from("threads")
    .insert({ type: "open" as const, reading_id: null, user_id: userId })
    .select("*")
    .single();

  if (inserted) return inserted;

  // Concurrent first-open race (two inserts, no unique index anymore): re-select
  // the newest open thread scoped by user_id (CR-01 ownership guard).
  const retry = await getOpenThread(userId);
  if (retry) return retry;

  throw new Error(
    `createOpenThreadLazy: failed to create open thread for userId=${userId}: ${insertError?.message ?? "no data returned"}`,
  );
}

// ─── getOpenThread ────────────────────────────────────────────────────────────
/**
 * Fetch the user's ACTIVE open thread — the most-recently-touched open thread
 * (type:"open", reading_id IS NULL, ORDER BY updated_at DESC). Returns null if
 * none exists yet — callers create one lazily when needed.
 *
 * Uses the service client so it can query by user_id without an RLS session
 * (the server-side caller passes userId from the session). The order+limit shape
 * resolves to at most one row even when the user owns several open threads.
 */
export async function getOpenThread(userId: string): Promise<ThreadRow | null> {
  const supabase = createServiceClient();

  // ── Explicit active-thread pointer (active-thread-cookie.ts) ────────────────
  // The pointer decouples "which thread is open" from "which was messaged last".
  const pointer = await readActiveThreadPointer();

  // Blank "new thread" pointer → nothing persisted yet (row is created on first
  // send). Return null so the composer renders the empty/new-chat state.
  if (pointer === NEW_THREAD_SENTINEL) return null;

  // A concrete pointer → resolve that thread, but ONLY if it is still an owned
  // open chat thread (ownership re-verified here — the cookie is untrusted input).
  if (pointer) {
    const { data: pointed } = await supabase
      .from("threads")
      .select("*")
      .eq("id", pointer)
      .eq("user_id", userId)
      .eq("type", "open")
      .is("reading_id", null)
      .maybeSingle();
    if (pointed) return pointed;
    // Stale/foreign/archived pointer → fall through to the newest-open default.
  }

  // Default (no pointer, or a stale one): the newest open thread.
  const { data, error } = await supabase
    .from("threads")
    .select("*")
    .eq("user_id", userId)
    .eq("type", "open")
    .is("reading_id", null)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`getOpenThread: failed for userId=${userId}: ${error.message}`);
  }

  return data ?? null;
}

// ─── readActiveThreadPointer ──────────────────────────────────────────────────
/**
 * Read the active-thread pointer cookie (the id of the currently-open thread, or
 * the NEW_THREAD_SENTINEL for a fresh blank thread). Returns null outside a request
 * scope — unit tests call the thread helpers directly, where next/headers cookies()
 * throws; swallowing it makes those callers fall back to the newest-open default,
 * preserving pre-pointer behaviour.
 */
async function readActiveThreadPointer(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(ACTIVE_THREAD_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

// ─── createNewThread ────────────────────────────────────────────────────────────
/**
 * Insert a fresh open thread for the user. Because updated_at defaults to now(),
 * the new thread is the newest → it immediately becomes the ACTIVE thread.
 * Backs the "New Thread" sidebar action.
 */
export async function createNewThread(userId: string): Promise<ThreadRow> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("threads")
    .insert({ type: "open" as const, reading_id: null, user_id: userId })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `createNewThread: failed for userId=${userId}: ${error?.message ?? "no data returned"}`,
    );
  }

  return data;
}

// ─── touchThread ────────────────────────────────────────────────────────────────
/**
 * Bump a thread's updated_at to now() so it becomes the ACTIVE (newest) open
 * thread. Backs the "re-open a past thread" sidebar action. Ownership-scoped by
 * user_id (CR-01) and restricted to open threads. Returns true on a real update.
 */
export async function touchThread(userId: string, threadId: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId)
    .eq("user_id", userId)
    .eq("type", "open")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`touchThread: failed for threadId=${threadId}: ${error.message}`);
  }

  return data != null;
}

// ─── setThreadTitleIfEmpty ────────────────────────────────────────────────────
/**
 * Set a thread's sidebar title ONCE — the update is guarded by `title IS NULL`,
 * so the first meaningful signal wins (typed ask > skill subject > read-repair)
 * and concurrent writers can't overwrite each other. Ownership-scoped by user_id
 * (CR-01). BEST-EFFORT: titles are cosmetic — this never throws, because callers
 * sit inside send/SSE paths where a title failure must not fail the message.
 *
 * Returns true when this call actually set the title.
 */
export async function setThreadTitleIfEmpty(
  userId: string,
  threadId: string,
  rawTitle: unknown,
): Promise<boolean> {
  const title = cleanThreadTitle(rawTitle);
  if (!title) return false;

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("threads")
      .update({ title })
      .eq("id", threadId)
      .eq("user_id", userId)
      .is("title", null)
      .select("id")
      .maybeSingle();
    return !error && data != null;
  } catch {
    return false;
  }
}

// ─── archiveThread ────────────────────────────────────────────────────────────
/**
 * Archive an open chat thread: flip its type "open" → "archived" so it drops out
 * of the sidebar list (listOpenThreads/getOpenThread both filter type="open")
 * WITHOUT deleting the conversation — reversible, no message cascade. Backs the
 * sidebar "Delete thread" action. Ownership-scoped by user_id (CR-01) and
 * restricted to open threads (you can only archive your own live chat threads).
 * Returns true on a real update, false when no matching open thread was found.
 */
export async function archiveThread(userId: string, threadId: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("threads")
    .update({ type: "archived", updated_at: new Date().toISOString() })
    .eq("id", threadId)
    .eq("user_id", userId)
    .eq("type", "open")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`archiveThread: failed for threadId=${threadId}: ${error.message}`);
  }

  return data != null;
}

// ─── listOpenThreads ──────────────────────────────────────────────────────────

/** A thread summary row for the sidebar list (no message bodies). */
export interface OpenThreadSummary {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * List the user's open threads, newest-first (active thread = index 0).
 * Bounded; the sidebar only renders the most recent slice. title is the
 * persisted label (null = legacy/untitled — the /api/threads/list route
 * derives + read-repairs those); the query stays message-body-free.
 */
export async function listOpenThreads(
  userId: string,
  limit = 50,
): Promise<OpenThreadSummary[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("threads")
    .select("id, title, created_at, updated_at")
    .eq("user_id", userId)
    .eq("type", "open")
    .is("reading_id", null)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`listOpenThreads: failed for userId=${userId}: ${error.message}`);
  }

  return (data ?? []) as OpenThreadSummary[];
}
