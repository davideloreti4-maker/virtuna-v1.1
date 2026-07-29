import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { HooksClient } from "./hooks-client";

export const metadata: Metadata = {
  title: "Hooks | Maven",
  description: "Your vault of viral hook templates — adapt any one into a script for your audience.",
};

/**
 * Server component for /feed/hooks (Discover Feed UI-refinement).
 *
 * Auth-gated (defense-in-depth alongside the (app) layout guard, mirrors /feed +
 * /feed/channels). The searchable/sortable hook vault is owned by the client component;
 * v1 is seed-backed (default-hooks) — the "from your analyzed videos" section fills once
 * the Phase-3 analyze pipeline lands.
 */
export default async function HooksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return <HooksClient />;
}
