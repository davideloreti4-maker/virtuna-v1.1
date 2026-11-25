import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EarnNext } from "@/components/earn-next/earn-next";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { isSealedVisitor } from "@/lib/onboarding/verdict-seal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Earn | Maven",
  description: "Your referral link and a card to share.",
};

/**
 * /earn — the creator's referral link and a card to share (plan 2026-11-24-earn, step A). New look only:
 * with the flag off it does not exist. Signed out: nothing (the (app) layout and the middleware send the
 * visitor to log in). A /go visitor (an anonymous session) has no account, so no link: they go to You,
 * whose card asks them to create one.
 */
export default async function EarnPage() {
  if (!NEW_LOOK_ENABLED) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (isSealedVisitor(user)) redirect("/you");
  return <EarnNext />;
}
