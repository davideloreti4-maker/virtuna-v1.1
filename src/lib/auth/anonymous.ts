import { createClient } from "@/lib/supabase/client";

/**
 * The silent anonymous sign-in behind the /go funnel (ONBOARDING-FUNNEL-DESIGN.md §0b).
 *
 * The visitor becomes a real `auth.users` row with `is_anonymous = true`, so there is no
 * parallel demo code path: the shell, the thread, the rail and every API route treat them
 * as a logged-in user *because they are one*. RLS admits them because its policies are
 * `TO authenticated ... USING (user_id = auth.uid())` and an anonymous user holds the
 * `authenticated` role — `is_anonymous` is only a JWT claim. No migration is needed.
 *
 * ⚠️ Reuses an existing session when there is one. Two callers depend on that:
 *   - a REAL logged-in user who lands on /go and submits from the hero must keep their own
 *     account, not be handed a throwaway one;
 *   - a returning anonymous visitor must keep the thread they already built, since the
 *     whole point of linking identity at checkout is that the thread survives.
 *
 * Called on submit — and, since 2026-07-27, pre-warmed on the hero composer's first
 * FOCUS (hero-entry.tsx): the sign-in round-trip measured ~3s and held the visitor on a
 * frozen /go after pressing the page's one button. Focus keeps this rule's intent: never
 * on mount, so a crawler's page-view still mints nothing — focusing the field is a real
 * intent signal. Idempotent either way (the submit path re-calls and reuses the session).
 * (Rows accumulate regardless; the reaper is still owed.)
 */
export type AnonymousSessionResult =
  | { ok: true; userId: string; created: boolean }
  | { ok: false; error: string };

/**
 * ⚠️ THE DOUBLE-MINT RACE (measured 2026-08-04, fixed here).
 *
 * "Idempotent either way" above was true only once the prewarm had RESOLVED.
 * `free-entry-cta.tsx` fires `prewarm()` un-awaited on pointerenter/focus and
 * then the click AWAITS its own call — so both ran `getSession()`, both saw no
 * session, and both minted. Measured on a production build: one click on "Test
 * a video free" produced two `POST /auth/v1/signup` calls and two `auth.users`
 * rows 14µs apart. On mobile it fires essentially always, because a tap
 * dispatches pointerenter and click together — and §2a says mobile IS the
 * traffic. 37 anonymous rows existed for roughly half that many real visits.
 *
 * `prewarmedRef` never guarded this: it prevents a second PREWARM, not the
 * prewarm-vs-click overlap. The fix is a module-level in-flight promise, so
 * concurrent callers await the same sign-in instead of racing to start two.
 * Cleared on settle so a later caller can still mint if the session is gone.
 *
 * This also protected the funnel's own arithmetic: every doubled row inflates
 * the `demo_view → checkout_paid` denominator, so the sink wired the same day
 * would have reported half the true conversion rate.
 */
let inFlight: Promise<AnonymousSessionResult> | null = null;

export async function ensureAnonymousSession(): Promise<AnonymousSessionResult> {
  if (inFlight) return inFlight;

  inFlight = mintOrReuse().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

async function mintOrReuse(): Promise<AnonymousSessionResult> {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    return { ok: true, userId: session.user.id, created: false };
  }

  const { data, error } = await supabase.auth.signInAnonymously();

  if (error || !data.user) {
    // Anonymous sign-ins can be disabled project-side at any time, and the caller has to
    // render something honest rather than a dead button — so the failure is returned, not
    // thrown or swallowed.
    return {
      ok: false,
      error: error?.message ?? "Could not start a session.",
    };
  }

  return { ok: true, userId: data.user.id, created: true };
}
