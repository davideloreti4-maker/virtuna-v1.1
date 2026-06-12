/** @vitest-environment happy-dom */
/**
 * hero.test.tsx — Wave-0 Nyquist scaffold for HERO-01 / HERO-02 / CTA-01.
 *
 * RED until Wave 1 ships `@/components/numen-landing/hero`. Asserts the hero
 * render contract:
 *  - HERO-01: exactly one <h1>, headline names the value ("land", no number/no "viral").
 *  - HERO-02: a real asset is present (next/image renders an <img> with non-empty alt).
 *  - CTA-01:  a primary CTA <a href="#cta"> labelled "Try Numen" (label locked in
 *             Phase 1 across nav/footer/hero), with the shared focus ring + ≥44px target.
 *
 * NOTE: `motion/react` is intentionally NOT mocked here — that is reading-loop's
 * job (HERO-04). The hero render must stand on its own static markup.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

describe("Hero — HERO-01 / HERO-02 / CTA-01 (RED until Wave 1)", () => {
  it("renders exactly one h1 whose headline names the value (no naked number / no 'viral')", async () => {
    const { Hero } = await import("@/components/numen-landing/hero");
    const { container } = render(<Hero />);
    const h1s = container.querySelectorAll("h1");
    expect(h1s.length).toBe(1);
    // HERO-01: confident, plain-language headline — stable substring "land" (D-08a refinable).
    expect((h1s[0]?.textContent ?? "").toLowerCase()).toContain("land");
    // VOICE Rules 2-3: the hero headline never carries a naked number or "viral".
    expect(container.textContent ?? "").not.toMatch(/\d+\s*\/\s*100|\d+\s*%/);
    expect(container.textContent ?? "").not.toMatch(/\bviral\b/i);
  });

  it("renders the subhead naming the value", async () => {
    const { Hero } = await import("@/components/numen-landing/hero");
    const { container } = render(<Hero />);
    // Subhead present and substantive (mentor register, names the value).
    // Stable substring "verdict" per the VOICE.md subhead example (refinable per D-08a).
    expect((container.textContent ?? "").toLowerCase()).toContain("verdict");
  });

  it("renders a primary CTA anchor labelled 'Try Numen' linking to #cta with focus ring + ≥44px target", async () => {
    const { Hero } = await import("@/components/numen-landing/hero");
    const { getByText } = render(<Hero />);
    const cta = getByText("Try Numen");
    // The label must sit on (or inside) an anchor pointing at #cta.
    const anchor = cta.closest("a");
    expect(anchor).toBeTruthy();
    expect(anchor?.getAttribute("href")).toBe("#cta");
    // CTA-01: shared focus-visible ring token + a min-44px touch target.
    const cls = anchor?.className ?? "";
    expect(cls).toMatch(/focus-visible:ring-accent/);
    expect(cls).toMatch(/h-11|min-h-11|min-h-\[44px\]/);
  });

  it("renders the hero asset as an <img> with non-empty alt (HERO-02 — real Reading artifact)", async () => {
    const { Hero } = await import("@/components/numen-landing/hero");
    const { container } = render(<Hero />);
    // next/image renders an <img>; keep loose (render detail). Real-asset rights
    // check lives in the Plan-02 checkpoint, not here.
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect((img?.getAttribute("alt") ?? "").trim().length).toBeGreaterThan(0);
  });
});
