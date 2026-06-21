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
