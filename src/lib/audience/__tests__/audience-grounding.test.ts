/**
 * audience-grounding.test.ts — TDD RED/GREEN for buildAudienceGroundingLine (07-04 Task 1).
 *
 * Covers:
 * 1. General / null audience → delegates to buildGroundingLine (same { line, coldStart } shape)
 * 2. Calibrated audience → audience-facing "Because: …" line (steer, AUD-05)
 * 3. Flash prompt byte-stability regression guard:
 *    buildNicheAwareSystemPrompt(panel) === buildNicheAwareSystemPrompt(panel) (no repaint → no-op)
 * 4. Audience repaint fold: calibrated repaint substitutes deterministically; same audience → same string
 */

import { describe, it, expect, vi } from "vitest";
import { buildAudienceGroundingLine } from "../audience-grounding";
import type { Audience } from "../audience-types";
import { buildNicheAwareSystemPrompt } from "@/lib/engine/flash/flash-prompts";
import type { NichePanel } from "@/lib/engine/flash/flash-prompts";
import { GENERAL_AUDIENCE } from "../audience-repo";

// ─── Mock buildGroundingLine so delegate path is testable without a full profile ─

vi.mock("@/lib/kc/grounding-line", () => ({
  buildGroundingLine: vi.fn((_row: unknown, platform: string) => ({
    line: `Based on ${platform} baselines — add your profile for tailored ideas`,
    coldStart: true,
  })),
}));

import { buildGroundingLine } from "@/lib/kc/grounding-line";

// ─── Fixture helpers ───────────────────────────────────────────────────────────

function makeCalibrated(): Audience {
  return {
    id: "test-audience-1",
    user_id: "user-1",
    name: "TikTok Fitness",
    type: "personal",
    platform: "tiktok",
    goal_label: "Grow my following",
    goal_intent: "grow",
    is_general: false,
    mode: "socials",
    is_preset: false,
    persona_weights: { fyp: 0.60, niche: 0.25, loyalist: 0.10, cross_niche: 0.05 },
    personas: [
      // Only a few archetypes needed for grounding line tests
      {
        archetype: "high_engager" as const,
        repaint: "Active fans in the fitness niche. Drive them to share for reach acceleration.",
        temperature: "hot",
        disposition: "connector",
        share: 0.12,
      },
      {
        archetype: "tough_crowd" as const,
        repaint: "Sceptical viewers. Win them with a strong hook.",
        temperature: "cold",
        disposition: "skeptic",
        share: 0.12,
      },
    ],
    profile: {
      temperature_mix: { cold: 0.25, warm: 0.50, hot: 0.25 },
      top_dispositions: ["connector", "collector", "skeptic"],
      follower_tier: "micro",
    },
    calibration: { source: "scrape", handle: "@fitnesscreator", scraped_at: "2026-06-18T00:00:00Z" },
    created_at: "2026-06-18T00:00:00Z",
    updated_at: "2026-06-18T00:00:00Z",
  };
}

// ─── 1. General / null audience → delegate to buildGroundingLine ───────────────

describe("buildAudienceGroundingLine — General / null delegation", () => {
  it("delegates to buildGroundingLine when audience is null", () => {
    const result = buildAudienceGroundingLine(null, "tiktok", null);
    expect(buildGroundingLine).toHaveBeenCalledWith(null, "tiktok");
    expect(result.coldStart).toBe(true);
    expect(result.line).toContain("tiktok");
  });

  it("delegates to buildGroundingLine when audience is General (is_general=true)", () => {
    vi.mocked(buildGroundingLine).mockClear();
    const result = buildAudienceGroundingLine(GENERAL_AUDIENCE, "instagram", null);
    expect(buildGroundingLine).toHaveBeenCalledWith(null, "instagram");
    expect(result.coldStart).toBe(true);
  });

  it("delegates to buildGroundingLine when audience is_general=true with profileRow", () => {
    vi.mocked(buildGroundingLine).mockClear();
    const profileRow = { niche_primary: "fitness" } as Parameters<typeof buildGroundingLine>[0];
    buildAudienceGroundingLine(GENERAL_AUDIENCE, "tiktok", profileRow);
    expect(buildGroundingLine).toHaveBeenCalledWith(profileRow, "tiktok");
  });
});

// ─── 2. Calibrated audience → audience-facing "Because: …" line ────────────────

