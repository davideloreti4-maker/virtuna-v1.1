/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { Testimonials } from "../testimonials";

/**
 * PROOF-02 Nyquist gate on <Testimonials>.
 *
 * Behaviors under test (D-06/D-07 anatomy):
 *  - Exactly 3 avatar placeholders via [data-variant="avatar"].
 *  - Each card carries an @handle (data-testid="testimonial-handle", count >= 3).
 *  - Each card carries a result metric (data-testid="testimonial-metric", count >= 3).
 *
 * Wave-1 component MUST emit data-testid="testimonial-handle" and
 * data-testid="testimonial-metric" for these assertions to resolve.
 *
 * RED-by-design: module-not-found until testimonials.tsx is built in Wave 1.
 */
describe("<Testimonials /> — PROOF-02", () => {
  it("renders exactly 3 avatar placeholders via [data-variant='avatar']", () => {
    const { container } = render(<Testimonials />);
    const avatars = container.querySelectorAll('[data-variant="avatar"]');
    expect(avatars.length).toBe(3);
  });

  it("renders at least 3 @handle nodes (data-testid='testimonial-handle')", () => {
    const { container } = render(<Testimonials />);
    const handles = container.querySelectorAll(
      '[data-testid="testimonial-handle"]'
    );
    expect(handles.length).toBeGreaterThanOrEqual(3);
  });

  it("renders at least 3 result metric nodes (data-testid='testimonial-metric')", () => {
    const { container } = render(<Testimonials />);
    const metrics = container.querySelectorAll(
      '[data-testid="testimonial-metric"]'
    );
    expect(metrics.length).toBeGreaterThanOrEqual(3);
  });
});
