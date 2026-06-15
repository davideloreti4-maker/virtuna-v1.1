/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { Hero } from "../hero";
import { SIGNUP_URL } from "@/lib/routes";

/**
 * Phase 2 Wave-0 Nyquist scaffold — HERO-01 + HERO-02.
 *
 * RED-by-design: `../hero` does not exist yet (built in 02-01). This file
 * encodes the acceptance criteria as executable assertions so the
 * implementation task has a concrete <automated> gate to turn GREEN.
 *
 * Resilience rule (02-00-PLAN <action>): the H1 is matched VERBATIM (D-09
 * LOCKED), but subcopy / scroll-cue are matched by stable tokens so copy
 * tightening within D-11/D-12 intent does not break the gate.
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
      // (D-23 carried). Planner-flexible wording → assert the noun, not the
      // full sentence. Accept the noun or its verb form.
      const noun = screen.getByText(/simulat(?:es|ion|e)/i);
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
});
