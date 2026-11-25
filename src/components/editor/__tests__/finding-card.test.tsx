/** @vitest-environment happy-dom */
/**
 * finding-card.test.tsx — the card of a thing to check (spec 2026-11-24-editor-screens-design.md E18, screen 8; plan
 * 2026-11-25-editor-screens-b, Task 9 and its fix round; ruling S2): its moment and its sentence; the fix, its main action, as
 * one ink button on a row of its own as wide as the card; under it "Show" where there is no fix and "Keep it" on the left, the
 * way to the next one with the count on the right; and a close button (S2: the drawing shows neither). The card is a group named
 * "Things to check", read politely as it changes, closed by Escape inside it. Widths are measured in a browser, not here.
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Finding } from "@/lib/edit/review";
import { FindingCard, type FindingCardProps } from "../finding-card";

const SOFT: Finding = { code: "soft-zoom", severity: "warn", where: { frame: 186, shot: "s1" }, says: "shot \"s1\" at 6.2 s is zoomed to 1.40" };
const ZOOM_LESS = { label: "Zoom less", request: "Zoom in less here, so the picture stays sharp." };
const props = (more: Partial<FindingCardProps> = {}): FindingCardProps => ({
  finding: SOFT, sentence: "This zoom makes the picture soft.", fix: ZOOM_LESS, index: 0, count: 3, disabled: false,
  onFix: vi.fn(), onKeep: vi.fn(), onShow: vi.fn(), onNext: vi.fn(), onClose: vi.fn(), ...more,
});
const card = () => screen.getByRole("group", { name: "Things to check" });
const row = () => card().querySelector<HTMLElement>("[data-part=actions]")!;
const fixRow = () => card().querySelector<HTMLElement>("[data-part=fix]");
const names = (scope: HTMLElement) => within(scope).getAllByRole("button").map((button) => button.textContent);

afterEach(cleanup);

describe("the card of a thing to check", () => {
  it("says the moment and the sentence, offers the fix and Keep it, and counts with a way to the next (3)", () => {
    const shown = props();
    render(<FindingCard {...shown} />);
    expect(card()).toHaveTextContent(/^0:06 · This zoom makes the picture soft\./);
    expect(within(card()).getByText("0:06 ·")).toHaveClass("text-foreground-muted", "tabular-nums");
    // The fix on a row of its own; under it Keep it on the left, the way to the next with the count on the right.
    expect(names(fixRow()!)).toEqual(["Zoom less"]);
    expect(names(row())).toEqual(["Keep it", "1 of 3"]);
    expect(fixRow()!.nextElementSibling).toBe(row());
    const next = within(card()).getByRole("button", { name: "Next, 2 of 3" });
    expect(next.textContent).toBe("1 of 3");
    expect(next.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(next).toHaveClass("ml-auto", "shrink-0", "text-meta", "text-foreground-muted", "tap-44");
    // The fix is the card's ink button, as wide as the card: a label too long for one line goes to two, never cut.
    const fix = within(card()).getByRole("button", { name: "Zoom less" });
    expect(fix).toHaveClass("bg-action", "w-full", "h-auto", "min-h-9", "whitespace-normal", "rounded-full", "tap-44");
    expect(fix.className).not.toMatch(/(^|\s)(truncate|whitespace-nowrap|overflow-hidden|text-ellipsis|line-clamp-\d)(\s|$)/);
    // Keep it, the quiet one: 36 tall, 44 to tap, at its own width.
    expect(within(card()).getByRole("button", { name: "Keep it" })).toHaveClass("next:bg-surface-sunken", "h-9", "shrink-0", "rounded-full", "tap-44");
    fireEvent.click(fix);
    expect(shown.onFix).toHaveBeenCalledWith(ZOOM_LESS);
    fireEvent.click(within(card()).getByRole("button", { name: "Keep it" }));
    expect(shown.onKeep).toHaveBeenCalledTimes(1);
    fireEvent.click(next);
    expect(shown.onNext).toHaveBeenCalledTimes(1);
    expect(shown.onShow).not.toHaveBeenCalled();
  });

  it("offers Show where there is no fix (3)", () => {
    const shown = props({ fix: null, sentence: "This part fades in and out at once." });
    render(<FindingCard {...shown} />);
    // No fix: only the second row, Show first.
    expect(fixRow()).toBeNull();
    expect(names(row())).toEqual(["Show", "Keep it", "1 of 3"]);
    fireEvent.click(within(card()).getByRole("button", { name: "Show" }));
    expect(shown.onShow).toHaveBeenCalledTimes(1);
  });

  it("counts one thing as plain text, and goes round to the first after the last (3)", () => {
    const { rerender } = render(<FindingCard {...props({ count: 1 })} />);
    expect(names(fixRow()!)).toEqual(["Zoom less"]);
    expect(names(row())).toEqual(["Keep it"]);
    expect(within(row()).getByText("1 of 1").tagName).toBe("SPAN");
    rerender(<FindingCard {...props({ index: 2 })} />);
    expect(within(card()).getByRole("button", { name: "Next, 1 of 3" }).textContent).toBe("3 of 3");
  });

  it("closes from its button at its top right, and on Escape with the focus inside it (S2)", () => {
    const shown = props();
    render(<FindingCard {...shown} />);
    const close = within(card()).getByRole("button", { name: "Close" });
    expect(close).toHaveClass("tap-44", "h-8", "w-8");
    fireEvent.click(close);
    expect(shown.onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(within(card()).getByRole("button", { name: "Keep it" }), { key: "Escape" });
    expect(shown.onClose).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(card(), { key: "Enter" });
    expect(shown.onClose).toHaveBeenCalledTimes(2);
  });

  it("rests its actions while a call is out, but not its close", () => {
    render(<FindingCard {...props({ disabled: true })} />);
    for (const name of ["Zoom less", "Keep it", "Next, 2 of 3"]) expect(within(card()).getByRole("button", { name })).toBeDisabled();
    expect(within(card()).getByRole("button", { name: "Close" })).toBeEnabled();
  });

  it("is drawn as the drawing's card, takes the focus when it opens, and is read politely as it changes", () => {
    const { rerender } = render(<FindingCard {...props()} />);
    expect(card()).toHaveClass("rounded-[20px]", "bg-surface", "shadow-[var(--shadow-rest)]", "px-3.5", "pt-[13px]", "pb-3");
    expect(card()).toHaveAttribute("aria-live", "polite");
    expect(document.activeElement).toBe(card());
    expect(card()).toHaveAccessibleDescription("0:06 · This zoom makes the picture soft.");
    // The next one shown in the same card: it is not opened again, so the focus stays where the creator put it.
    within(card()).getByRole("button", { name: "Next, 2 of 3" }).focus();
    rerender(<FindingCard {...props({ index: 1, finding: { ...SOFT, where: { frame: 45 } }, sentence: "The captions cover your face here." })} />);
    expect(document.activeElement).toBe(within(card()).getByRole("button", { name: "Next, 3 of 3" }));
    expect(card()).toHaveTextContent(/^0:01 · The captions cover your face here\./);
  });
});
