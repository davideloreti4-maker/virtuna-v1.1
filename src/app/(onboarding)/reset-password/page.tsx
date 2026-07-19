import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "New Password | Maven",
};

/**
 * Set the new password. Reached AUTHED: the email link verified at Supabase and came back
 * through /auth/callback, which exchanged the code for a (recovery) session. No session =
 * an expired/used link — send them back for a fresh one, with a sentence that says so.
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?message=${encodeURIComponent("That reset link has expired — request a new one below.")}`
    );
  }

  return <ResetPasswordForm />;
}
