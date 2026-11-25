/**
 * Collections (spec 3.4): Maven's curated collections on four shelves for the hub's Collections chip,
 * and one collection's page.
 *
 * A slug is unique only within its shelf (the table's key is the video, the shelf and the slug, and
 * one slug does repeat across shelves), so a collection is found by the pair: its page's address
 * carries the shelf (`collectionHref`). Pure; types only from `corpus-reads`, which reads with the
 * service client and must not enter a client bundle through this module.
 */

import type { CollectionCategory, DiscoverCorpus } from "@/lib/discover/corpus-reads";

import { DISCOVER_STRINGS } from "./discover-words";
import { toCardVideo, type CardVideo, type CollectionCard } from "./hub-data";

/** The shelves, in the order the chip draws them, with their names. */
export const SHELVES: ReadonlyArray<{ category: CollectionCategory; name: string }> = (
  ["formats", "visual_hooks", "editing_styles", "signature_series"] as const
).map((category) => ({ category, name: DISCOVER_STRINGS.shelves[category] }));

/** The cards a shelf shows until See all opens it. */
export const SHELF_PREVIEW = 4;

export interface Shelf {
  category: CollectionCategory;
  name: string;
  /** Most videos first, a tie by name. */
  cards: CollectionCard[];
}

const byCountThenName = (a: CollectionCard, b: CollectionCard): number =>
  b.count - a.count || a.name.localeCompare(b.name, "en") || a.slug.localeCompare(b.slug, "en");

/**
 * The chip's shelves: each kind of collection on its shelf, the shelves in `SHELVES` order, a shelf's
 * cards by how many videos each holds. A search keeps the collections whose name holds it (any case).
 * A shelf with nothing on it is left out; a kind the page does not know is not drawn.
 */
export function shelvesOf(collections: readonly CollectionCard[], q: string = ""): Shelf[] {
  const needle = q.trim().toLowerCase();
  const kept = needle ? collections.filter((c) => c.name.toLowerCase().includes(needle)) : collections;
  return SHELVES.map(({ category, name }) => ({
    category,
    name,
    cards: kept.filter((c) => c.category === category).sort(byCountThenName),
  })).filter((shelf) => shelf.cards.length > 0);
}

/** One collection's page: its name, its shelf and its videos. */
export interface CollectionPage {
  slug: string;
  name: string;
  category: CollectionCategory;
  /** In the stored order (most viewed first), proven or not: a card's badge says which. */
  videos: CardVideo[];
}

const isShelf = (value: string | null | undefined): value is CollectionCategory =>
  SHELVES.some((shelf) => shelf.category === value);

/**
 * The collection `slug` on the shelf `shelf`. With no shelf, or one the page does not know, the first
 * shelf (in `SHELVES` order) that holds the slug. A known shelf that does not hold it gives none: the
 * same slug on another shelf is another collection. None when no shelf holds it.
 */
export function collectionPageOf(corpus: DiscoverCorpus, slug: string, shelf?: string | null): CollectionPage | null {
  const holding = corpus.collections.filter((c) => c.slug === slug);
  const found = isShelf(shelf)
    ? holding.find((c) => c.category === shelf)
    : SHELVES.map(({ category }) => holding.find((c) => c.category === category)).find((c) => c !== undefined);
  if (!found) return null;
  // Each video once: the read gathers a collection's ids by shelf and name, and two slugs of one name on
  // one shelf can list a video twice.
  const videos = [...new Set(found.itemIds)].flatMap((id) => {
    const video = Object.prototype.hasOwnProperty.call(corpus.teardowns, id) ? corpus.teardowns[id] : undefined;
    return video ? [toCardVideo(video)] : [];
  });
  return { slug: found.slug, name: found.name, category: found.category, videos };
}
