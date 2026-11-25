/**
 * Collections (spec 3.4): the four shelves of the hub's Collections
 * chip, and the page of one collection, found by its slug within its shelf. Pure; the corpus is built
 * here as `getDiscoverCorpus` returns it. Every handle is made up.
 */
import { describe, expect, it } from "vitest";

import type { CollectionCategory, CollectionSummary, CorpusVideo, DiscoverCorpus } from "@/lib/discover/corpus-reads";

import { SHELF_PREVIEW, SHELVES, collectionPageOf, shelvesOf } from "../collections";
import type { CollectionCard } from "../hub-data";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function card(slug: string, category: CollectionCategory, count: number, name = slug): CollectionCard {
  return { slug, name, category, count, covers: [] };
}

function corpusVideo(id: string, over: Partial<CorpusVideo> = {}): CorpusVideo {
  return {
    id,
    videoUrl: `https://videos.example/jay.makes/${id}`,
    coverUrl: `https://covers.example/${id}.jpg`,
    handle: "jay.makes",
    spokenHook: `Line of ${id}`,
    template: null,
    archetype: null,
    niche: "food",
    views: 1_000,
    platform: "tiktok",
    engagement: 0.04,
    postedAt: "2026-03-01T00:00:00Z",
    multiplier: 6,
    baselineLabel: "vs their average",
    proven: true,
    extreme: false,
    ...over,
  };
}

function summary(slug: string, category: CollectionCategory, itemIds: string[], name = `${slug} (${category})`): CollectionSummary {
  return { slug, name, category, subcategory: null, itemIds, provenCount: 0, coverUrls: [] };
}

function corpusOf(videos: CorpusVideo[], collections: CollectionSummary[]): DiscoverCorpus {
  return {
    teardowns: Object.fromEntries(videos.map((v) => [v.id, v])),
    feedIds: videos.filter((v) => v.proven).map((v) => v.id),
    collections,
    totals: { videos: videos.length, proven: 0, collections: collections.length, creators: 1 },
  };
}

// ─── The shelves ─────────────────────────────────────────────────────────────

describe("SHELVES", () => {
  it("are the four kinds, in this order, by their names", () => {
    expect(SHELVES).toEqual([
      { category: "formats", name: "Formats" },
      { category: "visual_hooks", name: "Visual hooks" },
      { category: "editing_styles", name: "Editing styles" },
      { category: "signature_series", name: "Signature series" },
    ]);
  });

  it("a shelf shows four cards until See all", () => {
    expect(SHELF_PREVIEW).toBe(4);
  });
});

describe("shelvesOf", () => {
  const ALL: CollectionCard[] = [
    card("talking-head", "editing_styles", 9, "Talking head"),
    card("skit", "formats", 10, "Skit/Humor"),
    card("day-in-the-life", "formats", 11, "Day In The Life"),
    card("ranking", "formats", 15, "Ranking/Rating/Tier List"),
    card("a-vs-b", "formats", 13, "A vs B Comparison"),
    card("text-on-screen", "visual_hooks", 7, "Text on screen"),
    card("weekly-recap", "signature_series", 3, "Weekly recap"),
    card("jump-cut", "editing_styles", 9, "Jump cut"),
  ];

  it("puts each collection on its shelf, the shelves in their order, whatever order they arrive in", () => {
    const shelves = shelvesOf(ALL);
    expect(shelves.map((s) => [s.category, s.name])).toEqual([
      ["formats", "Formats"],
      ["visual_hooks", "Visual hooks"],
      ["editing_styles", "Editing styles"],
      ["signature_series", "Signature series"],
    ]);
  });

  it("orders a shelf by how many videos each holds, the most first", () => {
    const [formats] = shelvesOf(ALL);
    expect(formats!.cards.map((c) => c.name)).toEqual(["Ranking/Rating/Tier List", "A vs B Comparison", "Day In The Life", "Skit/Humor"]);
  });

  it("a tie goes by name", () => {
    const editing = shelvesOf(ALL).find((s) => s.category === "editing_styles")!;
    expect(editing.cards.map((c) => c.name)).toEqual(["Jump cut", "Talking head"]);
  });

  it("a name's case does not decide a tie before its letters do", () => {
    const shelf = shelvesOf([card("b", "formats", 5, "Beta"), card("a", "formats", 5, "alpha")])[0]!;
    expect(shelf.cards.map((c) => c.name)).toEqual(["alpha", "Beta"]);
  });

  it("a shelf that holds nothing is left out", () => {
    const shelves = shelvesOf([card("skit", "formats", 10), card("recap", "signature_series", 2)]);
    expect(shelves.map((s) => s.category)).toEqual(["formats", "signature_series"]);
  });

  it("no collection: no shelf", () => {
    expect(shelvesOf([])).toEqual([]);
  });

  it("a kind the page does not know is not drawn", () => {
    const odd = { ...card("odd", "formats", 4), category: "sounds" as CollectionCategory };
    expect(shelvesOf([odd, card("skit", "formats", 10)]).flatMap((s) => s.cards.map((c) => c.slug))).toEqual(["skit"]);
  });

  it("a search keeps the collections whose name holds it, any case, and leaves out a shelf it empties", () => {
    const shelves = shelvesOf(ALL, "TIER");
    expect(shelves.map((s) => s.category)).toEqual(["formats"]);
    expect(shelves[0]!.cards.map((c) => c.name)).toEqual(["Ranking/Rating/Tier List"]);
  });

  it("the search is matched inside a word, and across shelves", () => {
    const shelves = shelvesOf(ALL, "on");
    // "A vs B Comparison", "Text on screen" (not "Jump cut", not "Skit/Humor").
    expect(shelves.flatMap((s) => s.cards.map((c) => c.name))).toEqual(["A vs B Comparison", "Text on screen"]);
  });

  it("the search is trimmed; blank keeps every collection", () => {
    expect(shelvesOf(ALL, "  tier  ").flatMap((s) => s.cards.map((c) => c.slug))).toEqual(["ranking"]);
    expect(shelvesOf(ALL, "   ").flatMap((s) => s.cards)).toHaveLength(ALL.length);
  });

  it("a search no name holds: no shelf", () => {
    expect(shelvesOf(ALL, "@jay.makes")).toEqual([]);
  });

  it("leaves its input as it was", () => {
    const input = [...ALL];
    shelvesOf(input, "a");
    expect(input).toEqual(ALL);
  });
});

