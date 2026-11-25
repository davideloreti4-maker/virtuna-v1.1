/** @vitest-environment happy-dom */

/**
 * The pull offer in the hub (spec 3.2 "Search", 3.6 "The offer"): a row above the Videos grid, never a
 * start. The real hub (`DiscoverNext`), its real rules and the real offer row. Stand-ins only at the
 * edges: the router, `useSearchParams` (an address store that follows the History API, as Next does),
 * `fetch` (asserted untouched), `matchMedia` and the build-time flag. Made-up creators only.
 */

import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ToastProvider } from "@/components/ui/toast";

import type { WatchlistData, WatchlistSource } from "@/lib/discover/watchlist-reads";
import type { CardVideo } from "@/lib/discover-next/hub-data";
import { armPull, takePull } from "@/lib/discover-next/pull-intent";

vi.setConfig({ testTimeout: 20_000 });

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

const router = { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() };

const nav = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let search = "";
  return {
    search: () => search,
    set(next: string) {
      if (next === search) return;
      search = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
});

vi.mock("next/navigation", async () => {
  const { useMemo, useSyncExternalStore } = await import("react");
  return {
    usePathname: () => "/feed",
    useRouter: () => router,
    useSearchParams: () => {
      const search = useSyncExternalStore(nav.subscribe, nav.search, nav.search);
      return useMemo(() => new URLSearchParams(search), [search]);
    },
  };
});

import { DiscoverNext } from "../discover-next";
import { PullNext } from "../pull-next";
import { PullOffer } from "../pull-offer";
import { forgetPulls } from "../use-pull";

const nativeReplaceState = window.history.replaceState.bind(window.history);
function setAddress(href: string) {
  nativeReplaceState(null, "", href);
  nav.set(new URL(href, "http://localhost").search);
}
const address = () => window.location.pathname + window.location.search;

// ─── Fixtures (made-up creators) ─────────────────────────────────────────────

const HANDLES = ["jay.makes", "nia.cooks", "dev.lifts"];

function video(n: number, over: Partial<CardVideo> = {}): CardVideo {
  return {
    id: `v${String(n).padStart(2, "0")}`,
    coverUrl: null,
    handle: HANDLES[n % 3]!,
    spokenHook: `Line number ${n}`,
    niche: n % 2 === 0 ? "food" : "comedy",
    platform: "tiktok",
    views: 1_000_000 - n * 10_000,
    postedAt: "2026-03-10T00:00:00Z",
    multiplier: 5,
    baselineLabel: "vs their average",
    proven: true,
    extreme: false,
    formats: [],
    ...over,
  };
}

const VIDEOS: CardVideo[] = Array.from({ length: 9 }, (_, i) => video(i + 1));

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

const NO_WATCHLIST: WatchlistData = { sources: [], latest: [] };
const OK = { corpus: false, watchlist: false };

const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}", { status: 200 }));
/** The requests a pull would send. */
const pulls = () => fetchMock.mock.calls.filter(([input]) => new URL(String(input), "http://localhost").pathname === "/api/discover");

function renderHub({
  href = "/feed",
  watchlist = NO_WATCHLIST,
  failures = OK,
}: { href?: string; watchlist?: WatchlistData; failures?: { corpus: boolean; watchlist: boolean } } = {}) {
  setAddress(href);
  return render(<DiscoverNext hub={{ videos: VIDEOS, collections: [] }} watchlist={watchlist} failures={failures} />);
}

const offer = () => document.querySelector<HTMLElement>('[data-part="pull-offer"]');
const pullButton = () => screen.queryByRole("button", { name: "Pull" });
const field = () => screen.getByRole("textbox", { name: "Search" });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  setAddress("/feed");
  vi.spyOn(window.history, "replaceState").mockImplementation((data, unused, url) => {
    nativeReplaceState(data, unused, url);
    if (url != null) nav.set(new URL(String(url), "http://localhost").search);
  });
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  for (const fn of Object.values(router)) fn.mockReset();
  takePull("");
  forgetPulls();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  takePull("");
});

// ─── The row ─────────────────────────────────────────────────────────────────

