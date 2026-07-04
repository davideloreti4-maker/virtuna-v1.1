/**
 * audienceToActiveAudience — the Audience → ActiveAudience seam adapter (Seam 3).
 *
 * Locks the field mapping in docs/SURFACE-SEAM-SPEC.md §2.2 + the honesty spine:
 *  - id / name / platform pass through (name → "General" for the is_general default).
 *  - people → NAMED Person[] (creator label wins, else the stable archetype default) —
 *    NEVER the archetype enum (THE-CONTRACT.md §2); segment = the calibrated repaint.
 *  - tier via the leaf resolveTier (socials → Validated, general-mode → Directional).
 *  - goal: grow→Grow, sell→Sell, authority/nurture/null → the field is OMITTED.
 *  - pulse: the idle readiness line ("Name · N people ready"), never a fabricated reaction;
 *    a personas-less audience (General) falls back to the default roster of 10.
 *
 * Test runner (repo quirk): run via
 *   node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/audience-to-active.test.ts
 * NEVER `npm test` / `npx vitest` — they emit a fake PASS(0)/FAIL(0).
 */

import { describe, it, expect } from "vitest";
import { audienceToActiveAudience } from "../audience-to-active";
import { GENERAL_AUDIENCE, GENERAL_TEMPLATES } from "../audience-repo";
import { ARCHETYPE_PERSONA_NAME } from "../persona-names";
import { ARCHETYPES } from "@/lib/engine/wave3/persona-registry";
import type { Audience, CalibratedPersona, GoalIntent } from "../audience-types";

// ── Fixtures ──────────────────────────────────────────────────────────────────
function persona(over: Partial<CalibratedPersona> & Pick<CalibratedPersona, "archetype">): CalibratedPersona {
  return {
    repaint: "The Skeptic — pressure-tests every claim for its weakest link.",
    temperature: "warm",
    disposition: "skeptic",
    share: 0.5,
    ...over,
  };
}

function mkAudience(over: Partial<Audience> = {}): Audience {
  return {
    id: "aud-1",
    user_id: "u-1",
    name: "Fitness Creators",
    type: "target",
    mode: "socials",
    platform: "tiktok",
    goal_label: "Grow my following",
    goal_intent: "grow",
    is_general: false,
    is_preset: false,
    persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
    personas: [
      persona({ archetype: "high_engager", label: "Coach Mia" }),
      persona({ archetype: "tough_crowd", repaint: "The Bar-Raiser — probes the biggest gap." }),
    ],
    profile: null,
    calibration: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...over,
  };
}

describe("audienceToActiveAudience — top-level fields", () => {
  it("passes id + platform through and keeps the calibrated name (non-general)", () => {
    const a = audienceToActiveAudience(mkAudience());
    expect(a.id).toBe("aud-1");
    expect(a.name).toBe("Fitness Creators");
    expect(a.platform).toBe("tiktok");
  });

  it("resolves the trust tier via resolveTier — socials → Validated", () => {
    expect(audienceToActiveAudience(mkAudience({ mode: "socials" })).tier).toBe("Validated");
  });

  it("resolves a general-mode audience → Directional (never Validated by rule)", () => {
    expect(audienceToActiveAudience(mkAudience({ mode: "general" })).tier).toBe("Directional");
  });
});

