/**
 * A1 — buildFlashWeighting (the audience.persona_weights → FlashWeighting bridge).
 *
 * Proves the gate-safety contract:
 *   - General / null / no-override audience → undefined (→ aggregateFlash flat path → the
 *     byte-identical regression gate),
 *   - calibrated audience → a weighting whose `weights` mirror the pre-baked persona_weights
 *     and whose `slotOf` maps the real registry archetypes to their bucket key (niche_deep →
 *     `niche`), unknown archetypes → null (the flat-fallback path in aggregateFlash).
 */
import { describe, it, expect } from "vitest";
import { buildFlashWeighting } from "../persona-weighting";
import type { Audience } from "@/lib/audience/audience-types";

const DEFAULT_MIX = { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 };

const generalAudience: Audience = {
  id: "general",
  user_id: "__virtual__",
  name: "General",
  type: "personal",
  platform: "tiktok",
  goal_label: null,
  goal_intent: null,
  is_general: true,
  mode: "general",
  is_preset: false,
  persona_weights: { ...DEFAULT_MIX },
  personas: [],
  profile: null,
  calibration: null,
  created_at: "2026-06-19T00:00:00.000Z",
  updated_at: "2026-06-19T00:00:00.000Z",
};

const calibratedAudience: Audience = {
  ...generalAudience,
  id: "aud-calibrated",
  name: "Skincare Buyers",
  type: "target",
  goal_intent: "sell",
  is_general: false,
  mode: "socials",
  // non-default, already sums to 1.0 → resolver normalizes to the same values
  persona_weights: { fyp: 0.4, niche: 0.4, loyalist: 0.15, cross_niche: 0.05 },
};

describe("buildFlashWeighting — gate-safety (undefined = flat = byte-identical)", () => {
  it("null audience → undefined", () => {
    expect(buildFlashWeighting(null)).toBeUndefined();
  });

  it("undefined audience → undefined", () => {
    expect(buildFlashWeighting(undefined)).toBeUndefined();
  });

  it("General audience → undefined (never weights the gate)", () => {
    expect(buildFlashWeighting(generalAudience)).toBeUndefined();
  });
});

describe("buildFlashWeighting — calibrated audience produces a weighting", () => {
  it("returns a weighting (not undefined) for a calibrated audience", () => {
    expect(buildFlashWeighting(calibratedAudience)).toBeDefined();
  });

  it("weights mirror the pre-baked persona_weights (fyp/niche/loyalist/cross_niche)", () => {
    const w = buildFlashWeighting(calibratedAudience)!;
    expect(w.weights.fyp).toBeCloseTo(0.4, 6);
    expect(w.weights.niche).toBeCloseTo(0.4, 6);
    expect(w.weights.loyalist).toBeCloseTo(0.15, 6);
    expect(w.weights.cross_niche).toBeCloseTo(0.05, 6);
  });

  it("slotOf maps the real registry archetypes to their bucket key", () => {
    const w = buildFlashWeighting(calibratedAudience)!;
    // fyp archetypes
    expect(w.slotOf("tough_crowd")).toBe("fyp");
    expect(w.slotOf("high_engager")).toBe("fyp");
    expect(w.slotOf("purposeful_viewer")).toBe("fyp");
    // niche_deep archetypes → the `niche` weight bucket
    expect(w.slotOf("niche_deep_buyer")).toBe("niche");
    expect(w.slotOf("niche_deep_scout")).toBe("niche");
    // loyalist + cross_niche
    expect(w.slotOf("loyalist")).toBe("loyalist");
    expect(w.slotOf("cross_niche_curiosity")).toBe("cross_niche");
  });

  it("slotOf returns null for an unknown archetype (synthetic/test panels)", () => {
    const w = buildFlashWeighting(calibratedAudience)!;
    expect(w.slotOf("arch_0")).toBeNull();
    expect(w.slotOf("not_a_real_archetype")).toBeNull();
  });
});
