/** @vitest-environment happy-dom */
/**
 * AudienceSwitcher — the pill in Audience's title and the choice it opens (spec 2026-11-25-audience, 3.5): on a
 * phone a bottom sheet, from 768 a menu under the pill. "Audience · Whose viewers Maven simulates", the
 * creator's audiences with their face, name and line, a check on the one new chats use, and a last row for a
 * new audience. Rendered for real with Radix underneath; the choices are the real model's (the dev preview's
 * made-up audiences). Stand-ins: the build-time flag (on) and `matchMedia` (a phone or a desk).
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { axe } from "vitest-axe";

vi.setConfig({ testTimeout: 20_000 });
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { DEV_PAGES } from "@/app/(app)/dev/audience/fixtures";
import type { SwitcherChoice } from "@/lib/audience-next/audience-model";
import { AUDIENCE_STRINGS as S } from "@/lib/audience-next/audience-words";

import { AudienceSwitcher, type AudienceSwitcherProps } from "../audience-switcher";

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

const NAME = DEV_PAGES.own.page.name;
/** The own page's choices: @nia.tests (checked: new chats use it), @leo.makes, Busy parents who meal-prep. */
const CHOICES = DEV_PAGES.own.choices;
const NONE_CHECKED: SwitcherChoice[] = CHOICES.map((c) => ({ ...c, selected: false }));
/** The check on a row that is not the first (the own page's is first). */
const SECOND_CHECKED: SwitcherChoice[] = CHOICES.map((c, i) => ({ ...c, selected: i === 1 }));

interface Spies {
  onOpenChange: Mock<(open: boolean) => void>;
  onPick: Mock<(choice: SwitcherChoice) => void>;
  onNew: Mock<() => void>;
}

/** Holds `open` as the container does; a pick or New audience is only reported (the container closes). */
function show(over: Partial<Pick<AudienceSwitcherProps, "name" | "choices">> & { open?: boolean } = {}) {
  const spies: Spies = { onOpenChange: vi.fn(), onPick: vi.fn(), onNew: vi.fn() };
  function Harness() {
    const [open, setOpen] = useState(over.open ?? false);
    return (
      <>
        <AudienceSwitcher
          name={over.name ?? NAME}
          choices={over.choices ?? CHOICES}
          open={open}
          onOpenChange={(next) => {
            spies.onOpenChange(next);
            setOpen(next);
          }}
          onPick={spies.onPick}
          onNew={spies.onNew}
        />
        <button type="button">Elsewhere</button>
      </>
    );
  }
  const view = render(<Harness />);
  return { ...view, ...spies };
}

/** The pill: named for the audience on the page. While a layer is open the page behind is hidden from
 *  screen readers, so it is found with `hidden`. */
const pill = (name = NAME) => screen.getByRole("button", { name: `${S.switcherTitle}: ${name}`, hidden: true });
const dialog = () => screen.getByRole("dialog", { name: S.switcherTitle });
/** The rows, top to bottom: the audiences, then New audience. */
const rows = () => within(dialog()).getAllByRole("button").filter((b) => b.getAttribute("aria-label") !== S.close);
const row = (name: string) => within(dialog()).getByRole("button", { name });
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 30)));
/** A press as a pointer gives it: the control takes the focus first. */
const press = (el: HTMLElement) => {
  el.focus();
  fireEvent.click(el);
};

// ─── The pill ────────────────────────────────────────────────────────────────

