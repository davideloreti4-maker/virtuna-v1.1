"use client";

import { useMemo, useRef, useState } from "react";

import { CollectionsPanel } from "@/components/discover-next/collections-panel";
import { DiscoverScreen } from "@/components/discover-next/discover-screen";
import { FilterIcon } from "@/components/discover-next/discover-icons";
import { FilterPanel, type FilterChoice } from "@/components/discover-next/filter-panel";
import { OrderMenu } from "@/components/discover-next/order-menu";
import { PullOffer } from "@/components/discover-next/pull-offer";
import { VideosPanel } from "@/components/discover-next/videos-panel";
import { Chip } from "@/components/ui/chip";
import { shelvesOf } from "@/lib/discover-next/collections";
import { DEFAULT_DISCOVER_VIEW, discoverSearchText, type DiscoverView } from "@/lib/discover-next/discover-view";
import { DISCOVER_STRINGS } from "@/lib/discover-next/discover-words";
import { PAGE_SIZE, activeNiche, gridOf, searchVideos } from "@/lib/discover-next/grid";
import { hubLines } from "@/lib/discover-next/hub-lines";
import { nicheOptions } from "@/lib/discover-next/niches";
import { offerFor } from "@/lib/discover-next/pull";

import { DEV_COLLECTIONS } from "./collection-fixtures";
import { DEV_VIDEOS } from "./fixtures";

/**
 * Discover on local state, for /dev/discover (`page.tsx`): the real screen, filter and order menu over
 * made-up videos (`fixtures.ts`), with the view held here instead of in the address (this page has its
 * own address). The chips, the search, the filter, the order and "Show more" work; nothing here sends
 * anything, and a card's link leads to a video page that does not exist yet. The Collections chip
 * shows made-up collections (`collection-fixtures.ts`), narrowed by the search, with See all. A search
 * the library cannot answer alone shows the pull row above the grid (its Pull does nothing here).
 */

/** The states the page can open in (`page.tsx` checks the name). */
export type DevDiscoverState =
  | "videos"
  | "loading"
  | "error"
  | "filtered"
  | "search"
  | "nomatch"
  | "collections"
  | "collection-search"
  | "offer"
  | "offer-words"
  | "offer-link";

const noop = () => {};

const START: Record<DevDiscoverState, { view: Partial<DiscoverView>; query: string }> = {
  videos: { view: {}, query: "" },
  loading: { view: {}, query: "" },
  error: { view: {}, query: "" },
  filtered: { view: { niche: "comedy", platform: "tiktok" }, query: "" },
  search: { view: {}, query: "bread" },
  nomatch: { view: {}, query: "underwater basket weaving" },
  collections: { view: { tab: "collections" }, query: "" },
  "collection-search": { view: { tab: "collections" }, query: "skit" },
  offer: { view: {}, query: "@kai.wanders" },
  "offer-words": { view: {}, query: "sourdough starter" },
  "offer-link": { view: {}, query: "instagram.com/kai.wanders" },
};

export function DevDiscover({ state }: { state: DevDiscoverState }) {
  const [view, setView] = useState<DiscoverView>({ ...DEFAULT_DISCOVER_VIEW, ...START[state].view });
  const [query, setQuery] = useState(START[state].query);
  const [more, setMore] = useState({ key: "", shown: PAGE_SIZE });
  const [filterOpen, setFilterOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  const typed = discoverSearchText(query);
  const shownView = useMemo(() => ({ ...view, q: typed }), [view, typed]);
  const niches = useMemo(() => nicheOptions(DEV_VIDEOS), []);
  const videos = useMemo(() => gridOf(DEV_VIDEOS, shownView, niches), [shownView, niches]);
  const key = JSON.stringify(shownView);
  const shown = more.key === key ? more.shown : PAGE_SIZE;

  if (state === "loading") return <DiscoverScreen tab="videos" onTab={noop} query="" onQuery={noop} state="loading" />;

  const niche = activeNiche(view.niche, niches);
  const { countLine, filtered, empty } = hubLines({ library: DEV_VIDEOS, found: videos.length, q: typed, niche, platform: view.platform });
  const onVideos = view.tab === "videos";
  const filters = onVideos && state !== "error";
  const openFilter = (from: HTMLElement) => {
    opener.current = from;
    setFilterOpen(true);
  };
  const applied: FilterChoice = { niche, platform: view.platform, order: view.order };
  // Nobody is followed here: every creator not in the made-up library is offered.
  const offer = filters ? offerFor(typed, { libraryMatches: searchVideos(DEV_VIDEOS, typed).length, followed: () => false }) : null;

  return (
    <DiscoverScreen
      tab={view.tab}
      onTab={(tab) => setView((v) => ({ ...v, tab }))}
      query={query}
      onQuery={setQuery}
      onFilter={filters ? openFilter : undefined}
      filterOpen={filterOpen}
      state="ready"
      tools={
        filters ? (
          <>
            <FilterPanel
              open={filterOpen}
              onOpenChange={setFilterOpen}
              anchor={
                <Chip onClick={(e) => openFilter(e.currentTarget)} className="gap-[7px]">
                  <FilterIcon size={17} aria-hidden />
                  {DISCOVER_STRINGS.hub.filter}
                </Chip>
              }
              niches={niches}
              applied={applied}
              countOf={(choice) => gridOf(DEV_VIDEOS, { ...shownView, ...choice }, niches).length}
              onApply={(choice) => setView((v) => ({ ...v, ...choice }))}
              returnFocus={() => opener.current}
            />
            <OrderMenu order={view.order} onOrder={(order) => setView((v) => ({ ...v, order }))} />
          </>
        ) : undefined
      }
    >
      {onVideos && (
        <VideosPanel
          state={state === "error" ? "failed" : "ready"}
          videos={videos}
          shown={shown}
          onMore={() => setMore({ key, shown: shown + PAGE_SIZE })}
          countLine={countLine}
          filtered={filtered}
          onClearFilter={() => setView((v) => ({ ...v, niche: null, platform: null }))}
          orderWord={DISCOVER_STRINGS.orders[view.order]}
          empty={empty}
          onClearSearch={() => setQuery("")}
          onRetry={noop}
          onOpen={noop}
          offer={offer && <PullOffer target={offer} onPull={noop} className="mt-3" />}
        />
      )}
      {view.tab === "collections" && (
        <CollectionsPanel
          state={state === "error" ? "failed" : "ready"}
          shelves={shelvesOf(DEV_COLLECTIONS, typed)}
          searching={typed !== ""}
          onRetry={noop}
        />
      )}
    </DiscoverScreen>
  );
}
