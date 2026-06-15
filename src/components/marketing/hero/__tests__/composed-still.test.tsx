/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ComposedStill } from "../composed-still";

/**
 * Phase 2 Wave-0 Nyquist scaffold — HERO-03 (resolved arc-ring instrument) +
 * HERO-04 (accessible, no-CLS still frame).
 *
 * RED-by-design: `../composed-still` does not exist yet (built in 02-03).
 *
 * The ComposedStill is the UNIVERSAL FLOOR (D-15): reduced-motion == rest ==
 * pre-hydration == mobile == low-GPU all converge on this crisp resolved frame.
 * It must paint pre-hydration with zero JS, so it is pure DOM + SVG (no canvas).
 *
 * Geometry per 02-RESEARCH §"Re-derived clean SVG arc ring":
 *   SIZE = 240, STROKE = 12, radius = (240 - 12) / 2 = 114
 *   circumference = 2 * PI * radius
 *   strokeDashoffset = circumference - (score / 100) * circumference
 */

const SCORE = 87;
const SIZE = 240;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2; // 114
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const EXPECTED_OFFSET = CIRCUMFERENCE - (SCORE / 100) * CIRCUMFERENCE;

describe("<ComposedStill />", () => {
  describe("HERO-03 — resolved arc-ring + score number", () => {
    it("renders an <svg> with at least two <circle>s (track + progress)", () => {
      const { container } = render(<ComposedStill score={SCORE} />);

      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();

      const circles = svg!.querySelectorAll("circle");
      expect(circles.length).toBeGreaterThanOrEqual(2);
    });

    it("maps the progress arc strokeDashoffset to score=87 (within 1px)", () => {
      const { container } = render(<ComposedStill score={SCORE} />);

      // The progress circle is the one carrying a non-zero stroke-dasharray.
      const circles = Array.from(
        container.querySelectorAll<SVGCircleElement>("svg circle")
      );
      const progress = circles.find((c) => {
        const dash = c.getAttribute("stroke-dasharray");
        return dash != null && parseFloat(dash) > 0;
      });
      expect(progress, "a progress circle with a stroke-dasharray").toBeDefined();

      const offsetAttr = progress!.getAttribute("stroke-dashoffset");
      expect(offsetAttr).not.toBeNull();
      const renderedOffset = parseFloat(offsetAttr!);
      // Geometry must encode the score, not be hardcoded full/empty.
      expect(Math.abs(renderedOffset - EXPECTED_OFFSET)).toBeLessThanOrEqual(1);
    });

    it("draws the progress stroke from the coral accent token (not a hardcoded hex, not white)", () => {
      const { container } = render(<ComposedStill score={SCORE} />);

      const circles = Array.from(
        container.querySelectorAll<SVGCircleElement>("svg circle")
      );
      const progress = circles.find((c) => {
        const dash = c.getAttribute("stroke-dasharray");
        return dash != null && parseFloat(dash) > 0;
      });
      expect(progress).toBeDefined();
      // Token rule (UI-SPEC §Color): coral is the lone accent, referenced by token.
      expect(progress!.getAttribute("stroke")).toBe("var(--color-accent)");
    });

    it("renders the score number as text", () => {
      render(<ComposedStill score={SCORE} />);

      // The resolved virality number is visible in the ring center.
      expect(screen.getByText("87")).toBeInTheDocument();
    });
  });

  describe("HERO-04 — accessible, no-CLS still frame", () => {
    it("exposes role=img with an aria-label announcing the score", () => {
      render(<ComposedStill score={SCORE} />);

      // Decorative-with-meaning: the stage is role=img and the score is
      // announced in its accessible name (UI-SPEC §Accessibility text).
      const figure = screen.getByRole("img");
      expect(figure.getAttribute("aria-label")).toMatch(/87/);
    });

    it("dimension-locks the stage box (aspect-ratio or fixed height → no CLS)", () => {
      const { container } = render(<ComposedStill score={SCORE} />);

      // No CLS: the still must occupy the same fixed box the canvas mounts into
      // (UI-SPEC §A11y/Perf). Assert SOME element declares an inline aspect-ratio
      // (the established Placeholder no-CLS convention) or a fixed inline height.
      const styled = Array.from(
        container.querySelectorAll<HTMLElement>("[style]")
      );
      const locked = styled.some((el) => {
        const style = el.getAttribute("style") ?? "";
        return /aspect-ratio/i.test(style) || /height\s*:/i.test(style);
      });
      expect(
        locked,
        "an inline aspect-ratio or fixed height on the stage box"
      ).toBe(true);
    });
  });
});
