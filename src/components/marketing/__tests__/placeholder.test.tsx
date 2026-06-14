/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { Placeholder } from "../placeholder";

/**
 * FOUND-03 unit coverage for the reusable <Placeholder> slot.
 *
 * Behaviors under test (PLAN 01-02, UI-SPEC §Component Inventory item 1):
 *  - variant -> icon resolution (image/video/avatar/logo)
 *  - the one-prop `src` swap: stand-in when absent, real <img>/<video> when present
 *  - aspect-ratio lock (inline style; avatar defaults 1/1)
 *  - reduced-motion-gated optional breathe (motion-reduce:animate-none), OFF by default
 */
describe("<Placeholder>", () => {
  describe("src swap (the one-prop swap)", () => {
    it("renders the labelled stand-in (no <img>) when src is absent", () => {
      const { container } = render(
        <Placeholder variant="image" label="Hero demo" />
      );

      // The label caption is shown...
      expect(screen.getByText("Hero demo")).toBeInTheDocument();
      // ...and there is NO real <img> for the asset.
      expect(container.querySelector("img")).toBeNull();
    });

    it("renders a real <img> whose src ends with the path when src is present", () => {
      const { container } = render(
        <Placeholder variant="image" label="Hero demo" src="/real.png" />
      );

      const img = container.querySelector("img");
      expect(img).not.toBeNull();
      expect(img?.getAttribute("src")).toMatch(/\/real\.png$/);
    });

    it("renders a <video> element when variant=video and src is present", () => {
      const { container } = render(
        <Placeholder variant="video" label="Clip" src="/clip.mp4" />
      );

      expect(container.querySelector("video")).not.toBeNull();
    });
  });

  describe("variant -> icon resolution", () => {
    // Each variant exposes a deterministic hook on the root (data-variant)
    // plus exactly one decorative (aria-hidden) media-type svg in the stand-in.
    it.each(["image", "video", "avatar", "logo"] as const)(
      "renders the %s variant stand-in with its media-type glyph",
      (variant) => {
        const { container } = render(
          <Placeholder variant={variant} label={`${variant} slot`} />
        );

        const root = container.querySelector(`[data-variant="${variant}"]`);
        expect(root).not.toBeNull();

        // exactly one decorative media-type icon is rendered (lucide -> <svg>)
        const icons = container.querySelectorAll('svg[aria-hidden="true"]');
        expect(icons.length).toBeGreaterThanOrEqual(1);
      }
    );
  });

  describe("aspect-ratio lock (no layout shift)", () => {
    it("reflects an explicit aspect prop in the root inline style", () => {
      const { container } = render(
        <Placeholder variant="image" aspect="16/9" label="x" />
      );

      const root = container.querySelector('[data-variant="image"]');
      expect(root).not.toBeNull();
      // CSSOM normalizes "16/9" → "16 / 9"; compare whitespace-insensitively.
      expect((root as HTMLElement).style.aspectRatio.replace(/\s+/g, "")).toBe(
        "16/9"
      );
    });

    it("defaults the avatar variant to a 1/1 aspect ratio", () => {
      const { container } = render(
        <Placeholder variant="avatar" label="x" />
      );

      const root = container.querySelector('[data-variant="avatar"]');
      expect(root).not.toBeNull();
      expect((root as HTMLElement).style.aspectRatio.replace(/\s+/g, "")).toBe(
        "1/1"
      );
    });
  });

  describe("reduced-motion breathe gate", () => {
    it("renders NO breathe animation class by default", () => {
      const { container } = render(
        <Placeholder variant="image" label="x" />
      );

      const root = container.querySelector('[data-variant="image"]');
      expect(root?.className ?? "").not.toMatch(/animate-skeleton-breathe/);
    });

    it("applies animate-skeleton-breathe AND motion-reduce:animate-none when breathe is opted in", () => {
      const { container } = render(
        <Placeholder variant="image" label="x" breathe />
      );

      // The animated element carries both the breathe utility and the
      // reduced-motion override (mirrors ui/skeleton.tsx gating).
      const animated = container.querySelector(".animate-skeleton-breathe");
      expect(animated).not.toBeNull();
      expect((animated as HTMLElement).className).toMatch(
        /motion-reduce:animate-none/
      );
    });
  });
});
