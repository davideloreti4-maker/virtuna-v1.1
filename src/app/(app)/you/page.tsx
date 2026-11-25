import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { YouNext } from "@/components/you-next/you-next";
import { YouSignUp } from "@/components/you-next/you-sign-up";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { isSealedVisitor } from "@/lib/onboarding/verdict-seal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "You | Maven",
  description: "What Maven knows about you.",
};

/**
 * /you — what Maven knows about the creator (spec 2026-11-24). New look only: with the flag off it
 * does not exist. Signed out: nothing (the (app) layout and the middleware send the visitor to log
 * in). A /go visitor (an anonymous session): one card asking them to create an account; nothing on
 * it reads or saves, so no creator_profiles row is ever made for them.
 */
export default async function YouPage() {
  if (!NEW_LOOK_ENABLED) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (isSealedVisitor(user)) return <YouSignUp />;
  return <YouNext />;
}
