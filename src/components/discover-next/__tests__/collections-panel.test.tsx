/** @vitest-environment happy-dom */

/**
 * The hub's Collections chip (spec 3.4; drawing frame 4): four shelves by their names, each showing
 * four cards and "See all N" when it holds more, a card per collection (three covers, the name, the
 * count) linking to its page with its shelf, search by name, and the library's failure. Through the
 * real container (`DiscoverNext`), screen, panel and card. Stand-ins only at the edges, as the hub's
 * own test has them: the router, `useSearchParams` (an address store that follows the History API),
 * `matchMedia` and the build-time flag. Every name and address is made up.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import type { CollectionCategory } from "@/lib/discover/corpus-reads";
import type { WatchlistData } from "@/lib/discover/watchlist-reads";
import type { CollectionCard, HubData } from "@/lib/discover-next/hub-data";

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

const nativeReplaceState = window.history.replaceState.bind(window.history);
function setAddress(href: string) {
  nativeReplaceState(null, "", href);
  nav.set(new URL(href, "http://localhost").search);
}

// ─── Fixtures (made-up collections) ──────────────────────────────────────────

const cover = (n: number) => `https://example.supabase.co/storage/v1/object/public/covers/c${n}.jpg`;
const BROKEN = "https://example.supabase.co/storage/v1/object/public/covers/broken.jpg";

function collection(slug: string, name: string, category: CollectionCategory, count: number, covers: string[] = [cover(1), cover(2), cover(3)]): CollectionCard {
  return { slug, name, category, count, covers };
}

/** Out of order on purpose: the chip puts each on its shelf and in its order. */
const COLLECTIONS: CollectionCard[] = [
  collection("weekly-recap", "Weekly recap", "signature_series", 3),
  // "skit" is a slug on two shelves (Formats here, Visual hooks below): two collections.
  collection("skit", "Skit/Humor", "formats", 10),
  collection("jump-cut", "Jump cut", "editing_styles", 9, [cover(4)]),
  collection("ranking", "Ranking/Rating/Tier List", "formats", 15),
  collection("one-take", "One take", "formats", 1),
  collection("day-in-the-life", "Day In The Life", "formats", 11, [BROKEN, cover(5)]),
  collection("a-vs-b", "A vs B Comparison", "formats", 13),
  collection("mirror-talk", "Mirror talk", "formats", 2),
  collection("text-on-screen", "Text on screen", "visual_hooks", 7),
  collection("skit", "Skit cold open", "visual_hooks", 6),
  collection("big-reveal", "Big reveal", "visual_hooks", 5),
  collection("prop-in-hand", "Prop in hand", "visual_hooks", 4),
];

const hubOf = (collections: CollectionCard[]): HubData => ({ videos: [], collections });
const NO_WATCHLIST: WatchlistData = { sources: [], latest: [] };
const OK = { corpus: false, watchlist: false };

function renderChip({ href = "/feed?tab=collections", collections = COLLECTIONS, failures = OK } = {}) {
  setAddress(href);
  return render(<DiscoverNext hub={hubOf(collections)} watchlist={NO_WATCHLIST} failures={failures} />);
}

const shelfNames = () => screen.queryAllByRole("heading", { level: 2 }).map((h) => h.textContent);
const shelf = (name: string) => screen.getByRole("list", { name });
const cardsOf = (name: string) => within(shelf(name)).getAllByRole("link");
const namesOf = (name: string) => cardsOf(name).map((card) => card.getAttribute("aria-label"));
const field = () => screen.getByRole("textbox", { name: "Search" });
const typeInto = (text: string) => fireEvent.change(field(), { target: { value: text } });
/** What an element's `aria-describedby` points at, as text. */
const description = (el: Element) =>
  (el.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent)
    .join(" ");

