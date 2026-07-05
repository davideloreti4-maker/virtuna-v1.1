import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SavedShelf } from "@/components/saved/saved-shelf";

export const metadata: Metadata = {
  title: "Library | Maven",
  description:
    "Everything you've saved — Reads, ideas, hooks, scripts, outliers — ready to pull back into a thread.",
};

/**
 * Server component for the /library surface (Phase 12, Plan 02 — LIB-01, D-03).
 *
 * The canonical Library State home. EXTENDS the shipped P10 SavedShelf (relabeled
 * Saved → Library) over the SAME saved_items store — no second store, no
 * folder/tag UI. /saved redirects here to preserve deep links.
 *
 * Lives INSIDE the (app) route group so it inherits AppShell + auth + sidebar
 * (RESEARCH §5 / STATE 07-05). Auth-gated as defense-in-depth alongside the
 * (app) layout guard. AppShell owns the <main>; this page renders a plain
 * content <div> — do NOT nest a second <main> (STATE 07-05).
 */
export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return (
    <div className="relative min-h-full text-foreground">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-6 lg:px-6">
        <SavedShelf />
      </div>
    </div>
  );
}
