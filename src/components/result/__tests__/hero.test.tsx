/** @vitest-environment happy-dom */
/**
 * The phone hero and the compact player (plan Task 3, spec §5 "Hero", "Scrolled, phone"). Real
 * components and playhead on recorded runs.
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

describe("Hero", () => {
  it("early: the video, the gauge with 46, the line with the strip, in one card", () => {
    const model = modelOf(early, { frames: true });
    const { container } = renderWithPlayhead(model, <Hero model={model} />);
    const hero = named(container, "hero")[0]!;
    for (const part of ["video", "gauge", "curve", "strip"]) {
      expect(hero.querySelector(`[data-result="${part}"]`), part).not.toBeNull();
    }
    expect(screen.getByRole("img", { name: "46% watch to the end" })).toBeInTheDocument();
    expect(screen.getByRole("slider")).toBeInTheDocument();
    expect(hero.querySelector<HTMLElement>('[data-result="curve"]')!.style.height).toBe("100px");
  });

  it("holds: 84, nothing coral, no strip without frames", () => {
    const model = modelOf(holds);
    const { container } = renderWithPlayhead(model, <Hero model={model} />);
    expect(screen.getByRole("img", { name: "84% watch to the end" })).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/--color-below/);
    expect(named(container, "strip")).toHaveLength(0);
  });

  it("middle (frames gone): the quiet tile, the gauge, the line with its coral scene", () => {
    const model = modelOf(middle);
    const { container } = renderWithPlayhead(model, <Hero model={model} />);
    expect(named(container, "video")[0]).toHaveTextContent("0:29");
    expect(container.querySelector('[data-part="loss"]')).not.toBeNull();
  });
});

describe("CompactPlayer", () => {
  it("a small frame, the line (50 tall, no strip) and the number at its end", () => {
    const model = modelOf(early, { frames: true });
    const { container } = renderWithPlayhead(model, <CompactPlayer model={model} />);
    const compact = named(container, "compact")[0]!;
    expect(compact.querySelector('[data-result="video"]')!.className).toMatch(/w-\[62px\]/);
    expect(compact.querySelector<HTMLElement>('[data-result="curve"]')!.style.height).toBe("50px");
    expect(named(container, "strip")).toHaveLength(0);
    expect(compact.querySelector('[data-part="end"]')!.textContent).toBe("46%");
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
