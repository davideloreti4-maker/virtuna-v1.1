import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import {
  creatorProfilePatchSchema,
  sanitizeText,
} from "@/lib/schemas/creator-profile";

const log = createLogger({ module: "creator-profile" });

/**
 * Columns of `creator_profiles` exposed by GET — exactly the 14 9-card columns
 * plus the `profile_interview_seen_at` flag used by the modal gate hook
 * (Plan 02-04). Kept as a single source of truth so the SELECT and the
 * fallback default-shape stay in lockstep.
 */
const GET_COLUMNS = [
  "profile_interview_seen_at",
  "target_platforms",
  "niche_primary",
  "niche_sub",
  "target_audience",
  "primary_goal",
  "creator_stage",
  "content_style",
  "cuts_per_second",
  "reference_creators",
  "past_wins",
  "past_flops",
  "posting_frequency",
  "time_of_day_aware",
  "pain_points",
] as const;

const GET_SELECT = GET_COLUMNS.join(", ");

const DEFAULT_ROW: Record<string, null> = Object.fromEntries(
  GET_COLUMNS.map((c) => [c, null])
);

/**
 * GET /api/profile/creator-profile
 * Returns the 9-card creator profile row for the authenticated user, or a
 * default-shaped object (all nulls) if the row does not exist yet — the
 * Plan 02-04 gate hook relies on `profile_interview_seen_at === null` to
 * trigger the modal for first-time users.
 */
export async function GET(): Promise<Response> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("creator_profiles")
      .select(GET_SELECT)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      log.error("GET select error", {
        error: error.message ?? String(error),
      });
      return Response.json(
        { error: "Failed to load creator profile" },
        { status: 500 }
      );
    }

    return Response.json(data ?? DEFAULT_ROW);
  } catch (error) {
    log.error("GET error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/profile/creator-profile
 * Validates a partial creator-profile update against the 14-column whitelist
 * (zod), sanitizes free-text fields against ASCII control chars, then upserts
 * via the authenticated supabase client so RLS enforces the user can only
 * touch their own row (T-02-02 mitigation).
 */
export async function PATCH(request: Request): Promise<Response> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = creatorProfilePatchSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Sanitize free-text fields before persistence (T-02-01 mitigation).
    const sanitized: Record<string, unknown> = { ...parsed.data };
    if (typeof sanitized.pain_points === "string") {
      sanitized.pain_points = sanitizeText(sanitized.pain_points);
    }
    if (Array.isArray(sanitized.reference_creators)) {
      sanitized.reference_creators = (
        sanitized.reference_creators as { handle_or_url: string }[]
      ).map((r) => ({ handle_or_url: sanitizeText(r.handle_or_url) ?? "" }));
    }
    if (Array.isArray(sanitized.past_wins)) {
      sanitized.past_wins = (sanitized.past_wins as { url: string }[]).map(
        (w) => ({ url: sanitizeText(w.url) ?? "" })
      );
    }
    if (Array.isArray(sanitized.past_flops)) {
      sanitized.past_flops = (sanitized.past_flops as { url: string }[]).map(
        (f) => ({ url: sanitizeText(f.url) ?? "" })
      );
    }

    // Upsert via authenticated client — RLS enforces user_id = auth.uid().
    // Note: callers cannot override `user_id`; it's overwritten from the
    // session-derived `user.id` regardless of any value passed in the body.
    const { error } = await supabase
      .from("creator_profiles")
      .upsert(
        { user_id: user.id, ...sanitized },
        { onConflict: "user_id" }
      );

    if (error) {
      log.error("PATCH upsert error", {
        error: error.message ?? String(error),
      });
      return Response.json(
        { error: "Failed to update creator profile" },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    log.error("PATCH error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
