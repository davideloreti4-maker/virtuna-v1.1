/**
 * build-reaction-panel.test.ts — buildReactionPanel unit tests (Plan 13-01, Task 1).
 *
 * buildReactionPanel(profileRow, audience) → { panel, audienceRepaint } is the niche-
 * resolution + audience-repaint construction lifted byte-identically out of ideas-runner.ts
 * (L284-300) and hooks-runner.ts (L313-326). Both runners + the new POST /api/tools/react
 * route consume it so type-to-room discriminates by niche EXACTLY like a card reaction
 * (RESEARCH Open Q1 resolved + Pitfall 2 closed — the "all Mixed" niche-blind failure).
 *
 * Invariants under test:
 *   - panel.niche === resolveNicheKey(profileRow?.niche_primary ?? null); panel.contentType === null
 *   - calibrated audience (is_general=false, personas with archetype+repaint) → audienceRepaint is a
 *     Record<string,string> mapping each persona's archetype → repaint
 *   - GENERAL_AUDIENCE (is_general=true, personas:[]) OR audience=null → audienceRepaint === undefined
 *     (the byte-identical no-op path — regression-gate-safe, D-17)
 */

import { describe, it, expect } from "vitest";
import { buildReactionPanel } from "@/lib/engine/flash/build-reaction-panel";
import { resolveNicheKey } from "@/lib/engine/wave3/niche-resolver";
import type { Audience, CalibratedPersona } from "@/lib/audience/audience-types";
import type { ProfileRow } from "@/lib/kc/profile-role-map";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePersona(archetype: string, repaint: string): CalibratedPersona {
  return {
    archetype: archetype as CalibratedPersona["archetype"],
    repaint,
    temperature: "warm",
    disposition: "collector",
    share: 0.1,
  };
}

/** A calibrated (non-General) audience with two repainted personas. */
const calibratedAudience: Audience = {
  id: "aud-calibrated",
  user_id: "user-1",
  name: "Fitness Buyers",
  type: "target",
  platform: "tiktok",
  goal_label: "Grow",
  goal_intent: "grow",
  is_general: false,
  is_preset: false,
  persona_weights: { fyp: 0.4, niche: 0.4, loyalist: 0.15, cross_niche: 0.05 },
  personas: [
    makePersona("tough_crowd", "Skeptical gym regular who needs proof"),
    makePersona("saver", "Bookmarks routines to try later"),
  ],
  profile: null,
  calibration: null,
  created_at: "2026-06-20T00:00:00Z",
  updated_at: "2026-06-20T00:00:00Z",
};

/** The General default — is_general=true, no personas. */
const generalAudience: Audience = {
  ...calibratedAudience,
  id: "general",
  name: "General",
  is_general: true,
  personas: [],
};

const fitnessProfile: ProfileRow = { niche_primary: "fitness" };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("buildReactionPanel", () => {
  it("resolves panel.niche via resolveNicheKey and sets contentType null", () => {
    const { panel } = buildReactionPanel(fitnessProfile, calibratedAudience);
    expect(panel.niche).toBe(resolveNicheKey("fitness"));
    expect(panel.niche).not.toBeNull(); // fitness resolves to a real instantiation key
    expect(panel.contentType).toBeNull();
  });

  it("panel.niche is null when profileRow is null (honest generic fallback)", () => {
    const { panel } = buildReactionPanel(null, generalAudience);
    expect(panel.niche).toBeNull();
    expect(panel.contentType).toBeNull();
  });

  it("calibrated audience → audienceRepaint maps each persona archetype → repaint", () => {
    const { audienceRepaint } = buildReactionPanel(fitnessProfile, calibratedAudience);
    expect(audienceRepaint).toEqual({
      tough_crowd: "Skeptical gym regular who needs proof",
      saver: "Bookmarks routines to try later",
    });
  });

  it("GENERAL_AUDIENCE (is_general=true, personas:[]) → audienceRepaint undefined (no-op path)", () => {
    const { audienceRepaint } = buildReactionPanel(fitnessProfile, generalAudience);
    expect(audienceRepaint).toBeUndefined();
  });

  it("audience=null → audienceRepaint undefined (no-op path)", () => {
    const { audienceRepaint } = buildReactionPanel(fitnessProfile, null);
    expect(audienceRepaint).toBeUndefined();
  });

  it("calibrated audience with empty personas array → audienceRepaint undefined", () => {
    const emptyPersonas: Audience = { ...calibratedAudience, personas: [] };
    const { audienceRepaint } = buildReactionPanel(fitnessProfile, emptyPersonas);
    expect(audienceRepaint).toBeUndefined();
  });

  it("byte-identical to the inline ideas/hooks construction for a calibrated audience", () => {
    // Mirror the exact inline logic the runners used (ideas L284-300 / hooks L313-326):
    const expectedPanel = {
      niche: resolveNicheKey(fitnessProfile.niche_primary ?? null),
      contentType: null,
    };
    const expectedRepaint =
      calibratedAudience &&
      !calibratedAudience.is_general &&
      calibratedAudience.personas &&
      calibratedAudience.personas.length > 0
        ? Object.fromEntries(
            calibratedAudience.personas.map((p) => [p.archetype, p.repaint]),
          )
        : undefined;

    const { panel, audienceRepaint } = buildReactionPanel(
      fitnessProfile,
      calibratedAudience,
    );
    expect(panel).toEqual(expectedPanel);
    expect(audienceRepaint).toEqual(expectedRepaint);
  });
});
