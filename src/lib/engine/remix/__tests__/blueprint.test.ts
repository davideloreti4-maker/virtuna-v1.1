import { describe, it, expect } from "vitest";
import { buildBlueprint, MAX_BEATS } from "../blueprint";
import { buildFixedBuckets } from "../../qwen/normalize-segments";
import type { OmniStructuralInput } from "../decode-types";

/** Minimal valid structural input; override per test. */
function structural(over: Partial<OmniStructuralInput> = {}): OmniStructuralInput {
  return {
    hook_decomposition: {
      visual_stop_power: 5, audio_hook_quality: 5, text_overlay_score: 5,
      first_words_speech_score: 5, weakest_modality: "audio_hook_quality",
      visual_audio_coherence: 5, cognitive_load: 5,
    },
    factors: [],
    video_signals: { visual_production_quality: 5, pacing_score: 5, transition_quality: 5 },
    content_summary: "", overall_impression: "",
    content_type: "talking_head", niche_primary_slug: "fitness",
    ...over,
  };
}

function seg(t_start: number, t_end: number, over: Record<string, unknown> = {}) {
  return {
    t_start, t_end,
    visual_event: `visual ${t_start}`,
    audio_event: `audio ${t_start}`,
    is_hook_zone: t_start < 3,
    spoken_text: `words at ${t_start}`,
    on_screen_text: null,
    ...over,
  };
}

