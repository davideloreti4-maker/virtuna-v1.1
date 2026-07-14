/**
 * Phase 07 Plan 06 — [BLOCKING] consolidated audience regression gate (AUD-03).
 *
 * Mirrors the P6-05 blocking gate. This test is the self-contained anchor that proves
 * the additive Phase-7 audience layer did NOT regress the protected Max video-scoring
 * path. The phase CANNOT pass with this red.
 *
 * Three protected invariants:
 *  1. ENGINE_VERSION === "3.21.0" — bumped by S3′ (batched text SIM + generate-rate-rank).
 *     S3′ is a deliberate TEXT-path scoring change; the MAX VIDEO path is untouched, so
 *     invariants 2 & 3 below (the video-path protections this gate actually guards) remain green.
 *  2. The General audience reproduces the byte-stable DEFAULT_PERSONA_WEIGHT_CONFIG mix
 *     via BOTH resolveWeights and resolveAudienceWeights → source 'default'.
 *  3. The Max video path is untouched: General never injects an analysis_override, so the
 *     aggregator's {niche}-only default resolution is unaffected (Pitfall 1).
 */
import { describe, it, expect } from "vitest";
import { ENGINE_VERSION } from "../version";
import {
  resolveWeights,
  DEFAULT_PERSONA_WEIGHT_CONFIG,
} from "../persona-weights";
import { resolveAudienceWeights } from "@/lib/audience/resolve-audience-weights";
import type { Audience } from "@/lib/audience/audience-types";

const DEFAULT_MIX = { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 };

/** Minimal, fully-typed General audience fixture (is_general → no override). */
const generalAudience: Audience = {
  id: "general",
  user_id: "test-user",
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

describe("audience regression gate (AUD-03) — BLOCKING", () => {
  it("ENGINE_VERSION is exactly '3.21.0' (AUD-FAIL-01 — confidence change on video rows; cache MUST invalidate)", () => {
    expect(ENGINE_VERSION).toBe("3.21.0");
  });

  it("resolveWeights(DEFAULT, {}) reproduces the DEFAULT mix at source 'default'", () => {
    const { weights, source } = resolveWeights(DEFAULT_PERSONA_WEIGHT_CONFIG, {});
    expect(source).toBe("default");
    expect(weights).toEqual(DEFAULT_MIX);
  });

  it("resolveAudienceWeights([]) → DEFAULT mix, source 'default' (empty = General)", () => {
    const { weights, source } = resolveAudienceWeights([]);
    expect(source).toBe("default");
    expect(weights).toEqual(DEFAULT_MIX);
  });

  it("resolveAudienceWeights([generalAudience]) → DEFAULT mix, source 'default' (General injects no override)", () => {
    const { weights, source } = resolveAudienceWeights([generalAudience]);
    expect(source).toBe("default");
    expect(weights).toEqual(DEFAULT_MIX);
  });

  // Pitfall 1 — Max video path untouched.
  //
  // The Max video path resolves persona weights in aggregator.ts (L1095-1122) with a
  // `{ niche }`-only context — it never reads an audience analysis_override. The General
  // audience returns source 'default' WITHOUT an override (asserted above), so the
  // aggregator's default resolution is byte-identical to pre-Phase-7. This test guards the
  // resolver contract; aggregator.ts is NOT modified this phase. Calibrated audiences inject
  // an analysis_override (source 'analysis_override'), but that only reaches the text/
  // generation path — never the {niche}-only video resolution.
  it("General resolution carries NO analysis_override (Max {niche}-only path unaffected)", () => {
    const general = resolveAudienceWeights([generalAudience]);
    const empty = resolveAudienceWeights([]);
    // Both collapse to the same byte-stable default — the only path the video aggregator hits.
    expect(general).toEqual(empty);
    expect(general.source).not.toBe("analysis_override");
  });
});
