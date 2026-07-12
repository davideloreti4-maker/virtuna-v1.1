/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  ScoreGaugeSkeleton,
  AudienceCloudSkeleton,
  DriverRowsSkeleton,
  RetentionCurveSkeleton,
  PhoneVideoSkeleton,
  BrowserChrome,
  PhoneChrome,
} from "../skeletons";

/**
 * Nyquist structure gate for the static-SVG product-skeleton primitives
 * (03-04 Task 1 / GAP-1, GAP-2). These assert the SHAPE contract — the
 * canonical numen-rework reading IA depicted inside SVG/markup — not pixels.
 *
 * The primitives are pure RSC set-dressing: static SVG shape hints, no real
 * data, no engine wiring, flat-warm tokens, zero animation. We assert the
 * structural skeleton (arc/dots/rows/chrome) survives, using
 * `container.querySelectorAll` for counts and `getAllByText(...).length >= 1`
 * where multiplicity is plausible (the WR-04 lesson — avoid brittle single-match
 * getByText that breaks on duplicate tokens).
 */
describe("product-skeleton primitives", () => {
  describe("<ScoreGaugeSkeleton /> — score gauge IA", () => {
    it("renders one <svg> containing an arc (path or circle)", () => {
      const { container } = render(<ScoreGaugeSkeleton />);

      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      const arc = svg?.querySelectorAll("path, circle");
      expect((arc?.length ?? 0)).toBeGreaterThanOrEqual(1);
    });

    it("shows a score number >= 70 (honesty floor) and the band word 'Strong'", () => {
      const { container } = render(<ScoreGaugeSkeleton />);

      // The fixed sample score is 87 (>= BAND_THRESHOLDS.STRONG = 70). Parse
      // the first 2-3 digit run and assert it clears the honesty floor — a
      // \b-anchored regex breaks when the number abuts the band word
      // ("87Strong"), so read the value instead of pattern-matching boundaries.
      const scoreMatch = (container.textContent ?? "").match(/(\d{2,3})/);
      expect(scoreMatch).not.toBeNull();
      expect(Number(scoreMatch?.[1])).toBeGreaterThanOrEqual(70);
      expect(screen.getAllByText(/strong/i).length).toBeGreaterThanOrEqual(1);
    });

    it("is a labelled image (role=img + aria-label)", () => {
      render(<ScoreGaugeSkeleton />);
      const img = screen.getByRole("img");
      expect(img.getAttribute("aria-label")).toMatch(/score/i);
    });
  });

  describe("<AudienceCloudSkeleton /> — persona cloud IA", () => {
    it("renders one <svg> with >= 6 <circle> dots", () => {
      const { container } = render(<AudienceCloudSkeleton />);

      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      const dots = svg?.querySelectorAll("circle");
      expect((dots?.length ?? 0)).toBeGreaterThanOrEqual(6);
    });

    it("renders a watch-through caption containing '%'", () => {
      const { container } = render(<AudienceCloudSkeleton />);
      expect(container.textContent ?? "").toContain("%");
    });

    it("is a labelled image (role=img + aria-label)", () => {
      render(<AudienceCloudSkeleton />);
      const img = screen.getByRole("img");
      expect(img.getAttribute("aria-label")).toMatch(/audience/i);
    });
  });

  describe("<DriverRowsSkeleton /> — three driver rows IA", () => {
    it("renders Hook, Retention and Shareability labels in fixed order", () => {
      const { container } = render(<DriverRowsSkeleton />);

      const text = container.textContent ?? "";
      const hookAt = text.indexOf("Hook");
      const retentionAt = text.indexOf("Retention");
      const shareAt = text.indexOf("Shareability");

      expect(hookAt).toBeGreaterThanOrEqual(0);
      expect(retentionAt).toBeGreaterThan(hookAt);
      expect(shareAt).toBeGreaterThan(retentionAt);
    });

    it("carries a drop timestamp on the Retention row (matches /\\d:\\d{2}/)", () => {
      const { container } = render(<DriverRowsSkeleton />);
      expect(container.textContent ?? "").toMatch(/\d:\d{2}/);
    });

    it("renders three bar elements (one per driver row)", () => {
      const { container } = render(<DriverRowsSkeleton />);
      const bars = container.querySelectorAll("[data-bar]");
      expect(bars.length).toBe(3);
    });

    it("is a labelled image (role=img + aria-label)", () => {
      render(<DriverRowsSkeleton />);
      const img = screen.getByRole("img");
      expect(img.getAttribute("aria-label")).toMatch(/hook/i);
    });
  });

  describe("<RetentionCurveSkeleton /> — watch-through curve IA", () => {
    it("renders one <svg> with a decay path", () => {
      const { container } = render(<RetentionCurveSkeleton />);

      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      const paths = svg?.querySelectorAll("path");
      expect((paths?.length ?? 0)).toBeGreaterThanOrEqual(1);
    });

    it("carries a drop timestamp (matches /\\d:\\d{2}/)", () => {
      const { container } = render(<RetentionCurveSkeleton />);
      expect(container.textContent ?? "").toMatch(/\d:\d{2}/);
    });

    it("hides the drop caption when showDropCaption is false (hero dedupe)", () => {
      const { container } = render(
        <RetentionCurveSkeleton showDropCaption={false} />
      );
      // The hero dashboard states "drops at 0:07" in the Retention driver row;
      // the curve drops its duplicate line there but keeps the reach-end stat.
      expect(container.textContent ?? "").not.toMatch(/\d:\d{2}/);
      expect(container.textContent ?? "").toContain("%");
    });

    it("is a labelled image (role=img + aria-label)", () => {
      render(<RetentionCurveSkeleton />);
      const img = screen.getByRole("img");
      expect(img.getAttribute("aria-label")).toMatch(/retention|watch/i);
    });
  });

  describe("<PhoneVideoSkeleton /> — vertical-video input IA", () => {
    it("keeps the 'Your TikTok' slot label as a text node", () => {
      render(<PhoneVideoSkeleton />);
      // The hero gate resolves getByText(/your tiktok/i) — the label must stay
      // real text, not only an aria-label.
      expect(screen.getAllByText(/your tiktok/i).length).toBeGreaterThanOrEqual(1);
    });

    it("is a labelled image with an aspect-locked 9/16 screen", () => {
      const { container } = render(<PhoneVideoSkeleton />);
      const img = screen.getByRole("img");
      expect(img.getAttribute("aria-label")).toMatch(/tiktok/i);
      // The screen reserves its vertical box (no-CLS when a real capture
      // swaps in via the slot later).
      expect(/\baspect-/.test((container.firstElementChild as HTMLElement).className)).toBe(true);
    });
  });

  describe("<AudienceCloudSkeleton showCaption={false} /> — quiet echo mode", () => {
    it("hides the watch-through caption for the final CTA echo", () => {
      const { container } = render(<AudienceCloudSkeleton showCaption={false} />);
      expect(container.textContent ?? "").not.toContain("%");
      // the dots survive — only the metric line goes quiet
      expect(container.querySelectorAll("circle").length).toBeGreaterThanOrEqual(6);
    });
  });

  describe("<BrowserChrome /> + <PhoneChrome /> — device chrome", () => {
    it("BrowserChrome renders the maven.app pill and its children", () => {
      const { container } = render(
        <BrowserChrome>
          <div data-testid="window-body">body</div>
        </BrowserChrome>
      );

      expect(screen.getAllByText(/maven\.app/i).length).toBeGreaterThanOrEqual(1);
      expect(container.querySelector('[data-testid="window-body"]')).not.toBeNull();
    });

    it("PhoneChrome renders its children inside a bezel", () => {
      const { container } = render(
        <PhoneChrome>
          <div data-testid="phone-screen">screen</div>
        </PhoneChrome>
      );

      expect(container.querySelector('[data-testid="phone-screen"]')).not.toBeNull();
    });
  });
});
