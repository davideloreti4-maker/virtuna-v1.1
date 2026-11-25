/**
 * Discover's view in its address:
 * `/feed?tab=collections&niche=comedy&platform=tiktok&order=jump&q=meal`, defaults left out; the old
 * `tab=outliers` reads as Videos; anything unknown reads as its default. Pure.
 */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_DISCOVER_VIEW,
  DISCOVER_PATH,
  DISCOVER_Q_MAX,
  collectionHref,
  discoverHref,
  discoverSearchText,
  discoverViewOf,
  pullHref,
  videoHref,
  type DiscoverView,
} from "../discover-view";

const paramsOf = (href: string) => Object.fromEntries(new URL(href, "http://localhost").searchParams);

describe("the defaults", () => {
  it("are Videos, no niche, no platform, Most viewed, no search", () => {
    expect(DEFAULT_DISCOVER_VIEW).toEqual({ tab: "videos", niche: null, platform: null, order: "views", q: "" });
    expect(discoverViewOf({})).toEqual(DEFAULT_DISCOVER_VIEW);
    expect(discoverViewOf(undefined)).toEqual(DEFAULT_DISCOVER_VIEW);
  });

  it("the default view is the bare address", () => {
    expect(DISCOVER_PATH).toBe("/feed");
    expect(discoverHref(DEFAULT_DISCOVER_VIEW)).toBe("/feed");
  });
});

describe("discoverViewOf", () => {
  it.each(["videos", "collections", "watchlist"] as const)("reads the tab %s", (tab) => {
    expect(discoverViewOf({ tab }).tab).toBe(tab);
  });

  it("the old tab=outliers reads as Videos", () => {
    expect(discoverViewOf({ tab: "outliers" }).tab).toBe("videos");
  });

  it.each(["", "Videos", "saved", "constructor", "__proto__"])("an unknown tab %j reads as Videos", (tab) => {
    expect(discoverViewOf({ tab }).tab).toBe("videos");
  });

  it.each(["tiktok", "instagram", "youtube"] as const)("reads the platform %s", (platform) => {
    expect(discoverViewOf({ platform }).platform).toBe(platform);
  });

  it.each(["", "TikTok", "x", "toString"])("an unknown platform %j reads as none", (platform) => {
    expect(discoverViewOf({ platform }).platform).toBeNull();
  });

  it.each(["views", "jump", "newest"] as const)("reads the order %s", (order) => {
    expect(discoverViewOf({ order }).order).toBe(order);
  });

  it.each(["", "fit", "Newest", "hasOwnProperty"])("an unknown order %j reads as Most viewed", (order) => {
    expect(discoverViewOf({ order }).order).toBe("views");
  });

  it("reads a niche through its key: comedy-entertainment is comedy", () => {
    expect(discoverViewOf({ niche: "food" }).niche).toBe("food");
    expect(discoverViewOf({ niche: "comedy-entertainment" }).niche).toBe("comedy");
    expect(discoverViewOf({ niche: "health-fitness" }).niche).toBe("health-fitness");
  });

  it.each(["", "   ", "food!", "art design", "../x", "a".repeat(41), "<script>"])("a niche outside a-z, 0-9 and hyphens, or too long (%j), reads as none", (niche) => {
    expect(discoverViewOf({ niche }).niche).toBeNull();
  });

  it("a niche in capitals is read through its key: niche=Comedy is comedy", () => {
    expect(discoverViewOf({ niche: "Comedy" }).niche).toBe("comedy");
    expect(discoverViewOf({ niche: "Comedy-Entertainment" }).niche).toBe("comedy");
  });

  it("a niche of 40 characters is read", () => {
    expect(discoverViewOf({ niche: "a".repeat(40) }).niche).toBe("a".repeat(40));
  });

  it("reads the search, trimmed", () => {
    expect(discoverViewOf({ q: "  meal prep " }).q).toBe("meal prep");
  });

  it("a repeated parameter counts once: its first value", () => {
    expect(discoverViewOf({ tab: ["watchlist", "collections"], q: ["meal", "gym"], order: ["jump", "newest"] })).toEqual({
      ...DEFAULT_DISCOVER_VIEW,
      tab: "watchlist",
      order: "jump",
      q: "meal",
    });
  });
});

