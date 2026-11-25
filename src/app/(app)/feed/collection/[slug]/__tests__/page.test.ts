/**
 * /feed/collection/[slug] and its loading file under each build of the flag. The flag is a build-time
 * constant, so each case loads the files fresh with the flag set the way that build would have it (as
 * the video page's test does). Stand-ins: the session read and the library's read (`getDiscoverCorpus`);
 * the rule that finds the collection is the real one.
 *
 * - Flag off: the page does not exist (404), and its loading file draws nothing.
 * - Flag on: signed out, nothing; signed in, the collection found by the slug and the shelf in the
 *   address (a slug repeats across shelves); no or an unknown shelf, the first shelf holding it. A
 *   collection that is not there is the page's own "gone" state, not a 404. A read that fails is the
 *   page's failure state, and is logged.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";

import type { CollectionSummary, CorpusVideo, DiscoverCorpus } from "@/lib/discover/corpus-reads";
import type { CollectionPage } from "@/lib/discover-next/collections";

vi.setConfig({ testTimeout: 60_000 });

function corpusVideo(id: string, views: number, proven = true): CorpusVideo {
  return {
    id,
    videoUrl: `https://videos.example/jay.makes/${id}`,
    coverUrl: `https://covers.example/${id}.jpg`,
    handle: "jay.makes",
    spokenHook: `Line of ${id}`,
    template: null,
    archetype: null,
    niche: "comedy",
    views,
    platform: "tiktok",
    engagement: 0.04,
    postedAt: "2026-03-01T00:00:00Z",
    multiplier: proven ? 8 : 1.5,
    baselineLabel: "vs their average",
    proven,
    extreme: false,
  };
}

const summary = (slug: string, category: CollectionSummary["category"], name: string, itemIds: string[]): CollectionSummary => ({
  slug,
  name,
  category,
  subcategory: null,
  itemIds,
  provenCount: 0,
  coverUrls: [],
});

const CORPUS: DiscoverCorpus = {
  teardowns: { v1: corpusVideo("v1", 9_000), v2: corpusVideo("v2", 5_000, false), v3: corpusVideo("v3", 3_000) },
  feedIds: ["v1", "v3"],
  // "skit" is a slug on two shelves: two collections.
  collections: [
    summary("skit", "visual_hooks", "Skit cold open", ["v3"]),
    summary("skit", "formats", "Skit/Humor", ["v1", "v2", "v3"]),
  ],
  totals: { videos: 3, proven: 2, collections: 2, creators: 1 },
};

let user: { id: string } | null = { id: "acct-jay" };
let read: () => Promise<DiscoverCorpus>;
let reads = 0;

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) }));
  vi.doMock("@/lib/discover/corpus-reads", () => ({
    getDiscoverCorpus: () => {
      reads += 1;
      return read();
    },
  }));
  const page = await import("../page");
  const loading = await import("../loading");
  const parts = await import("@/components/discover-next/collection-next");
  type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
  const Page = page.default as (props: Props) => Promise<unknown>;
  return { Page, metadata: page.metadata, Loading: loading.default as () => unknown, parts };
}

const at = (slug: string, query: Record<string, string | string[]> = {}) => ({
  params: Promise.resolve({ slug }),
  searchParams: Promise.resolve(query),
});
type Element = ReactElement<{ collection?: CollectionPage | null; failed?: boolean }>;

async function thrown(run: () => unknown): Promise<string> {
  try {
    await run();
  } catch (error) {
    return String((error as { digest?: string }).digest ?? error);
  }
  return "nothing thrown";
}

afterEach(() => {
  user = { id: "acct-jay" };
  reads = 0;
  vi.restoreAllMocks();
  for (const name of ["@/lib/flags/new-look", "@/lib/supabase/server", "@/lib/discover/corpus-reads"]) vi.doUnmock(name);
  vi.resetModules();
});

describe("/feed/collection/[slug] with the flag off", () => {
  it("does not exist, and reads nothing", async () => {
    read = async () => CORPUS;
    const { Page } = await load(false);
    expect(await thrown(() => Page(at("skit", { shelf: "formats" })))).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/);
    expect(reads).toBe(0);
  });

  it("its loading file draws nothing", async () => {
    const { Loading } = await load(false);
    expect(Loading()).toBeNull();
  });
});

describe("/feed/collection/[slug] with the flag on", () => {
  it("signed in: the collection the slug and the shelf name, with its videos in their stored order", async () => {
    read = async () => CORPUS;
    const { Page, parts, metadata } = await load(true);
    const element = (await Page(at("skit", { shelf: "formats" }))) as Element;
    expect(isValidElement(element) && element.type).toBe(parts.CollectionNext);
    expect(element.props.collection).toMatchObject({ slug: "skit", name: "Skit/Humor", category: "formats" });
    expect(element.props.collection!.videos.map((v) => [v.id, v.proven])).toEqual([
      ["v1", true],
      ["v2", false],
      ["v3", true],
    ]);
    expect(element.props.failed).toBeFalsy();
    expect(reads).toBe(1);
    expect(metadata.title).toBe("Collection | Maven");
  });

  it("a slug on two shelves: the shelf in the address decides", async () => {
    read = async () => CORPUS;
    const { Page } = await load(true);
    const element = (await Page(at("skit", { shelf: "visual_hooks" }))) as Element;
    expect(element.props.collection).toMatchObject({ name: "Skit cold open", category: "visual_hooks" });
  });

  it("no shelf, or one the page does not know: the first shelf holding the slug", async () => {
    read = async () => CORPUS;
    const { Page } = await load(true);
    expect(((await Page(at("skit"))) as Element).props.collection!.category).toBe("formats");
    expect(((await Page(at("skit", { shelf: "sounds" }))) as Element).props.collection!.category).toBe("formats");
    expect(((await Page(at("skit", { shelf: ["visual_hooks", "formats"] }))) as Element).props.collection!.category).toBe("visual_hooks");
  });

  it("a collection that is not there: the page's gone state, not a 404", async () => {
    read = async () => CORPUS;
    const { Page, parts } = await load(true);
    const element = (await Page(at("nope", { shelf: "formats" }))) as Element;
    expect(element.type).toBe(parts.CollectionNext);
    expect(element.props.collection).toBeNull();
    expect(element.props.failed).toBeFalsy();
  });

  it("a read that fails: the page's failure state, logged", async () => {
    const error = new Error("connection reset");
    read = async () => {
      throw error;
    };
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { Page, parts } = await load(true);
    const element = (await Page(at("skit", { shelf: "formats" }))) as Element;
    expect(element.type).toBe(parts.CollectionNext);
    expect(element.props.collection).toBeNull();
    expect(element.props.failed).toBe(true);
    expect(logged).toHaveBeenCalledWith("[discover] collection read failed", error);
  });

  it("signed out: nothing, and nothing read (the layout and the middleware send the visitor to log in)", async () => {
    user = null;
    read = async () => CORPUS;
    const { Page } = await load(true);
    expect(await Page(at("skit", { shelf: "formats" }))).toBeNull();
    expect(reads).toBe(0);
  });

  it("its loading file is the page's own outline", async () => {
    const { Loading, parts } = await load(true);
    const element = Loading() as ReactElement;
    expect(isValidElement(element) && element.type).toBe(parts.CollectionNextLoading);
  });
});
