import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCompetitorsData } from "@/lib/competitors/competitors-data";
import { DiscoverHub, type DiscoverTab } from "@/components/discover/discover-hub";

export const metadata: Metadata = {
  title: "Discover | Maven",
  description:
    "Outliers from the channels you watch, what's trending, and your competitors — Remix any winner into a Read.",
};

const TAB_SET = new Set<DiscoverTab>(["watching", "trending", "competitors"]);

/**
 * /feed — the DISCOVER hub (Surfaces IA rationalization). Folds the old /feed and
 * /competitors surfaces into one tabbed destination: Watching · Trending · Competitors.
 * Auth-gated, inside (app) so it inherits AppShell + ToastProvider. `?tab=` deep-links a
 * tab (the /competitors redirect sets ?tab=competitors); default is Watching.
 *
 * Watching/Trending are client-fetched by FeedClient (GET /api/feed). Competitors data is
 * read server-side here (getCompetitorsData) and handed to the Competitors tab, so switching
 * to it is instant — mirrors the GROW hub fetching every tab's data upfront.
 */
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
    : "watching";

  const { competitors, snapshotMap, videosMap } = await getCompetitorsData(supabase);

  return (
    <DiscoverHub
      initialTab={initialTab}
      competitors={competitors}
      snapshotMap={snapshotMap}
      videosMap={videosMap}
    />
  );
}
