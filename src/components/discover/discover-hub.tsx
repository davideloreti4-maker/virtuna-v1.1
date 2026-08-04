"use client";

/**
 * DiscoverHub — the Discover surface: Outliers · Collections · Watchlist.
 *
 * The rework's premise, from the audit: five of the old six tabs rendered a corpus that was
 * empty, stale or hardcoded (`scraped_videos` carried a multiplier on 49 of 7,438 rows, a
 * cover on 104, and nothing had been ingested since 2026-07-13), while the corpus that is
 * complete — 524 extracted teardowns, every one with a cover, a date and a taxonomy, grouped
 * into 105 curated collections — reached the model and no user. So the tabs now name what the
 * product actually holds:
 *
 *   Outliers    — proven videos (baselined, ≥3×, thin-baseline extremes excluded)
 *   Collections — the 105 curated groupings, and the videos inside one
 *   Watchlist   — tracked creators and competitors, merged into one list
 *
 * One search field serves all three: it filters the library instantly and free, and offers
 * the live Pull (5 credits, priced 2026-08-02) only for a handle we don't already hold.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass, Lightning } from "@phosphor-icons/react";
import { PageShell, SurfaceHeader } from "@/components/surfaces/surface-header";
import { SurfaceErrorState } from "@/components/ui/surface-error-state";
import { DiscoverTabBar, type DiscoverTab } from "@/components/discover/discover-tab-bar";
import { OutliersPanel } from "@/components/discover/outliers-panel";
import { CollectionsPanel } from "@/components/discover/collections-panel";
import { WatchlistPanel } from "@/components/discover/watchlist-panel";
import { TeardownDetailDialog } from "@/components/discover/teardown-detail";
import { classifyDiscoverInput } from "@/lib/discover/classify-input";
import type { DiscoverCorpus } from "@/lib/discover/corpus-reads";
import type { WatchlistData } from "@/lib/discover/watchlist-reads";

export type { DiscoverTab };

export function DiscoverHub({
  corpus,
  watchlist,
  initialTab,
  refreshedLabel,
  failures = { corpus: false, watchlist: false },
}: {
  corpus: DiscoverCorpus;
  watchlist: WatchlistData;
  initialTab: DiscoverTab;
  refreshedLabel: string;
  /** Which of the page's two independent reads REJECTED. A failed read arrives here as an
   *  empty shape, and empty is indistinguishable from "nothing there" — this is what lets
   *  the tab say it couldn't read instead of confidently reporting zero. */
  failures?: { corpus: boolean; watchlist: boolean };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<DiscoverTab>(initialTab);
  const [query, setQuery] = useState("");
  /** The open teardown detail. Lifted to the hub because both Outliers and Collections open
   *  the same dialog over the same `corpus.teardowns` map — one instance, one source. */
  const [openId, setOpenId] = useState<string | null>(null);

  const select = (next: DiscoverTab) => {
    setTab(next);
    // Shareable without a navigation — no server refetch, no scroll reset.
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", next === "outliers" ? "/feed" : `/feed?tab=${next}`);
    }
  };

  const feedVideos = useMemo(
    () =>
      corpus.feedIds
        .map((id) => corpus.teardowns[id])
        .filter((v): v is NonNullable<typeof v> => Boolean(v)),
    [corpus],
  );

  // The subtitle no longer counts the library (owner, 2026-08-04). It read
  // "230 proven outliers · 105 collections · 408 creators" — three tallies that answered a
  // question nobody had yet, directly above the search field that answers the one they do.
  // It says what the surface IS instead.
  //
  // The FAILURE strings keep their shape and stay numberless: a failed read arrives as an
  // empty corpus, so a count rendered from it would be a confident zero about a library we
  // could not open. That was the reason this line was conditional in the first place, and it
  // outlives the counts.
  const subtitle =
    failures.corpus && failures.watchlist
      ? "Discover can't reach its data right now."
      : failures.corpus
        ? "The outlier library is unavailable right now — your watched sources still load."
        : "Proven outliers, curated collections, and the creators you follow.";

  // Pull is offered only for something we could actually go and fetch — a handle or a URL,
  // and only when the library has nothing under that name already.
  const trimmed = query.trim();
  const pullable =
    trimmed.length > 2 &&
    classifyDiscoverInput(trimmed).mode === "profile" &&
    !watchlist.sources.some((s) =>
      s.handle.toLowerCase().includes(trimmed.replace(/^@/, "").toLowerCase()),
    );

  return (
    <div className="relative min-h-full text-foreground">
      {/* Wider than the 880px default. Discover is the one browse surface here that carries a
          filter rail BESIDE its grid: at 880px the rail took 240 of it and left four columns
          about 135px wide, which truncated every creator handle to "@f…". The override is
          scoped to this surface — PageShell is shared, and the reading surfaces want 880. */}
      <PageShell className="max-w-[1200px]">
        <SurfaceHeader title="Discover" subtitle={subtitle} />

        <div className="mt-4 flex gap-2">
          <div className="flex h-10 flex-1 items-center gap-2.5 rounded-lg border border-border bg-surface-sunken px-3">
            <MagnifyingGlass size={15} className="shrink-0 text-foreground-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search outliers, collections, creators — or paste a @handle"
              aria-label="Search Discover"
              className="min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-foreground-muted"
            />
          </div>
          {pullable ? (
            <button
              type="button"
              onClick={() => router.push(`/feed/discover?input=${encodeURIComponent(trimmed)}`)}
              className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-surface-elevated px-3.5 text-label font-semibold text-foreground-secondary transition-colors hover:border-border-hover hover:text-foreground"
            >
              <Lightning size={14} weight="fill" />
              Pull live
              <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-micro font-medium text-foreground-muted">
                5 credits
              </span>
            </button>
          ) : null}
        </div>

        <div className="mt-4">
          <DiscoverTabBar active={tab} onSelect={select} />
        </div>

        <div key={tab} className="rv-in mt-5">
          {tab === "outliers" ? (
            failures.corpus ? (
              <ReadFailed what="the outlier library" onRetry={() => router.refresh()} />
            ) : (
              <OutliersPanel
                videos={feedVideos}
                query={query}
                refreshedLabel={refreshedLabel}
                onOpen={setOpenId}
              />
            )
          ) : null}
          {tab === "collections" ? (
            failures.corpus ? (
              <ReadFailed what="the collections" onRetry={() => router.refresh()} />
            ) : (
              <CollectionsPanel
                collections={corpus.collections}
                teardowns={corpus.teardowns}
                query={query}
                onOpen={setOpenId}
              />
            )
          ) : null}
          {tab === "watchlist" ? (
            failures.watchlist ? (
              <ReadFailed what="your watchlist" onRetry={() => router.refresh()} />
            ) : (
              <WatchlistPanel
                sources={watchlist.sources}
                latest={watchlist.latest}
                query={query}
                libraryCount={corpus.totals.proven}
                onBrowseOutliers={() => select("outliers")}
              />
            )
          ) : null}
        </div>
      </PageShell>

      <TeardownDetailDialog
        video={openId ? corpus.teardowns[openId] ?? null : null}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}

/** One tab's read failed. The others are untouched, so this replaces the panel and nothing
 *  else — the whole point of settling the two reads separately. */
function ReadFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <SurfaceErrorState
      stacked
      message={`We couldn't load ${what} just now.`}
      onRetry={onRetry}
      retryLabel="Try again"
    />
  );
}
