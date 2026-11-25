/** @vitest-environment happy-dom */
/**
 * WatchlistRow: one followed creator on the Watchlist chip (spec 3.5; drawing frame 5). The real row,
 * standing on Library's layer (`RowMenuLayer`) with the row itself as the trigger (`renderTrigger`),
 * Radix underneath. Stand-ins: `matchMedia` (the phone's sheet or the desk's menu) and, where a test
 * times a press, the page's clock (`performance.now`). Every handle and address is made up.
 */
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import type { WatchlistSource } from "@/lib/discover/watchlist-reads";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { WatchlistRow, type WatchlistRowProps } from "../watchlist-row";

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

beforeEach(() => widthIs("phone"));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const COVERS = ["https://store.example/c1.jpg", "https://store.example/c2.jpg", "https://store.example/c3.jpg", "https://store.example/c4.jpg"];

function source(over: Partial<WatchlistSource> = {}): WatchlistSource {
  return {
    key: "p-1",
    handle: "jay.makes",
    name: "Jay Makes",
    avatarUrl: "https://store.example/jay.jpg",
    followerCount: 162_000_000,
    outlierCount: 14,
    bestMultiplier: 40,
    videosHeld: 12,
    newestPostAt: null,
    mergedFrom: null,
    held: false,
    profileHandle: "jay.makes",
    trackedIds: ["t-1"],
    competitorId: "p-1",
    covers: COVERS,
    provenCount: 12,
    ...over,
  };
}

function renderRow(over: Partial<WatchlistSource> = {}, props: Partial<Omit<WatchlistRowProps, "source">> = {}) {
  const p = { onPull: vi.fn(), onRemove: vi.fn(), ...props };
  const view = render(
    <ul>
      <li>
        <WatchlistRow source={source(over)} {...p} />
      </li>
    </ul>,
  );
  return { p, ...view };
}

const row = () => screen.getByRole("button", { name: "@jay.makes" });
const dialog = () => screen.getByRole("dialog");
const item = (name: string) => within(dialog()).getByRole("button", { name });
const rowsOf = () => Array.from(dialog().querySelectorAll<HTMLElement>('[data-part="menu-row"]'));
/** What a control shows (its words for a screen reader only left out). */
const shownText = (el: Element) => {
  const copy = el.cloneNode(true) as Element;
  copy.querySelectorAll(".sr-only").forEach((hidden) => hidden.remove());
  return copy.textContent;
};
/** The rows of the open step, top to bottom: each control's words, or a row's first line. */
const rows = () =>
  rowsOf().map((r) => {
    const control = r.querySelector("button, a");
    return control ? shownText(control) : (r.querySelector("p") ?? r).textContent;
  });
