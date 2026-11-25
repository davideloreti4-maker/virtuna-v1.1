/** @vitest-environment happy-dom */

/**
 * CreatorScreen: a followed creator's page (spec 3.2 to 3.5; drawing frames 2 to 4) and its states. The
 * real screen, card, More (standing on Library's layer, Radix underneath), figures, pulled cards and
 * desktop header. Stand-ins only at the edges: the router (the header's Back), `matchMedia` (a phone or a
 * desk), the page's clock where a press is timed (`performance.now`) and the build-time flag. Every
 * handle, id and address is made up.
 */

import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import type { Figure } from "@/lib/audience-next/audience-model";
import type { CreatorPage } from "@/lib/discover-next/creator";
import type { PulledVideo } from "@/lib/discover-next/pull";
import { useShellStore } from "@/stores/shell-store";

vi.setConfig({ testTimeout: 20_000 });

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

const router = { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/competitors/jay.makes",
  useRouter: () => router,
}));

import { CreatorScreen, type CreatorActions } from "../creator-screen";

// ─── Fixtures (made-up) ──────────────────────────────────────────────────────

/** Twelve videos of one read, biggest jump first: three proven (3× or more), the fourth at 2.7×. */
const JUMPS = [12, 4.8, 3.2, 2.7, 1.7, 1.5, 1.3, 1.2, 1.1, 1, 0.9, 0.8];
const VIEWS = [106_100, 41_300, 27_500, 23_000, 14_400, 12_900, 11_200, 10_500, 10_000, 8_600, 7_100, 6_000];
const LINES = [
  "I built a desk with no tools",
  "The joint nobody teaches you",
  "Stop sanding like this",
  "A chair from one board",
  "Why my shelves never sag",
  "The cheapest workbench that lasts",
  "Three cuts, one drawer",
  "I tried a hand plane for a week",
  "What glue actually holds",
  "A table that folds flat",
  "Fixing a wobbly leg",
  "My first dovetail, again",
];

function video(n: number, over: Partial<PulledVideo> = {}): PulledVideo {
  const multiplier = JUMPS[n]!;
  return {
    id: `v${String(n + 1).padStart(2, "0")}`,
    coverUrl: `https://covers.example/v${n + 1}.jpg`,
    handle: "jay.makes",
    spokenHook: LINES[n]!,
    niche: null,
    platform: "tiktok",
    views: VIEWS[n]!,
    postedAt: "2026-07-12T10:00:00.000Z",
    multiplier,
    baselineLabel: "vs their average",
    proven: multiplier >= 3,
    extreme: false,
    formats: [],
    captioned: true,
    likes: 4_200,
    comments: 310,
    videoUrl: `https://videos.example/v${n + 1}`,
    ...over,
  };
}

const VIDEOS: PulledVideo[] = JUMPS.map((_, n) => video(n));

const FIGURES: Figure[] = [
  { key: "followers", label: "Followers", value: "15.4M" },
  { key: "likes", label: "Likes", value: "369.1M" },
  { key: "posts", label: "Posts", value: "6,364" },
  { key: "usual", label: "Usual views", value: "8.6K" },
];

const BIO = "Furniture from hand tools, one board at a time.";

function creator(over: Partial<CreatorPage> = {}): CreatorPage {
  return {
    handle: "jay.makes",
    name: "Jay Makes",
    bio: BIO,
    avatarUrl: "https://store.example/jay.jpg",
    held: false,
    read: "read 13 Jul",
    canReadAgain: true,
    figures: FIGURES,
    videos: VIDEOS,
    audience: null,
    removal: { trackedIds: ["t-1"], competitorId: "p-1" },
    ...over,
  };
}

/** A creator whose read failed with nothing kept, as the server read hands it on. */
const HELD: Partial<CreatorPage> = { held: true, name: null, bio: null, avatarUrl: null, figures: [], videos: [] };

/** A handle Maven cannot read (longer than a TikTok handle): no Pull, no profile link. */
const UNREADABLE = "a.handle.far.too.long.for.maven";

function actions(over: Partial<CreatorActions> = {}): CreatorActions {
  return {
    reading: false,
    onReadAgain: vi.fn(),
    simulating: false,
    onSimulate: vi.fn(),
    onPull: vi.fn(),
    onOpen: vi.fn(),
    onRemove: vi.fn(),
    ...over,
  };
}

function renderReady(over: Partial<CreatorPage> = {}, handlers: Partial<CreatorActions> = {}) {
  const a = actions(handlers);
  const view = render(<CreatorScreen state="ready" creator={creator(over)} {...a} />);
  return { a, ...view };
}

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
  widthIs("phone");
  for (const fn of Object.values(router)) fn.mockReset();
  useShellStore.setState({ pushedTitle: "" });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ─── Reading the screen ──────────────────────────────────────────────────────