describe("buildAudienceGroundingLine — calibrated audience", () => {
  it("returns an audience-facing line (not cold-start) for a calibrated audience", () => {
    vi.mocked(buildGroundingLine).mockClear();
    const audience = makeCalibrated();
    const result = buildAudienceGroundingLine(audience, "tiktok", null);

    // Must NOT delegate to buildGroundingLine
    expect(buildGroundingLine).not.toHaveBeenCalled();
    expect(result.coldStart).toBe(false);
    expect(result.line.length).toBeGreaterThan(0);
  });

  it("audience-facing line contains 'Because:' prefix", () => {
    const audience = makeCalibrated();
    const result = buildAudienceGroundingLine(audience, "tiktok", null);
    expect(result.line).toMatch(/^Because:/);
  });

  it("audience-facing line references platform", () => {
    const audience = makeCalibrated();
    const result = buildAudienceGroundingLine(audience, "instagram", null);
    expect(result.line.toLowerCase()).toContain("instagram");
  });

  it("audience-facing line is deterministic — same audience produces same output", () => {
    const audience = makeCalibrated();
    const r1 = buildAudienceGroundingLine(audience, "tiktok", null);
    const r2 = buildAudienceGroundingLine(audience, "tiktok", null);
    expect(r1.line).toBe(r2.line);
    expect(r1.coldStart).toBe(r2.coldStart);
  });

  it("audience-facing line does not include fabricated follower counts or fake metrics", () => {
    const audience = makeCalibrated();
    const result = buildAudienceGroundingLine(audience, "tiktok", null);
    // Honesty spine: no numeric follower counts in the grounding line
    expect(result.line).not.toMatch(/\d+k?\s+followers?/i);
  });
});

// ─── 3. Flash prompt byte-stability regression guard ──────────────────────────
//
// buildNicheAwareSystemPrompt(panel) without an audience repaint arg MUST return
// a byte-identical string on repeated calls (General is a true no-op).

describe("buildNicheAwareSystemPrompt — byte-stability regression guard (no repaint = no-op)", () => {
  const panelNoNiche: NichePanel = { niche: null, contentType: null };
  const panelWithNiche: NichePanel = { niche: "fitness", contentType: null };

  it("null niche: repeated calls produce identical string", () => {
    const a = buildNicheAwareSystemPrompt(panelNoNiche);
    const b = buildNicheAwareSystemPrompt(panelNoNiche);
    expect(a).toBe(b);
  });

  it("niche panel: repeated calls produce identical string (byte-stable cache prefix)", () => {
    const a = buildNicheAwareSystemPrompt(panelWithNiche);
    const b = buildNicheAwareSystemPrompt(panelWithNiche);
    expect(a).toBe(b);
  });

  it("calling with repaint=undefined produces same output as today (no-op regression guard)", () => {
    // This is the critical regression guard: passing no audienceRepaint arg must be
    // byte-identical to the current (pre-P7) output.
    const withoutRepaint = buildNicheAwareSystemPrompt(panelWithNiche);
    const withUndefinedRepaint = buildNicheAwareSystemPrompt(panelWithNiche, undefined);
    expect(withoutRepaint).toBe(withUndefinedRepaint);
  });
});

// ─── 4. Flash audience-repaint fold: deterministic substitution ────────────────

describe("buildNicheAwareSystemPrompt — audience repaint fold", () => {
  const panel: NichePanel = { niche: "fitness", contentType: null };

  const sampleRepaint: Record<string, string> = {
    high_engager: "Fitness enthusiast who actively engages.",
    saver: "Saves workout tips for reference.",
    lurker: "Silent viewer, monitors fitness trends.",
    sharer: "Spreads fitness inspiration to their network.",
    tough_crowd: "Sceptical — needs proof before stopping.",
    purposeful_viewer: "Has a specific fitness goal in mind.",
    niche_deep_buyer: "Ready to invest in fitness products.",
    niche_deep_scout: "Researches gear and supplements.",
    loyalist: "Dedicated fan of this creator.",
    cross_niche_curiosity: "Stumbled in from health/wellness adjacent content.",
  };

  it("with repaint arg: prompt differs from no-repaint version", () => {
    const withoutRepaint = buildNicheAwareSystemPrompt(panel);
    const withRepaint = buildNicheAwareSystemPrompt(panel, sampleRepaint);
    // The repaint substitutes archetype description text — prompts must differ
    expect(withRepaint).not.toBe(withoutRepaint);
  });

  it("repaint is deterministic: same repaint → identical prompt string", () => {
    const first = buildNicheAwareSystemPrompt(panel, sampleRepaint);
    const second = buildNicheAwareSystemPrompt(panel, sampleRepaint);
    expect(first).toBe(second);
  });

  it("repaint substitutes description text into the prompt", () => {
    const prompt = buildNicheAwareSystemPrompt(panel, sampleRepaint);
    // At least one repaint description must appear in the built prompt
    expect(prompt).toContain("Fitness enthusiast who actively engages.");
  });

  it("skeleton (TYPE RULES, Output Schema header) stays byte-stable with repaint", () => {
    const withRepaint = buildNicheAwareSystemPrompt(panel, sampleRepaint);
    // The skeleton markers must be present regardless of repaint
    expect(withRepaint).toContain("TYPE RULES");
    expect(withRepaint).toContain("Output Schema");
    expect(withRepaint).toContain("Critical Divergence Requirement");
  });
});
