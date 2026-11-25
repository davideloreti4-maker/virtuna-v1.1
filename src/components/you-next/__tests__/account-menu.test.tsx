/** @vitest-environment happy-dom */
/**
 * AccountMenu — an account row's More on You (plan 2026-11-24-you, Task 6): Make primary (not on
 * the primary), Disconnect asked once more with the existing warning, rendered for real with Radix
 * underneath, through Library's layer (`row-menu-layer.tsx`). The one stand-in is `matchMedia`,
 * which decides the phone's bottom sheet or the desk's menu standing on More, and, where a test
 * times a press, the page's clock (`performance.now`, through vitest's fake timers; timers stay real).
 * Where a test needs a layer that is closing, it gives the layer an exit animation as the app's
 * stylesheet does (`exits`).
 */
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { AccountMenu, type AccountMenuProps } from "../account-menu";
import { DISCONNECT_LINE } from "../you-words";

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

const HANDLE = "nia.tests.kitchen";
const NAME = `@${HANDLE}`;
const QUESTION = `Disconnect ${NAME}?`;

function renderMenu(over: Partial<AccountMenuProps> = {}) {
  const p: AccountMenuProps = { handle: HANDLE, primary: false, onMakePrimary: vi.fn(), onDisconnect: vi.fn(), ...over };
  const view = render(<AccountMenu {...p} />);
  return { p, ...view };
}

const more = () => screen.getByRole("button", { name: `More: ${NAME}` });
const layer = () => screen.getByRole("dialog", { name: NAME });
const dialog = () => screen.getByRole("dialog");
const item = (name: string) => within(dialog()).getByRole("button", { name });
/** Radix hands the focus back on a timer once the layer is gone. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));
const open = () => {
  more().focus();
  fireEvent.click(more());
};
const rowsOf = () => Array.from(dialog().querySelectorAll<HTMLElement>('[data-part="menu-row"]'));
/** The rows of the open step, top to bottom: each control's name, or a row's first line. */
const rows = () =>
  rowsOf().map((row) => {
    const control = row.querySelector("button");
    return control ? control.textContent : (row.querySelector("p") ?? row).textContent;
  });
const rowsBox = () => rowsOf()[0]!.parentElement!;
const confirming = () => within(rowsOf().at(-1)!).getByRole("button", { name: "Disconnect" });
/**
 * The layer's exit, as the app's stylesheet has it (an animation out): Radix keeps a closing layer on
 * screen, and pressable, until its animation ends. happy-dom never ends one, so after this a closed
 * layer stays closing, as it does for 300 ms in a browser.
 */
function exits() {
  const style = document.createElement("style");
  style.textContent =
    '[data-row-menu][data-state="open"] { animation-name: enter; } [data-row-menu][data-state="closed"] { animation-name: exit; }';
  document.head.append(style);
  onTestFinished(() => style.remove());
}
/**
 * The page's clock stood in (`performance.now`): `later(ms)` moves it on. Only the clock: Radix's and
 * React's timers stay real.
 */