describe("buildBlueprint", () => {
  it("merges more than MAX_BEATS raw segments down to at most MAX_BEATS", () => {
    const segments = Array.from({ length: 20 }, (_, i) => seg(i, i + 1));
    const bp = buildBlueprint(structural({ segments }));
    expect(bp.beats.length).toBeLessThanOrEqual(MAX_BEATS);
    expect(bp.beats.length).toBeGreaterThan(0);
  });

  it("preserves the full timeline across merged beats — no gaps, no overlap", () => {
    const segments = Array.from({ length: 20 }, (_, i) => seg(i, i + 1));
    const bp = buildBlueprint(structural({ segments }));
    expect(bp.beats[0]!.t_start).toBe(0);
    expect(bp.beats[bp.beats.length - 1]!.t_end).toBe(20);
    for (let i = 1; i < bp.beats.length; i++) {
      expect(bp.beats[i]!.t_start).toBe(bp.beats[i - 1]!.t_end);
    }
  });

  it("counts absorbed boundaries on each merged beat", () => {
    const segments = Array.from({ length: 20 }, (_, i) => seg(i, i + 1));
    const bp = buildBlueprint(structural({ segments }));
    const totalCuts = bp.beats.reduce((n, b) => n + b.cuts, 0);
    expect(totalCuts).toBe(20);
  });

  // ---------------------------------------------------------------------------
  // The scene_boundary_reason branch — the fallback grid, where every cell is a
  // "real" boundary. Input is the ACTUAL producer (buildFixedBuckets), not a
  // hand-rolled mirror of it, so this tracks the real fallback shape.
  // ---------------------------------------------------------------------------

  it("distributes the timeline when EVERY cell declares a scene boundary (fallback grid)", () => {
    const segments = buildFixedBuckets(60);
    // Guard the premise: this is the degenerate input, not an ordinary one.
    expect(segments.length).toBeGreaterThan(MAX_BEATS * 3);
    expect(segments.every((s) => !!s.scene_boundary_reason)).toBe(true);

    const bp = buildBlueprint(structural({ segments }));

    expect(bp.beats.length).toBe(MAX_BEATS);
    expect(bp.duration_s).toBe(60);
    // No beat may swallow the video. Keeping the earliest N boundaries put 75% in the last beat.
    const longest = Math.max(...bp.beats.map((b) => b.duration_s));
    expect(longest).toBeLessThanOrEqual(bp.duration_s * 0.4);
    // and the timeline is still continuous
    for (let i = 1; i < bp.beats.length; i++) {
      expect(bp.beats[i]!.t_start).toBe(bp.beats[i - 1]!.t_end);
    }
    expect(bp.beats.reduce((n, b) => n + b.cuts, 0)).toBe(segments.length);
  });

  it("keeps the hook beat inside the first 3s on a long merged video", () => {
    const segments = buildFixedBuckets(60);
    const bp = buildBlueprint(structural({ segments }));
    expect(bp.beats[0]!.role).toBe("hook");
    expect(bp.beats[0]!.t_end).toBeLessThanOrEqual(3);
    expect(bp.beats[0]!.duration_s).toBeLessThanOrEqual(3);
    // the 3s boundary survives the merge as a real cut
    expect(bp.beats[1]!.t_start).toBe(3);
  });

  it("keeps the hook beat inside the first 3s on a uniform grid with no scene boundaries", () => {
    const segments = Array.from({ length: 20 }, (_, i) => seg(i, i + 1));
    const bp = buildBlueprint(structural({ segments }));
    expect(bp.beats[0]!.role).toBe("hook");
    expect(bp.beats[0]!.t_end).toBeLessThanOrEqual(3);
  });

  it("never lets the hook beat run past 3s when no cell boundary lands on 3s", () => {
    // 2s cells: boundaries at 0,2,4,... — nothing at 3s. An even spread put the first cut at
    // cell 4, i.e. an 8s beat labelled "hook".
    const segments = Array.from({ length: 30 }, (_, i) => seg(i * 2, i * 2 + 2));
    const bp = buildBlueprint(structural({ segments }));
    expect(bp.beats[0]!.role).toBe("hook");
    expect(bp.beats[0]!.t_end).toBeLessThanOrEqual(3);
    expect(bp.beats.length).toBeLessThanOrEqual(MAX_BEATS);
  });

  // ---------------------------------------------------------------------------
  // Roles
  // ---------------------------------------------------------------------------

  it("tags the first-3s beat as hook EVEN WHEN the emotion peak also falls inside it", () => {
    const segments = [seg(0, 2), seg(2, 6), seg(6, 10)];
    const bp = buildBlueprint(structural({
      segments,
      emotion_arc: [
        { timestamp_ms: 1000, intensity_0_1: 0.9 }, // peak inside the hook zone
        { timestamp_ms: 8000, intensity_0_1: 0.2 },
      ],
    }));
    expect(bp.beats[0]!.role).toBe("hook");
    // hook wins the overlap, so `turn` is not also assigned to beat 0
    expect(bp.beats.some((b) => b.role === "turn")).toBe(true);
    expect(bp.beats.filter((b) => b.role === "turn").every((b) => b.index !== 0)).toBe(true);
  });

  it("still yields a turn AND a payoff when the emotion peak lands in the hook zone", () => {
    const segments = [seg(0, 2), seg(2, 6), seg(6, 10), seg(10, 14), seg(14, 18)];
    const bp = buildBlueprint(structural({
      segments,
      emotion_arc: [{ timestamp_ms: 1000, intensity_0_1: 0.9 }],
    }));
    const roles = bp.beats.map((b) => b.role);
    expect(roles).toContain("turn");
    expect(roles).toContain("payoff");
    expect(roles).toContain("close");
    expect(bp.beats[0]!.role).toBe("hook");
  });

  it("still yields a close when the emotion peak lands in the final beat", () => {
    const segments = [seg(0, 2), seg(2, 6), seg(6, 10), seg(10, 14)];
    const bp = buildBlueprint(structural({
      segments,
      emotion_arc: [{ timestamp_ms: 12000, intensity_0_1: 0.95 }],
    }));
    expect(bp.beats[bp.beats.length - 1]!.role).toBe("close");
    expect(bp.beats.some((b) => b.role === "turn")).toBe(true);
  });

  it("tags the emotion-peak beat as turn when the peak is outside the hook zone", () => {
    const segments = [seg(0, 2), seg(2, 6), seg(6, 10), seg(10, 14)];
    const bp = buildBlueprint(structural({
      segments,
      emotion_arc: [
        { timestamp_ms: 500, intensity_0_1: 0.2 },
        { timestamp_ms: 7000, intensity_0_1: 0.95 },
      ],
    }));
    const turn = bp.beats.find((b) => b.role === "turn");
    expect(turn).toBeDefined();
    expect(turn!.t_start).toBeLessThanOrEqual(7);
    expect(turn!.t_end).toBeGreaterThan(7);
  });

  it("tags the final beat close, and splits the rest setup/payoff around the turn", () => {
    const segments = [seg(0, 2), seg(2, 6), seg(6, 10), seg(10, 14), seg(14, 18)];
    const bp = buildBlueprint(structural({
      segments,
      emotion_arc: [{ timestamp_ms: 7000, intensity_0_1: 0.95 }],
    }));
    expect(bp.beats[bp.beats.length - 1]!.role).toBe("close");
    const turnIdx = bp.beats.findIndex((b) => b.role === "turn");
    expect(turnIdx).toBeGreaterThan(0);
    expect(bp.beats.slice(1, turnIdx).every((b) => b.role === "setup")).toBe(true);
    expect(bp.beats.slice(turnIdx + 1, -1).every((b) => b.role === "payoff")).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Speech
  // ---------------------------------------------------------------------------

  it("reports has_speech false and null spoken on a silent source", () => {
    const segments = [seg(0, 2, { spoken_text: null }), seg(2, 6, { spoken_text: null })];
    const bp = buildBlueprint(structural({ segments }));
    expect(bp.has_speech).toBe(false);
    expect(bp.beats.every((b) => b.spoken === null)).toBe(true);
    expect(bp.words_per_second).toBe(0);
  });

  it("computes words_per_second from real speech", () => {
    // 4 words over 2s, then 4 words over 2s => 8 words / 4s = 2.0
    const segments = [
      seg(0, 2, { spoken_text: "one two three four" }),
      seg(2, 4, { spoken_text: "five six seven eight" }),
    ];
    const bp = buildBlueprint(structural({ segments }));
    expect(bp.words_per_second).toBeCloseTo(2.0, 2);
    expect(bp.has_speech).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Weakness attachment — factor names are the CLOSED enum from
  // HookFactorSchema (qwen/schemas.ts). Anything else cannot reach this code.
  // ---------------------------------------------------------------------------

  it("attaches Scroll-Stop Power to the HOOK beat", () => {
    const segments = [seg(0, 2), seg(2, 6), seg(6, 10)];
    const bp = buildBlueprint(structural({
      segments,
      factors: [{
        name: "Scroll-Stop Power", score: 2,
        rationale: "nothing stops the scroll", improvement_tip: "open on the result",
      }],
    }));
    const hook = bp.beats.find((b) => b.role === "hook");
    expect(hook).toBeDefined();
    expect(hook!.weakness).toEqual({
      factor: "Scroll-Stop Power", score: 2, tip: "open on the result",
    });
    // and it landed there and nowhere else
    expect(bp.beats.filter((b) => b.weakness !== null)).toHaveLength(1);
  });

  it("attaches Emotional Charge to the TURN beat", () => {
    const segments = [seg(0, 2), seg(2, 6), seg(6, 10), seg(10, 14)];
    const bp = buildBlueprint(structural({
      segments,
      emotion_arc: [{ timestamp_ms: 7000, intensity_0_1: 0.95 }],
      factors: [{ name: "Emotional Charge", score: 3, rationale: "flat throughout" }],
    }));
    const turn = bp.beats.find((b) => b.role === "turn");
    expect(turn!.weakness?.factor).toBe("Emotional Charge");
    // improvement_tip absent → falls back to rationale
    expect(turn!.weakness?.tip).toBe("flat throughout");
  });

  it("keeps EVERY weak factor — a second factor targeting a taken beat falls back", () => {
    const segments = [seg(0, 2), seg(2, 6), seg(6, 10), seg(10, 14)];
    const bp = buildBlueprint(structural({
      segments,
      emotion_arc: [{ timestamp_ms: 7000, intensity_0_1: 0.95 }],
      factors: [
        // both of these target the close beat
        { name: "Share Trigger", score: 2, rationale: "no reason to send it" },
        { name: "Rewatch Potential", score: 3, rationale: "nothing to catch second time" },
      ],
    }));
    const attached = bp.beats.filter((b) => b.weakness !== null);
    expect(attached).toHaveLength(2);
    const names = attached.map((b) => b.weakness!.factor).sort();
    expect(names).toEqual(["Rewatch Potential", "Share Trigger"]);
  });

  it("places all five weak factors on distinct beats", () => {
    const segments = [seg(0, 2), seg(2, 6), seg(6, 10), seg(10, 14), seg(14, 18)];
    const bp = buildBlueprint(structural({
      segments,
      emotion_arc: [{ timestamp_ms: 7000, intensity_0_1: 0.95 }],
      factors: [
        { name: "Scroll-Stop Power", score: 2, rationale: "a" },
        { name: "Completion Pull", score: 3, rationale: "b" },
        { name: "Rewatch Potential", score: 4, rationale: "c" },
        { name: "Share Trigger", score: 1, rationale: "d" },
        { name: "Emotional Charge", score: 4, rationale: "e" },
      ],
    }));
    const attached = bp.beats.filter((b) => b.weakness !== null);
    expect(attached).toHaveLength(5);
    expect(new Set(attached.map((b) => b.index)).size).toBe(5);
  });

  it("ignores factors that score well", () => {
    const segments = [seg(0, 2), seg(2, 6)];
    const bp = buildBlueprint(structural({
      segments,
      factors: [{ name: "Completion Pull", score: 9, rationale: "tight" }],
    }));
    expect(bp.beats.every((b) => b.weakness === null)).toBe(true);
  });

  it("returns an empty-beat blueprint rather than throwing when segments are missing", () => {
    const bp = buildBlueprint(structural({ segments: undefined }));
    expect(bp.beats).toEqual([]);
    expect(bp.has_speech).toBe(false);
    expect(bp.duration_s).toBe(0);
  });
});
