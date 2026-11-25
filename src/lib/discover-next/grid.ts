/**
 * The Videos grid: search, then filter, then order, over the
 * library's proven videos. Pure; every function returns a new array and leaves its input as it was.
 */

import { classifyDiscoverInput } from "@/lib/discover/classify-input";

import { handleOf } from "./card";
import type { DiscoverOrder, DiscoverPlatform, DiscoverView } from "./discover-view";
import type { CardVideo } from "./hub-data";
import { nicheKeyOf, nicheLabel } from "./niches";

/** Cards shown at first, and added by each Show more. */
export const PAGE_SIZE = 24;

/** Everything a word of a search may be found in, lowercased. */
function searchTextOf(video: CardVideo): string {
  const key = nicheKeyOf(video.niche);
  const handle = handleOf(video.handle);
  const parts = [
    video.spokenHook ?? "",
    handle ?? "",
    handle ? `@${handle}` : "",
    video.niche ?? "",
    key ? nicheLabel(key) : "",
    ...video.formats,
  ];
  return parts.join("\n").toLowerCase();
}

/**
 * The videos a search keeps. Empty: all. A @handle or a TikTok profile link: that creator's videos
 * (the handle contains it). Otherwise every word, in any order, must be in the video's text (its
 * spoken line, its handle with and without "@", its niche as stored and by name, its formats).
 */
export function searchVideos(videos: readonly CardVideo[], q: string): CardVideo[] {
  const text = q.trim();
  if (!text) return [...videos];
  const input = classifyDiscoverInput(text);
  if (input.mode === "profile") {
    return videos.filter((v) => (handleOf(v.handle) ?? "").toLowerCase().includes(input.normalized));
  }
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  return videos.filter((v) => {
    const haystack = searchTextOf(v);
    return words.every((word) => haystack.includes(word));
  });
}

/** The videos in a niche (by its key: both comedy values) and on a platform; null is all. */
export function filterVideos(
  videos: readonly CardVideo[],
  { niche, platform }: { niche: string | null; platform: DiscoverPlatform | null },
): CardVideo[] {
  return videos.filter(
    (v) => (niche === null || nicheKeyOf(v.niche) === niche) && (platform === null || (v.platform ?? "").toLowerCase() === platform),
  );
}

const byId = (a: CardVideo, b: CardVideo): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const byViews = (a: CardVideo, b: CardVideo): number => b.views - a.views;

/** A date as a number, or null when there is none to read. */
function postedTime(video: CardVideo): number | null {
  if (!video.postedAt) return null;
  const t = Date.parse(video.postedAt);
  return Number.isFinite(t) ? t : null;
}

const COMPARE: Record<DiscoverOrder, (a: CardVideo, b: CardVideo) => number> = {
  views: (a, b) => byViews(a, b) || byId(a, b),
  // Biggest jump: a multiple past 100 says more about a small account than about the video, so those
  // come last, by views; the rest by the multiple (none last among them), then views.
  jump: (a, b) => {
    if (a.extreme !== b.extreme) return a.extreme ? 1 : -1;
    if (a.extreme) return byViews(a, b) || byId(a, b);
    const ma = a.multiplier ?? Number.NEGATIVE_INFINITY;
    const mb = b.multiplier ?? Number.NEGATIVE_INFINITY;
    return (ma === mb ? 0 : mb > ma ? 1 : -1) || byViews(a, b) || byId(a, b);
  },
  newest: (a, b) => {
    const ta = postedTime(a);
    const tb = postedTime(b);
    if (ta === null || tb === null) return (ta === null ? 1 : 0) - (tb === null ? 1 : 0) || byId(a, b);
    return tb - ta || byId(a, b);
  },
};

/** The videos in an order, as a new array. */
export function orderVideos(videos: readonly CardVideo[], order: DiscoverOrder): CardVideo[] {
  return [...videos].sort(COMPARE[order]);
}

/** The niche a view asks for, when a video has it; else none. */
export function activeNiche(niche: string | null, niches: readonly { key: string }[]): string | null {
  return niche !== null && niches.some((n) => n.key === niche) ? niche : null;
}

/** The grid of a view: search, then filter (a niche no video has reads as none), then order. */
export function gridOf(videos: readonly CardVideo[], view: DiscoverView, niches: readonly { key: string }[]): CardVideo[] {
  const found = searchVideos(videos, view.q);
  const kept = filterVideos(found, { niche: activeNiche(view.niche, niches), platform: view.platform });
  return orderVideos(kept, view.order);
}