const classes = (el: Element | null) => (el?.getAttribute("class") ?? "").split(/\s+/);
const page = () => screen.getByTestId("creator-next");
const title = () => screen.getByRole("heading", { level: 1 });
/** The desktop header: Back, the title, and what stands at its right. */
const header = () => title().parentElement!;
const card = () => document.querySelector<HTMLElement>('[data-part="creator-card"]')!;
const cardHeading = () => within(card()).getByRole("heading", { level: 2 });
/** The card's one line under the heading. */
const cardLine = () => card().querySelector<HTMLElement>("[aria-live]")!;
const readAgain = () => within(card()).getByRole("button", { name: "Read again" });
const MORE = "More: @jay.makes";
const cardMore = () => within(card()).getByRole("button", { name: MORE });
const headerMore = () => within(header()).getByRole("button", { name: MORE });
const moreOf = (view: "phone" | "desk") => (view === "phone" ? cardMore() : headerMore());
const left = () => document.querySelector<HTMLElement>('[data-part="creator"]')!;
const videos = () => document.querySelector<HTMLElement>('[data-part="videos"]');
const list = () => screen.getByRole("list", { name: "Their videos" });
const cards = () => within(list()).getAllByRole("button");

const dialog = () => screen.getByRole("dialog");
const item = (name: string) => within(dialog()).getByRole("button", { name });
const rowsOf = () => Array.from(dialog().querySelectorAll<HTMLElement>('[data-part="menu-row"]'));
/** The rows of the open step, top to bottom: each control's words, or a row's first line. */
const rows = () =>
  rowsOf().map((r) => {
    const control = r.querySelector("button, a");
    return control ? control.textContent : (r.querySelector("p") ?? r).textContent;
  });
const confirming = () => within(rowsOf().at(-1)!).getByRole("button", { name: "Remove" });
const open = (more: HTMLElement) => {
  more.focus();
  fireEvent.click(more);
};
/** Radix hands the focus back on a timer once the layer is gone. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));
function clock() {
  vi.useFakeTimers({ toFake: ["performance"] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}
const later = (ms: number) => vi.advanceTimersByTime(ms);

/** The nearest element above `el` that is a size container: what its `@min-[…]` classes ask. */
function containerOf(el: Element): Element | null {
  let at = el.parentElement;
  while (at && !classes(at).includes("@container")) at = at.parentElement;
  return at;
}
/** The length one of an element's classes carries, in px: `pt-2.5` (steps of 4), `pb-[11px]`, `leading-6`. */
function lengthOf(el: Element, prefix: string): number {
  const found = classes(el).find((c) => c.startsWith(`${prefix}-`));
  if (!found) throw new Error(`no ${prefix}- class on ${el.outerHTML.slice(0, 80)}`);
  const value = found.slice(prefix.length + 1);
  const px = /^\[(\d+(?:\.\d+)?)px\]$/.exec(value);
  return px ? Number(px[1]) : Number(value) * 4;
}
/** The class that sets an element's drawn height under the new look (`next:h-[50px]`), as a plain class. */
const heightClassOf = (el: Element) => classes(el).find((c) => /^next:h-/.test(c))?.replace(/^next:/, "");

// ─── The states that are not the creator ─────────────────────────────────────

