"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface SignupState {
  error?: string;
}

export async function signup(_prevState: unknown, formData: FormData): Promise<SignupState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // Redirect to login with success message — email confirmation needed first
  redirect("/login?message=Check your email to confirm your account");
}
