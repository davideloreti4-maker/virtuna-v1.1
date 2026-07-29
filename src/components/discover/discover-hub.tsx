"use client";

/**
 * DiscoverHub — the DISCOVER hub shell (Surfaces IA rationalization): one destination that
 * folds the old /feed and /competitors surfaces into three tabs (Watching · Trending ·
 * Competitors). Owns the radial backdrop, page header, and segmented tab bar; each tab is a
 * shell-less body (FeedClient / CompetitorsClient).
 *
 * Watching + Trending share ONE FeedClient instance — they are the same feed with a
 * different corpus, so only the `tab` prop flips (no remount → loaded pages + scroll
 * survive the switch). The rv-in fade-up replays only when the BODY changes (feed ⇄
 * competitors), not on watching ⇄ trending.
 *
 * /competitors redirects here with ?tab=competitors (deep-link preservation, mirrors
 * /analytics → /grow). URL is kept in sync client-side via history.replaceState (no refetch).
 */

import { useState } from "react";
import type { FeedTab } from "@/lib/feed/feed-query";
import type { CompetitorsData } from "@/lib/competitors/competitors-data";
import { FeedClient } from "@/app/(app)/feed/feed-client";
import { CompetitorsClient } from "@/app/(app)/competitors/competitors-client";
import { DiscoverTabBar } from "@/components/discover/discover-tab-bar";
import { PageShell, SurfaceHeader } from "@/components/surfaces/surface-header";

export type DiscoverTab = "watching" | "trending" | "competitors";

export function DiscoverHub({
  initialTab,
  competitors,
  snapshotMap,
  videosMap,
}: {
  initialTab: DiscoverTab;
} & CompetitorsData) {
  const [tab, setTab] = useState<DiscoverTab>(initialTab);

  const select = (t: DiscoverTab) => {
    setTab(t);
    // Keep the URL shareable/deep-linkable without a navigation (no server refetch).
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", t === "watching" ? "/feed" : `/feed?tab=${t}`);
    }
  };

  // Watching/Trending map onto the feed's two corpora.
  const feedTab: FeedTab = tab === "trending" ? "trending" : "watched";

  return (
    <div className="relative min-h-full text-foreground">
      <PageShell>
        <div className="mb-4">
          <SurfaceHeader title="Discover" />

          <div className="mt-3">
            <DiscoverTabBar active={tab} onSelectContent={select} />
          </div>
        </div>

        {/* Key on the BODY (feed vs competitors), not the tab: watching↔trending keep the
            same FeedClient so its loaded pages survive; feed↔competitors replays rv-in. */}
        <div key={tab === "competitors" ? "competitors" : "feed"} className="rv-in">
          {tab === "competitors" ? (
            <CompetitorsClient
              competitors={competitors}
              snapshotMap={snapshotMap}
              videosMap={videosMap}
            />
          ) : (
            <FeedClient tab={feedTab} />
          )}
        </div>
      </PageShell>
    </div>
  );
}
