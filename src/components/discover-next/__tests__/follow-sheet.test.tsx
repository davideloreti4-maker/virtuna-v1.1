/** @vitest-environment happy-dom */
/**
 * FollowSheet: "Follow a creator" (spec 3.5): one field and Follow, on Discover's sheet shell (a bottom
 * sheet on a phone, a centred dialog from 768). Presentational: the container follows and hands back
 * what is happening (`status`). Stand-ins: `matchMedia` (phone or desk). Made-up handles only.
 */
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { FollowSheet, type FollowStatus } from "../follow-sheet";

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

/** The sheet as the container holds it: open state here, the status from the test. */
function Harness({ status, onFollow, onOpenChange }: { status: FollowStatus; onFollow(handle: string): void; onOpenChange?(open: boolean): void }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <FollowSheet
        open={open}
        onOpenChange={(next) => {
          onOpenChange?.(next);
          setOpen(next);
        }}
        status={status}
        onFollow={onFollow}
      />
    </>
  );
}

function renderSheet(status: FollowStatus = null) {
  const onFollow = vi.fn();
  const onOpenChange = vi.fn();
  const view = render(<Harness status={status} onFollow={onFollow} onOpenChange={onOpenChange} />);
  const rerender = (next: FollowStatus) => view.rerender(<Harness status={next} onFollow={onFollow} onOpenChange={onOpenChange} />);
  return { ...view, onFollow, onOpenChange, rerender };
}

const field = () => screen.getByRole("textbox", { name: "TikTok @handle" });
const follow = () => screen.getByRole("button", { name: "Follow" });
const typeIn = (text: string) => fireEvent.change(field(), { target: { value: text } });
const submit = () => fireEvent.click(follow());

describe.each(["phone", "desk"] as const)("FollowSheet (%s)", (view) => {
  beforeEach(() => widthIs(view));

  it("is named Follow a creator: one field, focused, and Follow; no price anywhere", () => {
    renderSheet();
    expect(screen.getByRole("dialog", { name: "Follow a creator" })).toBeInTheDocument();
    expect(field()).toHaveAttribute("placeholder", "@handle or link");
    expect(field()).toHaveFocus();
    expect(field()).toHaveValue("");
    expect(follow()).toHaveAttribute("type", "submit");
    expect(screen.getByRole("dialog").textContent).not.toMatch(/credit/i);
  });

  it("a handle it cannot read: the sentence under the field, the field marked, nothing sent", () => {
    const { onFollow } = renderSheet();
    typeIn("meal prep");
    submit();
    expect(onFollow).not.toHaveBeenCalled();
    expect(screen.getByText("Paste a TikTok @handle or link.")).toBeInTheDocument();
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(field()).toHaveAccessibleDescription("Paste a TikTok @handle or link.");
    expect(field()).toHaveFocus();
  });

  it("an empty field is refused the same way", () => {
    const { onFollow } = renderSheet();
    submit();
    expect(onFollow).not.toHaveBeenCalled();
    expect(screen.getByText("Paste a TikTok @handle or link.")).toBeInTheDocument();
  });

  it("typing again takes the sentence away", () => {
    renderSheet();
    typeIn("x");
    submit();
    typeIn("@jay");
    expect(screen.queryByText("Paste a TikTok @handle or link.")).toBeNull();
    expect(field()).not.toHaveAttribute("aria-invalid");
  });

  it("a @handle or a TikTok link: Follow hands on the handle, once", () => {
    const { onFollow } = renderSheet();
    typeIn("  https://www.tiktok.com/@Jay.Makes ");
    submit();
    expect(onFollow).toHaveBeenCalledTimes(1);
    expect(onFollow).toHaveBeenCalledWith("jay.makes");
  });

  it("Enter in the field follows (the form's submit)", () => {
    const { onFollow } = renderSheet();
    typeIn("@nia.cooks");
    fireEvent.submit(field().closest("form")!);
    expect(onFollow).toHaveBeenCalledWith("nia.cooks");
  });

  it("while Maven reads the account: Reading @handle, the field read-only, Follow waiting; a second submit sends nothing", () => {
    const { onFollow, rerender } = renderSheet();
    typeIn("@jay.makes");
    submit();
    rerender({ kind: "reading", handle: "jay.makes" });
    expect(screen.getByRole("status")).toHaveTextContent("Reading @jay.makes");
    expect(field()).toHaveAttribute("readonly");
    expect(follow()).toHaveAttribute("aria-disabled", "true");
    expect(follow()).toHaveAttribute("aria-busy", "true");
    submit();
    fireEvent.submit(field().closest("form")!);
    expect(onFollow).toHaveBeenCalledTimes(1);
  });

  it("while Maven reads, the sheet holds: Escape does not close it", () => {
    const { onOpenChange } = renderSheet({ kind: "reading", handle: "jay.makes" });
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("a failure is said in the sheet, and the field can be sent again", () => {
    const { onFollow, rerender } = renderSheet();
    typeIn("@jay.makes");
    submit();
    rerender({ kind: "reading", handle: "jay.makes" });
    rerender({ kind: "failed", handle: "jay.makes" });
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't follow @jay.makes. Check the handle and try again.");
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(field()).not.toHaveAttribute("readonly");
    expect(screen.getByRole("status")).toHaveTextContent("");
    submit();
    expect(onFollow).toHaveBeenCalledTimes(2);
  });

  it("a follow refused after the account was read asks to try again, without blaming the handle", () => {
    const { rerender } = renderSheet();
    typeIn("@jay.makes");
    submit();
    rerender({ kind: "failed", handle: "jay.makes", step: "follow" });
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't follow @jay.makes. Try again.");
    expect(screen.queryByText(/Check the handle/)).toBeNull();
    expect(field()).toHaveAccessibleDescription("Couldn't follow @jay.makes. Try again.");
  });

  it("each opening starts empty", () => {
    renderSheet();
    typeIn("@jay.makes");
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(field()).toHaveValue("");
  });
});
