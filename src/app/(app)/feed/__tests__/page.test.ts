/**
 * /feed and its loading file under each build of the flag. The flag is a build-time constant, so each
 * case loads the files fresh with the flag set the way that build would have it (as Library's page
 * test does). Stand-ins: the session read, the two reads (the corpus and the watchlist), and the old
 * hub (stubbed as `read-degradation.test.ts` does, so its props can be read off the element).
 *
 * - Flag off: exactly as before: the old hub with today's props, the old description, the old
 *   skeleton.
 * - Flag on: the new Discover, in a boundary whose fallback is its own loading state, handed the
 *   hub's data, the watchlist and which read failed. Each read is settled on its own.
 * - Signed out: nothing, either way.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Suspense, isValidElement, type ReactElement } from "react";

import type { DiscoverCorpus } from "@/lib/discover/corpus-reads";
import type { WatchlistData } from "@/lib/discover/watchlist-reads";

vi.setConfig({ testTimeout: 60_000 });

let user: { id: string } | null = { id: "u-1" };
let corpusRead: () => Promise<DiscoverCorpus>;
let watchlistRead: () => Promise<WatchlistData>;

const OLD_DESCRIPTION = "Proven outliers, curated collections, and the creators you watch — Remix any winner into a Read.";

const CORPUS: DiscoverCorpus = {
  teardowns: {
    v1: {
      id: "v1",
      videoUrl: "https://videos.example/jay.makes/1",
      coverUrl: "https://covers.example/v1.jpg",
      handle: "jay.makes",
      spokenHook: "I tried meal prep for a week",
      template: null,
      archetype: null,
      niche: "food",
      views: 1_200_000,
      platform: "tiktok",
      engagement: 0.04,
      postedAt: "2026-06-10T12:00:00Z",
      multiplier: 12,
      baselineLabel: "vs their average",
      proven: true,
      extreme: false,
    },
    v2: {
      id: "v2",
      videoUrl: null,
      coverUrl: null,
      handle: "nia.cooks",
      spokenHook: "Not proven",
      template: null,
      archetype: null,
      niche: "food",
      views: 900,
      platform: "instagram",
      engagement: null,
      postedAt: null,
      multiplier: 1.4,
      baselineLabel: "vs their average",
      proven: false,
      extreme: false,
    },
  },
  feedIds: ["v1", "v2"],
  collections: [
    {
      slug: "meal-prep",
      name: "Meal prep",
      category: "formats",
      subcategory: null,
      itemIds: ["v1"],
      provenCount: 1,
      coverUrls: ["https://covers.example/v1.jpg"],
    },
  ],
  totals: { videos: 2, proven: 1, collections: 1, creators: 2 },
};

const WATCHLIST: WatchlistData = {
  sources: [
    {
      key: "k",
      handle: "dev.lifts",
      name: "Dev Lifts",
      avatarUrl: null,
      followerCount: 10,
      outlierCount: 0,
      bestMultiplier: null,
      videosHeld: 0,
      newestPostAt: null,
      mergedFrom: null,
      held: false,
      profileHandle: "dev.lifts",
    },
  ],
  latest: [],
};

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  vi.doMock("@/lib/supabase/server", () => ({
    createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
  }));
  vi.doMock("@/lib/discover/corpus-reads", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/discover/corpus-reads")>()),
    getDiscoverCorpus: () => corpusRead(),
  }));
  vi.doMock("@/lib/discover/watchlist-reads", () => ({ getWatchlistData: () => watchlistRead() }));
  vi.doMock("@/components/discover/discover-hub", () => ({ DiscoverHub: () => null }));
  const page = await import("../page");
  const loading = await import("../loading");
  const parts = {
    DiscoverHub: (await import("@/components/discover/discover-hub")).DiscoverHub,
    DiscoverNext: (await import("@/components/discover-next/discover-next")).DiscoverNext,
    DiscoverNextLoading: (await import("@/components/discover-next/discover-next")).DiscoverNextLoading,
  };
  const { hubDataOf, EMPTY_HUB } = await import("@/lib/discover-next/hub-data");
  const Page = page.default as (props: { searchParams: Promise<Params> }) => Promise<unknown>;
  return { Page, metadata: page.metadata, Loading: loading.default as () => unknown, parts, hubDataOf, EMPTY_HUB };
}

type Params = Record<string, string | string[] | undefined>;
type Element = ReactElement<Record<string, unknown> & { children?: unknown; fallback?: unknown }>;
const search = (params: Params = {}) => ({ searchParams: Promise.resolve(params) });
const childOf = (element: Element) => element.props.children as Element;

function reset() {
  user = { id: "u-1" };
  corpusRead = async () => CORPUS;
  watchlistRead = async () => WATCHLIST;
}
reset();

afterEach(() => {
  reset();
  vi.restoreAllMocks();
  for (const name of [
    "@/lib/flags/new-look",
    "@/lib/supabase/server",
    "@/lib/discover/corpus-reads",
    "@/lib/discover/watchlist-reads",
    "@/components/discover/discover-hub",
  ]) {
    vi.doUnmock(name);
  }
  vi.resetModules();
});

describe("/feed, flag off: as before", () => {
  it("renders the old hub with today's props", async () => {
    const { Page, parts } = await load(false);
    const element = (await Page(search({ tab: "watchlist" }))) as Element;
    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(parts.DiscoverHub);
    expect(element.props.corpus).toBe(CORPUS);
    expect(element.props.watchlist).toBe(WATCHLIST);
    expect(element.props.initialTab).toBe("watchlist");
    expect(element.props.failures).toEqual({ corpus: false, watchlist: false });
    expect(element.props.refreshedLabel).toBe(
      "Newest video in the library: Jun 10. Nothing auto-refreshes yet — Pull live brings in fresh material on demand.",
    );
  });

  it("keeps its title and description", async () => {
    const { metadata } = await load(false);
    expect(metadata.title).toBe("Discover | Maven");
    expect(metadata.description).toBe(OLD_DESCRIPTION);
  });

  it("loads with the old skeleton, not the new screen's", async () => {
    const { Loading, parts } = await load(false);
    const element = Loading() as Element;
    expect(element.type).toBe("div");
    expect(element.type).not.toBe(parts.DiscoverNextLoading);
    expect(element.props.className).toBe("relative min-h-full");
  });

  it("signed out renders nothing", async () => {
    user = null;
    const { Page } = await load(false);
    expect(await Page(search())).toBeNull();
  });
});

describe("/feed, flag on: the new Discover", () => {
  it("renders the hub in a boundary whose fallback is its own loading state, with the hub's data and the watchlist", async () => {
    const { Page, parts, hubDataOf } = await load(true);
    const element = (await Page(search())) as Element;
    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(Suspense);
    expect((element.props.fallback as Element).type).toBe(parts.DiscoverNextLoading);
    const hub = childOf(element);
    expect(hub.type).toBe(parts.DiscoverNext);
    expect(hub.props).toEqual({ hub: hubDataOf(CORPUS), watchlist: { sources: WATCHLIST.sources }, failures: { corpus: false, watchlist: false } });
    // Only what the hub draws of the watchlist: its rows (the read's latest videos stay on the server).
    expect(hub.props.watchlist).not.toHaveProperty("latest");
    // Proven only: the unproven video is not handed down.
    expect((hub.props.hub as { videos: unknown[] }).videos).toHaveLength(1);
  });

  it("passes no view down, whatever the address carries (the screen reads the address itself)", async () => {
    const { Page } = await load(true);
    const hub = childOf((await Page(search({ tab: "watchlist", q: "meal" }))) as Element);
    expect(Object.keys(hub.props).sort()).toEqual(["failures", "hub", "watchlist"]);
  });

  it("a failed library read still renders: the empty hub, the watchlist, and the failure said", async () => {
    corpusRead = async () => {
      throw new Error("corpus down");
    };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { Page, EMPTY_HUB } = await load(true);
    const hub = childOf((await Page(search())) as Element);
    expect(hub.props).toEqual({ hub: EMPTY_HUB, watchlist: { sources: WATCHLIST.sources }, failures: { corpus: true, watchlist: false } });
    expect(error).toHaveBeenCalledWith("[discover] corpus read failed", expect.any(Error));
  });

  it("a failed watchlist read still renders: the library, an empty watchlist, and the failure said", async () => {
    watchlistRead = async () => {
      throw new Error("watchlist down");
    };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { Page, hubDataOf } = await load(true);
    const hub = childOf((await Page(search())) as Element);
    expect(hub.props).toEqual({ hub: hubDataOf(CORPUS), watchlist: { sources: [] }, failures: { corpus: false, watchlist: true } });
    expect(error).toHaveBeenCalledWith("[discover] watchlist read failed", expect.any(Error));
  });

  it("a watchlist read that could not see whom the creator follows counts as failed: an empty watchlist, the failure said", async () => {
    watchlistRead = async () => ({ ...WATCHLIST, incomplete: true });
    const { Page, hubDataOf } = await load(true);
    const hub = childOf((await Page(search())) as Element);
    expect(hub.props).toEqual({ hub: hubDataOf(CORPUS), watchlist: { sources: [] }, failures: { corpus: false, watchlist: true } });
  });

  it("a whole watchlist read (incomplete: false) is passed on as read", async () => {
    const whole: WatchlistData = { ...WATCHLIST, incomplete: false };
    watchlistRead = async () => whole;
    const { Page, hubDataOf } = await load(true);
    const hub = childOf((await Page(search())) as Element);
    expect(hub.props).toEqual({ hub: hubDataOf(CORPUS), watchlist: { sources: whole.sources }, failures: { corpus: false, watchlist: false } });
  });

  it("both reads failed: still the screen, both failures said", async () => {
    corpusRead = async () => {
      throw new Error("corpus down");
    };
    watchlistRead = async () => {
      throw new Error("watchlist down");
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { Page, EMPTY_HUB } = await load(true);
    const hub = childOf((await Page(search())) as Element);
    expect(hub.props).toEqual({ hub: EMPTY_HUB, watchlist: { sources: [] }, failures: { corpus: true, watchlist: true } });
  });

  it("describes what it now is, under the same title", async () => {
    const { metadata } = await load(true);
    expect(metadata.title).toBe("Discover | Maven");
    expect(metadata.description).toBe("Proven videos to make your own.");
  });

  it("loads with the screen's own loading state", async () => {
    const { Loading, parts } = await load(true);
    expect((Loading() as Element).type).toBe(parts.DiscoverNextLoading);
  });

  it("signed out renders nothing", async () => {
    user = null;
    const { Page } = await load(true);
    expect(await Page(search())).toBeNull();
  });
});