describe("CreatorScreen — before, or without, the creator", () => {
  it("loading: the outline, busy, titled Creator", () => {
    render(<CreatorScreen state="loading" />);
    expect(title()).toHaveTextContent("Creator");
    expect(useShellStore.getState().pushedTitle).toBe("Creator");
    expect(page()).toHaveAttribute("aria-busy", "true");
    // The card, the four tiles and the two buttons, in a column a screen reader skips.
    const column = page().querySelector<HTMLElement>('div[aria-hidden="true"]')!;
    expect(column.querySelectorAll('[data-part="outline"]')).toHaveLength(7);
    // The grid's outline: a busy list with nothing to press.
    const grid = screen.getByRole("list", { name: "Videos" });
    expect(grid).toHaveAttribute("aria-busy", "true");
    expect(grid.querySelectorAll('[data-part="outline"]').length).toBeGreaterThan(0);
    // Nothing to press but the header's Back; no creator, no menu.
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Back"]);
    expect(screen.queryByRole("link")).toBeNull();
    expect(card()).toBeNull();
  });

  it("loading: the outline has the real blocks' sizes, so nothing jumps when the page lands", () => {
    // The real page, measured by its own classes.
    const real = renderReady();
    const columns = left().parentElement!.className;
    const creatorColumn = left().className;
    const figures = left().querySelector("dl")!;
    const tile = figures.firstElementChild!;
    const tileHeight =
      lengthOf(tile, "pt") +
      lengthOf(tile, "pb") +
      lengthOf(tile.querySelector("dt")!, "leading") +
      lengthOf(tile.querySelector("dd")!, "mt") +
      lengthOf(tile.querySelector("dd")!, "leading");
    const tileRadius = classes(tile).find((c) => c.startsWith("rounded-"));
    const buttonHeights = [screen.getByRole("link", { name: "Build their audience" }), screen.getByRole("button", { name: /^Pull/ })].map(heightClassOf);
    const headRow = videos()!.firstElementChild!.className;
    const gridBox = list().parentElement!.className;
    const grid = list().className;
    real.unmount();

    render(<CreatorScreen state="loading" />);
    const outlineColumns = page().querySelector<HTMLElement>('div[aria-hidden="true"]')!;
    // The same two columns, and the creator's column the same.
    expect(outlineColumns.parentElement!.className).toBe(columns);
    expect(outlineColumns.className).toBe(creatorColumn);
    const [cardOutline, tiles, ...buttons] = Array.from(outlineColumns.children);
    expect(cardOutline).toHaveAttribute("data-part", "outline");
    // The tiles: the figures' own grid rule (two by two in a narrow column, four in a row from 360), at the
    // real tile's height and corners.
    expect(tileHeight).toBe(63);
    expect(classes(tiles!).sort()).toEqual(classes(figures).sort());
    expect(tiles!.children).toHaveLength(4);
    for (const outline of Array.from(tiles!.children)) {
      expect(classes(outline)).toEqual(expect.arrayContaining([`h-[${tileHeight}px]`, tileRadius]));
    }
    // The two buttons at the real buttons' height.
    expect(buttonHeights).toEqual(["h-[50px]", "h-[50px]"]);
    expect(buttons).toHaveLength(2);
    for (const outline of buttons) expect(classes(outline)).toEqual(expect.arrayContaining([buttonHeights[0], "rounded-full"]));
    // The grid's outline starts where the grid will: under a row of the heading row's height, in the same box.
    const outlineGrid = screen.getByRole("list", { name: "Videos" });
    expect(outlineGrid.className).toBe(grid);
    expect(outlineGrid.parentElement!.className).toBe(gridBox);
    const outlineHead = outlineGrid.parentElement!.previousElementSibling!;
    expect(outlineHead.className).toBe(headRow);
    expect(outlineHead).toHaveAttribute("aria-hidden", "true");
    expect(outlineHead.childNodes).toHaveLength(0);
  });

  it("gone: the sentence and the way to the Watchlist", () => {
    render(<CreatorScreen state="gone" />);
    expect(title()).toHaveTextContent("Creator");
    expect(useShellStore.getState().pushedTitle).toBe("Creator");
    expect(screen.getByText("This creator isn't on your watchlist.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Watchlist" })).toHaveAttribute("href", "/feed?tab=watchlist");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(page()).not.toHaveAttribute("aria-busy");
    expect(card()).toBeNull();
  });

  it("failed: an alert and Try again", () => {
    const onRetry = vi.fn();
    render(<CreatorScreen state="failed" onRetry={onRetry} />);
    expect(title()).toHaveTextContent("Creator");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load this creator.");
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: "Watchlist" })).toBeNull();
  });
});

// ─── The creator ─────────────────────────────────────────────────────────────