beforeEach(() => {
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
  for (const fn of Object.values(router)) fn.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ─── The shelves ─────────────────────────────────────────────────────────────

describe("Collections — the shelves", () => {
  it("the chip is selected, and its four shelves are drawn in their order, each named", () => {
    renderChip();
    expect(within(screen.getByRole("group", { name: "Discover" })).getByRole("button", { name: "Collections" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(shelfNames()).toEqual(["Formats", "Visual hooks", "Editing styles", "Signature series"]);
    expect(screen.queryByRole("list", { name: "Videos" })).toBeNull();
  });

  it("a shelf shows four cards, the ones holding most videos first", () => {
    renderChip();
    expect(namesOf("Formats")).toEqual(["Ranking/Rating/Tier List", "A vs B Comparison", "Day In The Life", "Skit/Humor"]);
    expect(namesOf("Visual hooks")).toEqual(["Text on screen", "Skit cold open", "Big reveal", "Prop in hand"]);
    expect(namesOf("Signature series")).toEqual(["Weekly recap"]);
  });

  it("See all, with the shelf's count, only on a shelf that holds more than four; it is told apart by its shelf", () => {
    renderChip();
    const seeAll = screen.getAllByRole("button", { name: /^See all/ });
    expect(seeAll.map((b) => b.textContent)).toEqual(["See all 6"]);
    expect(description(seeAll[0]!)).toBe("Formats");
  });

  it("See all from the keyboard opens the shelf in place and goes; the focus it held moves to the first card it brought", () => {
    renderChip();
    const seeAll = screen.getByRole("button", { name: "See all 6" });
    seeAll.focus();
    // Enter or Space on a button: a click whose `detail` (the pointer's click count) is 0.
    fireEvent.click(seeAll, { detail: 0 });
    expect(namesOf("Formats")).toEqual([
      "Ranking/Rating/Tier List",
      "A vs B Comparison",
      "Day In The Life",
      "Skit/Humor",
      "Mirror talk",
      "One take",
    ]);
    expect(screen.queryByRole("button", { name: /^See all/ })).toBeNull();
    expect(cardsOf("Formats")[4]).toHaveFocus();
    // The other shelves are as they were.
    expect(cardsOf("Visual hooks")).toHaveLength(4);
  });

  it("See all tapped with a pointer opens the shelf and leaves the focus alone (no ring lands on a card)", () => {
    renderChip();
    const seeAll = screen.getByRole("button", { name: "See all 6" });
    // Safari does not focus a tapped button; the focus is wherever it was (here, nowhere).
    fireEvent.click(seeAll, { detail: 1 });
    expect(cardsOf("Formats")).toHaveLength(6);
    expect(screen.queryByRole("button", { name: /^See all/ })).toBeNull();
    expect(cardsOf("Formats").some((card) => card === document.activeElement)).toBe(false);
    expect(document.activeElement).toBe(document.body);
  });

  it("no filter on this chip: no mark in the field, no tools beside the chips", () => {
    renderChip();
    expect(within(screen.getByRole("search")).queryByRole("button", { name: "Filter" })).toBeNull();
    expect(document.querySelector('[data-part="tools"]')).toBeNull();
  });
});

// ─── A card ──────────────────────────────────────────────────────────────────

describe("Collections — a card", () => {
  it("links to the collection's page with its shelf, named by the name as stored and described by its count", () => {
    renderChip();
    const ranking = screen.getByRole("link", { name: "Ranking/Rating/Tier List" });
    expect(ranking).toHaveAttribute("href", "/feed/collection/ranking?shelf=formats");
    expect(description(ranking)).toBe("15 videos");
    // The slug on two shelves: each card carries its own shelf.
    expect(screen.getByRole("link", { name: "Skit/Humor" })).toHaveAttribute("href", "/feed/collection/skit?shelf=formats");
    expect(screen.getByRole("link", { name: "Skit cold open" })).toHaveAttribute("href", "/feed/collection/skit?shelf=visual_hooks");
  });

  it("one video is said in the singular", () => {
    renderChip({ collections: [collection("one-take", "One take", "formats", 1)] });
    expect(description(screen.getByRole("link", { name: "One take" }))).toBe("1 video");
  });

  it("draws three covers; a missing one is the neutral tile", () => {
    renderChip();
    const full = screen.getByRole("link", { name: "Ranking/Rating/Tier List" });
    expect(full.querySelectorAll("img")).toHaveLength(3);
    expect(full.querySelectorAll('[data-part="tile"]')).toHaveLength(0);
    const one = screen.getByRole("link", { name: "Jump cut" });
    expect(one.querySelectorAll("img")).toHaveLength(1);
    expect(one.querySelectorAll('[data-part="tile"]')).toHaveLength(2);
  });

  it("a cover that does not load becomes the neutral tile", () => {
    renderChip();
    const card = screen.getByRole("link", { name: "Day In The Life" });
    const broken = [...card.querySelectorAll("img")].find((img) => img.getAttribute("src") === BROKEN)!;
    fireEvent.error(broken);
    expect(card.querySelectorAll("img")).toHaveLength(1);
    expect(card.querySelectorAll('[data-part="tile"]')).toHaveLength(2);
  });

  it("the covers are pictures only: hidden from a screen reader, which hears the name and the count", () => {
    renderChip();
    const card = screen.getByRole("link", { name: "Ranking/Rating/Tier List" });
    for (const img of card.querySelectorAll("img")) {
      expect(img).toHaveAttribute("alt", "");
      expect(img.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });
});

// ─── Search ──────────────────────────────────────────────────────────────────

describe("Collections — search", () => {
  it("narrows the collections by name as the creator types, any case; a shelf it empties goes", () => {
    renderChip();
    typeInto("TIER");
    expect(shelfNames()).toEqual(["Formats"]);
    expect(namesOf("Formats")).toEqual(["Ranking/Rating/Tier List"]);
    typeInto("skit");
    expect(shelfNames()).toEqual(["Formats", "Visual hooks"]);
    typeInto("");
    expect(shelfNames()).toEqual(["Formats", "Visual hooks", "Editing styles", "Signature series"]);
  });

  it("a search in the address is followed on this chip", () => {
    renderChip({ href: "/feed?tab=collections&q=reveal" });
    expect(field()).toHaveValue("reveal");
    expect(shelfNames()).toEqual(["Visual hooks"]);
    expect(namesOf("Visual hooks")).toEqual(["Big reveal"]);
  });

  it("no name holds it: the sentence, and no shelf", () => {
    renderChip();
    typeInto("@jay.makes");
    expect(screen.getByRole("status")).toHaveTextContent("No collection matches that.");
    expect(shelfNames()).toEqual([]);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("the search on this chip draws no videos and no count", () => {
    renderChip();
    typeInto("a");
    expect(screen.queryByRole("list", { name: "Videos" })).toBeNull();
    expect(document.querySelector('[data-part="count"]')).toBeNull();
  });

  it("another chip takes the shelves' place, and keeps the search", () => {
    renderChip();
    typeInto("skit");
    act(() => {
      fireEvent.click(within(screen.getByRole("group", { name: "Discover" })).getByRole("button", { name: "Videos" }));
    });
    expect(field()).toHaveValue("skit");
    expect(screen.queryByRole("heading", { level: 2, name: "Formats" })).toBeNull();
  });
});

// ─── Failure ─────────────────────────────────────────────────────────────────

describe("Collections — the library could not be read", () => {
  it("says so, and Try again asks the server again", () => {
    renderChip({ collections: [], failures: { corpus: true, watchlist: false } });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load the videos.");
    expect(shelfNames()).toEqual([]);
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("a watchlist failure alone leaves the shelves as they are", () => {
    renderChip({ failures: { corpus: false, watchlist: true } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(shelfNames()).toHaveLength(4);
  });
});
