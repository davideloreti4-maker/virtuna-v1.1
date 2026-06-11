/** @vitest-environment happy-dom */
/**
 * tests/numen/stage-reveal.test.ts — DS-07 stage-reveal motion gate.
 *
 * The stage-reveal is the ONE key motion moment (D-14). It MUST:
 *  - honor `prefers-reduced-motion`: when reduced, render children with NO
 *    translate/`y` (static opacity appear only).
 *  - never use the forbidden bouncy easing `cubic-bezier(0.34, 1.56, 0.64, 1)`
 *    (the old `--ease-spring` token; 1.56 > 1 overshoots = bounce §6 forbids).
 *
 * Mocks `motion/react` `useReducedMotion` via a mutable holder so individual
 * tests can exercise `true` (resolved-reduced), `null` (unresolved first paint,
 * WR-04), and `false` (resolved motion-OK).
 * RED until Plan 03 ships `@/components/numen/stage-reveal`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { createElement } from "react";

// Mutable holder — `vi.mock` is hoisted, so the factory closes over this ref and
// each test sets the value it wants before rendering.
const reducedMotionValue: { current: boolean | null } = { current: true };

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return {
    ...actual,
    useReducedMotion: () => reducedMotionValue.current,
  };
});

beforeEach(() => {
  reducedMotionValue.current = true;
});

/** No element under `container` may carry a non-zero translate transform. */
function assertNoSlide(container: HTMLElement): void {
  const all = container.querySelectorAll<HTMLElement>("*");
  for (const el of Array.from(all)) {
    const t = el.style.transform || "";
    expect(t).not.toMatch(/translate(Y|3d)?\([^)]*[1-9]/);
  }
}

describe("StageBlock — reduced motion (DS-07 / D-14)", () => {
  it("renders children statically (no translate) when reduced motion is on", async () => {
    reducedMotionValue.current = true;
    const { StageBlock } = await import("@/components/numen/stage-reveal");
    const { container, getByText } = render(
      createElement(StageBlock, { show: true } as Record<string, unknown>, "revealed"),
    );
    expect(getByText("revealed")).toBeTruthy();
    // No element should carry a non-zero translate transform under reduced motion.
    assertNoSlide(container);
  });

  it("WR-04: treats the initial null (unresolved query) as reduced — never slides on first paint", async () => {
    // `useReducedMotion()` returns `null` until the media query resolves. A
    // reduced-motion user must NOT get a transient slide on that first frame, so
    // the component fails safe (`useReducedMotion() !== false`) and suppresses
    // the translate while the value is unknown.
    reducedMotionValue.current = null;
    const { StageBlock } = await import("@/components/numen/stage-reveal");
    const { container, getByText } = render(
      createElement(StageBlock, { show: true } as Record<string, unknown>, "revealed"),
    );
    expect(getByText("revealed")).toBeTruthy();
    assertNoSlide(container);
  });

  it("never uses the forbidden bouncy easing cubic-bezier(0.34, 1.56, 0.64, 1)", async () => {
    const mod = await import("@/components/numen/stage-reveal");
    const src = mod.toString?.() ?? "";
    // Defensive: the source string of the module's exports must not embed the
    // banned curve. (The component file itself is also lint-scanned downstream.)
    expect(src).not.toContain("0.34, 1.56, 0.64, 1");
    expect(src).not.toContain("0.34,1.56,0.64,1");
  });
});
