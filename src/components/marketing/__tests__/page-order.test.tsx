/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { NAV_LINKS } from "@/lib/nav";
import HomePage from "@/app/(marketing)/page";

/**
 * Cross-gate for D-18 (final section order) and D-19 (NAV_LINKS locked at 5).
 *
 * Block 1 — NAV-unchanged (D-19):
 *   Asserts NAV_LINKS.length === 5 and that its href set is exactly the locked
 *   5-anchor set. Passes NOW (D-19 holds). Fails RED if Wave 1 / 04-05 ever
 *   introduces a 6th nav entry (#proof/#testimonials/#cta).
 *
 * Block 2 — D-18 section order:
 *   Renders the assembled HomePage (which imports all section components). RED
 *   now (the new sections — SocialProofStrip, Testimonials, FinalCtaBand — are
 *   not yet mounted). Turns GREEN after 04-05 wires them.
 *
 *   Asserts the RELATIVE order of the known section ids / data-section markers:
 *     social-proof → how-it-works → the-simulation → features →
 *     testimonials → pricing → faq → final-cta
 *
 *   These stable ids/markers are the Wave-1 + 04-05 integration contract:
 *     - SocialProofStrip section:   id="social-proof"
 *     - Testimonials section:       id="testimonials"
 *     - FinalCtaBand section:       data-section="final-cta"
 *
 * RED-by-design for Block 2: the new sections are not mounted yet; the section
 * ids above do not exist in the DOM until 04-05 wires them.
 */

/** The locked 5-anchor href set (D-19). Order-tolerant on labels; href-set-exact. */
const LOCKED_HREFS = new Set([
  "#how-it-works",
  "#the-simulation",
  "#features",
  "#pricing",
  "#faq",
]);

describe("NAV_LINKS — D-19 nav lock", () => {
  it("has exactly 5 entries", () => {
    expect(NAV_LINKS.length).toBe(5);
  });

  it("href set matches the locked 5-anchor set exactly", () => {
    const hrefs = new Set(NAV_LINKS.map((l) => l.href));
    expect(hrefs).toEqual(LOCKED_HREFS);
  });
});

/**
 * Section id order constants — these are the integration contract that the
 * Wave-1 components and 04-05 page assembly MUST satisfy.
 */
const ORDERED_SECTION_IDS = [
  "social-proof",    // SocialProofStrip — rides high under #hero (D-01/D-18)
  "how-it-works",   // existing STORY-01 section
  "the-simulation", // existing STORY-02 section
  "features",       // existing STORY-03 section
  "testimonials",   // Testimonials — conversion zone (D-05/D-18)
  "pricing",        // existing stub filled by PricingTeaser (04-05)
  "faq",            // existing stub filled by Faq (04-05)
] as const;

/** The band uses data-section="final-cta" (no max-w id on the outer section). */
const FINAL_CTA_MARKER = "final-cta";

describe("HomePage section order — D-18", () => {
  it("renders sections in the locked D-18 order with stable ids/markers", () => {
    const { container } = render(<HomePage />);

    // Collect all section ids in DOM order.
    const allSections = Array.from(
      container.querySelectorAll("section[id], section[data-section]")
    );
    const ids = allSections.map(
      (el) => el.getAttribute("id") ?? el.getAttribute("data-section") ?? ""
    );

    // Assert relative order of the known ids (not absolute indices, so unrelated
    // DOM changes do not break this check).
    function indexIn(id: string): number {
      return ids.indexOf(id);
    }

    // social-proof must appear before how-it-works
    expect(indexIn("social-proof")).toBeLessThan(indexIn("how-it-works"));

    // how-it-works → the-simulation → features (existing story order preserved)
    expect(indexIn("how-it-works")).toBeLessThan(indexIn("the-simulation"));
    expect(indexIn("the-simulation")).toBeLessThan(indexIn("features"));

    // testimonials after features, before pricing
    expect(indexIn("features")).toBeLessThan(indexIn("testimonials"));
    expect(indexIn("testimonials")).toBeLessThan(indexIn("pricing"));

    // pricing → faq
    expect(indexIn("pricing")).toBeLessThan(indexIn("faq"));

    // final-cta band after faq (and last before footer)
    expect(indexIn("faq")).toBeLessThan(indexIn(FINAL_CTA_MARKER));
  });

  it("all D-18 section ids are present in the DOM", () => {
    const { container } = render(<HomePage />);

    for (const id of ORDERED_SECTION_IDS) {
      const el = container.querySelector(`[id="${id}"]`);
      expect(el, `section #${id} missing from DOM`).not.toBeNull();
    }

    const band = container.querySelector(`[data-section="${FINAL_CTA_MARKER}"]`);
    expect(band, `data-section="${FINAL_CTA_MARKER}" missing from DOM`).not.toBeNull();
  });
});
