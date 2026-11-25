/** @vitest-environment happy-dom */

/**
 * RowMenu — a chat row's More (plan 2026-11-23-library; spec §3.5): Rename, Pin or Unpin,
 * Delete (asked once more), rendered for real with Radix underneath. The one stand-in is `matchMedia`,
 * which decides the phone's bottom sheet or the desk's menu standing on the More button. The last
 * block puts it in a real `ChatRow`: nothing done in it may open the chat.
 */

import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { ChatRow, type ChatRowData } from "../chat-row";
import { RowMenu, type RowMenuProps } from "../row-menu";

/** The window's width, as `matchMedia` answers it: a phone (under 768) or a desk. */
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

const TITLE = "Gym hooks, the 5am test";

function props(over: Partial<RowMenuProps> = {}): RowMenuProps {
  return {
    title: TITLE,
    renameFrom: TITLE,
    pinned: false,
    onRename: vi.fn(),
    onTogglePin: vi.fn(),
    onDelete: vi.fn(),
    ...over,
  };
}

function renderMenu(over: Partial<RowMenuProps> = {}) {
  const p = props(over);
  const view = render(<RowMenu {...p} />);
  return { p, ...view };
}

const more = (title = TITLE) => screen.getByRole("button", { name: `More: ${title}` });
const layer = (title = TITLE) => screen.getByRole("dialog", { name: title });
/** The open layer, whatever its step names it. */
const dialog = () => screen.getByRole("dialog");
const item = (name: string) => within(dialog()).getByRole("button", { name });
/** What a sighted creator reads in an element: its text without the screen-reader-only parts. */
const visibleText = (el: Element) => {
  const copy = el.cloneNode(true) as Element;
  copy.querySelectorAll(".sr-only").forEach((hidden) => hidden.remove());
  return copy.textContent;
};
/** Radix hands the focus back on a timer once the layer is gone. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));
const open = () => {
  more().focus();
  fireEvent.click(more());
};
/** The rows of the open layer's step, top to bottom: each control's name, or a row's first line. */
const rows = () =>
  Array.from(dialog().querySelectorAll('[data-part="menu-row"]')).map((row) => {
    const control = row.querySelector("button, input");
    return control ? (control.getAttribute("aria-label") ?? control.textContent) : (row.querySelector("p") ?? row).textContent;
  });

