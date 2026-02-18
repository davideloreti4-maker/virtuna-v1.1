import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createScrapingProvider } from "@/lib/scraping";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const log = createLogger({ module: "profile" });

const updateProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  company: z.string().max(100).optional(),
  role: z.string().max(100).optional(),
  tiktok_handle: z.string().max(100).optional(),
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
      tiktok_handle: creatorProfile?.tiktok_handle || "",
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
    log.error("GET error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/profile
 * Update display_name, company, role, tiktok_handle.
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

    // Separate tiktok_handle from user_settings fields (different tables)
    const { tiktok_handle: _tiktokHandle, ...settingsData } = parsed.data;

    // Upsert user_settings
    const { error } = await supabase
      .from("user_settings")
      .upsert(
        {
          user_id: user.id,
          ...settingsData,
        },
        { onConflict: "user_id" }
      );

    if (error) {
      log.error("PATCH upsert error", {
        error: error.message ?? String(error),
      });
      return Response.json({ error: "Failed to update profile" }, { status: 500 });
    }

    // HARD-05: If tiktok_handle provided, upsert creator_profiles and trigger background scrape
    if (parsed.data.tiktok_handle) {
      const service = createServiceClient();
      const handle = parsed.data.tiktok_handle.replace(/^@/, ""); // Strip leading @

      // Upsert creator_profiles row — link user to their TikTok handle
      await service.from("creator_profiles").upsert(
        {
          user_id: user.id,
          tiktok_handle: handle,
        },
        { onConflict: "user_id" }
      );

      // Fire-and-forget background scrape — intentionally not awaited
      // Uses void to signal intentional fire-and-forget to ESLint
      void (async () => {
        try {
          const scraper = createScrapingProvider();
          const profileData = await scraper.scrapeProfile(handle);
          await service.from("creator_profiles").update({
            display_name: profileData.displayName,
            tiktok_followers: profileData.followerCount,
            avatar_url: profileData.avatarUrl,
            bio: profileData.bio,
          }).eq("user_id", user.id);
          log.info("Background creator scrape complete", { handle });
        } catch (err) {
          log.warn("Background creator scrape failed (non-blocking)", {
            handle,
            error: err instanceof Error ? err.message : String(err),
          });
          // Intentionally swallowed — scrape is best-effort
        }
      })();
    }

    return Response.json({ success: true });
  } catch (error) {
    log.error("PATCH error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
