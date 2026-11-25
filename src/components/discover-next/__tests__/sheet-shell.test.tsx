/** @vitest-environment happy-dom */

/**
 * SheetShell: the shell of Discover's one-field sheets (Remix here; Follow and a pulled video later),
 * rendered for real with Radix underneath. Stand-in: `matchMedia` (the phone's bottom sheet or the
 * desk's centred dialog).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { SheetShell } from "../sheet-shell";

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

/** The page around the sheet: a plain button opens it (not a Radix trigger), as the main button does. */
function Page({ busy = false, openerLeaves = false, startOpen = false, withField = false }: { busy?: boolean; openerLeaves?: boolean; startOpen?: boolean; withField?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [opener, setOpener] = useState(true);
  const fallback = useRef<HTMLHeadingElement>(null);
  const field = useRef<HTMLInputElement>(null);
  return (
    <>
      {opener && (
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.focus();
            setOpen(true);
          }}
        >
          Open
        </button>
      )}
      <h2 ref={fallback} tabIndex={-1}>
        Fallback
      </h2>
      <SheetShell
        open={open}
        onOpenChange={setOpen}
        title="What do you want to make from this?"
        busy={busy}
        returnFocus={() => fallback.current}
        initialFocus={withField ? () => field.current : undefined}
      >
        <button type="button">First</button>
        {withField && <input ref={field} aria-label="The field" />}
        <button
          type="button"
          onClick={() => {
            if (openerLeaves) setOpener(false);
            setOpen(false);
          }}
        >
          Done
        </button>
      </SheetShell>
    </>
  );
}

const open = () => fireEvent.click(screen.getByRole("button", { name: "Open" }));

describe("SheetShell", () => {
  it("on a phone: a bottom sheet named by its title, with a hidden Close", async () => {
    render(<Page />);
    open();
    const dialog = await screen.findByRole("dialog", { name: "What do you want to make from this?" });
    expect(dialog).toHaveAttribute("data-sheet-shell", "sheet");
    expect(screen.getByRole("heading", { name: "What do you want to make from this?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("from 768: a centred dialog, from its first commit", () => {
    widthIs("desk");
    render(<Page startOpen />);
    expect(screen.getByRole("dialog", { name: "What do you want to make from this?" })).toHaveAttribute("data-sheet-shell", "dialog");
  });

  it("the focus goes to the first control, or to the one it is told, and back to the opener on close", async () => {
    render(<Page />);
    open();
    await waitFor(() => expect(screen.getByRole("button", { name: "First" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Open" })).toHaveFocus();

    cleanup();
    render(<Page withField />);
    open();
    await waitFor(() => expect(screen.getByRole("textbox", { name: "The field" })).toHaveFocus());
  });

  it("when the opener has left the page, the focus goes to the fallback", async () => {
    render(<Page openerLeaves />);
    open();
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("heading", { name: "Fallback" })).toHaveFocus();
  });

  it("Escape closes it", async () => {
    render(<Page />);
    open();
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("busy: Escape does not close it (an answer must have a sheet to land in)", async () => {
    render(<Page busy />);
    open();
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("busy on a desk too", async () => {
    widthIs("desk");
    render(<Page busy startOpen />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
