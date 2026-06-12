/** @vitest-environment happy-dom */
/**
 * verdict-throne.test.tsx — Wave-0 Nyquist scaffold for HERO-03.
 *
 * RED until Wave 1/2 ships `@/components/numen-landing/verdict-throne`. Asserts the
 * verdict-throne contract (VOICE.md Rule 3 — band + why, NEVER a naked number):
 *  - the calibrated GOOD-band label renders (e.g. "This will likely land.").
 *  - a one-line WHY renders (a specific reason — stable substring "hook" per UI-SPEC).
 *  - CRITICAL: NO naked number anywhere (no `NN/100`, no `NN%`).
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

describe("VerdictThrone — HERO-03 band + why, no naked number (RED until Wave 1/2)", () => {
  it("renders the confident GOOD-band label", async () => {
    const { VerdictThrone } = await import("@/components/numen-landing/verdict-throne");
    const { container } = render(<VerdictThrone />);
    // Stable substring "land" of the band label "This will likely land." (D-08a refinable).
    expect((container.textContent ?? "").toLowerCase()).toContain("land");
  });

  it("renders a one-line WHY (a specific reason, not flattery)", async () => {
    const { VerdictThrone } = await import("@/components/numen-landing/verdict-throne");
    const { container } = render(<VerdictThrone />);
    // The why names a real strength — stable substring "hook" per the UI-SPEC example.
    expect((container.textContent ?? "").toLowerCase()).toContain("hook");
  });

  it("NEVER renders a naked number / score (VOICE Rule 3)", async () => {
    const { VerdictThrone } = await import("@/components/numen-landing/verdict-throne");
    const { container } = render(<VerdictThrone />);
    expect(container.textContent).not.toMatch(/\d+\s*\/\s*100|\d+\s*%/);
  });
});
