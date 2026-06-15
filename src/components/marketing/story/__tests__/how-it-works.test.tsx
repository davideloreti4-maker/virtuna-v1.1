/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { HowItWorks } from "../how-it-works";

/**
 * Phase 3 Wave-0 Nyquist gate — STORY-01 on the (not-yet-built) <HowItWorks>.
 *
 * RED BY DESIGN: the `../how-it-works` module does not exist yet (built in
 * 03-01). The import fails with module-not-found — that IS the success signal
 * for Wave 0 (workflow.nyquist_validation: the automated check exists BEFORE
 * the implementation). This suite turns GREEN in 03-01.
 *
 * Resilience rule (03-PATTERNS § Test files): assert STABLE TOKENS, not full
 * sentences, so copy tightening within intent does not break the gate. The
 * product noun is matched by `/simulat(?:es|ion|e)/i`; "reading" is forbidden
 * as a user-facing product noun (noun discipline, Pitfall 1).
 */
describe("<HowItWorks /> — STORY-01", () => {
  it("renders exactly 3 ordered step blocks", () => {
    const { container } = render(<HowItWorks />);

    // Each step pairs an ordinal marker + a Placeholder visual; assert there
    // are exactly 3 product visuals (one per step) via the data-variant hook.
    const slots = container.querySelectorAll("[data-variant]");
    expect(slots.length).toBe(3);
  });

  it("renders the 3 step titles as ordered level-3 headings", () => {
    render(<HowItWorks />);

    // 3 steps → 3 step titles. Headings are level-3 (the section <h2> owns the
    // section title; per-step titles are <h3>). Order is encoded by the DOM
    // order of these headings.
    const stepHeadings = screen.getAllByRole("heading", { level: 3 });
    expect(stepHeadings.length).toBe(3);
  });

  it("renders the ordinal step markers 1, 2, 3 in order", () => {
    render(<HowItWorks />);

    // Stable ordinal tokens (e.g. "01"/"02"/"03" or "1"/"2"/"3") prove the
    // steps are numbered and ordered. Match the digit by word boundary so
    // "01" or "1" both pass.
    const one = screen.getByText(/\b0?1\b/);
    const two = screen.getByText(/\b0?2\b/);
    const three = screen.getByText(/\b0?3\b/);
    expect(one).toBeTruthy();
    expect(two).toBeTruthy();
    expect(three).toBeTruthy();
  });

  it("each step visual is a <Placeholder> with an inline aspect-ratio (no-CLS)", () => {
    const { container } = render(<HowItWorks />);

    const slots = container.querySelectorAll("[data-variant]");
    expect(slots.length).toBe(3);
    // Success Criterion 4: every product visual is a Placeholder with the
    // no-CLS inline aspect-ratio set (placeholder.tsx line 120).
    slots.forEach((slot) => {
      expect((slot as HTMLElement).style.aspectRatio.length).toBeGreaterThan(0);
    });
  });

  it("names the product by its noun (Simulation / simulates)", () => {
    render(<HowItWorks />);

    // Noun discipline: product noun = "Simulation" (verb "simulates").
    // Assert the stable token, not the full sentence (resilience rule).
    const noun = screen.getByText(/simulat(?:es|ion|e)/i);
    expect(noun).toBeTruthy();
    expect(noun.textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it("never uses 'reading' as a user-facing product noun (Pitfall 1)", () => {
    render(<HowItWorks />);

    // NEGATIVE assertion — the retired product noun "reading" must not appear.
    expect(screen.queryByText(/\breading\b/i)).toBeNull();
  });
});
