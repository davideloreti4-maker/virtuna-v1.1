/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { SocialProofStrip } from "../social-proof-strip";

/**
 * PROOF-01 Nyquist gate on <SocialProofStrip>.
 *
 * Behaviors under test (D-02/D-03/D-04):
 *  - A trust stat text node matching the "2,000+ creators" copy (tolerant per D-04).
 *  - At least 4 logo placeholders counted via [data-variant="logo"] (D-03 marquee).
 *  - Marquee a11y: the duplicated logo copies are hidden from the a11y tree via
 *    aria-hidden="true" on the marquee wrapper (Pitfall 4 — Marquee repeats=4 copies).
 *
 * RED-by-design: module-not-found until social-proof-strip.tsx is built in Wave 1.
 */
describe("<SocialProofStrip /> — PROOF-01", () => {
  it("renders a trust stat node matching /2,?000\\+? creators/i", () => {
    render(<SocialProofStrip />);
    expect(screen.getByText(/2,?000\+? creators/i)).toBeInTheDocument();
  });

  it("renders at least 4 logo placeholders via [data-variant='logo']", () => {
    const { container } = render(<SocialProofStrip />);
    const logos = container.querySelectorAll('[data-variant="logo"]');
    expect(logos.length).toBeGreaterThanOrEqual(4);
  });

  it("hides the marquee logo copies from the a11y tree (aria-hidden)", () => {
    const { container } = render(<SocialProofStrip />);
    // The marquee region (or its wrapper) must carry aria-hidden="true" so that
    // the screen reader does not announce the decorative logo wall up to 4 times.
    const hiddenRegion = container.querySelector('[aria-hidden="true"]');
    expect(hiddenRegion).not.toBeNull();
    // The hidden region must contain at least one logo placeholder.
    const logosInsideHidden = hiddenRegion!.querySelectorAll(
      '[data-variant="logo"]'
    );
    expect(logosInsideHidden.length).toBeGreaterThanOrEqual(1);
  });
});
