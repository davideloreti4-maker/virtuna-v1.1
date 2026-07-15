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
 * WR-04: the output assertions are scoped to the outputs `<dl>` via `within(dl)`
 * (and `simulat` stays a strict single-match — it appears only in the locked
 * `<h2>`), so a plausibly-multi-match token never trips a strict `getByText`.
 * The scoping predates the screenshot swap and is kept: the frame's alt text
 * names the same levers, and an alt is a text node to some queries.
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

  it("fills the device frame with a real capture of a reading (GAP-2 / FOUND-03)", () => {
    const { container } = render(<SimulationShowcase />);

    // The frame used to hold the static-SVG skeleton shape of a reading; it now
    // holds the reading itself, captured from the running app. Assert the
    // capture is there, named, and sitting in an aspect-locked box (no-CLS) —
    // NOT the old svg/circle fingerprint, which no longer exists.
    const shot = screen.getByRole("img", { name: /score/i });
    expect(shot.getAttribute("src")).toBeTruthy();

    const box = shot.parentElement as HTMLElement;
    expect(/\baspect-\[/.test(box.className)).toBe(true);

    // The frame is the ONLY image in the section (the skeletons are gone).
    expect(container.querySelectorAll("img").length).toBe(1);

    // The three levers stay named beneath the frame, in the outputs <dl>.
    expect(screen.getAllByText(/hook/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/retention/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/shareab/i).length).toBeGreaterThanOrEqual(1);
  });
});
