/** @vitest-environment happy-dom */
/**
 * reading-loop.test.tsx — Wave-0 Nyquist scaffold for HERO-04 (reduced motion).
 *
 * RED until Wave 1 ships `@/components/numen-landing/reading-loop`. Asserts the
 * HARD reduced-motion fallback (HERO-04 / D-14): under `prefers-reduced-motion`,
 * the loop degrades to a STATIC fully-revealed end-state —
 *  - the verdict band label renders (all stages painted directly at rest, proving
 *    no controller auto-cycle: a running interval would start at revealed=0 and the
 *    throne label would be hidden); AND
 *  - no element carries a non-zero translate transform.
 *
 * The `useReducedMotion: () => true` mock is COPIED VERBATIM from
 * tests/numen/stage-reveal.test.ts:18-24 (the sanctioned reduced-motion harness).
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => true };
});

describe("ReadingLoop — HERO-04 reduced-motion static end-state (RED until Wave 1)", () => {
  it("paints the full end-state (verdict band label visible) — proving no auto-cycle under reduced motion", async () => {
    const { ReadingLoop } = await import("@/components/numen-landing/reading-loop");
    const { container } = render(<ReadingLoop />);
    // End-state painted directly: the final stage (verdict throne label) is shown
    // at rest. A controller that auto-cycled would start at revealed=0 and hide it.
    // Stable substring "land" of the band label "This will likely land." (D-08a).
    expect((container.textContent ?? "").toLowerCase()).toContain("land");
  });

  it("renders no element with a non-zero translate transform under reduced motion", async () => {
    const { ReadingLoop } = await import("@/components/numen-landing/reading-loop");
    const { container } = render(<ReadingLoop />);
    // Reuse the translate-scan from stage-reveal.test.ts:33-39.
    const all = container.querySelectorAll<HTMLElement>("*");
    for (const el of Array.from(all)) {
      const t = el.style.transform || "";
      expect(t).not.toMatch(/translate(Y|3d)?\([^)]*[1-9]/);
    }
  });
});
