"use server";

import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";

/**
 * Request a password-reset email.
 *
 * ALWAYS answers "sent" — whether or not the address has an account. Anything else turns
 * this form into an account-enumeration oracle (type an email, learn if it's a customer).
 * Failures are logged server-side; the user-visible answer does not change.
 *
 * The email's link verifies at Supabase, then lands on our existing PKCE callback
 * (/auth/callback, open-redirect-guarded) with next=/reset-password — where the now-authed
 * recovery session sets the new password. No second token flow to maintain.
 */
export async function requestPasswordReset(_prevState: unknown, formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim();
  if (!email) return { sent: true };

  const h = await headers();
  const origin =
    h.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    // Rate limits, SMTP trouble — ours to see, not the visitor's to probe.
    console.error("[forgot-password] resetPasswordForEmail failed:", error.message);
  }

  return { sent: true };
}
