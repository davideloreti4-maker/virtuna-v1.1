/** @vitest-environment happy-dom */

/**
 * FilterPanel on its own: the body and its count are worked out only while the panel is open (the
 * count runs a search over the whole library, and the hub renders on every key), and a choice that
 * matches nothing cannot be applied. The real panel, on a phone (the sheet); `countOf` and `onApply`
 * are the hub's callbacks, recorded.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { FilterPanel, type FilterChoice } from "../filter-panel";

const NICHES = [
  { key: "food", label: "Food", count: 2 },
  { key: "tech", label: "Tech", count: 1 },
];
const APPLIED: FilterChoice = { niche: null, platform: null, order: "views" };

function renderPanel(open: boolean, countOf: (choice: FilterChoice) => number, onApply = vi.fn()) {
  const props = {
    onOpenChange: vi.fn(),
    anchor: <button type="button">Filter</button>,
    niches: NICHES,
    applied: APPLIED,
    countOf,
    onApply,
    returnFocus: () => null,
  };
  const view = render(<FilterPanel open={open} {...props} />);
  return { ...view, props, reopen: (next: boolean) => view.rerender(<FilterPanel open={next} {...props} />) };
}

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

describe("FilterPanel — the count only while open", () => {
  it("closed: nothing is counted; open: the choice is counted; closed again: nothing more", async () => {
    const countOf = vi.fn(() => 3);
    const { reopen } = renderPanel(false, countOf);
    expect(countOf).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();

    reopen(true);
    const sheet = await screen.findByRole("dialog", { name: "Filter" });
    expect(within(sheet).getByRole("button", { name: "Show 3 videos" })).toBeInTheDocument();
    expect(countOf).toHaveBeenCalledWith(APPLIED);

    reopen(false);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    countOf.mockClear();
    reopen(false);
    expect(countOf).not.toHaveBeenCalled();
  });
});

describe("FilterPanel — a choice that matches nothing", () => {
  it("Show 0 videos waits (aria-disabled), and a press applies nothing and keeps the panel open", async () => {
    const onApply = vi.fn();
    const countOf = (choice: FilterChoice) => (choice.niche === "tech" ? 0 : 3);
    const { props } = renderPanel(true, countOf, onApply);
    const sheet = await screen.findByRole("dialog", { name: "Filter" });
    expect(within(sheet).getByRole("button", { name: "Show 3 videos" })).not.toHaveAttribute("aria-disabled");

    fireEvent.click(within(within(sheet).getByRole("group", { name: "Niche" })).getByRole("button", { name: "Tech" }));
    const show = within(sheet).getByRole("button", { name: "Show 0 videos" });
    expect(show).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(show);
    expect(onApply).not.toHaveBeenCalled();
    expect(props.onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Filter" })).toBeInTheDocument();

    // Back to a choice with videos: it applies.
    fireEvent.click(within(within(sheet).getByRole("group", { name: "Niche" })).getByRole("button", { name: "Food" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Show 3 videos" }));
    expect(onApply).toHaveBeenCalledWith({ niche: "food", platform: null, order: "views" });
  });
});
