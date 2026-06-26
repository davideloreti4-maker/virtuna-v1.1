/**
 * fold-prompts repaint (R1′b) — the Read fold simulates the calibrated audience.
 *
 * Two guarantees:
 *  1. No audience / General → buildFoldUserContent is BYTE-IDENTICAL to pre-R1′b — the
 *     regression-gate-safe no-op (same discipline as A1/S3): the new code path appends
 *     NOTHING unless a repaint is present.
 *  2. A calibrated repaint map appends each archetype's `audience_reaction_frame` (the
 *     deterministic stored frame) + one guidance line — so the fold reasons over THIS
 *     audience, not generic archetypes.
 *  + buildAudienceRepaint parity: the SIM + the fold build their repaint from ONE shared
 *    projection (null/General → undefined; calibrated → archetype→repaint map).
 */
import { describe, it, expect } from "vitest";
import { buildFoldUserContent } from "../fold-prompts";
import { selectPersonaSlots } from "../persona-registry";
import { buildAudienceRepaint } from "@/lib/engine/flash/build-reaction-panel";
import type { SegmentGrid, EmotionArcPoint } from "@/lib/engine/types";
import type { Audience } from "@/lib/audience/audience-types";

const slots = selectPersonaSlots(null, null);
// Distinct archetypes (the 10 slots may repeat an archetype — repetition encodes weighting).
// selectPersonaSlots(null,null) deterministically yields ≥2 distinct archetypes.
const distinct = [...new Set(slots.map((s) => s.archetype))];
const a0 = distinct[0]!;
const a1 = distinct[1]!;

const segments: SegmentGrid[] = [
  { idx: 0, t_start: 0, t_end: 2, visual_event: "hook shot", audio_event: "voiceover", is_hook_zone: true },
  { idx: 1, t_start: 2, t_end: 5, visual_event: "body shot", audio_event: "music", is_hook_zone: false },
];
const verbatim = "watch this to the end";
const emotionArc: EmotionArcPoint[] = [];

function textOf(content: ReturnType<typeof buildFoldUserContent>): string {
  const item = content.find((c) => c.type === "text") as { type: "text"; text: string };
  return item.text;
}

describe("fold repaint (R1′b)", () => {
  it("no audience → byte-identical no-op (regression-safe)", () => {
    const omitted = textOf(buildFoldUserContent(slots, segments, verbatim, emotionArc, null));
    const explicitUndefined = textOf(
      buildFoldUserContent(slots, segments, verbatim, emotionArc, null, undefined),
    );
    expect(explicitUndefined).toBe(omitted);
    // the new code path adds NOTHING when no repaint is present
    expect(omitted).not.toContain("audience_reaction_frame");
    expect(omitted).not.toContain("authoritative lens");
  });

  it("calibrated repaint appends each frame + the guidance line", () => {
    const repaint: Record<string, string> = {
      [a0]: "REPAINT_A: saves DIY hacks 2x category",
      [a1]: "REPAINT_B: scrolls past talking-head intros",
    };
    const out = textOf(buildFoldUserContent(slots, segments, verbatim, emotionArc, null, repaint));

    expect(out).toContain("audience_reaction_frame: REPAINT_A: saves DIY hacks 2x category");
    expect(out).toContain("audience_reaction_frame: REPAINT_B: scrolls past talking-head intros");
    expect(out).toContain("authoritative lens"); // the single guidance line

    // a slot whose archetype is NOT in the map keeps its plain line (no frame appended)
    const unpainted = slots.find((s) => !(s.archetype in repaint));
    expect(unpainted).toBeDefined();
    expect(out).toContain(
      `- ${unpainted!.archetype} | slot_type: ${unpainted!.slot_type} | persona_id: ${unpainted!.persona_id} | niche: ${unpainted!.niche ?? "general"}\n`,
    );
  });
});

describe("buildAudienceRepaint parity (SIM + fold share ONE projection)", () => {
  const calibrated: Audience = {
    id: "aud-1",
    user_id: "u1",
    name: "My Audience",
    type: "personal",
    platform: "tiktok",
    goal_label: null,
    goal_intent: "grow",
    is_general: false,
    is_preset: false,
    persona_weights: { fyp: 0.5, niche: 0.3, loyalist: 0.15, cross_niche: 0.05 },
    personas: [
      { archetype: a0, repaint: "frame A", temperature: "warm", disposition: "scanner", share: 0.5 },
      { archetype: a1, repaint: "frame B", temperature: "cold", disposition: "skeptic", share: 0.5 },
    ],
    profile: null,
    calibration: null,
    created_at: "2026-06-26T00:00:00.000Z",
    updated_at: "2026-06-26T00:00:00.000Z",
  };

  it("null / General / empty personas → undefined (byte-identical fold)", () => {
    expect(buildAudienceRepaint(null)).toBeUndefined();
    expect(buildAudienceRepaint({ ...calibrated, is_general: true })).toBeUndefined();
    expect(buildAudienceRepaint({ ...calibrated, personas: [] })).toBeUndefined();
  });

  it("calibrated → archetype→repaint map", () => {
    expect(buildAudienceRepaint(calibrated)).toEqual({
      [a0]: "frame A",
      [a1]: "frame B",
    });
  });
});