describe("AudienceSwitcher — the pill", () => {
  it("shows the audience's name and a caret; named Audience: the name; a closed layer behind it", () => {
    show();
    const p = pill();
    expect(p).toHaveTextContent(NAME);
    expect(p.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(p).toHaveAttribute("aria-haspopup", "dialog");
    expect(p).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("a long name is cut at 180 on one line, and the pill can shrink beside the title and More", () => {
    const long = "Busy parents who meal-prep on a Sunday for the whole week ahead";
    show({ name: long });
    const p = pill(long);
    expect(p).toHaveClass("min-w-0");
    const words = Array.from(p.querySelectorAll("span")).find((s) => s.textContent === long)!;
    expect(words).toHaveClass("truncate", "min-w-0", "max-w-[180px]");
  });

  it("under 360 wide the pill gives up a little of its padding and gap, so a ten-letter handle stays whole beside Audience and More", () => {
    show();
    const p = pill();
    expect(p).toHaveClass("max-[359px]:pl-3", "max-[359px]:pr-2.5", "max-[359px]:gap-1");
  });

  it("a press opens the layer and focuses the pill first (Safari does not on a tap)", () => {
    const { onOpenChange } = show();
    press(pill());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(dialog()).toBeInTheDocument();
    expect(pill()).toHaveAttribute("aria-expanded", "true");
  });
});

// ─── The layer ───────────────────────────────────────────────────────────────

describe.each([
  ["a phone", "phone"],
  ["a desk", "desk"],
] as const)("AudienceSwitcher on %s", (_label, view) => {
  beforeEach(() => widthIs(view));

  it("is named Audience and described as whose viewers Maven simulates, with a heading and a Close", () => {
    show({ open: true });
    expect(dialog()).toHaveAccessibleDescription(S.switcherLine);
    expect(within(dialog()).getByRole("heading", { level: 2, name: S.switcherTitle })).toBeInTheDocument();
    expect(within(dialog()).getByText(S.switcherLine)).toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: S.close })).toBeInTheDocument();
  });

  it("lists the audiences in the choices' order, each with its face, name and line; New audience last", () => {
    show({ open: true });
    const list = rows();
    expect(list).toHaveLength(CHOICES.length + 1);
    CHOICES.forEach((choice, i) => {
      const r = list[i]!;
      expect(r).toHaveAccessibleName(choice.name);
      expect(r).toHaveAccessibleDescription(choice.line);
      expect(r.querySelector("[data-face]")).toHaveTextContent(choice.face.initial);
    });
    const last = list.at(-1)!;
    expect(last).toHaveAccessibleName(S.newAudience);
    expect(last).toHaveAccessibleDescription(S.newAudienceLine);
  });

  it("checks the one new chats use, and only that one (aria-pressed and the check)", () => {
    show({ open: true });
    for (const choice of CHOICES) {
      const r = row(choice.name);
      expect(r).toHaveAttribute("aria-pressed", String(choice.selected));
      expect(r.querySelector("[data-check]") !== null).toBe(choice.selected);
    }
    expect(CHOICES.filter((c) => c.selected)).toHaveLength(1);
    expect(row(S.newAudience)).not.toHaveAttribute("aria-pressed");
  });

  it("a row hands its choice to the caller, and nothing else", () => {
    const { onPick, onNew } = show({ open: true });
    const second = CHOICES[1]!;
    fireEvent.click(row(second.name));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(second);
    expect(onNew).not.toHaveBeenCalled();
  });

  it("the last row, New audience, calls onNew", () => {
    const { onPick, onNew } = show({ open: true });
    fireEvent.click(row(S.newAudience));
    expect(onNew).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("Close and Escape close it", () => {
    const { onOpenChange } = show({ open: true });
    fireEvent.click(within(dialog()).getByRole("button", { name: S.close }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("dialog")).toBeNull();
    press(pill());
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("on open the focus is on the checked row, wherever it stands", async () => {
    show({ choices: SECOND_CHECKED });
    press(pill());
    await settle();
    expect(row(SECOND_CHECKED[1]!.name)).toHaveFocus();
  });

  it("with none checked, on the first row", async () => {
    show({ choices: NONE_CHECKED });
    press(pill());
    await settle();
    expect(rows()[0]).toHaveFocus();
  });

  it("on close the focus goes back to the pill (Escape and Close)", async () => {
    show();
    press(pill());
    await settle();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(pill()).toHaveFocus();

    press(pill());
    await settle();
    fireEvent.click(within(dialog()).getByRole("button", { name: S.close }));
    await settle();
    expect(pill()).toHaveFocus();
  });

  it("has no axe violations, open", async () => {
    show({ open: true });
    await settle();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(dialog())).toHaveNoViolations();
  });
});

describe("AudienceSwitcher — phone and desk", () => {
  it("on a phone: a bottom sheet that scrolls when the list is taller than the screen", () => {
    show({ open: true });
    const sheet = document.querySelector<HTMLElement>('[data-slot="sheet-content"]');
    expect(sheet).not.toBeNull();
    expect(sheet).toHaveAttribute("data-side", "bottom");
    expect(sheet).toHaveClass("overflow-y-auto", "max-h-[calc(100dvh-24px)]");
  });

  it("from 768: a menu under the pill at its end edge, 360 wide, not a sheet", () => {
    widthIs("desk");
    show({ open: true });
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull();
    expect(dialog()).toHaveAttribute("data-side", "bottom");
    expect(dialog()).toHaveAttribute("data-align", "end");
    expect(dialog()).toHaveClass("w-[360px]", "overflow-y-auto");
  });

  it("has no axe violations closed (the pill in the page)", async () => {
    const { container } = show();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("AudienceSwitcher — busy (a switch on its way)", () => {
  function showBusy(busy: boolean) {
    return render(<AudienceSwitcher name={NAME} choices={CHOICES} open={false} onOpenChange={vi.fn()} onPick={vi.fn()} onNew={vi.fn()} busy={busy} />);
  }
  const words = () => Array.from(pill().querySelectorAll("span")).find((s) => s.textContent === NAME)!;

  it("says so: aria-busy on the pill, its name dimmed", () => {
    showBusy(true);
    expect(pill()).toHaveAttribute("aria-busy", "true");
    expect(words()).toHaveClass("opacity-50");
  });

  it("at rest: no aria-busy, the name at full strength", () => {
    showBusy(false);
    expect(pill()).not.toHaveAttribute("aria-busy");
    expect(words()).not.toHaveClass("opacity-50");
  });
});

describe("AudienceSwitcher — the focus across the swap at 768", () => {
  it("a pill that has the focus when the phone's sheet gives way to the desk's menu keeps it", async () => {
    // The width as the browser reports it, and its listeners: crossing 768 redraws the pill under the other
    // layer (the same swap as the first frame, where the width is not known yet).
    let wide = false;
    const listeners = new Set<() => void>();
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          get matches() {
            return wide && /min-width:\s*768px/.test(query);
          },
          media: query,
          onchange: null,
          addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
          removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    );
    show();
    const before = pill();
    before.focus();
    act(() => {
      wide = true;
      listeners.forEach((listener) => listener());
    });
    await settle();
    expect(pill()).not.toBe(before);
    expect(pill()).toHaveFocus();
  });

  it("one that does not have the focus does not take it", async () => {
    let wide = false;
    const listeners = new Set<() => void>();
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          get matches() {
            return wide && /min-width:\s*768px/.test(query);
          },
          media: query,
          onchange: null,
          addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
          removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    );
    show();
    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
    elsewhere.focus();
    act(() => {
      wide = true;
      listeners.forEach((listener) => listener());
    });
    await settle();
    expect(elsewhere).toHaveFocus();
  });
});
