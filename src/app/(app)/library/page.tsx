import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/surfaces/surface-header";
import { SavedShelf } from "@/components/saved/saved-shelf";
import { LibraryNext, LibraryNextLoading } from "@/components/library-next/library-next";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

export const metadata: Metadata = {
  title: "Library | Maven",
  // New look (plan 2026-11-23-library): Library is the list of the creator's chats.
  description: NEW_LOOK_ENABLED
    ? "Your chats, what is in them and how they did."
    : "Everything you've saved — Reads, ideas, hooks, scripts, outliers — ready to pull back into a thread.",
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
 *
 * Hidden for the MVP launch cut (lane/launch-prep, 2026-07-15) — the page was a bare
 * redirect to /home for two weeks. REACTIVATED 2026-07-29 at the owner's request; the
 * SavedShelf + saved_items store were left untouched throughout, so this is a restore of
 * the pre-cut page with ONE change: it now uses PageShell (the canonical 880px column,
 * 0f904cf8) instead of its old private max-w-[1180px], so its header's left edge lines
 * up with /audience and /settings. Restoring 1180px verbatim would have reintroduced the
 * exact misalignment that audit fixed.
 */
export default async function LibraryPage() {
  // The session read (cookies) keeps the page dynamic, so `useSearchParams` below renders on the
  // server with the request's parameters and the boundary's fallback is not seen in practice.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // New look: one list of the creator's chats (spec 2026-11-23-library). The screen reads its chip
  // and search from the address itself (`useSearchParams`), the one source of both, so it follows a
  // navigation to another Library address. Flag off: the saved shelf, exactly as before (it reads
  // no parameter).
  if (NEW_LOOK_ENABLED) {
    return (
      <Suspense fallback={<LibraryNextLoading />}>
        <LibraryNext />
      </Suspense>
    );
  }

  return (
    <div className="relative min-h-full text-foreground">
      <PageShell>
        <SavedShelf />
      </PageShell>
    </div>
  );
}