describe("CreatorScreen — who they are", () => {
  it("ready: titled by the handle, on the phone's band and the desk's header", () => {
    const view = renderReady();
    expect(title()).toHaveTextContent("@jay.makes");
    expect(useShellStore.getState().pushedTitle).toBe("@jay.makes");
    expect(page()).not.toHaveAttribute("aria-busy");
    view.unmount();
    expect(useShellStore.getState().pushedTitle).toBe("");
  });

  it("the card: the picture, the name, the line, the bio", () => {
    renderReady();
    const picture = card().querySelector<HTMLImageElement>("[data-face] img")!;
    expect(picture).toHaveAttribute("src", "https://store.example/jay.jpg");
    expect(picture).toHaveAttribute("alt", "");
    expect(cardHeading()).toHaveTextContent("Jay Makes");
    expect(cardLine().textContent).toBe("@jay.makes · TikTok · read\u00a013\u00a0Jul · 12\u00a0videos");
    expect(card().querySelector('[data-part="bio"]')!.textContent).toBe(BIO);
  });

  it("no picture: the initial on the disc", () => {
    renderReady({ avatarUrl: null });
    const face = card().querySelector<HTMLElement>("[data-face]")!;
    expect(face.querySelector("img")).toBeNull();
    expect(face).toHaveTextContent("J");
  });

  it("no name: the handle is the heading and the line leaves it out", () => {
    renderReady({ name: null });
    expect(cardHeading()).toHaveTextContent("@jay.makes");
    expect(cardLine().textContent).toBe("TikTok · read\u00a013\u00a0Jul · 12\u00a0videos");
  });

  it("a part not known is left out with its dot", () => {
    renderReady({ read: null, videos: [] });
    expect(cardLine().textContent).toBe("@jay.makes · TikTok");
  });

  it("no bio: nothing under the row", () => {
    renderReady({ bio: null });
    expect(card().querySelector('[data-part="bio"]')).toBeNull();
    expect(card().children).toHaveLength(1);
  });

  it("a stranger's name and bio cannot widen the card or the page: the name at two lines, the bio at three, long words broken", () => {
    const name = "N".repeat(300);
    const bio = `${"b".repeat(300)} ${"word ".repeat(340)}`.trim();
    expect(bio.length).toBeGreaterThanOrEqual(2000);
    renderReady({ name, bio });
    // The name: two lines at most, an unbroken run broken (a 320 phone leaves its words about 104 wide), in
    // a column that may shrink beside the picture and the buttons.
    expect(cardHeading().textContent).toBe(name);
    expect(classes(cardHeading())).toEqual(expect.arrayContaining(["line-clamp-2", "break-words"]));
    expect(classes(cardHeading())).not.toContain("truncate");
    expect(classes(cardHeading().parentElement)).toEqual(expect.arrayContaining(["min-w-0", "flex-1"]));
    // The line under it wraps, and breaks a word longer than the column.
    expect(classes(cardLine())).toContain("break-words");
    expect(classes(cardLine())).not.toContain("truncate");
    // The bio: three lines at most, an unbroken run broken.
    const bioLine = card().querySelector<HTMLElement>('[data-part="bio"]')!;
    expect(bioLine.textContent).toBe(bio);
    expect(classes(bioLine)).toEqual(expect.arrayContaining(["line-clamp-3", "break-words"]));
    // The buttons keep their size; the columns may shrink under what they hold.
    expect(classes(readAgain().parentElement)).toContain("shrink-0");
    expect(classes(left())).toContain("min-w-0");
    expect(classes(videos())).toContain("min-w-0");
  });

  it("the figures: those known share the row", () => {
    const view = renderReady();
    expect(within(left()).getAllByRole("term").map((t) => t.textContent)).toEqual(["Followers", "Likes", "Posts", "Usual views"]);
    expect(within(left()).getAllByRole("definition").map((d) => d.textContent)).toEqual(["15.4M", "369.1M", "6,364", "8.6K"]);
    view.unmount();

    const two = renderReady({ figures: [FIGURES[0]!, FIGURES[3]!] });
    expect(within(left()).getAllByRole("term").map((t) => t.textContent)).toEqual(["Followers", "Usual views"]);
    two.unmount();

    renderReady({ figures: [] });
    expect(document.querySelector("dl")).toBeNull();
  });
});

describe("CreatorScreen — the main button", () => {
  it("no audience of theirs: Build their audience, a link to the new-audience page with the handle", () => {
    renderReady();
    const link = screen.getByRole("link", { name: "Build their audience" });
    expect(link).toHaveAttribute("href", "/audience/new?door=handle&handle=jay.makes");
    expect(link).toHaveAccessibleDescription("Then simulate your video for their viewers. About two minutes. Free.");
    expect(screen.queryByRole("button", { name: "Simulate a video for their viewers" })).toBeNull();
  });

  it("their audience: Simulate a video for their viewers, with the day it was built", () => {
    const view = renderReady({ audience: { id: "aud-1", builtOn: "14 Nov" } });
    const button = screen.getByRole("button", { name: "Simulate a video for their viewers" });
    expect(button).toHaveAccessibleDescription("Their audience was built 14 Nov.");
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button).not.toHaveAttribute("aria-disabled");
    fireEvent.click(button);
    expect(view.a.onSimulate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: "Build their audience" })).toBeNull();
    view.unmount();

    renderReady({ audience: { id: "aud-1", builtOn: null } });
    expect(screen.getByRole("button", { name: "Simulate a video for their viewers" })).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByText(/Their audience was built/)).toBeNull();
  });

  it("simulating: the button waits, and a press does nothing", () => {
    const { a } = renderReady({ audience: { id: "aud-1", builtOn: "14 Nov" } }, { simulating: true });
    const button = screen.getByRole("button", { name: "Simulate a video for their viewers" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    // Still in the tab order: the focus it holds must not drop to the page.
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(a.onSimulate).not.toHaveBeenCalled();
  });

  it("Pull their best videos · 5 credits calls onPull; a handle Maven cannot read has no Pull", () => {
    const view = renderReady();
    fireEvent.click(screen.getByRole("button", { name: "Pull their best videos · 5 credits" }));
    expect(view.a.onPull).toHaveBeenCalledTimes(1);
    expect(view.a.onSimulate).not.toHaveBeenCalled();
    view.unmount();

    renderReady({ handle: UNREADABLE });
    expect(screen.queryByRole("button", { name: /^Pull/ })).toBeNull();
    // The rest of the column stands.
    expect(screen.getByRole("link", { name: "Build their audience" })).toBeInTheDocument();
  });

  it("Pull is a white pill on the resting shadow, as the card and the tiles stand; it lifts on hover and presses as a white control", () => {
    renderReady();
    const pull = classes(screen.getByRole("button", { name: "Pull their best videos · 5 credits" }));
    // The ground the card and the figures' tiles stand on.
    expect(pull).toEqual(expect.arrayContaining(["next:bg-surface", "next:shadow-[var(--shadow-rest)]"]));
    // Hovered, the shadow lifts (Home's white cards); pressed, it shrinks a little (every control). The
    // ground stays white: no grey tint at rest, hovered or pressed.
    expect(pull).toEqual(expect.arrayContaining(["next:hover:shadow-[var(--shadow-lift)]", "next:motion-safe:active:scale-[0.98]"]));
    expect(pull).toEqual(expect.arrayContaining(["next:hover:bg-surface", "next:active:bg-surface"]));
    for (const tint of ["next:bg-surface-sunken", "next:hover:bg-active", "next:active:bg-active"]) expect(pull).not.toContain(tint);
    // The same height, corners and type as the main button beside it.
    expect(pull).toEqual(expect.arrayContaining(["next:h-[50px]", "next:rounded-full", "next:text-ui", "next:font-[640]"]));
  });
});

