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
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/welcome`,
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(mapSignupError(error.message))}`);
  }

  // Redirect to login with success message — email confirmation needed first
  redirect("/login?message=Check your email to confirm your account");
}
