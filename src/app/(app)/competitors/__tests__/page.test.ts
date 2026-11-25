/**
 * /competitors, /competitors/compare and /competitors/[handle], with their loading files, under each build
 * of the flag. The flag is a build-time constant, so each case loads the files fresh with the flag set the
 * way that build would have it (as /feed/channels' page test does). Stand-ins: the session read (and, for
 * the old creator page, its first table read, answering no row) and the new page's server read
 * (`getCreatorPage`). The route's own code is the real one.
 *
 * - Flag on: `/competitors` and `/competitors/compare` open the Watchlist chip of Discover, before anything
 *   is read. `/competitors/<handle>` is the creator's page from the read: signed out, nothing; a read that
 *   throws, the page's failure state, logged; a creator not followed, the page's own "gone" state, not a
 *   404. Its title is the handle the address names. The loading files: the page's outline under the
 *   board's and the creator's folders, nothing under the comparison's.
 * - Flag off: the three old screens as before (the board's and the comparison's titles, nothing signed out,
 *   a missing profile is the 404), the new read never called, and the old skeletons while they load.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";

import type { CreatorRead } from "@/lib/discover-next/creator";

vi.setConfig({ testTimeout: 60_000 });

let user: { id: string } | null = { id: "acct-jay" };
let sessionReads = 0;
/** The tables the old creator page asked for, in order. */
const tables: string[] = [];
/** The client handed out by the last session read: the caller's own. */
let callerClient: unknown = null;
let read: () => Promise<CreatorRead>;
const readCalls: unknown[][] = [];

function stubClient() {
  // The old creator page's first read: the profile by handle, answering no row.
  const query = {
    select: () => query,
    eq: () => query,
    single: async () => ({ data: null }),
  };
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from: (table: string) => {
      tables.push(table);
      return query;
    },
  };
}

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  vi.doMock("@/lib/supabase/server", () => ({
    createClient: async () => {
      sessionReads += 1;
      callerClient = stubClient();
      return callerClient;
    },
  }));
  vi.doMock("@/lib/discover/creator-read", () => ({
    getCreatorPage: (...args: unknown[]) => {
      readCalls.push(args);
      return read();
    },
  }));
  const parts = await import("@/components/discover-next/creator-next");
  return { parts };
}

type HandleProps = { params: Promise<{ handle: string }> };
type CompareProps = { searchParams: Promise<{ a?: string; b?: string }> };
type Metadata = { title?: unknown };

async function board(flag: boolean) {
  await load(flag);
  const page = await import("../page");
  return { Page: page.default as () => Promise<unknown>, metadata: page.metadata as Metadata };
}

async function compare(flag: boolean) {
  await load(flag);
  const page = await import("../compare/page");
  return { Page: page.default as (props: CompareProps) => Promise<unknown>, metadata: page.metadata as Metadata };
}

async function creator(flag: boolean) {
  const { parts } = await load(flag);
  const page = await import("../[handle]/page");
  return {
    parts,
    Page: page.default as (props: HandleProps) => Promise<unknown>,
    generateMetadata: page.generateMetadata as (props: HandleProps) => Promise<Metadata>,
  };
}

const at = (handle: string): HandleProps => ({ params: Promise.resolve({ handle }) });
const comparing: CompareProps = { searchParams: Promise.resolve({}) };
type Element = ReactElement<{ read?: CreatorRead }>;

/** What Next throws for redirect() and notFound(): an error whose digest names the outcome. */
async function thrown(run: () => unknown): Promise<string> {
  try {
    await run();
  } catch (error) {
    return String((error as { digest?: string }).digest ?? error);
  }
  return "nothing thrown";
}

const READY: CreatorRead = {
  state: "ready",
  creator: {
    handle: "jay.makes",
    name: "Jay Makes",
    bio: null,
    avatarUrl: null,
    held: false,
    read: "read 13 Jul",
    canReadAgain: true,
    figures: [],
    videos: [],
    audience: null,
    removal: { trackedIds: ["t-1"], competitorId: null },
  },
};

afterEach(() => {
  user = { id: "acct-jay" };
  sessionReads = 0;
  tables.length = 0;
  callerClient = null;
  readCalls.length = 0;
  vi.restoreAllMocks();
  for (const name of ["@/lib/flags/new-look", "@/lib/supabase/server", "@/lib/discover/creator-read"]) vi.doUnmock(name);
  vi.resetModules();
});

describe("/competitors", () => {
  it("flag on: the Watchlist, before anything is read", async () => {
    const { Page } = await board(true);
    expect(await thrown(() => Page())).toMatch(/^NEXT_REDIRECT;[a-z]+;\/feed\?tab=watchlist;/);
    expect(sessionReads).toBe(0);
  });

  it("flag off: signed out, nothing, and the board's title", async () => {
    user = null;
    const { Page, metadata } = await board(false);
    expect(await Page()).toBeNull();
    expect(sessionReads).toBe(1);
    expect(metadata.title).toBe("Competitors | Maven");
  });
});

