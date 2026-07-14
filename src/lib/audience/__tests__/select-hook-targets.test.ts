/**
 * select-hook-targets.test.ts — the deterministic cast for per-persona hook generation.
 *
 * The claims under test are the ones the PRODUCT COPY makes ("your five biggest groups") and
 * the ones the HONESTY SPINE makes (we never name a person the model was not told about). Both
 * have to be assertable, which is the whole reason this selection carries no LLM.
 */

import { describe, it, expect } from "vitest";
import { rankHookTargets, selectHookTargets } from "@/lib/audience/select-hook-targets";
import type { Audience, CalibratedPersona } from "@/lib/audience/audience-types";

/**
 * `archetype` is typed to the fixed 10, but the DATABASE is not: #282 found a prod row with 45%
 * of its declared share on a slug outside the vocabulary, written before CalibratedPersonaSchema
 * guarded the boundary. Those rows still exist, and they are exactly what the unbindable tests
 * below must simulate — so the fixture accepts a raw string and casts, deliberately.
 */
function persona(over: Partial<CalibratedPersona> & { archetype: string }): CalibratedPersona {
  return {
    archetype: over.archetype as CalibratedPersona["archetype"],
    repaint: over.repaint ?? `Repaint for ${over.archetype}`,
    temperature: over.temperature ?? "warm",
    disposition: over.disposition ?? "scanner",
    share: over.share ?? 0.1,
    ...(over.label !== undefined ? { label: over.label } : {}),
  };
}

function makeAudience(over: Partial<Audience> = {}): Audience {
  return {
    id: "aud-1",
    user_id: "user-1",
    name: "Zach King",
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
    creator_persona: null,
    calibration: null,
    created_at: "2026-07-14T00:00:00Z",
    updated_at: "2026-07-14T00:00:00Z",
    ...over,
  };
}

describe("selectHookTargets — the honest degrade", () => {
  it("names NOBODY for a General audience — there are no real people behind it", () => {
    expect(selectHookTargets(makeAudience({ is_general: true }), 5)).toEqual([]);
  });

  it("names NOBODY when there is no audience at all", () => {
    expect(selectHookTargets(null, 5)).toEqual([]);
  });

  it("names NOBODY for a calibrated audience carrying zero personas", () => {
    expect(selectHookTargets(makeAudience({ personas: [] }), 5)).toEqual([]);
  });

  /**
   * #282: `archetype` is the engine's BINDING KEY. A slug outside the fixed 10 matches no slot in
   * any niche, so its repaint reaches the model NEVER. Casting one would print a confident
   * "written for your Vibe Tribe" on a hook whose writer was never told such a person exists.
   */
  it("EXCLUDES an archetype the engine cannot bind — its repaint reaches the model never", () => {
    const audience = makeAudience({
      personas: [
        persona({ archetype: "vibe_tribe" as CalibratedPersona["archetype"], share: 0.9 }), // biggest share, unbindable slug
        persona({ archetype: "saver", share: 0.1 }),
      ],
    });
    const cast = rankHookTargets(audience, 5);
    expect(cast.map((t) => t.archetype)).toEqual(["saver"]);
  });

  /**
   * The repaint is the ONLY description of this person the model ever sees — `label` is
   * display-only and must not reach the prompt (F7). A blank repaint is no brief at all.
   */
  it("EXCLUDES a persona with an empty repaint — a label with no substance behind it", () => {
    const audience = makeAudience({
      personas: [
        persona({ archetype: "tough_crowd", share: 0.9, repaint: "   " }),
        persona({ archetype: "saver", share: 0.1, repaint: "Saves to study the cut." }),
      ],
    });
    expect(rankHookTargets(audience, 5).map((t) => t.archetype)).toEqual(["saver"]);
  });

  it("names NOBODY when every persona is unbindable — no cast, rather than a fake one", () => {
    const audience = makeAudience({
      personas: [
        persona({ archetype: "vibe_tribe" as CalibratedPersona["archetype"] }),
        persona({ archetype: "made_up" as CalibratedPersona["archetype"] }),
      ],
    });
    expect(selectHookTargets(audience, 5)).toEqual([]);
  });
});

