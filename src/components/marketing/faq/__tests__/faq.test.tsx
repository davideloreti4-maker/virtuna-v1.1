/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { Faq } from "../faq";

/**
 * CONVERT-03 Nyquist gate on <Faq>.
 *
 * Behaviors under test (D-15/D-16):
 *  - Exactly 6 accordion triggers via getAllByRole("button").length === 6.
 *    (Radix accordion triggers are <button> elements — the keyboard a11y proxy.)
 *  - At least 6 Radix data-state panels present in the DOM via [data-state].
 *    (Wiring proxy for the type="single" collapsible contract — each item emits
 *    data-state="open"|"closed".)
 *
 * Single-open keyboard behavior is a live UAT item (Manual-Only in 04-VALIDATION.md).
 *
 * RED-by-design: module-not-found until faq.tsx is built in Wave 1.
 */
describe("<Faq /> — CONVERT-03", () => {
  it("renders exactly 6 accordion triggers (Radix button elements)", () => {
    render(<Faq />);
    const triggers = screen.getAllByRole("button");
    expect(triggers.length).toBe(6);
  });

  it("renders at least 6 Radix data-state panels in the DOM", () => {
    const { container } = render(<Faq />);
    const panels = container.querySelectorAll("[data-state]");
    expect(panels.length).toBeGreaterThanOrEqual(6);
  });
});