describe("CreatorScreen — their videos", () => {
  it("biggest jump first, each a button opening its sheet, the views at its foot, no handle", () => {
    const { a } = renderReady();
    const section = screen.getByRole("region", { name: "Their videos" });
    expect(within(section).getByRole("heading", { level: 2, name: "Their videos" })).toBeInTheDocument();
    expect(within(section).getByText("Biggest jump")).toBeInTheDocument();
    expect(cards().map((c) => c.getAttribute("aria-label"))).toEqual(LINES);
    const [first] = cards();
    expect(first).toHaveAccessibleDescription("12× 106K views");
    expect(first!.querySelector('[data-part="views"]')!.textContent).toBe("106K views");
    expect(first).toHaveAttribute("aria-haspopup", "dialog");
    // Every card is theirs: the handle is not said again.
    expect(list().textContent).not.toContain("jay.makes");
    expect(list().querySelector('[data-part="handle"]')).toBeNull();
    fireEvent.click(cards()[4]!);
    expect(a.onOpen).toHaveBeenCalledTimes(1);
    expect(a.onOpen).toHaveBeenCalledWith(VIDEOS[4], cards()[4]);
  });

  it("the heading line: Their videos and Biggest jump one size, the heading at its weight, the order word regular and quiet", () => {
    renderReady();
    const heading = within(videos()!).getByRole("heading", { level: 2, name: "Their videos" });
    const order = within(videos()!).getByText("Biggest jump");
    expect(classes(heading)).toEqual(expect.arrayContaining(["text-ui", "font-[640]", "text-foreground"]));
    expect(classes(heading)).not.toContain("text-reading");
    expect(classes(order)).toEqual(expect.arrayContaining(["text-ui", "text-foreground-secondary"]));
    expect(order.className).not.toMatch(/(^|\s)font-/);
  });

  it("the badge only on a proven video", () => {
    renderReady();
    const badges = cards().map((c) => c.querySelector('[data-part="badge"]')?.textContent ?? null);
    expect(badges).toEqual(["12×", "4.8×", "3.2×", null, null, null, null, null, null, null, null, null]);
    const fourth = cards()[3]!;
    expect(within(fourth).queryByText(/×/)).toBeNull();
    expect(fourth).toHaveAccessibleDescription("23K views");
  });

  it("no videos read: the sentence where the grid would be", () => {
    renderReady({ videos: [] });
    const section = screen.getByRole("region", { name: "Their videos" });
    expect(within(section).getByText("No videos read yet. Read again to get their latest.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Their videos" })).toBeNull();
    expect(screen.queryByText("Biggest jump")).toBeNull();
    // The card, the figures and the buttons stand.
    expect(within(left()).getAllByRole("term")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Build their audience" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pull their best videos · 5 credits" })).toBeInTheDocument();
  });

  it("no videos read, and read today: the sentence does not send them to the dimmed Read again", () => {
    renderReady({ videos: [], canReadAgain: false });
    const section = screen.getByRole("region", { name: "Their videos" });
    expect(within(section).getByText("No videos read yet.")).toBeInTheDocument();
    expect(section.textContent).not.toMatch(/Read again/);
    expect(readAgain()).toHaveAttribute("aria-disabled", "true");
  });
});

