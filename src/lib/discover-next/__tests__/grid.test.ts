/**
 * The Videos grid: search, filter, order, and the three in turn.
 * Pure; `classifyDiscoverInput` is the real one.
 */
import { describe, expect, it } from "vitest";

import { DEFAULT_DISCOVER_VIEW } from "../discover-view";
import { PAGE_SIZE, activeNiche, filterVideos, gridOf, orderVideos, searchVideos } from "../grid";
import type { CardVideo } from "../hub-data";
import { nicheOptions } from "../niches";

function card(id: string, over: Partial<CardVideo> = {}): CardVideo {
  return {
    id,
    coverUrl: null,
    handle: "jay.makes",
    spokenHook: "This changed how I cook",
    niche: "food",
    platform: "tiktok",
    views: 1_000,
    postedAt: "2026-01-01T00:00:00Z",
    multiplier: 5,
    baselineLabel: "vs their usual views",
    proven: true,
    extreme: false,
    formats: [],
    ...over,
  };
}

const ids = (videos: readonly CardVideo[]) => videos.map((v) => v.id);

describe("PAGE_SIZE", () => {
  it("is 24", () => {
    expect(PAGE_SIZE).toBe(24);
  });
});

describe("searchVideos", () => {
  const videos = [
    card("a", { spokenHook: "Meal prep for the whole week", handle: "nia.cooks", niche: "food" }),
    card("b", { spokenHook: "Stop scrolling, read this", handle: "jay.makes", niche: "comedy-entertainment", formats: ["Talking head"] }),
    card("c", { spokenHook: null, handle: "dev.lifts", niche: "health-fitness", platform: "instagram" }),
    card("d", { spokenHook: "Week one of my prep", handle: null, niche: null }),
  ];

  it("an empty search keeps all", () => {
    expect(ids(searchVideos(videos, ""))).toEqual(["a", "b", "c", "d"]);
    expect(ids(searchVideos(videos, "   "))).toEqual(["a", "b", "c", "d"]);
  });

  it("finds by the spoken line, case-insensitive", () => {
    expect(ids(searchVideos(videos, "MEAL"))).toEqual(["a"]);
  });

  it("two words in either order: every word must be in the video's text", () => {
    expect(ids(searchVideos(videos, "prep week"))).toEqual(["a", "d"]);
    expect(ids(searchVideos(videos, "week prep"))).toEqual(["a", "d"]);
    expect(ids(searchVideos(videos, "week   meal"))).toEqual(["a"]);
    expect(ids(searchVideos(videos, "week scrolling"))).toEqual([]);
  });

  it("finds by the handle, with or without its @ (a @handle is read as a profile)", () => {
    expect(ids(searchVideos(videos, "nia"))).toEqual(["a"]);
    expect(ids(searchVideos(videos, "@nia.cooks"))).toEqual(["a"]);
    expect(ids(searchVideos(videos, "@NIA"))).toEqual(["a"]);
    expect(ids(searchVideos(videos, "@nobody.here"))).toEqual([]);
  });

  it("a search of just @ keeps every video (an empty handle is in every handle)", () => {
    expect(ids(searchVideos(videos, "@"))).toEqual(["a", "b", "c", "d"]);
    expect(ids(searchVideos(videos, " @ "))).toEqual(["a", "b", "c", "d"]);
  });

  it("a TikTok profile link keeps that creator's videos", () => {
    expect(ids(searchVideos(videos, "https://www.tiktok.com/@dev.lifts?lang=en"))).toEqual(["c"]);
    expect(ids(searchVideos(videos, "tiktok.com/@jay.makes"))).toEqual(["b"]);
  });

  it("finds by the niche as stored and by its label", () => {
    expect(ids(searchVideos(videos, "comedy"))).toEqual(["b"]);
    expect(ids(searchVideos(videos, "entertainment"))).toEqual(["b"]);
    expect(ids(searchVideos(videos, "fitness"))).toEqual(["c"]);
    expect(ids(searchVideos(videos, "Food"))).toEqual(["a"]);
  });

  it("finds by a format's name", () => {
    expect(ids(searchVideos(videos, "talking head"))).toEqual(["b"]);
    expect(ids(searchVideos(videos, "head talking"))).toEqual(["b"]);
  });

  it("a link that is not TikTok is searched as words, and matches nothing here", () => {
    expect(ids(searchVideos(videos, "https://www.instagram.com/nia.cooks"))).toEqual([]);
  });

  it("keeps the order it was given", () => {
    expect(ids(searchVideos([videos[3]!, videos[0]!], "prep"))).toEqual(["d", "a"]);
  });
});

