import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getDiscoverCorpus } from "@/lib/discover/corpus-reads";
import { getWatchlistData } from "@/lib/discover/watchlist-reads";
import { DiscoverHub, type DiscoverTab } from "@/components/discover/discover-hub";

export const metadata: Metadata = {
  title: "Discover | Maven",
  description:
    "Proven outliers, curated collections, and the creators you watch — Remix any winner into a Read.",
};

const TAB_SET = new Set<DiscoverTab>(["outliers", "collections", "watchlist"]);

/**
 * /feed — the DISCOVER hub, reworked 2026-08-02 from six tabs to three.
 *
 * Both reads happen here, server-side, so every tab is instant on arrival: the corpus is
 * global curated content (~520 rows, read through the grounding service client because
 * `outlier_teardowns` has RLS on with no policies), and the watchlist is RLS-scoped to the
 * caller. `?tab=` deep-links a tab; default is Outliers.
 *
 * No `revalidate` here on purpose: the auth check reads cookies, so this page is dynamic and
 * a route-level revalidate would be inert — a comment promising an hour of caching that
 * never happens. The two reads are a single round trip each.
 */

/** The corpus is frozen until an ingest runs, and the surface says so rather than implying
 *  a live feed. Both dates are facts about the data, not decoration. */
function refreshedLabel(newestPostAt: string | null): string {
  if (!newestPostAt) return "Nothing auto-refreshes yet — Pull live brings in fresh material on demand.";
  const newest = new Date(newestPostAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `Newest video in the library: ${newest}. Nothing auto-refreshes yet — Pull live brings in fresh material on demand.`;
}

export default async function DiscoverRoute({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { tab } = await searchParams;
  const initialTab: DiscoverTab = TAB_SET.has(tab as DiscoverTab)
    ? (tab as DiscoverTab)
    : "outliers";

  const [corpus, watchlist] = await Promise.all([
    getDiscoverCorpus(),
    getWatchlistData(supabase),
  ]);

  const newest = corpus.feedIds
    .map((id) => corpus.teardowns[id]?.postedAt)
    .find((d): d is string => Boolean(d));

  return (
    <DiscoverHub
      corpus={corpus}
      watchlist={watchlist}
      initialTab={initialTab}
      refreshedLabel={refreshedLabel(newest ?? null)}
    />
  );
}
