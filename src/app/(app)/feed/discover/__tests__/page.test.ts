/**
 * /feed/discover and its loading file under each build of the flag. The flag is a build-time constant, so
 * each case loads the files fresh with the flag set the way that build would have it (as /feed's page
 * test does). Stand-ins: the session read, the watchlist read, and the old client screen (stubbed, so the
 * element can be read off).
 *
 * - Flag off: exactly as before: the old screen with no props, nothing signed out, the same title and
 *   description, the old skeleton; the address is not read and nothing else is.
 * - Flag on: the new pull page for what the address asks, with whether that creator is followed. An
 *   address asking nothing goes to Discover. A failed watchlist read still renders (not followed). The
 *   page itself never starts a pull (the screen's own tests prove that).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";

import type { WatchlistData, WatchlistSource } from "@/lib/discover/watchlist-reads";

vi.setConfig({ testTimeout: 60_000 });

let user: { id: string } | null = { id: "u-1" };
let watchlistRead: () => Promise<WatchlistData>;
let watchlistReads = 0;

function source(handle: string, over: Partial<WatchlistSource> = {}): WatchlistSource {
  return {
    key: `p-${handle}`,
    handle,
    name: handle,
    avatarUrl: null,
    followerCount: null,
    outlierCount: 0,
    bestMultiplier: null,
    videosHeld: 0,
    newestPostAt: null,
    mergedFrom: null,
    held: false,
    profileHandle: handle,
    ...over,
  };
}

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  vi.doMock("@/lib/supabase/server", () => ({
    createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
  }));
  vi.doMock("@/lib/discover/watchlist-reads", () => ({
    getWatchlistData: () => {
      watchlistReads += 1;
      return watchlistRead();
    },
  }));
  vi.doMock("../discover-client", () => ({ DiscoverClient: () => null }));
  const page = await import("../page");
  const loading = await import("../loading");
  const { DiscoverClient } = await import("../discover-client");
  const { PullNext, PullNextLoading } = await import("@/components/discover-next/pull-next");
  const { PageShell } = await import("@/components/surfaces/surface-header");
  return {
    Page: page.default as (props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) => Promise<unknown>,
    metadata: page.metadata,
    Loading: loading.default as () => ReactElement,
    DiscoverClient,
    PullNext,
    PullNextLoading,
    PageShell,
  };
}

const search = (params: Record<string, string | string[]> = {}) => ({ searchParams: Promise.resolve(params) });

/** What Next throws for redirect(): an error whose digest names the outcome and the address. */
async function thrown(run: () => unknown): Promise<string> {
  try {
    await run();
  } catch (error) {
    return String((error as { digest?: string }).digest ?? error);
  }
  return "nothing thrown";
}

afterEach(() => {
  user = { id: "u-1" };
  watchlistReads = 0;
  vi.restoreAllMocks();
  for (const name of ["@/lib/flags/new-look", "@/lib/supabase/server", "@/lib/discover/watchlist-reads", "../discover-client"]) vi.doUnmock(name);
  vi.resetModules();
});

describe("/feed/discover, flag off: as before", () => {
  it("renders the old screen, with no props, whatever the address asks", async () => {
    watchlistRead = async () => ({ sources: [], latest: [] });
    const { Page, DiscoverClient } = await load(false);
    const addresses: Record<string, string>[] = [{}, { input: "@jay.makes" }, { input: "" }];
    for (const params of addresses) {
      const element = (await Page(search(params))) as ReactElement;
      expect(isValidElement(element)).toBe(true);
      expect(element.type).toBe(DiscoverClient);
      expect(element.props).toEqual({});
    }
    expect(watchlistReads).toBe(0);
  });

  it("renders nothing signed out", async () => {
    user = null;
    const { Page } = await load(false);
    expect(await Page(search({ input: "@jay.makes" }))).toBeNull();
  });

  it("keeps its title and description", async () => {
    const { metadata } = await load(false);
    expect(metadata.title).toBe("Pull | Maven");
    expect(metadata.description).toBe("Surface the outliers already beating their own baseline — then Remix the winner.");
  });

  it("the loading file is the old skeleton", async () => {
    const { Loading, PageShell } = await load(false);
    expect(Loading().type).toBe(PageShell);
  });
});

