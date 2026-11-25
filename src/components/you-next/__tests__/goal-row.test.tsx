/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { GoalRow, type GoalRowProps } from "../goal-row";

function props(over: Partial<GoalRowProps> = {}): GoalRowProps {
  return { goal: null, open: false, busy: false, failed: false, onOpen: vi.fn(), onPick: vi.fn(), onCancel: vi.fn(), ...over };
}
const group = () => screen.getByRole("group", { name: "Goal" });

afterEach(cleanup);

describe("GoalRow", () => {
  it("closed: the chip's word for the saved goal, or Add", () => {
    const { rerender } = render(<GoalRow {...props({ goal: "conversion" })} />);
    expect(screen.getByRole("button", { name: "Goal Sell" })).toBeInTheDocument();
    rerender(<GoalRow {...props()} />);
    expect(screen.getByRole("button", { name: "Goal Add" })).toBeInTheDocument();
  });

  it("open: four chips in the spec's order, the saved one pressed and focused", () => {
    render(<GoalRow {...props({ open: true, goal: "engagement" })} />);
    const chips = within(group()).getAllByRole("button");
    expect(chips.map((c) => c.textContent)).toEqual(["Grow", "Engage", "Brand deals", "Sell"]);
    expect(chips[1]).toHaveAttribute("aria-pressed", "true");
    expect(chips[1]).toHaveFocus();
  });

  it("with no goal the first chip takes the focus", () => {
    render(<GoalRow {...props({ open: true })} />);
    expect(within(group()).getByRole("button", { name: "Grow" })).toHaveFocus();
  });

  it("a tap on another chip picks it; on the saved one it only closes; while saving nothing", () => {
    const p = props({ open: true, goal: "growth" });
    const { rerender } = render(<GoalRow {...p} />);
    fireEvent.click(within(group()).getByRole("button", { name: "Sell" }));
    expect(p.onPick).toHaveBeenCalledWith("conversion");
    fireEvent.click(within(group()).getByRole("button", { name: "Grow" }));
    expect(p.onCancel).toHaveBeenCalledTimes(1);
    rerender(<GoalRow {...p} busy />);
    fireEvent.click(within(group()).getByRole("button", { name: "Engage" }));
    expect(p.onPick).toHaveBeenCalledTimes(1);
  });

  it("Escape cancels; a failed save says so", () => {
    const p = props({ open: true, failed: true });
    render(<GoalRow {...p} />);
    fireEvent.keyDown(within(group()).getByRole("button", { name: "Grow" }), { key: "Escape" });
    expect(p.onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save. Try again.");
  });

  it("while saving neither Escape nor Cancel cancels", () => {
    const p = props({ open: true, goal: "growth", busy: true });
    render(<GoalRow {...p} />);
    fireEvent.keyDown(within(group()).getByRole("button", { name: "Grow" }), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(within(group()).getByRole("button", { name: "Grow" }));
    expect(p.onCancel).not.toHaveBeenCalled();
  });

  it("has no axe violations", async () => {
    const { container } = render(<GoalRow {...props({ open: true, goal: "brand_deals" })} />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});
