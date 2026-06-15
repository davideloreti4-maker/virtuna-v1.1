/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { SimulationShowcase } from "../simulation-showcase";

/**
 * STORY-02 Nyquist gate on <SimulationShowcase>, extended in 03-05 for the
 * filled device frame (GAP-2) + de-brittled per WR-04.
 *
 * The section heading "The Simulation" is LOCKED VERBATIM (matches the
 * `#the-simulation` anchor + page.tsx stub). The five required outputs are
 * matched by stable tokens (resilience rule), not full sentences.
 *
 * WR-04: after 03-05 fills the frame with the gauge/cloud/driver-rows skeleton,
 * several output tokens (watch-through / Hook / Retention / drop / Shareability)
 * now appear BOTH in the filled-frame skeleton AND in the named-output `<dl>`
 * chips. The output assertions are therefore scoped to the outputs `<dl>` via
 * `within(dl)` (and `simulat` stays a strict single-match — it appears only in
 * the locked `<h2>`), so a plausibly-multi-match token never trips a strict
 * `getByText`.
 */
describe("<SimulationShowcase /> — STORY-02", () => {
  /** The named-output `<dl>` beneath the frame (the output chips). */
  function getOutputsList(container: HTMLElement): HTMLElement {
    const dl = container.querySelector("dl");
    expect(dl).not.toBeNull();
    return dl as HTMLElement;
  }

  it("renders the section heading 'The Simulation' verbatim (matches #the-simulation)", () => {
    render(<SimulationShowcase />);

    // LOCKED — the level-2 section heading reads exactly "The Simulation",
    // mirroring the nav/footer #the-simulation anchor.
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent?.trim()).toBe("The Simulation");
  });

  it("keeps 'The Simulation' <h2> as the sole /simulat/i node (noun lock)", () => {
    render(<SimulationShowcase />);

    // The filled-frame skeleton carries NO "simulat*" text, so /simulat/i still
    // resolves to a single node — the locked heading.
    const node = screen.getByText(/simulat/i);
    expect(node.textContent?.trim()).toBe("The Simulation");
  });

  it("names audience reaction in the outputs list", () => {
    const { container } = render(<SimulationShowcase />);

    // Output 1 — the audience-reaction moment, scoped to the outputs <dl>.
    const dl = getOutputsList(container);
    expect(within(dl).getAllByText(/audience/i).length).toBeGreaterThanOrEqual(1);
  });

  it("names watch-through % in the outputs list", () => {
    const { container } = render(<SimulationShowcase />);

    // Output 2 — watch-through percentage. WR-04: scoped to the <dl> because the
    // filled-frame skeleton also renders a "watch-through" caption.
    const dl = getOutputsList(container);
    expect(
      within(dl).getAllByText(/watch[- ]?through|watch %|% watch/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("names Hook in the outputs list", () => {
    const { container } = render(<SimulationShowcase />);

    // Output 3 — Hook. WR-04: scoped to the <dl> (the driver skeleton also
    // renders a "Hook" row label).
    const dl = getOutputsList(container);
    expect(within(dl).getAllByText(/hook/i).length).toBeGreaterThanOrEqual(1);
  });

  it("names Retention and where-they-drop in the outputs list", () => {
    const { container } = render(<SimulationShowcase />);

    // Output 4 — Retention (where viewers drop off). WR-04: scoped to the <dl>
    // (the driver skeleton also renders "Retention" + a "drops at 0:07" caption).
    const dl = getOutputsList(container);
    expect(within(dl).getAllByText(/retention/i).length).toBeGreaterThanOrEqual(1);
    expect(within(dl).getAllByText(/drop/i).length).toBeGreaterThanOrEqual(1);
  });

  it("names Shareability in the outputs list", () => {
    const { container } = render(<SimulationShowcase />);

    // Output 5 — Shareability. WR-04: scoped to the <dl> (the driver skeleton
    // also renders a "Shareability" row label).
    const dl = getOutputsList(container);
    expect(within(dl).getAllByText(/shareab/i).length).toBeGreaterThanOrEqual(1);
  });

  it("fills the device frame with the gauge/cloud/driver-rows skeleton (GAP-2)", () => {
    const { container } = render(<SimulationShowcase />);

    // GAP-2: the frame is no longer an empty Placeholder void — it carries the
    // assembled product-skeleton shape. Assert the structural fingerprint:
    //   - >= 1 <svg> containing an arc element (the score gauge's stroked circle)
    //   - >= 6 <circle> elements (the audience cloud dots)
    //   - the three driver labels Hook / Retention / Shareability
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(1);

    // The gauge arc is a stroked <circle> with a stroke-dasharray (the 270deg
    // arc geometry). Assert at least one such arc circle exists.
    const arcCircles = Array.from(container.querySelectorAll("circle")).filter(
      (c) => c.getAttribute("stroke-dasharray") !== null
    );
    expect(arcCircles.length).toBeGreaterThanOrEqual(1);

    // The audience cloud renders >= 6 dot circles.
    const allCircles = container.querySelectorAll("circle");
    expect(allCircles.length).toBeGreaterThanOrEqual(6);

    // The three driver labels appear (in the filled frame AND/OR the <dl>).
    expect(screen.getAllByText(/hook/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/retention/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/shareab/i).length).toBeGreaterThanOrEqual(1);
  });
});
