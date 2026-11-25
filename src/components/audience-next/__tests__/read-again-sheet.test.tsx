/** @vitest-environment happy-dom */
/**
 * ReadAgainSheet — the question before an account's audience is read again (spec 2026-11-25-audience, 3.6
 * last paragraph, 3.8), on the thread's details sheet (`AnswerSheet`: a bottom sheet on a phone, the centred
 * dialog from 768). Stand-ins: the build-time flag (on), `matchMedia` (phone or desk), and the sheet's own
 * clock for its first moment (`settleClock`), so a press counts unless the test is about that moment.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { SETTLE_MS, settleClock } from "@/components/thread-next/answer-sheet";
import { AUDIENCE_STRINGS as S, readAgainLine } from "@/lib/audience-next/audience-words";

import { ReadAgainSheet } from "../read-again-sheet";

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

let tick = 0;
beforeEach(() => {
  settleClock.now = () => (tick += 1000);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  settleClock.now = () => performance.now();
});

/** A button that opens the question, as the source card's round button does; confirming closes it. */
function Harness({ onConfirm, handle = "nia.tests" }: { onConfirm(): void; handle?: string }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <button ref={setFrom} type="button" onClick={() => setOpen(true)}>
        Opener
      </button>
      <ReadAgainSheet
        open={open}
        onOpenChange={setOpen}
        handle={handle}
        returnFocus={from}
        onConfirm={() => {
          setOpen(false);
          onConfirm();
        }}
      />
    </>
  );
}

async function openIt(handle?: string) {
  const onConfirm = vi.fn();
  render(<Harness onConfirm={onConfirm} handle={handle} />);
  const opener = screen.getByRole("button", { name: "Opener" });
  opener.focus();
  fireEvent.click(opener);
  const dialog = await screen.findByRole("dialog", { name: S.readAgain });
  return { onConfirm, opener, dialog };
}

describe.each(["phone", "desk"] as const)("ReadAgainSheet (%s)", (view) => {
  it("is titled Read again, the title has the focus, and it says what happens", async () => {
    widthIs(view);
    const { dialog } = await openIt();
    expect(within(dialog).getByRole("heading", { level: 2, name: S.readAgain })).toHaveFocus();
    expect(within(dialog).getByText(readAgainLine("nia.tests"))).toBeInTheDocument();
    expect(dialog).toHaveAttribute("data-sheet", view === "desk" ? "dialog" : "sheet");
  });

  it("names the handle it is given (another creator's too)", async () => {
    widthIs(view);
    const { dialog } = await openIt("leo.makes");
    expect(within(dialog).getByText(readAgainLine("leo.makes"))).toBeInTheDocument();
  });

  it("its buttons: Read again (ink), then Cancel", async () => {
    widthIs(view);
    const { dialog } = await openIt();
    const buttons = within(dialog)
      .getAllByRole("button")
      .filter((b) => b.textContent !== S.close);
    expect(buttons.map((b) => b.textContent)).toEqual([S.readAgain, S.cancel]);
    // Ink: the app's action fill (the primary button).
    expect(buttons[0]).toHaveClass("bg-action");
    expect(buttons[1]).not.toHaveClass("bg-action");
  });

  it("Read again calls onConfirm once, also for two presses before the page draws again", async () => {
    widthIs(view);
    const { onConfirm, dialog } = await openIt();
    const yes = within(dialog).getByRole("button", { name: S.readAgain });
    act(() => {
      fireEvent.click(yes);
      fireEvent.click(yes);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("Cancel closes it, sends nothing, and the focus goes back where it opened from", async () => {
    widthIs(view);
    const { onConfirm, opener, dialog } = await openIt();
    fireEvent.click(within(dialog).getByRole("button", { name: S.cancel }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(opener).toHaveFocus());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Escape closes it the same way", async () => {
    widthIs(view);
    const { onConfirm, opener } = await openIt();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(opener).toHaveFocus());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("opened again after a confirm, it confirms again", async () => {
    widthIs(view);
    const { onConfirm, opener } = await openIt();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: S.readAgain }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog", { name: S.readAgain });
    fireEvent.click(within(dialog).getByRole("button", { name: S.readAgain }));
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it("has no axe violations open", async () => {
    widthIs(view);
    const { dialog } = await openIt();
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(dialog)).toHaveNoViolations();
  });
});

describe("ReadAgainSheet: the second tap of a double tap", () => {
  it("a press in the sheet's first moment does not confirm (the tap that opened it, landing again)", async () => {
    widthIs("phone");
    let now = 0;
    settleClock.now = () => now;
    const { onConfirm, dialog } = await openIt();
    now += SETTLE_MS - 1;
    fireEvent.click(within(dialog).getByRole("button", { name: S.readAgain }));
    expect(onConfirm).not.toHaveBeenCalled();
    now += 2;
    fireEvent.click(within(dialog).getByRole("button", { name: S.readAgain }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
