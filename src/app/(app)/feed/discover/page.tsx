import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PullNext } from "@/components/discover-next/pull-next";
import { getWatchlistData } from "@/lib/discover/watchlist-reads";
import { DISCOVER_STRINGS } from "@/lib/discover-next/discover-words";
import { pullSubjectOf } from "@/lib/discover-next/pull";
import { isFollowed } from "@/lib/discover-next/watchlist";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { DiscoverClient } from "./discover-client";

export const metadata: Metadata = {
  title: "Pull | Maven",
  description: NEW_LOOK_ENABLED
    ? DISCOVER_STRINGS.hub.description
    : "Surface the outliers already beating their own baseline — then Remix the winner.",
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
export default async function DiscoverPullPage({
  searchParams,
}: {
  searchParams: Promise<{ input?: string | string[] }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  if (NEW_LOOK_ENABLED) {
    // The new pull page for what the address asks; it never starts a pull by itself. Whether the
    // creator is followed is read for Follow only, so a failed read shows Follow rather than no page.
    const { input } = await searchParams;
    const subject = pullSubjectOf(Array.isArray(input) ? input[0] : input);
    if (!subject) redirect("/feed");
    let followed = false;
    if (subject.kind === "handle") {
      try {
        followed = isFollowed((await getWatchlistData(supabase)).sources, subject.handle);
      } catch (error) {
        console.error("[discover] watchlist read failed", error);
      }
    }
    return <PullNext subject={subject} followed={followed} />;
  }

  return <DiscoverClient />;
}
