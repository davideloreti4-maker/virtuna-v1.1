/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { PricingTeaser } from "../pricing-teaser";

/**
 * CONVERT-01 Nyquist gate on <PricingTeaser>.
 *
 * Behaviors under test (D-08/D-09/D-10):
 *  - 2 tier names present: Starter + Pro.
 *  - Pro tier carries the "Most popular" highlight label.
 *  - Both CTAs route to /signup (at least 2 links with href="/signup").
 *  - Each card carries 3–4 bullets (total bullets 6–8 via data-testid="pricing-bullet").
 *  - No off-site links (D-10 static guard: every link href starts with "/" or "#").
 *
 * Wave-1 component MUST emit data-testid="pricing-bullet" on each bullet item.
 *
 * RED-by-design: module-not-found until pricing-teaser.tsx is built in Wave 1.
 */
describe("<PricingTeaser /> — CONVERT-01", () => {
  it("renders Starter and Pro tier names", () => {
    render(<PricingTeaser />);
    expect(screen.getByText(/starter/i)).toBeInTheDocument();
    expect(screen.getByText(/pro/i)).toBeInTheDocument();
  });

  it("Pro card carries the 'Most popular' label", () => {
    render(<PricingTeaser />);
    expect(screen.getByText(/most popular/i)).toBeInTheDocument();
  });

  it("both CTAs link to /signup (at least 2 links)", () => {
    const { container } = render(<PricingTeaser />);
    const signupLinks = Array.from(container.querySelectorAll("a")).filter(
      (a) => a.getAttribute("href") === "/signup"
    );
    expect(signupLinks.length).toBeGreaterThanOrEqual(2);
  });

  it("renders 6–8 pricing bullets total (3–4 per card)", () => {
    const { container } = render(<PricingTeaser />);
    const bullets = container.querySelectorAll('[data-testid="pricing-bullet"]');
    expect(bullets.length).toBeGreaterThanOrEqual(6);
    expect(bullets.length).toBeLessThanOrEqual(8);
  });

  it("contains no off-site links (D-10 static guard)", () => {
    const { container } = render(<PricingTeaser />);
    const allLinks = Array.from(container.querySelectorAll("a"));
    const offSite = allLinks.filter((a) => {
      const href = a.getAttribute("href") ?? "";
      return href.startsWith("http://") || href.startsWith("https://");
    });
    expect(offSite.length).toBe(0);
  });
});
