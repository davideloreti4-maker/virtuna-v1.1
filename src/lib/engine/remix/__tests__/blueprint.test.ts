import { describe, it, expect } from "vitest";
import { buildBlueprint, MAX_BEATS } from "../blueprint";
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
    expect(bp.beats.filter((b) => b.role === "turn").every((b) => b.index !== 0)).toBe(true);
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
    expect(bp.beats.slice(1, turnIdx).every((b) => b.role === "setup")).toBe(true);
  });

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

  it("attaches a weakness to the beat a low-scoring factor names", () => {
    const segments = [seg(0, 2), seg(2, 6)];
    const bp = buildBlueprint(structural({
      segments,
      factors: [{ name: "pacing", score: 4, rationale: "drags", improvement_tip: "cut earlier" }],
    }));
    expect(bp.beats.some((b) => b.weakness?.factor === "pacing")).toBe(true);
  });

  it("ignores factors that score well", () => {
    const segments = [seg(0, 2), seg(2, 6)];
    const bp = buildBlueprint(structural({
      segments,
      factors: [{ name: "pacing", score: 9, rationale: "tight" }],
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