describe("audienceToActiveAudience — people (named, never the enum)", () => {
  it("maps personas → Person[] keyed by archetype, with the segment from the repaint", () => {
    const a = audienceToActiveAudience(mkAudience());
    expect(a.people).toHaveLength(2);
    expect(a.people[0]).toEqual({
      id: "high_engager",
      name: "Coach Mia", // creator label wins
      segment: "The Skeptic — pressure-tests every claim for its weakest link.",
    });
    expect(a.people[1]).toEqual({
      id: "tough_crowd",
      name: "Dev", // stable archetype default (no label)
      segment: "The Bar-Raiser — probes the biggest gap.",
    });
  });

  it("uses the stable archetype default name when no creator label is set", () => {
    const a = audienceToActiveAudience(
      mkAudience({ personas: [persona({ archetype: "loyalist" })] }),
    );
    expect(a.people[0]!.name).toBe(ARCHETYPE_PERSONA_NAME.loyalist); // "Theo"
  });

  it("NEVER renders a person's name as the raw archetype enum (THE-CONTRACT §2)", () => {
    const a = audienceToActiveAudience(
      mkAudience({ personas: ARCHETYPES.map((archetype) => persona({ archetype })) }),
    );
    expect(a.people).toHaveLength(ARCHETYPES.length);
    for (const p of a.people) {
      expect(ARCHETYPES).not.toContain(p.name);
      expect(p.name).not.toBe("Someone"); // every real archetype resolves to a real name
    }
  });

  it("falls back to the disposition when a persona has no repaint text", () => {
    const a = audienceToActiveAudience(
      mkAudience({ personas: [persona({ archetype: "saver", repaint: "  ", disposition: "collector" })] }),
    );
    expect(a.people[0]!.segment).toBe("collector");
  });
});

describe("audienceToActiveAudience — goal lens (§2.2)", () => {
  it("maps grow → Grow and sell → Sell", () => {
    expect(audienceToActiveAudience(mkAudience({ goal_intent: "grow" })).goal).toBe("Grow");
    expect(audienceToActiveAudience(mkAudience({ goal_intent: "sell" })).goal).toBe("Sell");
  });

  it("OMITS the goal field for authority / nurture / null (no Grow/Sell lens)", () => {
    for (const goal_intent of ["authority", "nurture", null] as (GoalIntent | null)[]) {
      const a = audienceToActiveAudience(mkAudience({ goal_intent }));
      expect(a.goal).toBeUndefined();
      expect("goal" in a).toBe(false); // omitted, not an explicit `undefined`
    }
  });
});

describe("audienceToActiveAudience — pulse (honest readiness, never a reaction)", () => {
  it("counts the real personas: 'Name · N people ready'", () => {
    expect(audienceToActiveAudience(mkAudience()).pulse).toBe("Fitness Creators · 2 people ready");
  });

  it("never reads like a live/stale reaction", () => {
    const a = audienceToActiveAudience(mkAudience());
    expect(a.pulse).toMatch(/people ready$/);
    expect(a.pulse).not.toMatch(/would stop|reacted|overnight/i);
  });
});

describe("audienceToActiveAudience — real virtual constants", () => {
  it("maps GENERAL_AUDIENCE → name 'General', no people, default-roster readiness", () => {
    const a = audienceToActiveAudience(GENERAL_AUDIENCE);
    expect(a.id).toBe("general");
    expect(a.name).toBe("General");
    expect(a.people).toEqual([]);
    expect(a.tier).toBe("Validated"); // General runs the Socials pack (mode: 'socials')
    expect(a.pulse).toBe("General · 10 people ready"); // empty personas → DEFAULT_ROSTER
    expect("goal" in a).toBe(false); // goal_intent: null
  });

  it("maps a GENERAL_TEMPLATES panel → Directional, named cast, real repaint segments", () => {
    const analyst = GENERAL_TEMPLATES.find((t) => t.id === "template-analyst")!;
    const a = audienceToActiveAudience(analyst);
    expect(a.name).toBe("Analyst Panel"); // is_general false → keeps its name
    expect(a.tier).toBe("Directional"); // mode: 'general'
    expect(a.pulse).toBe("Analyst Panel · 4 people ready");
    // The named cast + their real per-audience repaints (never the enum).
    expect(a.people.map((p) => p.name)).toEqual(["Dev", "Alex", "Robin", "Elena"]);
    expect(a.people[0]!.segment).toMatch(/^The Skeptic —/);
  });
});
