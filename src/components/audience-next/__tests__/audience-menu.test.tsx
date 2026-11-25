/** @vitest-environment happy-dom */
/**
 * AudienceMenu — the page's More (spec 2026-11-25-audience, 3.8): Rename, Read again (only when the container gives
 * it), and by kind "Disconnect @handle" or "Delete audience", asked once more. Rendered for real with Radix
 * underneath, through Library's layer (`row-menu-layer.tsx`), whose More is drawn here as the drawing's 38
 * round button (`renderTrigger`). Stand-ins: the build-time flag (on), `matchMedia` (the phone's sheet or
 * the desk's menu) and, where a test times a press, the page's clock (`performance.now`, through vitest's
 * fake timers; the timers stay real).
 */
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { MENU_ITEM, MenuRow, RowMenuLayer } from "@/components/library-next/row-menu-layer";
import {
  AUDIENCE_STRINGS as S,
  deleteQuestion,
  disconnectItem,
  disconnectQuestion,
  moreLabel,
  renameLabel,
} from "@/lib/audience-next/audience-words";

import { AudienceMenu, type AudienceMenuProps } from "../audience-menu";

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

const ACCOUNT_NAME = "@nia.tests";
const DESCRIBED = "Busy parents who meal-prep";
const DISCONNECT: AudienceMenuProps["removal"] = { kind: "disconnect", accountId: "00000000-0000-4000-8000-000000000100", handle: "nia.tests" };
const DELETE: AudienceMenuProps["removal"] = { kind: "delete" };

function renderMenu(over: Partial<AudienceMenuProps> = {}) {
  const p: AudienceMenuProps = { name: ACCOUNT_NAME, removal: DISCONNECT, onRename: vi.fn(), onRemove: vi.fn(), ...over };
  const view = render(<AudienceMenu {...p} />);
  return { p, ...view };
}

const more = (name = ACCOUNT_NAME) => screen.getByRole("button", { name: moreLabel(name) });
const dialog = () => screen.getByRole("dialog");
const item = (name: string) => within(dialog()).getByRole("button", { name });
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));
const open = (name?: string) => {
  more(name).focus();
  fireEvent.click(more(name));
};
const rowsOf = () => Array.from(dialog().querySelectorAll<HTMLElement>('[data-part="menu-row"]'));
/** The rows of the open step, top to bottom: each control's name, a field's name, or a row's first line. */
const rows = () =>
  rowsOf().map((row) => {
    const field = row.querySelector("input");
    if (field) return field.getAttribute("aria-label");
    const control = row.querySelector("button");
    return control ? control.textContent : (row.querySelector("p") ?? row).textContent;
  });