function clock() {
  vi.useFakeTimers({ toFake: ["performance"] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}
const later = (ms: number) => vi.advanceTimersByTime(ms);
/** The closing layer (no longer named in the accessibility tree once closed). */
const closing = () => {
  const node = document.querySelector<HTMLElement>("[data-row-menu]");
  expect(node).toHaveAttribute("data-state", "closed");
  return node!;
};

describe("AccountMenu — the More button", () => {
  it('is named "More: @{handle}", three dots, 24 drawn (38 from 768), with a 44 px tap area; it opens a dialog', () => {
    renderMenu();
    expect(more()).toHaveClass("tap-44", "size-6", "md:size-[38px]");
    expect(more()).toHaveAttribute("aria-haspopup", "dialog");
    expect(more()).toHaveAttribute("aria-expanded", "false");
    expect(more().querySelector("svg")).not.toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is always shown, as drawn: it does not wait for a hover on a desk with a mouse (Library's rows do)", () => {
    renderMenu();
    const classes = more().className.split(/\s+/);
    expect(classes.filter((c) => c.startsWith("md:pointer-fine:"))).toEqual([]);
  });
});

describe("AccountMenu on the phone", () => {
  it("opens a bottom sheet named for the account: Make primary, then Disconnect; the focus on Make primary", () => {
    renderMenu();
    open();
    expect(layer()).toBeInTheDocument();
    expect(document.querySelector('[data-slot="sheet-overlay"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="sheet-handle"]')).not.toBeNull();
    expect(rows()).toEqual(["Make primary", "Disconnect"]);
    expect(item("Make primary")).toHaveFocus();
  });

  it("the menu's hairlines are its own; the question's step keeps them unseen (transparent)", () => {
    renderMenu();
    open();
    expect(rowsBox().className.split(/\s+/)).toEqual(expect.arrayContaining(["max-md:divide-y", "max-md:divide-border"]));
    fireEvent.click(item("Disconnect"));
    expect(rowsBox().className.split(/\s+/)).toEqual(expect.arrayContaining(["max-md:divide-y", "max-md:divide-transparent"]));
    expect(rowsBox().className.split(/\s+/)).not.toContain("max-md:divide-border");
  });
});

describe("AccountMenu on a desk", () => {
  beforeEach(() => widthIs("desk"));

  it("is a menu standing on More, not a sheet: no scrim, no handle; named for the account", () => {
    renderMenu();
    open();
    expect(layer()).toBeInTheDocument();
    expect(layer()).toHaveAttribute("data-side");
    expect(document.querySelector('[data-slot="sheet-overlay"]')).toBeNull();
    expect(document.querySelector('[data-slot="sheet-handle"]')).toBeNull();
    expect(rows()).toEqual(["Make primary", "Disconnect"]);
    expect(item("Make primary")).toHaveFocus();
  });
});

describe.each(["phone", "desk"] as const)("AccountMenu — the menu (%s)", (view) => {
  beforeEach(() => widthIs(view));

  it("the primary account offers only Disconnect, with the focus on it", () => {
    renderMenu({ primary: true });
    open();
    expect(rows()).toEqual(["Disconnect"]);
    expect(item("Disconnect")).toHaveFocus();
  });

  it.each([false, true])("the menu is its rows and nothing more: no blank room under them (primary: %s)", (primary) => {
    renderMenu({ primary });
    open();
    expect(rowsBox().className).not.toMatch(/(^|\s)(max-md:|md:)?pb-/);
  });

  it("Make primary calls onMakePrimary once, closes, and the focus is back on More", async () => {
    const { p } = renderMenu();
    open();
    fireEvent.click(item("Make primary"));
    await settle();
    expect(p.onMakePrimary).toHaveBeenCalledTimes(1);
    expect(p.onDisconnect).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
  });

  // The layer stays on screen (and pressable) through its exit: a double tap must not send twice.
  it("a second tap on Make primary while the layer closes does nothing, nor a tap on its Disconnect", () => {
    exits();
    const { p } = renderMenu();
    open();
    const make = item("Make primary");
    const disconnect = item("Disconnect");
    act(() => {
      make.click();
      make.click();
    });
    fireEvent.click(make);
    expect(closing().contains(make)).toBe(true);
    fireEvent.click(disconnect);
    expect(p.onMakePrimary).toHaveBeenCalledTimes(1);
    // The closing layer kept its menu: no question asked there.
    expect(within(closing()).queryByText(QUESTION)).toBeNull();
    expect(p.onDisconnect).not.toHaveBeenCalled();
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
    expect(p.onMakePrimary).not.toHaveBeenCalled();
    expect(p.onDisconnect).not.toHaveBeenCalled();
  });
});

describe.each(["phone", "desk"] as const)("AccountMenu — Disconnect is asked once more (%s)", (view) => {
  beforeEach(() => widthIs(view));

  it('Disconnect asks "Disconnect @{handle}?" with the warning, then Cancel, then Disconnect; the focus on Cancel; nothing sent yet', () => {
    const { p } = renderMenu();
    open();
    fireEvent.click(item("Disconnect"));
    expect(p.onDisconnect).not.toHaveBeenCalled();
    expect(rows()).toEqual([QUESTION, "Cancel", "Disconnect"]);
    expect(item("Cancel")).toHaveFocus();
    // Still named for the account.
    expect(layer()).toBeInTheDocument();
  });

  it("the warning is the existing one, whole (never clipped), under the question; the confirming Disconnect is described by both", () => {
    renderMenu();
    open();
    fireEvent.click(item("Disconnect"));
    const line = within(dialog()).getByText(DISCONNECT_LINE);
    expect(line.className).not.toMatch(/line-clamp|truncate/);
    expect(within(dialog()).getByText(QUESTION).closest('[data-part="menu-row"]')).toBe(line.closest('[data-part="menu-row"]'));
    expect(confirming()).toHaveAccessibleDescription(`${QUESTION} ${DISCONNECT_LINE}`);
  });

  it("every row of both steps has one shape: a step's rows stand where the step before had its own", () => {
    const shapes = () => rowsOf().map((row) => row.className);
    renderMenu();
    open();
    const menu = shapes();
    fireEvent.click(item("Disconnect"));
    expect(new Set([...menu, ...shapes()]).size).toBe(1);
  });

  it("Cancel: nothing sent, closed, the focus on More", async () => {
    const { p } = renderMenu();
    open();
    fireEvent.click(item("Disconnect"));
    fireEvent.click(item("Cancel"));
    await settle();
    expect(p.onDisconnect).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
  });

  it("Escape at the question: nothing sent, closed, the focus on More", async () => {
    const { p } = renderMenu();
    open();
    fireEvent.click(item("Disconnect"));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await settle();
    expect(p.onDisconnect).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
  });

  it("Disconnect, then Disconnect: onDisconnect once, the layer closes, and the focus is on More when it runs", async () => {
    clock();
    let focused: Element | null = null;
    const onDisconnect = vi.fn(() => (focused = document.activeElement));
    renderMenu({ onDisconnect });
    open();
    fireEvent.click(item("Disconnect"));
    later(600);
    fireEvent.click(confirming());
    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(focused).toBe(more());
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
  });

  it("a second tap on the confirming Disconnect while the layer closes does nothing, nor one on its Cancel", () => {
    exits();
    clock();
    const { p } = renderMenu();
    open();
    fireEvent.click(item("Disconnect"));
    later(600);
    const confirm = confirming();
    const cancel = item("Cancel");
    fireEvent.click(confirm);
    expect(closing().contains(confirm)).toBe(true);
    fireEvent.click(confirm);
    act(() => {
      confirm.click();
      cancel.click();
    });
    expect(p.onDisconnect).toHaveBeenCalledTimes(1);
    // The focus stays on More, where the confirm put it (the page is still hidden behind the closing layer).
    expect(screen.getByRole("button", { name: `More: ${NAME}`, hidden: true })).toHaveFocus();
  });

  it("opens on the menu again after the question was left", async () => {
    renderMenu();
    open();
    fireEvent.click(item("Disconnect"));
    fireEvent.click(item("Cancel"));
    await settle();
    open();
    expect(rows()).toEqual(["Make primary", "Disconnect"]);
  });
});

describe("AccountMenu — accessibility", () => {
  it.each(["phone", "desk"] as const)("has no axe violations, closed, open, and at the question (%s)", async (view) => {
    widthIs(view);
    const { container } = renderMenu();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
    open();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(layer())).toHaveNoViolations();
    fireEvent.click(item("Disconnect"));
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(layer())).toHaveNoViolations();
  });
});

// ─── The confirming Disconnect is armed by time ──────────────────────────────
// Wherever the question step's rows fall (the phone's sheet stands on its bottom edge, the desk's menu
// on its top or, above More, its bottom; the question one line or four), the second press of a double
// tap, a double click or a second Enter lands within 500 ms of the step appearing: then the confirming
// Disconnect does nothing. A press inside the window is dropped, never kept for later.

describe.each(["phone", "desk"] as const)("AccountMenu — the confirming Disconnect waits 500 ms (%s)", (view) => {
  beforeEach(() => {
    widthIs(view);
    clock();
  });

  describe.each([
    ["an account", false],
    ["the primary account", true],
  ])("%s", (_who, primary) => {
    const ask = () => {
      const view = renderMenu({ primary });
      open();
      fireEvent.click(item("Disconnect"));
      expect(rows()).toEqual([QUESTION, "Cancel", "Disconnect"]);
      return view.p;
    };

    it("a second press 100 ms after Disconnect does nothing, nor one at 400 ms: nothing is sent, the question stays", () => {
      const p = ask();
      later(100);
      fireEvent.click(confirming());
      later(300);
      fireEvent.click(confirming());
      expect(p.onDisconnect).not.toHaveBeenCalled();
      expect(within(layer()).getByText(QUESTION)).toBeInTheDocument();
      // The confirming Disconnect looks and reads the same through the window: no `disabled`, no mark.
      expect(confirming()).not.toBeDisabled();
      expect(confirming()).not.toHaveAttribute("aria-disabled");
    });

    it("at 600 ms it disconnects, once", () => {
      const p = ask();
      later(600);
      const confirm = confirming();
      fireEvent.click(confirm);
      fireEvent.click(confirm);
      expect(p.onDisconnect).toHaveBeenCalledTimes(1);
    });

    it("a press at 300 ms, then nothing: nothing is sent when the window ends, nor after (it was dropped, not kept)", async () => {
      // The timers stood in too here, so a press kept for later would fire as the clock moves on.
      vi.useRealTimers();
      vi.useFakeTimers({ toFake: ["performance", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
      const p = ask();
      later(300);
      fireEvent.click(confirming());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
        await vi.advanceTimersByTimeAsync(1_000);
      });
      expect(p.onDisconnect).not.toHaveBeenCalled();
      expect(within(layer()).getByText(QUESTION)).toBeInTheDocument();
    });

    it("Cancel at 50 ms closes the step: nothing sent, the focus on More", async () => {
      const p = ask();
      later(50);
      fireEvent.click(item("Cancel"));
      await settle();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(more()).toHaveFocus();
      expect(p.onDisconnect).not.toHaveBeenCalled();
    });

    // happy-dom has no layout, so where a real second click lands is played here: on the confirming
    // Disconnect, the worst case.
    it("a double click whose second click lands on the confirming Disconnect leaves the account connected", () => {
      const p = renderMenu({ primary }).p;
      open();
      fireEvent.click(item("Disconnect"), { detail: 1 });
      later(80);
      fireEvent.click(confirming(), { detail: 2 });
      expect(p.onDisconnect).not.toHaveBeenCalled();
      expect(within(layer()).getByText(QUESTION)).toBeInTheDocument();
    });

    it("a double click on the confirming Disconnect inside the window leaves the account connected", async () => {
      const user = userEvent.setup();
      const p = ask();
      later(200);
      await user.dblClick(confirming());
      expect(p.onDisconnect).not.toHaveBeenCalled();
      expect(within(layer()).getByText(QUESTION)).toBeInTheDocument();
    });

    it("Enter pressed twice, or Space, leaves the account connected; so does Enter on the confirming Disconnect inside the window", async () => {
      const user = userEvent.setup();
      const p = renderMenu({ primary }).p;
      open();
      item("Disconnect").focus();
      await user.keyboard("{Enter}{Enter}");
      expect(p.onDisconnect).not.toHaveBeenCalled();
      await settle();
      open();
      item("Disconnect").focus();
      await user.keyboard(" ");
      // The focus is on Cancel; the next control is the confirming Disconnect.
      await user.tab();
      expect(confirming()).toHaveFocus();
      later(400);
      await user.keyboard("{Enter} ");
      expect(p.onDisconnect).not.toHaveBeenCalled();
      later(200);
      await user.keyboard("{Enter}");
      expect(p.onDisconnect).toHaveBeenCalledTimes(1);
    });

    it("the window starts again each time the question appears", async () => {
      const p = ask();
      later(50);
      fireEvent.click(item("Cancel"));
      await settle();
      later(700);
      open();
      fireEvent.click(item("Disconnect"));
      later(100);
      fireEvent.click(confirming());
      expect(p.onDisconnect).not.toHaveBeenCalled();
      later(500);
      fireEvent.click(confirming());
      expect(p.onDisconnect).toHaveBeenCalledTimes(1);
    });
  });
});

describe("AccountMenu: an account whose handle another listed account shares", () => {
  it("is named with its platform on More, in the layer and in the question", async () => {
    render(<AccountMenu handle="nia.tests" name="@nia.tests on Instagram" primary={false} onMakePrimary={vi.fn()} onDisconnect={vi.fn()} />);
    const more = screen.getByRole("button", { name: "More: @nia.tests on Instagram" });
    fireEvent.click(more);
    fireEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
    expect(await screen.findByText("Disconnect @nia.tests on Instagram?")).toBeInTheDocument();
  });
});
