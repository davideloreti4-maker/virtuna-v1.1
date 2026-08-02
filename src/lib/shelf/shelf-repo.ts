/**
 * Phase 10 Plan 02 — saved_items CRUD (SAVE-01/02, the typed flat shelf).
 *
 * Typed CRUD over the saved_items table. Mirrors audience-repo.ts:
 *  - SupabaseClient param, zod-validated insert shape.
 *  - user_id ALWAYS derived from the session (CR-01) — NEVER from caller input.
 *
 * FLAT by construction (D-07): no folder_id, no tags. P12 EXTENDS, never reworks.
 *
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// ─── Domain shapes ───────────────────────────────────────────────────────────

/**
 * The typed shelf's item types.
 *
 * `remix` was added 2026-08-02: remix-card-block saved its output as `hook` because no remix
 * type existed, so the shelf labelled a remix "Hook" and offered it the hook forward action.
 *
 * `format` was REMOVED the same day. It was in the CHECK, this union, the zod enum, the filter
 * bar and the label map — but no renderer has ever emitted one, and the live table holds 0 of
 * them, so the Formats tab was permanently empty. It stays in the DB CHECK (narrowing a
 * constraint buys nothing and would reject a legacy write); it is only gone from the client
 * contract. The card and icon maps keep their `??` fallbacks so a legacy row still renders.
 */
export type SavedItemType =
  | "read"
  | "idea"
  | "hook"
  | "script"
  | "outlier"
  | "remix";

/** A persisted saved_items row, in domain form. */
export interface SavedItem {
  id: string;
  user_id: string;
  item_type: SavedItemType;
  ref_id: string | null;
  thread_id: string | null;
  /** Owning library project, or null for Unfiled. */
  project_id: string | null;
  title: string | null;
  snapshot: Record<string, unknown>;
  created_at: string;
}

/** Writable insert shape — user_id is NEVER part of it (CR-01, session-derived). */
export interface SavedItemInput {
  item_type: SavedItemType;
  ref_id?: string | null;
  thread_id?: string | null;
  project_id?: string | null;
  title?: string | null;
  snapshot: Record<string, unknown>;
}

// ─── Zod validation ──────────────────────────────────────────────────────────

const SavedItemInputSchema = z.object({
  item_type: z.enum(["read", "idea", "hook", "script", "outlier", "remix"]),
  ref_id: z.string().nullable().optional(),
  thread_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  snapshot: z.record(z.string(), z.unknown()),
});

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * List saved items for the authenticated user, newest first.
 * Optionally filter by item_type. RLS scopes to the user.
 */
export async function listSavedItems(
  supabase: SupabaseClient,
  type?: SavedItemType,
): Promise<SavedItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = supabase
    .from("saved_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (type !== undefined) {
    query = query.eq("item_type", type);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`saved_items list failed: ${error.message}`);
  }

  return (data ?? []) as SavedItem[];
}

/**
 * Create a saved item. user_id is derived from the session (CR-01).
 */
export async function createSavedItem(
  supabase: SupabaseClient,
  item: SavedItemInput,
): Promise<SavedItem> {
  const parsed = SavedItemInputSchema.safeParse(item);
  if (!parsed.success) {
    throw new Error(`invalid saved item input: ${parsed.error.message}`);
  }

  // CR-01: derive user_id from session, NEVER from input.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const payload = { ...parsed.data, user_id: user.id };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase
    .from("saved_items")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    // 23505 = the partial unique index on (user_id, item_type, ref_id). Saving something
    // already saved is IDEMPOTENT, not an error: two clicks, a double-submit or a racing
    // remount should all converge on the one row rather than 500. Return the existing row so
    // the caller's cache reconciles to the truth.
    if (error.code === "23505" && parsed.data.ref_id) {
      const { data: existing } = await supabase
        .from("saved_items")
        .select("*")
        .eq("user_id", user.id)
        .eq("item_type", parsed.data.item_type)
        .eq("ref_id", parsed.data.ref_id)
        .maybeSingle();
      if (existing) return existing as SavedItem;
    }
    throw new Error(`saved_items create failed: ${error.message}`);
  }

  return data as SavedItem;
}

/**
 * File (or unfile) saved items in bulk — the selection bar's "Move to project".
 *
 * `projectId === null` unfiles. RLS scopes the update to the owner, and the project_id is
 * verified to belong to the caller before it is written: without that check a crafted request
 * could file the caller's own items into a stranger's project id, which would then leak their
 * titles into that project's counts.
 *
 * Returns the number of rows actually updated, so a caller can tell a no-op from a success.
 */
export async function setSavedItemsProject(
  supabase: SupabaseClient,
  ids: string[],
  projectId: string | null,
): Promise<number> {
  if (ids.length === 0) return 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  if (projectId !== null) {
    const { data: owned, error: ownErr } = await supabase
      .from("library_projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (ownErr) throw new Error(`project lookup failed: ${ownErr.message}`);
    if (!owned) throw new Error("invalid saved item input: unknown project");
  }

  const { data, error } = await supabase
    .from("saved_items")
    .update({ project_id: projectId })
    .in("id", ids)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    throw new Error(`saved_items file failed: ${error.message}`);
  }

  return (data ?? []).length;
}

/**
 * Delete a saved item by id. RLS ensures only the owner can delete.
 */
export async function deleteSavedItem(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase
    .from("saved_items")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`saved_items delete failed: ${error.message}`);
  }
}