const confirming = () => within(rowsOf().at(-1)!).getByRole("button", { name: "Remove" });
const open = () => {
  row().focus();
  fireEvent.click(row());
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

describe("WatchlistRow — what the row shows", () => {
  it("the picture, @handle, the line, and at its right up to three covers", () => {
    renderRow();
    const button = row();
    const picture = button.querySelector<HTMLImageElement>('[data-part="picture"] img');
    expect(picture).toHaveAttribute("src", "https://store.example/jay.jpg");
    expect(picture).toHaveAttribute("alt", "");
    expect(button).toHaveTextContent("@jay.makes");
    expect(button).toHaveAccessibleDescription("162M followers · 12 proven");
    const covers = Array.from(button.querySelectorAll<HTMLImageElement>('[data-part="covers"] img'));
    expect(covers.map((c) => c.getAttribute("src"))).toEqual(COVERS.slice(0, 3));
    expect(button.querySelector('[data-part="covers"]')).toHaveAttribute("aria-hidden", "true");
  });

  it("the line is never cut beside the covers: it wraps to a second line", () => {
    renderRow();
    const line = document.getElementById(row().getAttribute("aria-describedby")!)!;
    expect(line).toHaveTextContent("162M followers · 12 proven");
    const classes = line.className.split(/\s+/);
    expect(classes).toContain("break-words");
    expect(classes).not.toContain("truncate");
  });

  it("covers are 36 by 48 with small corners", () => {
    renderRow();
    const tile = row().querySelector<HTMLElement>('[data-part="covers"] > *')!;
    expect(tile.className.split(/\s+/)).toEqual(expect.arrayContaining(["w-9", "h-12", "rounded-md"]));
  });

  it("no covers: none drawn", () => {
    renderRow({ covers: [] });
    expect(row().querySelector('[data-part="covers"]')).toBeNull();
  });

  it("a cover that does not load becomes the neutral tile", () => {
    renderRow();
    const first = row().querySelector<HTMLImageElement>('[data-part="covers"] img')!;
    fireEvent.error(first);
    const tiles = row().querySelectorAll('[data-part="covers"] [data-part="tile"]');
    expect(tiles).toHaveLength(1);
    expect(row().querySelectorAll('[data-part="covers"] img')).toHaveLength(2);
  });

  it("no picture: the initial on a sunken disc", () => {
    renderRow({ avatarUrl: null });
    const picture = row().querySelector<HTMLElement>('[data-part="picture"]')!;
    expect(picture.querySelector("img")).toBeNull();
    expect(picture).toHaveTextContent("J");
    expect(picture.className).toContain("bg-surface-sunken");
  });

  it("a picture that does not load: the initial", () => {
    renderRow();
    fireEvent.error(row().querySelector('[data-part="picture"] img')!);
    expect(row().querySelector('[data-part="picture"] img')).toBeNull();
    expect(row().querySelector('[data-part="picture"]')).toHaveTextContent("J");
  });

  it("a creator that could not be read says so", () => {
    renderRow({ held: true, followerCount: null, avatarUrl: null });
    expect(row()).toHaveAccessibleDescription("Couldn't be read");
  });

  it("nothing to say under the handle: no description", () => {
    renderRow({ followerCount: null, provenCount: 0 });
    expect(row()).not.toHaveAttribute("aria-describedby");
  });
});

describe("WatchlistRow — the row is the menu's trigger (RowMenuLayer's renderTrigger)", () => {
  it("one button for the whole row, in place of the three dots: it opens a dialog and says so", () => {
    renderRow();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^More/ })).toBeNull();
    expect(row()).toHaveAttribute("aria-haspopup", "dialog");
    expect(row()).toHaveAttribute("aria-expanded", "false");
    open();
    // The page behind the open layer is hidden from the accessibility tree.
    expect(screen.getByRole("button", { name: "@jay.makes", hidden: true })).toHaveAttribute("aria-expanded", "true");
  });

  it("a tap focuses the row (Safari does not), so the focus has a place to come back to", () => {
    renderRow();
    const focused = vi.fn();
    row().addEventListener("focus", focused);
    fireEvent.click(row());
    expect(focused).toHaveBeenCalledTimes(1);
  });
});

