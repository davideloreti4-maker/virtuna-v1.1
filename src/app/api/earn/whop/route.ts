/**
 * POST /api/earn/whop — a creator enrols as an affiliate at Whop, from the card `Get paid` on Earn (plan
 * 2026-11-24-earn, step B; rulings 13, 14, 26, 27, 33 and 42). Body `{ username?: string }`: with a username,
 * that Whop username (its form checked first, a leading "@" dropped); without, the caller's stored Whop
 * user id (a paying customer). The affiliate is created or found at Whop, the commission set on every plan
 * the app sells, and only then the username Whop answers stored with the affiliate id on the caller's
 * `referral_codes` row (service client, the session's id). `Change` on the page is the same call with a new
 * username.
 *
 *   200 the new `EarnPage` · 400 `Bad request` a body that is not one (the body never names whose row) ·
 *   400 `invalid_username` a typed text that is not a Whop username · 400 `no_account` no username and no
 *   stored Whop user id · 422 `not_found` Whop knows no such account · 409 `already_connected` the Whop
 *   account is stored on another creator's row · 503 `not_available` Whop is not configured here (no key or
 *   no company id) · 502 `failed` anything else from Whop, a plan's commission that could not be set among
 *   it (nothing is stored then) · 429 `failed` another enrolment of this creator, or with this Whop account,
 *   is running on this server instance, or the creator's attempts of the last hour are used up (then with
 *   `Retry-After`) · 500 `Server error` a database error, or a service client that cannot be made (its text
 *   in the server log only) · 429 the shared per-person rate limit, as it answers.
 *
 * Before any of it: 404 with the flag off (nothing read, not even the session) and for a funnel visitor,
 * 401 signed out, then `csrfGuard` (415 / 403) and the limiter, with this route's own budget of 3 a minute
 * (`earn-whop`, ruling 42).
 */
import { z } from "zod";

import { commissionPlanIds, enrolAtWhop } from "@/lib/earn/enrol";
import { readEarnPage } from "@/lib/earn/earn-read";
import { whopSettings } from "@/lib/earn/whop-affiliates";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { rateLimitGuard } from "@/lib/http/rate-limit";
import { isSealedVisitor } from "@/lib/onboarding/verdict-seal";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const Body = z.object({ username: z.string().max(200).optional() }).strict();

const refused = (status: number, error: string): Response => Response.json({ error }, { status });

const STATUS = { not_available: 503, invalid_username: 400, no_account: 400, not_found: 422, already_connected: 409, failed: 502 } as const;

/** An enrolment creates the affiliate, lists its commissions and sets up to six: each call may take 8 s. */
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  if (!NEW_LOOK_ENABLED) return refused(404, "Not found");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return refused(401, "Unauthorized");
  if (isSealedVisitor(user)) return refused(404, "Not found");
  const guard = csrfGuard(request);
  if (guard) return guard;
  const limited = await rateLimitGuard(user.id, "earn-whop");
  if (limited) return limited;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return refused(400, "Bad request");

  const settings = whopSettings();
  try {
    const admin = createServiceClient();
    const outcome = await enrolAtWhop({ admin, http: fetch, settings, planIds: commissionPlanIds() }, user.id, parsed.data.username);
    // Rulings 27, 33 and 42: one at a time, and so many an hour. The page says the failure's words for both.
    if (outcome.kind === "busy") return refused(429, "failed");
    if (outcome.kind === "too_many") {
      return Response.json({ error: "failed" }, { status: 429, headers: { "Retry-After": String(outcome.retryAfterSeconds) } });
    }
    if (outcome.kind !== "enrolled") return refused(STATUS[outcome.kind], outcome.kind);
    return Response.json(await readEarnPage(supabase, admin, user, { http: fetch, settings }));
  } catch (err) {
    console.error("[earn] whop enrol failed:", err instanceof Error ? err.message : String(err));
    return refused(500, "Server error");
  }
}