describe("/feed/discover, flag on: the new pull page", () => {
  it("a @handle: the page for that creator, not followed", async () => {
    watchlistRead = async () => ({ sources: [source("nia.cooks")], latest: [] });
    const { Page, PullNext } = await load(true);
    const element = (await Page(search({ input: "@jay.makes" }))) as ReactElement;
    expect(element.type).toBe(PullNext);
    expect(element.props).toEqual({
      subject: { kind: "handle", input: "@jay.makes", handle: "jay.makes", shown: "@jay.makes" },
      followed: false,
    });
    expect(watchlistReads).toBe(1);
  });

  it("a creator on the watchlist (by its handle, or a spelling folded into a row): followed", async () => {
    watchlistRead = async () => ({ sources: [source("jay.makes")], latest: [] });
    let { Page } = await load(true);
    expect(((await Page(search({ input: "@Jay.Makes" }))) as ReactElement<{ followed: boolean }>).props.followed).toBe(true);

    watchlistRead = async () => ({ sources: [source("jay", { mergedFrom: "jay.makes" })], latest: [] });
    ({ Page } = await load(true));
    expect(((await Page(search({ input: "https://www.tiktok.com/@jay.makes" }))) as ReactElement<{ followed: boolean }>).props.followed).toBe(true);
  });

  it("a watchlist that cannot be read still renders the page: not followed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    watchlistRead = async () => {
      throw new Error("read failed");
    };
    const { Page, PullNext } = await load(true);
    const element = (await Page(search({ input: "@jay.makes" }))) as ReactElement<{ followed: boolean }>;
    expect(element.type).toBe(PullNext);
    expect(element.props.followed).toBe(false);
    expect(console.error).toHaveBeenCalledWith("[discover] watchlist read failed", expect.any(Error));
  });

  it("words: the page for them; the watchlist is not read", async () => {
    const { Page, PullNext } = await load(true);
    const element = (await Page(search({ input: " meal prep " }))) as ReactElement;
    expect(element.type).toBe(PullNext);
    expect(element.props).toEqual({ subject: { kind: "words", input: "meal prep", handle: null, shown: "meal prep" }, followed: false });
    expect(watchlistReads).toBe(0);
  });

  it("a link that is not TikTok: the page that says so", async () => {
    const { Page } = await load(true);
    const element = (await Page(search({ input: "instagram.com/jay.makes" }))) as ReactElement<{ subject: unknown }>;
    expect(element.props.subject).toEqual({ kind: "not-tiktok", input: "instagram.com/jay.makes", shown: "instagram.com/jay.makes" });
  });

  it("an input written twice: the first", async () => {
    watchlistRead = async () => ({ sources: [], latest: [] });
    const { Page } = await load(true);
    const element = (await Page(search({ input: ["@jay.makes", "@nia.cooks"] }))) as ReactElement<{ subject: { input: string } }>;
    expect(element.props.subject.input).toBe("@jay.makes");
  });

  it.each([[{}], [{ input: "" }], [{ input: "   " }], [{ input: "@" }], [{ input: "ab" }], [{ input: "a".repeat(201) }]])(
    "an address that asks nothing worth pulling goes to Discover (%j)",
    async (params) => {
      const { Page } = await load(true);
      expect(await thrown(() => Page(search(params)))).toMatch(/^NEXT_REDIRECT;[a-z]+;\/feed;/);
      expect(watchlistReads).toBe(0);
    },
  );

  it("renders nothing signed out, and reads nothing", async () => {
    user = null;
    const { Page } = await load(true);
    expect(await Page(search({ input: "@jay.makes" }))).toBeNull();
    expect(watchlistReads).toBe(0);
  });

  it("keeps its title; its description is the hub's", async () => {
    const { metadata } = await load(true);
    expect(metadata.title).toBe("Pull | Maven");
    expect(metadata.description).toBe("Proven videos to make your own.");
  });

  it("the loading file is the offer row's outline", async () => {
    const { Loading, PullNextLoading } = await load(true);
    expect(Loading().type).toBe(PullNextLoading);
  });
});