describe("RowMenu — the More button", () => {
  it('is named "More: {title}", three dots, with a 44 px tap area; it opens a dialog', () => {
    renderMenu();
    expect(more()).toHaveClass("tap-44");
    expect(more()).toHaveAttribute("aria-haspopup", "dialog");
    expect(more()).toHaveAttribute("aria-expanded", "false");
    expect(more().querySelector("svg")).not.toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // Drawn 24 on the phone (its tap area stays 44 on touch), so the title keeps its room.
  it("is drawn 24 on the phone and 38 from 768; its tap area is 44 on touch", () => {
    renderMenu();
    expect(more()).toHaveClass("size-6", "md:size-[38px]", "tap-44");
  });

  // Safari does not focus a button on a tap; More does it itself, so the list knows
  // which row the menu is for and the focus has somewhere to come back to.
  it("a tap on More focuses it, before its layer takes the focus", () => {
    renderMenu();
    const focused = vi.fn();
    more().addEventListener("focus", focused);
    expect(document.activeElement).toBe(document.body);
    fireEvent.click(more());
    expect(focused).toHaveBeenCalled();
    expect(item("Rename")).toHaveFocus();
  });

  it("is always shown on a phone and on touch; on a desk with a mouse, on the row's hover and focus, and while open", () => {
    renderMenu();
    // Hidden only from 768 with a fine pointer, and then it takes no pointer events either.
    expect(more()).toHaveClass("md:pointer-fine:opacity-0", "md:pointer-fine:pointer-events-none");
    expect(more()).toHaveClass(
      "md:pointer-fine:group-hover/row:opacity-100",
      "md:pointer-fine:group-focus-within/row:opacity-100",
      "md:pointer-fine:aria-expanded:opacity-100",
    );
  });
});

describe("RowMenu on the phone", () => {
  it("opens a bottom sheet named for the chat: Rename, Pin, Delete; the focus on Rename", () => {
    renderMenu();
    open();
    expect(layer()).toBeInTheDocument();
    expect(document.querySelector('[data-slot="sheet-overlay"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="sheet-handle"]')).not.toBeNull();
    expect(rows()).toEqual(["Rename", "Pin", "Delete"]);
    expect(item("Rename")).toHaveFocus();
    // The sheet is modal: the page behind it, More included, is hidden from assistive tech.
    expect(screen.getByRole("button", { name: `More: ${TITLE}`, hidden: true })).toHaveAttribute("aria-expanded", "true");
  });

  it("the hairlines are the menu step's only: none above or below the Save or Delete pill, their 1 px kept (transparent) so every step keeps its height", () => {
    renderMenu();
    open();
    const rowsBox = () => dialog().querySelector('[data-part="menu-row"]')!.parentElement!.className.split(/\s+/);
    expect(rowsBox()).toEqual(expect.arrayContaining(["max-md:divide-y", "max-md:divide-border"]));
    fireEvent.click(item("Rename"));
    expect(rowsBox()).toEqual(expect.arrayContaining(["max-md:divide-y", "max-md:divide-transparent"]));
    expect(rowsBox()).not.toContain("max-md:divide-border");
    fireEvent.click(item("Cancel"));
    open();
    fireEvent.click(item("Delete"));
    expect(rowsBox()).toEqual(expect.arrayContaining(["max-md:divide-y", "max-md:divide-transparent"]));
    expect(rowsBox()).not.toContain("max-md:divide-border");
  });

  it("a pinned chat offers Unpin", () => {
    renderMenu({ pinned: true });
    open();
    expect(rows()).toEqual(["Rename", "Unpin", "Delete"]);
  });

  it("Pin calls onTogglePin once, closes, and the focus is back on More", async () => {
    const { p } = renderMenu();
    open();
    fireEvent.click(item("Pin"));
    await settle();
    expect(p.onTogglePin).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
  });

  it.each([
    ["Escape", () => fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })],
    ["Close", () => fireEvent.click(item("Close"))],
  ])("closing with %s sends nothing and hands the focus back to More", async (_how, close) => {
    const { p } = renderMenu();
    open();
    close();
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
    expect(p.onRename).not.toHaveBeenCalled();
    expect(p.onTogglePin).not.toHaveBeenCalled();
    expect(p.onDelete).not.toHaveBeenCalled();
  });

  // A double tap on Pin pinned and unpinned (two requests) while the sheet closed.
  it("a second tap on Pin while the sheet closes does nothing", () => {
    const { p } = renderMenu();
    open();
    const pin = item("Pin");
    act(() => {
      pin.click();
      pin.click();
    });
    expect(p.onTogglePin).toHaveBeenCalledTimes(1);
  });

  it("a second tap on the confirming Delete while the sheet closes does nothing", () => {
    const { p } = renderMenu();
    open();
    fireEvent.click(item("Delete"));
    const confirm = item("Delete");
    act(() => {
      confirm.click();
      confirm.click();
    });
    expect(p.onDelete).toHaveBeenCalledTimes(1);
  });

  it("opens on the menu again after a step was left", async () => {
    renderMenu();
    open();
    fireEvent.click(item("Delete"));
    fireEvent.click(item("Cancel"));
    await settle();
    open();
    expect(rows()).toEqual(["Rename", "Pin", "Delete"]);
  });
});

