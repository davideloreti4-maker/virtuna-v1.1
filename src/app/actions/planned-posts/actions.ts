"use server";

/**
 * planned-posts actions — the /calendar workspace's writes (schedule / move / unschedule).
 * Each resolves the caller and goes through the RLS user client, so a user only ever
 * touches their own rows. Inputs are validated at this boundary (dates, format, personas)
 * before they reach the repo. Mirrors the save-pillars action shape.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ReactionPersona } from "@/lib/tools/blocks";
import {
  upsertPlannedPost,
  movePlannedPost,
  deletePlannedPost,
  type PlannedFormat,
} from "@/lib/planned-posts/planned-posts-repo";

type Result = { ok?: boolean; id?: string; error?: string };

const MAX_TITLE = 200;
const MAX_PERSONAS = 40;

/** A well-formed calendar date within a sane window (this year ± 2). */
function validDate(iso: unknown): iso is string {
  if (typeof iso !== "string") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const month = Number(m[2]);
  const day = Number(m[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/** Keep only well-shaped personas (defensive — they're snapshotted verbatim to jsonb). */
function cleanPersonas(input: unknown): ReactionPersona[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (p): p is ReactionPersona =>
        !!p &&
        typeof p === "object" &&
        typeof (p as ReactionPersona).archetype === "string" &&
        ((p as ReactionPersona).verdict === "stop" || (p as ReactionPersona).verdict === "scroll") &&
        typeof (p as ReactionPersona).quote === "string",
    )
    .slice(0, MAX_PERSONAS);
}

export interface SchedulePostInput {
  scheduledDate: string;
  contentId: string;
  title: string;
  format: PlannedFormat;
  personas: ReactionPersona[];
}

/** Schedule (or move-by-idea) a pre-tested idea onto a day. Returns the new row id. */
export async function schedulePost(input: SchedulePostInput): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  if (!validDate(input?.scheduledDate)) return { error: "Pick a valid day." };
  const contentId = (input?.contentId ?? "").trim();
  const title = (input?.title ?? "").trim().slice(0, MAX_TITLE);
  if (!contentId || !title) return { error: "This idea can't be scheduled — try another." };
  const format: PlannedFormat = input?.format === "Carousel" ? "Carousel" : "Reel";

  const id = await upsertPlannedPost(supabase, user.id, {
    scheduledDate: input.scheduledDate,
    contentId,
    title,
    format,
    personas: cleanPersonas(input?.personas),
  });
  if (!id) return { error: "Couldn't schedule that — try again." };

  revalidatePath("/calendar");
  revalidatePath("/start");
  return { ok: true, id };
}

/** Move an already-scheduled post (by row id) to a different day. */
export async function movePost(id: string, scheduledDate: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!id || !validDate(scheduledDate)) return { error: "Pick a valid day." };

  const ok = await movePlannedPost(supabase, user.id, id, scheduledDate);
  if (!ok) return { error: "Couldn't move that — try again." };

  revalidatePath("/calendar");
  revalidatePath("/start");
  return { ok: true };
}

/** Unschedule a post (delete the row) — the idea returns to the backlog if still cached. */
export async function unschedulePost(id: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!id) return { error: "Nothing to unschedule." };

  const ok = await deletePlannedPost(supabase, user.id, id);
  if (!ok) return { error: "Couldn't unschedule that — try again." };

  revalidatePath("/calendar");
  revalidatePath("/start");
  return { ok: true };
}
