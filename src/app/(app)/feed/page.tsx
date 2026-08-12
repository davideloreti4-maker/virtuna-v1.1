import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { EMPTY_CORPUS, getDiscoverCorpus } from "@/lib/discover/corpus-reads";
import { getWatchlistData, type WatchlistData } from "@/lib/discover/watchlist-reads";
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
 *
 * ⚠️ The two reads are settled INDEPENDENTLY (2026-08-02). They hit different tables through
 * different clients — the corpus via the grounding service client, the watchlist via the
 * caller's RLS-scoped one — and neither tab needs the other's data. Awaiting them together
 * meant either failure threw out of the page and the (app) error boundary replaced the whole
 * hub, so a corpus hiccup took down a Watchlist that never touched the corpus. Each side now
 * degrades to its own honest empty and the surface says which half is missing.
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

  const [corpusRes, watchlistRes] = await Promise.allSettled([
    getDiscoverCorpus(),
    getWatchlistData(supabase),
  ]);

  if (corpusRes.status === "rejected") {
    console.error("[discover] corpus read failed", corpusRes.reason);
  }
  if (watchlistRes.status === "rejected") {
    console.error("[discover] watchlist read failed", watchlistRes.reason);
  }

  const corpus = corpusRes.status === "fulfilled" ? corpusRes.value : EMPTY_CORPUS;
  const watchlist: WatchlistData =
    watchlistRes.status === "fulfilled" ? watchlistRes.value : { sources: [], latest: [] };

  const newest = corpus.feedIds
    .map((id) => corpus.teardowns[id]?.postedAt)
    .find((d): d is string => Boolean(d));

  return (
    <DiscoverHub
      corpus={corpus}
      watchlist={watchlist}
      initialTab={initialTab}
      refreshedLabel={refreshedLabel(newest ?? null)}
      failures={{
        corpus: corpusRes.status === "rejected",
        watchlist: watchlistRes.status === "rejected",
      }}
    />
  );
}
