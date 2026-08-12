/**
 * apply-creator-persona.test.ts — §P step-7 generation wiring, AFTER the exemplar fence.
 *
 * ─── WHAT CHANGED AND WHY ────────────────────────────────────────────────────────────────────
 *
 * This function used to do two things. It now does one.
 *
 * The VOICE half backfilled `profileRow.writing_voice_sample` from the audience's
 * `creator_persona.writing_style_sample` — a field `enrich-signature.ts:207` specifies as
 * "<verbatim transcript/caption of the top video>". A single quoted line cannot carry style, so
 * content is what the generator copied. Measured (spec §1, `.scratch/probe-voice-is-the-source.ts`,
 * 3 arms × 6 seeds, one field different):
 *
 *     prod       sample = "Btw this dance took me hours to learn"   13/30 cards about a dance · 43%
 *     voiceless  sample blanked                                      0/30 · 0%
 *     neutral    a 17-word line in the creator's register            0/30 dance, but 4/30 · 13%
 *                                                                    reproduced the sample VERBATIM
 *
 * p ≈ 2.3e-5. The role leaks content at every sample length: a short caption donates its TOPIC
 * (43% dance while sharing 0% of its words), a longer one is copied word for word.
 *
 * The STEER half survives untouched, and it is the anchor that works — `creator_persona.context`
 * already DESCRIBES the voice ("hyper-energetic, direct, and inclusive ('we', 'boys')") rather than
 * quoting a video. The voiceless arm keeps it and produced the best cards of the three.
 *
 * So: drop the quote, keep the description. Design: docs/superpowers/specs/2026-08-12-exemplar-fence-design.md
 */

import { describe, it, expect } from "vitest";
import { applyCreatorPersona } from "../apply-creator-persona";
import { assembleBundle } from "@/lib/kc/assembler";
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

describe("applyCreatorPersona — the steer, and only the steer", () => {
  it("is a no-op for a null audience (gate-safe)", () => {
    expect(applyCreatorPersona({ niche_primary: "medical" }, null).creatorSteer).toBeUndefined();
  });

  it("is a no-op for a General audience", () => {
    const res = applyCreatorPersona({ niche_primary: "medical" }, makeAudience({ is_general: true }));
    expect(res.creatorSteer).toBeUndefined();
  });

  it("is a no-op when the calibrated audience has no creator_persona", () => {
    const res = applyCreatorPersona({ niche_primary: "medical" }, makeAudience({ creator_persona: null }));
    expect(res.creatorSteer).toBeUndefined();
  });

  it("composes the steer from content_description then context", () => {
    const res = applyCreatorPersona({ niche_primary: "medical" }, makeAudience());
    expect(res.creatorSteer).toContain(CP.content_description);
    expect(res.creatorSteer).toContain(CP.context);
    expect(res.creatorSteer).toMatch(/^Creator — /);
  });

  it("still steers on a cold start (null profileRow)", () => {
    expect(applyCreatorPersona(null, makeAudience()).creatorSteer).toContain("Creator —");
  });

  /**
   * THE INTERFACE IS THE FENCE'S FIRST HALF.
   *
   * The function no longer returns a profileRow, because it no longer modifies one. A vestigial
   * pass-through field shaped exactly like the thing that was removed is an invitation to put the
   * backfill back — and this assertion is what fails if someone does.
   */
  it("returns ONLY a creatorSteer — no profileRow to carry a voice on", () => {
    const res = applyCreatorPersona({ niche_primary: "medical" }, makeAudience());
    expect(Object.keys(res)).toEqual(["creatorSteer"]);
  });
});

/**
 * THE FENCE. Keyed to the ASSEMBLED BUNDLE — the thing the model actually reads — rather than to
 * this function's return shape or to a list of files that currently behave.
 *
 * A guard keyed off what the code already does is a tautology (the analyze-401 lane paid for that
 * lesson). This one composes exactly what the three runners compose: applyCreatorPersona, then
 * assembleBundle with the creator's real profile row. If ANY path ever reconnects a verbatim
 * sample to the voice role, the sample appears in the bundle and this goes red.
 */
describe("the exemplar fence — a verbatim sample never reaches the bundle", () => {
  const profileRow: ProfileRow = { niche_primary: "medical", niche_sub: "myth-busting" };

  /**
   * ⚠️ `designated` is load-bearing, and the first draft of this test was worthless without it.
   *
   * The runners do not bundle the row they passed IN — they bundle the row this function hands
   * BACK (`profileRow: genProfileRow`). A fence that assembles the original row instead passes
   * against the unfixed code: the backfill clones, so the input is clean either way. Watched it
   * happen — three of these assertions went green while the defect was fully present.
   *
   * So the guard reads "whatever row this function DESIGNATES for generation", which is the
   * backfilled clone under the old interface and the untouched input under the new one. The cast
   * survives the narrowing on purpose: it is what lets this same assertion go red if anyone
   * reinstates the returned row.
   */
  function bundleFor(audience: Audience | null): string {
    const res = applyCreatorPersona(profileRow, audience);
    const designated = (res as { profileRow?: ProfileRow | null }).profileRow ?? profileRow;
    return assembleBundle(
      { ask: "give me 5 hooks about seed oils", platform: "tiktok", mode: "hooks", overrides: res.creatorSteer },
      designated,
    );
  }

  it("does not carry the audience's writing_style_sample", () => {
    expect(bundleFor(makeAudience())).not.toContain(CP.writing_style_sample);
  });

  it("does not carry a 'write in this voice' instruction at all", () => {
    expect(bundleFor(makeAudience())).not.toMatch(/Writing voice/i);
  });

  /**
   * The over-correction guard. Dropping the sample must not drop the DESCRIPTION with it — the
   * steer is the anchor the measurement kept, and a silently steer-less bundle is the plausible
   * way to "fix" this wrongly.
   */
  it("DOES still carry the descriptive steer", () => {
    const bundle = bundleFor(makeAudience());
    expect(bundle).toContain(CP.context);
    expect(bundle).toContain(CP.content_description);
  });
});
