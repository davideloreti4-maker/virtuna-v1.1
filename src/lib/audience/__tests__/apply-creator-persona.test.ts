/**
 * apply-creator-persona.test.ts — §P step-7 generation wiring (voice fallback + steer).
 *
 * Covers:
 * 1. null / General / no-creator_persona audience → inputs returned unchanged (gate-safe).
 * 2. Calibrated + creator_persona, NO profile voice → voice backfilled from writing_style_sample.
 * 3. Calibrated + creator_persona, EXISTING profile voice → manual voice WINS (fallback, not override).
 * 4. null profileRow + calibrated → voice-only profileRow synthesised.
 * 5. creatorSteer composes content_description + context.
 */

import { describe, it, expect } from "vitest";
import { applyCreatorPersona } from "../apply-creator-persona";
import type { Audience, CreatorPersona } from "../audience-types";
import type { ProfileRow } from "@/lib/kc/profile-role-map";

const CP: CreatorPersona = {
  content_description: "Board-certified doctor debunking medical myths.",
  context: "Audience: health-curious scrollers. Voice: warm, authoritative. AVOID: fearmongering.",
  writing_style_sample: "At no point in time did any of that make sense. Like, never.",
  format_signature: "Fast-paced split-screen reaction clips.",
};

function makeAudience(over: Partial<Audience> = {}): Audience {
  return {
    id: "aud-1",
    user_id: "user-1",
    name: "Dr Mike Audience",
    type: "personal",
    platform: "tiktok",
    goal_label: null,
    goal_intent: "authority",
    is_general: false,
    mode: "socials",
    is_preset: false,
    persona_weights: { fyp: 0.6, niche: 0.25, loyalist: 0.1, cross_niche: 0.05 },
    personas: [],
    profile: null,
    creator_persona: CP,
    calibration: null,
    created_at: "2026-06-24T00:00:00Z",
    updated_at: "2026-06-24T00:00:00Z",
    ...over,
  };
}

describe("applyCreatorPersona", () => {
  it("returns inputs unchanged for null audience (no-op, gate-safe)", () => {
    const profileRow: ProfileRow = { niche_primary: "medical" };
    const res = applyCreatorPersona(profileRow, null);
    expect(res.profileRow).toBe(profileRow); // same reference — byte-identical
    expect(res.creatorSteer).toBeUndefined();
  });

  it("returns inputs unchanged for General audience", () => {
    const profileRow: ProfileRow = { niche_primary: "medical" };
    const res = applyCreatorPersona(profileRow, makeAudience({ is_general: true }));
    expect(res.profileRow).toBe(profileRow);
    expect(res.creatorSteer).toBeUndefined();
  });

  it("returns inputs unchanged when the calibrated audience has no creator_persona", () => {
    const profileRow: ProfileRow = { niche_primary: "medical" };
    const res = applyCreatorPersona(profileRow, makeAudience({ creator_persona: null }));
    expect(res.profileRow).toBe(profileRow);
    expect(res.creatorSteer).toBeUndefined();
  });

  it("backfills the voice from writing_style_sample when the profile has none", () => {
    const profileRow: ProfileRow = { niche_primary: "medical" };
    const res = applyCreatorPersona(profileRow, makeAudience());
    expect(res.profileRow?.writing_voice_sample).toBe(CP.writing_style_sample);
    expect(res.profileRow?.niche_primary).toBe("medical"); // other fields preserved
    expect(res.creatorSteer).toContain(CP.content_description);
    expect(res.creatorSteer).toContain(CP.context);
  });

  it("FALLBACK: the manually-curated profile voice WINS over the auto-derived sample", () => {
    const profileRow: ProfileRow = {
      niche_primary: "medical",
      writing_voice_sample: "My carefully hand-written brand voice.",
    };
    const res = applyCreatorPersona(profileRow, makeAudience());
    expect(res.profileRow?.writing_voice_sample).toBe("My carefully hand-written brand voice.");
    expect(res.profileRow).toBe(profileRow); // untouched (no clone needed when voice exists)
    expect(res.creatorSteer).toBeDefined(); // steer still applied
  });

  it("synthesises a voice-only profileRow when profileRow is null (cold start + calibrated)", () => {
    const res = applyCreatorPersona(null, makeAudience());
    expect(res.profileRow).not.toBeNull();
    expect(res.profileRow?.writing_voice_sample).toBe(CP.writing_style_sample);
    expect(res.creatorSteer).toContain("Creator —");
  });
});
