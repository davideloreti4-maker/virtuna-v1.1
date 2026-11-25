/**
 * The hub's data from the corpus read (`hubDataOf`): the feed's
 * videos as cards in feed order, each with the names of the formats that hold it, and the
 * collections as cards. Pure; the corpus is built here as `getDiscoverCorpus` returns it.
 */
import { describe, expect, it } from "vitest";

import type { CollectionSummary, CorpusVideo, DiscoverCorpus } from "@/lib/discover/corpus-reads";

import { EMPTY_HUB, hubDataOf, toCardVideo } from "../hub-data";

function corpusVideo(id: string, over: Partial<CorpusVideo> = {}): CorpusVideo {
  return {
    id,
    videoUrl: `https://www.tiktok.com/@jay.makes/video/${id}`,
    coverUrl: `https://example.supabase.co/storage/v1/object/public/covers/${id}.jpg`,
    handle: "jay.makes",
    spokenHook: "Watch this before you cook",
    template: "Watch this before you [verb]",
    archetype: "warning",
    niche: "food",
    views: 120_000,
    platform: "tiktok",
    engagement: 0.04,
    postedAt: "2026-03-01T00:00:00Z",
    multiplier: 6,
    baselineLabel: "vs their usual views",
    proven: true,
    extreme: false,
    ...over,
  };
}

function collection(over: Partial<CollectionSummary> & Pick<CollectionSummary, "slug" | "name" | "category" | "itemIds">): CollectionSummary {
  return { subcategory: null, provenCount: 0, coverUrls: [], ...over };
}

function corpusOf(videos: CorpusVideo[], feedIds: string[], collections: CollectionSummary[] = []): DiscoverCorpus {
  return {
    teardowns: Object.fromEntries(videos.map((v) => [v.id, v])),
    feedIds,
    collections,
    totals: { videos: videos.length, proven: feedIds.length, collections: collections.length, creators: 1 },
  };
}

describe("toCardVideo", () => {
  it("keeps what a card and a search need, and nothing of the detail", () => {
    const card = toCardVideo(corpusVideo("a"), ["Talking head"]);
    expect(card).toEqual({
      id: "a",
      coverUrl: "https://example.supabase.co/storage/v1/object/public/covers/a.jpg",
      handle: "jay.makes",
      spokenHook: "Watch this before you cook",
      niche: "food",
      platform: "tiktok",
      views: 120_000,
      postedAt: "2026-03-01T00:00:00Z",
      multiplier: 6,
      baselineLabel: "vs their usual views",
      proven: true,
      extreme: false,
      formats: ["Talking head"],
    });
  });

  it("no formats given: none", () => {
    expect(toCardVideo(corpusVideo("a")).formats).toEqual([]);
  });
});

describe("hubDataOf", () => {
  it("the empty corpus is the empty hub", () => {
    expect(hubDataOf(corpusOf([], []))).toEqual({ videos: [], collections: [] });
    expect(EMPTY_HUB).toEqual({ videos: [], collections: [] });
  });

  it("keeps the feed's order and drops the videos that are not in the feed", () => {
    const videos = [corpusVideo("a"), corpusVideo("b"), corpusVideo("c", { proven: false, multiplier: 1.4 }), corpusVideo("d")];
    const hub = hubDataOf(corpusOf(videos, ["d", "a", "b"]));
    expect(hub.videos.map((v) => v.id)).toEqual(["d", "a", "b"]);
  });

  it("never lists a video twice: an id repeated in the feed is kept once, in its first place", () => {
    const videos = [corpusVideo("a"), corpusVideo("b"), corpusVideo("c")];
    const hub = hubDataOf(corpusOf(videos, ["b", "a", "b", "c", "a"]));
    expect(hub.videos.map((v) => v.id)).toEqual(["b", "a", "c"]);
  });

  it("a feed id with no video, or whose video is not proven, is dropped", () => {
    const videos = [corpusVideo("a"), corpusVideo("c", { proven: false })];
    const hub = hubDataOf(corpusOf(videos, ["gone", "c", "a"]));
    expect(hub.videos.map((v) => v.id)).toEqual(["a"]);
  });

  it("attaches the names of the formats that hold a video, in the collections' order, once each", () => {
    const videos = [corpusVideo("a"), corpusVideo("b")];
    const collections = [
      collection({ slug: "talking-head", name: "Talking head", category: "formats", itemIds: ["a", "b"] }),
      collection({ slug: "zoom-in", name: "Zoom in", category: "visual_hooks", itemIds: ["a"] }),
      collection({ slug: "list", name: "List", category: "formats", itemIds: ["a"] }),
      collection({ slug: "list-2", name: "List", category: "formats", itemIds: ["a"] }),
    ];
    const hub = hubDataOf(corpusOf(videos, ["a", "b"], collections));
    expect(hub.videos.find((v) => v.id === "a")!.formats).toEqual(["Talking head", "List"]);
    expect(hub.videos.find((v) => v.id === "b")!.formats).toEqual(["Talking head"]);
  });

  it("maps each collection: its count and at most three covers", () => {
    const collections = [
      collection({
        slug: "talking-head",
        name: "Talking head",
        category: "formats",
        itemIds: ["a", "b", "c", "d", "e"],
        coverUrls: ["https://x.supabase.co/1.jpg", "https://x.supabase.co/2.jpg", "https://x.supabase.co/3.jpg", "https://x.supabase.co/4.jpg"],
      }),
      collection({ slug: "zoom-in", name: "Zoom in", category: "visual_hooks", itemIds: ["a"], coverUrls: [] }),
    ];
    const hub = hubDataOf(corpusOf([corpusVideo("a")], ["a"], collections));
    expect(hub.collections).toEqual([
      {
        slug: "talking-head",
        name: "Talking head",
        category: "formats",
        count: 5,
        covers: ["https://x.supabase.co/1.jpg", "https://x.supabase.co/2.jpg", "https://x.supabase.co/3.jpg"],
      },
      { slug: "zoom-in", name: "Zoom in", category: "visual_hooks", count: 1, covers: [] },
    ]);
  });
});
