/** @vitest-environment happy-dom */

/**
 * CollectionNext: one collection's page (spec 3.4): a pushed page with the collection's name as its
 * heading, its count, and the same video cards as the hub (the badge only on a proven video), 24 then
 * Show more. Also its gone, failed and loading states. The real container, screen, desktop header and
 * cards. Stand-ins only at the edges: the router, `matchMedia` (a phone) and the build-time flag.
 * Every handle and address is made up.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import type { CollectionPage } from "@/lib/discover-next/collections";
import type { CardVideo } from "@/lib/discover-next/hub-data";
import { useShellStore } from "@/stores/shell-store";

vi.setConfig({ testTimeout: 20_000 });

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

const router = { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/feed/collection/ranking",
  useRouter: () => router,
}));

import { CollectionNext, CollectionNextLoading } from "../collection-next";

// ─── Fixtures (made-up) ──────────────────────────────────────────────────────

const HANDLES = ["jay.makes", "nia.cooks", "dev.lifts"];

function video(n: number, over: Partial<CardVideo> = {}): CardVideo {
  return {
    id: `v${String(n).padStart(2, "0")}`,
    coverUrl: `https://covers.example/v${n}.jpg`,
    handle: HANDLES[n % 3]!,
    spokenHook: `Line number ${n}`,
    niche: "food",
    platform: "tiktok",
    views: 1_000_000 - n * 10_000,
    postedAt: "2026-03-01T00:00:00Z",
    multiplier: 3 + (n % 7),
    baselineLabel: "vs their average",
    proven: true,
    extreme: false,
    formats: [],
    ...over,
  };
}

/** Thirty videos, most viewed first; the second is measured at 1.5×, the third has no basis. */
const VIDEOS: CardVideo[] = Array.from({ length: 30 }, (_, i) => video(i + 1)).map((v, i) =>
  i === 1 ? { ...v, multiplier: 1.5, proven: false } : i === 2 ? { ...v, multiplier: null, baselineLabel: null, proven: false } : v,
);

const RANKING: CollectionPage = { slug: "ranking", name: "Ranking/Rating/Tier List", category: "formats", videos: VIDEOS };

const realHistoryLength = Object.getOwnPropertyDescriptor(window.history, "length");
const setHistoryLength = (value: number) => Object.defineProperty(window.history, "length", { configurable: true, get: () => value });

const grid = () => screen.getByRole("list", { name: "Videos" });
const cards = () => within(grid()).getAllByRole("link");
const countLine = () => document.querySelector('[data-part="count"]')?.textContent ?? null;
const showMore = () => screen.queryByRole("button", { name: "Show more" });

beforeEach(() => {
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
  useShellStore.setState({ pushedTitle: "" });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (realHistoryLength) Object.defineProperty(window.history, "length", realHistoryLength);
  else delete (window.history as { length?: number }).length;
});

// ─── The page ────────────────────────────────────────────────────────────────

describe("CollectionNext — the header", () => {
  it("is titled by the collection's name as stored: the desktop heading, and the phone's pushed header through the shell", () => {
    render(<CollectionNext collection={RANKING} />);
    expect(screen.getByRole("heading", { level: 1, name: "Ranking/Rating/Tier List" })).toBeInTheDocument();
    expect(useShellStore.getState().pushedTitle).toBe("Ranking/Rating/Tier List");
  });

  it("leaving the page clears the phone's title", () => {
    const view = render(<CollectionNext collection={RANKING} />);
    view.unmount();
    expect(useShellStore.getState().pushedTitle).toBe("");
  });

  it("Back goes back in history (to the shelves as they were left); opened directly, to Discover", () => {
    setHistoryLength(3);
    const view = render(<CollectionNext collection={RANKING} />);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
    view.unmount();

    setHistoryLength(1);
    render(<CollectionNext collection={RANKING} />);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/feed");
  });
});