describe("the search text: at most 200 whole characters", () => {
  it("is 200", () => {
    expect(DISCOVER_Q_MAX).toBe(200);
  });

  it("trims, cuts at 200 whole characters and trims where the cut left a space", () => {
    expect(discoverSearchText("  meal  ")).toBe("meal");
    expect(discoverSearchText(`${"a".repeat(199)} b`)).toBe("a".repeat(199));
  });

  it("a 201-character search with an emoji at the cut keeps the emoji whole", () => {
    const q = `${"a".repeat(199)}😀z`; // 201 characters, 202 UTF-16 units
    expect(Array.from(q)).toHaveLength(201);
    const cut = discoverSearchText(q);
    expect(cut).toBe(`${"a".repeat(199)}😀`);
    expect(Array.from(cut)).toHaveLength(200);
    expect(discoverViewOf({ q }).q).toBe(cut);
    expect(paramsOf(discoverHref({ ...DEFAULT_DISCOVER_VIEW, q })).q).toBe(cut);
  });
});

describe("discoverHref", () => {
  it("writes the fields in order, defaults left out", () => {
    expect(discoverHref({ tab: "collections", niche: "comedy", platform: "tiktok", order: "jump", q: "meal" })).toBe(
      "/feed?tab=collections&niche=comedy&platform=tiktok&order=jump&q=meal",
    );
    expect(discoverHref({ ...DEFAULT_DISCOVER_VIEW, tab: "watchlist" })).toBe("/feed?tab=watchlist");
    expect(discoverHref({ ...DEFAULT_DISCOVER_VIEW, order: "newest" })).toBe("/feed?order=newest");
    expect(discoverHref({ ...DEFAULT_DISCOVER_VIEW, q: "meal prep & more" })).toBe("/feed?q=meal+prep+%26+more");
  });

  it("a blank search is left out", () => {
    expect(discoverHref({ ...DEFAULT_DISCOVER_VIEW, q: "   " })).toBe("/feed");
  });

  it("a niche the address cannot hold is left out", () => {
    expect(discoverHref({ ...DEFAULT_DISCOVER_VIEW, niche: "food & drink" })).toBe("/feed");
  });

  const views: DiscoverView[] = [
    { tab: "videos", niche: null, platform: null, order: "views", q: "" },
    { tab: "collections", niche: null, platform: null, order: "views", q: "" },
    { tab: "watchlist", niche: null, platform: null, order: "views", q: "" },
    { tab: "videos", niche: "comedy", platform: null, order: "views", q: "" },
    { tab: "videos", niche: null, platform: "instagram", order: "views", q: "" },
    { tab: "videos", niche: null, platform: null, order: "jump", q: "" },
    { tab: "videos", niche: null, platform: null, order: "newest", q: "" },
    { tab: "videos", niche: null, platform: null, order: "views", q: "100% real? @jay.makes" },
    { tab: "collections", niche: "self-improvement", platform: "youtube", order: "newest", q: "meal prep" },
  ];
  it.each(views)("reads back what it writes: %j", (view) => {
    expect(discoverViewOf(paramsOf(discoverHref(view)))).toEqual(view);
  });
});

describe("other addresses", () => {
  it("a video's page", () => {
    expect(videoHref("4a5b0c1d-0000-4000-8000-000000000001")).toBe("/feed/video/4a5b0c1d-0000-4000-8000-000000000001");
    expect(videoHref("a/b")).toBe("/feed/video/a%2Fb");
  });

  it("a collection's page carries its shelf (a slug is unique only within one)", () => {
    expect(collectionHref({ slug: "talking-head", category: "formats" })).toBe("/feed/collection/talking-head?shelf=formats");
    expect(collectionHref({ slug: "talking-head", category: "visual_hooks" })).toBe("/feed/collection/talking-head?shelf=visual_hooks");
  });

  it("the pull page carries the input, encoded", () => {
    expect(pullHref("@jay.makes")).toBe("/feed/discover?input=%40jay.makes");
    expect(paramsOf(pullHref("meal prep & more")).input).toBe("meal prep & more");
    expect(paramsOf(pullHref("https://www.tiktok.com/@nia.cooks?lang=en")).input).toBe("https://www.tiktok.com/@nia.cooks?lang=en");
  });
});
