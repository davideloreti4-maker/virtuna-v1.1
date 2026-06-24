/**
 * Task 2 TDD — RED: grounding-line extractor behaviour contract.
 *
 * Three behaviour cases from the plan spec:
 *  1. Full profile → honest, human-facing string with no caveat phrases
 *  2. Thin/null profile → the honest D-14 cold-start fallback line + coldStart: true
 *  3. Partial profile (audience only, no wins) → only data-supported fragments
 *
 * Plus explicit assertion: output NEVER contains LLM-facing caveat phrasing
 * (RESEARCH Pitfall 1 warning signs).
 */

import { describe, it, expect } from "vitest";
import { buildGroundingLine } from "../grounding-line";
import type { ProfileRow } from "../profile-role-map";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FULL_PROFILE: ProfileRow = {
  niche_primary: "fitness",
  niche_sub: "strength-training",
  target_audience: {
    age_range: "18-25",
    gender_skew: "male-skewed",
    geo: "US",
    language: "en",
  },
  past_wins: [
    { url: "https://tiktok.com/@test/video/1" },
    { url: "https://tiktok.com/@test/video/2" },
    { url: "https://tiktok.com/@test/video/3" },
  ],
  past_flops: [],
  primary_goal: "grow audience",
  creator_stage: "growing",
  target_platforms: ["tiktok"],
};

const AUDIENCE_ONLY_PROFILE: ProfileRow = {
  niche_primary: "fitness",
  target_audience: {
    age_range: "25-35",
  },
  past_wins: null,
};

const EMPTY_PROFILE: ProfileRow = {
  niche_primary: null,
  target_audience: null,
  past_wins: null,
};

// ─── Test: full profile ───────────────────────────────────────────────────────

describe("buildGroundingLine — full profile", () => {
  it("returns coldStart: false for a full profile", () => {
    const result = buildGroundingLine(FULL_PROFILE, "tiktok");
    expect(result.coldStart).toBe(false);
  });

  it("returns a non-empty line for a full profile", () => {
    const result = buildGroundingLine(FULL_PROFILE, "tiktok");
    expect(result.line.length).toBeGreaterThan(0);
  });

  it("includes age range in the line", () => {
    const result = buildGroundingLine(FULL_PROFILE, "tiktok");
    expect(result.line).toContain("18-25");
  });

  it("includes niche in the line", () => {
    const result = buildGroundingLine(FULL_PROFILE, "tiktok");
    expect(result.line.toLowerCase()).toContain("fitness");
  });

  it("includes win count (not fabricated mechanism) in the line", () => {
    const result = buildGroundingLine(FULL_PROFILE, "tiktok");
    // Should say "3" videos overperformed — count only, no mechanism
    expect(result.line).toContain("3");
    expect(result.line.toLowerCase()).toMatch(/overperform|video/);
  });

  it("NEVER contains LLM-facing caveat phrase '(creator-reported, directional)'", () => {
    const result = buildGroundingLine(FULL_PROFILE, "tiktok");
    expect(result.line).not.toContain("creator-reported, directional");
  });

  it("NEVER contains LLM-facing instruction 'steer toward'", () => {
    const result = buildGroundingLine(FULL_PROFILE, "tiktok");
    expect(result.line).not.toContain("steer toward");
  });

  it("NEVER contains raw column names like 'Past wins:'", () => {
    const result = buildGroundingLine(FULL_PROFILE, "tiktok");
    expect(result.line).not.toMatch(/^Past wins:/i);
    expect(result.line).not.toMatch(/^Target audience:/i);
  });
});

// ─── Test: thin/null profile → cold-start (D-14) ─────────────────────────────

describe("buildGroundingLine — thin/null profile", () => {
  it("returns coldStart: true for null profile", () => {
    const result = buildGroundingLine(null, "tiktok");
    expect(result.coldStart).toBe(true);
  });

  it("returns coldStart: true for an empty/all-null profile", () => {
    const result = buildGroundingLine(EMPTY_PROFILE, "tiktok");
    expect(result.coldStart).toBe(true);
  });

  it("returns the honest D-14 cold-start line for null profile", () => {
    const result = buildGroundingLine(null, "tiktok");
    // Must communicate: platform baselines + add-profile nudge (D-14)
    expect(result.line.toLowerCase()).toContain("tiktok");
    expect(result.line.toLowerCase()).toMatch(/baseline|profile/);
  });

  it("includes platform name in cold-start line", () => {
    const result = buildGroundingLine(null, "instagram");
    expect(result.line.toLowerCase()).toContain("instagram");
  });

  it("cold-start line NEVER fabricates audience claim", () => {
    const result = buildGroundingLine(null, "tiktok");
    // Must not say "because your audience…" with fabricated data
    expect(result.line).not.toMatch(/because your audience/i);
    expect(result.line).not.toContain("18-25");
    expect(result.line).not.toContain("overperformed");
  });

  it("NEVER contains LLM-facing caveat phrases in cold-start line", () => {
    const result = buildGroundingLine(null, "tiktok");
    expect(result.line).not.toContain("creator-reported, directional");
    expect(result.line).not.toContain("steer toward");
  });
});

// ─── Test: partial profile (audience only, no wins) ──────────────────────────

describe("buildGroundingLine — partial profile", () => {
  it("returns coldStart: false when audience data is present", () => {
    const result = buildGroundingLine(AUDIENCE_ONLY_PROFILE, "tiktok");
    expect(result.coldStart).toBe(false);
  });

  it("includes audience fragment when present", () => {
    const result = buildGroundingLine(AUDIENCE_ONLY_PROFILE, "tiktok");
    expect(result.line).toContain("25-35");
  });

  it("does NOT fabricate a win claim when past_wins is null", () => {
    const result = buildGroundingLine(AUDIENCE_ONLY_PROFILE, "tiktok");
    // Must not claim overperformance when there are no wins recorded
    expect(result.line).not.toMatch(/overperform/i);
    expect(result.line).not.toMatch(/\d+ video/);
  });

  it("NEVER contains LLM-facing caveat phrases", () => {
    const result = buildGroundingLine(AUDIENCE_ONLY_PROFILE, "tiktok");
    expect(result.line).not.toContain("creator-reported, directional");
    expect(result.line).not.toContain("steer toward");
  });
});