describe("CreatorScreen — Read again", () => {
  it("a press reads", () => {
    const { a } = renderReady();
    const button = readAgain();
    expect(button).not.toHaveAttribute("aria-disabled");
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button).not.toHaveAttribute("aria-describedby");
    expect(classes(button.querySelector("svg"))).not.toContain("motion-safe:animate-spin");
    fireEvent.click(button);
    expect(a.onReadAgain).toHaveBeenCalledTimes(1);
  });

  it("read today: Read again is dimmed and says why; a press still asks", () => {
    const { a } = renderReady({ canReadAgain: false });
    const button = readAgain();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("aria-busy");
    expect(classes(button)).toContain("opacity-40");
    expect(button).toHaveAccessibleDescription("Read today. Maven reads a creator once a day.");
    // Said to a screen reader only: the container says it to everyone when pressed.
    expect(classes(document.getElementById(button.getAttribute("aria-describedby")!))).toContain("sr-only");
    fireEvent.click(button);
    expect(a.onReadAgain).toHaveBeenCalledTimes(1);
  });

  it("reading: Read again turns, only where motion is allowed, and the line says Reading…", () => {
    const { a } = renderReady({}, { reading: true });
    const button = readAgain();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
    const glyph = classes(button.querySelector("svg"));
    expect(glyph).toContain("motion-safe:animate-spin");
    expect(glyph).not.toContain("animate-spin");
    expect(cardLine().textContent).toBe("@jay.makes · TikTok · Reading… · 12\u00a0videos");
    expect(cardLine()).toHaveAttribute("aria-live", "polite");
    fireEvent.click(button);
    expect(a.onReadAgain).not.toHaveBeenCalled();
  });

  it("reading a creator read today: busy, not dimmed, and it does not say Read today", () => {
    renderReady({ canReadAgain: false }, { reading: true });
    const button = readAgain();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(classes(button)).not.toContain("opacity-40");
    expect(button).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByText("Read today. Maven reads a creator once a day.")).toBeNull();
  });
});

describe("CreatorScreen — a creator that could not be read", () => {
  it("held: the initial, the handle, Couldn't be read, Read again and More, one sentence, nothing else", () => {
    // What the server read may still hand on with a held creator (a date, an audience) changes nothing.
    const { a } = renderReady({ ...HELD, read: "read 13 Jul", audience: { id: "aud-1", builtOn: "14 Nov" } });
    expect(title()).toHaveTextContent("@jay.makes");
    const face = card().querySelector<HTMLElement>("[data-face]")!;
    expect(face.querySelector("img")).toBeNull();
    expect(face).toHaveTextContent("J");
    expect(cardHeading()).toHaveTextContent("@jay.makes");
    expect(cardLine().textContent).toBe("Couldn't be read");
    expect(card().querySelector('[data-part="bio"]')).toBeNull();
    expect(cardMore()).toBeInTheDocument();
    expect(headerMore()).toBeInTheDocument();
    expect(screen.getByText("Maven couldn't read this account. Read again, or remove it.")).toBeInTheDocument();
    // No figures, no main button, no Pull, no videos.
    expect(document.querySelector("dl")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button", { name: "Simulate a video for their viewers" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Pull/ })).toBeNull();
    expect(screen.queryByText("Their videos")).toBeNull();
    expect(videos()).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    // The card is the column's first part, the sentence its last.
    expect(left().children).toHaveLength(2);
    fireEvent.click(readAgain());
    expect(a.onReadAgain).toHaveBeenCalledTimes(1);
  });

  it("held, while a read is out: the line says Reading… (once, politely); when it ends with nothing new, Couldn't be read again", () => {
    const held = creator(HELD);
    const view = render(<CreatorScreen state="ready" creator={held} {...actions({ reading: true })} />);
    expect(readAgain()).toHaveAttribute("aria-busy", "true");
    expect(cardLine().textContent).toBe("Reading…");
    expect(cardLine()).toHaveAttribute("aria-live", "polite");
    expect(cardHeading()).toHaveTextContent("@jay.makes");

    view.rerender(<CreatorScreen state="ready" creator={held} {...actions({ reading: false })} />);
    expect(readAgain()).not.toHaveAttribute("aria-busy");
    expect(cardLine().textContent).toBe("Couldn't be read");
  });

  it("held, with a name and a bio still on the record: neither is shown", () => {
    renderReady({ held: true, figures: [], videos: [] });
    expect(cardHeading()).toHaveTextContent("@jay.makes");
    expect(cardLine().textContent).toBe("Couldn't be read");
    expect(card().querySelector('[data-part="bio"]')).toBeNull();
    expect(card().querySelector("[data-face] img")).toBeNull();
  });
});

// ─── More ────────────────────────────────────────────────────────────────────

describe("CreatorScreen — More", () => {
  it("stands twice: in the card on a phone, in the header on a desk", () => {
    renderReady();
    expect(screen.getAllByRole("button", { name: MORE })).toHaveLength(2);
    // The card's goes from 768, where the header (hidden under it) shows its own.
    expect(classes(cardMore().parentElement)).toEqual(expect.arrayContaining(["flex", "md:hidden"]));
    expect(classes(header())).toEqual(expect.arrayContaining(["hidden", "md:flex"]));
    expect(card().contains(headerMore())).toBe(false);
    // In the card it follows Read again.
    expect(readAgain().compareDocumentPosition(cardMore()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const more of [cardMore(), headerMore()]) {
      expect(more).toHaveAttribute("aria-haspopup", "dialog");
      expect(more).toHaveAttribute("aria-expanded", "false");
    }
  });

  it("on a phone: Open on TikTok in a new tab, Remove; the focus on Open on TikTok", () => {
    renderReady();
    open(cardMore());
    expect(screen.getByRole("dialog", { name: "@jay.makes" })).toBeInTheDocument();
    // A bottom sheet over the page.
    expect(document.querySelector('[data-slot="sheet-overlay"]')).not.toBeNull();
    expect(rows()).toEqual(["Open on TikTok", "Remove"]);
    const link = within(dialog()).getByRole("link", { name: "Open on TikTok, opens in a new tab" });
    expect(link).toHaveAttribute("href", "https://www.tiktok.com/@jay.makes");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveFocus();
  });

  it("on a desk: a menu standing on the header's button; Escape gives the focus back to it", async () => {
    widthIs("desk");
    const user = userEvent.setup();
    renderReady();
    const more = headerMore();
    more.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "@jay.makes" })).toHaveAttribute("data-slot", "popover-content");
    expect(dialog()).toHaveAttribute("data-side");
    expect(document.querySelector('[data-slot="sheet-overlay"]')).toBeNull();
    expect(rows()).toEqual(["Open on TikTok", "Remove"]);
    expect(within(dialog()).getByRole("link", { name: /Open on TikTok/ })).toHaveFocus();
    await user.keyboard("{Escape}");
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more).toHaveFocus();
  });

  it("a tap focuses More (Safari does not), so the focus has a place to come back to", () => {
    renderReady();
    const more = cardMore();
    const focused = vi.fn();
    more.addEventListener("focus", focused);
    fireEvent.click(more);
    expect(focused).toHaveBeenCalledTimes(1);
  });

  it("Open on TikTok closes the menu", async () => {
    renderReady();
    open(cardMore());
    const link = within(dialog()).getByRole("link", { name: /Open on TikTok/ });
    link.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(link);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("no records to clear: no Remove; nothing to offer: no More", () => {
    const view = renderReady({ removal: null });
    open(cardMore());
    expect(rows()).toEqual(["Open on TikTok"]);
    view.unmount();

    renderReady({ handle: UNREADABLE, removal: null });
    expect(screen.queryByRole("button", { name: /^More/ })).toBeNull();
    // Read again stands alone at the card's right: the empty place takes no room beside it.
    const group = readAgain().parentElement!;
    expect(within(group).getAllByRole("button")).toHaveLength(1);
    const place = group.querySelector<HTMLElement>(".md\\:hidden")!;
    expect(place.childNodes).toHaveLength(0);
    expect(classes(place)).toContain("empty:hidden");
  });

  it("a handle Maven cannot read: Remove alone, with the focus", () => {
    renderReady({ handle: UNREADABLE });
    open(within(card()).getByRole("button", { name: `More: @${UNREADABLE}` }));
    expect(screen.getByRole("dialog", { name: `@${UNREADABLE}` })).toBeInTheDocument();
    expect(rows()).toEqual(["Remove"]);
    expect(item("Remove")).toHaveFocus();
  });
});

