/** @vitest-environment happy-dom */

/**
 * DiscoverNext — the hub and its Videos chip (spec 3.1, 3.2, 3.8):
 * the real screen, the real filter (sheet on a phone, menu standing on Filter from 768), the real order
 * menu, the real rules. Stand-ins only at the edges: the router, `useSearchParams` (an address store
 * that follows the History API, as Next does), `history.replaceState` (spied, so the screen's own
 * writes can be told from a navigation), `matchMedia` (phone or desk) and the build-time flag.
 */

import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ToastProvider } from "@/components/ui/toast";
import type { CardVideo, HubData } from "@/lib/discover-next/hub-data";
import type { WatchlistData } from "@/lib/discover/watchlist-reads";
import { useShellStore } from "@/stores/shell-store";

vi.setConfig({ testTimeout: 20_000 });

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

// One object, as the real App Router returns.
const router = { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() };

/** The address's parameters as Next keeps them: `useSearchParams` follows a navigation and the History API. */
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

import { DiscoverNext, DiscoverNextLoading } from "../discover-next";

/** The browser's own `replaceState`, before each test's spy wraps it. */
const nativeReplaceState = window.history.replaceState.bind(window.history);
/** The address moved without the screen: the browser's, and what `useSearchParams` reads. */
function setAddress(href: string) {
  nativeReplaceState(null, "", href);
  nav.set(new URL(href, "http://localhost").search);
}
/** A navigation the screen did not make (the Discover tab, Back, a link). */
const navigate = (href: string) => act(() => setAddress(href));
/** The screen's own writes to the address. */
const addressWrites = () => vi.mocked(window.history.replaceState).mock.calls.map((call) => String(call[2]));
const address = () => window.location.pathname + window.location.search;

// ─── Fixtures (made-up creators) ─────────────────────────────────────────────

const HANDLES = ["jay.makes", "nia.cooks", "dev.lifts"];
const NICHES = ["comedy", "comedy-entertainment", "food", "health-fitness", "tech"];
const PLATFORMS = ["tiktok", "instagram", "youtube"];

function video(n: number, over: Partial<CardVideo> = {}): CardVideo {
  return {
    id: `v${String(n).padStart(2, "0")}`,
    coverUrl: `https://covers.example/v${n}.jpg`,
    handle: HANDLES[n % 3]!,
    spokenHook: `Line number ${n}`,
    niche: NICHES[n % 5]!,
    platform: PLATFORMS[n % 3]!,
    views: 1_000_000 - n * 10_000,
    postedAt: `2026-0${1 + (n % 9)}-1${n % 10}T00:00:00Z`,
    multiplier: 3 + (n % 7),
    baselineLabel: "vs their average",
    proven: true,
    extreme: false,
    formats: [],
    ...over,
  };
}

/** Sixty videos, in feed order (newest first is the feed's own order; the hub orders by views). */
const MANY: CardVideo[] = Array.from({ length: 60 }, (_, i) => video(i + 1));
const hubOf = (videos: CardVideo[]): HubData => ({ videos, collections: [] });
const NO_WATCHLIST: WatchlistData = { sources: [], latest: [] };
const OK = { corpus: false, watchlist: false };

// ─── Rendering ───────────────────────────────────────────────────────────────

function renderHub({
  href = "/feed",
  videos = MANY,
  failures = OK,
  strict = false,
  container,
}: { href?: string; videos?: CardVideo[]; failures?: { corpus: boolean; watchlist: boolean }; strict?: boolean; container?: HTMLElement } = {}) {
  setAddress(href);
  const ui = <DiscoverNext hub={hubOf(videos)} watchlist={NO_WATCHLIST} failures={failures} />;
  return render(strict ? <StrictMode>{ui}</StrictMode> : ui, container ? { container } : undefined);
}

