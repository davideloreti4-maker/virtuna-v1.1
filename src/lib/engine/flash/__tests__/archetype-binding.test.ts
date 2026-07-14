/**
 * archetype-binding.test.ts — a persona only steers the model if its archetype BINDS to a slot.
 *
 * THE BUG THIS PINS (found 2026-07-14, sibling of the MODE-01 null-niche drop):
 *   `buildAudienceRepaint` projects personas into a `Record<archetype, repaint>` map, and the
 *   Flash prompt builders look that map up BY THE ARCHETYPE OF EACH ENGINE SLOT. So an archetype
 *   outside the fixed 10-slug vocabulary matches nothing, in any niche — its repaint reaches the
 *   model NEVER, the slot silently keeps its stock text, and the run looks perfectly healthy.
 *   The prod row "Fitness Creators" stored `fitness` (share .25) and `learner` (share .20):
 *   45% of that audience's own declared weight was dead, and every test was green.
 *
 * These tests assert the PROMPT BYTES, not the warning — the warning is a diagnostic, but the
 * product harm is "this text never reached the model". Test the harm.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildAudienceRepaint } from "@/lib/engine/flash/build-reaction-panel";
import { buildNicheAwareSystemPrompt } from "@/lib/engine/flash/flash-prompts";
import { resolveNicheKey } from "@/lib/engine/wave3/niche-resolver";
import type { Audience, CalibratedPersona } from "@/lib/audience/audience-types";

vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));
import * as Sentry from "@sentry/nextjs";

const GOOD_REPAINT = "Bookmarks routines to try later, judges filler hard";
const BAD_REPAINT = "Hardcore gym regular who screenshots form tutorials";

function persona(archetype: string, repaint: string, share: number): CalibratedPersona {
  return {
    archetype: archetype as CalibratedPersona["archetype"],
    repaint,
    temperature: "warm",
    disposition: "collector",
    share,
  };
}

/** Mirrors the real prod row: valid slugs alongside invented ones. */
const mixedAudience: Audience = {
  id: "aud-fitness-creators",
  user_id: "user-1",
  name: "Fitness Creators",
  type: "target",
  platform: "tiktok",
  goal_label: null,
  goal_intent: "grow",
  is_general: false,
  mode: "socials",
  is_preset: false,
  persona_weights: { fyp: 0.55, niche: 0.25, loyalist: 0.12, cross_niche: 0.08 },
  personas: [
    persona("saver", GOOD_REPAINT, 0.15), // valid slug → binds
    persona("fitness", BAD_REPAINT, 0.25), // invented slug → binds to NOTHING
  ],
  profile: null,
  calibration: null,
  created_at: "2026-06-20T00:00:00Z",
  updated_at: "2026-06-20T00:00:00Z",
};

const fitnessNiche = { niche: resolveNicheKey("fitness"), contentType: null };

describe("archetype binding — an invented slug never reaches the model", () => {
  beforeEach(() => vi.clearAllMocks());

  it("THE HARM: a valid slug's repaint lands in the prompt; an invented slug's does not", () => {
    const repaint = buildAudienceRepaint(mixedAudience);
    const prompt = buildNicheAwareSystemPrompt(fitnessNiche, repaint, "socials");

    // The valid persona steers its slot.
    expect(prompt).toContain(GOOD_REPAINT);
    // The invented one is dead weight — this is the whole bug, in one assertion.
    expect(prompt).not.toContain(BAD_REPAINT);
  });

  it("warns with the audience id and the share that was silently lost", () => {
    buildAudienceRepaint(mixedAudience);

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "audience persona archetype does not bind to an engine slot",
      expect.objectContaining({
        level: "warning",
        extra: expect.objectContaining({
          audience_id: "aud-fitness-creators",
          unbindable_archetypes: ["fitness"],
          lost_share: 0.25,
        }),
      }),
    );
  });

  it("an all-valid audience is silent (no false alarm on the healthy path)", () => {
    const healthy: Audience = {
      ...mixedAudience,
      personas: [
        persona("saver", GOOD_REPAINT, 0.5),
        persona("tough_crowd", "Needs proof in the first 2 seconds", 0.5),
      ],
    };

    const repaint = buildAudienceRepaint(healthy);
    const prompt = buildNicheAwareSystemPrompt(fitnessNiche, repaint, "socials");

    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    expect(prompt).toContain(GOOD_REPAINT);
    expect(prompt).toContain("Needs proof in the first 2 seconds");
  });

  it("REGRESSION GATE: the projection still carries every persona, so prompt bytes are unchanged", () => {
    // The unbindable entries stay in the map (they cannot collide with a slot key). This keeps
    // the built prompt byte-identical to the pre-fix output — the fix is diagnostic, not behavioural.
    const repaint = buildAudienceRepaint(mixedAudience);
    expect(repaint).toEqual({ saver: GOOD_REPAINT, fitness: BAD_REPAINT });

    const withFix = buildNicheAwareSystemPrompt(fitnessNiche, repaint, "socials");
    const asPreFix = buildNicheAwareSystemPrompt(
      fitnessNiche,
      Object.fromEntries(mixedAudience.personas.map((p) => [p.archetype, p.repaint])),
      "socials",
    );
    expect(withFix).toBe(asPreFix);
  });
});
