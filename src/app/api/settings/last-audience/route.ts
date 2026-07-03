import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import type { Database } from "@/types/database.types";

type UserSettingsInsert = Database["public"]["Tables"]["user_settings"]["Insert"];

/**
 * PUT /api/settings/last-audience
 * Persist the USER-level last-used audience (The Room, resolveUserAudience sibling to the
 * per-thread pin). The audience presence switcher calls this on every selection so the choice
 * survives a page reload + seeds new threads/surfaces.
 *
 * Body: { audienceId: string | null } — a REAL audience UUID, or null = General.
 * Virtual preset ids ("preset-growth"/…) are NOT UUIDs and cannot satisfy the audiences FK, so
 * the client (like the thread pin) never sends them here — they stay session-local until
 * materialized into a real row. A UUID the caller doesn't own reads back as General under RLS
 * (getAudience is session-scoped), so there is no cross-tenant leak.
 *
 * Security: auth-first; user_id from the session only (CR-01, never from the body).
 */
const bodySchema = z.object({
  audienceId: z.string().uuid().nullable(),
});

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const updates: UserSettingsInsert = {
      user_id: user.id,
      last_audience_id: parsed.data.audienceId,
    };

    const { error } = await supabase
      .from("user_settings")
      .upsert(updates, { onConflict: "user_id" });

    if (error) {
      console.error("[last-audience] PUT error:", error);
      return Response.json({ error: "Failed to update last audience" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[last-audience] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
