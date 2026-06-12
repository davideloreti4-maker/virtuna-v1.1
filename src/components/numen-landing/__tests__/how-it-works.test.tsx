/** @vitest-environment happy-dom */
/**
 * how-it-works.test.tsx — Wave-0 Nyquist scaffold for READ-01 / READ-02.
 *
 * RED until Wave 1/3 ships `@/components/numen-landing/how-it-works`. Asserts the
 * 3-step explainer contract (upload → Numen reads → verdict + why):
 *  - READ-01: three step titles render (Upload / Numen reads it / Your verdict).
 *  - READ-02: each step shows REAL content, not icon-only — step 1 has the real
 *             keyframe <img>; step 3 reuses the real verdict band label.
 *  - Heading hierarchy: step titles are <h3> (under the section <h2>), and the
 *    component itself emits no <h1>/<h2> (D-10 single-h1 / no heading skips).
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

describe("HowItWorks — READ-01 / READ-02 three real-content steps (RED until Wave 1/3)", () => {
  it("renders three step titles (Upload / Numen reads it / Your verdict)", async () => {
    const { HowItWorks } = await import("@/components/numen-landing/how-it-works");
    const { getByText } = render(<HowItWorks />);
    expect(getByText("Upload")).toBeTruthy();
    expect(getByText("Numen reads it")).toBeTruthy();
    expect(getByText("Your verdict")).toBeTruthy();
  });

  it("emits step titles as <h3> and no <h1>/<h2> of its own (D-10 hierarchy)", async () => {
    const { HowItWorks } = await import("@/components/numen-landing/how-it-works");
    const { container } = render(<HowItWorks />);
    expect(container.querySelectorAll("h3").length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll("h1").length).toBe(0);
    expect(container.querySelectorAll("h2").length).toBe(0);
  });

  it("shows REAL content per step — keyframe <img> in step 1, verdict band label in step 3 (READ-02)", async () => {
    const { HowItWorks } = await import("@/components/numen-landing/how-it-works");
    const { container } = render(<HowItWorks />);
    // Step 1 "Upload" demonstrates the real keyframe (next/image → <img>), not an icon.
    expect(container.querySelector("img")).toBeTruthy();
    // Step 3 "Your verdict" reuses the real verdict band label (stable substring "land").
    expect((container.textContent ?? "").toLowerCase()).toContain("land");
  });
});
