import { redirect } from "next/navigation";

import { StartFlow } from "@/components/start/start-flow";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Get started | Maven",
};

/**
 * /start — the funnel's questions and the account (spec 2026-11-26 §3.2, screens 2–5), new look only.
 *
 * Its own route group, `(funnel)`: no app shell and no sign-in gate (the `(app)` layout has both); the
 * middleware makes it public under the flag. Flag off: exactly as before, a redirect to /home (the middleware
 * keeps the path behind sign-in then). Signed in with onboarding done: the app. Signed in without it: the
 * questions, and the account step saves instead of asking for an email. An anonymous session counts as signed
 * out: its code sign-in opens a real account.
 */
export default async function StartPage() {
  if (!NEW_LOOK_ENABLED) redirect("/home");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = user && !user.is_anonymous ? user : null;

  if (signedIn) {
    const { data: profile } = await supabase
      .from("creator_profiles")
      .select("onboarding_completed_at")
      .eq("user_id", signedIn.id)
      .maybeSingle();
    if (profile?.onboarding_completed_at) redirect("/home");
  }

  return <StartFlow account={signedIn ? { email: signedIn.email ?? null } : null} />;
}
