/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DropShelf } from "../drop-shelf";
import type { LiveDropCard } from "@/lib/surfaces/live-cards";
import type { ReactionPersona } from "@/lib/tools/blocks";

function personas(stops: number, total = 10): ReactionPersona[] {
  return Array.from({ length: total }, (_, i) => ({
    archetype: `a${i}`,
    verdict: i < stops ? ("stop" as const) : ("scroll" as const),
    quote: "",
  }));
}

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
    concepts: [],
    personas: personas(8),
    ...over,
  };
}

describe("DropShelf", () => {
  it("renders six skeletons while warming", () => {
    render(<DropShelf cards={[]} status="warming" onRemix={() => {}} onOpenReport={() => {}} />);
    expect(screen.getAllByTestId("drop-skeleton")).toHaveLength(6);
  });

  it("renders nothing at all when ready and empty (honest empty — greeting-only arrival)", () => {
    const { container } = render(<DropShelf cards={[]} status="ready" onRemix={() => {}} onOpenReport={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders hook, views, and the meter derived from real personas", () => {
    render(<DropShelf cards={[card()]} status="ready" onRemix={() => {}} onOpenReport={() => {}} />);
    expect(screen.getByText("An adapted hook line")).toBeInTheDocument();
    expect(screen.getByText("8.1M")).toBeInTheDocument();
    expect(screen.getByTestId("drop-meter-t1")).toHaveTextContent("8/10");
  });

  it("Remix fires onRemix with the card; the thumb links to the original", () => {
    const onRemix = vi.fn();
    render(<DropShelf cards={[card()]} status="ready" onRemix={onRemix} onOpenReport={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /remix/i }));
    expect(onRemix).toHaveBeenCalledTimes(1);
    expect(onRemix.mock.calls[0]![0].contentId).toBe("t1");
    const link = screen.getByRole("link", { name: /watch the original/i });
    expect(link).toHaveAttribute("href", "https://tiktok.example/v/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("renders a plain (non-link) thumb when the card has no videoUrl", () => {
    render(<DropShelf cards={[card({ videoUrl: null })]} status="ready" onRemix={() => {}} onOpenReport={() => {}} />);
    expect(screen.queryByRole("link", { name: /watch the original/i })).toBeNull();
  });

  it("never renders accent, donor handle, or a multiplier", () => {
    const { container } = render(
      <DropShelf cards={[card()]} status="ready" onRemix={() => {}} onOpenReport={() => {}} />,
    );
    expect(container.innerHTML).not.toMatch(/accent|ff6363/i);
    expect(container.textContent).not.toContain("conor_harris_");
    expect(container.textContent).not.toMatch(/\d+(\.\d+)?x\b/i);
  });

  it("disables the Remix button for the in-flight card only", () => {
    render(
      <DropShelf
        cards={[card(), card({ contentId: "t2", hook: "Second hook" })]}
        status="ready"
        onRemix={() => {}} onOpenReport={() => {}}
        remixingId="t1"
      />,
    );
    const buttons = screen.getAllByRole("button", { name: /remix/i });
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).not.toBeDisabled();
  });

  it("the meter is the report's door — it hands over the card's CACHED personas", () => {
    const onOpenReport = vi.fn();
    render(
      <DropShelf cards={[card()]} status="ready" onRemix={() => {}} onOpenReport={onOpenReport} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /8 of 10 stopped/i }));
    expect(onOpenReport).toHaveBeenCalledTimes(1);
    expect(onOpenReport.mock.calls[0]![0].personas).toHaveLength(10);
  });

  it("opening the report never fires a network call (drops read the cache, never re-sim)", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<DropShelf cards={[card()]} status="ready" onRemix={() => {}} onOpenReport={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /8 of 10 stopped/i }));
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