describe("the hub's pull row: a @handle", () => {
  it("a creator the library holds nothing from: the row above, then the library's sentence and Clear", () => {
    renderHub({ href: "/feed?q=%40kai.wanders" });
    const row = offer()!;
    expect(row).not.toBeNull();
    expect(within(row).getByText("Pull @kai.wanders's best videos")).toBeInTheDocument();
    expect(within(row).getByText("Ranked against their own average. 5 credits.")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Pull" })).toHaveAccessibleDescription(
      "Pull @kai.wanders's best videos Ranked against their own average. 5 credits.",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Nothing from @kai.wanders in the library yet.");
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
    // The row comes first, above the sentence.
    expect(row.compareDocumentPosition(screen.getByRole("status")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("a creator the library holds videos of: the row above their videos", () => {
    renderHub({ href: "/feed?q=%40jay.makes" });
    expect(offer()).toHaveTextContent("Pull @jay.makes's best videos");
    const grid = screen.getByRole("list", { name: "Videos" });
    expect(within(grid).getAllByRole("link")).toHaveLength(3);
    expect(offer()!.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("a TikTok profile link is its creator", () => {
    renderHub({ href: `/feed?q=${encodeURIComponent("https://www.tiktok.com/@kai.wanders")}` });
    expect(offer()).toHaveTextContent("Pull @kai.wanders's best videos");
  });

  it("a creator already on the watchlist: no row (also under the spelling that folded into a row)", () => {
    renderHub({ href: "/feed?q=%40jay.makes", watchlist: { sources: [source("jay.makes")], latest: [] } });
    expect(offer()).toBeNull();
    cleanup();
    renderHub({ href: "/feed?q=%40kai.wanders", watchlist: { sources: [source("kai", { mergedFrom: "kai.wanders" })], latest: [] } });
    expect(offer()).toBeNull();
  });

  it.each(["@", "@j", "@kai wanders"])("a handle that is empty or not one Maven can read: no row (%j)", (q) => {
    renderHub({ href: `/feed?q=${encodeURIComponent(q)}` });
    expect(offer()).toBeNull();
    expect(pullButton()).toBeNull();
  });
});

describe("the hub's pull row: words and links", () => {
  it("words the library has no video for: Pull videos about them, the price, Pull; and the library's sentence", () => {
    renderHub({ href: `/feed?q=${encodeURIComponent("underwater basket")}` });
    expect(offer()).toHaveTextContent("Pull videos about “underwater basket”");
    expect(within(offer()!).getByText("5 credits")).toBeInTheDocument();
    expect(within(offer()!).getByRole("button", { name: "Pull" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No video matches that.");
  });

  it("words the library has videos for: no row", () => {
    renderHub({ href: `/feed?q=${encodeURIComponent("line number")}` });
    expect(offer()).toBeNull();
  });

  it("words the library holds but a filter hides: no row (the library is searched whole)", () => {
    renderHub({ href: `/feed?platform=youtube&q=${encodeURIComponent("line number")}` });
    expect(screen.queryByRole("list", { name: "Videos" })).toBeNull();
    expect(offer()).toBeNull();
  });

  it("words shorter than three characters: no row", () => {
    renderHub({ href: "/feed?q=zq" });
    expect(offer()).toBeNull();
  });

  it("a link to another platform: Only TikTok, said alone, with no Pull", () => {
    renderHub({ href: `/feed?q=${encodeURIComponent("instagram.com/kai.wanders")}` });
    expect(offer()).toHaveTextContent("Only TikTok can be read right now.");
    expect(pullButton()).toBeNull();
  });

  it("answers what is typed at once, before the address has it", () => {
    renderHub();
    expect(offer()).toBeNull();
    fireEvent.change(field(), { target: { value: "@kai.wanders" } });
    expect(offer()).toHaveTextContent("Pull @kai.wanders's best videos");
    fireEvent.change(field(), { target: { value: "" } });
    expect(offer()).toBeNull();
  });

  it("is on the Videos chip only", () => {
    renderHub({ href: "/feed?tab=collections&q=%40kai.wanders" });
    expect(offer()).toBeNull();
  });

  it("not while the library cannot be read", () => {
    renderHub({ href: "/feed?q=%40kai.wanders", failures: { corpus: true, watchlist: false } });
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load the videos.");
    expect(offer()).toBeNull();
  });
});

describe("the hub's Pull", () => {
  it("arms the pull for the creator, then opens the pull page; nothing is sent from here", () => {
    renderHub({ href: "/feed?q=%40kai.wanders" });
    fireEvent.click(pullButton()!);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/feed/discover?input=%40kai.wanders");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(takePull("@kai.wanders")).toBe(true);
  });

  it("a link is pulled as its creator's @handle", () => {
    renderHub({ href: `/feed?q=${encodeURIComponent("tiktok.com/@Kai.Wanders")}` });
    fireEvent.click(pullButton()!);
    expect(router.push).toHaveBeenCalledWith("/feed/discover?input=%40kai.wanders");
    expect(takePull("@kai.wanders")).toBe(true);
  });

  it("words are pulled as they are", () => {
    renderHub({ href: `/feed?q=${encodeURIComponent("underwater basket")}` });
    fireEvent.click(pullButton()!);
    expect(router.push).toHaveBeenCalledWith("/feed/discover?input=underwater%20basket");
    expect(takePull("underwater basket")).toBe(true);
  });

  it("a search still waiting for the address is written first, so Back lands on it", () => {
    renderHub();
    fireEvent.change(field(), { target: { value: "@kai.wanders" } });
    expect(address()).toBe("/feed");
    fireEvent.click(pullButton()!);
    expect(address()).toBe("/feed?q=%40kai.wanders");
    expect(router.push).toHaveBeenCalledWith("/feed/discover?input=%40kai.wanders");
    // Nothing more is written once the wait would have run out.
    const writes = vi.mocked(window.history.replaceState).mock.calls.length;
    act(() => vi.advanceTimersByTime(300));
    expect(vi.mocked(window.history.replaceState).mock.calls.length).toBe(writes);
  });
});

describe("a press the pull page never took", () => {
  /** The pull page for `input`, as the route renders it, with the app's providers. */
  function renderPage(input: string) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <PullNext subject={{ kind: "handle", input, handle: input.slice(1), shown: input }} followed={false} />
        </ToastProvider>
      </QueryClientProvider>,
    );
  }

  it("the hub goes while the address is not that pull page (the press was left behind): the page, opened within 15 s, sends nothing", async () => {
    const hub = renderHub({ href: "/feed?q=%40kai.wanders" });
    fireEvent.click(pullButton()!);
    expect(router.push).toHaveBeenCalledWith("/feed/discover?input=%40kai.wanders");
    // The navigation never lands: the hub goes for another page.
    nativeReplaceState(null, "", "/library");
    hub.unmount();
    renderPage("@kai.wanders");
    await act(async () => {});
    expect(pulls()).toEqual([]);
    expect(screen.getByRole("button", { name: "Pull" })).toBeInTheDocument();
  });

  it("the press's own way there: the router has written the pull page's address when the hub goes, and the page sends one request", async () => {
    const hub = renderHub({ href: "/feed?q=%40kai.wanders" });
    fireEvent.click(pullButton()!);
    nativeReplaceState(null, "", "/feed/discover?input=%40kai.wanders");
    hub.unmount();
    renderPage("@kai.wanders");
    await act(async () => {});
    expect(pulls()).toHaveLength(1);
  });

  it("arriving at the hub drops an intent a press left behind (Back before the pull page came)", () => {
    armPull("@kai.wanders");
    renderHub({ href: "/feed?q=%40kai.wanders" });
    expect(takePull("@kai.wanders")).toBe(false);
  });
});

describe("a press right after a key is not undone by the search's wait", () => {
  // In Next a written address reaches the search parameters only when the navigation the press started
  // commits, and writing the same address again before then cancels that navigation. So here the
  // address store is left as it was, as Next leaves it meanwhile.
  beforeEach(() => {
    vi.mocked(window.history.replaceState).mockImplementation((data, unused, url) => nativeReplaceState(data, unused, url));
  });
  const writesOf = (href: string) => vi.mocked(window.history.replaceState).mock.calls.filter((call) => String(call[2]) === href).length;

  it("Pull: the search goes to the address once, and the wait writes nothing more", () => {
    renderHub();
    fireEvent.change(field(), { target: { value: "@kai.wanders" } });
    fireEvent.click(pullButton()!);
    act(() => vi.advanceTimersByTime(300));
    expect(writesOf("/feed?q=%40kai.wanders")).toBe(1);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("a card: the same", () => {
    // The tap's navigation is still on its way: the browser has not left the address yet.
    const stay = (e: Event) => e.preventDefault();
    document.addEventListener("click", stay, true);
    onTestFinished(() => document.removeEventListener("click", stay, true));
    renderHub();
    fireEvent.change(field(), { target: { value: "line number" } });
    fireEvent.click(within(screen.getByRole("list", { name: "Videos" })).getAllByRole("link")[0]!);
    act(() => vi.advanceTimersByTime(300));
    expect(writesOf("/feed?q=line+number")).toBe(1);
  });
});

describe("PullOffer on its own", () => {
  it("draws nothing that sends; Pull calls back", () => {
    const onPull = vi.fn();
    render(<PullOffer target={{ kind: "words", input: "meal prep", handle: null, shown: "meal prep" }} onPull={onPull} />);
    fireEvent.click(screen.getByRole("button", { name: "Pull" }));
    expect(onPull).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Pull videos about “meal prep”")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("the not-TikTok row is a status, its sentence alone", () => {
    render(<PullOffer target={{ kind: "not-tiktok", input: "x.com/kai", shown: "x.com/kai" }} />);
    expect(screen.getByRole("status")).toHaveTextContent(/^Only TikTok can be read right now\.$/);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
