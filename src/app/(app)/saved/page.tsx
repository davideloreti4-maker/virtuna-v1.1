import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SavedShelf } from "@/components/saved/saved-shelf";

export const metadata: Metadata = {
  title: "Saved | Numen",
  description: "Your flat, typed shelf — Reads, ideas, hooks, and outliers pinned from any thread.",
};

/**
 * Server component for the /saved surface (Phase 10, Plan 04 — SAVE-01, D-07).
 *
 * Lives INSIDE the (app) route group so it inherits AppShell + auth + sidebar
 * (RESEARCH §5 / STATE 07-05). Auth-gated as defense-in-depth alongside the
 * (app) layout guard. AppShell owns the <main>; this page renders a plain
 * content <div> — do NOT nest a second <main> (STATE 07-05).
 */
export default async function SavedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:p-6">
      <SavedShelf />
    </div>
  );
}