const grid = () => screen.getByRole("list", { name: "Videos" });
const cards = () => within(grid()).getAllByRole("link");
const cardNames = () => cards().map((card) => card.getAttribute("aria-label"));
const countLine = () => document.querySelector('[data-part="count"]')?.textContent ?? null;
const field = () => screen.getByRole("textbox", { name: "Search" });
const searchBox = () => screen.getByRole("search");
/** The desk's tools beside the chips (Filter and the order), hidden on a phone. */
const tools = () => document.querySelector<HTMLElement>('[data-part="tools"]')!;
const showMore = () => screen.queryByRole("button", { name: "Show more" });
const chip = (name: string) => within(screen.getByRole("group", { name: "Discover" })).getByRole("button", { name });
const typeInto = (text: string) => fireEvent.change(field(), { target: { value: text } });

function widthIs(view: "phone" | "desk") {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: view === "desk" && /min-width:\s*768px/.test(query),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

beforeEach(() => {
  setAddress("/feed");
  vi.spyOn(window.history, "replaceState").mockImplementation((data, unused, url) => {
    nativeReplaceState(data, unused, url);
    if (url != null) nav.set(new URL(String(url), "http://localhost").search);
  });
  widthIs("phone");
  for (const fn of Object.values(router)) fn.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── The line, the grid, Show more ───────────────────────────────────────────

describe("DiscoverNext — Videos: the line and the grid", () => {
  it("says how many proven videos there are, and the order in words", () => {
    renderHub();
    expect(screen.getByRole("heading", { level: 1, name: "Discover" })).toBeInTheDocument();
    expect(countLine()).toBe("60 proven videos");
    expect(document.querySelector('[data-part="order-word"]')).toHaveTextContent("Most viewed");
    expect(chip("Videos")).toHaveAttribute("aria-pressed", "true");
    expect(chip("Collections")).toHaveAttribute("aria-pressed", "false");
  });

  it("one proven video is said in the singular", () => {
    renderHub({ videos: [video(1)] });
    expect(countLine()).toBe("1 proven video");
  });

  it("shows 24 cards, and Show more adds 24 at a time until all are shown", () => {
    renderHub();
    expect(cards()).toHaveLength(24);
    fireEvent.click(showMore()!);
    expect(cards()).toHaveLength(48);
    fireEvent.click(showMore()!);
    expect(cards()).toHaveLength(60);
    expect(showMore()).toBeNull();
  });

  it("when the last Show more goes, the focus it held moves to the first card that tap brought", () => {
    renderHub();
    showMore()!.focus();
    fireEvent.click(showMore()!);
    // Still there (more to come): the focus stays on it.
    expect(showMore()).toHaveFocus();
    fireEvent.click(showMore()!);
    expect(showMore()).toBeNull();
    expect(cards()[48]).toHaveFocus();
  });

  it("the count line wraps rather than cut its number (a phone of 320 with a long filter)", () => {
    renderHub({ href: "/feed?niche=health-fitness&platform=instagram" });
    const line = document.querySelector('[data-part="count"]')!;
    expect(line).not.toHaveClass("truncate");
    expect(line).toHaveClass("min-w-0", "break-words");
    expect(line.parentElement).toHaveClass("items-start");
    expect(line.parentElement).not.toHaveClass("items-center");
  });

  it("a card is a link to the video's page, named by its line, else by its creator", () => {
    renderHub({
      videos: [video(1), video(2, { spokenHook: "[Product] changed my life", handle: "nia.cooks" }), video(3, { spokenHook: null, handle: null })],
    });
    const [first, second, third] = cards();
    expect(first).toHaveAttribute("href", "/feed/video/v01");
    expect(first).toHaveAccessibleName("Line number 1");
    expect(first).toHaveTextContent("Line number 1");
    expect(second).toHaveAccessibleName("Video by @nia.cooks");
    expect(second).not.toHaveTextContent("[Product]");
    expect(third).toHaveAccessibleName("Video");
  });

  it("a card carries its badge and its meta, the badge's mark hidden from screen readers", () => {
    renderHub({ videos: [video(1, { multiplier: 27, views: 39_800_000, handle: "dev.lifts" }), video(2, { extreme: true, multiplier: 100 })] });
    const [first, second] = cards();
    expect(first).toHaveTextContent("27×");
    expect(first).toHaveTextContent("@dev.lifts · 39.8M");
    expect(first).toHaveAccessibleDescription("27× @dev.lifts · 39.8M");
    expect(first!.querySelector('[data-part="badge"] svg')).toHaveAttribute("aria-hidden");
    expect(second).toHaveTextContent("100×+");
  });

  it("a cover that does not load becomes the neutral tile", () => {
    renderHub({ videos: [video(1)] });
    const img = cards()[0]!.querySelector("img")!;
    expect(img).toHaveAttribute("src", "https://covers.example/v1.jpg");
    expect(img).toHaveAttribute("alt", "");
    fireEvent.error(img);
    expect(cards()[0]!.querySelector("img")).toBeNull();
    expect(cards()[0]!.querySelector('[data-part="tile"]')).not.toBeNull();
  });

  it("a video with no cover is the neutral tile from the start", () => {
    renderHub({ videos: [video(1, { coverUrl: null })] });
    expect(cards()[0]!.querySelector("img")).toBeNull();
  });
});

describe("DiscoverNext — the orders", () => {
  const ORDERED = [
    video(1, { views: 500, multiplier: 4, postedAt: "2026-03-01T00:00:00Z" }),
    video(2, { views: 900, multiplier: 12, postedAt: "2026-01-01T00:00:00Z" }),
    video(3, { views: 700, multiplier: 100, extreme: true, postedAt: "2026-05-01T00:00:00Z" }),
    video(4, { views: 300, multiplier: 8, postedAt: null }),
  ];
  const lines = () => cardNames().map((name) => name!.replace("Line number ", "#"));

  it("Most viewed (the default): views, most first", () => {
    renderHub({ videos: ORDERED });
    expect(lines()).toEqual(["#2", "#3", "#1", "#4"]);
  });

  it("Biggest jump: the biggest multiple first, the ones past 100 last", () => {
    renderHub({ videos: ORDERED, href: "/feed?order=jump" });
    expect(lines()).toEqual(["#2", "#4", "#1", "#3"]);
    expect(document.querySelector('[data-part="order-word"]')).toHaveTextContent("Biggest jump");
  });

  it("Newest: the latest first, no date last", () => {
    renderHub({ videos: ORDERED, href: "/feed?order=newest" });
    expect(lines()).toEqual(["#3", "#1", "#2", "#4"]);
    expect(document.querySelector('[data-part="order-word"]')).toHaveTextContent("Newest");
  });
});

// ─── The filter ──────────────────────────────────────────────────────────────

describe("DiscoverNext — the filter on a phone (a sheet)", () => {
  /** Opens the sheet from the mark at the field's end. */
  function openFilter() {
    const mark = within(searchBox()).getByRole("button", { name: "Filter" });
    fireEvent.click(mark);
    return { mark, sheet: screen.getByRole("dialog", { name: "Filter" }) };
  }
  const comedyCount = MANY.filter((v) => v.niche === "comedy" || v.niche === "comedy-entertainment").length;
  const comedyTikTok = MANY.filter((v) => (v.niche === "comedy" || v.niche === "comedy-entertainment") && v.platform === "tiktok").length;

  it("opens from the mark with the focus on the first chip, and gives it back to the mark on close", async () => {
    renderHub();
    const { mark, sheet } = openFilter();
    const niche = within(sheet).getByRole("group", { name: "Niche" });
    await waitFor(() => expect(within(niche).getByRole("button", { name: "All" })).toHaveFocus());
    expect(within(sheet).getByRole("group", { name: "Platform" })).toBeInTheDocument();
    expect(within(sheet).getByRole("group", { name: "Order" })).toBeInTheDocument();
    fireEvent.keyDown(sheet, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mark).toHaveFocus();
  });

  it("offers the niches that have videos, the two comedy values as one", () => {
    renderHub();
    const { sheet } = openFilter();
    const niche = within(sheet).getByRole("group", { name: "Niche" });
    const names = within(niche).getAllByRole("button").map((b) => b.textContent);
    expect(names[0]).toBe("All");
    expect(names.filter((n) => n === "Comedy")).toHaveLength(1);
    // Most videos first: the two comedy values together hold the most.
    expect(names[1]).toBe("Comedy");
    expect(names).toEqual(expect.arrayContaining(["Food", "Fitness", "Tech"]));
  });

  it("holds the choice until Show N videos, which counts it, then applies it and names it with Clear", async () => {
    renderHub();
    const { sheet } = openFilter();
    expect(within(sheet).getByRole("button", { name: "Show 60 videos" })).toBeInTheDocument();
    fireEvent.click(within(within(sheet).getByRole("group", { name: "Niche" })).getByRole("button", { name: "Comedy" }));
    expect(within(within(sheet).getByRole("group", { name: "Niche" })).getByRole("button", { name: "Comedy" })).toHaveAttribute("aria-pressed", "true");
    // Pending: the grid and the address have not moved.
    expect(countLine()).toBe("60 proven videos");
    expect(addressWrites()).toEqual([]);
    fireEvent.click(within(within(sheet).getByRole("group", { name: "Platform" })).getByRole("button", { name: "TikTok" }));
    const show = within(sheet).getByRole("button", { name: `Show ${comedyTikTok} videos` });
    fireEvent.click(show);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(countLine()).toBe(`Comedy · TikTok · ${comedyTikTok} videos`);
    expect(cards()).toHaveLength(comedyTikTok);
    expect(addressWrites()).toEqual(["/feed?niche=comedy&platform=tiktok"]);

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(countLine()).toBe("60 proven videos");
    expect(address()).toBe("/feed");
  });

  it("a niche alone: its line and its count", async () => {
    renderHub();
    const { sheet } = openFilter();
    fireEvent.click(within(within(sheet).getByRole("group", { name: "Niche" })).getByRole("button", { name: "Comedy" }));
    fireEvent.click(within(sheet).getByRole("button", { name: `Show ${comedyCount} videos` }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(countLine()).toBe(`Comedy · ${comedyCount} videos`);
    expect(address()).toBe("/feed?niche=comedy");
  });

  it("the order chosen in the sheet applies on the tap too", async () => {
    renderHub();
    const { sheet } = openFilter();
    fireEvent.click(within(within(sheet).getByRole("group", { name: "Order" })).getByRole("button", { name: "Newest" }));
    expect(addressWrites()).toEqual([]);
    fireEvent.click(within(sheet).getByRole("button", { name: "Show 60 videos" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(address()).toBe("/feed?order=newest");
    expect(document.querySelector('[data-part="order-word"]')).toHaveTextContent("Newest");
  });

  it("closed without the tap: nothing applied, and the next open starts from what is applied", async () => {
    renderHub({ href: "/feed?platform=youtube" });
    let { sheet } = openFilter();
    fireEvent.click(within(within(sheet).getByRole("group", { name: "Niche" })).getByRole("button", { name: "Comedy" }));
    fireEvent.keyDown(sheet, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(addressWrites()).toEqual([]);
    ({ sheet } = openFilter());
    expect(within(within(sheet).getByRole("group", { name: "Niche" })).getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(within(within(sheet).getByRole("group", { name: "Platform" })).getByRole("button", { name: "YouTube" })).toHaveAttribute("aria-pressed", "true");
  });

  it("a filter that leaves nothing says so in its line, with Clear", () => {
    renderHub({ videos: [video(1, { niche: "food", platform: "tiktok" }), video(2, { niche: "tech", platform: "instagram" })], href: "/feed?niche=food&platform=instagram" });
    expect(countLine()).toBe("Food · Instagram · 0 videos");
    expect(screen.queryByRole("list", { name: "Videos" })).toBeNull();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  it("the filter's Clear and the search's Clear are told apart by what they describe", () => {
    renderHub({ href: "/feed?niche=comedy" });
    typeInto("zebra");
    const [filterClear, searchClear] = screen.getAllByRole("button", { name: "Clear" });
    expect(filterClear).toHaveAccessibleDescription("Comedy · 0 videos");
    expect(searchClear).toHaveAccessibleDescription("No video matches that.");
  });
});

describe("DiscoverNext — on a desk: the filter stands on its button, the order is a menu", () => {
  beforeEach(() => widthIs("desk"));

  it("Filter opens the same body as a menu standing on the button; the field's mark is a phone's only", async () => {
    renderHub();
    expect(within(searchBox()).getByRole("button", { name: "Filter" })).toHaveClass("md:hidden");
    const button = within(tools()).getByRole("button", { name: "Filter" });
    fireEvent.click(button);
    const panel = await screen.findByRole("dialog", { name: "Filter" });
    await waitFor(() => expect(within(within(panel).getByRole("group", { name: "Niche" })).getByRole("button", { name: "All" })).toHaveFocus());
    fireEvent.click(within(within(panel).getByRole("group", { name: "Platform" })).getByRole("button", { name: "Instagram" }));
    const n = MANY.filter((v) => v.platform === "instagram").length;
    fireEvent.click(within(panel).getByRole("button", { name: `Show ${n} videos` }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(address()).toBe("/feed?platform=instagram");
    await waitFor(() => expect(button).toHaveFocus());
  });

  it("Escape closes the filter's menu, applies nothing, and gives the focus back to Filter", async () => {
    renderHub();
    const button = within(tools()).getByRole("button", { name: "Filter" });
    fireEvent.click(button);
    const panel = await screen.findByRole("dialog", { name: "Filter" });
    fireEvent.click(within(within(panel).getByRole("group", { name: "Platform" })).getByRole("button", { name: "YouTube" }));
    fireEvent.keyDown(panel, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(button).toHaveFocus();
    expect(addressWrites()).toEqual([]);
  });

  it("the order menu: three choices, the current one checked, a choice applied at once", async () => {
    renderHub();
    const trigger = within(tools()).getByRole("button", { name: "Most viewed" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    fireEvent.click(trigger);
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitemradio");
    expect(items.map((item) => item.textContent)).toEqual(["Most viewed", "Biggest jump", "Newest"]);
    expect(items[0]).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(items[0]).toHaveFocus());
    fireEvent.keyDown(items[0]!, { key: "ArrowDown" });
    expect(items[1]).toHaveFocus();
    fireEvent.click(items[1]!);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(address()).toBe("/feed?order=jump");
    expect(screen.getByRole("button", { name: "Biggest jump" })).toHaveFocus();
  });

  it("the order menu by keyboard: ArrowUp wraps, End and Home jump, Escape closes with nothing applied", async () => {
    renderHub({ href: "/feed?order=jump" });
    const trigger = within(tools()).getByRole("button", { name: "Biggest jump" });
    fireEvent.click(trigger);
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitemradio");
    await waitFor(() => expect(items[1]).toHaveFocus());
    fireEvent.keyDown(items[1]!, { key: "ArrowUp" });
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0]!, { key: "ArrowUp" });
    expect(items[2]).toHaveFocus();
    fireEvent.keyDown(items[2]!, { key: "Home" });
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0]!, { key: "End" });
    expect(items[2]).toHaveFocus();
    fireEvent.keyDown(items[2]!, { key: "ArrowDown" });
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0]!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(trigger).toHaveFocus();
    expect(addressWrites()).toEqual([]);
  });
});

// ─── The address ─────────────────────────────────────────────────────────────

describe("DiscoverNext — the address is the view", () => {
  it("each choice is written with replaceState, never a new entry or a server render", async () => {
    renderHub();
    fireEvent.click(chip("Collections"));
    expect(address()).toBe("/feed?tab=collections");
    fireEvent.click(chip("Videos"));
    expect(address()).toBe("/feed");
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(addressWrites()).toEqual(["/feed?tab=collections", "/feed"]);
  });

  it("the search goes to the address 250 ms after the last key, once", async () => {
    vi.useFakeTimers();
    renderHub();
    typeInto("mea");
    act(() => vi.advanceTimersByTime(200));
    typeInto("meal");
    act(() => vi.advanceTimersByTime(249));
    expect(addressWrites()).toEqual([]);
    act(() => vi.advanceTimersByTime(1));
    expect(addressWrites()).toEqual(["/feed?q=meal"]);
    act(() => vi.advanceTimersByTime(1000));
    expect(addressWrites()).toEqual(["/feed?q=meal"]);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("an address the screen did not write is followed: the view, and the field's text", () => {
    renderHub({ videos: [video(1, { spokenHook: "Meal prep for a week" }), video(2), video(3)] });
    expect(cards()).toHaveLength(3);
    navigate("/feed?q=meal&order=newest");
    expect(field()).toHaveValue("meal");
    expect(cards()).toHaveLength(1);
    expect(document.querySelector('[data-part="order-word"]')).toHaveTextContent("Newest");
    navigate("/feed");
    expect(field()).toHaveValue("");
    expect(cards()).toHaveLength(3);
    expect(addressWrites()).toEqual([]);
  });

  it("the old tab name opens Videos", () => {
    renderHub({ href: "/feed?tab=outliers" });
    expect(chip("Videos")).toHaveAttribute("aria-pressed", "true");
    expect(cards()).toHaveLength(24);
  });

  it("Watchlist shows no videos (its own panel is tested in watchlist-panel.test.tsx)", () => {
    // The Watchlist panel follows and removes through the app's query client and toasts.
    setAddress("/feed?tab=watchlist");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <DiscoverNext hub={hubOf(MANY)} watchlist={NO_WATCHLIST} failures={OK} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(chip("Watchlist")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("list", { name: "Videos" })).toBeNull();
    // The filter belongs to Videos: no mark in the field.
    expect(within(searchBox()).queryByRole("button", { name: "Filter" })).toBeNull();
  });

  it("the shown count starts again when the view changes", () => {
    renderHub();
    fireEvent.click(showMore()!);
    expect(cards()).toHaveLength(48);
    navigate("/feed?order=newest");
    expect(cards()).toHaveLength(24);
  });
});

// ─── Search ──────────────────────────────────────────────────────────────────

describe("DiscoverNext — search as you type", () => {
  const LIB = [
    video(1, { spokenHook: "Meal prep for a busy week", handle: "nia.cooks", niche: "food" }),
    video(2, { spokenHook: "A week of push-ups", handle: "dev.lifts", niche: "health-fitness" }),
    video(3, { spokenHook: "My meal plan", handle: "jay.makes", niche: "comedy-entertainment", formats: ["Day In The Life"] }),
  ];

  it("narrows the grid at once: by the line, two words in any order, the @handle, the niche's name, a format", () => {
    renderHub({ videos: LIB });
    typeInto("meal");
    expect(cardNames()).toEqual(["Meal prep for a busy week", "My meal plan"]);
    typeInto("week meal");
    expect(cardNames()).toEqual(["Meal prep for a busy week"]);
    typeInto("@dev.lifts");
    expect(cardNames()).toEqual(["A week of push-ups"]);
    typeInto("fitness");
    expect(cardNames()).toEqual(["A week of push-ups"]);
    typeInto("comedy");
    expect(cardNames()).toEqual(["My meal plan"]);
    typeInto("day in the life");
    expect(cardNames()).toEqual(["My meal plan"]);
    expect(countLine()).toBe("1 proven video");
  });

  it("no match: the sentence and Clear, which empties the field and shows every video again", async () => {
    renderHub({ videos: LIB });
    typeInto("zebra");
    expect(screen.queryByRole("list", { name: "Videos" })).toBeNull();
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("No video matches that.");
    fireEvent.click(within(notice).getByRole("button", { name: "Clear" }));
    expect(field()).toHaveValue("");
    expect(cards()).toHaveLength(3);
    expect(address()).toBe("/feed");
  });

  it("a @handle with no video in the library: says so, with Clear", () => {
    renderHub({ videos: LIB });
    typeInto("@sam.bakes");
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Nothing from @sam.bakes in the library yet.");
    // A long handle breaks inside the column rather than run off a 320 phone.
    expect(within(notice).getByText("Nothing from @sam.bakes in the library yet.")).toHaveClass("max-w-full", "break-words");
    expect(notice).not.toHaveTextContent("No video matches that.");
    expect(within(notice).getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  it("the field's cross and Escape clear it", () => {
    renderHub({ videos: LIB });
    expect(within(searchBox()).queryByRole("button", { name: "Clear search" })).toBeNull();
    typeInto("meal");
    fireEvent.click(within(searchBox()).getByRole("button", { name: "Clear search" }));
    expect(field()).toHaveValue("");
    typeInto("meal");
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(field()).toHaveValue("");
    expect(cards()).toHaveLength(3);
  });

  it("the field is named and says what it takes", () => {
    renderHub();
    expect(field()).toHaveAttribute("placeholder", "Search videos, or paste a @handle");
  });
});

describe("DiscoverNext — the focus never falls to the page", () => {
  it("the count line's Clear goes with the filter it clears: the focus goes to the search field", () => {
    renderHub({ href: "/feed?niche=food" });
    const clear = screen.getByRole("button", { name: "Clear" });
    clear.focus();
    fireEvent.click(clear);
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    expect(field()).toHaveFocus();
  });
});

// ─── The return point ────────────────────────────────────────────────────────

describe("DiscoverNext — Back from a video lands on the same cards at the same scroll", () => {
  /** The shell's scrolling element: the hub renders inside <main>, which stays across routes. */
  let main: HTMLElement;
  beforeEach(() => {
    main = document.body.appendChild(document.createElement("main"));
  });
  afterEach(() => {
    main.remove();
  });
  const visit = () => main.appendChild(document.createElement("div"));

  async function leaveFromCard(strict: boolean, href = "/feed?order=newest") {
    const first = renderHub({ href, strict, container: visit() });
    fireEvent.click(showMore()!);
    expect(cards()).toHaveLength(48);
    main.scrollTop = 900;
    fireEvent.click(cards()[30]!);
    first.unmount();
    main.scrollTop = 0;
  }

  it.each([false, true])("the same address: 48 cards and the scroll as it was left, once (strict mode: %s)", async (strict) => {
    await leaveFromCard(strict);
    const again = renderHub({ href: "/feed?order=newest", strict, container: visit() });
    expect(cards()).toHaveLength(48);
    expect(main.scrollTop).toBe(900);

    // Taken: another visit opens at the top.
    again.unmount();
    main.scrollTop = 0;
    renderHub({ href: "/feed?order=newest", strict, container: visit() });
    expect(cards()).toHaveLength(24);
    expect(main.scrollTop).toBe(0);
  });

  // In a browser a scroll set before the cards are drawn stops at the foot of the shorter grid.
  it.each([false, true])("the scroll is set once the 48 cards are drawn, not before (strict mode: %s)", async (strict) => {
    await leaveFromCard(strict);
    const drawnAtScroll: number[] = [];
    let top = 0;
    Object.defineProperty(main, "scrollTop", {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = value;
        drawnAtScroll.push(main.querySelectorAll('ul[aria-label="Videos"] > li').length);
      },
    });
    renderHub({ href: "/feed?order=newest", strict, container: visit() });
    expect(top).toBe(900);
    expect(drawnAtScroll.length).toBeGreaterThan(0);
    expect(drawnAtScroll.every((n) => n === 48)).toBe(true);
  });

  it.each([
    ["cmd", { metaKey: true }],
    ["ctrl", { ctrlKey: true }],
    ["shift", { shiftKey: true }],
    ["the middle button", { button: 1 }],
  ])("a card opened elsewhere (%s) leaves no return point", async (_, modifier) => {
    const first = renderHub({ href: "/feed?order=newest", container: visit() });
    fireEvent.click(showMore()!);
    main.scrollTop = 900;
    fireEvent.click(cards()[30]!, modifier);
    first.unmount();
    main.scrollTop = 0;
    renderHub({ href: "/feed?order=newest", container: visit() });
    expect(cards()).toHaveLength(24);
    expect(main.scrollTop).toBe(0);
  });

  it("another address: not put back", async () => {
    await leaveFromCard(false);
    renderHub({ href: "/feed", container: visit() });
    expect(cards()).toHaveLength(24);
    expect(main.scrollTop).toBe(0);
  });

  it("a search still being typed when the card opened is written first, and Back lands on it", async () => {
    const first = renderHub({ container: visit() });
    typeInto("line");
    main.scrollTop = 300;
    // Written at once, before the link navigates (the 250 ms had not passed).
    expect(addressWrites()).toEqual([]);
    fireEvent.click(cards()[2]!);
    expect(addressWrites()).toEqual(["/feed?q=line"]);
    first.unmount();
    main.scrollTop = 0;
    renderHub({ href: "/feed?q=line", container: visit() });
    expect(field()).toHaveValue("line");
    expect(main.scrollTop).toBe(300);
  });
});

// ─── Failure and loading ─────────────────────────────────────────────────────

describe("DiscoverNext — the library could not be read", () => {
  it("says so, and Try again asks the server again", () => {
    renderHub({ videos: [], failures: { corpus: true, watchlist: false } });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load the videos.");
    expect(countLine()).toBeNull();
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("offers no filter and no order while there is nothing to filter", () => {
    renderHub({ videos: [], failures: { corpus: true, watchlist: false } });
    expect(within(searchBox()).queryByRole("button", { name: "Filter" })).toBeNull();
    expect(document.querySelector('[data-part="tools"]')).toBeNull();
  });

  it("read again: the notice goes and the focus, which had dropped, goes to the heading", () => {
    const view = renderHub({ videos: [], failures: { corpus: true, watchlist: false } });
    const retry = within(screen.getByRole("alert")).getByRole("button", { name: "Try again" });
    retry.focus();
    fireEvent.click(retry);
    view.rerender(<DiscoverNext hub={hubOf(MANY)} watchlist={NO_WATCHLIST} failures={OK} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Discover" })).toHaveFocus();
    expect(cards()).toHaveLength(24);
  });

  it("a watchlist failure alone leaves Videos as it is", () => {
    renderHub({ failures: { corpus: false, watchlist: true } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(cards()).toHaveLength(24);
  });
});

describe("DiscoverNext — the drawer's opener on the phone", () => {
  // The face the drawer's frame publishes (the shell mounts it; here it is set as it would be).
  beforeEach(() => useShellStore.setState({ drawerOpen: false, accountFace: { picture: null, initials: "NL" } }));
  afterEach(() => useShellStore.setState({ drawerOpen: false, accountFace: null }));

  /** The heading's row holds the opener's slot first, then the h1. */
  function expectOpenerBeforeHeading() {
    const opener = screen.getByRole("button", { name: "Open menu" });
    expect(opener).toHaveTextContent("NL");
    const slot = opener.closest<HTMLElement>('[data-part="opener"]')!;
    expect(slot).toHaveClass("flex", "shrink-0", "md:hidden");
    const heading = screen.getByRole("heading", { level: 1, name: "Discover" });
    const row = heading.parentElement!;
    expect(row.firstElementChild).toBe(slot);
    expect(slot.nextElementSibling).toBe(heading);
    expect(row).toHaveClass("h-11", "gap-3");
    return opener;
  }

  it("the hub's row: the opener, then the heading", () => {
    renderHub();
    const opener = expectOpenerBeforeHeading();
    fireEvent.click(opener);
    expect(useShellStore.getState().drawerOpen).toBe(true);
    // It is the shell's way in, not a Discover choice: the address is not written.
    expect(addressWrites()).toEqual([]);
  });

  it("DiscoverNextLoading draws the opener too", () => {
    render(<DiscoverNextLoading />);
    expectOpenerBeforeHeading();
  });
});

describe("DiscoverNextLoading — the screen's own outline", () => {
  it("is busy, shows ten card outlines and no count", () => {
    render(<DiscoverNextLoading />);
    expect(screen.getByRole("heading", { level: 1, name: "Discover" })).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Videos" });
    expect(list).toHaveAttribute("aria-busy", "true");
    expect(list.querySelectorAll("li")).toHaveLength(10);
    expect(within(list).queryAllByRole("link")).toHaveLength(0);
    expect(countLine()).toBeNull();
  });
});
