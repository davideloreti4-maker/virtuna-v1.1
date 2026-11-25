/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { NicheRow, type NicheRowProps } from "../niche-row";
import { nicheOptions } from "../you-words";

function props(over: Partial<NicheRowProps> = {}): NicheRowProps {
  return {
    value: null, saved: { primary: null, sub: null }, open: false, query: "", busy: false, failed: false,
    onOpen: vi.fn(), onQuery: vi.fn(), onPick: vi.fn(), onCancel: vi.fn(), ...over,
  };
}
const list = () => screen.getByRole("list", { name: "Niches" });

afterEach(cleanup);

describe("NicheRow", () => {
  it("closed: the saved niche in the list's words, or Add", () => {
    const { rerender } = render(<NicheRow {...props({ value: "Food & Cooking · Meal Prep" })} />);
    expect(screen.getByRole("button", { name: "Niche Food & Cooking · Meal Prep" })).toBeInTheDocument();
    rerender(<NicheRow {...props()} />);
    expect(screen.getByRole("button", { name: "Niche Add" })).toBeInTheDocument();
  });

  it("open: a search field, focused, over every niche of the list; each option named in full", () => {
    render(<NicheRow {...props({ open: true })} />);
    expect(screen.getByRole("textbox", { name: "Search niches" })).toHaveFocus();
    const options = within(list()).getAllByRole("button");
    expect(options).toHaveLength(nicheOptions("").length);
    expect(within(list()).getByRole("button", { name: "Food & Cooking · Meal Prep" })).toHaveTextContent(/^Meal Prep$/);
  });

  it("the saved niche is marked as chosen", () => {
    render(<NicheRow {...props({ open: true, saved: { primary: "food-cooking", sub: "meal-prep" } })} />);
    expect(within(list()).getByRole("button", { name: "Food & Cooking · Meal Prep" })).toHaveAttribute("aria-pressed", "true");
    expect(within(list()).getByRole("button", { name: "Food & Cooking" })).toHaveAttribute("aria-pressed", "false");
  });

  it("typing searches; a search shows only what matches, in full", () => {
    const p = props({ open: true, query: "meal" });
    render(<NicheRow {...p} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search niches" }), { target: { value: "meal p" } });
    expect(p.onQuery).toHaveBeenLastCalledWith("meal p");
    expect(within(list()).getAllByRole("button").map((b) => b.textContent)).toEqual(["Food & Cooking · Meal Prep"]);
  });

  it("a search that matches nothing says so", () => {
    render(<NicheRow {...props({ open: true, query: "zzz" })} />);
    expect(screen.getByText("No niche matches.")).toBeInTheDocument();
  });

  it("a tap picks; while saving it does not", () => {
    const p = props({ open: true });
    const { rerender } = render(<NicheRow {...p} />);
    fireEvent.click(within(list()).getByRole("button", { name: "Food & Cooking · Meal Prep" }));
    expect(p.onPick).toHaveBeenCalledWith("food-cooking", "meal-prep");
    fireEvent.click(within(list()).getByRole("button", { name: "Food & Cooking" }));
    expect(p.onPick).toHaveBeenLastCalledWith("food-cooking", null);
    rerender(<NicheRow {...p} busy />);
    fireEvent.click(within(list()).getByRole("button", { name: "Beauty" }));
    expect(p.onPick).toHaveBeenCalledTimes(2);
  });

  it("Escape and Cancel cancel; a failed save says so", () => {
    const p = props({ open: true, failed: true });
    render(<NicheRow {...p} />);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Search niches" }), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(p.onCancel).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save. Try again.");
  });

  it("while saving nothing cancels", () => {
    const p = props({ open: true, busy: true });
    render(<NicheRow {...p} />);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Search niches" }), { key: "Escape" });
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveAttribute("aria-disabled", "true");
    expect(cancel).not.toBeDisabled();
    fireEvent.click(cancel);
    expect(p.onCancel).not.toHaveBeenCalled();
  });

  it("has no axe violations", async () => {
    const { container } = render(<NicheRow {...props({ open: true, query: "food" })} />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});