describe("rankHookTargets — slot-spread beats naive top-N", () => {
  /**
   * THE POINT OF THE SPREAD. Six of the ten archetypes are `fyp`. A pure share sort therefore
   * hands back an ALL-FYP cast, and the shelf addresses one corner of the audience while calling
   * itself "your people". This is the test that regresses if someone "simplifies" the selection
   * back to `sort(share).slice(0,5)`.
   */
  it("does not return five FYP personas just because they hold the top five shares", () => {
    const audience = makeAudience({
      personas: [
        persona({ archetype: "high_engager", share: 0.2 }),       // fyp
        persona({ archetype: "saver", share: 0.19 }),             // fyp
        persona({ archetype: "lurker", share: 0.18 }),            // fyp
        persona({ archetype: "sharer", share: 0.17 }),            // fyp
        persona({ archetype: "tough_crowd", share: 0.16 }),       // fyp
        persona({ archetype: "niche_deep_buyer", share: 0.05 }),  // niche_deep
        persona({ archetype: "loyalist", share: 0.03 }),          // loyalist
        persona({ archetype: "cross_niche_curiosity", share: 0.02 }), // cross_niche
      ],
    });

    const cast = rankHookTargets(audience, 5);
    const slots = new Set(cast.map((t) => t.slot));

    // A naive top-5 by share would be all-fyp. All four buckets must be represented.
    expect(slots).toEqual(new Set(["fyp", "niche_deep", "loyalist", "cross_niche"]));
    // Coverage first (best of each slot, in share order), then magnitude fills the last seat.
    expect(cast.map((t) => t.archetype)).toEqual([
      "high_engager",          // best fyp
      "niche_deep_buyer",      // best niche_deep
      "loyalist",              // best loyalist
      "cross_niche_curiosity", // best cross_niche
      "saver",                 // remaining seat → next by share
    ]);
  });

  it("is deterministic on a share tie — fixed vocabulary order, never array position", () => {
    const forward = makeAudience({
      personas: [
        persona({ archetype: "saver", share: 0.5 }),
        persona({ archetype: "lurker", share: 0.5 }),
      ],
    });
    const reversed = makeAudience({
      personas: [
        persona({ archetype: "lurker", share: 0.5 }),
        persona({ archetype: "saver", share: 0.5 }),
      ],
    });
    // `saver` precedes `lurker` in ARCHETYPES, so it wins the tie from EITHER input order.
    expect(rankHookTargets(forward, 5)[0]!.archetype).toBe("saver");
    expect(rankHookTargets(reversed, 5)[0]!.archetype).toBe("saver");
  });

  it("carries the display label separately from the repaint the model is given (F7)", () => {
    const audience = makeAudience({
      personas: [
        persona({
          archetype: "tough_crowd",
          share: 0.5,
          label: "The Debunkers",
          repaint: "Skeptical of the magic, hunting for the cut.",
        }),
      ],
    });
    const [t] = rankHookTargets(audience, 5);
    expect(t!.label).toBe("The Debunkers");
    expect(t!.repaint).toBe("Skeptical of the magic, hunting for the cut.");
  });

  it("falls back to an archetype-derived label when the creator set none", () => {
    const audience = makeAudience({
      personas: [persona({ archetype: "niche_deep_buyer", share: 0.5 })],
    });
    expect(rankHookTargets(audience, 5)[0]!.label).toBe("Niche Deep Buyer");
  });
});

describe("selectHookTargets — the shelf size is fixed", () => {
  it("returns exactly `count` assignments for a ten-persona scraped audience", () => {
    const audience = makeAudience({
      personas: [
        persona({ archetype: "high_engager", share: 0.2 }),
        persona({ archetype: "saver", share: 0.18 }),
        persona({ archetype: "lurker", share: 0.14 }),
        persona({ archetype: "sharer", share: 0.12 }),
        persona({ archetype: "tough_crowd", share: 0.1 }),
        persona({ archetype: "purposeful_viewer", share: 0.08 }),
        persona({ archetype: "niche_deep_buyer", share: 0.07 }),
        persona({ archetype: "niche_deep_scout", share: 0.05 }),
        persona({ archetype: "loyalist", share: 0.04 }),
        persona({ archetype: "cross_niche_curiosity", share: 0.02 }),
      ],
    });
    const targets = selectHookTargets(audience, 5);
    expect(targets).toHaveLength(5);
    // Ten real people → five DISTINCT readers, no repeats.
    expect(new Set(targets.map((t) => t.archetype)).size).toBe(5);
  });

  /**
   * The authored custom audiences in prod carry 3–4 personas, not 10. A calibrated audience must
   * not silently hand back a SHORTER shelf than General does — so assignments cycle over the real
   * cast. Two hooks for the same reader is honest (the contract already demands distinct
   * mechanisms); inventing a fourth person to pad the shelf would not be.
   */
  it("CYCLES the cast rather than shrinking the shelf or inventing people (3-persona audience)", () => {
    const audience = makeAudience({
      personas: [
        persona({ archetype: "tough_crowd", share: 0.5 }),        // fyp
        persona({ archetype: "niche_deep_buyer", share: 0.3 }),   // niche_deep
        persona({ archetype: "loyalist", share: 0.2 }),           // loyalist
      ],
    });
    const targets = selectHookTargets(audience, 5);

    expect(targets).toHaveLength(5); // the shelf does NOT shrink
    expect(targets.map((t) => t.archetype)).toEqual([
      "tough_crowd",
      "niche_deep_buyer",
      "loyalist",
      "tough_crowd",      // cycles back to the biggest group
      "niche_deep_buyer",
    ]);
    // Every named reader is a REAL persona on the audience — none fabricated to fill a seat.
    const real = new Set(audience.personas.map((p) => p.archetype));
    for (const t of targets) expect(real.has(t.archetype)).toBe(true);
  });
});
