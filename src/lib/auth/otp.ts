/**
 * Email OTP — the funnel's primary identity path.
 *
 * WHY A CODE AND NOT A LINK: the traffic arrives inside TikTok / Instagram
 * webviews (see `in-app-browser.ts`). A magic LINK is fatal there — tapping it
 * hands the session to a different browser, where the referral cookie and the
 * checkout intent do not exist, and the visitor is stranded one step short of
 * paying. A six-digit code is typed back into the SAME page: no navigation, no
 * app switch, nothing lost.
 *
 * ⚠️ DEPLOY REQUIREMENT — this code cannot work alone. Supabase's default
 * templates send a magic LINK, not a code, and `signInWithOtp` picks the
 * template by whether the address is already known:
 *
 *   - new address  → **Confirm signup** template  ← the funnel's whole volume
 *   - known address → **Magic Link** template
 *
 * BOTH must contain `{{ .Token }}`, and Confirm signup is the one that matters
 * for acquisition — miss it and every first-time visitor receives a link with
 * nothing to type, which is the exact failure this module exists to prevent.
 * Dashboard/Management-API change; no code path here can compensate.
 */

import { createClient } from "@/lib/supabase/client";

/** Digits in a Supabase email OTP. */
export const OTP_LENGTH = 6;

/**
 * How long to disable "resend" for. Supabase rate-limits these server-side; the
 * cooldown exists so the visitor sees a countdown instead of an error they'd
 * read as the product being broken.
 */
export const RESEND_COOLDOWN_SECONDS = 45;

export interface OtpResult {
  ok: boolean;
  /** Present when `ok` is false — already mapped to customer-facing language. */
  error?: string;
}

/**
 * Map Supabase's auth errors to something a creator can act on.
 * Anything unrecognised stays vague on purpose: an auth surface should never
 * leak whether a given address has an account.
 */
function mapOtpError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many codes requested. Wait a minute, then try again.";
  }
  if (lower.includes("invalid") && lower.includes("email")) {
    return "That doesn't look like a valid email address.";
  }
  if (lower.includes("expired")) {
    return "That code expired. Send a new one.";
  }
  if (lower.includes("token") || lower.includes("otp")) {
    return "That code isn't right. Check the digits and try again.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  return "Something went wrong. Try again.";
}

/**
 * Send the six-digit code.
 *
 * `shouldCreateUser: true` is deliberate: this one call covers both signup and
 * login. The funnel must never make a visitor decide which of the two they are —
 * that is a fork in the road at the moment of highest intent, and half of them
 * pick wrong and land on an error.
 */
export async function sendOtp(email: string): Promise<OtpResult> {
  const trimmed = email.trim();
  if (!trimmed) return { ok: false, error: "Enter your email address." };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: { shouldCreateUser: true },
  });

  if (error) return { ok: false, error: mapOtpError(error.message) };
  return { ok: true };
}

/**
 * Verify the code and open the session.
 *
 * `type: "email"` is the OTP verification type — NOT "magiclink", which expects
 * a token lifted out of a URL rather than one the user typed.
 */
export async function verifyOtp(email: string, token: string): Promise<OtpResult> {
  const cleanedToken = token.replace(/\D/g, "");
  if (cleanedToken.length !== OTP_LENGTH) {
    return { ok: false, error: `Enter the ${OTP_LENGTH}-digit code from your email.` };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: cleanedToken,
    type: "email",
  });

  if (error) return { ok: false, error: mapOtpError(error.message) };
  return { ok: true };
}
