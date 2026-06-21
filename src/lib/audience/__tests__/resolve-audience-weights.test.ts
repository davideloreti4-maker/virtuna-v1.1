/**
 * Phase 7 Plan 01 — resolveAudienceWeights tests (D-04 / Pitfall 5 / AUD-03).
 *
 * RED phase: these tests will fail until resolve-audience-weights.ts is implemented.
 *
 * Assertions:
 *  - [] → DEFAULT mix, source 'default' (General is gate-protected — no override)
 *  - [generalAudience] (is_general=true) → DEFAULT mix, source 'default'
 *  - [calibratedAudience] → audience.persona_weights via analysis_override, source 'analysis_override'
 *  - [a, b] (multi-select future) → resolves first audience in v1 (array-shaped, single-resolution semantics)
 *  - DEFAULT_PERSONA_WEIGHT_CONFIG is NEVER mutated
 */
import { describe, it, expect } from "vitest";

import { resolveAudienceWeights } from "../resolve-audience-weights";
import {
  DEFAULT_PERSONA_WEIGHT_CONFIG,
  normalizeWeights,
} from "@/lib/engine/persona-weights";
import type { Audience } from "../audience-types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const GENERAL_AUDIENCE: Audience = {
  id: "general-001",
  user_id: "user-001",
  name: "General",
  type: "target",
  platform: "tiktok",
  goal_label: null,
  goal_intent: null,
  is_general: true,
  is_preset: false,
  persona_weights: { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
  personas: [],
  profile: null,
  calibration: null,
  created_at: "2026-06-18T00:00:00Z",
  updated_at: "2026-06-18T00:00:00Z",
};

const CALIBRATED_WEIGHTS = { fyp: 0.30, niche: 0.55, loyalist: 0.10, cross_niche: 0.05 };
const CALIBRATED_AUDIENCE: Audience = {
  id: "cal-001",
  user_id: "user-001",
  name: "Tech Buyers",
  type: "target",
  platform: "tiktok",
  goal_label: "Sell my course",
  goal_intent: "sell",
  is_general: false,
  is_preset: false,
  persona_weights: CALIBRATED_WEIGHTS,
  personas: [],
  profile: null,
  calibration: { source: "description" },
  created_at: "2026-06-18T00:00:00Z",
  updated_at: "2026-06-18T00:00:00Z",
};

const CALIBRATED_AUDIENCE_B: Audience = {
  ...CALIBRATED_AUDIENCE,
  id: "cal-002",
  name: "Grow Audience",
  goal_intent: "grow",
  persona_weights: { fyp: 0.75, niche: 0.15, loyalist: 0.05, cross_niche: 0.05 },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("resolveAudienceWeights — empty array (General path)", () => {
  it("returns DEFAULT mix when audience array is empty", () => {
    const { weights, source } = resolveAudienceWeights([]);
    expect(source).toBe("default");
    expect(weights.fyp).toBeCloseTo(0.65, 5);
    expect(weights.niche).toBeCloseTo(0.20, 5);
    expect(weights.loyalist).toBeCloseTo(0.10, 5);
    expect(weights.cross_niche).toBeCloseTo(0.05, 5);
  });

  it("weights sum to 1.0 for empty array", () => {
    const { weights } = resolveAudienceWeights([]);
    const sum = weights.fyp + weights.niche + weights.loyalist + weights.cross_niche;
    expect(sum).toBeCloseTo(1.0, 5);
  });
});

describe("resolveAudienceWeights — General audience (is_general=true)", () => {
  it("returns DEFAULT mix for a General audience (is_general=true)", () => {
    const { weights, source } = resolveAudienceWeights([GENERAL_AUDIENCE]);
    expect(source).toBe("default");
    expect(weights.fyp).toBeCloseTo(0.65, 5);
    expect(weights.niche).toBeCloseTo(0.20, 5);
    expect(weights.loyalist).toBeCloseTo(0.10, 5);
    expect(weights.cross_niche).toBeCloseTo(0.05, 5);
  });

  it("General audience NEVER injects an analysis_override (regression gate)", () => {
    const { source } = resolveAudienceWeights([GENERAL_AUDIENCE]);
    // If General injected an override, source would be 'analysis_override'.
    // Must remain 'default' to keep the regression gate free by construction.
    expect(source).toBe("default");
  });
});

describe("resolveAudienceWeights — calibrated audience", () => {
  it("returns analysis_override mix for a calibrated audience", () => {
    const { source } = resolveAudienceWeights([CALIBRATED_AUDIENCE]);
    expect(source).toBe("analysis_override");
  });

  it("resolved weights match the audience persona_weights after normalization", () => {
    const { weights } = resolveAudienceWeights([CALIBRATED_AUDIENCE]);
    const expected = normalizeWeights(CALIBRATED_WEIGHTS);
    expect(weights.fyp).toBeCloseTo(expected.fyp, 5);
    expect(weights.niche).toBeCloseTo(expected.niche, 5);
    expect(weights.loyalist).toBeCloseTo(expected.loyalist, 5);
    expect(weights.cross_niche).toBeCloseTo(expected.cross_niche, 5);
  });

  it("weights sum to 1.0 for a calibrated audience", () => {
    const { weights } = resolveAudienceWeights([CALIBRATED_AUDIENCE]);
    const sum = weights.fyp + weights.niche + weights.loyalist + weights.cross_niche;
    expect(sum).toBeCloseTo(1.0, 5);
  });
});

describe("resolveAudienceWeights — multi-select (array-shaped, v1 single-resolution semantics)", () => {
  it("with 2 audiences, resolves the FIRST audience (Pitfall 5 — array-shaped signature)", () => {
    const { source } = resolveAudienceWeights([CALIBRATED_AUDIENCE, CALIBRATED_AUDIENCE_B]);
    // First is calibrated → should use analysis_override
    expect(source).toBe("analysis_override");
  });

  it("resolved weights match FIRST audience persona_weights when 2 calibrated provided", () => {
    const { weights } = resolveAudienceWeights([CALIBRATED_AUDIENCE, CALIBRATED_AUDIENCE_B]);
    const expected = normalizeWeights(CALIBRATED_WEIGHTS);
    expect(weights.fyp).toBeCloseTo(expected.fyp, 5);
  });

  it("first=General, second=calibrated → DEFAULT (General semantics win for first slot)", () => {
    const { source } = resolveAudienceWeights([GENERAL_AUDIENCE, CALIBRATED_AUDIENCE]);
    expect(source).toBe("default");
  });
});

describe("resolveAudienceWeights — mutation guard (D-03)", () => {
  const originalDefault = { ...DEFAULT_PERSONA_WEIGHT_CONFIG.default };

  it("DEFAULT_PERSONA_WEIGHT_CONFIG is never mutated after calls", () => {
    resolveAudienceWeights([]);
    resolveAudienceWeights([GENERAL_AUDIENCE]);
    resolveAudienceWeights([CALIBRATED_AUDIENCE]);
    resolveAudienceWeights([CALIBRATED_AUDIENCE, CALIBRATED_AUDIENCE_B]);

    expect(DEFAULT_PERSONA_WEIGHT_CONFIG.default.fyp).toBe(originalDefault.fyp);
    expect(DEFAULT_PERSONA_WEIGHT_CONFIG.default.niche).toBe(originalDefault.niche);
    expect(DEFAULT_PERSONA_WEIGHT_CONFIG.default.loyalist).toBe(originalDefault.loyalist);
    expect(DEFAULT_PERSONA_WEIGHT_CONFIG.default.cross_niche).toBe(originalDefault.cross_niche);
  });
});
