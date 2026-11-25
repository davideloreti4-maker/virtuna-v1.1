"use client";

import * as React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";

import { MenuButton } from "@/components/shell/menu-button";
import { Chip } from "@/components/ui/chip";
import { shelvesOf } from "@/lib/discover-next/collections";
import {
  DEFAULT_DISCOVER_VIEW,
  discoverHref,
  discoverSearchText,
  discoverViewOf,
  pullHref,
  type DiscoverTab,
  type DiscoverView,
} from "@/lib/discover-next/discover-view";
import { DISCOVER_STRINGS } from "@/lib/discover-next/discover-words";
import { PAGE_SIZE, activeNiche, gridOf, searchVideos } from "@/lib/discover-next/grid";
import type { HubData } from "@/lib/discover-next/hub-data";
import { hubLines } from "@/lib/discover-next/hub-lines";
import { nicheOptions } from "@/lib/discover-next/niches";
import { offerFor } from "@/lib/discover-next/pull";
import { armPull, dropPull, keepPullOnlyAt } from "@/lib/discover-next/pull-intent";
import { leaveGrid, takeGrid } from "@/lib/discover-next/return-point";
import { isFollowed, type HubWatchlist } from "@/lib/discover-next/watchlist";

import { CollectionsPanel } from "./collections-panel";
import { FilterIcon } from "./discover-icons";
import { DiscoverScreen } from "./discover-screen";
import { FilterPanel, type FilterChoice } from "./filter-panel";
import { OrderMenu } from "./order-menu";
import { PullOffer } from "./pull-offer";
import { VideosPanel } from "./videos-panel";
import { WatchlistNext } from "./watchlist-next";

/**
 * Discover with its data (spec 3.1, 3.2, 3.8): the hub at `/feed`, its three
 * chips, and under Videos the library's proven videos as a grid. The page reads the library and the
 * watchlist on the server and hands them in; nothing here sends a request.
 *
 * - The address (`?tab=&niche=&platform=&order=&q=`) is the one source of the view
 *   (`useSearchParams`, read by `discoverViewOf`). The screen writes it with the History API
 *   (`replaceState`, never a new entry, never a server render): a chip, a filter or an order at once,
 *   the search 250 ms after the last key. An address the screen did not write (the Discover tab, Back,
 *   a link) is followed: its view, and its search in the field.
 * - The grid answers what is typed at once (the search runs here, over the library in hand); the
 *   address catches up. 24 cards, Show more adds 24; the count starts again when the view changes.
 * - A card opens the video's page and leaves the hub's return point (`leaveGrid`): the address, the
 *   cards shown, and `<main>`'s scroll. A search still waiting for its write is written first, so Back
 *   lands on the grid that was on screen. On arrival the hub takes the point once, for its own
 *   address only: it shows that many cards and puts the scroll back before the browser paints.
 * - The pull row (`PullOffer`) above the grid, for a search the library cannot answer alone: a creator
 *   not followed yet, words it holds no video for, or a link Maven cannot read (said, never offered).
 *   Its Pull arms the intent and opens the pull page; nothing is sent from here.
 * - The library could not be read: its sentence and Try again (`router.refresh()`); the other chips
 *   are unaffected.
 * - Collections: Maven's collections on their four shelves, narrowed by name as the creator types;
 *   the library's failure is said there too. Watchlist: the creators followed, narrowed by the search,
 *   with Follow, Pull and Remove (`watchlist-next.tsx`); its empty state's quiet button opens the whole
 *   library on Videos.
 */

export interface DiscoverNextProps {
  hub: HubData;
  watchlist: HubWatchlist;
  /** Which read failed on the server: each chip says so for its own. */
  failures: { corpus: boolean; watchlist: boolean };
}

/** How long after the last key the search goes to the address. */
const SEARCH_WAIT_MS = 250;

const noop = () => {};

/** The shell's scrolling element: the hub scrolls inside `<main>`, not the window. */
const scroller = () => (typeof document === "undefined" ? null : document.querySelector<HTMLElement>("main"));

/**
 * Writes an address with the History API: the address and `useSearchParams` follow (Next keeps them in
 * step) and no request goes out. `replace`, never a new entry: a chip is not a step Back should take.
 * The screen's record of what it wrote is committed first, so it never takes its own write for a
 * navigation and resets the field under the creator's fingers (as Library's `writeAddress`).
 */
function writeAddress(target: string, setWritten: (href: string) => void) {
  // Already there: nothing to write. A second write of the same address (the search's wait, right after
  // a card or Pull wrote it) would make the router restore it, and that cancels the navigation the tap
  // started (the address reaches the search parameters only once that navigation commits).
  if (window.location.pathname + window.location.search === target) return;
  flushSync(() => setWritten(target));
  window.history.replaceState(null, "", target);
}

