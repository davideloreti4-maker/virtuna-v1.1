/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { FeatureBlocks } from "../feature-blocks";

/**
 * Phase 3 Wave-0 Nyquist gate — STORY-03 on the (not-yet-built)
 * <FeatureBlocks>.
 *
 * RED BY DESIGN: the `../feature-blocks` module does not exist yet (built in
 * 03-03). Module-not-found is the Wave-0 success signal. This suite turns
 * GREEN in 03-03.
 *
 * STORY-03 contract: 3–4 alternating feature blocks, each pairing a benefit
 * headline (level-3 heading) with exactly one <Placeholder> visual; alternate
 * rows flip column order via the `md:order-*` utility.
 */
describe("<FeatureBlocks /> — STORY-03", () => {
  it("renders 3 to 4 feature blocks (one Placeholder per block)", () => {
    const { container } = render(<FeatureBlocks />);

    // Every block pairs a benefit with exactly one Placeholder, so the
    // Placeholder count === the block count.
    const slots = container.querySelectorAll("[data-variant]");
    expect(slots.length).toBeGreaterThanOrEqual(3);
    expect(slots.length).toBeLessThanOrEqual(4);
  });

  it("pairs each block's benefit headline (level-3) with its Placeholder", () => {
    const { container } = render(<FeatureBlocks />);

    const slots = container.querySelectorAll("[data-variant]");
    const benefitHeadings = screen.getAllByRole("heading", { level: 3 });
    // One benefit headline per block, matching the Placeholder count.
    expect(benefitHeadings.length).toBe(slots.length);
  });

  it("each block visual is a <Placeholder> with an inline aspect-ratio (no-CLS)", () => {
    const { container } = render(<FeatureBlocks />);

    const slots = container.querySelectorAll("[data-variant]");
    expect(slots.length).toBeGreaterThanOrEqual(3);
    // Success Criterion 4: no-CLS inline aspect-ratio on every block visual.
    slots.forEach((slot) => {
      expect((slot as HTMLElement).style.aspectRatio.length).toBeGreaterThan(0);
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
