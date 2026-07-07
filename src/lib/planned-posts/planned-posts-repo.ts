/**
 * planned-posts-repo — persistence for planned_posts (the creator's real content
 * calendar). A planned post is a pre-tested idea snapshotted onto a day; the idea's
 * title / format / Flash `personas` are frozen on the row so the plan survives the
 * rolling ideas-cache churn (see the migration header).
 *
 * Cast convention mirrors account-metrics-repo / pillars-repo (planned_posts isn't
 * in database.types.ts yet). All reads/writes go through the caller's client, so the
 * RLS user client keeps them own-rows-scoped.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReactionPersona } from "@/lib/tools/blocks";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedClient = { from: (t: string) => any };

export type PlannedFormat = "Reel" | "Carousel";

/** A persisted planned post — the row shape (dates as ISO 'YYYY-MM-DD'). */
export interface PlannedPostRow {
  id: string;
  scheduled_date: string; // 'YYYY-MM-DD'
  content_id: string;
  title: string;
  format: PlannedFormat;
  personas: ReactionPersona[];
}

/** The snapshot the /calendar workspace freezes when it schedules an idea onto a day. */
export interface PlannedPostInput {
  scheduledDate: string; // 'YYYY-MM-DD'
  contentId: string;
  title: string;
  format: PlannedFormat;
  personas: ReactionPersona[];
}

const SELECT = "id, scheduled_date, content_id, title, format, personas";

function normalize(r: Record<string, unknown>): PlannedPostRow {
  const fmt = r.format === "Carousel" ? "Carousel" : "Reel";
  return {
    id: String(r.id),
    scheduled_date: String(r.scheduled_date),
    content_id: String(r.content_id),
    title: (r.title as string) ?? "",
    format: fmt,
    personas: Array.isArray(r.personas) ? (r.personas as ReactionPersona[]) : [],
  };
}

/**
 * A user's planned posts on/after `fromDate` (ISO 'YYYY-MM-DD'), oldest first. The
 * workspace loads the current month onward; past days aren't planning surface. Total
 * (never throws) — any read error yields [] → the honest empty grid.
 */
export async function listPlannedPosts(
  supabase: SupabaseClient,
  userId: string,
  fromDate: string,
): Promise<PlannedPostRow[]> {
  try {
    const { data, error } = await (supabase as unknown as UntypedClient)
      .from("planned_posts")
      .select(SELECT)
      .eq("user_id", userId)
      .gte("scheduled_date", fromDate)
      .order("scheduled_date", { ascending: true });
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(normalize);
  } catch {
    return [];
  }
}

/**
 * Schedule (or MOVE) an idea onto a day. Upserts on (user_id, content_id) so
 * re-scheduling the same idea moves it instead of double-booking. Returns the row id.
 */
export async function upsertPlannedPost(
  supabase: SupabaseClient,
  userId: string,
  input: PlannedPostInput,
): Promise<string | null> {
  const { data, error } = await (supabase as unknown as UntypedClient)
    .from("planned_posts")
    .upsert(
      {
        user_id: userId,
        scheduled_date: input.scheduledDate,
        content_id: input.contentId,
        title: input.title,
        format: input.format,
        personas: input.personas,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,content_id" },
    )
    .select("id")
    .maybeSingle();
  if (error || !data) return null;
  return String((data as { id: unknown }).id);
}

/** Move an already-scheduled post to a different day (by row id). */
export async function movePlannedPost(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  scheduledDate: string,
): Promise<boolean> {
  const { error } = await (supabase as unknown as UntypedClient)
    .from("planned_posts")
    .update({ scheduled_date: scheduledDate, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id);
  return !error;
}

/** Unschedule a post (delete the row) — the idea returns to the backlog if still cached. */
export async function deletePlannedPost(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<boolean> {
  const { error } = await (supabase as unknown as UntypedClient)
    .from("planned_posts")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  return !error;
}
