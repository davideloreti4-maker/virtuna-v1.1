import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import type { Database } from "@/types/database.types";

type UserSettingsInsert = Database["public"]["Tables"]["user_settings"]["Insert"];

const updateNotificationsSchema = z.object({
  emailUpdates: z.boolean().optional(),
  testResults: z.boolean().optional(),
  weeklyDigest: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
});

/**
 * PATCH /api/settings/notifications
 * Update notification preferences.
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateNotificationsSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Map camelCase to snake_case DB columns
    const updates: UserSettingsInsert = { user_id: user.id };
    if (parsed.data.emailUpdates !== undefined) {
      updates.notification_email_updates = parsed.data.emailUpdates;
    }
    if (parsed.data.testResults !== undefined) {
      updates.notification_test_results = parsed.data.testResults;
    }
    if (parsed.data.weeklyDigest !== undefined) {
      updates.notification_weekly_digest = parsed.data.weeklyDigest;
    }
    if (parsed.data.marketingEmails !== undefined) {
      updates.notification_marketing = parsed.data.marketingEmails;
    }

    const { error } = await supabase
      .from("user_settings")
      .upsert(updates, { onConflict: "user_id" });

    if (error) {
      console.error("[notifications] PATCH error:", error);
      return Response.json({ error: "Failed to update notifications" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[notifications] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
