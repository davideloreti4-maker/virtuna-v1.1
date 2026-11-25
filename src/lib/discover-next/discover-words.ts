/**
 * Discover's words: every
 * fixed string on its screens, and the sentences that count or name something. The screens take
 * their words from here and from the rules' own word functions (`card.ts`, `video-words.ts`,
 * `niches.ts`); a test holds all of them to the words never on screen (outlier, teardown, source,
 * channel, scrape, track, usual, thread, Test). Pure.
 */

import { viewsLabel } from "@/lib/multiple-words";

import { PULL_PRICE, REMIX_PRICE, creditsWords } from "./remix";
import { PLATFORM_NAMES } from "./video-words";

/** Words written in more than one place, each written once. */
const BIGGEST_JUMP = "Biggest jump";
const FOLLOW_A_CREATOR = "Follow a creator";
const FOLLOW = "Follow";
const TRY_AGAIN = "Try again";
const BACK_TO_DISCOVER = "Back to Discover";

export const DISCOVER_STRINGS = {
  hub: {
    title: "Discover",
    description: "Proven videos to make your own.",
    searchPlaceholder: "Search videos, or paste a @handle",
    searchName: "Search",
    clearSearch: "Clear search",
    filter: "Filter",
  },
  tabs: { videos: "Videos", collections: "Collections", watchlist: "Watchlist" },
  videos: {
    clear: "Clear",
    showMore: "Show more",
    noMatch: "No video matches that.",
    failed: "Couldn't load the videos.",
    tryAgain: TRY_AGAIN,
  },
  orders: { views: "Most viewed", jump: BIGGEST_JUMP, newest: "Newest" },
  filter: { title: "Filter", niche: "Niche", platform: "Platform", order: "Order", all: "All" },
  platforms: PLATFORM_NAMES,
  video: {
    title: "Video",
    shaky: "A small account makes this number shaky.",
    save: "Save",
    saveFailed: "Couldn't save this video.",
    removeFailed: "Couldn't remove this video.",
    newTab: ", opens in a new tab",
    why: "Why it works",
    more: "More",
    built: "How it's built",
    remix: `Remix this · ${creditsWords(REMIX_PRICE)}`,
    // In the main button's place on a video Remix does not work on (the engine reads TikTok links only).
    remixLimit: "Remix works with TikTok videos for now.",
    gone: "This video isn't in the library any more.",
    back: BACK_TO_DISCOVER,
    failed: "Couldn't load this video.",
    tryAgain: TRY_AGAIN,
  },
  remixSheet: { title: "What do you want to make from this?", button: "Remix" },
  shelves: {
    formats: "Formats",
    visual_hooks: "Visual hooks",
    editing_styles: "Editing styles",
    signature_series: "Signature series",
  },
  collections: {
    noMatch: "No collection matches that.",
    /** A collection's page before (or without) its name: loading, gone, failed. */
    title: "Collection",
    gone: "This collection isn't in the library any more.",
    back: BACK_TO_DISCOVER,
    failed: "Couldn't load this collection.",
    tryAgain: TRY_AGAIN,
  },
  watchlist: {
    held: "Couldn't be read",
    pull: `Pull their best videos · ${creditsWords(PULL_PRICE)}`,
    openOnTikTok: "Open on TikTok",
    remove: "Remove",
    cancel: "Cancel",
    followRow: FOLLOW_A_CREATOR,
    followRowLine: "Paste a @handle",
    empty: "Nobody on your watchlist yet",
    follow: FOLLOW_A_CREATOR,
    noMatch: "No creator matches that.",
    failed: "Couldn't load the watchlist.",
    tryAgain: TRY_AGAIN,
  },
  follow: {
    title: FOLLOW_A_CREATOR,
    fieldName: "TikTok @handle",
    placeholder: "@handle or link",
    button: FOLLOW,
    badInput: "Paste a TikTok @handle or link.",
  },
  pull: {
    button: "Pull",
    notTikTok: "Only TikTok can be read right now.",
    follow: FOLLOW,
    following: "Following",
    order: BIGGEST_JUMP,
    tryAgain: TRY_AGAIN,
  },
} as const;

/** A count as written: "372", "1,200". */
const count = (n: number): string => n.toLocaleString("en-US");

/** "1 video", "15 videos" (any noun). */
const counted = (n: number, one: string, many: string): string => `${count(n)} ${n === 1 ? one : many}`;

/** A handle written once with its "@". */
const at = (handle: string): string => `@${handle.trim().replace(/^@+/, "")}`;

/** "372 proven videos", "1 proven video". */
export function provenVideos(n: number): string {
  return counted(n, "proven video", "proven videos");
}

/** "15 videos", "1 video". */
export function videosCount(n: number): string {
  return counted(n, "video", "videos");
}

