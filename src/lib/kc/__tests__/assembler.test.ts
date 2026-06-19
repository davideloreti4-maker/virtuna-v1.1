/**
 * assembler.test.ts — KCQ-08 voice-priority contract.
 *
 * Two behaviour guarantees from the plan spec (D-11/D-12):
 *  1. ORDER: `voice` is NOT the tail (last) element of MODE_ROLES.idea/hooks/script/remix
 *     — the cap-drop loop pops from the tail, so a tail voice is silently dropped first.
 *     `chat` stays voice-free by design (base-neutral grounding).
 *  2. CAP-DROP SURVIVAL: under a representative BUNDLE_CHAR_CAP overflow, the creator's
 *     voice survives while a lower-priority profile role (platform) is shed.
 *
 * Plus: the strengthened formatVoice header carries the explicit "Write in this voice"
 * directive AND retains the honesty clause + the injection fence sentinels.
 */

import { describe, it, expect } from "vitest";
import { assembleBundle, MODE_ROLES, BUNDLE_CHAR_CAP } from "../assembler";
import { PROFILE_ROLE_MAP, type ProfileRow } from "../profile-role-map";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VOICE_FENCE_OPEN = "<<<USER_CONTENT>>>";
const VOICE_FENCE_CLOSE = "<<<END_USER_CONTENT>>>";

// A distinctive voice sample sized so that, together with a large ask, the bundle
// overflows BUNDLE_CHAR_CAP and forces a tail-role drop. The sentinel string is
// unique so we can assert the voice line survived the cap.
const VOICE_SAMPLE =
  "VOICE_SURVIVES_MARKER — short punchy lines. lowercase energy. no fluff. " +
  "x".repeat(800);

const FULL_PROFILE: ProfileRow = {
  niche_primary: "fitness",
  niche_sub: "strength-training",
  target_audience: {
    age_range: "18-25",
    gender_skew: "male",
    geo: "US",
    language: "en",
  },
  primary_goal: "grow audience",
  creator_stage: "growing",
  past_wins: [{ url: "https://tiktok.com/@t/video/1" }],
  past_flops: [{ url: "https://tiktok.com/@t/video/2" }],
  target_platforms: ["tiktok"],
  writing_voice_sample: VOICE_SAMPLE,
};

// ─── 1. ORDER: voice is never the tail element of the four generative modes ─────

describe("MODE_ROLES voice priority (KCQ-08 / D-11/D-12)", () => {
  it.each(["idea", "hooks", "script", "remix"] as const)(
    "%s — voice is present but NOT the last (tail-drop) role",
    (mode) => {
      const roles = MODE_ROLES[mode];
      expect(roles).toContain("voice");
      expect(roles[roles.length - 1]).not.toBe("voice");
    },
  );

  it("voice sits ahead of wins/flops/platform in all four generative modes", () => {
    for (const mode of ["idea", "hooks", "script", "remix"] as const) {
      const roles = MODE_ROLES[mode];
      const vi = roles.indexOf("voice");
      expect(vi).toBeGreaterThanOrEqual(0);
      for (const lower of ["wins", "flops", "platform"] as const) {
        const li = roles.indexOf(lower);
        if (li >= 0) expect(vi).toBeLessThan(li);
      }
    }
  });

  it("chat stays voice-free (base-neutral grounding, unchanged)", () => {
    expect(MODE_ROLES.chat).toEqual(["niche", "audience", "platform"]);
  });
});

// ─── 2. formatVoice header: explicit directive + honesty clause + fence ─────────

describe("formatVoice header (KCQ-08 directive + honesty spine)", () => {
  const voiceLine = PROFILE_ROLE_MAP.voice(FULL_PROFILE)!;

  it("carries the explicit 'Write in this voice' directive", () => {
    expect(voiceLine).toContain("Write in this voice");
  });

  it("retains the 'do NOT reuse specific content' honesty clause", () => {
    expect(voiceLine).toContain("do NOT reuse specific content");
  });

  it("keeps the <<<USER_CONTENT>>> injection fence intact", () => {
    expect(voiceLine).toContain(VOICE_FENCE_OPEN);
    expect(voiceLine).toContain(VOICE_FENCE_CLOSE);
  });

  it("returns null for an absent voice sample (graceful cold-start)", () => {
    expect(PROFILE_ROLE_MAP.voice({ ...FULL_PROFILE, writing_voice_sample: null })).toBeNull();
  });
});

// ─── 3. CAP-DROP SURVIVAL: voice survives, a lower-priority role is shed ────────

describe("voice survives a representative BUNDLE_CHAR_CAP drop", () => {
  // A large ask pushes the assembled bundle just over the cap so the tail-drop loop
  // runs and sheds the lowest-priority profile roles (platform → flops → wins) while
  // leaving niche/audience/voice. Sized so step 4a (profile-role drop) fires, NOT
  // step 4b (whole-profile drop when the fenced ask alone overflows).
  const BIG_ASK = "y".repeat(2700);

  it.each(["hooks", "script", "remix"] as const)(
    "%s — voice marker present though the bundle overflowed and dropped a tail role",
    (mode) => {
      const bundle = assembleBundle(
        { ask: BIG_ASK, platform: "tiktok", mode },
        FULL_PROFILE,
      );
      // The bundle was forced over the cap by the big ask → tail role(s) dropped.
      // Voice (no longer tail) survives.
      expect(bundle).toContain("VOICE_SURVIVES_MARKER");
      // A lower-priority profile role (the profile-stored "wins" directional line) is
      // shed under the cap while voice — which now ranks above it — is kept.
      expect(bundle).not.toContain("Past wins");
      // Sanity: voice ranks above wins/flops/platform in the role order.
      const roles = MODE_ROLES[mode];
      expect(roles.indexOf("voice")).toBeLessThan(roles.indexOf("wins"));
    },
  );

  it("a fitting bundle keeps every role including voice (no spurious drop)", () => {
    const bundle = assembleBundle(
      { ask: "short ask", platform: "tiktok", mode: "hooks" },
      { ...FULL_PROFILE, writing_voice_sample: "VOICE_SURVIVES_MARKER — terse." },
    );
    expect(bundle.length).toBeLessThanOrEqual(BUNDLE_CHAR_CAP);
    expect(bundle).toContain("VOICE_SURVIVES_MARKER");
    expect(bundle).toContain("Niche: fitness");
  });
});
