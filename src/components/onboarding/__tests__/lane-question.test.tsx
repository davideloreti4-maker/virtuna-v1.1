/** @vitest-environment happy-dom */
/**
 * LaneQuestion — the one conversational question on the day-0 describe path (spec §4.1).
 * Locks: the question itself, the no-empty-submit guard, the trim, and the in-flight
 * lock (fire-on-demand — one run at a time, the busy guard IS the debounce).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LaneQuestion } from "../lane-question";

describe("LaneQuestion", () => {
  it("asks the one question", () => {
    render(<LaneQuestion onSubmit={() => {}} submitting={false} />);
    expect(
      screen.getByText(/what could you talk about for 20 minutes without notes/i),
    ).toBeTruthy();
  });

  it("cannot submit an empty answer", () => {
    const onSubmit = vi.fn();
    render(<LaneQuestion onSubmit={onSubmit} submitting={false} />);
    fireEvent.click(screen.getByRole("button", { name: /find my lanes/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the trimmed answer", () => {
    const onSubmit = vi.fn();
    render(<LaneQuestion onSubmit={onSubmit} submitting={false} />);
    fireEvent.change(screen.getByLabelText(/20 minutes/i), {
      target: { value: "  budgeting on a tight income  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /find my lanes/i }));
    expect(onSubmit).toHaveBeenCalledWith("budgeting on a tight income");
  });

  it("disables the action while a run is in flight (one run at a time)", () => {
    render(<LaneQuestion onSubmit={() => {}} submitting />);
    expect(screen.getByRole("button", { name: /finding/i }).hasAttribute("disabled")).toBe(true);
  });

  it("shows an error when one is given", () => {
    render(<LaneQuestion onSubmit={() => {}} submitting={false} error="Couldn't read that." />);
    expect(screen.getByText("Couldn't read that.")).toBeTruthy();
  });
});
