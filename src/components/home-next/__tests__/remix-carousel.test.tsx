/** @vitest-environment happy-dom */

/**
 * RemixCarousel — the old Home's drop shelf as a row above the field (owner 2026-11-26), rendered for
 * real. Its callback is what the composer passes (the Remix handoff), so it is a spy here.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";

import { RemixCarousel, multiplierWord, type RemixDrop } from "../remix-carousel";

afterEach(cleanup);

const DROPS: RemixDrop[] = [
  { contentId: "a", hook: "Stop meal prepping on Sundays", coverUrl: "https://cdn.test/a.jpg", videoUrl: "https://www.tiktok.com/@x/video/1", views: "880K", multiplier: 4.2 },
  { contentId: "b", hook: "The grocery list that fed me for a week", coverUrl: "", videoUrl: null, views: "1.1M" },
];

const carousel = () => document.querySelector<HTMLElement>('[data-part="remix-carousel"]');

describe("RemixCarousel", () => {
  it("draws each drop: its still (a link to the original when there is one), its views, its hook, its multiplier and Remix", () => {
    render(<RemixCarousel drops={DROPS} status="ready" onRemix={vi.fn()} />);
    const region = carousel()!;
    expect(within(region).getByRole("heading", { name: "Proven videos to remix" })).toBeInTheDocument();
    const items = within(region).getAllByRole("listitem");
    expect(items).toHaveLength(2);

    const first = within(items[0]!);
    const watch = first.getByRole("link", { name: "Watch the original: 880K views" });
    expect(watch).toHaveAttribute("href", "https://www.tiktok.com/@x/video/1");
    expect(watch).toHaveAttribute("target", "_blank");
    expect(watch).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(first.getByText("Stop meal prepping on Sundays")).toBeInTheDocument();
    expect(first.getByText("4.2×")).toBeInTheDocument();
    expect(first.getByRole("button", { name: "Remix: Stop meal prepping on Sundays" })).toHaveTextContent("Remix");

    // No link and no multiplier (a row cached before the field existed): a still, and the foot's space kept.
    const second = within(items[1]!);
    expect(second.queryByRole("link")).toBeNull();
    expect(second.getByText("1.1M")).toBeInTheDocument();
    expect(items[1]!.querySelector('[data-part="remix-multiplier"]')).toBeNull();
  });

  it("a row that scrolls sideways, one card at a time", () => {
    render(<RemixCarousel drops={DROPS} status="ready" onRemix={vi.fn()} />);
    const list = within(carousel()!).getByRole("list");
    expect(list).toHaveClass("flex", "overflow-x-auto", "snap-x", "snap-mandatory");
    for (const item of within(list).getAllByRole("listitem")) expect(item).toHaveClass("shrink-0", "snap-start");
  });

  it("Remix hands the drop to the caller", () => {
    const onRemix = vi.fn();
    render(<RemixCarousel drops={DROPS} status="ready" onRemix={onRemix} />);
    fireEvent.click(screen.getByRole("button", { name: "Remix: The grocery list that fed me for a week" }));
    expect(onRemix).toHaveBeenCalledTimes(1);
    expect(onRemix).toHaveBeenCalledWith(DROPS[1]);
  });

  it("while one drop's Remix is in flight, only its button waits", () => {
    const onRemix = vi.fn();
    render(<RemixCarousel drops={DROPS} status="ready" onRemix={onRemix} remixingId="a" />);
    const waiting = screen.getByRole("button", { name: "Remix: Stop meal prepping on Sundays" });
    expect(waiting).toBeDisabled();
    expect(waiting).toHaveAttribute("aria-busy", "true");
    expect(waiting).toHaveTextContent("Opening…");
    const other = screen.getByRole("button", { name: "Remix: The grocery list that fed me for a week" });
    expect(other).toBeEnabled();
    fireEvent.click(waiting);
    expect(onRemix).not.toHaveBeenCalled();
  });

  it("while the drops warm: four ghost cards in the same place, hidden from a screen reader, nothing to press", () => {
    render(<RemixCarousel drops={[]} status="warming" onRemix={vi.fn()} />);
    const region = carousel()!;
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region.querySelectorAll('[data-part="remix-ghost"]')).toHaveLength(4);
    for (const ghost of region.querySelectorAll('[data-part="remix-ghost"]')) expect(ghost).toHaveAttribute("aria-hidden", "true");
    expect(within(region).queryAllByRole("button")).toHaveLength(0);
  });

  it("warmed and empty: nothing at all, no space", () => {
    const { container } = render(<RemixCarousel drops={[]} status="ready" onRemix={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  describe("the steps (a mouse has no sideways wheel)", () => {
    /** Gives every element a 720 box with `scrollWidth` of content and a live scrollLeft: no layout here. */
    const layout = (scrollWidth: number) => {
      const props = {
        clientWidth: { configurable: true, get: () => 720 },
        scrollWidth: { configurable: true, get: () => scrollWidth },
      };
      Object.defineProperties(HTMLElement.prototype, props);
      return () => {
        delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
        delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollWidth;
      };
    };

    it("a row that overflows gets Earlier and More, desktop only; Earlier waits at the start; More pages the row", () => {
      const restore = layout(972);
      try {
        render(<RemixCarousel drops={DROPS} status="ready" onRemix={vi.fn()} />);
        const steps = carousel()!.querySelector<HTMLElement>('[data-part="remix-steps"]')!;
        expect(steps).toHaveClass("max-md:hidden");
        const earlier = within(steps).getByRole("button", { name: "Earlier videos" });
        const more = within(steps).getByRole("button", { name: "More videos" });
        expect(earlier).toBeDisabled();
        expect(more).toBeEnabled();

        const list = within(carousel()!).getByRole("list");
        const scrollBy = vi.fn();
        list.scrollBy = scrollBy as unknown as typeof list.scrollBy;
        fireEvent.click(more);
        expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 720 * 0.8 }));

        // At the far end: More waits, Earlier goes back.
        list.scrollLeft = 252;
        fireEvent.scroll(list);
        expect(more).toBeDisabled();
        expect(earlier).toBeEnabled();
        fireEvent.click(earlier);
        expect(scrollBy).toHaveBeenLastCalledWith(expect.objectContaining({ left: -720 * 0.8 }));
      } finally {
        restore();
      }
    });

    it("a row that fits, or one still warming, has no steps", () => {
      const restore = layout(720);
      try {
        const { rerender } = render(<RemixCarousel drops={DROPS} status="ready" onRemix={vi.fn()} />);
        expect(carousel()!.querySelector('[data-part="remix-steps"]')).toBeNull();
        rerender(<RemixCarousel drops={[]} status="warming" onRemix={vi.fn()} />);
        expect(carousel()!.querySelector('[data-part="remix-steps"]')).toBeNull();
      } finally {
        restore();
      }
    });
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<RemixCarousel drops={DROPS} status="ready" onRemix={vi.fn()} />);
    const results = await axe(container);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(results).toHaveNoViolations();
  });
});

describe("multiplierWord", () => {
  it.each([
    [3, "3.0×"],
    [4.25, "4.3×"],
    [9.94, "9.9×"],
    [10, "10×"],
    [17.6, "18×"],
  ])("%d reads %s", (m, words) => {
    expect(multiplierWord(m)).toBe(words);
  });
});