describe("filterVideos", () => {
  const videos = [
    card("a", { niche: "comedy", platform: "tiktok" }),
    card("b", { niche: "comedy-entertainment", platform: "Instagram" }),
    card("c", { niche: "food", platform: "instagram" }),
    card("d", { niche: null, platform: null }),
  ];

  it("no niche and no platform keeps all", () => {
    expect(ids(filterVideos(videos, { niche: null, platform: null }))).toEqual(["a", "b", "c", "d"]);
  });

  it("a niche by its key: both comedy values", () => {
    expect(ids(filterVideos(videos, { niche: "comedy", platform: null }))).toEqual(["a", "b"]);
    expect(ids(filterVideos(videos, { niche: "food", platform: null }))).toEqual(["c"]);
  });

  it("a platform by lowercase equality", () => {
    expect(ids(filterVideos(videos, { niche: null, platform: "instagram" }))).toEqual(["b", "c"]);
  });

  it("both at once", () => {
    expect(ids(filterVideos(videos, { niche: "comedy", platform: "instagram" }))).toEqual(["b"]);
  });
});

describe("orderVideos", () => {
  it("returns a new array and leaves the input as it was", () => {
    const input = [card("a", { views: 1 }), card("b", { views: 2 })];
    const out = orderVideos(input, "views");
    expect(out).not.toBe(input);
    expect(ids(input)).toEqual(["a", "b"]);
    expect(ids(out)).toEqual(["b", "a"]);
  });

  it("Most viewed: views desc, ties by id", () => {
    const input = [card("c", { views: 50 }), card("b", { views: 900 }), card("a", { views: 50 })];
    expect(ids(orderVideos(input, "views"))).toEqual(["b", "a", "c"]);
  });

  it("Biggest jump: the not-extreme by multiplier desc, then the extreme ones by views desc; ties by views, then id", () => {
    const input = [
      card("x1", { multiplier: 100, extreme: true, views: 10_000 }),
      card("m8", { multiplier: 8, views: 500 }),
      card("m27", { multiplier: 27, views: 100 }),
      card("x2", { multiplier: 100, extreme: true, views: 90_000 }),
      card("t2", { multiplier: 8, views: 500 }),
      card("t1", { multiplier: 8, views: 700 }),
    ];
    expect(ids(orderVideos(input, "jump"))).toEqual(["m27", "t1", "m8", "t2", "x2", "x1"]);
  });

  it("Biggest jump: a video with no multiplier comes after the measured ones, before the extreme ones", () => {
    const input = [card("x", { multiplier: 100, extreme: true }), card("n", { multiplier: null, proven: false }), card("m", { multiplier: 3 })];
    expect(ids(orderVideos(input, "jump"))).toEqual(["m", "n", "x"]);
  });

  it("Newest: posted desc, no date last, ties by id", () => {
    const input = [
      card("old", { postedAt: "2020-03-01T00:00:00Z" }),
      card("none", { postedAt: null }),
      card("bad", { postedAt: "not a date" }),
      card("new-b", { postedAt: "2026-11-01T00:00:00Z" }),
      card("new-a", { postedAt: "2026-11-01T00:00:00Z" }),
    ];
    expect(ids(orderVideos(input, "newest"))).toEqual(["new-a", "new-b", "old", "bad", "none"]);
  });
});

describe("activeNiche: the niche a view asks for, when a video has it", () => {
  const niches = [{ key: "comedy" }, { key: "food" }];
  it("a niche among the options", () => {
    expect(activeNiche("food", niches)).toBe("food");
  });
  it("a niche no video has, or none: none", () => {
    expect(activeNiche("travel", niches)).toBeNull();
    expect(activeNiche(null, niches)).toBeNull();
    expect(activeNiche("food", [])).toBeNull();
  });
});

describe("gridOf: search, then filter, then order", () => {
  const videos = [
    card("a", { niche: "comedy", spokenHook: "Meal prep but funny", views: 10, platform: "tiktok" }),
    card("b", { niche: "comedy-entertainment", spokenHook: "Meal prep fails", views: 30, platform: "instagram" }),
    card("c", { niche: "food", spokenHook: "Meal prep basics", views: 20, platform: "tiktok" }),
    card("d", { niche: "food", spokenHook: "Knife skills", views: 40, platform: "tiktok" }),
  ];
  const niches = nicheOptions(videos);

  it("the default view is every video, Most viewed", () => {
    expect(ids(gridOf(videos, DEFAULT_DISCOVER_VIEW, niches))).toEqual(["d", "b", "c", "a"]);
  });

  it("all three at once", () => {
    const view = { ...DEFAULT_DISCOVER_VIEW, q: "meal", niche: "comedy", platform: null, order: "views" as const };
    expect(ids(gridOf(videos, view, niches))).toEqual(["b", "a"]);
    expect(ids(gridOf(videos, { ...view, platform: "tiktok" }, niches))).toEqual(["a"]);
  });

  it("a niche no video has reads as none", () => {
    const view = { ...DEFAULT_DISCOVER_VIEW, niche: "travel" };
    expect(ids(gridOf(videos, view, niches))).toEqual(["d", "b", "c", "a"]);
  });

  it("a niche that has videos but none matching the search gives nothing", () => {
    const view = { ...DEFAULT_DISCOVER_VIEW, niche: "food", q: "funny" };
    expect(ids(gridOf(videos, view, niches))).toEqual([]);
  });

  it("does not sort the input in place", () => {
    const input = [...videos];
    gridOf(input, { ...DEFAULT_DISCOVER_VIEW, order: "views" }, niches);
    expect(ids(input)).toEqual(["a", "b", "c", "d"]);
  });
});
