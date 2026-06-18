/**
 * Phase 7 Plan 01 — goal-intent bias table tests (AUD-06).
 *
 * RED phase: these tests will fail until goal-intent.ts is implemented.
 * Assertions:
 *  - All 4 intents (grow/sell/authority/nurture) present in GOAL_INTENT_BIAS
 *  - biasForGoalIntent is deterministic (same intent → same object reference)
 *  - Each value is a PersonaWeights summing to 1.0 ± 0.01 (normalizeWeights round-trip)
 *  - D-05 locked mapping: grow→new_creator, sell→niche_heavy, authority→niche_heavy, nurture→established
 */
import { describe, it, expect } from "vitest";

import { GOAL_INTENT_BIAS, biasForGoalIntent } from "../goal-intent";
import { WEIGHT_PRESETS } from "@/components/board/audience/audience-constants";
import { normalizeWeights } from "@/lib/engine/persona-weights";

describe("GOAL_INTENT_BIAS — deterministic weight table (D-05)", () => {
  const intents = ["grow", "sell", "authority", "nurture"] as const;

  it("all 4 intents are present", () => {
    for (const intent of intents) {
      expect(GOAL_INTENT_BIAS[intent]).toBeDefined();
    }
  });

  it("each bias value is a PersonaWeights with all 4 keys", () => {
    for (const intent of intents) {
      const w = GOAL_INTENT_BIAS[intent];
      expect(typeof w.fyp).toBe("number");
      expect(typeof w.niche).toBe("number");
      expect(typeof w.loyalist).toBe("number");
      expect(typeof w.cross_niche).toBe("number");
    }
  });

  it("each bias sums to 1.0 ± 0.01 (normalizeWeights round-trip)", () => {
    for (const intent of intents) {
      const normalized = normalizeWeights(GOAL_INTENT_BIAS[intent]);
      const sum = normalized.fyp + normalized.niche + normalized.loyalist + normalized.cross_niche;
      expect(sum).toBeCloseTo(1.0, 2);
    }
  });

  it("grow === WEIGHT_PRESETS.new_creator (D-05 locked mapping)", () => {
    expect(GOAL_INTENT_BIAS.grow).toEqual(WEIGHT_PRESETS.new_creator);
  });

  it("sell === WEIGHT_PRESETS.niche_heavy (D-05 locked mapping)", () => {
    expect(GOAL_INTENT_BIAS.sell).toEqual(WEIGHT_PRESETS.niche_heavy);
  });

  it("authority === WEIGHT_PRESETS.niche_heavy (D-05 locked mapping)", () => {
    expect(GOAL_INTENT_BIAS.authority).toEqual(WEIGHT_PRESETS.niche_heavy);
  });

  it("nurture === WEIGHT_PRESETS.established (D-05 locked mapping)", () => {
    expect(GOAL_INTENT_BIAS.nurture).toEqual(WEIGHT_PRESETS.established);
  });
});

describe("biasForGoalIntent — deterministic lookup", () => {
  it("biasForGoalIntent('grow') === GOAL_INTENT_BIAS.grow (same reference)", () => {
    expect(biasForGoalIntent("grow")).toBe(GOAL_INTENT_BIAS.grow);
  });

  it("biasForGoalIntent('sell') === GOAL_INTENT_BIAS.sell", () => {
    expect(biasForGoalIntent("sell")).toBe(GOAL_INTENT_BIAS.sell);
  });

  it("biasForGoalIntent('authority') === GOAL_INTENT_BIAS.authority", () => {
    expect(biasForGoalIntent("authority")).toBe(GOAL_INTENT_BIAS.authority);
  });

  it("biasForGoalIntent('nurture') === GOAL_INTENT_BIAS.nurture", () => {
    expect(biasForGoalIntent("nurture")).toBe(GOAL_INTENT_BIAS.nurture);
  });
});
