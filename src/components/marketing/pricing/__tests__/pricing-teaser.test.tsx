/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { PricingTeaser } from "../pricing-teaser";
import { PLANS, TRIAL } from "@/lib/pricing";

/**
 * CONVERT-01 Nyquist gate on <PricingTeaser>.
 *
 * Re-cut 2026-07-13 for the owner-locked pricing: THREE paid plans (Creator $49 · Pro $99
 * "Best value" · Studio $499), each startable for $1 for 3 days, and NO free plan on the
 * page. The old gate asserted a free Starter tier and a $19 Pro — both gone.
 *
 * The teaser is driven by the pricing SSOT, so these assertions read the SSOT too: the gate
 * is "the page shows what we sell", not a second copy of the numbers that can drift from it.
 * The numbers themselves are locked in `lib/__tests__/pricing.test.ts`.
 */
describe("<PricingTeaser /> — CONVERT-01", () => {
  it("renders all three paid plans by their PUBLIC names", () => {
    render(<PricingTeaser />);
    for (const plan of PLANS) {
      expect(screen.getByText(plan.name)).toBeInTheDocument();
      expect(screen.getByText(plan.price)).toBeInTheDocument();
    }
  });

  it("shows no free plan — the $1 trial is the way in", () => {
    render(<PricingTeaser />);
    // "Free" as a price or a plan name must not reappear: it is not what we sell.
    expect(screen.queryByText(/^free$/i)).toBeNull();
    expect(screen.queryByText(/no credit card/i)).toBeNull();
  });

  it("puts the '$1 for 3 days' trial on every card, and says what happens after", () => {
    render(<PricingTeaser />);
    expect(screen.getAllByText(TRIAL.badge)).toHaveLength(PLANS.length);

    // The conversion must be stated on every card — a trial that hides its renewal is
    // what customers file chargebacks over.
    const microcopy = screen.getAllByText(TRIAL.microcopy);
    expect(microcopy).toHaveLength(PLANS.length);
    expect(TRIAL.microcopy).toMatch(/then the plan price/i);
  });

  it("marks exactly one plan as the best value (one CTA dominates)", () => {
    render(<PricingTeaser />);
    expect(screen.getAllByText(/best value/i)).toHaveLength(1);
  });

  it("routes every CTA to /signup", () => {
    const { container } = render(<PricingTeaser />);
    const signupLinks = Array.from(container.querySelectorAll("a")).filter(
      (a) => a.getAttribute("href") === "/signup"
    );
    expect(signupLinks.length).toBe(PLANS.length);
  });

  it("renders 3–4 bullets per card, led by the meter", () => {
    const { container } = render(<PricingTeaser />);
    const bullets = container.querySelectorAll('[data-testid="pricing-bullet"]');
    expect(bullets.length).toBeGreaterThanOrEqual(PLANS.length * 3);
    expect(bullets.length).toBeLessThanOrEqual(PLANS.length * 4);

    // What they're buying is credits — so the meter is the first line of every card.
    // Exact SSOT strings, not regexes: a substring match would let the meter drift off
    // the first bullet unnoticed. The numbers themselves are locked in pricing.test.ts.
    for (const plan of PLANS) {
      const meter = plan.bullets[0] ?? "";
      expect(screen.getByText(meter)).toBeInTheDocument();
      expect(meter).toMatch(/credits/i);
    }
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
