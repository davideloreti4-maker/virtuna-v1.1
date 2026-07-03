import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StartPage } from "@/components/surfaces/start-page";

export const metadata: Metadata = {
  title: "Start | Juno",
  description:
    "Your day, pre-tested on your people — daily ideas, outliers to remix, the plan, and what actually happened.",
};

/**
 * /start — the flagship Surfaces start page (START-PAGE-BUILD-HANDOFF.md §4.2).
 *
 * Lives inside the (app) route group so it inherits AppShell (sidebar + the ToastProvider
 * the Seam-4 handoff uses) + the server auth gate. Auth-gated here too as defense-in-depth
 * (mirrors /feed, /library). AppShell owns the <main>; this renders a plain client shell —
 * do NOT nest a second <main>.
 *
 * `?first=1` opens the first-run (no-audience) state for review; default is the briefing.
 * The build stubs the Room ⇄ Surfaces contract with mock data (see mock-room.ts) — swap
 * stub → real when The Room ships (a graft, not a rebuild). Does NOT touch the /home
 * composer/thread (The Room's).
 */
export default async function StartRoute({
  searchParams,
}: {
  searchParams: Promise<{ first?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { first } = await searchParams;
  return <StartPage initialFirstRun={first === "1"} />;
}