describe.each(["phone", "desk"] as const)("WatchlistRow — the menu (%s)", (view) => {
  beforeEach(() => widthIs(view));

  it("named for the creator: Pull their best videos · 5 credits, Open on TikTok, Remove; the focus on Pull", () => {
    renderRow();
    open();
    expect(screen.getByRole("dialog", { name: "@jay.makes" })).toBeInTheDocument();
    expect(rows()).toEqual(["Pull their best videos · 5 credits", "Open on TikTok", "Remove"]);
    expect(item("Pull their best videos · 5 credits")).toHaveFocus();
  });

  it("by keyboard: Enter on the row opens it with the focus on the first item; Escape closes it and the focus is back on the row", async () => {
    const user = userEvent.setup();
    renderRow();
    row().focus();
    await user.keyboard("{Enter}");
    expect(dialog()).toBeInTheDocument();
    expect(item("Pull their best videos · 5 credits")).toHaveFocus();
    await user.keyboard("{Escape}");
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(row()).toHaveFocus();
  });

  it("Open on TikTok is a link to the creator's profile, in a new tab, and says so", () => {
    renderRow();
    open();
    const link = within(dialog()).getByRole("link", { name: "Open on TikTok, opens in a new tab" });
    expect(link).toHaveAttribute("href", "https://www.tiktok.com/@jay.makes");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("Open on TikTok closes the menu", async () => {
    renderRow();
    open();
    const link = within(dialog()).getByRole("link", { name: /Open on TikTok/ });
    link.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(link);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Pull calls onPull once and closes the menu; nothing else is called", async () => {
    const { p } = renderRow();
    open();
    fireEvent.click(item("Pull their best videos · 5 credits"));
    await settle();
    expect(p.onPull).toHaveBeenCalledTimes(1);
    expect(p.onRemove).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("a handle Maven cannot read: no Pull and no Open on TikTok; the focus on Remove", () => {
    renderRow({ handle: "Chris Bumstead" });
    fireEvent.click(screen.getByRole("button", { name: "@Chris Bumstead" }));
    expect(rows()).toEqual(["Remove"]);
    expect(item("Remove")).toHaveFocus();
  });

  it("a row resting on no record it can name: no Remove", () => {
    renderRow({ trackedIds: [], competitorId: null });
    open();
    expect(rows()).toEqual(["Pull their best videos · 5 credits", "Open on TikTok"]);
  });
});

describe.each(["phone", "desk"] as const)("WatchlistRow — Remove is asked once (%s)", (view) => {
  beforeEach(() => widthIs(view));

  it('Remove asks "Remove @jay.makes?", then Cancel (focused), then Remove; nothing sent yet', () => {
    const { p } = renderRow();
    open();
    fireEvent.click(item("Remove"));
    expect(rows()).toEqual(["Remove @jay.makes?", "Cancel", "Remove"]);
    expect(item("Cancel")).toHaveFocus();
    expect(confirming()).toHaveAccessibleDescription("Remove @jay.makes?");
    expect(p.onRemove).not.toHaveBeenCalled();
  });

  it("a second press within 500 ms of the question does nothing (a double tap never removes)", () => {
    clock();
    const { p } = renderRow();
    open();
    fireEvent.click(item("Remove"));
    later(100);
    fireEvent.click(confirming());
    later(300);
    fireEvent.click(confirming());
    expect(p.onRemove).not.toHaveBeenCalled();
    expect(within(dialog()).getByText("Remove @jay.makes?")).toBeInTheDocument();
    // It looks and reads the same through the wait.
    expect(confirming()).not.toBeDisabled();
    expect(confirming()).not.toHaveAttribute("aria-disabled");
  });

  it("after 500 ms it removes, once, with the focus on the row when onRemove runs", async () => {
    clock();
    let focused: Element | null = null;
    const onRemove = vi.fn(() => (focused = document.activeElement));
    renderRow({}, { onRemove });
    open();
    fireEvent.click(item("Remove"));
    later(600);
    const confirm = confirming();
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(focused).toBe(row());
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Cancel: nothing sent, closed, the focus on the row; it opens on the menu again", async () => {
    const { p } = renderRow();
    open();
    fireEvent.click(item("Remove"));
    fireEvent.click(item("Cancel"));
    await settle();
    expect(p.onRemove).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(row()).toHaveFocus();
    open();
    expect(rows()).toEqual(["Pull their best videos · 5 credits", "Open on TikTok", "Remove"]);
  });
});

describe("WatchlistRow — nothing to offer", () => {
  it("a row with no Pull and no Remove is not a button", () => {
    renderRow({ handle: "Chris Bumstead", trackedIds: [], competitorId: null });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("@Chris Bumstead")).toBeInTheDocument();
  });
});

describe("WatchlistRow — accessibility", () => {
  it.each(["phone", "desk"] as const)("has no axe violations, closed, open, and at the question (%s)", async (view) => {
    widthIs(view);
    const { container } = renderRow();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
    open();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(dialog())).toHaveNoViolations();
    fireEvent.click(item("Remove"));
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(dialog())).toHaveNoViolations();
  });
});
