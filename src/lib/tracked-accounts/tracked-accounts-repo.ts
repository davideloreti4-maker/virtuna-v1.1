/**
 * Phase 11 Plan 03 — tracked-accounts-repo (EXPLORE-05 / D-08, the watchlist PRODUCER half).
 *
 * Flat-typed watchlist repo. Mirrors shelf-repo.ts:
 *  - SupabaseClient param, zod-validated insert shape.
 *  - user_id ALWAYS derived from the session (CR-01) — NEVER from caller input.
 *
 * Honesty + security spine (CR-01): the persisted user_id is the SESSION user, and
 * the write is an IDEMPOTENT upsert on the UNIQUE(user_id, platform, handle) constraint
 * so re-tracking the same account is a no-op (returns the existing row, never errors).
 *
 * FLAT by construction (D-08): no folder_id, no tags, no CMS. P12 EXTENDS (Library),
 * never reworks this shape.
 *
 * TYPING: the live-prod push + types regen (BLOCKING wave 11-08) added tracked_accounts
 * to src/types/database.types.ts, so the typed client now resolves the from("tracked_accounts")
 * calls — the interim `(supabase as any)` casts were dropped here. The DB types platform as
 * `string`; the domain union narrowing happens on the boundary return cast (mirrors shelf-repo).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// ─── Domain shapes ───────────────────────────────────────────────────────────

export type TrackedAccountPlatform = "tiktok" | "instagram" | "youtube";

/** A persisted tracked_accounts row, in domain form. */
export interface TrackedAccount {
  id: string;
  user_id: string;
  platform: TrackedAccountPlatform;
  handle: string;
  source_video_id: string | null;
  created_at: string;
}

/** Writable insert shape — user_id is NEVER part of it (CR-01, session-derived). */
export interface TrackedAccountInput {
  platform: TrackedAccountPlatform;
  handle: string;
  source_video_id?: string | null;
}

// ─── Zod validation ──────────────────────────────────────────────────────────

const TrackedAccountInputSchema = z.object({
  platform: z.enum(["tiktok", "instagram", "youtube"]),
  handle: z.string().min(1).max(100),
  source_video_id: z.string().nullable().optional(),
});

/**
 * Normalize a tracked handle: strip a leading "@", trim, lowercase.
 * Mirrors the migration comment ("no '@', lowercased") so the UNIQUE constraint
 * dedupes case / "@" variants of the same account.
 */
function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, "").trim().toLowerCase();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * List tracked accounts for the authenticated user, newest first.
 * RLS scopes the rows to the user. (The read P12's Library surface consumes.)
 */
export async function listTrackedAccounts(
  supabase: SupabaseClient,
): Promise<TrackedAccount[]> {
  const { data, error } = await supabase
    .from("tracked_accounts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`tracked_accounts list failed: ${error.message}`);
  }

  // DB types platform as `string`; narrow to the domain union on the boundary
  // (mirrors shelf-repo's typed-row return convention).
  return (data ?? []) as TrackedAccount[];
}

/**
 * Track an account. user_id is derived from the session (CR-01); the handle is
 * normalized (@-stripped, lowercased); the write is an IDEMPOTENT upsert on the
 * UNIQUE(user_id, platform, handle) constraint so re-tracking is a no-op.
 */
export async function createTrackedAccount(
  supabase: SupabaseClient,
  input: TrackedAccountInput,
): Promise<TrackedAccount> {
  const parsed = TrackedAccountInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`invalid tracked account input: ${parsed.error.message}`);
  }

  // CR-01: derive user_id from session, NEVER from input.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const payload = {
    ...parsed.data,
    handle: normalizeHandle(parsed.data.handle),
    user_id: user.id,
  };

  // IDEMPOTENT upsert: re-tracking the same (user, platform, handle) returns the
  // existing row instead of erroring on the UNIQUE constraint.
  const { data, error } = await supabase
    .from("tracked_accounts")
    .upsert(payload, { onConflict: "user_id,platform,handle" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`tracked_accounts create failed: ${error.message}`);
  }

  return data as TrackedAccount;
}

/**
 * Delete a tracked account by id. RLS ensures only the owner can delete.
 */
export async function deleteTrackedAccount(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("tracked_accounts")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`tracked_accounts delete failed: ${error.message}`);
  }
}