describe("RowMenu on a desk", () => {
  beforeEach(() => widthIs("desk"));

  it("is a menu standing on the More button, not a sheet: no scrim, no handle; named for the chat", () => {
    renderMenu();
    open();
    expect(layer()).toBeInTheDocument();
    expect(layer()).toHaveAttribute("data-side");
    expect(document.querySelector('[data-slot="sheet-overlay"]')).toBeNull();
    expect(document.querySelector('[data-slot="sheet-handle"]')).toBeNull();
    expect(rows()).toEqual(["Rename", "Pin", "Delete"]);
    expect(item("Rename")).toHaveFocus();
  });

  it("the delete step keeps its height: its header gives the question's row the 8 px its quiet line needs, so Delete and Cancel stand where Pin and Delete stood", () => {
    renderMenu({ inside: "5 hooks" });
    open();
    const header = () => within(dialog()).getByRole("heading").parentElement!.className.split(/\s+/);
    expect(header()).toContain("h-11");
    expect(header()).not.toContain("md:h-9");
    fireEvent.click(item("Delete"));
    // 4 + 36 + 52 (the question and its line) = 4 + 44 + 44 (the header and Rename's row).
    expect(header()).toEqual(expect.arrayContaining(["h-11", "md:h-9"]));
    const question = within(dialog()).getByText("Delete this chat?").parentElement!.className.split(/\s+/);
    expect(question).toContain("md:h-[52px]");
  });

  it("Escape closes it and the focus is back on More", async () => {
    renderMenu();
    open();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
  });

  it("the whole flow works here too: rename by Enter", async () => {
    const { p } = renderMenu();
    open();
    fireEvent.click(item("Rename"));
    const field = within(dialog()).getByRole("textbox", { name: `Rename ${TITLE}` });
    fireEvent.change(field, { target: { value: "Leg day hooks" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await settle();
    expect(p.onRename).toHaveBeenCalledWith("Leg day hooks");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
  });
});

describe.each(["phone", "desk"] as const)("RowMenu — Rename (%s)", (view) => {
  beforeEach(() => widthIs(view));

  const startRename = () => {
    open();
    fireEvent.click(item("Rename"));
    return within(dialog()).getByRole("textbox", { name: `Rename ${TITLE}` });
  };

  it("turns into a text field with the title, focused, and Save", () => {
    renderMenu();
    const field = startRename();
    expect(field).toHaveValue(TITLE);
    expect(field).toHaveFocus();
    expect(item("Save")).toBeInTheDocument();
    // Still named for the chat it renames, to a screen reader; its header reads "Rename".
    expect(layer(`Rename ${TITLE}`)).toBeInTheDocument();
  });

  it('its header reads "Rename": the chat\'s name is already in the field, not said again above it', () => {
    renderMenu();
    startRename();
    const heading = within(dialog()).getByRole("heading");
    expect(visibleText(heading)).toBe("Rename");
    expect(visibleText(dialog())).not.toContain(TITLE);
  });

  it("Save calls onRename with the new title, trimmed, once; then closes with the focus on More", async () => {
    const { p } = renderMenu();
    const field = startRename();
    fireEvent.change(field, { target: { value: "  Leg day hooks  " } });
    fireEvent.click(item("Save"));
    await settle();
    expect(p.onRename).toHaveBeenCalledTimes(1);
    expect(p.onRename).toHaveBeenCalledWith("Leg day hooks");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
  });

  it("Enter calls onRename, and is kept from doing anything else", () => {
    const { p } = renderMenu();
    const field = startRename();
    fireEvent.change(field, { target: { value: "Leg day hooks" } });
    const enter = fireEvent.keyDown(field, { key: "Enter" });
    expect(enter).toBe(false); // default prevented
    expect(p.onRename).toHaveBeenCalledWith("Leg day hooks");
  });

  it("Enter while a word is still being composed (an input method) sends nothing", () => {
    const { p } = renderMenu();
    const field = startRename();
    fireEvent.change(field, { target: { value: "Leg day" } });
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    expect(p.onRename).not.toHaveBeenCalled();
    expect(field).toBeInTheDocument();
  });

  it("Escape cancels: nothing sent, closed, the focus on More", async () => {
    const { p } = renderMenu();
    const field = startRename();
    fireEvent.change(field, { target: { value: "Leg day hooks" } });
    fireEvent.keyDown(field, { key: "Escape" });
    await settle();
    expect(p.onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
  });

  it("Cancel cancels as Escape does", async () => {
    const { p } = renderMenu();
    const field = startRename();
    fireEvent.change(field, { target: { value: "Leg day hooks" } });
    fireEvent.click(item("Cancel"));
    await settle();
    expect(p.onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
  });

  it("an empty title is not sent: Save is off, and neither Save nor Enter sends it", () => {
    const { p } = renderMenu();
    const field = startRename();
    fireEvent.change(field, { target: { value: "   " } });
    expect(item("Save")).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(item("Save"));
    fireEvent.keyDown(field, { key: "Enter" });
    expect(p.onRename).not.toHaveBeenCalled();
    // Still renaming: the field keeps its place and the focus.
    expect(field).toBeInTheDocument();
    expect(field).toHaveFocus();
  });

  // The server refuses a title over 200 characters.
  it("takes at most 200 characters", () => {
    renderMenu();
    expect(startRename()).toHaveAttribute("maxlength", "200");
  });

  // The layer stays pressable while it closes (its exit takes 300 ms).
  it("a second Save, or a second Enter, while the layer closes sends nothing more", () => {
    const { p } = renderMenu();
    const field = startRename();
    fireEvent.change(field, { target: { value: "Leg day hooks" } });
    const save = item("Save");
    act(() => {
      save.click();
      save.click();
      field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });
    expect(p.onRename).toHaveBeenCalledTimes(1);
  });

  it("an unchanged title sends nothing and closes", async () => {
    const { p } = renderMenu();
    startRename();
    fireEvent.click(item("Save"));
    await settle();
    expect(p.onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("an untitled chat starts from an empty field, its shown title the placeholder", () => {
    const shown = "Video simulation";
    renderMenu({ title: shown, renameFrom: "" });
    fireEvent.click(more(shown));
    fireEvent.click(within(layer(shown)).getByRole("button", { name: "Rename" }));
    const field = within(dialog()).getByRole("textbox", { name: `Rename ${shown}` });
    expect(field).toHaveValue("");
    expect(field).toHaveAttribute("placeholder", shown);
    expect(within(dialog()).getByRole("button", { name: "Save" })).toHaveAttribute("aria-disabled", "true");
  });
});

describe.each(["phone", "desk"] as const)("RowMenu — Delete is asked once more (%s)", (view) => {
  beforeEach(() => widthIs(view));

  it('Delete asks "Delete this chat?" with Delete and Cancel, the focus on Cancel; nothing sent yet', () => {
    const { p } = renderMenu();
    open();
    fireEvent.click(item("Delete"));
    expect(p.onDelete).not.toHaveBeenCalled();
    expect(within(dialog()).getByText("Delete this chat?")).toBeInTheDocument();
    expect(item("Delete")).toBeInTheDocument();
    // The safe default, as the sidebar's two-step delete.
    expect(item("Cancel")).toHaveFocus();
  });

  it("a second tap where Delete was lands on Cancel: the steps keep three rows, Cancel in Delete's place", () => {
    const shapes = () => Array.from(dialog().querySelectorAll('[data-part="menu-row"]')).map((row) => row.className);
    renderMenu();
    open();
    expect(rows()).toEqual(["Rename", "Pin", "Delete"]);
    const menu = shapes();
    fireEvent.click(item("Delete"));
    expect(rows()).toEqual(["Delete this chat?", "Delete", "Cancel"]);
    // One row shape for every row of both steps: the rows keep their places.
    expect(new Set([...menu, ...shapes()]).size).toBe(1);
  });

  it("keeps the chat's name as its header; under the question one quiet line says what goes, and the confirming Delete is described by both", () => {
    renderMenu({ inside: "5 hooks" });
    open();
    fireEvent.click(item("Delete"));
    expect(layer()).toBeInTheDocument();
    expect(visibleText(within(dialog()).getByRole("heading"))).toBe(TITLE);
    const line = "This also deletes what's in it (5 hooks). It can't be undone.";
    expect(within(dialog()).getByText(line)).toBeInTheDocument();
    // The question's row holds the line, under the question.
    const question = within(dialog()).getByText("Delete this chat?");
    expect(question.closest('[data-part="menu-row"]')).toBe(within(dialog()).getByText(line).closest('[data-part="menu-row"]'));
    expect(item("Delete")).toHaveAccessibleDescription(`Delete this chat? ${line}`);
  });

  it.each([
    ["4 ideas", "This also deletes what's in it (4 ideas). It can't be undone."],
    ["video", "This also deletes what's in it (video). It can't be undone."],
    [null, "It can't be undone."],
  ])("what goes: %s", (inside, line) => {
    renderMenu({ inside });
    open();
    fireEvent.click(item("Delete"));
    expect(within(dialog()).getByText(line)).toBeInTheDocument();
    expect(item("Delete")).toHaveAccessibleDescription(`Delete this chat? ${line}`);
  });

  it("Cancel: nothing sent, closed, the focus on More", async () => {
    const { p } = renderMenu();
    open();
    fireEvent.click(item("Delete"));
    fireEvent.click(item("Cancel"));
    await settle();
    expect(p.onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
  });

  it("Escape at the question: nothing sent, closed, the focus on More", async () => {
    const { p } = renderMenu();
    open();
    fireEvent.click(item("Delete"));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await settle();
    expect(p.onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
  });

  it("Delete, then Delete: onDelete once, and the layer closes", async () => {
    const { p } = renderMenu();
    open();
    fireEvent.click(item("Delete"));
    fireEvent.click(item("Delete"));
    await settle();
    expect(p.onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the focus is on More when onDelete runs, so the list can hand it on once the row leaves", () => {
    let focused: Element | null = null;
    renderMenu({ onDelete: () => (focused = document.activeElement) });
    open();
    fireEvent.click(item("Delete"));
    fireEvent.click(item("Delete"));
    expect(focused).toBe(more());
  });
});

describe("RowMenu — accessibility", () => {
  it.each(["phone", "desk"] as const)("has no axe violations, closed and open (%s)", async (view) => {
    widthIs(view);
    const { container } = renderMenu();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
    open();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(layer())).toHaveNoViolations();
  });
});

// ─── In its row ──────────────────────────────────────────────────────────────

const CHAT: ChatRowData = {
  id: "c1",
  title: TITLE,
  pinned: false,
  line: "3 hooks · simulated 2h ago",
  lead: "hooks",
  stageWord: "Simulated",
  frame: null,
  still: null,
  gauge: { number: 66, describes: "66% would stop to watch", href: "/simulation/hook/c1/k" },
};

describe.each(["phone", "desk"] as const)("RowMenu in its row: nothing done in it opens the chat (%s)", (view) => {
  beforeEach(() => widthIs(view));

  function renderRow() {
    const onOpen = vi.fn();
    const p = props();
    render(
      <ul>
        <ChatRow chat={CHAT} onOpen={onOpen} menu={<RowMenu {...p} />} />
      </ul>,
    );
    return { onOpen, p };
  }

  it("More sits in the row, beside its open button, never inside it, above the row's tap area", () => {
    renderRow();
    const row = screen.getByRole("button", { name: TITLE });
    expect(more().closest("li")).toBe(row.closest("li"));
    expect(row.contains(more())).toBe(false);
    expect(more().parentElement).toHaveClass("relative", "z-[1]");
    // The row is the group the More shows on.
    expect(row.closest("li")).toHaveClass("group/row");
  });

  // On the phone the More sits in the card's right padding (16): pulled 12 into it,
  // with the row's 12 gap kept to the gauge. Its 44 tap area (24 drawn, 10 each side) then ends
  // 2 short of the gauge and 6 past the card's edge, inside the page's 16 gutter.
  it("on the phone it is pulled into the card's right padding, the gap to the gauge kept", () => {
    renderRow();
    const wrapper = more().parentElement!;
    expect(wrapper).toHaveClass("max-md:-mr-3");
    expect(wrapper.closest("li")).toHaveClass("gap-3");
  });

  // The keyboard ring sits 2 px outside a control in the new look (2 wide): pulled 12 into the
  // card's 16, More's ring would end on the card's edge. On the phone it is drawn inside More; its
  // place, its 24 and its 44 tap area are as they were, so More and the gauge still do not overlap.
  it("on the phone its focus ring is drawn inside it, so the ring stays inside the card; its place and tap area unchanged", () => {
    renderRow();
    const classes = more().className.split(/\s+/);
    expect(classes).toContain("max-md:focus-visible:outline-offset-[-2px]!");
    // From 768 (38 drawn, not pulled into the padding) the app's ring outside it.
    expect(classes.filter((c) => c.includes("outline-offset") && !c.startsWith("max-md:"))).toEqual([]);
    expect(more().parentElement).toHaveClass("max-md:-mr-3");
    expect(classes).toEqual(expect.arrayContaining(["tap-44", "size-6", "md:size-[38px]"]));
  });

  it("More, every item, the field's keys, Cancel and the confirmed Delete: the row is never opened", async () => {
    const { onOpen, p } = renderRow();

    open();
    fireEvent.click(item("Rename"));
    const field = within(dialog()).getByRole("textbox", { name: `Rename ${TITLE}` });
    fireEvent.change(field, { target: { value: "Leg day hooks" } });
    fireEvent.keyDown(field, { key: "Enter" });
    fireEvent.keyUp(field, { key: "Enter" });
    await settle();

    open();
    fireEvent.click(item("Pin"));
    await settle();

    open();
    fireEvent.click(item("Close"));
    await settle();

    open();
    fireEvent.click(item("Delete"));
    fireEvent.click(item("Cancel"));
    await settle();

    open();
    fireEvent.click(item("Delete"));
    fireEvent.click(item("Delete"));
    await settle();

    expect(p.onRename).toHaveBeenCalledWith("Leg day hooks");
    expect(p.onTogglePin).toHaveBeenCalledTimes(1);
    expect(p.onDelete).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });
});

// ─── After posting (plan 2026-11-24-after-posting, Task 4) ───────────────────

describe.each(["phone", "desk"] as const)("RowMenu — the posted link (%s)", (view) => {
  beforeEach(() => widthIs(view));

  /** The page's clock the confirming Remove reads (`performance.now`), moved by hand. */
  function clock() {
    vi.useFakeTimers({ toFake: ["performance"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
  }
  const later = (ms: number) => vi.advanceTimersByTime(ms);

  it("a chat with a simulated piece and no posted link: Rename, Pin, Add posted link, Delete", () => {
    renderMenu({ posted: "add", onAddPosted: vi.fn() });
    open();
    expect(rows()).toEqual(["Rename", "Pin", "Add posted link", "Delete"]);
  });

  it("a chat with a posted link: Rename, Pin, Remove posted link, Delete", () => {
    renderMenu({ posted: "remove", onRemovePosted: vi.fn(), pinned: true });
    open();
    expect(rows()).toEqual(["Rename", "Unpin", "Remove posted link", "Delete"]);
  });

  it("neither (nothing simulated): the three as before", () => {
    renderMenu({ posted: null });
    open();
    expect(rows()).toEqual(["Rename", "Pin", "Delete"]);
  });

  it("Add posted link: onAddPosted once, with the focus already on More; the layer closes", async () => {
    const focusAtCall: Array<Element | null> = [];
    const onAddPosted = vi.fn(() => focusAtCall.push(document.activeElement));
    renderMenu({ posted: "add", onAddPosted });
    open();
    const add = item("Add posted link");
    // A double tap: the second lands on the closing layer, which does nothing.
    act(() => {
      add.click();
      add.click();
    });
    expect(onAddPosted).toHaveBeenCalledTimes(1);
    expect(focusAtCall).toEqual([more()]);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it('Remove posted link asks "Remove the posted link?" with Remove and Cancel, the focus on Cancel; nothing sent', () => {
    const { p } = renderMenu({ posted: "remove", onRemovePosted: vi.fn() });
    open();
    fireEvent.click(item("Remove posted link"));
    expect(rows()).toEqual(["Remove the posted link?", "Remove", "Cancel"]);
    expect(item("Cancel")).toHaveFocus();
    // Still named for the chat.
    expect(screen.getByRole("dialog", { name: TITLE })).toBeInTheDocument();
    expect(item("Remove")).toHaveAccessibleDescription("Remove the posted link?");
    expect(p.onRemovePosted).not.toHaveBeenCalled();
  });

  it("Cancel, or Escape, at the question: nothing sent, closed, the focus on More", async () => {
    const { p } = renderMenu({ posted: "remove", onRemovePosted: vi.fn() });
    open();
    fireEvent.click(item("Remove posted link"));
    fireEvent.click(item("Cancel"));
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
    open();
    fireEvent.click(item("Remove posted link"));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
    expect(p.onRemovePosted).not.toHaveBeenCalled();
  });

  it("the confirming Remove ignores a press in its first 500 ms (a double tap), then removes once, the focus on More when it runs", async () => {
    clock();
    const focusAtCall: Array<Element | null> = [];
    const onRemovePosted = vi.fn(() => focusAtCall.push(document.activeElement));
    renderMenu({ posted: "remove", onRemovePosted });
    open();
    fireEvent.click(item("Remove posted link"));
    // The second tap of a double tap on "Remove posted link" can land on the confirming Remove (on
    // the phone's sheet, which stands on its bottom edge, it is in that row's place).
    fireEvent.click(item("Remove"));
    later(499);
    fireEvent.click(item("Remove"));
    expect(onRemovePosted).not.toHaveBeenCalled();
    later(1);
    const confirm = item("Remove");
    act(() => {
      confirm.click();
      confirm.click();
    });
    expect(onRemovePosted).toHaveBeenCalledTimes(1);
    expect(focusAtCall).toEqual([more()]);
    expect(screen.getByRole("button", { name: `More: ${TITLE}` })).toHaveFocus();
  });

  it("opens on the menu again after the question was left", async () => {
    renderMenu({ posted: "remove", onRemovePosted: vi.fn() });
    open();
    fireEvent.click(item("Remove posted link"));
    fireEvent.click(item("Cancel"));
    await settle();
    open();
    expect(rows()).toEqual(["Rename", "Pin", "Remove posted link", "Delete"]);
  });

  it("the steps share one row shape; Delete still asks once more with Cancel in its place from the bottom edge", () => {
    const shapes = () => Array.from(dialog().querySelectorAll('[data-part="menu-row"]')).map((row) => row.className);
    renderMenu({ posted: "remove", onRemovePosted: vi.fn() });
    open();
    const menu = shapes();
    fireEvent.click(item("Remove posted link"));
    expect(new Set([...menu, ...shapes()]).size).toBe(1);
    fireEvent.click(item("Cancel"));
    open();
    fireEvent.click(item("Delete"));
    // Four rows to three: Delete was the last row, Cancel is the last row.
    expect(rows()).toEqual(["Delete this chat?", "Delete", "Cancel"]);
  });

  it("has no axe violations, on the menu and at the question", async () => {
    renderMenu({ posted: "remove", onRemovePosted: vi.fn() });
    open();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(dialog())).toHaveNoViolations();
    fireEvent.click(item("Remove posted link"));
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(dialog())).toHaveNoViolations();
  });
});
