/**
 * Tests for who-not-for.ts — deriveWhoNotFor pure derivation (Plan 08-05 Task 1).
 *
 * TDD RED phase: written against the spec (08-05-PLAN.md Task 1 <behavior>)
 * before who-not-for.ts exists.
 *
 * D-10 honesty spine: the "scrolls past" segment is derived PURELY from the
 * already-emitted persona dispositions — NO model call, NO fabrication. Low-
 * disposition (cold scroll-prone) personas yield a non-empty segment; an all-hot
 * panel yields an empty segment (no honest who-not-for to show).
 */
import { describe, it, expect } from "vitest";
import { deriveWhoNotFor } from "../who-not-for";
import type { CalibratedPersona, Disposition, Temperature } from "@/lib/audience/audience-types";
import type { Archetype } from "@/lib/engine/wave3/persona-registry";

// Helper: build a CalibratedPersona with a given disposition (temperature inferred for the test).
function persona(
  archetype: Archetype,
  disposition: Disposition,
  temperature: Temperature,
): CalibratedPersona {
  return {
    archetype,
    repaint: `repaint for ${archetype}`,
    temperature,
    disposition,
    share: 0.1,
  };
}

describe("deriveWhoNotFor — low-disposition scrolls-past segment (D-10)", () => {
  it("low-disposition (skeptic/lurker/scanner) personas yield a non-empty segment", () => {
    const personas: CalibratedPersona[] = [
      persona("tough_crowd", "skeptic", "cold"),
      persona("lurker", "lurker", "cold"),
      persona("niche_deep_buyer", "converter", "hot"),
      persona("loyalist", "connector", "hot"),
    ];

    const segment = deriveWhoNotFor(personas);

    expect(typeof segment).toBe("string");
    expect(segment.length).toBeGreaterThan(0);
    // Names a real scroll-prone disposition, not a fabricated label.
    expect(segment.toLowerCase()).toMatch(/skeptic|lurker|scanner/);
  });

  it("all-hot personas yield an empty/none segment (no honest who-not-for)", () => {
    const personas: CalibratedPersona[] = [
      persona("niche_deep_buyer", "converter", "hot"),
      persona("loyalist", "connector", "hot"),
      persona("high_engager", "connector", "warm"),
      persona("saver", "collector", "warm"),
    ];

    const segment = deriveWhoNotFor(personas);

    expect(segment).toBe("");
  });

  it("is pure — same input yields the same output", () => {
    const personas: CalibratedPersona[] = [
      persona("tough_crowd", "skeptic", "cold"),
      persona("cross_niche_curiosity", "scanner", "cold"),
    ];

    expect(deriveWhoNotFor(personas)).toBe(deriveWhoNotFor(personas));
  });

  it("empty input yields an empty segment (no personas → nothing to derive)", () => {
    expect(deriveWhoNotFor([])).toBe("");
  });
});