export function DiscoverNext({ hub, watchlist, failures }: DiscoverNextProps): React.JSX.Element {
  const router = useRouter();

  // The address: the view.
  const params = useSearchParams();
  const view = useMemo(() => discoverViewOf(Object.fromEntries(params.entries())), [params]);
  const href = discoverHref(view);
  // The address as of the last render, and the one the screen last wrote (or followed): when the
  // address changes to another than the one written, the change came from outside.
  const [seen, setSeen] = useState(href);
  const [written, setWritten] = useState(href);
  // The text in the field (the address holds it once 250 ms passed since the last key).
  const [query, setQuery] = useState(view.q);
  if (href !== seen) {
    setSeen(href);
    if (href !== written) {
      setWritten(href);
      setQuery(view.q);
    }
  }

  // What the grid answers: the address's view with the search as typed.
  const typed = discoverSearchText(query);
  const shownView = useMemo<DiscoverView>(() => ({ ...view, q: typed }), [view, typed]);
  const gridHref = discoverHref(shownView);
  const niches = useMemo(() => nicheOptions(hub.videos), [hub.videos]);
  const videos = useMemo(() => gridOf(hub.videos, shownView, niches), [hub.videos, shownView, niches]);
  const niche = activeNiche(view.niche, niches);
  // The Collections chip: the collections on their shelves, narrowed by the search as typed.
  const shelves = useMemo(() => shelvesOf(hub.collections, typed), [hub.collections, typed]);

  // Cards shown, for one view: another view starts again at 24.
  const [paging, setPaging] = useState({ href: gridHref, shown: PAGE_SIZE });
  if (paging.href !== gridHref) setPaging({ href: gridHref, shown: PAGE_SIZE });
  const shown = paging.href === gridHref ? paging.shown : PAGE_SIZE;

  const [filterOpen, setFilterOpen] = useState(false);
  const filterOpener = useRef<HTMLElement | null>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  /** Writes `next` to the address (see `writeAddress`); nothing when it is the address already. */
  const write = (next: DiscoverView) => {
    const target = discoverHref(next);
    if (target !== href) writeAddress(target, setWritten);
  };

  // The typed text goes to the address 250 ms after the last key. Cleared: at once, in `onQuery`.
  useEffect(() => {
    if (typed === view.q) return;
    const timer = setTimeout(() => writeAddress(discoverHref({ ...view, q: typed }), setWritten), SEARCH_WAIT_MS);
    return () => clearTimeout(timer);
  }, [typed, view]);

  // Back from a video: the return point, taken once on arrival and kept here, so React's second
  // development-mode run of this effect still has it (the module memory gives it only once). Applied
  // before the browser paints: the cards first, then, once that many are drawn, the scroll (a scroll
  // set earlier would stop at the foot of the shorter grid).
  const taken = useRef<{ shown: number; top: number } | null | undefined>(undefined);
  const arrivalHref = useRef(gridHref);
  const pendingScroll = useRef<{ shown: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (taken.current === undefined) taken.current = takeGrid(arrivalHref.current);
    const point = taken.current;
    if (!point) return;
    const want = Math.max(point.shown, PAGE_SIZE);
    pendingScroll.current = { shown: want, top: point.top };
    setPaging({ href: arrivalHref.current, shown: want });
  }, []);
  useLayoutEffect(() => {
    const pending = pendingScroll.current;
    if (!pending || shown < pending.shown) return;
    pendingScroll.current = null;
    const main = scroller();
    if (main) main.scrollTop = pending.top;
  }, [shown]);

  // A Pull press arms the intent for its pull page (here, or a watched creator's menu). Arriving here,
  // any press made before was left behind (Back before that page came): it is dropped. Leaving, it is
  // kept only for the page the press opened, whose address the router has written by the time this
  // screen is gone; leaving for anywhere else drops it, so a later Forward to that address cannot start
  // a paid pull without a press.
  useEffect(() => {
    dropPull();
    return () => keepPullOnlyAt(window.location.pathname + window.location.search);
  }, []);

  // "Try again": once the library is read again, its notice goes, and the focus with it: to the
  // heading. A retry that fails again keeps the notice, and the focus on its button.
  const retried = useRef(false);
  const retry = () => {
    retried.current = true;
    router.refresh();
  };
  useEffect(() => {
    if (!retried.current || failures.corpus) return;
    retried.current = false;
    const active = document.activeElement;
    if (!active || active === document.body) headingRef.current?.focus();
  }, [failures.corpus]);

  const onQuery = (next: string) => {
    setQuery(next);
    // Cleared: every video again, and the address at once.
    if (discoverSearchText(next) === "" && view.q !== "") write({ ...view, q: "" });
  };

  const onTab = (tab: DiscoverTab) => write({ ...shownView, tab });

  /** The empty watchlist's "372 proven videos are in the library": that whole library, no search, no filter. */
  const openLibrary = () => {
    setQuery("");
    write(DEFAULT_DISCOVER_VIEW);
    // The button goes with the chip it stood on: the focus goes to the heading, not to the page.
    headingRef.current?.focus();
  };

  const applyFilter = (choice: FilterChoice) => write({ ...shownView, ...choice });

  const clearSearch = () => {
    onQuery("");
    fieldRef.current?.focus();
  };

  /** A card opens: the search on screen goes to the address first, then the point is left for Back. */
  const openCard = () => {
    if (gridHref !== href) writeAddress(gridHref, setWritten);
    leaveGrid({ href: gridHref, shown, top: scroller()?.scrollTop ?? 0 });
  };

  const openFilter = (opener: HTMLElement) => {
    filterOpener.current = opener;
    setFilterOpen(true);
  };

  const { countLine, filtered, empty } = hubLines({ library: hub.videos, found: videos.length, q: typed, niche, platform: view.platform });

  const onVideos = view.tab === "videos";
  // The filter and the order belong to Videos, and only while there is a library to filter.
  const filters = onVideos && !failures.corpus;
  const applied: FilterChoice = { niche, platform: view.platform, order: view.order };

  // The pull row above the grid, for what is typed: a creator not followed yet, words the library holds
  // nothing for (searched whole, filters aside), or a link Maven cannot read (said, never offered).
  const offer = useMemo(
    () =>
      onVideos && !failures.corpus
        ? offerFor(typed, {
            libraryMatches: searchVideos(hub.videos, typed).length,
            followed: (handle) => isFollowed(watchlist.sources, handle),
          })
        : null,
    [onVideos, failures.corpus, typed, hub.videos, watchlist.sources],
  );

  /** The row's Pull: the search on screen goes to the address first, so Back lands on it; then the
   *  intent is armed and the pull page opens. Only this press starts a pull there. */
  const pull = () => {
    if (!offer || offer.kind === "not-tiktok") return;
    if (gridHref !== href) writeAddress(gridHref, setWritten);
    armPull(offer.input);
    router.push(pullHref(offer.input));
  };

  const tools = filters ? (
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
        countOf={(choice) => gridOf(hub.videos, { ...shownView, ...choice }, niches).length}
        onApply={applyFilter}
        returnFocus={() => filterOpener.current}
      />
      <OrderMenu order={view.order} onOrder={(order) => write({ ...shownView, order })} />
    </>
  ) : undefined;

  return (
    <DiscoverScreen
      tab={view.tab}
      onTab={onTab}
      query={query}
      onQuery={onQuery}
      onFilter={filters ? openFilter : undefined}
      filterOpen={filterOpen}
      state="ready"
      tools={tools}
      fieldRef={fieldRef}
      headingRef={headingRef}
      opener={<MenuButton variant="picture" />}
    >
      {onVideos && (
        <VideosPanel
          state={failures.corpus ? "failed" : "ready"}
          videos={videos}
          shown={shown}
          onMore={() => setPaging({ href: gridHref, shown: shown + PAGE_SIZE })}
          countLine={countLine}
          filtered={filtered}
          onClearFilter={() => {
            write({ ...shownView, niche: null, platform: null });
            // Clear goes with the filter it clears: the focus goes to the search, not to the page.
            fieldRef.current?.focus();
          }}
          orderWord={DISCOVER_STRINGS.orders[view.order]}
          empty={empty}
          onClearSearch={clearSearch}
          onRetry={retry}
          onOpen={openCard}
          offer={offer && <PullOffer target={offer} onPull={pull} className="mt-3" />}
        />
      )}
      {view.tab === "collections" && (
        <CollectionsPanel state={failures.corpus ? "failed" : "ready"} shelves={shelves} searching={typed !== ""} onRetry={retry} />
      )}
      {view.tab === "watchlist" && (
        <WatchlistNext
          watchlist={watchlist}
          failed={failures.watchlist}
          query={typed}
          libraryCount={failures.corpus ? null : hub.videos.length}
          onVideos={openLibrary}
        />
      )}
    </DiscoverScreen>
  );
}

/** The route's loading file under the new look: the screen's own outline, nothing sent. The opener
 *  is drawn here too, so the heading does not move when the page lands. */
export function DiscoverNextLoading(): React.JSX.Element {
  return <DiscoverScreen tab="videos" onTab={noop} query="" onQuery={noop} state="loading" opener={<MenuButton variant="picture" />} />;
}
