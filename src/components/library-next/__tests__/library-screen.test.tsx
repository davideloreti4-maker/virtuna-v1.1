/** @vitest-environment happy-dom */

/**
 * LibraryScreen — the new Library (spec 2026-11-23 §3, §5), rendered for real. Every value comes
 * in as a prop, so nothing is stubbed but the browser's width question (`matchMedia`): the search
 * hands the focus back to its button on a phone, where the field closes, and keeps it in the field
 * on a desk, where the field stays.
 */

import { createPortal } from "react-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";

import { MenuButton } from "@/components/shell/menu-button";

import { LibraryScreen, type ChatRowData, type LibraryScreenProps, type SavedRowData } from "../library-screen";

const realMatchMedia = window.matchMedia;

/** The window's width, as `matchMedia` answers it: a phone (under 768) or a desk. */
function widthIs(view: "phone" | "desk") {
  window.matchMedia = ((query: string) => ({
    matches: view === "desk" && /min-width:\s*768px/.test(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => widthIs("phone"));
afterEach(() => {
  cleanup();
  window.matchMedia = realMatchMedia;
});

const CHATS: ChatRowData[] = [
  {
    id: "c1",
    title: "Hook formats, the $400 test",
    pinned: true,
    line: "3 hooks · simulated 2h ago",
    lead: "hooks",
    stageWord: "Simulated",
    frame: null,
    still: null,
    gauge: { number: 66, describes: "66% would stop to watch", href: "/simulation/hook/c1/k" },
  },
  {
    id: "c2",
    title: "Remix: the $100,000 challenge",
    pinned: false,
    line: "Remix · 1d ago",
    lead: "remix",
    stageWord: "Draft",
    frame: null,
    still: null,
    gauge: null,
  },
  {
    id: "c3",
    title: "Why the last one flopped",
    pinned: false,
    line: "Chat · Oct 24",
    lead: "chat",
    stageWord: null,
    frame: null,
    still: null,
    gauge: null,
  },
];

const SAVED: SavedRowData[] = [
  { id: "s1", kind: "hooks", text: "I spent $400 testing every viral hook format.", line: "Hook · from Hook formats, the $400 test", canOpen: true },
  { id: "s2", kind: "video", text: "There's a wave of $100,000 challenges", line: "Video · saved in Discover", canOpen: false },
];

function props(over: Partial<LibraryScreenProps> = {}): LibraryScreenProps {
  return {
    filter: "all",
    onFilter: vi.fn(),
    query: "",
    onQuery: vi.fn(),
    state: "ready",
    onRetry: vi.fn(),
    chats: CHATS,
    saved: SAVED,
    hasMore: false,
    loadingMore: false,
    onMore: vi.fn(),
    onOpenChat: vi.fn(),
    onOpenSaved: vi.fn(),
    onRemoveSaved: vi.fn(),
    onNewChat: vi.fn(),
    ...over,
  };
}

const renderLibrary = (over: Partial<LibraryScreenProps> = {}) => {
  const p = props(over);
  const view = render(<LibraryScreen {...p} />);
  return { p, ...view };
};

describe("LibraryScreen — the header", () => {
  it('"Library" is the page\'s only h1', () => {
    renderLibrary();
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Library");
  });

  it("cancels the phone's top band, as Home does", () => {
    renderLibrary();
    expect(screen.getByTestId("library-next")).toHaveClass("max-md:-mt-[var(--mobile-nav-band)]");
  });
});

describe("LibraryScreen — the chips", () => {
  // After posting (plan 2026-11-24-after-posting, Task 4): a fifth chip, Posted, before Saved.
  it("five toggle buttons in a group named Filter, the current one pressed", () => {
    renderLibrary({ filter: "simulated" });
    const group = screen.getByRole("group", { name: "Filter" });
    const chips = within(group).getAllByRole("button");
    expect(chips.map((c) => c.textContent)).toEqual(["All", "Drafts", "Simulated", "Posted", "Saved"]);
    expect(chips.map((c) => c.getAttribute("aria-pressed"))).toEqual(["false", "false", "true", "false", "false"]);
  });

  it("Posted pressed under the Posted filter; a tap on it asks for that filter", () => {
    const { p } = renderLibrary({ filter: "posted" });
    const group = screen.getByRole("group", { name: "Filter" });
    expect(within(group).getByRole("button", { name: "Posted" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(group).getByRole("button", { name: "Drafts" }));
    expect(p.onFilter).toHaveBeenCalledWith("drafts");
    cleanup();
    const again = renderLibrary();
    fireEvent.click(within(screen.getByRole("group", { name: "Filter" })).getByRole("button", { name: "Posted" }));
    expect(again.p.onFilter).toHaveBeenCalledWith("posted");
  });

  it("a tap on a chip asks for that filter", () => {
    const { p } = renderLibrary();
    const group = screen.getByRole("group", { name: "Filter" });
    fireEvent.click(within(group).getByRole("button", { name: "Drafts" }));
    expect(p.onFilter).toHaveBeenCalledWith("drafts");
    fireEvent.click(within(group).getByRole("button", { name: "Saved" }));
    expect(p.onFilter).toHaveBeenLastCalledWith("saved");
  });
});

describe("LibraryScreen — the chips on a narrow phone", () => {
  it("scroll sideways from the screen's edge, and keep 16 px of trailing space inside the scroll so the last chip clears the edge", () => {
    renderLibrary();
    const group = screen.getByRole("group", { name: "Filter" });
    const classes = group.className.split(/\s+/);
    // The row runs to both screen edges (the page has 16 px gutters), the first chip at the gutter.
    expect(classes).toEqual(expect.arrayContaining(["flex", "overflow-x-auto", "-mx-4", "pl-4", "pr-0", "gap-2"]));
    // The trailing space is a spacer, not end padding (a flex scroller's end padding is not kept by
    // every browser): 8 px after the last chip's 8 px gap.
    expect(classes).toEqual(expect.arrayContaining(["after:w-2", "after:shrink-0", "after:content-['']"]));
    // Room above and below for the chips' 44 px tap areas and their shadow, without moving them.
    expect(classes).toEqual(expect.arrayContaining(["py-1.5", "-mb-1.5", "mt-1"]));
    // From 768 the row is as it was: no scroll, no bleed, no spacer.
    expect(classes).toEqual(expect.arrayContaining(["md:mx-0", "md:mt-0", "md:mb-0", "md:overflow-visible", "md:py-0", "md:pl-0", "md:after:hidden"]));
  });
});

describe("LibraryScreen — the five chips on a phone: the selected one in view (after posting)", () => {
  // Five chips do not fit at 320 to 393: the row scrolls sideways. The test has no layout engine, so
  // the row's and the chips' boxes are given here as a 393 phone draws them (the chips' own widths,
  // 8 apart, from the row's 16 inset), each chip's box following the row's scroll.
  const PHONE_WIDTH = 393;
  const CHIP_BOXES: Record<string, [number, number]> = {
    all: [16, 64],
    drafts: [72, 142],
    simulated: [150, 245],
    posted: [253, 325],
    saved: [333, 399],
  };
  const CONTENT = 399 + 16;

  function phoneLayout(fits = false) {
    const isRow = (el: Element) => el.getAttribute("role") === "group" && el.getAttribute("aria-label") === "Filter";
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (this: HTMLElement) {
      return isRow(this) ? (fits ? PHONE_WIDTH : CONTENT) : 0;
    });
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
      return isRow(this) ? PHONE_WIDTH : 0;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const box = (left: number, right: number) => ({ left, right, width: right - left, top: 0, bottom: 36, height: 36, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;
      if (isRow(this)) return box(0, PHONE_WIDTH);
      const chip = this.getAttribute("data-filter");
      const row = this.parentElement;
      if (chip && row && CHIP_BOXES[chip]) {
        const [left, right] = CHIP_BOXES[chip]!;
        return box(left - row.scrollLeft, right - row.scrollLeft);
      }
      return box(0, 0);
    });
  }
  const row = () => screen.getByRole("group", { name: "Filter" });
  afterEach(() => vi.restoreAllMocks());

  it("every chip keeps a 44 px tap area, with room for it above and below inside the scroll", () => {
    renderLibrary();
    for (const chip of within(row()).getAllByRole("button")) expect(chip).toHaveClass("tap-44", "h-9");
    // 36 drawn + 6 above and below: the 44 tap area is not cut by the scroll's edge.
    expect(row()).toHaveClass("py-1.5", "overflow-x-auto");
  });

  it("opened on Saved (cut off at the right on a 393 phone): the row is scrolled so Saved stands 16 from the edge, before the first paint", () => {
    phoneLayout();
    renderLibrary({ filter: "saved" });
    // Saved ends at 399; with 16 of room at the right edge (393) the row scrolls by 22.
    expect(row().scrollLeft).toBe(22);
  });

  it("opened on a chip already in view: nothing moves", () => {
    phoneLayout();
    renderLibrary({ filter: "posted" });
    expect(row().scrollLeft).toBe(0);
  });

  it("a chip chosen later is brought in the same way; back to All, the row scrolls back", () => {
    phoneLayout();
    const { rerender, p } = renderLibrary();
    expect(row().scrollLeft).toBe(0);
    rerender(<LibraryScreen {...p} filter="saved" />);
    expect(row().scrollLeft).toBe(22);
    rerender(<LibraryScreen {...p} filter="all" />);
    expect(row().scrollLeft).toBe(0);
  });

  it("a row that fits (a desk, a wide phone) is never scrolled", () => {
    phoneLayout(true);
    renderLibrary({ filter: "saved" });
    expect(row().scrollLeft).toBe(0);
  });

  it("only the row moves: the page itself is never scrolled sideways", () => {
    phoneLayout();
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");
    renderLibrary({ filter: "saved" });
    expect(scrolled).not.toHaveBeenCalled();
    expect(document.documentElement.scrollLeft).toBe(0);
    expect(document.body.scrollLeft).toBe(0);
  });
});

describe("LibraryScreen — the drawer's opener", () => {
  // As a container passes it; given a face, since a screen test has no shell.
  const OPENER = <MenuButton variant="picture" face={{ picture: null, initials: "NL" }} />;
  const slot = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-part="opener"]');
  const searchButton = () => screen.getByRole("button", { name: "Search" });
  const field = () => screen.getByRole("textbox", { name: "Search" });

  it("the opener sits before the heading on the phone", () => {
    const { container } = renderLibrary({ opener: OPENER });
    const opener = screen.getByRole("button", { name: "Open menu" });
    expect(opener).toHaveTextContent("NL");
    const part = slot(container)!;
    expect(part.contains(opener)).toBe(true);
    expect(part).toHaveClass("flex", "shrink-0", "md:hidden");
    expect(part).not.toHaveClass("hidden");
    // First in the header's row, the heading right after it.
    const header = part.parentElement!;
    expect(header.tagName).toBe("HEADER");
    expect(header.firstElementChild).toBe(part);
    expect(part.nextElementSibling).toBe(screen.getByRole("heading", { level: 1, name: "Library" }));
    cleanup();
    // Not given: no slot, the heading first, as before.
    const bare = renderLibrary();
    expect(slot(bare.container)).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).closest("header")!.firstElementChild).toBe(screen.getByRole("heading", { level: 1 }));
  });

  it("the opener hides while the search is open, and comes back when it closes", () => {
    const { container } = renderLibrary({ opener: OPENER });
    fireEvent.click(searchButton());
    // The field takes the row.
    expect(field()).toHaveFocus();
    expect(slot(container)).toHaveClass("hidden");
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(searchButton()).toHaveFocus();
    expect(slot(container)).not.toHaveClass("hidden");
    cleanup();
    // Opened on a kept query: hidden from the first frame.
    const kept = renderLibrary({ opener: OPENER, query: "morning" });
    expect(slot(kept.container)).toHaveClass("hidden");
  });
});

describe("LibraryScreen — search on a phone", () => {
  const searchButton = () => screen.getByRole("button", { name: "Search" });
  const field = () => screen.getByRole("textbox", { name: "Search" });

  it("closed: a round button; the field is hidden on the phone and shown on a desk", () => {
    renderLibrary();
    expect(searchButton()).toHaveClass("md:hidden");
    expect(searchButton()).not.toHaveClass("hidden");
    expect(field().closest("[data-part='search']")).toHaveClass("hidden", "md:flex");
  });

  it("the button opens the field and puts the focus in it", () => {
    renderLibrary();
    fireEvent.click(searchButton());
    expect(field().closest("[data-part='search']")).not.toHaveClass("hidden");
    expect(searchButton()).toHaveClass("hidden");
    expect(field()).toHaveFocus();
    // The heading makes room for the field on the phone, and stays the page's name.
    expect(screen.getByRole("heading", { level: 1 })).toHaveClass("max-md:sr-only");
  });

  it("typing asks for the query", () => {
    const { p } = renderLibrary();
    fireEvent.click(searchButton());
    fireEvent.change(field(), { target: { value: "morning" } });
    expect(p.onQuery).toHaveBeenCalledWith("morning");
  });

  it("Escape clears the query, closes the field and hands the focus back to the button", () => {
    const { p } = renderLibrary({ query: "morning" });
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(p.onQuery).toHaveBeenCalledWith("");
    expect(searchButton()).toHaveFocus();
    expect(field().closest("[data-part='search']")).toHaveClass("hidden");
  });

  it("the cross does the same", () => {
    const { p } = renderLibrary();
    fireEvent.click(searchButton());
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(p.onQuery).toHaveBeenCalledWith("");
    expect(searchButton()).toHaveFocus();
  });

  it("opens already open when a query is kept", () => {
    renderLibrary({ query: "morning" });
    expect(field()).toHaveValue("morning");
    expect(field().closest("[data-part='search']")).not.toHaveClass("hidden");
  });
});

describe("LibraryScreen — the phone's field follows the query (fix round 1)", () => {
  const field = () => screen.getByRole("textbox", { name: "Search" });
  const wrap = () => field().closest("[data-part='search']");

  it("a query that arrives from outside shows the field", () => {
    const { p, rerender } = renderLibrary({ query: "" });
    expect(wrap()).toHaveClass("hidden");
    rerender(<LibraryScreen {...p} query="gym" />);
    expect(wrap()).not.toHaveClass("hidden");
    expect(screen.getByRole("button", { name: "Search" })).toHaveClass("hidden");
  });

  it("a query emptied from outside closes the field, while the focus is elsewhere", () => {
    const { p, rerender } = renderLibrary({ query: "gym" });
    expect(wrap()).not.toHaveClass("hidden");
    rerender(<LibraryScreen {...p} query="" />);
    expect(wrap()).toHaveClass("hidden");
    expect(screen.getByRole("button", { name: "Search" })).not.toHaveClass("hidden");
  });

  it("a query emptied while the field has the focus (the last letter deleted) keeps it open", () => {
    const { p, rerender } = renderLibrary({ query: "g" });
    act(() => field().focus());
    rerender(<LibraryScreen {...p} query="" />);
    expect(wrap()).not.toHaveClass("hidden");
    expect(field()).toHaveFocus();
  });
});

describe("LibraryScreen — the focus is never dropped on the page (fix round 1)", () => {
  it("Try again: once the failure's notice goes, the focus is on the page's heading, with no ring", () => {
    const { p, rerender } = renderLibrary({ state: "error", chats: [] });
    const again = screen.getByRole("button", { name: "Try again" });
    again.focus();
    fireEvent.click(again);
    expect(p.onRetry).toHaveBeenCalledTimes(1);
    rerender(<LibraryScreen {...p} state="loading" chats={[]} />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveFocus();
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(heading.style.outlineStyle).toBe("none");
  });

  it("Try again that fails at once again keeps the focus where it is", () => {
    const { p, rerender } = renderLibrary({ state: "error", chats: [] });
    const again = screen.getByRole("button", { name: "Try again" });
    again.focus();
    fireEvent.click(again);
    rerender(<LibraryScreen {...p} state="error" chats={[]} />);
    expect(screen.getByRole("button", { name: "Try again" })).toHaveFocus();
  });

  it("Show more whose last page leaves the chip with no row: the focus goes to the selected chip", () => {
    const { p, rerender } = renderLibrary({ filter: "drafts", chats: [], hasMore: true });
    const more = screen.getByRole("button", { name: "Show more" });
    more.focus();
    fireEvent.click(more);
    rerender(<LibraryScreen {...p} filter="drafts" chats={[]} hasMore={false} />);
    expect(screen.getByText("No drafts.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Drafts" })).toHaveFocus();
  });

  const SAVED3: SavedRowData[] = [
    { id: "a", kind: "hooks", text: "Hook a", line: "Hook · from A", canOpen: true },
    { id: "b", kind: "ideas", text: "Idea b", line: "Idea · from B", canOpen: true },
    { id: "c", kind: "hooks", text: "Hook c", line: "Hook · from C", canOpen: true },
  ];
  const removeOf = (text: string) =>
    screen.getAllByRole("button", { name: "Remove from saved" }).find((b) => b.closest("li")?.textContent?.includes(text))!;

  function removeAndRerender(id: string, saved: SavedRowData[]) {
    const { p, rerender } = renderLibrary({ filter: "saved", saved });
    const button = removeOf(saved.find((s) => s.id === id)!.text);
    button.focus();
    fireEvent.click(button);
    expect(p.onRemoveSaved).toHaveBeenCalledWith(id);
    rerender(<LibraryScreen {...p} filter="saved" saved={saved.filter((s) => s.id !== id)} />);
  }

  it("Remove from saved: the focus moves to the next row's Remove", () => {
    removeAndRerender("a", SAVED3);
    expect(removeOf("Idea b")).toHaveFocus();
  });

  it("Remove from saved on the last row: to the row before's Remove", () => {
    removeAndRerender("c", SAVED3);
    expect(removeOf("Idea b")).toHaveFocus();
  });

  it("Remove from saved on the only row: to the Saved chip", () => {
    removeAndRerender("a", SAVED3.slice(0, 1));
    expect(screen.getByText("Nothing saved yet. Save a hook or an idea from its details.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saved" })).toHaveFocus();
  });

  it("Remove that has not removed the row yet leaves the focus on it", () => {
    const { p, rerender } = renderLibrary({ filter: "saved", saved: SAVED3 });
    const button = removeOf("Idea b");
    button.focus();
    fireEvent.click(button);
    rerender(<LibraryScreen {...p} filter="saved" saved={[...SAVED3]} />);
    expect(removeOf("Idea b")).toHaveFocus();
  });

  // "Removed. Undo" is a line in the piece's place, and the screen owns the
  // focus around it (the container hands in each row's state).
  const withState = (id: string, state: SavedRowData["state"]) => SAVED3.map((s) => (s.id === id ? { ...s, state } : s));
  const undoOf = (text: string) => screen.getByRole("button", { name: `Undo: ${text}` });

  it("Remove: once the row is its \"Removed.\" line, the focus is on its Undo", () => {
    const { p, rerender } = renderLibrary({ filter: "saved", saved: SAVED3 });
    removeOf("Idea b").focus();
    fireEvent.click(removeOf("Idea b"));
    expect(p.onRemoveSaved).toHaveBeenCalledWith("b");
    rerender(<LibraryScreen {...p} filter="saved" saved={withState("b", "removed")} />);
    expect(undoOf("Idea b")).toHaveFocus();
    // In its place: still three rows, the second the line.
    expect(within(screen.getByRole("list", { name: "Saved" })).getAllByRole("listitem")).toHaveLength(3);
  });

  it("Undo calls onUndoSaved and, once the row is back, the focus is on its Remove", () => {
    const onUndoSaved = vi.fn();
    const { p, rerender } = renderLibrary({ filter: "saved", saved: withState("b", "removed"), onUndoSaved });
    undoOf("Idea b").focus();
    fireEvent.click(undoOf("Idea b"));
    expect(onUndoSaved).toHaveBeenCalledWith("b");
    rerender(<LibraryScreen {...p} filter="saved" saved={SAVED3} />);
    expect(removeOf("Idea b")).toHaveFocus();
  });

  it("a line that leaves by itself with the focus on its Undo hands it on: the next row's Remove", () => {
    const { p, rerender } = renderLibrary({ filter: "saved", saved: withState("a", "removed") });
    undoOf("Hook a").focus();
    rerender(<LibraryScreen {...p} filter="saved" saved={SAVED3.filter((s) => s.id !== "a")} />);
    expect(removeOf("Idea b")).toHaveFocus();
  });

  it("…the last row's line: the row before's Remove; the only row's: the Saved chip", () => {
    const { p, rerender } = renderLibrary({ filter: "saved", saved: withState("c", "removed") });
    undoOf("Hook c").focus();
    rerender(<LibraryScreen {...p} filter="saved" saved={SAVED3.slice(0, 2)} />);
    expect(removeOf("Idea b")).toHaveFocus();
    cleanup();

    const only = renderLibrary({ filter: "saved", saved: [{ ...SAVED3[0]!, state: "removed" }] });
    undoOf("Hook a").focus();
    only.rerender(<LibraryScreen {...only.p} filter="saved" saved={[]} />);
    expect(screen.getByRole("button", { name: "Saved" })).toHaveFocus();
  });

  it("a failed removal brings the row back under the focus: its Remove", () => {
    const { p, rerender } = renderLibrary({ filter: "saved", saved: withState("b", "removed") });
    undoOf("Idea b").focus();
    rerender(<LibraryScreen {...p} filter="saved" saved={withState("b", "failed")} />);
    expect(removeOf("Idea b")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Idea b" })).toHaveAccessibleDescription("Couldn't remove it.");
  });

  // A focus move held for a row the container did not change is dropped, so it
  // never holds back another row's hand-off.
  it("an Undo the container did not take holds nothing back: another line leaving still hands the focus on", () => {
    const both = SAVED3.map((s) => (s.id === "a" ? s : { ...s, state: "removed" as const }));
    const { p, rerender } = renderLibrary({ filter: "saved", saved: both, onUndoSaved: vi.fn() });
    undoOf("Idea b").focus();
    fireEvent.click(undoOf("Idea b"));
    // Not taken: the row is as it was.
    rerender(<LibraryScreen {...p} filter="saved" saved={[...both]} />);
    expect(undoOf("Idea b")).toHaveFocus();

    // The last line leaves by itself with the focus on its Undo: handed to the row before's.
    undoOf("Hook c").focus();
    rerender(<LibraryScreen {...p} filter="saved" saved={both.slice(0, 2)} />);
    expect(undoOf("Idea b")).toHaveFocus();
  });

  // The row last focused is forgotten once the focus leaves the list.
  it("the focus moved out of the list and then to the page: the row leaving does not pull it back", () => {
    const { p, rerender } = renderLibrary({ filter: "saved", saved: withState("a", "removed") });
    undoOf("Hook a").focus();
    const search = screen.getByRole("button", { name: "Search" });
    search.focus();
    search.blur();
    expect(document.activeElement).toBe(document.body);
    rerender(<LibraryScreen {...p} filter="saved" saved={SAVED3.filter((s) => s.id !== "a")} />);
    expect(document.activeElement).toBe(document.body);
  });

  it("the focus let go to the page (a click on blank space, Safari's click): the row leaving does not pull it back", async () => {
    const { p, rerender } = renderLibrary({ filter: "saved", saved: withState("a", "removed") });
    undoOf("Hook a").focus();
    undoOf("Hook a").blur();
    await act(async () => {});
    expect(document.activeElement).toBe(document.body);
    rerender(<LibraryScreen {...p} filter="saved" saved={SAVED3.filter((s) => s.id !== "a")} />);
    expect(document.activeElement).toBe(document.body);
  });

  it("a row changing elsewhere does not take the focus from where the creator is", () => {
    const { p, rerender } = renderLibrary({ filter: "saved", saved: withState("a", "removed") });
    const field = screen.getByRole("button", { name: "Search" });
    field.focus();
    rerender(<LibraryScreen {...p} filter="saved" saved={SAVED3.filter((s) => s.id !== "a")} />);
    expect(field).toHaveFocus();
  });
});

describe("LibraryScreen — search on a desk", () => {
  it("Escape clears the query and the focus stays in the field (it does not close there)", () => {
    widthIs("desk");
    const { p } = renderLibrary({ query: "morning" });
    const field = screen.getByRole("textbox", { name: "Search" });
    act(() => field.focus());
    fireEvent.keyDown(field, { key: "Escape" });
    expect(p.onQuery).toHaveBeenCalledWith("");
    expect(field).toHaveFocus();
  });

  it("the cross shows on a desk only while there is a query", () => {
    widthIs("desk");
    const { rerender, p } = renderLibrary({ query: "" });
    // Invisible, not gone: the field keeps its width as the first letter is typed.
    expect(screen.getByRole("button", { name: "Clear search" })).toHaveClass("md:invisible");
    rerender(<LibraryScreen {...p} query="morning" />);
    expect(screen.getByRole("button", { name: "Clear search" })).not.toHaveClass("md:invisible");
  });
});

describe("LibraryScreen — the list", () => {
  it("one row per chat, in the order given, each opening its chat", () => {
    const { p } = renderLibrary();
    const rows = within(screen.getByRole("list", { name: "Chats" })).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Remix: the $100,000 challenge" }));
    expect(p.onOpenChat).toHaveBeenCalledWith("c2");
  });

  it("from 768 it is a table: a header with Stage, the stage word in each row, hidden on the phone", () => {
    const { container } = renderLibrary();
    const head = container.querySelector('[data-part="table-head"]');
    expect(head).toHaveClass("hidden", "md:grid");
    expect(head).toHaveTextContent("Stage");
    // After posting: a column after Simulated.
    expect(Array.from(head!.children).map((cell) => cell.textContent)).toEqual(["", "", "Stage", "Simulated", "After posting"]);
    expect(within(screen.getByRole("button", { name: "Remix: the $100,000 challenge" })).getByText("Draft")).toHaveClass(
      "hidden",
      "md:block",
    );
  });

  it("the table's columns follow the card's own width (the sidebar's width varies): the card is the container, the head and the rows share one grid", () => {
    const withMenu = renderLibrary({ renderRowMenu: (chat) => <button type="button">{`More: ${chat.title}`}</button> });
    const head = withMenu.container.querySelector('[data-part="table-head"]')!;
    const card = head.parentElement!;
    expect(card).toHaveClass("@container");
    const li = within(screen.getByRole("list", { name: "Chats" })).getAllByRole("listitem")[0]!;
    const grid = (el: Element) => el.className.split(/\s+/).filter((c) => c.includes("grid-cols-") || c.includes("gap-x-"));
    expect(grid(head)).toEqual(grid(li));
    expect(grid(head)).toEqual(
      expect.arrayContaining([
        "md:@max-[720px]:grid-cols-[44px_minmax(0,1fr)_72px_60px_92px_38px]",
        "md:@min-[720px]:grid-cols-[56px_minmax(0,1fr)_104px_84px_128px_44px]",
      ]),
    );
  });

  it("each chat row carries the menu the container renders for it", () => {
    renderLibrary({ renderRowMenu: (chat) => <button type="button">{`More: ${chat.title}`}</button> });
    for (const chat of CHATS) {
      const more = screen.getByRole("button", { name: `More: ${chat.title}` });
      expect(more.closest("li")).toBe(screen.getByRole("button", { name: chat.title }).closest("li"));
    }
  });

  it("without a menu, no More control", () => {
    renderLibrary();
    expect(screen.queryByRole("button", { name: /More/ })).toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = renderLibrary({ hasMore: true });
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("LibraryScreen — Show more", () => {
  it("only while there are older chats", () => {
    renderLibrary({ hasMore: false });
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("asks for the next page", () => {
    const { p } = renderLibrary({ hasMore: true });
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(p.onMore).toHaveBeenCalledTimes(1);
  });

  it("while that page loads: disabled and busy, the focus kept on it", () => {
    const { p } = renderLibrary({ hasMore: true, loadingMore: true });
    const more = screen.getByRole("button", { name: "Show more" });
    expect(more).toHaveAttribute("aria-disabled", "true");
    expect(more).toHaveAttribute("aria-busy", "true");
    more.focus();
    fireEvent.click(more);
    expect(p.onMore).not.toHaveBeenCalled();
    expect(more).toHaveFocus();
  });

  it("when the last page comes in and Show more goes, the focus moves to the first row it brought", () => {
    const { p, rerender } = renderLibrary({ hasMore: true, chats: CHATS.slice(0, 2) });
    const more = screen.getByRole("button", { name: "Show more" });
    more.focus();
    fireEvent.click(more);
    expect(p.onMore).toHaveBeenCalledTimes(1);
    rerender(<LibraryScreen {...p} hasMore loadingMore chats={CHATS.slice(0, 2)} />);
    expect(screen.getByRole("button", { name: "Show more" })).toHaveFocus();
    rerender(<LibraryScreen {...p} hasMore={false} loadingMore={false} chats={CHATS} />);
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    expect(screen.getByRole("button", { name: "Why the last one flopped" })).toHaveFocus();
  });

  it("a page that leaves more to come keeps the focus on Show more", () => {
    const { p, rerender } = renderLibrary({ hasMore: true, chats: CHATS.slice(0, 1) });
    const more = screen.getByRole("button", { name: "Show more" });
    more.focus();
    fireEvent.click(more);
    rerender(<LibraryScreen {...p} hasMore chats={CHATS.slice(0, 2)} />);
    expect(screen.getByRole("button", { name: "Show more" })).toHaveFocus();
  });

  it("not under the saved pieces (they come in one list)", () => {
    renderLibrary({ filter: "saved", hasMore: true });
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  // An older page that failed says so, quietly, and Show more tries again.
  it('an older page that failed: "Couldn\'t load more." above Show more, announced; the tap tries again', () => {
    const { p } = renderLibrary({ hasMore: true, moreFailed: true });
    const line = screen.getByText("Couldn't load more.");
    expect(line).toHaveAttribute("role", "status");
    const more = screen.getByRole("button", { name: "Show more" });
    expect(line.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Not the failure of the whole screen: the rows stay, nothing is an alert.
    expect(screen.getByRole("button", { name: "Why the last one flopped" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(more);
    expect(p.onMore).toHaveBeenCalledTimes(1);
  });

  it("the same with no row for the chip: the line and Show more, no empty line", () => {
    renderLibrary({ filter: "simulated", chats: [], hasMore: true, moreFailed: true });
    expect(screen.getByText("Couldn't load more.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();
    expect(screen.queryByText("Nothing simulated yet.")).toBeNull();
  });

  it("no failure, or not given: no line", () => {
    const { rerender, p } = renderLibrary({ hasMore: true, moreFailed: false });
    expect(screen.queryByText("Couldn't load more.")).toBeNull();
    rerender(<LibraryScreen {...p} moreFailed={undefined} />);
    expect(screen.queryByText("Couldn't load more.")).toBeNull();
  });
});

describe("LibraryScreen — the states", () => {
  it("loading: six quiet placeholder rows, busy", () => {
    const { container } = renderLibrary({ state: "loading", chats: [] });
    const busy = container.querySelector('[aria-busy="true"]');
    expect(busy).toBeInTheDocument();
    expect(busy!.querySelectorAll('[data-part="placeholder"]')).toHaveLength(6);
    // The header and the chips are there while it loads.
    expect(screen.getByRole("heading", { level: 1, name: "Library" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Filter" })).toBeInTheDocument();
  });

  it("failed: the sentence and Try again", () => {
    const { p } = renderLibrary({ state: "error", chats: [] });
    expect(screen.getByText("Couldn't load your library.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(p.onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("list", { name: "Chats" })).toBeNull();
  });

  it("no chats at all: Nothing here yet, and New chat", () => {
    const { p } = renderLibrary({ chats: [] });
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(p.onNewChat).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["drafts", "No drafts."],
    ["simulated", "Nothing simulated yet."],
    ["posted", "Nothing posted yet. Add a posted video's link to a piece you simulated."],
  ] as const)("%s with nothing: %s", (filter, line) => {
    renderLibrary({ filter, chats: [] });
    expect(screen.getByText(line)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New chat" })).toBeNull();
  });

  it("saved with nothing: how to save something", () => {
    renderLibrary({ filter: "saved", saved: [] });
    expect(screen.getByText("Nothing saved yet. Save a hook or an idea from its details.")).toBeInTheDocument();
  });

  it("an empty line is announced: the notice is a status", () => {
    renderLibrary({ filter: "drafts", chats: [] });
    expect(screen.getByRole("status")).toHaveTextContent("No drafts.");
  });

  it("a search with nothing under Saved names the saved pieces, not the chats", () => {
    renderLibrary({ filter: "saved", saved: [], query: "gym" });
    expect(screen.getByText('Nothing saved matches "gym".')).toBeInTheDocument();
    expect(screen.queryByText(/No chat called/)).toBeNull();
    expect(screen.queryByText("Nothing saved yet. Save a hook or an idea from its details.")).toBeNull();
  });

  it("a search with nothing names what was searched", () => {
    renderLibrary({ query: "gym", chats: [] });
    expect(screen.getByText('No chat called "gym".')).toBeInTheDocument();
    expect(screen.queryByText("Nothing here yet.")).toBeNull();
  });
});

describe("LibraryScreen — Saved", () => {
  it("lists the saved pieces: their text, their line, a way to remove each", () => {
    const { p } = renderLibrary({ filter: "saved" });
    expect(screen.queryByRole("list", { name: "Chats" })).toBeNull();
    const list = screen.getByRole("list", { name: "Saved" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);

    const piece = screen.getByRole("button", { name: "I spent $400 testing every viral hook format." });
    expect(piece).toHaveAccessibleDescription("Hook · from Hook formats, the $400 test");
    fireEvent.click(piece);
    expect(p.onOpenSaved).toHaveBeenCalledWith("s1");

    const removes = screen.getAllByRole("button", { name: "Remove from saved" });
    expect(removes).toHaveLength(2);
    fireEvent.click(removes[1]!);
    expect(p.onRemoveSaved).toHaveBeenCalledWith("s2");
    expect(p.onOpenSaved).toHaveBeenCalledTimes(1);
  });

  it("each Remove says which piece it removes", () => {
    renderLibrary({ filter: "saved" });
    expect(screen.getAllByRole("button", { name: "Remove from saved" })[0]).toHaveAccessibleDescription(
      "I spent $400 testing every viral hook format.",
    );
  });

  it("a piece that cannot be opened is not a button", () => {
    renderLibrary({ filter: "saved" });
    expect(screen.queryByRole("button", { name: "There's a wave of $100,000 challenges" })).toBeNull();
    expect(screen.getByText("There's a wave of $100,000 challenges")).toBeInTheDocument();
    expect(screen.getByText("Video · saved in Discover")).toBeInTheDocument();
  });

  it("each piece shows the mark of its kind", () => {
    const { container } = renderLibrary({ filter: "saved" });
    expect([...container.querySelectorAll('[data-part="mark"]')].map((m) => m.getAttribute("data-kind"))).toEqual(["hooks", "video"]);
  });

  it("has no axe violations", async () => {
    const { container } = renderLibrary({ filter: "saved" });
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});

// A chat deleted from its More leaves the list with the focus on that More. The screen
// hands it on as it does for the saved rows: the row now in its place (the next one), else the row
// before, else the selected chip.
describe("LibraryScreen — a chat row that leaves hands the focus on (Task 6)", () => {
  const menu = (chat: ChatRowData) => <button type="button">{`More: ${chat.title}`}</button>;
  const moreOf = (title: string) => screen.getByRole("button", { name: `More: ${title}` });
  const rowOf = (title: string) => screen.getByRole("button", { name: title });

  /** The More of chat `id` has the focus; then the chat leaves the list. */
  function leave(id: string, chats: ChatRowData[] = CHATS, focus: "more" | "row" = "more") {
    const { p, rerender } = renderLibrary({ chats, renderRowMenu: menu });
    const title = chats.find((c) => c.id === id)!.title;
    (focus === "more" ? moreOf(title) : rowOf(title)).focus();
    rerender(<LibraryScreen {...p} chats={chats.filter((c) => c.id !== id)} />);
    return { p, rerender };
  }

  it("its More had the focus: the focus goes to the next row", () => {
    leave("c1");
    expect(rowOf("Remix: the $100,000 challenge")).toHaveFocus();
  });

  it("the last row: to the row before", () => {
    leave("c3");
    expect(rowOf("Remix: the $100,000 challenge")).toHaveFocus();
  });

  it("the only row: to the selected chip", () => {
    leave("c1", CHATS.slice(0, 1));
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toHaveFocus();
  });

  it("…under another chip, to that chip", () => {
    const { p, rerender } = renderLibrary({ filter: "drafts", chats: CHATS.slice(1, 2), renderRowMenu: menu });
    moreOf("Remix: the $100,000 challenge").focus();
    rerender(<LibraryScreen {...p} filter="drafts" chats={[]} />);
    expect(screen.getByRole("button", { name: "Drafts" })).toHaveFocus();
  });

  it("its own row had the focus: the same", () => {
    leave("c2", CHATS, "row");
    expect(rowOf("Why the last one flopped")).toHaveFocus();
  });

  it("a row leaving elsewhere does not take the focus from where the creator is", () => {
    const { p, rerender } = renderLibrary({ renderRowMenu: menu });
    const search = screen.getByRole("button", { name: "Search" });
    search.focus();
    rerender(<LibraryScreen {...p} chats={CHATS.slice(1)} />);
    expect(search).toHaveFocus();
  });

  // Forgotten once the focus leaves the list, as the saved rows' is.
  it("the focus moved out of the list and then to the page: the row leaving does not pull it back", () => {
    const { p, rerender } = renderLibrary({ renderRowMenu: menu });
    moreOf("Hook formats, the $400 test").focus();
    const search = screen.getByRole("button", { name: "Search" });
    search.focus();
    search.blur();
    expect(document.activeElement).toBe(document.body);
    rerender(<LibraryScreen {...p} chats={CHATS.slice(1)} />);
    expect(document.activeElement).toBe(document.body);
  });

  it("the focus let go to the page (a click on blank space, Safari's click): the row leaving does not pull it back", async () => {
    const { p, rerender } = renderLibrary({ renderRowMenu: menu });
    moreOf("Hook formats, the $400 test").focus();
    moreOf("Hook formats, the $400 test").blur();
    await act(async () => {});
    expect(document.activeElement).toBe(document.body);
    rerender(<LibraryScreen {...p} chats={CHATS.slice(1)} />);
    expect(document.activeElement).toBe(document.body);
  });

  it("the focus moved into the row's own menu (portalled, `data-row-menu`): the list still knows the row and hands it on", () => {
    const withLayer = (chat: ChatRowData) => (
      <>
        <button type="button">{`More: ${chat.title}`}</button>
        {createPortal(
          <div data-row-menu="" tabIndex={-1}>
            {`Menu of ${chat.title}`}
          </div>,
          document.body,
        )}
      </>
    );
    const { p, rerender } = renderLibrary({ renderRowMenu: withLayer });
    moreOf("Hook formats, the $400 test").focus();
    screen.getByText("Menu of Hook formats, the $400 test").focus();
    // The row leaves with its menu: the focus fell to the page.
    rerender(<LibraryScreen {...p} chats={CHATS.slice(1)} />);
    expect(rowOf("Remix: the $100,000 challenge")).toHaveFocus();
  });

  it("a row that stays (renamed, pinned) leaves the focus where it is", () => {
    const { p, rerender } = renderLibrary({ renderRowMenu: menu });
    moreOf("Remix: the $100,000 challenge").focus();
    rerender(<LibraryScreen {...p} chats={CHATS.map((c) => (c.id === "c2" ? { ...c, pinned: true } : c))} />);
    expect(moreOf("Remix: the $100,000 challenge")).toHaveFocus();
  });
});

describe("LibraryScreen — order", () => {
  it("reads search, chips, then the rows (row, its gauge, its More)", () => {
    renderLibrary({ renderRowMenu: (chat) => <button type="button">{`More: ${chat.title}`}</button> });
    const order = [
      screen.getByRole("heading", { level: 1 }),
      screen.getByRole("button", { name: "Search" }),
      screen.getByRole("group", { name: "Filter" }),
      screen.getByRole("button", { name: "Hook formats, the $400 test" }),
      screen.getByRole("link", { name: "Open the result: Hook formats, the $400 test" }),
      screen.getByRole("button", { name: "More: Hook formats, the $400 test" }),
      screen.getByRole("button", { name: "Remix: the $100,000 challenge" }),
    ];
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});
