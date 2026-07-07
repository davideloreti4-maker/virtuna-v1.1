"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Edits from the propose→confirm card: renamed pillars + removed pillar ids. */
export interface PillarEdits {
  renames: { id: string; name: string }[];
  deletes: string[];
}

type Result = { ok?: boolean; error?: string };

const MAX_NAME = 40;

/**
 * Apply the creator's review of their auto-clustered pillars, then mark them confirmed
 * (dismisses the one-time card). Renames keep the pillar id (posts stay assigned); a delete
 * drops the pillar — its posts unassign via the FK (ON DELETE SET NULL) and re-classify on the
 * next cron. All writes go through the RLS user client, scoped to the caller's own rows.
 */
export async function savePillars(edits: PillarEdits): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const deletes = (edits.deletes ?? []).filter(Boolean);
  if (deletes.length > 0) {
    const { error } = await supabase
      .from("content_pillars")
      .delete()
      .eq("user_id", user.id)
      .in("id", deletes);
    if (error) return { error: "Couldn't remove a theme — try again." };
  }

  for (const r of edits.renames ?? []) {
    const name = (r.name ?? "").trim().slice(0, MAX_NAME);
    if (!r.id || name.length === 0 || deletes.includes(r.id)) continue;
    const { error } = await supabase
      .from("content_pillars")
      .update({ name })
      .eq("user_id", user.id)
      .eq("id", r.id);
    // 23505 = the new name collides with another of the user's pillars — surface it kindly.
    if (error) {
      return {
        error:
          error.code === "23505"
            ? `You already have a theme named "${name}".`
            : "Couldn't rename a theme — try again.",
      };
    }
  }

  const { error: confirmErr } = await supabase
    .from("content_pillars")
    .update({ confirmed: true })
    .eq("user_id", user.id);
  if (confirmErr) return { error: "Couldn't save — try again." };

  revalidatePath("/start");
  revalidatePath("/calendar");
  revalidatePath("/audience");
  return { ok: true };
}
