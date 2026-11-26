/** @vitest-environment happy-dom */
/**
 * The phone's first card and the pinned compact player: the video in focus, the count under
 * it, the line with the strip and its times. Real components and playhead on recorded runs.
 */
import { describe, expect, it } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import early from "@/lib/result/__tests__/fixtures/early.json";
import holds from "@/lib/result/__tests__/fixtures/holds.json";
import middle from "@/lib/result/__tests__/fixtures/middle.json";
import { CompactPlayer } from "../compact-player";
import { Hero } from "../hero";
import { modelOf, playhead, renderWithPlayhead } from "./hero-harness";

const named = (container: HTMLElement, name: string) => container.querySelectorAll(`[data-result="${name}"]`);
const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe("Hero", () => {
  it("early: the video in focus, the count under it, the line with the strip, in one card; no gauge", () => {
    const model = modelOf(early, { frames: true });
    const { container } = renderWithPlayhead(model, <Hero model={model} />);
    const hero = named(container, "hero")[0]!;
    const [video, count, curve, strip] = ["video", "count", "curve", "strip"].map(
      (name) => hero.querySelector<HTMLElement>(`[data-result="${name}"]`)!,
    ) as [HTMLElement, HTMLElement, HTMLElement, HTMLElement];
    expect([video, count, curve, strip].every(Boolean)).toBe(true);
    expect(follows(video, count)).toBe(true);
    expect(follows(count, curve)).toBe(true);
    // The video fills the first card's tile box.
    expect(video.parentElement!.getAttribute("data-part")).toBe("tile-box");
    expect(count).toHaveTextContent("461 of 1,000 watched to the end");
    expect(container.querySelector('[data-result="gauge"]')).toBeNull();
    expect(screen.queryByRole("img", { name: /watch to the end/ })).toBeNull();
    expect(screen.getByRole("slider")).toBeInTheDocument();
    expect(curve.style.height).toBe("100px");
  });

  it("holds: 843, nothing coral, no strip without frames", () => {
    const model = modelOf(holds);
    const { container } = renderWithPlayhead(model, <Hero model={model} />);
    expect(named(container, "count")[0]).toHaveTextContent("843 of 1,000 watched to the end");
    expect(container.innerHTML).not.toMatch(/--color-below/);
    expect(named(container, "strip")).toHaveLength(0);
  });

  it("middle (frames gone): the quiet tile, the count, the line with its coral scene", () => {
    const model = modelOf(middle);
    const { container } = renderWithPlayhead(model, <Hero model={model} />);
    expect(named(container, "video")[0]).toHaveTextContent("0:29");
    expect(named(container, "count")[0]).toHaveTextContent("461 of 1,000 watched to the end");
    expect(container.querySelector('[data-part="loss"]')).not.toBeNull();
  });

  it("the count follows the video as the line does", () => {
    const model = modelOf(early);
    const { container } = renderWithPlayhead(model, <Hero model={model} />);
    act(() => playhead.current.seek(2.5));
    expect(named(container, "count")[0]).toHaveTextContent("854 of 1,000 still watching");
    expect(container.querySelector('[data-part="readout"]')!.textContent).toBe("71% · 0:03");
    act(() => playhead.current.seek(29));
    expect(named(container, "count")[0]).toHaveTextContent("461 of 1,000 watched to the end");
  });
});

describe("CompactPlayer", () => {
  it("a small frame, the line (50 tall, no strip) and the count's number at its end", () => {
    const model = modelOf(early, { frames: true });
    const { container } = renderWithPlayhead(model, <CompactPlayer model={model} />);
    const compact = named(container, "compact")[0]!;
    expect(compact.querySelector('[data-result="video"]')!.className).toMatch(/w-\[62px\]/);
    expect(compact.querySelector<HTMLElement>('[data-result="curve"]')!.style.height).toBe("50px");
    expect(named(container, "strip")).toHaveLength(0);
    expect(compact.querySelector('[data-part="end"]')!.textContent).toBe("461");
  });

  it("its number is the count under the video at that moment, alone", () => {
    const model = modelOf(early);
    const { container } = renderWithPlayhead(
      model,
      <>
        <Hero model={model} />
        <CompactPlayer model={model} />
      </>,
    );
    const end = () => container.querySelector('[data-part="end"]')!.textContent;
    const shown = () => named(container, "hero")[0]!.querySelector('[data-part="count-number"]')!.textContent;
    expect(end()).toBe(shown());
    for (const t of [0, 2.5, 7, 20]) {
      act(() => playhead.current.seek(t));
      expect(end()).toBe(shown());
    }
    expect(end()).toBe("461");
    expect(end()).not.toMatch(/%|of|watch/);
  });

  it("its line is a copy of the hero's: not a slider, not a tab stop, hidden from assistive tech; dragging still seeks", () => {
    const model = modelOf(early);
    const { container } = renderWithPlayhead(
      model,
      <>
        <Hero model={model} />
        <CompactPlayer model={model} />
      </>,
    );
    expect(screen.getAllByRole("slider")).toHaveLength(1);
    const compact = named(container, "compact")[0]!;
    expect(compact.querySelector('[role="slider"]')).toBeNull();
    expect(compact.querySelector("[tabindex]")).toBeNull();
    const line = compact.querySelector<HTMLElement>('[data-result="curve"]')!.parentElement!;
    expect(line.getAttribute("aria-hidden")).toBe("true");
    fireEvent.pointerDown(line, { pointerId: 1, pointerType: "mouse", button: 0, clientX: (7 / 29) * 263 });
    expect(playhead.current.t).toBeCloseTo(7, 1);
  });

  it("follows the playhead like the hero's line", () => {
    const model = modelOf(early);
    const { container } = renderWithPlayhead(model, <CompactPlayer model={model} />);
    expect(container.querySelector('[data-part="readout"]')).toBeNull();
    act(() => playhead.current.seek(2.5));
    expect(container.querySelector('[data-part="readout"]')!.textContent).toBe("71% · 0:03");
  });
});
