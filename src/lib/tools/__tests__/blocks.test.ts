/**
 * Tests for blocks.ts — block schema validation (Plan 08-05 Task 1).
 *
 * TDD RED phase for the new multi-audience-read block: written against the spec
 * (08-05-PLAN.md Task 1 <behavior>) before the schema is added to BlockUnionSchema.
 *
 * Honesty spine (Pitfall 5 / D-11): the multi-audience-read block carries bands
 * only (Strong/Mixed/Weak) + fraction + model "sim1-flash" — NEVER a numeric
 * 0-100 score. The schema MUST reject any payload carrying a numeric score field.
 *
 * Array shape (D-09): the `audiences` array is W4-ready — this plan uses a single
 * entry; Plan 08-06 extends it to 2.
 */
import { describe, it, expect } from "vitest";
import { BlockUnionSchema } from "../blocks";

// A valid single-audience multi-audience-read payload.
function validSingleAudiencePayload() {
  return {
    type: "multi-audience-read",
    props: {
      audiences: [
        {
          name: "Gen Z Founders",
          band: "Strong",
          fraction: "8/10 stop",
          interpretation:
            "The contrarian trap frame landed — even your skeptics saved it.",
          lever: "Protect the nine-word economy. Don't pad it.",
          whoNotFor: "Skeptics",
          personas: [
            { archetype: "tough_crowd", verdict: "scroll", quote: "Seen this opener before." },
            { archetype: "loyalist", verdict: "stop", quote: "Love an against-the-grain take." },
          ],
        },
      ],
      model: "sim1-flash",
    },
  };
}

describe("markdown block origin marker (chat-as-agent reload)", () => {
  it("validates a plain markdown block (no origin) — existing threads unchanged", () => {
    const result = BlockUnionSchema.safeParse({ type: "markdown", props: { text: "hello" } });
    expect(result.success).toBe(true);
  });

  it("preserves origin='chat-agent' through validation (survives rehydration, not stripped)", () => {
    const result = BlockUnionSchema.safeParse({
      type: "markdown",
      props: { text: "I've generated 3 ideas.", origin: "chat-agent" },
    });
    expect(result.success).toBe(true);
    // The marker MUST survive: a non-strict schema silently strips unknown props, which would drop the
    // reload signal. This asserts origin is a real, retained field.
    if (result.success) {
      expect((result.data.props as { origin?: string }).origin).toBe("chat-agent");
    }
  });
});

