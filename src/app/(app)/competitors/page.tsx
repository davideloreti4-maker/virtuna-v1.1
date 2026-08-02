import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCompetitorsData } from "@/lib/competitors/competitors-data";
import { PageShell } from "@/components/surfaces/surface-header";
import { DiscoverSubpageHeader } from "@/components/discover/discover-subpage-header";
import { CompetitorsClient } from "./competitors-client";

export const metadata: Metadata = {
  title: "Competitors | Maven",
  description: "Add and compare the competitors behind your Discover watchlist.",
};

/**
 * /competitors — the competitor BOARD: add, compare, and the way into the deep pages.
 *
 * From 2026-07-04 this was a redirect into the hub's Competitors tab, and from 2026-07-29 it
 * pointed at `/feed?tab=competitors`. The 2026-08-02 rework merged Channels and Competitors
 * into one Watchlist tab, so that tab no longer exists and the redirect had nowhere to land.
 *
 * The merge is a READ merge — one list of who you follow, whichever door added them. The two
 * write paths stay distinct because the DATA does: a tracked account feeds `scraped_videos`
 * with a computed multiplier, a competitor feeds `competitor_videos` plus snapshots and the
 * /compare view. So this page keeps the competitor half reachable (add dialog, table,
 * compare) the same way /feed/channels keeps the other half, and Watchlist links to both.
 */
export default async function CompetitorsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { competitors, snapshotMap, videosMap } = await getCompetitorsData(supabase);

  return (
    <PageShell>
      <DiscoverSubpageHeader
        title="Competitors"
        subtitle="Track a competitor to capture their posts, follower history and head-to-head comparison."
        backLabel="Watchlist"
        backHref="/feed?tab=watchlist"
      />
      <CompetitorsClient
        competitors={competitors}
        snapshotMap={snapshotMap}
        videosMap={videosMap}
      />
    </PageShell>
  );
}
