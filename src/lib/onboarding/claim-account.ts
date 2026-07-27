import { createClient } from "@/lib/supabase/client";

/**
 * Claiming the room — identity linking onto the SAME anonymous user
 * (ONBOARDING-FUNNEL-DESIGN.md §0b② last line: "their email identity is linked onto the
 * same anon user — the thread SURVIVES").
 *
 * The unlock IS the link: every server-side seal (lib/onboarding/verdict-seal.ts) is keyed
 * strictly on `is_anonymous === true`, so the moment the identity lands the seals open by
 * construction. There is deliberately NO read-side unlock path — do not add one.
 *
 * ⚠️ THE /welcome TRAP, and why every link is preceded by an onboarding stamp:
 * the moment `is_anonymous` flips false, this visitor becomes a real un-onboarded user, and
 * BOTH the auth callback (auth/callback/route.ts) and the middleware gate
 * (supabase/middleware.ts) bounce real users without a completed `creator_profiles` row to
 * /welcome — the one-field form the funnel exists to replace. They would pay $1 and land on
 * a username prompt instead of their unlocked room. The funnel visitor has ALREADY done the
 * real onboarding (§0's one rule: "onboarding is the product's first run" — they ran it), so
 * the stamp is honest, and it must land BEFORE the link, because the redirect check runs the
 * instant the linked session comes back.
 *
 * A failed stamp is logged but never blocks the link — the link is the unlock the visitor
 * paid for; the stamp only decides which page greets them. Degraded outcome: one detour
 * through /welcome, thread intact.
 */

export type ClaimLinkResult = { ok: true } | { ok: false; error: string };

/** Where the OAuth round-trip lands. `next` survives the provider redirect via the
 *  callback's `safeNext` (which preserves the query) — /home re-opens the visitor's
 *  (now unsealed) thread, and `claimed=1` tells its funnel-return inlet to auto-open
 *  the verdict they paid for instead of leaving them on a silent thread. */
export function googleLinkRedirectUrl(origin: string): string {
  return `${origin}/auth/callback?next=${encodeURIComponent("/home?claimed=1")}`;
}

async function stampOnboardingComplete(
  supabase: ReturnType<typeof createClient>,
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Upsert, not update: no trigger mints `creator_profiles` rows, and an anonymous
    // visitor has never touched /welcome — RLS admits both the INSERT and the UPDATE
    // (`user_id = auth.uid()`), and `user_id` is UNIQUE.
    const { error } = await supabase.from("creator_profiles").upsert(
      {
        user_id: user.id,
        onboarding_step: "completed",
        onboarding_completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) {
      console.error("[claim] onboarding stamp failed — continuing to link", error);
    }
  } catch (err) {
    console.error("[claim] onboarding stamp failed — continuing to link", err);
  }
}

/**
 * Link a Google identity onto the current (anonymous) user. On success the browser
 * NAVIGATES to the provider — callers only ever see the failure return. Requires
 * `enable_manual_linking` on the Supabase project (owner has it in hand); a disabled
 * project answers with an error here, never a silent no-op.
 */
export async function beginGoogleLink(origin: string): Promise<ClaimLinkResult> {
  const supabase = createClient();
  await stampOnboardingComplete(supabase);

  const { error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: { redirectTo: googleLinkRedirectUrl(origin) },
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Convert the anonymous user with an email + password. Supabase sends a confirmation
 * email; `is_anonymous` flips (and the seals open) only once it is confirmed — the
 * caller's success state must say so honestly. The password lands immediately, so after
 * confirmation email+password login works with no further step.
 */
export async function linkEmailPassword(
  email: string,
  password: string,
): Promise<ClaimLinkResult> {
  const supabase = createClient();
  await stampOnboardingComplete(supabase);

  const { error } = await supabase.auth.updateUser({ email, password });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
