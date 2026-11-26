/**
 * The hub's data: the corpus read (`getDiscoverCorpus`) cut to
 * what the new Discover's cards, search and collections need, so the page hands the client nothing
 * it does not draw.
 *
 * Types only from `corpus-reads` (`import type`): that module reads with the service client, and no
 * server module may enter a client bundle through this one. Pure.
 */

import type { CollectionCategory, CorpusVideo, DiscoverCorpus } from "@/lib/discover/corpus-reads";

/** One library video as a card draws it and a search reads it. */
export interface CardVideo {
  id: string;
  coverUrl: string | null;
  /** Stored without "@". */
  handle: string | null;
  spokenHook: string | null;
  /** Raw, as stored (`nicheKeyOf` reads it). */
  niche: string | null;
  /** "tiktok" | "instagram" | "youtube" | other. */
  platform: string | null;
  views: number;
  postedAt: string | null;
  /** Clamped at 100 by the read (`corpus-reads.ts`, `toCorpusVideo`). */
  multiplier: number | null;
  baselineLabel: string | null;
  /** Baselined and 3× or more (`isProofGrade`). */
  proven: boolean;
  /**
   * Set by a creator's page and a pull only (each video measured against its own creator's usual):
   * baselined, 1.5× or more, and not proven. Its card and sheet show the multiple without the ▲, which stays
   * the mark of a proven video. The library's reads never set it.
   */
  beat?: boolean;
  /** The raw multiplier is 100 or more: a small account makes the number shaky. */
  extreme: boolean;
  /** The names of the "formats" collections that hold it (search only). */
  formats: string[];
  /** The line is the post's caption (a video pulled live has no spoken line): shown as written. */
  captioned?: boolean;
}

/** One collection as its card draws it. */
export interface CollectionCard {
  slug: string;
  name: string;
  category: CollectionCategory;
  count: number;
  /** At most three. */
  covers: string[];
}

export interface HubData {
  /** The feed: proven only, in feed order. */
  videos: CardVideo[];
  collections: CollectionCard[];
}

/** What a failed read degrades to: nothing, never a partial library. */
export const EMPTY_HUB: HubData = { videos: [], collections: [] };

/** The covers a collection's card draws. */
const COLLECTION_COVERS = 3;

/** A corpus video as a card. */
export function toCardVideo(video: CorpusVideo, formats: readonly string[] = []): CardVideo {
  return {
    id: video.id,
    coverUrl: video.coverUrl,
    handle: video.handle,
    spokenHook: video.spokenHook,
    niche: video.niche,
    platform: video.platform,
    views: video.views,
    postedAt: video.postedAt,
    multiplier: video.multiplier,
    baselineLabel: video.baselineLabel,
    proven: video.proven,
    extreme: video.extreme,
    formats: [...formats],
  };
}

/** The format names per video id, in the collections' order, each name once. */
function formatsById(corpus: DiscoverCorpus): Map<string, string[]> {
  const byId = new Map<string, string[]>();
  for (const collection of corpus.collections) {
    if (collection.category !== "formats") continue;
    for (const id of collection.itemIds) {
      const names = byId.get(id) ?? [];
      if (!names.includes(collection.name)) names.push(collection.name);
      byId.set(id, names);
    }
  }
  return byId;
}

/** The hub's data: the feed's videos in feed order (a feed id with no proven video is dropped, a
 *  repeated one kept once, in its first place), and every collection. */
export function hubDataOf(corpus: DiscoverCorpus): HubData {
  const formats = formatsById(corpus);
  const videos: CardVideo[] = [];
  const listed = new Set<string>();
  for (const id of corpus.feedIds) {
    if (listed.has(id)) continue;
    const video = Object.prototype.hasOwnProperty.call(corpus.teardowns, id) ? corpus.teardowns[id] : undefined;
    if (!video?.proven) continue;
    listed.add(id);
    videos.push(toCardVideo(video, formats.get(id)));
  }
  const collections = corpus.collections.map(
    (c): CollectionCard => ({
      slug: c.slug,
      name: c.name,
      category: c.category,
      count: c.itemIds.length,
      covers: c.coverUrls.slice(0, COLLECTION_COVERS),
    }),
  );
  return { videos, collections };
}
