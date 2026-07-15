/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { Hero } from "../hero";
import { SIGNUP_URL } from "@/lib/routes";

/**
 * Phase 2 Nyquist gate — HERO-01..04 on the RSC <Hero>.
 *
 * HERO-01/02 = the headline/subcopy/CTA cluster. HERO-03/04 = the product-shot
 * showcase (desktop Simulation window + the phone in front of it) that REPLACED
 * the retired canvas "crowd → score" moment after live craft review. Both screens
 * now hold REAL captures of the running app — the skeleton set-dressing they held
 * before could only ever look like a template, which is exactly how it read in
 * UAT. These tests therefore assert the captures by their accessible names.
 *
 * Resilience rule (02-00-PLAN <action>): the H1 is matched VERBATIM (D-09
 * LOCKED), but subcopy / scroll-cue / slot labels are matched by stable tokens
 * so copy tightening within intent does not break the gate.
 */
describe("<Hero />", () => {
  describe("HERO-01 — hybrid-voice headline + subcopy", () => {
    it("renders the locked H1 verbatim (D-09)", () => {
      render(<Hero />);

      const h1 = screen.getByRole("heading", { level: 1 });
      // D-09: LOCKED verbatim — already the page <title>/meta.
      expect(h1.textContent?.trim()).toBe("Know if it'll pop before you post");
    });

    it("renders the H1 in the serif voice (D-10 — --font-serif utility)", () => {
      render(<Hero />);

      const h1 = screen.getByRole("heading", { level: 1 });
      // D-10: the full headline is Newsreader serif; the serif/sans contrast
      // IS the hybrid voice. Assert the serif token utility, not a hex.
      expect(h1.className).toMatch(/font-serif/);
    });

    it("renders a non-empty Inter subcopy naming the product noun (D-11)", () => {
      render(<Hero />);

      // D-11: one tight Inter mechanism line. Product noun = "Simulation"
      // (D-23 carried). Planner-flexible wording → assert the verb form
      // "simulates" that the subcopy uses. Scoped to the verb (not the bare
      // /simulat/i stem) so it does NOT collide with the desktop showcase
      // slot label "Maven Simulation" (WR-01) — the subcopy stays the unique
      // /simulates/i node.
      const noun = screen.getByText(/simulates/i);
      expect(noun).toBeTruthy();
      expect(noun.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    });
  });

  describe("HERO-02 — CTA routing", () => {
    it("primary 'Try it free' CTA links to SIGNUP_URL", () => {
      render(<Hero />);

      // Imported constant, NOT the literal "/signup" (single source of truth).
      const cta = screen.getByRole("link", { name: /try it free/i });
      expect(cta.getAttribute("href")).toBe(SIGNUP_URL);
    });

    it("secondary scroll-cue links to the #how-it-works anchor", () => {
      render(<Hero />);

      // D-12: subtle "See how it works ↓" scroll-cue → existing anchor.
      const scrollCue = screen.getByRole("link", { name: /how it works/i });
      expect(scrollCue.getAttribute("href")).toBe("#how-it-works");
    });
  });

  describe("HERO-03/04 — product-shot showcase (output + input)", () => {
    it("fills the desktop window with a real capture of a reading (the OUTPUT)", () => {
      render(<Hero />);

      // The fold shows the product itself: a reading in the app (score +
      // watch-through + where it drops). Matched on the score, the one fact the
      // capture must always carry — copy around it can be re-tightened.
      const shot = screen.getByRole("img", { name: /virality score/i });
      expect(shot.getAttribute("src")).toBeTruthy();
    });

    it("fills the phone with a real capture of the app on mobile (the INPUT)", () => {
      render(<Hero />);

      // The phone in front = Maven on a phone, not a faux video placeholder.
      const phone = screen.getByRole("img", { name: /phone/i });
      expect(phone.getAttribute("src")).toBeTruthy();
    });

    it("reserves an aspect-locked box for each capture (no-CLS)", () => {
      const { container } = render(<Hero />);

      // Both captures render with next/image `fill`, so their wrappers must
      // reserve the box before the image decodes — otherwise the fold reflows.
      const images = container.querySelectorAll("img");
      expect(images.length).toBe(2);
      images.forEach((img) => {
        const box = img.parentElement as HTMLElement;
        expect(/\baspect-\[/.test(box.className)).toBe(true);
      });
    });

    it("frames the reading in a labelled browser window", () => {
      render(<Hero />);

      // Browser chrome address pill — signals "the product" at a glance.
      expect(screen.getByText(/maven\.app/i)).toBeTruthy();
    });
  });
});
