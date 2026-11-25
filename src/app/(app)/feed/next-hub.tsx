import { Suspense } from "react";

import { DiscoverNext, DiscoverNextLoading } from "@/components/discover-next/discover-next";
import { getDiscoverCorpus } from "@/lib/discover/corpus-reads";
import { getWatchlistData } from "@/lib/discover/watchlist-reads";
import { DISCOVER_STRINGS } from "@/lib/discover-next/discover-words";
import { EMPTY_HUB, hubDataOf } from "@/lib/discover-next/hub-data";
import type { HubWatchlist } from "@/lib/discover-next/watchlist";
import type { createClient } from "@/lib/supabase/server";

/**
 * /feed under the new look (spec 3.1, 3.8): the hub's two reads and its
 * element. The page calls this after its session check; with the flag off it never runs.
 *
 * - The reads are settled each on its own, as the old page settles them: the library through the
 *   grounding service client, the watchlist through the caller's own. A failure of one is logged and
 *   said on its own chip (`failures`); the other chip works as before. A watchlist read that comes
 *   back `incomplete` (whom the creator follows could not be read) counts as failed.
 * - The library is cut to what the cards, the search and the collections draw (`hubDataOf`), so the
 *   page hands the browser nothing it does not show.
 * - The screen reads its view from the address itself (`useSearchParams`), so it is wrapped in a
 *   boundary whose fallback is its own loading state; nothing read once here can disagree with the
 *   address later.
 */

/** The page's description under the new look. */
export const NEXT_HUB_DESCRIPTION = DISCOVER_STRINGS.hub.description;

const EMPTY_WATCHLIST: HubWatchlist = { sources: [] };

export async function nextHub(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [corpusRes, watchlistRes] = await Promise.allSettled([getDiscoverCorpus(), getWatchlistData(supabase)]);

  if (corpusRes.status === "rejected") console.error("[discover] corpus read failed", corpusRes.reason);
  if (watchlistRes.status === "rejected") console.error("[discover] watchlist read failed", watchlistRes.reason);

  // A watchlist read that could not see whom the creator follows is a failure too: its rows may be
  // short, and their ids cannot be trusted to remove one. The chip says so instead of showing them.
  const watchlist = watchlistRes.status === "fulfilled" && watchlistRes.value.incomplete !== true ? watchlistRes.value : null;

  return (
    <Suspense fallback={<DiscoverNextLoading />}>
      <DiscoverNext
        hub={corpusRes.status === "fulfilled" ? hubDataOf(corpusRes.value) : EMPTY_HUB}
        // Only the rows: the read's latest videos are drawn by no part of the new hub.
        watchlist={watchlist ? { sources: watchlist.sources } : EMPTY_WATCHLIST}
        failures={{ corpus: corpusRes.status === "rejected", watchlist: watchlist === null }}
      />
    </Suspense>
  );
}
