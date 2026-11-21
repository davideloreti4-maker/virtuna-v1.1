/** @vitest-environment happy-dom */
/**
 * The gauge (plan Task 3, spec §4): a 270° arc from 135°, the number and "watch to the end". Real
 * component on recorded runs; nothing stood in.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import early from "@/lib/result/__tests__/fixtures/early.json";
import ending from "@/lib/result/__tests__/fixtures/ending.json";
import holds from "@/lib/result/__tests__/fixtures/holds.json";
import { Gauge } from "../gauge";
import { modelOf } from "./hero-harness";

const gaugeOf = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-result="gauge"]')!;

describe("Gauge", () => {
  it("early: the number 46 and 'watch to the end'", () => {
    const { container } = render(<Gauge headline={modelOf(early).headline} size={148} />);
    expect(screen.getByRole("img", { name: "46% watch to the end" })).toBeInTheDocument();
    const gauge = gaugeOf(container);
    expect(gauge.textContent).toContain("46");
    expect(gauge.textContent).toContain("%");
    expect(screen.getByText("watch to the end")).toBeInTheDocument();
  });

  it("holds: 84", () => {
    render(<Gauge headline={modelOf(holds).headline} size={148} />);
    expect(screen.getByRole("img", { name: "84% watch to the end" })).toBeInTheDocument();
  });

  it("the value arc is the share of the 270° track, in ink", () => {
    const { container } = render(<Gauge headline={modelOf(early).headline} size={148} />);
    const track = container.querySelector('[data-part="track"]')!;
    const value = container.querySelector('[data-part="value"]')!;
    expect(track.getAttribute("stroke")).toBe("var(--color-track)");
    expect(value.getAttribute("stroke")).toBe("var(--color-foreground)");
    expect(value.getAttribute("pathLength")).toBe("100");
    expect(value.getAttribute("stroke-dasharray")).toBe("46 100");
    // Both start at 135° (lower left) and sweep 270° clockwise: the same path.
    expect(value.getAttribute("d")).toBe(track.getAttribute("d"));
    expect(track.getAttribute("stroke-linecap")).toBe("round");
  });

  it("0%: no value arc", () => {
    const { container } = render(<Gauge headline={modelOf(ending).headline} size={148} />);
    expect(screen.getByRole("img", { name: "0% watch to the end" })).toBeInTheDocument();
    expect(container.querySelector('[data-part="value"]')).toBeNull();
  });

  it("148 in the phone hero (stroke 13), 180 on desktop (stroke 14)", () => {
    const headline = modelOf(early).headline;
    const phone = render(<Gauge headline={headline} size={148} />);
    expect(gaugeOf(phone.container).style.width).toBe("148px");
    expect(phone.container.querySelector("svg")!.getAttribute("width")).toBe("148");
    expect(phone.container.querySelector('[data-part="track"]')!.getAttribute("stroke-width")).toBe("13");
    phone.unmount();

    const desk = render(<Gauge headline={headline} size={180} />);
    expect(gaugeOf(desk.container).style.width).toBe("180px");
    expect(desk.container.querySelector('[data-part="track"]')!.getAttribute("stroke-width")).toBe("14");
  });

  it("no 'usual' line and no tick in this slice", () => {
    const { container } = render(<Gauge headline={modelOf(early).headline} size={148} />);
    expect(container.textContent).not.toMatch(/usual/i);
    expect(container.querySelectorAll("path")).toHaveLength(2);
  });
});
