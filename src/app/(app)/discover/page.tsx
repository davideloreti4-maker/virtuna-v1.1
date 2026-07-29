import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/surfaces/surface-header";
import { DiscoverClient } from "./discover-client";

export const metadata: Metadata = {
  title: "Outliers | Maven",
  description: "Surface the outliers already beating their own baseline — then Remix the winner.",
};

/**
 * Server component for the /discover view (Phase 08, Plan 03 — D-13/D-14/D-16).
 *
 * Auth-gated (defense-in-depth alongside the (app) layout guard). The browsable
 * outlier grid + one-entry-two-modes pull are owned by the client component; the
 * actual scrape/rank/cache happens server-side in POST /api/discover (08-02).
 *
 * This is the PULL surface: you name a handle or a niche and it scrapes on demand.
 * It is NOT the Discover hub at /feed, which browses corpora you already watch
 * (Watching · Trending · Competitors) — that's where the sidebar's "Discover" points.
 * The two were collapsed into one on 2026-06-29 (this route became a redirect to
 * /feed) and both were then hidden by the 2026-07-15 launch cut. REACTIVATED as two
 * distinct surfaces 2026-07-29 at the owner's request; DiscoverClient + POST
 * /api/discover were left untouched throughout.
 *
 * ⚠ No sidebar entry — /feed owns the "Discover" nav item, so this is URL-reachable
 * only until the owner picks a door for it.
 */
export default async function DiscoverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return (
    <div className="relative min-h-full text-foreground">
      <PageShell>
        <DiscoverClient />
      </PageShell>
    </div>
  );
}
