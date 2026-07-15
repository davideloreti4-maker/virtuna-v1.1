"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function mapLoginError(supabaseError: string): string {
  const lower = supabaseError.toLowerCase();
  if (lower.includes("invalid login credentials") || lower.includes("invalid credentials")) {
    return "Invalid email or password. Please try again.";
  }
  if (lower.includes("email not confirmed")) {
    return "Please confirm your email address before signing in. Check your inbox.";
  }
  if (lower.includes("too many requests") || lower.includes("rate limit")) {
    return "Too many sign-in attempts. Please wait a moment and try again.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Unable to connect. Please check your internet connection and try again.";
  }
  return "Something went wrong. Please try again.";
}

export async function login(_prevState: unknown, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next = (formData.get("next") as string) || "/dashboard";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(mapLoginError(error.message))}&next=${encodeURIComponent(next)}`);
  }

  // Detect first-time users and redirect to onboarding
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("creator_profiles")
      .select("onboarding_completed_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile || !profile.onboarding_completed_at) {
      redirect("/welcome");
    }
  }

  redirect(next);
}
