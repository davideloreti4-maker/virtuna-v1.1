/** @vitest-environment happy-dom */

/**
 * RemixSheet: "What do you want to make from this?", one optional field of three lines, and Remix.
 * Rendered for real on SheetShell. Stand-in: `matchMedia` (a phone).
 *
 * The brief is sent trimmed, and a blank one as null, never "": the remix route reads an empty brief
 * as a target that replaces the creator's niche with nothing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { REMIX_BRIEF_MAX } from "@/lib/discover-next/remix";

import { RemixSheet } from "../remix-sheet";

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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const onRemix = vi.fn();

function Page() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.currentTarget.focus();
          setOpen(true);
        }}
      >
        Remix this · 10 credits
      </button>
      <RemixSheet open={open} onOpenChange={setOpen} onRemix={onRemix} />
    </>
  );
}

const TITLE = "What do you want to make from this?";

async function openSheet() {
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "Remix this · 10 credits" }));
  return screen.findByRole("dialog", { name: TITLE });
}
const field = () => screen.getByRole("textbox", { name: TITLE });
const remixButton = () => screen.getByRole("button", { name: "Remix" });

beforeEach(() => onRemix.mockReset());

describe("RemixSheet", () => {
  it("asks what to make, in a field of three lines named by the question, at most as long as the route takes", async () => {
    await openSheet();
    expect(field().tagName).toBe("TEXTAREA");
    expect(field()).toHaveAttribute("rows", "3");
    expect(field()).toHaveAttribute("maxLength", String(REMIX_BRIEF_MAX));
    expect(field()).toHaveValue("");
    await waitFor(() => expect(field()).toHaveFocus());
  });

  it("Remix sends the brief trimmed and closes the sheet; the focus returns to the main button", async () => {
    await openSheet();
    fireEvent.change(field(), { target: { value: "  the same idea, for gym students  " } });
    fireEvent.click(remixButton());
    expect(onRemix).toHaveBeenCalledTimes(1);
    expect(onRemix).toHaveBeenCalledWith("the same idea, for gym students");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Remix this · 10 credits" })).toHaveFocus();
  });

  it("a blank brief is sent as null, never as an empty string", async () => {
    await openSheet();
    fireEvent.change(field(), { target: { value: "   \n  " } });
    fireEvent.click(remixButton());
    expect(onRemix).toHaveBeenCalledWith(null);

    onRemix.mockReset();
    fireEvent.click(screen.getByRole("button", { name: "Remix this · 10 credits" }));
    await screen.findByRole("dialog", { name: TITLE });
    fireEvent.click(remixButton());
    expect(onRemix).toHaveBeenCalledWith(null);
  });

  it("each opening starts empty", async () => {
    await openSheet();
    fireEvent.change(field(), { target: { value: "for dog owners" } });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onRemix).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remix this · 10 credits" }));
    await screen.findByRole("dialog", { name: TITLE });
    expect(field()).toHaveValue("");
  });

  it("a double tap on Remix sends one remix, even while the sheet is still there for the second press", async () => {
    // The sheet is held open (its close ignored), so the second press reaches the same form: only the
    // form's own guard can stop it.
    const closes = vi.fn();
    render(<RemixSheet open onOpenChange={closes} onRemix={onRemix} />);
    await screen.findByRole("dialog", { name: TITLE });
    const button = remixButton();
    fireEvent.click(button);
    expect(button).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: TITLE })).toBeInTheDocument();
    fireEvent.click(button);
    expect(onRemix).toHaveBeenCalledTimes(1);
    expect(closes).toHaveBeenCalledWith(false);
  });
});
