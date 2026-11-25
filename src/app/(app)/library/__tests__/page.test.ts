/**
 * /library and its loading file under each build of the flag (plan 2026-11-23-library, Task 4). The
 * flag is a build-time constant, so each case loads the files fresh with the flag set the way that
 * build would have it (as the /dev pages' tests do). The session read is the one stand-in.
 *
 * - Flag off: exactly as before: the saved shelf in its column, the old description, the old
 *   skeleton.
 * - Flag on: the new Library, its own description, its own loading state.
 * - Signed out: nothing, either way.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Suspense, isValidElement, type ReactElement } from "react";

vi.setConfig({ testTimeout: 60_000 });

let user: { id: string } | null = { id: "u-1" };

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  vi.doMock("@/lib/supabase/server", () => ({
    createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
  }));
  const page = await import("../page");
  const loading = await import("../loading");
  const parts = {
    LibraryNext: (await import("@/components/library-next/library-next")).LibraryNext,
    LibraryNextLoading: (await import("@/components/library-next/library-next")).LibraryNextLoading,
    PageShell: (await import("@/components/surfaces/surface-header")).PageShell,
    SavedShelf: (await import("@/components/saved/saved-shelf")).SavedShelf,
    ShelfSkeleton: (await import("@/components/saved/saved-shelf")).ShelfSkeleton,
  };
  // Called as Next calls a page, with its props, though under the new look it reads none of them.
  const Page = page.default as (props: { searchParams: Promise<Params> }) => ReturnType<typeof page.default>;
  return { Page, metadata: page.metadata, Loading: loading.default, parts };
}

type Element = ReactElement<{ children?: unknown; className?: string; view?: unknown }>;
const childOf = (element: Element) => element.props.children as Element;

type Params = Record<string, string | string[] | undefined>;
const search = (params: Params = {}) => ({ searchParams: Promise.resolve(params) });

afterEach(() => {
  user = { id: "u-1" };
  vi.doUnmock("@/lib/flags/new-look");
  vi.doUnmock("@/lib/supabase/server");
  vi.resetModules();
});

describe("/library, flag off: as before", () => {
  it("renders the saved shelf in its column (the address's parameters change nothing)", async () => {
    const { Page, parts } = await load(false);
    const element = (await Page(search({ filter: "simulated", q: "meal" }))) as Element;
    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe("div");
    expect(element.props.className).toBe("relative min-h-full text-foreground");
    const shell = childOf(element);
    expect(shell.type).toBe(parts.PageShell);
    expect(childOf(shell).type).toBe(parts.SavedShelf);
  });

  it("keeps its description", async () => {
    const { metadata } = await load(false);
    expect(metadata.title).toBe("Library | Maven");
    expect(metadata.description).toBe(
      "Everything you've saved — Reads, ideas, hooks, scripts, outliers — ready to pull back into a thread.",
    );
  });

  it("loads with the shelf's own skeleton", async () => {
    const { Loading, parts } = await load(false);
    const element = Loading() as Element;
    expect(element.type).toBe("div");
    const shell = childOf(element);
    expect(shell.type).toBe(parts.PageShell);
    expect(childOf(shell).type).toBe(parts.ShelfSkeleton);
  });

  it("signed out renders nothing", async () => {
    user = null;
    const { Page } = await load(false);
    expect(await Page(search())).toBeNull();
  });
});

describe("/library, flag on: the new Library", () => {
  // Task 5 amendment A: the address is the one source of the chip and the search. The screen reads
  // it (`useSearchParams`, parsed by `libraryViewOf`, tested there and in the container's test);
  // the page hands nothing down, so nothing it read once can disagree with the address later.
  it("renders the list of chats, in a boundary whose fallback is the screen's own loading state", async () => {
    const { Page, parts } = await load(true);
    const element = (await Page(search())) as Element & { props: { fallback?: Element } };
    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(Suspense);
    expect(element.props.fallback?.type).toBe(parts.LibraryNextLoading);
    expect(childOf(element).type).toBe(parts.LibraryNext);
  });

  it("passes no view down, whatever the address carries", async () => {
    const { Page } = await load(true);
    const element = (await Page(search({ filter: "simulated", q: "meal" }))) as Element;
    expect(childOf(element).props).toEqual({});
  });

  it("describes what it now is", async () => {
    const { metadata } = await load(true);
    expect(metadata.title).toBe("Library | Maven");
    expect(metadata.description).toBe("Your chats, what is in them and how they did.");
  });

  it("loads with the screen's own loading state, not the shelf's skeleton", async () => {
    const { Loading, parts } = await load(true);
    expect((Loading() as Element).type).toBe(parts.LibraryNextLoading);
  });

  it("signed out renders nothing", async () => {
    user = null;
    const { Page } = await load(true);
    expect(await Page(search())).toBeNull();
  });
});
