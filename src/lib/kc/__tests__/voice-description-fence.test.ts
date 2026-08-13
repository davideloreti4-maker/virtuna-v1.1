/**
 * voice-description-fence.test.ts — the TYPE-LEVEL fence on the profile voice slot.
 *
 * ─── WHY THIS FILE EXISTS ────────────────────────────────────────────────────────────────────
 *
 * PR #482 (2026-08-12) proved the exemplar-copying defect was the voice role, not the corpus:
 * `creator_persona.writing_style_sample` — a VERBATIM video caption — was backfilled into the
 * profile's voice slot and rendered as "write in this voice". Measured, 3 arms x 6 seeds:
 *
 *     "Btw this dance took me hours to learn"   13/30 hooks about a dance · 43%   (0% word overlap)
 *     a 17-word line in the creator's register   13% of the pack reproduced VERBATIM
 *
 * #482 fenced the AUDIENCE path. It deliberately left the residual gap named in
 * `docs/superpowers/specs/2026-08-12-exemplar-fence-design.md` §5.4: the slot was still SPELLED
 * `writing_voice_sample`, and `adapt.ts` / `adapt-profile.ts` read it untouched. A name that says
 * "sample" invites a specimen, which is exactly the value measured to leak.
 *
 * The fence is the RENAME. `writing_voice_description` cannot be filled with a quoted caption
 * without the person doing it noticing they are contradicting the field name.
 *
 * ⚠️ THE TEETH ARE TEST 2, NOT TEST 1. Renaming a field that nothing populates is free; the
 * property that matters is that the OLD key is now INERT — a stale caller, a cached row, or a
 * revived migration handing over `writing_voice_sample` must produce NO voice block at all,
 * rather than silently flowing into the same role under the old name.
 */

import { describe, it, expect } from "vitest";
import { PROFILE_ROLE_MAP, type ProfileRow } from "../profile-role-map";
import { assembleBundle } from "../assembler";
import { buildAdaptProfile } from "@/lib/tools/runners/adapt-profile";

/** A DESCRIPTION of how the creator writes — what the slot is now contracted to hold. */
const DESCRIPTION = "blunt, no fluff. short declaratives. lowercase energy.";

/**
 * The measured defect value, verbatim from `.scratch/probe-voice-is-the-source.ts`. Used as the
 * LEGACY-key payload so a regression reads as the exact string that produced 43% dance hooks.
 */
const LEGACY_SPECIMEN = "Btw this dance took me hours to learn";

/**
 * A row as supabase actually hands it back: untyped JSON. The cast is the point — this simulates
 * a producer that was never updated, which is the only way the old key can still appear.
 */
function rowWithLegacyKey(): ProfileRow {
  return { writing_voice_sample: LEGACY_SPECIMEN } as unknown as ProfileRow;
}

describe("the profile voice slot is a DESCRIPTION, not a sample", () => {
  it("renders a voice block from writing_voice_description", () => {
    const line = PROFILE_ROLE_MAP.voice({ writing_voice_description: DESCRIPTION });

    expect(line).not.toBeNull();
    expect(line).toContain(DESCRIPTION);
  });

  it("returns null when the description is absent or blank (cold-start)", () => {
    expect(PROFILE_ROLE_MAP.voice({})).toBeNull();
    expect(PROFILE_ROLE_MAP.voice({ writing_voice_description: "   " })).toBeNull();
  });

  // ─── THE FENCE ────────────────────────────────────────────────────────────────────────────
  it("IGNORES the legacy writing_voice_sample key — a stale producer donates nothing", () => {
    const line = PROFILE_ROLE_MAP.voice(rowWithLegacyKey());

    expect(line).toBeNull();
  });

  it("the specimen never reaches the ASSEMBLED BUNDLE — the string the model actually sees", () => {
    // Asserted on the bundle, not on the renderer, deliberately. #482's first draft had three
    // assertions go GREEN against the fully-present defect because they checked the row passed
    // IN rather than what was assembled OUT (spec §6). This is the out.
    const bundle = assembleBundle(
      { ask: "give me 5 hooks for a student budgeting app", platform: "tiktok", mode: "hooks" },
      rowWithLegacyKey(),
    );

    expect(bundle).not.toContain(LEGACY_SPECIMEN);
    expect(bundle).not.toContain("dance");
  });

  it("a description DOES reach the assembled bundle", () => {
    // The counterweight: without this, deleting the voice role entirely would pass every
    // assertion above. The fence must block the specimen WITHOUT killing the slot.
    const bundle = assembleBundle(
      { ask: "give me 5 hooks for a student budgeting app", platform: "tiktok", mode: "hooks" },
      { writing_voice_description: DESCRIPTION },
    );

    expect(bundle).toContain(DESCRIPTION);
  });
});

describe("the adapt briefer reads the same renamed slot", () => {
  it("maps writing_voice_description onto the flat AdaptProfile", () => {
    const adapt = buildAdaptProfile({ writing_voice_description: DESCRIPTION });

    expect(adapt.writing_voice_description).toBe(DESCRIPTION);
  });

  it("IGNORES the legacy key — the briefer is fenced on the same boundary as the assembler", () => {
    // `adapt.ts` renders this slot as "voice (write like this): …". Left reading the old key, the
    // briefer would keep re-voicing proven structures toward a quoted caption after #482 closed
    // the assembler path — the same defect through the other door.
    const adapt = buildAdaptProfile(rowWithLegacyKey());

    expect(adapt.writing_voice_description).toBeNull();
  });
});
