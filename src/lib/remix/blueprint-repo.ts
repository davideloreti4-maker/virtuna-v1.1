/**
 * blueprint-repo.ts — the only module that touches `public.remix_blueprints`.
 *
 * supabase-js RETURNS errors, it does not throw them. A caller that ignores `error` stores
 * nothing and never finds out — that failure mode has cost this codebase real debugging time,
 * so every call here inspects `error` and every genuine fault becomes an exception.
 *
 * Both call sites in phase 1 pass the SERVICE client (`@/lib/supabase/service`), which bypasses
 * RLS: the write is in `POST /api/tools/remix/run` and the read is in
 * `GET /api/remix/blueprint/[id]`, which resolves the caller from the session and passes
 * `user.id` in. Ownership is therefore enforced HERE, by the `user_id` predicate on the read —
 * not by the table's RLS policy, which no phase-1 query is subject to. Dropping that predicate
 * would turn any known id into a cross-user read with nothing else to stop it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SourceBlueprint } from "@/lib/engine/remix/blueprint";
import type { AdaptedBeat } from "@/lib/engine/remix/decode-types";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "remix.blueprint-repo" });

/**
 * The columns `BlueprintRow` declares, as PostgREST wants them.
 *
 * Named explicitly instead of `*` so the type and the table cannot drift silently in the read
 * direction: a column that goes missing answers with a real PostgREST error, where `*` would
 * hand back a row with the field simply `undefined`. `created_at` exists on the table and is
 * deliberately NOT read — nothing here uses it, and a `select("*")` cast to `BlueprintRow`
 * would misdescribe what it returns. `clip_uris` joined in phase 4: the run route writes it,
 * the read route signs it, the retention cron sweeps and empties it.
 */
export const BLUEPRINT_COLUMNS =
  "id, user_id, thread_id, source_video_id, blueprint, script, clip_uris";

/**
 * A row as phase 1 writes and reads it.
 *
 * Every NOT NULL column without a default is present, so `insert(row)` is complete; every
 * column the table adds beyond these has a DEFAULT, so it stays valid as the table grows.
 */
export interface BlueprintRow {
  id: string;
  user_id: string;
  thread_id: string | null;
  source_video_id: string | null;
  blueprint: SourceBlueprint;
  /** One entry per ranked variant, in the same order the runner emitted its cards. */
  script: AdaptedBeat[][];
  /**
   * PHASE 4 — storage paths (`<id>/<beatIndex>.mp4`) of this run's clips in the `clips` bucket.
   * Paths, NEVER signed URLs: a signed URL in a durable column is a dead link on day 8 and a
   * live credential in a shared row. [] once the retention cron has swept them (its idempotency
   * marker), and on every run whose cut produced nothing.
   */
  clip_uris: string[];
}

export async function insertBlueprint(service: SupabaseClient, row: BlueprintRow): Promise<void> {
  const { error } = await service.from("remix_blueprints").insert(row);
  if (error) throw new Error(`remix_blueprints insert failed: ${error.message}`);
}

/**
 * Fetch one blueprint, scoped to its owner.
 *
 * Returns null ONLY for "there is no such row for this user". Every other fault throws.
 *
 * The brief specified `if (error || !data) return null`, and that is wrong here in a way this
 * lane is unusually exposed to: the migration is applied BY HAND, so an unapplied one is a
 * live possibility on any deploy. PostgREST answers an unknown table with PGRST205 and an
 * ungranted one with 42501; collapsing either into `null` gives the read route a 404, gives
 * `RemixBeats` its silent no-render path, and prints a remix card with no shoot sheet and no
 * error anywhere in the stack. The whole feature would look unbuilt.
 *
 * PGRST116 is the one code that genuinely means "no row" — `.single()` raises it for both 0
 * and >1 rows, and `id` is the primary key, so here it can only ever mean 0. Same shape as
 * `getAudience` in audience-repo.ts:441.
 */
export async function getBlueprint(
  service: SupabaseClient,
  id: string,
  userId: string,
): Promise<BlueprintRow | null> {
  const { data, error } = await service
    .from("remix_blueprints")
    .select(BLUEPRINT_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // row not found, or not this user's
    throw new Error(`remix_blueprints read failed: ${error.message}`);
  }

  return data ? (data as unknown as BlueprintRow) : null;
}

/**
 * Rewrite ONE variant's script, atomically, via `jsonb_set` inside a single UPDATE
 * (`remix_blueprint_set_variant_script`) — never a select-then-rewrite of the whole `script`
 * array, which would race a sibling variant's write and clobber it (same lost-update class the
 * RPC in `20260706130000_atomic_variants_merge.sql` fixes for `analysis_results.variants`).
 *
 * `jsonb_set` on an out-of-range array index is a silent no-op on the row — callers MUST
 * validate `variant` against the row's actual variant count (via `getBlueprint`) before calling
 * this; that range check does not belong here because it needs the row this function never reads.
 *
 * Never throws: a write here is a revision, not the original run, so the tool that calls this
 * relays an honest failure to the user instead of a 500. Errors are logged so a swallowed
 * failure is still visible in the logs even though it doesn't surface as an exception.
 */
export async function updateVariantScript(
  service: SupabaseClient,
  id: string,
  userId: string,
  variant: number,
  script: AdaptedBeat[],
): Promise<boolean> {
  const { error } = await service.rpc("remix_blueprint_set_variant_script", {
    p_id: id,
    p_user_id: userId,
    p_variant: variant,
    p_script: script,
  });

  if (error) {
    log.error("remix_blueprints variant script write failed", {
      id,
      userId,
      variant,
      error: error.message,
    });
    return false;
  }

  return true;
}
