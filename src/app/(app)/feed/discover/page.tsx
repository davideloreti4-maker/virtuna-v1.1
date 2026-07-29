import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DiscoverClient } from "./discover-client";

export const metadata: Metadata = {
  title: "Pull | Maven",
  description: "Surface the outliers already beating their own baseline — then Remix the winner.",
};

/**
 * Server component for /feed/discover — the on-demand outlier PULL (Phase 08, Plan 03,
 * D-13/D-14/D-16). Auth-gated as defense-in-depth alongside the (app) layout guard. The
 * one-entry-two-modes input + grid are owned by the client component; the scrape/rank/cache
 * happens server-side in POST /api/discover (08-02).
 *
 * A tool tab of the Discover hub, sibling to /feed/channels and /feed/hooks — it configures
 * nothing and browses nothing, it FETCHES. That is the whole distinction from the hub's
 * content tabs: Watching/Trending read `scraped_videos`, a corpus cron/webhook already
 * ingested, so they render on arrival. This page is idle until you name a handle or a niche,
 * then pulls live (Apify) on a cache miss — which is why it can take minutes.
 *
 * ⚠ That live pull is billable Apify spend bounded ONLY by DISCOVER_DAILY_CAP (20/day, held
 * in a module-level Map — per-instance, not global). It is NOT in CREDIT_COSTS, so the pull
 * is free and unmetered, while the equivalent `explore_scrape` action costs 5 credits. Giving
 * this page a tab is what makes that reachable; pricing it is an open owner decision.
 *
 * Lived at /discover until 2026-07-29. That route is now a deep-link redirect here.
 */
export default async function DiscoverPullPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return <DiscoverClient />;
}
