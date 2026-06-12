/** @vitest-environment happy-dom */
/**
 * reading-gallery.test.tsx — Wave-0 Nyquist scaffold for GALLERY-01 / GALLERY-02.
 *
 * RED until Plan 03-03 ships `@/components/numen-landing/reading-gallery`.
 * Encodes the UI-SPEC §2 gallery contract:
 *  - GALLERY-01: at least three Reading cards, each with a real image carrying a
 *    non-empty `alt` (specificity across creator niches, accessible).
 *  - GALLERY-02: the verdicts span the full RANGE — good / mixed / bad — not an
 *    all-good highlight reel. Asserted via the three verdict band tokens
 *    (`bg-verdict-good`, `bg-verdict-mixed`, `bg-verdict-bad`) in the markup.
 *
 * Component imported dynamically so the file is RED on the missing module now.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

describe("ReadingGallery — GALLERY-01/02 ≥3 cards, alts, verdict range (RED until Plan 03-03)", () => {
  it("renders at least three images, each with a non-empty alt (GALLERY-01)", async () => {
    const { ReadingGallery } = await import(
      "@/components/numen-landing/reading-gallery"
    );
    const { getAllByRole } = render(<ReadingGallery />);
    const imgs = getAllByRole("img");
    expect(imgs.length).toBeGreaterThanOrEqual(3);
    for (const img of imgs) {
      expect((img.getAttribute("alt") ?? "").trim().length).toBeGreaterThan(0);
    }
  });

  it("spans the full verdict RANGE — good / mixed / bad band tokens present (GALLERY-02)", async () => {
    const { ReadingGallery } = await import(
      "@/components/numen-landing/reading-gallery"
    );
    const html = render(<ReadingGallery />).container.innerHTML;
    expect(html).toContain("bg-verdict-good");
    expect(html).toContain("bg-verdict-mixed");
    expect(html).toContain("bg-verdict-bad");
  });
});