describe("CollectionNext — the videos", () => {
  it("says how many videos the collection holds", () => {
    render(<CollectionNext collection={RANKING} />);
    expect(countLine()).toBe("30 videos");
  });

  it("one video is said in the singular", () => {
    render(<CollectionNext collection={{ ...RANKING, videos: [video(1)] }} />);
    expect(countLine()).toBe("1 video");
  });

  it("shows the cards in the stored order, each a link to the video's page, named by its line", () => {
    render(<CollectionNext collection={RANKING} />);
    expect(cards().slice(0, 3).map((card) => card.getAttribute("aria-label"))).toEqual(["Line number 1", "Line number 2", "Line number 3"]);
    expect(cards()[0]).toHaveAttribute("href", "/feed/video/v01");
  });

  it("the badge only on a proven video: none on one measured below 3×, none on one without a basis", () => {
    render(<CollectionNext collection={RANKING} />);
    const [first, second, third] = cards();
    expect(first!.querySelector('[data-part="badge"]')).toHaveTextContent("4×");
    expect(second!.querySelector('[data-part="badge"]')).toBeNull();
    expect(third!.querySelector('[data-part="badge"]')).toBeNull();
    expect(within(second!).queryByText(/×/)).toBeNull();
  });

  it("shows 24 cards, and Show more adds the rest", () => {
    render(<CollectionNext collection={RANKING} />);
    expect(cards()).toHaveLength(24);
    fireEvent.click(showMore()!);
    expect(cards()).toHaveLength(30);
    expect(showMore()).toBeNull();
  });

  it("when Show more goes, the focus it held moves to the first card that tap brought", () => {
    render(<CollectionNext collection={RANKING} />);
    showMore()!.focus();
    fireEvent.click(showMore()!);
    expect(cards()[24]).toHaveFocus();
  });

  it("no Show more when every card is shown", () => {
    render(<CollectionNext collection={{ ...RANKING, videos: VIDEOS.slice(0, 24) }} />);
    expect(cards()).toHaveLength(24);
    expect(showMore()).toBeNull();
  });

  it("another collection starts again at 24", () => {
    const view = render(<CollectionNext collection={RANKING} />);
    fireEvent.click(showMore()!);
    expect(cards()).toHaveLength(30);
    view.rerender(<CollectionNext collection={{ ...RANKING, slug: "skit", category: "visual_hooks", name: "Skit cold open" }} />);
    expect(cards()).toHaveLength(24);
  });
});

describe("CollectionNext — not there, not read", () => {
  it("gone: the sentence and Back to Discover, to the Collections chip; titled Collection", () => {
    render(<CollectionNext collection={null} />);
    expect(screen.getByText("This collection isn't in the library any more.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Discover" })).toHaveAttribute("href", "/feed?tab=collections");
    expect(screen.getByRole("heading", { level: 1, name: "Collection" })).toBeInTheDocument();
    expect(useShellStore.getState().pushedTitle).toBe("Collection");
    expect(screen.queryByRole("list", { name: "Videos" })).toBeNull();
    expect(countLine()).toBeNull();
  });

  it("the read failed: the sentence and Try again, which asks the server again; titled Collection", () => {
    render(<CollectionNext collection={null} failed />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load this collection.");
    expect(screen.getByRole("heading", { level: 1, name: "Collection" })).toBeInTheDocument();
    expect(useShellStore.getState().pushedTitle).toBe("Collection");
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: "Back to Discover" })).toBeNull();
  });
});

describe("CollectionNextLoading — the page's own outline", () => {
  it("is busy, shows card outlines, no count and no card; titled Collection (the name is not read yet)", () => {
    render(<CollectionNextLoading />);
    expect(screen.getByRole("heading", { level: 1, name: "Collection" })).toBeInTheDocument();
    expect(useShellStore.getState().pushedTitle).toBe("Collection");
    const list = screen.getByRole("list", { name: "Videos" });
    expect(list).toHaveAttribute("aria-busy", "true");
    expect(list.querySelectorAll("li").length).toBeGreaterThan(0);
    expect(within(list).queryAllByRole("link")).toHaveLength(0);
    expect(countLine()).toBeNull();
  });
});