describe("multi-audience-read block schema (Plan 08-05)", () => {
  it("validates a single-audience payload", () => {
    const result = BlockUnionSchema.safeParse(validSingleAudiencePayload());
    expect(result.success).toBe(true);
  });

  it("rejects a payload carrying a numeric score field (Pitfall 5 — bands only)", () => {
    const payload = validSingleAudiencePayload();
    // Inject a forbidden numeric score onto an audience entry.
    (payload.props.audiences[0] as Record<string, unknown>).score = 87;

    const result = BlockUnionSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid band value", () => {
    const payload = validSingleAudiencePayload();
    (payload.props.audiences[0] as Record<string, unknown>).band = "Amazing";

    const result = BlockUnionSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects a non-flash model (provenance must be sim1-flash)", () => {
    const payload = validSingleAudiencePayload();
    (payload.props as Record<string, unknown>).model = "sim1-max";

    const result = BlockUnionSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("array shape is W4-ready — validates a 2-audience payload", () => {
    const payload = validSingleAudiencePayload();
    payload.props.audiences.push({
      name: "General",
      band: "Mixed",
      fraction: "5/10 stop",
      interpretation: "Mixed pull from the broad panel.",
      lever: "Tighten the opener.",
      whoNotFor: "Scanners",
      personas: [
        { archetype: "purposeful_viewer", verdict: "scroll", quote: "Waited for the lesson." },
      ],
    });

    const result = BlockUnionSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});

// ─── Phase 5: profile-read block (PROF-02) ────────────────────────────────────
// Bands-only `.strict()`; the forensic layer is max-tier-only; evidence quotes = provenance.

function validProfileReadFlashPayload() {
  return {
    type: "profile-read",
    props: {
      subjectName: "Marcus",
      subjectKind: "person",
      identity: {
        traits: ["dominant", "transactional"],
        commStyle: "clipped, status-driven",
        drivers: ["control", "being right"],
      },
      tells: [
        { tell: "Reframes every ask as a favor he's granting", evidence: "I'll let you have until Friday." },
      ],
      howTheyReact: "He'll push back hard on a soft ask, but respects a firm deadline.",
      goalScope: "Get him to commit to the Friday deadline.",
      caveat: "This is a behavioral read to inform your decision — directional, from limited evidence.",
      savedAudienceId: "aud_marcus_1",
      model: "sim1-flash",
      tier: "Directional",
    },
  };
}

function validProfileReadMaxPayload() {
  const p = validProfileReadFlashPayload();
  p.props.model = "sim1-max";
  (p.props as Record<string, unknown>).forensic = {
    deceptionLikelihood: "Medium",
    cues: [
      { timestamp: "0:42", observation: "shoulder shift + broken eye contact", inference: "discomfort with the number" },
    ],
  };
  return p;
}

describe("profile-read block schema (Plan 05-01)", () => {
  it("validates a flash-tier person read (no forensic layer)", () => {
    const result = BlockUnionSchema.safeParse(validProfileReadFlashPayload());
    expect(result.success).toBe(true);
  });

  it("validates a max-tier read carrying the forensic layer", () => {
    const result = BlockUnionSchema.safeParse(validProfileReadMaxPayload());
    expect(result.success).toBe(true);
  });

  it("rejects a smuggled numeric score (bands-only — .strict())", () => {
    const payload = validProfileReadFlashPayload();
    (payload.props as Record<string, unknown>).score = 87;
    expect(BlockUnionSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects a smuggled overall_score (bands-only — .strict())", () => {
    const payload = validProfileReadFlashPayload();
    (payload.props as Record<string, unknown>).overall_score = 91;
    expect(BlockUnionSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects a non-Directional tier (Directional by rule)", () => {
    const payload = validProfileReadFlashPayload();
    (payload.props as Record<string, unknown>).tier = "Validated";
    expect(BlockUnionSchema.safeParse(payload).success).toBe(false);
  });
});

// ─── Phase 5: reaction-distribution block (SIMU-02) ───────────────────────────
// person variant → `read` (no fraction); panel variant → band/fraction/themes/reactions.

function validReactionPersonPayload() {
  return {
    type: "reaction-distribution",
    props: {
      audienceName: "Marcus",
      subjectKind: "person",
      read: {
        verdict: "resistant",
        reasoning: "The soft framing reads as weakness to him; he'll counter.",
        quote: "Why would I move my whole timeline for that?",
      },
      model: "sim1-flash",
      tier: "Directional",
    },
  };
}

function validReactionPanelPayload() {
  return {
    type: "reaction-distribution",
    props: {
      audienceName: "Hiring panel",
      subjectKind: "panel",
      band: "Mixed",
      fraction: "6/10 react",
      themes: [
        { label: "Credibility doubt", quote: "I'd want to see the numbers first." },
      ],
      reactions: [
        { archetype: "skeptic", verdict: "scroll", quote: "Heard this pitch before." },
        { archetype: "champion", verdict: "stop", quote: "This is exactly our gap." },
      ],
      model: "sim1-flash",
      tier: "Directional",
    },
  };
}

describe("reaction-distribution block schema (Plan 05-01)", () => {
  it("validates a person variant (single read, no fraction)", () => {
    const result = BlockUnionSchema.safeParse(validReactionPersonPayload());
    expect(result.success).toBe(true);
  });

  it("validates a panel variant (band + fraction + themes + reactions)", () => {
    const result = BlockUnionSchema.safeParse(validReactionPanelPayload());
    expect(result.success).toBe(true);
  });

  it("rejects a smuggled numeric score (bands-only — .strict())", () => {
    const payload = validReactionPanelPayload();
    (payload.props as Record<string, unknown>).score = 73;
    expect(BlockUnionSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects an invalid band value", () => {
    const payload = validReactionPanelPayload();
    (payload.props as Record<string, unknown>).band = "Amazing";
    expect(BlockUnionSchema.safeParse(payload).success).toBe(false);
  });
});
