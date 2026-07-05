/**
 * surface-reactions-repo — persistence for the pre-tested /start card cache
 * (surface_reactions; see the migration header). One cached Flash-sim batch per
 * (user × audience × kind), re-warmed lazily on the first /start visit of the day.
 *
 * The /start server component reads via getFreshSurfaceCards (RLS-scoped); the refresh
 * route writes via upsertSurfaceCards after re-simming. Cast convention mirrors
 * account-metrics-repo (surface_reactions isn't in database.types.ts yet).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Audience } from "@/lib/audience/audience-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedClient = { from: (t: string) => any };

export type SurfaceKind = "outlier" | "idea";

/**
 * Cache freshness window. Owner cadence (2026-07-05) = lazy on the first visit of the day:
 * a batch older than this re-warms on the next /start load. 18h so a once-daily visitor
 * always re-warms, and new ingested outliers / an audience switch surface within a day.
 */
const CACHE_TTL_MS = 18 * 60 * 60 * 1000;

/** The cache key for an audience: its UUID (calibrated) or the literal 'general' (baseline). */
export function audienceKeyOf(audience: Audience): string {
  return audience.is_general ? "general" : audience.id;
}

/**
 * Read the cached card batch for (user × audience × kind) IF still fresh (within the TTL).
 * Returns null on absent / stale / read error → the caller re-warms. Total (never throws).
 */
export async function getFreshSurfaceCards<T>(
  supabase: SupabaseClient,
  userId: string,
  audienceKey: string,
  kind: SurfaceKind,
): Promise<T[] | null> {
  try {
    const { data, error } = await (supabase as unknown as UntypedClient)
      .from("surface_reactions")
      .select("cards, updated_at")
      .eq("user_id", userId)
      .eq("audience_key", audienceKey)
      .eq("kind", kind)
      .maybeSingle();
    if (error || !data) return null;
    const updatedAt = new Date(data.updated_at as string).getTime();
    if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > CACHE_TTL_MS) return null;
    return Array.isArray(data.cards) ? (data.cards as T[]) : null;
  } catch {
    return null;
  }
}

/**
 * Upsert a freshly-simmed card batch for (user × audience × kind). Best-effort — the caller
 * still returns the cards it built even if the write fails (the cache is an optimization).
 */
export async function upsertSurfaceCards(
  supabase: SupabaseClient,
  userId: string,
  audienceKey: string,
  kind: SurfaceKind,
  cards: unknown[],
): Promise<void> {
  await (supabase as unknown as UntypedClient).from("surface_reactions").upsert(
    {
      user_id: userId,
      audience_key: audienceKey,
      kind,
      cards,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,audience_key,kind" },
  );
}
