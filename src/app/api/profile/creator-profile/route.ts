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
  "storage_retention_opted_in",
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
    // WR-05: Explicit Content-Type guard so a malformed/missing header
    // fails fast with 415 instead of triggering a 500 inside `request.json()`.
    const contentType = request.headers
      .get("content-type")
      ?.split(";")[0]
      ?.trim()
      ?.toLowerCase();
    if (contentType !== "application/json") {
      return Response.json(
        { error: "Unsupported Media Type" },
        { status: 415 }
      );
    }

    // WR-05: Cross-origin guard for any state-changing method. Relying on
    // Supabase's `SameSite=Lax` cookie default alone is fragile — if any
    // future deploy switches it to `SameSite=None` (e.g., for an embedded
    // widget), every PATCH would be vulnerable to CSRF. The `same-origin`
    // fetch mode used by the in-app TanStack mutation does not send an
    // `Origin` header on same-origin GETs, but it DOES send one on POST/
    // PATCH/PUT/DELETE, so we can reliably whitelist here.
    const origin = request.headers.get("origin");
    if (origin) {
      const url = new URL(request.url);
      const expectedOrigin = `${url.protocol}//${url.host}`;
      if (origin !== expectedOrigin) {
        return Response.json(
          { error: "Cross-origin request denied" },
          { status: 403 }
        );
      }
    }

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
    //
    // WR-06: spread each existing entry through so any future schema
    // additions (e.g., an optional `id` on a reference entry) round-trip
    // unchanged instead of being dropped by an over-narrow manual rebuild.
    // `parsed.data` is already a whitelist-safe object thanks to zod's
    // default `.strip()` behavior, so we just transform the free-text
    // fields and pass everything else through.
    const sanitized: Record<string, unknown> = { ...parsed.data };
    if (typeof sanitized.pain_points === "string") {
      sanitized.pain_points = sanitizeText(sanitized.pain_points);
    }
    if (Array.isArray(sanitized.reference_creators)) {
      sanitized.reference_creators = (
        sanitized.reference_creators as Array<{ handle_or_url: string } & Record<string, unknown>>
      ).map((entry) => ({
        ...entry,
        handle_or_url: sanitizeText(entry.handle_or_url) ?? "",
      }));
    }
    if (Array.isArray(sanitized.past_wins)) {
      sanitized.past_wins = (
        sanitized.past_wins as Array<{ url: string } & Record<string, unknown>>
      ).map((entry) => ({
        ...entry,
        url: sanitizeText(entry.url) ?? "",
      }));
    }
    if (Array.isArray(sanitized.past_flops)) {
      sanitized.past_flops = (
        sanitized.past_flops as Array<{ url: string } & Record<string, unknown>>
      ).map((entry) => ({
        ...entry,
        url: sanitizeText(entry.url) ?? "",
      }));
    }

    // Stamp `profile_interview_seen_at` on first contact — server-derived, never from the body.
    //
    // The column has to mean "this creator was ASKED", and for most of this year it has not. Its
    // only writer was `ProfileInterviewModal`, mounted on `content-form.tsx`, reachable only via
    // `/analyze` — which became a bare `redirect('/home')` on 2026-07-18. Three rows carry a stamp
    // and the last is 2026-05-31, and that emptiness has been read as creators declining to answer
    // ever since. It was a dead code path being reported as a preference.
    //
    // `WaitQuestions` PATCHes an EMPTY body on mount for exactly this. Stamping on the first
    // ANSWER instead would rebuild the same misreading one layer up: someone who saw the questions
    // and skipped them would look identical to someone never shown them.
    //
    // ONLY WHEN NULL. The settings tab PATCHes this route too; overwriting each time would turn a
    // first-contact timestamp into a last-touched one, which answers a different question badly.
    // `creatorProfilePatchSchema` has no key for it, so zod already strips any client-supplied
    // value — this is the sole writer. Same rule as `user_id` here and `origin` on the funnel route.
    const { data: existing } = await supabase
      .from("creator_profiles")
      .select("profile_interview_seen_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing?.profile_interview_seen_at) {
      sanitized.profile_interview_seen_at = new Date().toISOString();
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