/** The count line with a filter on: "Comedy · 85 videos", "Comedy · TikTok · 40 videos". */
export function filterLine(names: readonly string[], n: number): string {
  return [...names, videosCount(n)].join(" · ");
}

/** The filter's button: "Show 85 videos", "Show 1 video". */
export function showVideos(n: number): string {
  return `Show ${videosCount(n)}`;
}

/** A shelf's link: "See all 22". */
export function seeAll(n: number): string {
  return `See all ${count(n)}`;
}

/** Under the pull row, a @handle with no video in the library. */
export function nothingFromHandle(handle: string): string {
  return `Nothing from ${at(handle)} in the library yet.`;
}

/** A watched creator's followers: "162M followers". */
export function followers(n: number): string {
  return `${viewsLabel(n)} ${n === 1 ? "follower" : "followers"}`;
}

/** A watched creator's measured videos at 3× or more: "12 proven". */
export function provenTally(n: number): string {
  return `${count(n)} proven`;
}

/** The empty watchlist's quiet button: "372 proven videos are in the library". */
export function libraryHolds(n: number): string {
  return `${provenVideos(n)} ${n === 1 ? "is" : "are"} in the library`;
}

/** The Remove step's question. */
export function removeQuestion(handle: string): string {
  return `Remove ${at(handle)}?`;
}

/** The toast when a remove is refused. */
export function removeRefused(handle: string): string {
  return `Couldn't remove ${at(handle)}.`;
}

/** The Follow sheet while Maven reads the account. */
export function readingHandle(handle: string): string {
  return `Reading ${at(handle)}`;
}

/** The toast once followed. */
export function followingToast(handle: string): string {
  return `Following ${at(handle)}`;
}

/** The Follow sheet's failure. */
export function followFailed(handle: string): string {
  return `Couldn't follow ${at(handle)}. Check the handle and try again.`;
}

/** The Follow sheet when the account was read but the follow itself was refused: the handle was fine. */
export function followNotSaved(handle: string): string {
  return `Couldn't follow ${at(handle)}. Try again.`;
}

/** The toast when the pull page's Follow is refused. */
export function followRefused(handle: string): string {
  return `Couldn't follow ${at(handle)}.`;
}

/** What a pull reads: a creator (`shown` is "@handle") or words (`shown` is the trimmed words). */
export interface PullTopic {
  kind: "handle" | "words";
  shown: string;
}

const about = (topic: PullTopic): string => `about “${topic.shown}”`;

/** The offer's title: "Pull @jay.makes's best videos", "Pull videos about “meal prep”". */
export function pullTitle(topic: PullTopic): string {
  return topic.kind === "handle" ? `Pull ${at(topic.shown)}'s best videos` : `Pull videos ${about(topic)}`;
}

/** The offer's line, the price said before the tap. */
export function pullLine(topic: PullTopic): string {
  const price = creditsWords(PULL_PRICE);
  return topic.kind === "handle" ? `Ranked against their own average. ${price}.` : price;
}

/** While a pull runs. No count, no percent. */
export function pullRunning(topic: PullTopic): string {
  const what = topic.kind === "handle" ? `${at(topic.shown)}'s videos` : `videos ${about(topic)}`;
  return `Reading ${what}. This can take a few minutes.`;
}

/** A pull that found nothing. */
export function pullNone(topic: PullTopic): string {
  return topic.kind === "handle" ? `No standout videos for ${at(topic.shown)}.` : `No standout videos ${about(topic)}.`;
}

/** A pull that failed (with Try again). */
export function pullFailed(topic: PullTopic): string {
  return topic.kind === "handle" ? `Couldn't read ${at(topic.shown)}.` : `Couldn't read videos ${about(topic)}.`;
}

/** The daily limit, with the number from the answer's `limit`. */
export function pullLimit(limit: number): string {
  return `You've pulled ${counted(limit, "time", "times")} today. Try again tomorrow.`;
}

/** A pull's result: "30 videos read". */
export function videosRead(n: number): string {
  return `${videosCount(n)} read`;
}

const shownCount = (n: number | null | undefined): number | null => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null);

/** The pulled sheet's numbers: "18.4M views · 1.2M likes · 3.4K comments"; a missing one is left out; none: null. */
export function pulledNumbers({ views, likes, comments }: { views?: number | null; likes?: number | null; comments?: number | null }): string | null {
  const parts = (
    [
      [views, "view", "views"],
      [likes, "like", "likes"],
      [comments, "comment", "comments"],
    ] as const
  )
    .map(([value, one, many]) => {
      const n = shownCount(value);
      return n === null ? null : `${viewsLabel(n)} ${n === 1 ? one : many}`;
    })
    .filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}
