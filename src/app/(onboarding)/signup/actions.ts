"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";

function mapSignupError(supabaseError: string): string {
  const lower = supabaseError.toLowerCase();
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (lower.includes("password") && lower.includes("least")) {
    return "Password must be at least 6 characters long.";
  }
  if (lower.includes("valid email") || lower.includes("invalid email")) {
    return "Please enter a valid email address.";
  }
  if (lower.includes("too many requests") || lower.includes("rate limit")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Unable to connect. Please check your internet connection and try again.";
  }
  return "Something went wrong. Please try again.";
}

export async function signup(_prevState: unknown, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // The confirmation link must come back through OUR guarded callback, not whatever the
  // Supabase project's Site URL happens to be — that's how a staging Site URL strands a
  // production signup. next=/welcome: a just-confirmed account goes to onboarding.
  const h = await headers();
  const origin =
    h.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/welcome`,
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(mapSignupError(error.message))}`);
  }

  // ⚠️ Ask the RESPONSE whether a confirmation is pending — do not assume it.
  //
  // This used to redirect to "check your email" unconditionally. The Supabase project has
  // email confirmation OFF: it stamps `email_confirmed_at` ~0.09s after creation, sends no
  // mail, and returns a live session here — which the server client has already written to
  // the cookie. So a brand-new user was signed in, told to wait for a message that would
  // never arrive, and dropped on /login, which is code-first (the password field is behind
  // a toggle). Verified against numenmachines.com 2026-08-04.
  //
  // Branching on `data.session` covers BOTH project settings without a flag: confirmation
  // ON returns `session: null` and the old copy is correct; OFF returns a session and the
  // user belongs in onboarding, which is where `emailRedirectTo` already points.
  if (data.session) {
    redirect("/welcome");
  }

  redirect("/login?message=Check your email to confirm your account");
}