const field = () => within(dialog()).getByRole("textbox");
const confirming = (word: string) => within(rowsOf().at(-1)!).getByRole("button", { name: word });
/** Radix keeps a closing layer on screen (and pressable) until its exit animation ends: given one. */
function exits() {
  const style = document.createElement("style");
  style.textContent =
    '[data-row-menu][data-state="open"] { animation-name: enter; } [data-row-menu][data-state="closed"] { animation-name: exit; }';
  document.head.append(style);
  onTestFinished(() => style.remove());
}
function clock() {
  vi.useFakeTimers({ toFake: ["performance"] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}
const later = (ms: number) => vi.advanceTimersByTime(ms);

describe("AudienceMenu — More", () => {
  it("is the drawing's 38 round button on the page's ground, named for the audience, opening a dialog", () => {
    renderMenu();
    expect(more()).toHaveClass("h-[38px]", "w-[38px]", "rounded-full", "bg-surface", "shadow-[var(--shadow-control)]", "tap-44");
    expect(more()).toHaveAttribute("aria-haspopup", "dialog");
    expect(more()).toHaveAttribute("aria-expanded", "false");
    expect(more().querySelector("svg")).not.toBeNull();
    // Not the rows' three dots: not 24 drawn on a phone.
    expect(more()).not.toHaveClass("size-6");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is always shown: it never waits for a row's hover", () => {
    renderMenu();
    expect(more().className.split(/\s+/).filter((c) => c.startsWith("md:pointer-fine:"))).toEqual([]);
  });

  it.each(["phone", "desk"] as const)("a tap focuses it, as the dots are (%s)", (view) => {
    widthIs(view);
    renderMenu();
    const focused = vi.fn();
    more().addEventListener("focus", focused);
    expect(more()).not.toHaveFocus();
    fireEvent.click(more());
    expect(focused).toHaveBeenCalledTimes(1);
  });
});

describe.each(["phone", "desk"] as const)("AudienceMenu — the items (%s)", (view) => {
  beforeEach(() => widthIs(view));

  it("an account's audience: Rename, then Disconnect @handle; named for the audience; the focus on Rename", () => {
    renderMenu();
    open();
    expect(screen.getByRole("dialog", { name: ACCOUNT_NAME })).toBeInTheDocument();
    expect(rows()).toEqual([S.rename, disconnectItem("nia.tests")]);
    expect(item(S.rename)).toHaveFocus();
  });

  it("with Read again given: Rename, Read again, Disconnect @handle", () => {
    renderMenu({ onReadAgain: vi.fn() });
    open();
    expect(rows()).toEqual([S.rename, S.readAgain, disconnectItem("nia.tests")]);
  });

  it("an audience with no account (a description, another creator): Rename, then Delete audience", () => {
    renderMenu({ name: DESCRIBED, removal: DELETE });
    open(DESCRIBED);
    expect(screen.getByRole("dialog", { name: DESCRIBED })).toBeInTheDocument();
    expect(rows()).toEqual([S.rename, S.deleteAudience]);
  });

  it("is a sheet on a phone and a menu standing on More on a desk", () => {
    renderMenu();
    open();
    expect(document.querySelector('[data-slot="sheet-overlay"]') !== null).toBe(view === "phone");
    if (view === "desk") expect(dialog()).toHaveAttribute("data-side");
  });

  it.each([
    ["Escape", () => fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })],
    ["Close", () => fireEvent.click(item(S.close))],
  ])("closing with %s sends nothing and hands the focus back to More", async (_how, close) => {
    const { p } = renderMenu();
    open();
    close();
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
    expect(p.onRename).not.toHaveBeenCalled();
    expect(p.onRemove).not.toHaveBeenCalled();
  });
});

