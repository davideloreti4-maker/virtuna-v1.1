/**
 * pillars-repo — persistence for content_pillars (the creator's recurring themes).
 *
 * Names are FROZEN once written: createPillars inserts new names (ignoring any that
 * already exist) and re-selects the full set, so the clustering job classifies new
 * posts into stable pillars instead of re-wording them. Cast convention mirrors
 * account-metrics-repo (content_pillars isn't in database.types.ts yet).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedClient = { from: (t: string) => any };

export interface ContentPillarRow {
  id: string;
  name: string;
  sort_order: number;
  confirmed: boolean;
}

const PILLAR_SELECT = "id, name, sort_order, confirmed";

function normalizePillar(r: Record<string, unknown>): ContentPillarRow {
  return {
    id: String(r.id),
    name: (r.name as string) ?? "",
    sort_order: Number(r.sort_order ?? 0),
    confirmed: Boolean(r.confirmed),
  };
}

/** True if the user has any pillar they haven't reviewed yet (drives the confirm card). */
export async function anyUnconfirmedPillars(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { count } = await (supabase as unknown as UntypedClient)
    .from("content_pillars")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("confirmed", false);
  return (count ?? 0) > 0;
}

/** A user's pillars in display order. RLS-scoped (user client) / explicit (service). */
export async function listPillars(
  supabase: SupabaseClient,
  userId: string,
): Promise<ContentPillarRow[]> {
  const { data, error } = await (supabase as unknown as UntypedClient)
    .from("content_pillars")
    .select(PILLAR_SELECT)
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(normalizePillar);
}

/**
 * Create the given pillar names for a user (first-cluster). Idempotent: names that
 * already exist are ignored (ON CONFLICT DO NOTHING via ignoreDuplicates), then the
 * FULL current set is re-selected so the caller always gets stable ids to assign
 * posts against — including any pre-existing pillars. `names` order sets sort_order.
 */
export async function createPillars(
  supabase: SupabaseClient,
  userId: string,
  names: string[],
): Promise<ContentPillarRow[]> {
  const rows = names
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .map((name, i) => ({ user_id: userId, name, sort_order: i }));
  if (rows.length > 0) {
    await (supabase as unknown as UntypedClient)
      .from("content_pillars")
      .upsert(rows, { onConflict: "user_id,name", ignoreDuplicates: true });
  }
  return listPillars(supabase, userId);
}
