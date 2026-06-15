/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { FeatureBlocks } from "../feature-blocks";

/**
 * STORY-03 Nyquist gate on <FeatureBlocks>, updated in 03-05 for the
 * intentional-skeleton feature visuals (GAP-1/GAP-3 component-level).
 *
 * STORY-03 contract: 3–4 alternating feature blocks, each pairing a benefit
 * headline (level-3 heading) with exactly one framed product skeleton; alternate
 * rows flip column order via the `md:order-*` utility. After 03-05 the visuals
 * are 03-04 skeletons framed in BrowserChrome (no `data-variant`), counted via
 * the stable `data-feature-visual` hook.
 */
describe("<FeatureBlocks /> — STORY-03", () => {
  it("renders 3 to 4 feature blocks (one framed visual per block)", () => {
    const { container } = render(<FeatureBlocks />);

    // Every block pairs a benefit with exactly one framed skeleton visual, so
    // the data-feature-visual count === the block count.
    const slots = container.querySelectorAll("[data-feature-visual]");
    expect(slots.length).toBeGreaterThanOrEqual(3);
    expect(slots.length).toBeLessThanOrEqual(4);
  });

  it("pairs each block's benefit headline (level-3) with its visual", () => {
    const { container } = render(<FeatureBlocks />);

    const slots = container.querySelectorAll("[data-feature-visual]");
    const benefitHeadings = screen.getAllByRole("heading", { level: 3 });
    // One benefit headline per block, matching the visual count.
    expect(benefitHeadings.length).toBe(slots.length);
  });

  it("each block visual sits in an aspect-stable box (no-CLS)", () => {
    const { container } = render(<FeatureBlocks />);

    const slots = container.querySelectorAll("[data-feature-visual]");
    expect(slots.length).toBeGreaterThanOrEqual(3);
    // Success Criterion 4: every block visual wrapper reserves an aspect-locked
    // box (an `aspect-*` class OR an inline aspectRatio) so the skeleton mount
    // introduces no layout shift.
    slots.forEach((slot) => {
      const el = slot as HTMLElement;
      const hasAspectClass = /\baspect-/.test(el.className);
      const hasInlineAspect = el.style.aspectRatio.length > 0;
      expect(hasAspectClass || hasInlineAspect).toBe(true);
    });
  });

  it("applies the alternating md:order-* flip to alternate rows", () => {
    const { container } = render(<FeatureBlocks />);

    // The even/odd flip is implemented via the `md:order-*` order-swap utility
    // (cn(flip && "md:order-2") / cn(flip && "md:order-1")). Assert at least
    // one element carries the flip utility.
    const flipped = container.querySelectorAll('[class*="md:order-"]');
    expect(flipped.length).toBeGreaterThanOrEqual(1);
  });
});
