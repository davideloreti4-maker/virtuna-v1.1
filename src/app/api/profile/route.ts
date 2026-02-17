import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const updateProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  company: z.string().max(100).optional(),
  role: z.string().max(100).optional(),
});

/**
 * GET /api/profile
 * Returns the current user's profile settings + email.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user_settings (may not exist yet for new users)
    const { data: settings } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    // Fallback to creator_profiles for display name
    const { data: creatorProfile } = await supabase
      .from("creator_profiles")
      .select("display_name, tiktok_handle")
      .eq("user_id", user.id)
      .maybeSingle();

    const profile = {
      name: settings?.display_name
        || creatorProfile?.display_name
        || user.user_metadata?.full_name
        || "",
      email: user.email || "",
      company: settings?.company || "",
      role: settings?.role || "",
      avatar: settings?.avatar_url
        || user.user_metadata?.avatar_url
        || null,
      notifications: {
        emailUpdates: settings?.notification_email_updates ?? true,
        testResults: settings?.notification_test_results ?? true,
        weeklyDigest: settings?.notification_weekly_digest ?? false,
        marketingEmails: settings?.notification_marketing ?? false,
      },
    };

    return Response.json(profile);
  } catch (error) {
    console.error("[profile] GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/profile
 * Update display_name, company, role.
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Upsert user_settings
    const { error } = await supabase
      .from("user_settings")
      .upsert(
        {
          user_id: user.id,
          ...parsed.data,
        },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("[profile] PATCH error:", error);
      return Response.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[profile] PATCH error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