describe.each(["phone", "desk"] as const)("CreatorScreen — Remove is asked once (%s)", (view) => {
  beforeEach(() => widthIs(view));

  it("Remove asks once more; a second press within 500 ms does nothing; after it, onRemove once, the focus on More", async () => {
    clock();
    let focused: Element | null = null;
    const onRemove = vi.fn(() => {
      focused = document.activeElement;
    });
    renderReady({}, { onRemove });
    const more = moreOf(view);
    open(more);
    fireEvent.click(item("Remove"));
    expect(rows()).toEqual(["Remove @jay.makes?", "Cancel", "Remove"]);
    expect(item("Cancel")).toHaveFocus();
    expect(confirming()).toHaveAccessibleDescription("Remove @jay.makes?");
    expect(onRemove).not.toHaveBeenCalled();

    later(100);
    fireEvent.click(confirming());
    later(300);
    fireEvent.click(confirming());
    expect(onRemove).not.toHaveBeenCalled();
    expect(within(dialog()).getByText("Remove @jay.makes?")).toBeInTheDocument();

    later(200);
    const confirm = confirming();
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(focused).toBe(more);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Cancel: nothing removed, the focus back on More; it opens on the menu again", async () => {
    const { a } = renderReady();
    const more = moreOf(view);
    open(more);
    fireEvent.click(item("Remove"));
    fireEvent.click(item("Cancel"));
    await settle();
    expect(a.onRemove).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more).toHaveFocus();
    open(more);
    expect(rows()).toEqual(["Open on TikTok", "Remove"]);
  });
});

// ─── The desk ────────────────────────────────────────────────────────────────

