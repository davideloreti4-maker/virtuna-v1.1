/** @vitest-environment happy-dom */
/**
 * LaneReveal — "Three ways you could show up" (spec §4.3, mock §9 right frame).
 * Locks: the grouped anatomy, the REAL numbers (view count + outlier receipt), the
 * whole-card pick, and the two things that must never render — donor niche and donor
 * handle. Plus the 2026-08-12 ruling: NO simulated score anywhere on a day-0 card.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LaneReveal } from "../lane-reveal";
import type { LaneShelf } from "@/lib/surfaces/lane-drops";

function shelf(name: string, hook: string, id: string, over: { multiplier?: number } = {}) {
  return {
    lane: { name, who: "receipts, not vibes", niche: "donor-niche-must-never-render" },
    cards: [
      {
        contentId: id,
        hook,
        coverUrl: "https://x/cover.jpg",
        videoUrl: "https://t/v",
        views: "8.1M",
        viewsRaw: 8_100_000,
        handle: "donorhandle",
        archetype: "arch",
        hookTemplate: "tpl",
        multiplier: 3.4,
        baselineLabel: "vs their usual views",
        concepts: [],
        ...over,
      },
    ],
  } as LaneShelf;
}

const SHELVES = [
  shelf("The numbers person", "Why is your grocery bill 40% feelings?", "c1"),
  shelf("The skeptic", "Your budgeting app wants you to fail.", "c2"),
];

describe("LaneReveal", () => {
  it("heads the reveal and names every lane", () => {
    render(<LaneReveal shelves={SHELVES} onPick={() => {}} />);
    expect(screen.getByText(/ways you could show up/i)).toBeTruthy();
    expect(screen.getByText("The numbers person")).toBeTruthy();
    expect(screen.getByText("The skeptic")).toBeTruthy();
  });

  it("prints the real view count and the real outlier receipt", () => {
    render(<LaneReveal shelves={SHELVES} onPick={() => {}} />);
    expect(screen.getAllByText("8.1M").length).toBe(2);
    const receipt = screen.getByTestId("lane-mult-c1");
    expect(receipt.textContent).toMatch(/3\.4×\s*their usual views/);
  });

  it("prints no receipt at all when the row carries no multiplier — never a fabricated one", () => {
    render(
      <LaneReveal shelves={[shelf("The numbers person", "h", "c9", { multiplier: undefined })]} onPick={() => {}} />,
    );
    expect(screen.queryByTestId("lane-mult-c9")).toBeNull();
  });

  it("shows NO simulated score — the day-0 pre-score meter is dead (2026-08-12 ruling)", () => {
    const { container } = render(<LaneReveal shelves={SHELVES} onPick={() => {}} />);
    // The meter printed "N/10" in the foot and "N of 10 stopped" in the aria-label.
    expect(container.textContent).not.toMatch(/\/10/);
    expect(container.innerHTML).not.toMatch(/of 10 stopped/);
  });

  it("picks the lane when its card is tapped", () => {
    const onPick = vi.fn();
    render(<LaneReveal shelves={SHELVES} onPick={onPick} />);
    fireEvent.click(screen.getByTestId("lane-card-c2"));
    expect(onPick).toHaveBeenCalledWith(SHELVES[1]);
  });

  it("never renders the donor niche or the donor handle", () => {
    const { container } = render(<LaneReveal shelves={SHELVES} onPick={() => {}} />);
    expect(container.textContent).not.toContain("donor-niche-must-never-render");
    expect(container.textContent).not.toContain("donorhandle");
  });

  it("renders nothing when there are no shelves — no fabricated lane", () => {
    const { container } = render(<LaneReveal shelves={[]} onPick={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
