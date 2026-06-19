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

export type SavedItemType =
  | "read"
  | "idea"
  | "hook"
  | "script"
  | "outlier"
  | "format";

/** A persisted saved_items row, in domain form. */
export interface SavedItem {
  id: string;
  user_id: string;
  item_type: SavedItemType;
  ref_id: string | null;
  thread_id: string | null;
  title: string | null;
  snapshot: Record<string, unknown>;
  created_at: string;
}

/** Writable insert shape — user_id is NEVER part of it (CR-01, session-derived). */
export interface SavedItemInput {
  item_type: SavedItemType;
  ref_id?: string | null;
  thread_id?: string | null;
  title?: string | null;
  snapshot: Record<string, unknown>;
}

// ─── Zod validation ──────────────────────────────────────────────────────────

const SavedItemInputSchema = z.object({
  item_type: z.enum(["read", "idea", "hook", "script", "outlier", "format"]),
  ref_id: z.string().nullable().optional(),
  thread_id: z.string().uuid().nullable().optional(),
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

  const { data, error } = await supabase
    .from("saved_items")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`saved_items create failed: ${error.message}`);
  }

  return data as SavedItem;
}

/**
 * Delete a saved item by id. RLS ensures only the owner can delete.
 */
export async function deleteSavedItem(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("saved_items")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`saved_items delete failed: ${error.message}`);
  }
}
