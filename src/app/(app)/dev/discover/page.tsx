import { notFound } from "next/navigation";

import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

import { DevCollection, type DevCollectionState } from "./dev-collection";
import { DevCreator, type DevCreatorState } from "./dev-creator";
import { DevDiscover, type DevDiscoverState } from "./dev-discover";
import { DevPull, type DevPullState } from "./dev-pull";
import { DevVideo, type DevVideoState } from "./dev-video";
import { DevWatchlist, type DevWatchlistState } from "./dev-watchlist";

/**
 * /dev/discover — the new Discover (spec 2026-11-25-discover; drawing `part-discover.png`, the
 * desktop's left half) in each state, on made-up videos and local state, inside the real shell. For
 * looking at it; nothing here sends anything. Dev-only: the /dev layout 404s it in production, and with
 * the flag off it does not exist.
 *
 *   /dev/discover?state=videos|loading|error|filtered|search|nomatch
 *   /dev/discover?state=video|video-plain|video-shaky|video-gone
 *   /dev/discover?state=collections|collection-search|collection|collection-gone
 *   /dev/discover?state=watchlist|watchlist-empty|watchlist-error
 *   /dev/discover?state=offer|offer-words|offer-link
 *   /dev/discover?state=pull-offer|pull-running|pull-done|pull-empty|pull-limit|pull-failed
 *   /dev/discover?state=creator|creator-audience|creator-fresh|creator-reading|creator-held|creator-empty|
 *                       creator-long|creator-gone|creator-failed|creator-loading|creator-sheet
 *
 * - videos (default): thirty made-up videos, 24 shown, then "Show more"
 * - loading: the grid's outline · error: the library could not be read, and Try again
 * - filtered: Comedy · TikTok, with Clear · search: "bread" typed · nomatch: a search with no match
 * - video, video-plain, video-shaky, video-gone: a video's page (`dev-video.tsx`)
 * - collections: the Collections chip, four shelves, See all · collection-search: "skit" typed there
 * - collection, collection-gone: a collection's page (`dev-collection.tsx`)
 * - watchlist, watchlist-empty, watchlist-error: the Watchlist chip (`dev-watchlist.tsx`)
 * - offer, offer-words, offer-link: the pull row above the grid, for a @handle, words, a link
 * - pull-offer … pull-failed: the pull page in each state (`dev-pull.tsx`)
 * - creator: a followed creator's page (`dev-creator.tsx`): @jay.makes read 13 Jul, four figures, Build
 *   their audience, Pull, twelve videos biggest jump first
 * - creator-audience: with an audience of theirs: Simulate a video for their viewers, built 14 Nov
 * - creator-fresh: read this morning: Read again dimmed, and why
 * - creator-reading: a read out: Read again turning, "Reading…" in the line
 * - creator-held: their read failed: Couldn't be read and its sentence, no figures, no videos
 * - creator-empty: no videos read yet
 * - creator-long: the page at its worst: a 60-character name, a five-line bio, a 24-character handle,
 *   captions from none to 200 characters
 * - creator-gone: not on the watchlist, and the way to it
 * - creator-failed: the page could not be read, and Try again
 * - creator-loading: the page's outline
 * - creator-sheet: the first video's sheet, open on arrival
 */

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

// Kept here, not imported from the client module: a server file gets a client module's values as
// references, not as the array.
const STATES: readonly DevDiscoverState[] = [
  "videos",
  "loading",
  "error",
  "filtered",
  "search",
  "nomatch",
  "collections",
  "collection-search",
  "offer",
  "offer-words",
  "offer-link",
];
const isState = (value: string): value is DevDiscoverState => (STATES as readonly string[]).includes(value);
const VIDEO_STATES: readonly DevVideoState[] = ["video", "video-plain", "video-shaky", "video-gone"];
const isVideoState = (value: string): value is DevVideoState => (VIDEO_STATES as readonly string[]).includes(value);
const COLLECTION_STATES: readonly DevCollectionState[] = ["collection", "collection-gone"];
const isCollectionState = (value: string): value is DevCollectionState => (COLLECTION_STATES as readonly string[]).includes(value);
const WATCHLIST_STATES: readonly DevWatchlistState[] = ["watchlist", "watchlist-empty", "watchlist-error"];
const isWatchlistState = (value: string): value is DevWatchlistState => (WATCHLIST_STATES as readonly string[]).includes(value);
const PULL_STATES: readonly DevPullState[] = ["pull-offer", "pull-running", "pull-done", "pull-empty", "pull-limit", "pull-failed"];
const isPullState = (value: string): value is DevPullState => (PULL_STATES as readonly string[]).includes(value);
const CREATOR_STATES: readonly DevCreatorState[] = [
  "creator",
  "creator-audience",
  "creator-fresh",
  "creator-reading",
  "creator-held",
  "creator-empty",
  "creator-long",
  "creator-gone",
  "creator-failed",
  "creator-loading",
  "creator-sheet",
];
const isCreatorState = (value: string): value is DevCreatorState => (CREATOR_STATES as readonly string[]).includes(value);

export default async function DevDiscoverPage({ searchParams }: { searchParams: Promise<Params> }) {
  // Discover's new screen exists in the new look only; with the flag off this page does not exist either.
  if (!NEW_LOOK_ENABLED) notFound();
  const state = one((await searchParams).state) ?? "videos";
  if (isVideoState(state)) return <DevVideo key={state} state={state} />;
  if (isCollectionState(state)) return <DevCollection key={state} state={state} />;
  if (isWatchlistState(state)) return <DevWatchlist key={state} state={state} />;
  if (isPullState(state)) return <DevPull key={state} state={state} />;
  if (isCreatorState(state)) return <DevCreator key={state} state={state} />;
  if (!isState(state)) notFound();
  return <DevDiscover key={state} state={state} />;
}
