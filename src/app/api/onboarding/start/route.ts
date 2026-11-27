import { listAudiences } from "@/lib/audience/audience-repo";
import type { Audience } from "@/lib/audience/audience-types";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { createLogger } from "@/lib/logger";
import { completeAnswersOf } from "@/lib/onboarding/answers";
import {
  afterSaveOf,
  hasCalibratedAudience,
  hasPlanOf,
  PROFILE_READ,
  profileWriteOf,
  type ExistingProfile,
} from "@/lib/onboarding/start-profile";
import { isSealedVisitor } from "@/lib/onboarding/verdict-seal";
import { createClient } from "@/lib/supabase/server";

const log = createLogger({ module: "onboarding-start" });

/**
 * POST /api/onboarding/start — /start's answers into the signed-in creator's profile, and where they go next
 * (funnel spec §3.2; plan 01-start-and-profile). New look only.
 *
 * Body `{ answers, emailConsent }`: the answers must be complete and clean (`completeAnswersOf`); consent is
 * the account screen's checkbox, unticked by default. Written through the session client, so RLS keeps it to the creator's own row
 * (`user_id = auth.uid()`; the upsert covers a first visit, no trigger makes the row). An anonymous session
 * (a /go visitor) never gets a row: the middleware's onboarding exemption relies on there being none.
 *
 * Answer `{ next, build }` (`afterSaveOf`): the client goes to `next` and, with a `build`, holds it for the
 * building screen. A failed audience list counts as none: the creator is sent to build one rather than stopped.
 */
export async function POST(request: Request): Promise<Response> {
  if (!NEW_LOOK_ENABLED) return Response.json({ error: "Not found" }, { status: 404 });

  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return Response.json({ error: "Unsupported Media Type" }, { status: 415 });
  }
  // Same rule as /api/profile/creator-profile: a state-changing call from another site is refused.
  const origin = request.headers.get("origin");
  if (origin) {
    const url = new URL(request.url);
    if (origin !== `${url.protocol}//${url.host}`) {
      return Response.json({ error: "Cross-origin request denied" }, { status: 403 });
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (isSealedVisitor(user)) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Validation failed" }, { status: 400 });
  }
  const fields = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const answers = completeAnswersOf(fields.answers);
  if (!answers || typeof fields.emailConsent !== "boolean") {
    return Response.json({ error: "Validation failed" }, { status: 400 });
  }

  const { data: existing, error: readError } = await supabase
    .from("creator_profiles")
    .select(PROFILE_READ)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) {
    log.error("profile read failed", { error: readError.message });
    return Response.json({ error: "Failed to save" }, { status: 500 });
  }

  const write = profileWriteOf(
    user.id,
    answers,
    (existing as ExistingProfile | null) ?? null,
    fields.emailConsent,
    new Date().toISOString(),
  );
  const { error: writeError } = await supabase.from("creator_profiles").upsert(write, { onConflict: "user_id" });
  if (writeError) {
    log.error("profile write failed", { error: writeError.message });
    return Response.json({ error: "Failed to save" }, { status: 500 });
  }

  // `*`, as /api/subscription reads it: a missing column must not reject the whole select.
  const { data: subscription } = await supabase.from("user_subscriptions").select("*").eq("user_id", user.id).maybeSingle();
  let audiences: Audience[] = [];
  try {
    audiences = await listAudiences(supabase);
  } catch {
    audiences = [];
  }

  return Response.json(
    afterSaveOf({
      hasPlan: hasPlanOf((subscription as Record<string, unknown> | null) ?? null),
      hasAudience: hasCalibratedAudience(audiences),
      answers,
    }),
  );
}