describe("/competitors/compare", () => {
  it("flag on: the Watchlist, before anything is read", async () => {
    const { Page } = await compare(true);
    expect(await thrown(() => Page(comparing))).toMatch(/^NEXT_REDIRECT;[a-z]+;\/feed\?tab=watchlist;/);
    expect(sessionReads).toBe(0);
  });

  it("flag off: signed out, nothing, and the comparison's title", async () => {
    user = null;
    const { Page, metadata } = await compare(false);
    expect(await Page(comparing)).toBeNull();
    expect(sessionReads).toBe(1);
    expect(metadata.title).toBe("Compare | Competitors | Maven");
  });
});

describe("/competitors/[handle], flag on", () => {
  it("the creator's page from the read", async () => {
    read = async () => READY;
    const { Page, parts } = await creator(true);
    const element = (await Page(at("jay.makes"))) as Element;
    expect(isValidElement(element) && element.type).toBe(parts.CreatorNext);
    expect(element.props.read).toBe(READY);
    expect(readCalls).toHaveLength(1);
    const [client, handle, now] = readCalls[0] ?? [];
    expect(client).toBe(callerClient);
    expect(handle).toBe("jay.makes");
    expect(now).toBeInstanceOf(Date);
    // The old page's reads never ran.
    expect(tables).toEqual([]);
  });

  it("a creator not followed: the page's own gone state, not a 404", async () => {
    read = async () => ({ state: "gone" });
    const { Page, parts } = await creator(true);
    const element = (await Page(at("nia.cooks"))) as Element;
    expect(element.type).toBe(parts.CreatorNext);
    expect(element.props.read).toEqual({ state: "gone" });
  });

  it("a read that throws: the failure state, logged", async () => {
    const error = new Error("connection reset");
    read = async () => {
      throw error;
    };
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { Page, parts } = await creator(true);
    const element = (await Page(at("jay.makes"))) as Element;
    expect(element.type).toBe(parts.CreatorNext);
    expect(element.props.read).toEqual({ state: "failed" });
    expect(logged).toHaveBeenCalledWith("[discover] creator read failed", error);
  });

  it("signed out: nothing, nothing read (the layout and the middleware send the visitor to log in)", async () => {
    user = null;
    read = async () => READY;
    const { Page } = await creator(true);
    expect(await Page(at("jay.makes"))).toBeNull();
    expect(readCalls).toHaveLength(0);
    expect(tables).toEqual([]);
  });

  it("its title: the handle the address names, bare and lower case", async () => {
    const { generateMetadata } = await creator(true);
    expect((await generateMetadata(at("%40Jay.Makes"))).title).toBe("@jay.makes | Maven");
    expect((await generateMetadata(at("jay.makes"))).title).toBe("@jay.makes | Maven");
  });

  it("an address with no handle in it: titled Creator, as the page itself is", async () => {
    const { generateMetadata } = await creator(true);
    for (const segment of ["%40", "@", "%20", "%40%40", "%20%40%20"]) {
      expect((await generateMetadata(at(segment))).title).toBe("Creator | Maven");
    }
  });

  it("a malformed escape throws nothing: read as written", async () => {
    read = async () => ({ state: "gone" });
    const { Page, parts, generateMetadata } = await creator(true);
    expect((await generateMetadata(at("%E0%A4%A"))).title).toBe("@%e0%a4%a | Maven");
    const element = (await Page(at("%E0%A4%A"))) as Element;
    expect(element.type).toBe(parts.CreatorNext);
    expect(element.props.read).toEqual({ state: "gone" });
  });
});

describe("/competitors/[handle], flag off", () => {
  it("the old page, the new read never called: a missing profile is the 404 as before", async () => {
    read = async () => READY;
    const { Page } = await creator(false);
    expect(await thrown(() => Page(at("jay.makes")))).toMatch(/^NEXT_HTTP_ERROR_FALLBACK;404/);
    expect(tables).toEqual(["competitor_profiles"]);
    expect(readCalls).toHaveLength(0);
  });

  it("its title as before", async () => {
    const { generateMetadata } = await creator(false);
    expect((await generateMetadata(at("jay.makes"))).title).toBe("@jay.makes | Competitors | Maven");
  });
});

describe("the loading files", () => {
  async function loadings(flag: boolean) {
    const { parts } = await load(flag);
    const [handle, competitors, comparison] = await Promise.all([
      import("../[handle]/loading"),
      import("../loading"),
      import("../compare/loading"),
    ]);
    return {
      parts,
      Handle: handle.default as () => unknown,
      Competitors: competitors.default as () => unknown,
      Compare: comparison.default as () => unknown,
    };
  }

  it("flag on: the creator's page outline under [handle] and under the board's folder; nothing under compare", async () => {
    const { parts, Handle, Competitors, Compare } = await loadings(true);
    for (const Loading of [Handle, Competitors]) {
      const element = Loading() as ReactElement;
      expect(isValidElement(element) && element.type).toBe(parts.CreatorNextLoading);
    }
    expect(Compare()).toBeNull();
  });

  it("flag off: each its old skeleton", async () => {
    const { parts, Handle, Competitors, Compare } = await loadings(false);
    for (const Loading of [Handle, Competitors, Compare]) {
      const element = Loading() as ReactElement;
      expect(isValidElement(element)).toBe(true);
      expect(element.type).not.toBe(parts.CreatorNextLoading);
    }
  });
});
