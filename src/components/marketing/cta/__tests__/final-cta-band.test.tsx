/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { FinalCtaBand } from "../final-cta-band";

/**
 * CONVERT-02 Nyquist gate on <FinalCtaBand>.
 *
 * Behaviors under test (D-13/D-14):
 *  - One CTA link → /signup present in the band.
 *  - Serif close-line present (data-testid="cta-close-line" — copy-resilient).
 *  - AudienceCloudSkeleton echo present via accessible name "Audience reaction
 *    (sample)" (role="img" aria-label in audience-cloud-skeleton.tsx) — the
 *    close-line names the audience, so the closing echo shows the audience
 *    (was the score gauge, which already appears 4× earlier on the page).
 *
 * Wave-1 component MUST emit data-testid="cta-close-line" on the serif close-line node.
 *
 * RED-by-design: module-not-found until final-cta-band.tsx is built in Wave 1.
 */
describe("<FinalCtaBand /> — CONVERT-02", () => {
  it("contains a CTA link pointing to /signup", () => {
    const { container } = render(<FinalCtaBand />);
    const signupLinks = Array.from(container.querySelectorAll("a")).filter(
      (a) => a.getAttribute("href") === "/signup"
    );
    expect(signupLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the serif close-line (data-testid='cta-close-line')", () => {
    const { container } = render(<FinalCtaBand />);
    const closeLine = container.querySelector('[data-testid="cta-close-line"]');
    expect(closeLine).not.toBeNull();
  });

  it("renders the AudienceCloudSkeleton echo via accessible name", () => {
    render(<FinalCtaBand />);
    expect(
      screen.getByRole("img", { name: /audience reaction/i })
    ).toBeInTheDocument();
  });
});