describe.each(["phone", "desk"] as const)("AudienceMenu — Rename (%s)", (view) => {
  beforeEach(() => widthIs(view));

  const startRename = (over: Partial<AudienceMenuProps> = {}) => {
    const view = renderMenu(over);
    open(over.name);
    fireEvent.click(item(S.rename));
    return view;
  };

  it("turns the layer into a field named for the audience, holding its name, focused; Save and Cancel under it", () => {
    startRename({ name: DESCRIBED, removal: DELETE });
    expect(rows()).toEqual([renameLabel(DESCRIBED), S.save, S.cancel]);
    expect(field()).toHaveAccessibleName(renameLabel(DESCRIBED));
    expect(field()).toHaveValue(DESCRIBED);
    expect(field()).toHaveFocus();
    expect(field()).toHaveAttribute("maxLength", "80");
    // The header says Rename; the audience's name is still in it for a screen reader.
    expect(screen.getByRole("dialog", { name: `${S.rename} ${DESCRIBED}` })).toBeInTheDocument();
  });

  it("Save sends the new name, trimmed, once, and closes", async () => {
    const { p } = startRename();
    fireEvent.change(field(), { target: { value: "  Night owls  " } });
    fireEvent.click(item(S.save));
    await settle();
    expect(p.onRename).toHaveBeenCalledTimes(1);
    expect(p.onRename).toHaveBeenCalledWith("Night owls");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
  });

  it("Enter saves", async () => {
    const { p } = startRename();
    fireEvent.change(field(), { target: { value: "Night owls" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    await settle();
    expect(p.onRename).toHaveBeenCalledWith("Night owls");
  });

  it("typing stops at 80 characters", async () => {
    const user = userEvent.setup();
    startRename();
    await user.clear(field());
    await user.type(field(), "a".repeat(90));
    expect(field()).toHaveValue("a".repeat(80));
  });

  it("an empty name is not sent: Save waits (aria-disabled), the field stays", () => {
    const { p } = startRename();
    fireEvent.change(field(), { target: { value: "   " } });
    expect(item(S.save)).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(item(S.save));
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(p.onRename).not.toHaveBeenCalled();
    expect(field()).toBeInTheDocument();
  });

  it("a stored name over 80 characters is not sent as it is (the route would refuse it)", () => {
    const long = "a".repeat(85);
    const { p } = startRename({ name: long, removal: DELETE });
    fireEvent.change(field(), { target: { value: `${long}b` } });
    expect(item(S.save)).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(item(S.save));
    expect(p.onRename).not.toHaveBeenCalled();
  });

  it("an unchanged name sends nothing, and closes", async () => {
    const { p } = startRename();
    fireEvent.change(field(), { target: { value: ` ${ACCOUNT_NAME} ` } });
    fireEvent.click(item(S.save));
    await settle();
    expect(p.onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Cancel sends nothing, closes, the focus on More", async () => {
    const { p } = startRename();
    fireEvent.change(field(), { target: { value: "Night owls" } });
    fireEvent.click(item(S.cancel));
    await settle();
    expect(p.onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
  });

  it("opens on the menu again after a rename was left", async () => {
    startRename();
    fireEvent.click(item(S.cancel));
    await settle();
    open();
    expect(rows()).toEqual([S.rename, disconnectItem("nia.tests")]);
  });
});

describe.each(["phone", "desk"] as const)("AudienceMenu — the remove is asked once more (%s)", (view) => {
  beforeEach(() => widthIs(view));

  it.each([
    ["an account's audience", DISCONNECT, ACCOUNT_NAME, disconnectItem("nia.tests"), disconnectQuestion("nia.tests"), S.disconnect],
    ["an audience with no account", DELETE, DESCRIBED, S.deleteAudience, deleteQuestion(DESCRIBED), S.delete],
  ] as const)("%s: the question, the line, Cancel (focused), then the confirming button; nothing sent yet", (_who, removal, name, word, question, confirm) => {
    const { p } = renderMenu({ name, removal });
    open(name);
    fireEvent.click(item(word));
    expect(p.onRemove).not.toHaveBeenCalled();
    expect(rows()).toEqual([question, S.cancel, confirm]);
    expect(within(dialog()).getByText(S.removeLine)).toBeInTheDocument();
    expect(item(S.cancel)).toHaveFocus();
    expect(confirming(confirm)).toHaveClass("bg-surface-sunken", "text-error");
    expect(confirming(confirm)).toHaveAccessibleDescription(`${question} ${S.removeLine}`);
    // Still named for the audience.
    expect(screen.getByRole("dialog", { name })).toBeInTheDocument();
  });

  it("the confirming button ignores presses for its first 500 ms; then it calls onRemove once, with the focus on More", async () => {
    clock();
    let focused: Element | null = null;
    const onRemove = vi.fn(() => (focused = document.activeElement));
    renderMenu({ onRemove });
    open();
    fireEvent.click(item(disconnectItem("nia.tests")));
    later(100);
    fireEvent.click(confirming(S.disconnect));
    later(300);
    fireEvent.click(confirming(S.disconnect));
    expect(onRemove).not.toHaveBeenCalled();
    expect(within(dialog()).getByText(disconnectQuestion("nia.tests"))).toBeInTheDocument();
    // It looks and reads the same through the wait.
    expect(confirming(S.disconnect)).not.toBeDisabled();
    expect(confirming(S.disconnect)).not.toHaveAttribute("aria-disabled");
    later(200);
    const confirm = confirming(S.disconnect);
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(focused).toBe(more());
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
  });

  it("a press inside the wait is dropped, not kept: nothing fires when the wait ends", async () => {
    vi.useFakeTimers({ toFake: ["performance", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const { p } = renderMenu({ name: DESCRIBED, removal: DELETE });
    open(DESCRIBED);
    fireEvent.click(item(S.deleteAudience));
    later(300);
    fireEvent.click(confirming(S.delete));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(p.onRemove).not.toHaveBeenCalled();
  });

  it("Cancel sends nothing; closed; the focus on More", async () => {
    const { p } = renderMenu();
    open();
    fireEvent.click(item(disconnectItem("nia.tests")));
    fireEvent.click(item(S.cancel));
    await settle();
    expect(p.onRemove).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveFocus();
  });

  it("a second tap on the confirming button while the layer closes does nothing", () => {
    exits();
    clock();
    const { p } = renderMenu();
    open();
    fireEvent.click(item(disconnectItem("nia.tests")));
    later(600);
    const confirm = confirming(S.disconnect);
    fireEvent.click(confirm);
    expect(document.querySelector("[data-row-menu]")).toHaveAttribute("data-state", "closed");
    act(() => {
      confirm.click();
    });
    expect(p.onRemove).toHaveBeenCalledTimes(1);
  });
});

describe.each(["phone", "desk"] as const)("AudienceMenu — Read again (%s)", (view) => {
  beforeEach(() => widthIs(view));

  it("closes the layer with the focus on More, then calls onReadAgain with More", async () => {
    let focused: Element | null = null;
    const onReadAgain = vi.fn(() => (focused = document.activeElement));
    const { p } = renderMenu({ onReadAgain });
    open();
    fireEvent.click(item(S.readAgain));
    expect(onReadAgain).toHaveBeenCalledTimes(1);
    expect(onReadAgain).toHaveBeenCalledWith(more());
    expect(focused).toBe(more());
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(p.onRename).not.toHaveBeenCalled();
    expect(p.onRemove).not.toHaveBeenCalled();
  });

  it("a second tap on Read again while the layer closes does nothing", () => {
    exits();
    const onReadAgain = vi.fn();
    renderMenu({ onReadAgain });
    open();
    const again = item(S.readAgain);
    act(() => {
      again.click();
      again.click();
    });
    expect(onReadAgain).toHaveBeenCalledTimes(1);
  });
});

describe("AudienceMenu — opened by the dev preview", () => {
  it("defaultOpen: open on the menu from the start, the focus on Rename", async () => {
    renderMenu({ defaultOpen: true });
    expect(await screen.findByRole("dialog", { name: ACCOUNT_NAME })).toBeInTheDocument();
    expect(rows()).toEqual([S.rename, disconnectItem("nia.tests")]);
    fireEvent.click(item(S.rename));
    expect(field()).toHaveValue(ACCOUNT_NAME);
  });
});

describe("AudienceMenu — accessibility", () => {
  it.each(["phone", "desk"] as const)("has no axe violations: closed, open, renaming, and at the question (%s)", async (view) => {
    widthIs(view);
    const { container } = renderMenu({ onReadAgain: vi.fn() });
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
    open();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(dialog())).toHaveNoViolations();
    fireEvent.click(item(S.rename));
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(dialog())).toHaveNoViolations();
    fireEvent.click(item(S.cancel));
    await settle();
    open();
    fireEvent.click(item(disconnectItem("nia.tests")));
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(dialog())).toHaveNoViolations();
  });
});

// ─── RowMenuLayer's `renderTrigger` ──────────────────────────────────────────
// The shared layer draws a caller's own More when given one; without it, Library's and You's three dots
// (their own tests hold those).

function OwnTrigger({ onMenuOpen }: { onMenuOpen?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const change = (next: boolean) => {
    setOpen(next);
    onMenuOpen?.(next);
  };
  return (
    <RowMenuLayer
      name="Row"
      heading="Row"
      open={open}
      onOpenChange={change}
      onClose={() => change(false)}
      firstRef={firstRef}
      triggerRef={triggerRef}
      divided
      waitsForRow={false}
      renderTrigger={(ref) => (
        <button ref={ref} type="button" data-own-trigger="">
          Pick
        </button>
      )}
    >
      <MenuRow>
        <button ref={firstRef} type="button" className={MENU_ITEM}>
          First
        </button>
      </MenuRow>
    </RowMenuLayer>
  );
}

describe.each(["phone", "desk"] as const)("RowMenuLayer — renderTrigger (%s)", (view) => {
  beforeEach(() => widthIs(view));

  it("the element given is the trigger, in place of the three dots: it opens the layer and says so", () => {
    const onMenuOpen = vi.fn();
    render(<OwnTrigger onMenuOpen={onMenuOpen} />);
    const pick = screen.getByRole("button", { name: "Pick" });
    expect(pick).toHaveAttribute("data-own-trigger");
    expect(screen.queryByRole("button", { name: "More: Row" })).toBeNull();
    expect(pick).toHaveAttribute("aria-haspopup", "dialog");
    fireEvent.click(pick);
    expect(onMenuOpen).toHaveBeenCalledWith(true);
    expect(pick).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  });

  it("a tap focuses it; closing hands the focus back to it (it holds the layer's triggerRef)", async () => {
    render(<OwnTrigger />);
    const pick = screen.getByRole("button", { name: "Pick" });
    const focused = vi.fn();
    pick.addEventListener("focus", focused);
    fireEvent.click(pick);
    expect(focused).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(pick).toHaveFocus();
  });
});
