/** @vitest-environment happy-dom */
/**
 * AnswerSheet — the details sheet's shell (spec §3 "Where"): a bottom sheet on a phone, a centred 560
 * dialog from 768 up. Escape and the grab handle close it; focus goes back to the row that opened it.
 * Real Radix layers; the one stand-in is matchMedia (phone or desk).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { anySheetOpen } from "@/lib/thread-next/open-sheets";

import { AnswerSheet, SETTLE_MS, settleClock } from "../answer-sheet";

function viewport(wide: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: wide && /min-width:\s*768px/.test(query),
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

const TITLE = "Stop eating sad desk lunch: my 3-step fix for brain fog during exams.";

function Harness({ onInside }: { onInside?: () => void } = {}) {
  const [open, setOpen] = useState(false);
  const [row, setRow] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <button ref={setRow} type="button" onClick={() => setOpen(true)}>
        Open row
      </button>
      <AnswerSheet open={open} onOpenChange={setOpen} title={TITLE} returnFocus={row}>
        <button type="button" onClick={onInside}>
          Inside
        </button>
      </AnswerSheet>
    </>
  );
}

/** Records, for each time it mounts, which shell it mounted in. */
function Where({ seen }: { seen: string[] }) {
  return (
    <span
      ref={(el) => {
        if (el) seen.push(el.closest("[data-sheet]")?.getAttribute("data-sheet") ?? "none");
      }}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// A clock that jumps a second at every read: a click right after opening is past the settle window.
// The window's own test drives the clock by hand.
let tick = 0;
beforeEach(() => {
  tick = 0;
  settleClock.now = () => (tick += 1000);
});
afterEach(() => {
  settleClock.now = () => performance.now();
});

describe("AnswerSheet", () => {
  it.each([
    ["phone", false],
    ["desktop", true],
  ] as const)("on the %s: named by its text, which is its heading; Escape closes it and focus goes back to the row", async (_view, wide) => {
    viewport(wide);
    render(<Harness />);
    const row = screen.getByRole("button", { name: "Open row" });
    fireEvent.click(row);
    const dialog = await screen.findByRole("dialog", { name: TITLE });
    expect(within(dialog).getByRole("heading", { level: 2, name: TITLE })).toBeInTheDocument();
    expect(dialog).toHaveAttribute("data-sheet", wide ? "dialog" : "sheet");
    expect(document.querySelector('[data-slot="sheet-handle"]') !== null).toBe(!wide);
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(row);
  });

  it.each([
    ["phone", false],
    ["desktop", true],
  ] as const)("on the %s: opening focuses the heading, not a control; Tab then reaches the first control", async (_view, wide) => {
    viewport(wide);
    const user = userEvent.setup();
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open row" }));
    const dialog = await screen.findByRole("dialog", { name: TITLE });
    const heading = within(dialog).getByRole("heading", { level: 2, name: TITLE });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    // Not a control: no focus ring, set inline so the app-wide `:focus-visible` outline cannot win.
    expect(heading.style.outline).toMatch(/^none/);
    await user.tab();
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Inside" }));
  });

  it("desktop: the first commit is already the dialog (the bottom sheet never mounts)", () => {
    viewport(true);
    const seen: string[] = [];
    render(
      <AnswerSheet open onOpenChange={() => {}} title={TITLE}>
        <Where seen={seen} />
      </AnswerSheet>,
    );
    expect(document.querySelector('[data-slot="sheet-handle-zone"]')).toBeNull();
    expect(seen).toEqual(["dialog"]);
  });

  it.each([
    ["phone", false],
    ["desktop", true],
  ] as const)("on the %s: a click in the sheet's first moment is dropped (a double-tap's second tap); after it, it counts", async (_view, wide) => {
    viewport(wide);
    let now = 5_000;
    settleClock.now = () => now;
    const inside = vi.fn();
    render(<Harness onInside={inside} />);
    fireEvent.click(screen.getByRole("button", { name: "Open row" }));
    const dialog = await screen.findByRole("dialog", { name: TITLE });
    const button = within(dialog).getByRole("button", { name: "Inside" });
    now += SETTLE_MS - 1;
    fireEvent.click(button);
    expect(inside).not.toHaveBeenCalled();
    now += 1;
    fireEvent.click(button);
    expect(inside).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["phone", false],
    ["desktop", true],
  ] as const)("on the %s: a Close control for a screen reader, out of sight until the keyboard reaches it, closes the sheet", async (_view, wide) => {
    viewport(wide);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open row" }));
    const dialog = await screen.findByRole("dialog", { name: TITLE });
    const close = within(dialog).getByRole("button", { name: "Close" });
    expect(close.className).toContain("sr-only");
    expect(close.className).toContain("focus-visible:not-sr-only");
    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("phone: a tap on the grab handle closes it", async () => {
    viewport(false);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open row" }));
    await screen.findByRole("dialog");
    fireEvent.click(document.querySelector('[data-slot="sheet-handle-zone"]')!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("desktop: 560 wide on the card surface", async () => {
    viewport(true);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open row" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.className).toContain("w-[560px]");
    expect(dialog.className).toContain("bg-surface");
  });
});

describe("AnswerSheet — tells the page while it is open (the thread's fold waits for it, thread depth Task 3)", () => {
  it.each([
    ["phone", false],
    ["desktop", true],
  ] as const)("on the %s: not while closed; while open, yes; once Escape has closed it, no", async (_view, wide) => {
    viewport(wide);
    render(<Harness />);
    expect(anySheetOpen()).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Open row" }));
    const dialog = await screen.findByRole("dialog", { name: TITLE });
    expect(anySheetOpen()).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(anySheetOpen()).toBe(false);
  });

  it("unmounted while open (its turn replaced): no longer told as open", () => {
    viewport(false);
    const { unmount } = render(
      <AnswerSheet open onOpenChange={() => {}} title={TITLE}>
        x
      </AnswerSheet>,
    );
    expect(anySheetOpen()).toBe(true);
    unmount();
    expect(anySheetOpen()).toBe(false);
  });

  it("two open at once: open until both have closed", () => {
    viewport(false);
    const first = render(
      <AnswerSheet open onOpenChange={() => {}} title={TITLE}>
        x
      </AnswerSheet>,
    );
    const second = render(
      <AnswerSheet open onOpenChange={() => {}} title="Another">
        y
      </AnswerSheet>,
    );
    first.rerender(
      <AnswerSheet open={false} onOpenChange={() => {}} title={TITLE}>
        x
      </AnswerSheet>,
    );
    expect(anySheetOpen()).toBe(true);
    second.unmount();
    expect(anySheetOpen()).toBe(false);
  });
});