describe("CreatorScreen — the desk", () => {
  it("two columns where the page's body is 760 wide or more, split by the body's width, not the window's", () => {
    renderReady();
    const columns = left().parentElement!;
    const body = columns.parentElement!;
    // The page's body is the video page's (980 wide, centred), and the size container the columns ask.
    expect(classes(body)).toEqual(expect.arrayContaining(["@container", "mx-auto", "w-full", "max-w-[980px]"]));
    expect(containerOf(columns)).toBe(body);
    // One column under 760 (the creator's blocks first, then the videos, as on a phone); from 760 the creator
    // at the left (about 287 or more) and their videos at the right, in the video page's fractions and gaps.
    expect(classes(columns)).toEqual(
      expect.arrayContaining([
        "flex",
        "flex-col",
        "gap-4",
        "@min-[760px]:grid",
        "@min-[760px]:grid-cols-[minmax(0,372fr)_minmax(0,588fr)]",
        "@min-[760px]:items-start",
        "@min-[760px]:gap-5",
      ]),
    );
    // Nothing of the split by the window's width, nor of an earlier split point.
    expect(columns.className).not.toMatch(/(^|\s)md:/);
    expect(columns.className).not.toMatch(/@min-\[(?!760px\])/);
    expect(Array.from(columns.children)).toEqual([left(), videos()]);
  });

  it("in one column the creator's blocks take the body's whole width, their right edge on the grid's", () => {
    renderReady();
    // No cap, at any width: the column is as wide as the videos under it.
    expect(left().className).not.toMatch(/max-w-/);
    expect(videos()!.className).not.toMatch(/max-w-/);
    expect(classes(left())).not.toContain("mx-auto");
    expect(classes(left())).not.toContain("self-center");
  });

  it("each grid asks its own column: the figures the creator's, the cards their own box, not the page's body", () => {
    renderReady();
    expect(containerOf(left().querySelector("dl")!)).toBe(left());
    expect(containerOf(list())).toBe(list().parentElement);
    expect(videos()!.contains(list().parentElement)).toBe(true);
  });

  it("the card's parts in the order they are read: the picture, the words, Read again, More", () => {
    renderReady();
    const row = card().firstElementChild!;
    expect(row.children).toHaveLength(3);
    expect(row.children[0]).toHaveAttribute("data-face");
    expect(row.children[1]).toContainElement(cardHeading());
    expect(row.children[2]).toContainElement(readAgain());
    expect(row.children[2]).toContainElement(cardMore());
  });
});

// ─── The rules every new-look part keeps ─────────────────────────────────────

describe("the creator's parts — type roles and motion", () => {
  const source = (file: string) =>
    readFileSync(join(__dirname, "..", file), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it.each(["creator-card.tsx", "creator-menu.tsx", "creator-screen.tsx"])("%s sizes its type by role and moves only where motion is allowed", (file) => {
    const src = source(file);
    // No size of its own: the roles only (`text-title`, `text-ui`, `text-reading`, `text-meta`).
    expect(src.match(/\btext-\[[^\]]*\]|\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/g) ?? []).toEqual([]);
    // No accent, and a shadow only by its token.
    expect(src.match(/\b(?:text|bg|border|ring|fill|stroke)-accent\b/g) ?? []).toEqual([]);
    expect(src.match(/(?<!--)\bshadow-(?!\[var\(--shadow-)[\w[]/g) ?? []).toEqual([]);
    // Every animation waits for the visitor's leave.
    expect(src.match(/(?<!motion-safe:)\banimate-[\w-]+/g) ?? []).toEqual([]);
  });
});

// ─── Accessibility ───────────────────────────────────────────────────────────

describe("CreatorScreen — accessibility", () => {
  it.each(["phone", "desk"] as const)("ready has no axe violations: closed, the menu open, and at the question (%s)", async (view) => {
    widthIs(view);
    const { container } = renderReady();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
    open(moreOf(view));
    // The desk's menu places itself a tick after it opens.
    await settle();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(dialog())).toHaveNoViolations();
    fireEvent.click(item("Remove"));
    await settle();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(dialog())).toHaveNoViolations();
  });

  it("ready with their audience, read today, and while reading and simulating", async () => {
    const quiet = renderReady({ audience: { id: "aud-1", builtOn: "14 Nov" }, canReadAgain: false });
    expect(readAgain()).toHaveAttribute("aria-disabled", "true");
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(quiet.container)).toHaveNoViolations();
    quiet.unmount();
    const busy = renderReady({ audience: { id: "aud-1", builtOn: "14 Nov" } }, { reading: true, simulating: true });
    expect(readAgain()).toHaveAttribute("aria-busy", "true");
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(busy.container)).toHaveNoViolations();
  });

  it.each([
    ["held", () => renderReady(HELD)],
    ["no videos", () => renderReady({ videos: [] })],
    ["gone", () => render(<CreatorScreen state="gone" />)],
    ["failed", () => render(<CreatorScreen state="failed" onRetry={() => {}} />)],
    ["loading", () => render(<CreatorScreen state="loading" />)],
  ] as const)("%s has no axe violations", async (_name, draw) => {
    const { container } = draw();
    // The state is on screen before it is checked: an empty page has nothing to fault.
    expect(container).toContainElement(page());
    expect(page().textContent !== "" || page().querySelector('[data-part="outline"]') !== null).toBe(true);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});
