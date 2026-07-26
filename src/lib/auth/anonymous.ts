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
 * Called on submit, never on mount — an account per page-view would mint a row for every
 * bot that ever crawls the landing. (They accumulate either way; the reaper is still owed.)
 */
export type AnonymousSessionResult =
  | { ok: true; userId: string; created: boolean }
  | { ok: false; error: string };

export async function ensureAnonymousSession(): Promise<AnonymousSessionResult> {
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
