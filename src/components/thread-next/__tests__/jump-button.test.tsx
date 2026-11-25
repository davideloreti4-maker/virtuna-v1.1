/** @vitest-environment happy-dom */
/**
 * "Go to the latest" (thread feel, spec 2026-11-25 §4.1): the round button above the field that
 * shows while more than 150 of the last answer is under it. Not shown means not there at all, so
 * a keyboard never lands on a button nobody can see.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { JumpButton } from "../jump-button";

afterEach(cleanup);

describe("JumpButton", () => {
  it("renders nothing when not shown: no button, no focus stop", () => {
    const { container } = render(<JumpButton shown={false} onClick={() => {}} />);
    expect(container.innerHTML).toBe("");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it('is a button named "Go to the latest", and a tap calls onClick once', () => {
    const onClick = vi.fn();
    render(<JumpButton shown onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Go to the latest" });
    expect(button).toHaveAttribute("type", "button");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is the round 34px float with the ink's down arrow (17px), drawn in tokens", () => {
    render(<JumpButton shown onClick={() => {}} />);
    const button = screen.getByRole("button", { name: "Go to the latest" });
    const classes = button.className.split(/\s+/);
    expect(classes).toEqual(
      expect.arrayContaining(["size-[34px]", "rounded-full", "bg-surface", "text-foreground", "shadow-[var(--shadow-float)]"]),
    );
    const arrow = button.querySelector("svg")!;
    expect(arrow).toHaveAttribute("aria-hidden", "true");
    expect(arrow).toHaveAttribute("width", "17");
    expect(arrow).toHaveAttribute("stroke", "currentColor");
  });
});
