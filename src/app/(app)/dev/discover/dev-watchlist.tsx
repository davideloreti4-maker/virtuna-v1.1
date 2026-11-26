"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DiscoverScreen } from "@/components/discover-next/discover-screen";
import { FollowSheet, type FollowStatus } from "@/components/discover-next/follow-sheet";
import { WatchlistPanel } from "@/components/discover-next/watchlist-panel";
import type { WatchlistSource } from "@/lib/discover/watchlist-reads";
import { discoverSearchText } from "@/lib/discover-next/discover-view";
import { filterRows, rowKey } from "@/lib/discover-next/watchlist";

import { BROKEN_COVER, DEV_VIDEOS } from "./fixtures";

/**
 * The Watchlist chip on local state, for /dev/discover (`page.tsx`): the real screen, panel, rows, row
 * menus and Follow sheet over made-up creators. Nothing here sends anything: the search narrows the
 * rows, Remove takes a row off here, Follow shows "Reading @handle" for a moment and closes, and Pull
 * does nothing. @nia.cooks carries a profile, so its row is a link to the creator's page (the real
 * route, not a fixture). The other chips are on `?state=videos` and `?state=collections`.
 */

/** The states the page can open in (`page.tsx` checks the name). */
export type DevWatchlistState = "watchlist" | "watchlist-empty" | "watchlist-error";

const noop = () => {};

/** A made-up picture: a coloured disc with a face, drawn here, so the page loads nothing. */
function picture(ground: string, skin: string, hair: string): string {
  return (
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">` +
        `<rect width="80" height="80" fill="${ground}"/>` +
        `<path d="M10 80c2-18 14-28 30-28s28 10 30 28z" fill="#3b3b44"/>` +
        `<ellipse cx="40" cy="36" rx="15" ry="18" fill="${skin}"/>` +
        `<path d="M24 36c-3-18 6-26 16-26s20 8 16 26c-2-8-6-14-16-15c-10 1-14 7-16 15z" fill="${hair}"/>` +
        `</svg>`,
    )
  );
}

const coversOf = (handle: string) => DEV_VIDEOS.filter((v) => v.handle === handle && v.coverUrl).map((v) => v.coverUrl!);

function row(over: Partial<WatchlistSource> & Pick<WatchlistSource, "key" | "handle">): WatchlistSource {
  return {
    name: over.handle,
    avatarUrl: null,
    followerCount: null,
    outlierCount: 0,
    bestMultiplier: null,
    videosHeld: 0,
    newestPostAt: null,
    mergedFrom: null,
    held: false,
    profileHandle: null,
    trackedIds: [],
    competitorId: null,
    covers: [],
    provenCount: 0,
    ...over,
  };
}

const SOURCES: WatchlistSource[] = [
  row({
    key: "p-jay",
    handle: "jay.makes",
    name: "Jay Makes",
    avatarUrl: picture("#e3b448", "#c48e6a", "#2c211b"),
    followerCount: 162_000_000,
    provenCount: 12,
    trackedIds: ["t-jay"],
    competitorId: "p-jay",
    covers: coversOf("jay.makes"),
  }),
  row({
    key: "p-nia",
    handle: "nia.cooks",
    name: "Nia in the kitchen",
    avatarUrl: picture("#9fc3d9", "#8d5a3b", "#1d1410"),
    followerCount: 86_000_000,
    provenCount: 13,
    profileHandle: "nia.cooks",
    competitorId: "p-nia",
    covers: coversOf("nia.cooks"),
  }),
  row({
    key: "p-dev",
    handle: "dev.lifts",
    followerCount: 15_400_000,
    trackedIds: ["t-dev"],
    covers: [BROKEN_COVER, ...coversOf("dev.lifts")],
  }),
  row({ key: "mo.laughs", handle: "mo.laughs", avatarUrl: BROKEN_COVER, followerCount: 5_000_000, trackedIds: ["t-mo"] }),
  row({ key: "p-ari", handle: "ari.codes", held: true, trackedIds: ["t-ari"] }),
];

/** How long the made-up Follow "reads" before it closes. */
const READING_MS = 1500;

export function DevWatchlist({ state }: { state: DevWatchlistState }) {
  const [sources, setSources] = useState<WatchlistSource[]>(state === "watchlist" ? SOURCES : []);
  const [query, setQuery] = useState("");
  const [followOpen, setFollowOpen] = useState(false);
  const [status, setStatus] = useState<FollowStatus>(null);
  const opener = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const typed = discoverSearchText(query);
  const rows = useMemo(() => filterRows(sources, typed), [sources, typed]);

  return (
    <DiscoverScreen tab="watchlist" onTab={noop} query={query} onQuery={setQuery} state="ready">
      <WatchlistPanel
        state={state === "watchlist-error" ? "failed" : "ready"}
        rows={rows}
        total={sources.length}
        searching={typed !== ""}
        libraryCount={DEV_VIDEOS.length}
        onVideos={noop}
        onFollow={(from) => {
          opener.current = from;
          setStatus(null);
          setFollowOpen(true);
        }}
        onPull={noop}
        onRemove={(source) => setSources((now) => now.filter((s) => rowKey(s) !== rowKey(source)))}
        onRetry={noop}
      />
      <FollowSheet
        open={followOpen}
        onOpenChange={(next) => {
          setFollowOpen(next);
          if (!next) setStatus(null);
        }}
        status={status}
        onFollow={(handle) => {
          setStatus({ kind: "reading", handle });
          timer.current = setTimeout(() => {
            setStatus(null);
            setFollowOpen(false);
          }, READING_MS);
        }}
        returnFocus={() => opener.current}
      />
    </DiscoverScreen>
  );
}
