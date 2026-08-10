/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DropShelf } from "../drop-shelf";
import type { LiveDropCard } from "@/lib/surfaces/live-cards";

function card(over: Partial<LiveDropCard> = {}): LiveDropCard {
  return {
    contentId: "t1",
    hook: "An adapted hook line",
    coverUrl: "https://x.supabase.co/storage/v1/object/public/covers/c.jpg",
    videoUrl: "https://tiktok.example/v/1",
    views: "8.1M",
    viewsRaw: 8_100_000,
    handle: "conor_harris_",
    archetype: "trap-mistake",
    hookTemplate: "madlib [x]",
    multiplier: 17.2,
    baselineLabel: "vs their usual views",
    concepts: [],
    ...over,
  };
}

describe("DropShelf", () => {
  it("renders six skeletons while warming", () => {
    render(<DropShelf cards={[]} status="warming" onRemix={() => {}} />);
    expect(screen.getAllByTestId("drop-skeleton")).toHaveLength(6);
  });

  it("renders nothing at all when ready and empty (honest empty — greeting-only arrival)", () => {
    const { container } = render(<DropShelf cards={[]} status="ready" onRemix={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders hook, views, and the outlier receipt — never a sim score", () => {
    render(<DropShelf cards={[card()]} status="ready" onRemix={() => {}} />);
    expect(screen.getByText("An adapted hook line")).toBeInTheDocument();
    expect(screen.getByText("8.1M")).toBeInTheDocument();
    // The receipt (owner ruling 2026-08-10): "17× their usual views", ≥10 rounds.
    expect(screen.getByTestId("drop-mult-t1")).toHaveTextContent("17×");
    expect(screen.getByTestId("drop-mult-t1")).toHaveTextContent("their usual views");
    // The old /10 pre-score is dead — drops arrive unscored.
    expect(screen.queryByText(/\/10/)).toBeNull();
  });

  it("formats a sub-10 multiplier with one decimal", () => {
    render(<DropShelf cards={[card({ multiplier: 3.4 })]} status="ready" onRemix={() => {}} />);
    expect(screen.getByTestId("drop-mult-t1")).toHaveTextContent("3.4×");
  });

  it("omits the receipt on a pre-field cached card (never fabricates)", () => {
    render(
      <DropShelf
        cards={[card({ multiplier: undefined, baselineLabel: undefined })]}
        status="ready"
        onRemix={() => {}}
      />,
    );
    expect(screen.queryByTestId("drop-mult-t1")).toBeNull();
  });

  it("Remix fires onRemix with the card; the thumb links to the original", () => {
    const onRemix = vi.fn();
    render(<DropShelf cards={[card()]} status="ready" onRemix={onRemix} />);
    fireEvent.click(screen.getByRole("button", { name: /remix/i }));
    expect(onRemix).toHaveBeenCalledTimes(1);
    expect(onRemix.mock.calls[0]![0].contentId).toBe("t1");
    const link = screen.getByRole("link", { name: /watch the original/i });
    expect(link).toHaveAttribute("href", "https://tiktok.example/v/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("renders a plain (non-link) thumb when the card has no videoUrl", () => {
    render(<DropShelf cards={[card({ videoUrl: null })]} status="ready" onRemix={() => {}} />);
    expect(screen.queryByRole("link", { name: /watch the original/i })).toBeNull();
  });

  it("never renders accent or the donor handle", () => {
    const { container } = render(<DropShelf cards={[card()]} status="ready" onRemix={() => {}} />);
    expect(container.innerHTML).not.toMatch(/accent|ff6363/i);
    expect(container.textContent).not.toContain("conor_harris_");
  });

  it("disables the Remix button for the in-flight card only", () => {
    render(
      <DropShelf
        cards={[card(), card({ contentId: "t2", hook: "Second hook" })]}
        status="ready"
        onRemix={() => {}}
        remixingId="t1"
      />,
    );
    const buttons = screen.getAllByRole("button", { name: /remix/i });
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).not.toBeDisabled();
  });
});