// ─── One collection's page ───────────────────────────────────────────────────

describe("collectionPageOf", () => {
  const videos = [
    corpusVideo("v1", { views: 9_000 }),
    corpusVideo("v2", { views: 5_000, proven: false, multiplier: 1.5 }),
    corpusVideo("v3", { views: 3_000 }),
    corpusVideo("v4", { views: 2_000 }),
  ];
  // "skit" is a slug on two shelves: two collections, told apart by the shelf.
  const corpus = corpusOf(videos, [
    summary("skit", "visual_hooks", ["v3", "v4"], "Skit cold open"),
    summary("skit", "formats", ["v1", "v2", "v3"], "Skit/Humor"),
    summary("talking-head", "editing_styles", ["v4"], "Talking head"),
  ]);

  it("finds the collection by its slug on the shelf the address names", () => {
    const page = collectionPageOf(corpus, "skit", "visual_hooks");
    expect(page).toMatchObject({ slug: "skit", name: "Skit cold open", category: "visual_hooks" });
    expect(page!.videos.map((v) => v.id)).toEqual(["v3", "v4"]);
  });

  it("a slug on two shelves: each shelf opens its own", () => {
    expect(collectionPageOf(corpus, "skit", "formats")!.name).toBe("Skit/Humor");
    expect(collectionPageOf(corpus, "skit", "visual_hooks")!.name).toBe("Skit cold open");
  });

  it("no shelf in the address: the first shelf, in the shelves' order, that holds the slug", () => {
    expect(collectionPageOf(corpus, "skit")!.category).toBe("formats");
    expect(collectionPageOf(corpus, "skit", null)!.category).toBe("formats");
    expect(collectionPageOf(corpus, "talking-head")!.name).toBe("Talking head");
  });

  it("a shelf the page does not know reads as none", () => {
    expect(collectionPageOf(corpus, "skit", "sounds")!.category).toBe("formats");
    expect(collectionPageOf(corpus, "skit", "")!.category).toBe("formats");
  });

  it("a known shelf that does not hold the slug: none (another shelf's collection of that slug is another collection)", () => {
    expect(collectionPageOf(corpus, "talking-head", "formats")).toBeNull();
  });

  it("a slug no shelf holds: none", () => {
    expect(collectionPageOf(corpus, "nope", "formats")).toBeNull();
    expect(collectionPageOf(corpus, "nope")).toBeNull();
    expect(collectionPageOf(corpus, "")).toBeNull();
  });

  it("a video listed twice in one collection is one card", () => {
    const twice = corpusOf(videos, [summary("mix", "formats", ["v1", "v3", "v1", "v3", "v4"], "Mix")]);
    expect(collectionPageOf(twice, "mix", "formats")!.videos.map((v) => v.id)).toEqual(["v1", "v3", "v4"]);
  });

  it("its videos as cards, in the stored order (most viewed first), proven or not", () => {
    const page = collectionPageOf(corpus, "skit", "formats")!;
    expect(page.videos.map((v) => v.id)).toEqual(["v1", "v2", "v3"]);
    expect(page.videos.map((v) => v.proven)).toEqual([true, false, true]);
    expect(page.videos[1]).toEqual({
      id: "v2",
      coverUrl: "https://covers.example/v2.jpg",
      handle: "jay.makes",
      spokenHook: "Line of v2",
      niche: "food",
      platform: "tiktok",
      views: 5_000,
      postedAt: "2026-03-01T00:00:00Z",
      multiplier: 1.5,
      baselineLabel: "vs their average",
      proven: false,
      extreme: false,
      formats: [],
    });
  });

  it("an id the library no longer holds is skipped", () => {
    const thin = corpusOf(videos, [summary("skit", "formats", ["v1", "gone", "v3"])]);
    expect(collectionPageOf(thin, "skit", "formats")!.videos.map((v) => v.id)).toEqual(["v1", "v3"]);
  });
});
