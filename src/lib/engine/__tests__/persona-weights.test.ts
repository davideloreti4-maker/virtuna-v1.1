/**
 * Phase 3 Plan 04 — persona weight precedence resolver tests (D-20).
 *
 * Pure unit tests — no mocks required.
 * All 8 cases activated from Wave 0 it.skip stubs.
 */
import { describe, it, expect } from "vitest";

import {
  resolveWeights,
  normalizeWeights,
  DEFAULT_PERSONA_WEIGHT_CONFIG,
  type PersonaWeights,
  type PersonaWeightConfig,
} from "../persona-weights";

// =====================================================
// Fixtures
// =====================================================

const ANALYSIS_WEIGHTS: PersonaWeights = {
  fyp: 0.5,
  niche: 0.3,
  loyalist: 0.15,
  cross_niche: 0.05,
};

const CREATOR_WEIGHTS: PersonaWeights = {
  fyp: 0.6,
  niche: 0.25,
  loyalist: 0.1,
  cross_niche: 0.05,
};

const NICHE_WEIGHTS: PersonaWeights = {
  fyp: 0.4,
  niche: 0.4,
  loyalist: 0.1,
  cross_niche: 0.1,
};

const CONFIG_WITH_ALL_OVERRIDES: PersonaWeightConfig = {
  default: DEFAULT_PERSONA_WEIGHT_CONFIG.default,
  niche_overrides: { "gaming": NICHE_WEIGHTS },
  creator_overrides: { "creator-123": CREATOR_WEIGHTS },
};

// =====================================================
// Tests
// =====================================================

describe("persona-weights precedence resolver (Wave 0 stub)", () => {
  it("returns default when no overrides", () => {
    const { weights, source } = resolveWeights(
      DEFAULT_PERSONA_WEIGHT_CONFIG,
      {},
    );
    expect(source).toBe("default");
    expect(weights.fyp).toBeCloseTo(0.65, 5);
    expect(weights.niche).toBeCloseTo(0.20, 5);
    expect(weights.loyalist).toBeCloseTo(0.10, 5);
    expect(weights.cross_niche).toBeCloseTo(0.05, 5);
  });

  it("analysis_override wins over creator_override", () => {
    const { weights, source } = resolveWeights(CONFIG_WITH_ALL_OVERRIDES, {
      analysis_override: ANALYSIS_WEIGHTS,
      creator_id: "creator-123",
    });
    expect(source).toBe("analysis_override");
    // Normalized ANALYSIS_WEIGHTS sum = 1.0 already, so same values
    const sum =
      weights.fyp + weights.niche + weights.loyalist + weights.cross_niche;
    expect(sum).toBeCloseTo(1.0, 3);
    // The resolved weights originate from ANALYSIS_WEIGHTS values
    expect(weights.fyp).toBeGreaterThan(weights.niche);
  });

  it("creator_override wins over niche_override", () => {
    const { weights, source } = resolveWeights(CONFIG_WITH_ALL_OVERRIDES, {
      creator_id: "creator-123",
      niche: "gaming",
    });
    expect(source).toBe("creator_override");
    // creator weights: fyp=0.6 > niche weights: fyp=0.4
    const sum =
      weights.fyp + weights.niche + weights.loyalist + weights.cross_niche;
    expect(sum).toBeCloseTo(1.0, 3);
  });

  it("niche_override wins over default", () => {
    const { weights, source } = resolveWeights(CONFIG_WITH_ALL_OVERRIDES, {
      niche: "gaming",
    });
    expect(source).toBe("niche_override");
    const sum =
      weights.fyp + weights.niche + weights.loyalist + weights.cross_niche;
    expect(sum).toBeCloseTo(1.0, 3);
    // niche weights have fyp=0.4 (vs default 0.65) — confirms niche was used
    expect(weights.fyp).toBeCloseTo(0.4, 3);
  });

  it("weights_source matches resolved tier ('default' | 'niche_override' | 'creator_override' | 'analysis_override')", () => {
    // Full precedence chain: set all four, expect analysis to win
    const { source: s1 } = resolveWeights(CONFIG_WITH_ALL_OVERRIDES, {
      analysis_override: ANALYSIS_WEIGHTS,
      creator_id: "creator-123",
      niche: "gaming",
    });
    expect(s1).toBe("analysis_override");

    const { source: s2 } = resolveWeights(CONFIG_WITH_ALL_OVERRIDES, {
      creator_id: "creator-123",
      niche: "gaming",
    });
    expect(s2).toBe("creator_override");

    const { source: s3 } = resolveWeights(CONFIG_WITH_ALL_OVERRIDES, {
      niche: "gaming",
    });
    expect(s3).toBe("niche_override");

    const { source: s4 } = resolveWeights(DEFAULT_PERSONA_WEIGHT_CONFIG, {});
    expect(s4).toBe("default");
  });

  it("normalizeWeights: values sum to 1.0 ± 0.001", () => {
    const out = normalizeWeights({
      fyp: 1,
      niche: 1,
      loyalist: 1,
      cross_niche: 1,
    });
    const sum = out.fyp + out.niche + out.loyalist + out.cross_niche;
    expect(sum).toBeCloseTo(1.0, 3);
    // All equal → each ≈ 0.25
    expect(out.fyp).toBeCloseTo(0.25, 3);
  });

  it("normalizeWeights: missing cross_niche slot redistributes correctly (Pitfall 6)", () => {
    const out = normalizeWeights({
      fyp: 0.65,
      niche: 0.20,
      loyalist: 0.10,
      cross_niche: 0,
    });
    const sum = out.fyp + out.niche + out.loyalist + out.cross_niche;
    expect(sum).toBeCloseTo(1.0, 3);
    expect(out.cross_niche).toBe(0); // stays 0 — no redistribution to zero key
  });

  it("normalizeWeights: all-zero input returns default weights", () => {
    const out = normalizeWeights({
      fyp: 0,
      niche: 0,
      loyalist: 0,
      cross_niche: 0,
    });
    expect(out).toEqual(DEFAULT_PERSONA_WEIGHT_CONFIG.default);
  });
});
