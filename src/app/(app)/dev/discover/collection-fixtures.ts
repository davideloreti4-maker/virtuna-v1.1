import type { CollectionPage } from "@/lib/discover-next/collections";
import type { CardVideo, CollectionCard } from "@/lib/discover-next/hub-data";

import { BROKEN_COVER, DEV_VIDEOS } from "./fixtures";

/**
 * Made-up collections for /dev/discover, on the made-up videos of `fixtures.ts`: six formats (so the
 * shelf shows four and See all), five visual hooks, three editing styles, two series. One slug sits on
 * two shelves (as one does in the library), one card has a single cover, one has none, and one cover
 * does not load. Nothing here loads from the network.
 */

/** The covers of the made-up videos at these places. */
const coversOf = (...at: number[]): string[] => at.map((i) => DEV_VIDEOS[i]?.coverUrl).filter((url): url is string => Boolean(url));

const card = (slug: string, name: string, category: CollectionCard["category"], count: number, covers: string[]): CollectionCard => ({
  slug,
  name,
  category,
  count,
  covers,
});

/** In no order: the chip puts each on its shelf and in its order. */
export const DEV_COLLECTIONS: CollectionCard[] = [
  card("weekly-recap", "Weekly recap", "signature_series", 4, coversOf(20, 21, 22)),
  card("ranking-rating-tier-list", "Ranking/Rating/Tier List", "formats", 26, coversOf(11, 0, 3)),
  card("skit-humor", "Skit/Humor", "formats", 10, coversOf(4, 9, 25)),
  card("jump-cuts", "Jump cuts", "editing_styles", 12, coversOf(2, 8, 14)),
  card("a-vs-b-comparison", "A vs B Comparison", "formats", 13, coversOf(19, 5, 1)),
  card("text-on-screen", "Text on screen", "visual_hooks", 9, coversOf(7, 10, 16)),
  card("day-in-the-life", "Day In The Life", "formats", 11, coversOf(1, 7, 23)),
  card("prop-in-hand", "Prop in hand", "visual_hooks", 8, coversOf(5, 17, 26)),
  card("challenge", "Challenge", "formats", 6, coversOf(0, 22, 15)),
  card("one-take", "One take", "editing_styles", 6, coversOf(28, 3, 12)),
  card("storytime", "Storytime", "formats", 4, coversOf(25)),
  card("big-reveal-first", "Big reveal first", "visual_hooks", 7, coversOf(14, 13, 29)),
  card("ask-me-anything", "Ask me anything", "signature_series", 2, []),
  card("mirror-talk", "Mirror talk", "visual_hooks", 5, coversOf(18, 24, 27)),
  card("split-screen", "Split screen", "editing_styles", 2, coversOf(19, 11)),
  // The same slug as the format above, on another shelf: another collection. Its first cover does not load.
  card("skit-humor", "Skit cold open", "visual_hooks", 3, [BROKEN_COVER, ...coversOf(9, 4)]),
];

/** "Ranking/Rating/Tier List" as its page shows it: 26 videos, most viewed first; two are not proven
 *  (one measured at 1.6×, one with no basis), so their cards carry no badge. */
export const DEV_COLLECTION: CollectionPage = {
  slug: "ranking-rating-tier-list",
  name: "Ranking/Rating/Tier List",
  category: "formats",
  videos: [...DEV_VIDEOS]
    .sort((a, b) => b.views - a.views)
    .slice(0, 26)
    .map((video, i): CardVideo => {
      if (i === 1) return { ...video, multiplier: 1.6, proven: false, extreme: false };
      if (i === 4) return { ...video, multiplier: null, baselineLabel: null, proven: false, extreme: false };
      return video;
    }),
};
