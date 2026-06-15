/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { SimulationShowcase } from "../simulation-showcase";

/**
 * Phase 3 Wave-0 Nyquist gate — STORY-02 on the (not-yet-built)
 * <SimulationShowcase>.
 *
 * RED BY DESIGN: the `../simulation-showcase` module does not exist yet (built
 * in 03-02). Module-not-found is the Wave-0 success signal. This suite turns
 * GREEN in 03-02.
 *
 * The section heading "The Simulation" is LOCKED VERBATIM (matches the
 * `#the-simulation` anchor + page.tsx stub). The five required outputs are
 * matched by stable tokens (resilience rule), not full sentences.
 */
describe("<SimulationShowcase /> — STORY-02", () => {
  it("renders the section heading 'The Simulation' verbatim (matches #the-simulation)", () => {
    render(<SimulationShowcase />);

    // LOCKED — the level-2 section heading reads exactly "The Simulation",
    // mirroring the nav/footer #the-simulation anchor.
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent?.trim()).toBe("The Simulation");
  });

  it("names audience simulation", () => {
    render(<SimulationShowcase />);

    // Output 1 — the audience-simulation moment. Match both stable tokens.
    expect(screen.getByText(/audience/i)).toBeTruthy();
    expect(screen.getByText(/simulat/i)).toBeTruthy();
  });

  it("names watch-through %", () => {
    render(<SimulationShowcase />);

    // Output 2 — watch-through percentage (planner-flexible wording).
    expect(
      screen.getByText(/watch[- ]?through|watch %|% watch/i)
    ).toBeTruthy();
  });

  it("names Hook", () => {
    render(<SimulationShowcase />);

    // Output 3 — Hook.
    expect(screen.getByText(/hook/i)).toBeTruthy();
  });

  it("names Retention and where-they-drop", () => {
    render(<SimulationShowcase />);

    // Output 4 — Retention (where viewers drop off).
    expect(screen.getByText(/retention/i)).toBeTruthy();
    expect(screen.getByText(/drop/i)).toBeTruthy();
  });

  it("names Shareability", () => {
    render(<SimulationShowcase />);

    // Output 5 — Shareability.
    expect(screen.getByText(/shareab/i)).toBeTruthy();
  });

  it("renders the product visual as a <Placeholder> with an inline aspect-ratio (no-CLS)", () => {
    const { container } = render(<SimulationShowcase />);

    // Success Criterion 4: the big showcase visual is a Placeholder slot with
    // the no-CLS inline aspect-ratio set (placeholder.tsx line 120).
    const slot = container.querySelector("[data-variant]");
    expect(slot).not.toBeNull();
    expect((slot as HTMLElement).style.aspectRatio.length).toBeGreaterThan(0);
  });
});
