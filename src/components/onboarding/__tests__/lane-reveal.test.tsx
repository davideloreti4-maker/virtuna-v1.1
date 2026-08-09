/** @vitest-environment happy-dom */
/**
 * LaneReveal — "Three ways you could show up" (spec §4.3, mock §9 right frame).
 * Locks: the grouped anatomy, the REAL numbers (view count + meter), the whole-card
 * pick, and the two things that must never render — donor niche and donor handle.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LaneReveal } from "../lane-reveal";
import type { LaneShelf } from "@/lib/surfaces/lane-drops";
import type { ReactionPersona } from "@/lib/tools/blocks";

const PERSONAS: ReactionPersona[] = Array.from({ length: 10 }, (_, i) => ({
  archetype: `a${i}`,
  verdict: i < 8 ? "stop" : "scroll",
  quote: "",
})) as ReactionPersona[];

function shelf(name: string, hook: string, id: string): LaneShelf {
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
        concepts: [],
        personas: PERSONAS,
      },
    ],
  };
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

  it("prints the real view count and the real meter", () => {
    render(<LaneReveal shelves={SHELVES} onPick={() => {}} />);
    expect(screen.getAllByText("8.1M").length).toBe(2);
    expect(screen.getByTestId("lane-card-c1").getAttribute("aria-label")).toContain("8 of 10");
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
