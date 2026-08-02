/**
 * library_projects CRUD — the Library's organizing model (lane/library-rework, 2026-08-02).
 *
 * Manual folders over saved OUTPUTS: single membership, no tags, no nesting. Mirrors
 * shelf-repo.ts exactly — SupabaseClient param, zod-validated input, `user_id` ALWAYS derived
 * from the session (CR-01) and NEVER accepted from caller input.
 *
 * ⚠️ This is `library_projects`, NOT the older `public.projects` table. That one has zero code
 * references and still holds two seeded 'My Boards' rows defaulted to #FF7F50 — the retired
 * Raycast coral. It is deliberately left alone.
 *
 * NO COUNT AGGREGATION LIVES HERE. The shelf already fetches every saved row via GET /api/saved,
 * so per-project counts, per-type breakdowns and thread counts are derived on the client from
 * that one list. A second server-side source for the same numbers is how two counts that must
 * agree start disagreeing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// ─── Domain shapes ───────────────────────────────────────────────────────────

/** A persisted library_projects row, in domain form. */
export interface LibraryProject {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  /** Touched whenever an item is filed in or out, so "updated 2 days ago" is honest. */
  updated_at: string;
}

/** Writable shape — user_id is NEVER part of it (CR-01, session-derived). */
export interface LibraryProjectInput {
  name: string;
}

// ─── Zod validation ──────────────────────────────────────────────────────────

/**
 * The trimmed name is what gets stored and what the DB CHECK measures, so validate the trimmed
 * value rather than the raw one — otherwise "   " passes a min(1) check and then violates the
 * constraint as a 500 instead of a 400.
 */
const NameSchema = z
  .string()
  .transform((s) => s.trim())
  .refine((s) => s.length >= 1 && s.length <= 80, {
    message: "name must be 1–80 characters after trimming",
  });

const ProjectInputSchema = z.object({ name: NameSchema });

/** Postgres unique-violation — the (user_id, lower(btrim(name))) index. */
const UNIQUE_VIOLATION = "23505";

/** Thrown for a duplicate name so the route can answer 409 instead of a blanket 500. */
export class DuplicateProjectNameError extends Error {
  constructor(name: string) {
    super(`a project named "${name}" already exists`);
    this.name = "DuplicateProjectNameError";
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** List the caller's projects, most recently touched first. RLS scopes to the user. */
export async function listProjects(supabase: SupabaseClient): Promise<LibraryProject[]> {
  const { data, error } = await supabase
    .from("library_projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`library_projects list failed: ${error.message}`);
  }

  return (data ?? []) as LibraryProject[];
}

/** Create a project. user_id is derived from the session (CR-01). */
export async function createProject(
  supabase: SupabaseClient,
  input: LibraryProjectInput,
): Promise<LibraryProject> {
  const parsed = ProjectInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`invalid project input: ${parsed.error.message}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const { data, error } = await supabase
    .from("library_projects")
    .insert({ name: parsed.data.name, user_id: user.id })
    .select("*")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw new DuplicateProjectNameError(parsed.data.name);
    throw new Error(`library_projects create failed: ${error.message}`);
  }

  return data as LibraryProject;
}

/** Rename a project. RLS scopes the write to the owner. */
export async function renameProject(
  supabase: SupabaseClient,
  id: string,
  name: string,
): Promise<LibraryProject | null> {
  const parsed = NameSchema.safeParse(name);
  if (!parsed.success) {
    throw new Error(`invalid project input: ${parsed.error.message}`);
  }

  const { data, error } = await supabase
    .from("library_projects")
    .update({ name: parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw new DuplicateProjectNameError(parsed.data);
    throw new Error(`library_projects rename failed: ${error.message}`);
  }

  return (data as LibraryProject | null) ?? null;
}

/**
 * Delete a project. Its items are UNFILED, never deleted — `saved_items.project_id` is
 * ON DELETE SET NULL, so the saved work survives and reappears under Unfiled.
 */
export async function deleteProject(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("library_projects").delete().eq("id", id);

  if (error) {
    throw new Error(`library_projects delete failed: ${error.message}`);
  }
}

/**
 * Touch `updated_at` so "updated 2 days ago" reflects filing activity, not just renames.
 *
 * Best-effort by design: filing already succeeded by the time this runs, so a failure here
 * must not fail the caller's request — it would report an error for a mutation that landed.
 */
export async function touchProject(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase
    .from("library_projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);
}
