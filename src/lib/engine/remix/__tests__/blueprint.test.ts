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

  it("isolates the first cell when that cell is itself wider than the hook zone", () => {
    // 5s cells. No boundary at 3s AND the first cell already overruns the zone, so no cut can
    // make the opening beat 3s. Isolating cell 0 (0-5s) is the floor; merging four cells into
    // a 0-20s beat still labelled "hook" is the defect.
    const segments = Array.from({ length: 30 }, (_, i) => seg(i * 5, i * 5 + 5));
    const bp = buildBlueprint(structural({ segments }));
    expect(bp.beats[0]!.t_end).toBe(5);
    expect(bp.beats[0]!.duration_s).toBe(5);
    // ACCEPTED RESIDUAL: the beat is 5s and still labelled "hook". No cut can make it 3s —
    // splitting a cell would fabricate a boundary the perception never reported, and a hookless
    // blueprint is worse. Pinned here so the trade is a test, not just a comment. Task 6 renders
    // t_start/t_end beside the role, which is what makes a 0-5s "hook" self-describing.
    expect(bp.beats[0]!.role).toBe("hook");
  });

  it("does not snap to a distant boundary cluster — late cluster (talking head then montage)", () => {
    // 40 x 1.5s cells, real boundaries only from cell 30 on. Snapping every spread target to the
    // globally nearest boundary dragged all six cuts into the cluster: beat 1 spanned 3-45s.
    const segments = Array.from({ length: 40 }, (_, i) =>
      seg(i * 1.5, i * 1.5 + 1.5, i >= 30 ? { scene_boundary_reason: "shot change" } : {}),
    );
    const bp = buildBlueprint(structural({ segments }));
    const longest = Math.max(...bp.beats.map((b) => b.duration_s));
    expect(longest).toBeLessThanOrEqual(bp.duration_s * 0.4);
    for (let i = 1; i < bp.beats.length; i++) {
      expect(bp.beats[i]!.t_start).toBe(bp.beats[i - 1]!.t_end);
    }
  });

  it("spreads by ELAPSED TIME, not cell count, when cell widths vary wildly", () => {
    // 6 x 20s then 18 x 1s — a static talking head that cuts to a fast montage. The model path
    // can emit this: normalizeSegments enforces MIN_CELL_WIDTH_S but no maximum. Spreading by
    // cell index gives every cell equal weight, so the six wide cells collapse into two beats
    // (20-80s = 43% of the video) while eighteen 1s cells get six beats between them.
    // No scene boundaries here — the snap radius is not involved.
    const segments = [
      ...Array.from({ length: 6 }, (_, i) => seg(i * 20, i * 20 + 20)),
      ...Array.from({ length: 18 }, (_, i) => seg(120 + i, 121 + i)),
    ];
    const bp = buildBlueprint(structural({ segments }));

    expect(bp.duration_s).toBe(138);
    const longest = Math.max(...bp.beats.map((b) => b.duration_s));
    expect(longest).toBeLessThanOrEqual(bp.duration_s * 0.4);
    for (let i = 1; i < bp.beats.length; i++) {
      expect(bp.beats[i]!.t_start).toBe(bp.beats[i - 1]!.t_end);
    }
    expect(bp.beats.reduce((n, b) => n + b.cuts, 0)).toBe(segments.length);
  });

  it("does not snap to a distant boundary cluster — tight mid-video cluster", () => {
    // 30 x 2s cells, boundaries only at cells 20-22. Produced a 2-36s beat (57% of the video).
    const segments = Array.from({ length: 30 }, (_, i) =>
      seg(i * 2, i * 2 + 2, i >= 20 && i <= 22 ? { scene_boundary_reason: "cut" } : {}),
    );
    const bp = buildBlueprint(structural({ segments }));
    const longest = Math.max(...bp.beats.map((b) => b.duration_s));
    expect(longest).toBeLessThanOrEqual(bp.duration_s * 0.4);
    expect(bp.beats.reduce((n, b) => n + b.cuts, 0)).toBe(segments.length);
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

  it("puts the fallback turn mid-video, keeping setup beats before it", () => {
    // Peak inside the hook zone, so the turn cannot sit on its own peak and must fall back.
    // Taking the FIRST free beat put the turn at 3-11s of a 60s video with five payoffs after
    // it and no setup at all.
    const segments = buildFixedBuckets(60);
    const bp = buildBlueprint(structural({
      segments,
      emotion_arc: [{ timestamp_ms: 1000, intensity_0_1: 0.9 }],
    }));
    const roles = bp.beats.map((b) => b.role);
    expect(roles).toContain("setup");
    expect(roles).toContain("turn");
    expect(roles).toContain("payoff");
    const turnIdx = bp.beats.findIndex((b) => b.role === "turn");
    expect(turnIdx).toBeGreaterThanOrEqual(Math.floor(bp.beats.length / 2));
    // and it is genuinely past the opening of the video
    expect(bp.beats[turnIdx]!.t_start).toBeGreaterThan(bp.duration_s * 0.25);
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

  it("gives every factor the ROLE it asked for, in the schema's own emission order", () => {
    // The order HookFactorSchema emits. Emotional Charge is LAST, so a single-pass placement
    // lets an earlier factor's *fallback* claim take the turn beat out from under it.
    const segments = buildFixedBuckets(60);
    const bp = buildBlueprint(structural({
      segments,
      emotion_arc: [{ timestamp_ms: 30_000, intensity_0_1: 0.95 }],
      factors: [
        { name: "Scroll-Stop Power", score: 2, rationale: "a" },
        { name: "Completion Pull", score: 3, rationale: "b" },
        { name: "Rewatch Potential", score: 4, rationale: "c" },
        { name: "Share Trigger", score: 1, rationale: "d" },
        { name: "Emotional Charge", score: 4, rationale: "e" },
      ],
    }));

    const roleOf = (factor: string) =>
      bp.beats.find((b) => b.weakness?.factor === factor)?.role;

    expect(roleOf("Scroll-Stop Power")).toBe("hook");
    expect(roleOf("Completion Pull")).toBe("setup");
    expect(roleOf("Emotional Charge")).toBe("turn");
    expect(roleOf("Share Trigger")).toBe("close");
    // Rewatch Potential asks for no role at all, so it takes the longest-free fallback and
    // nothing it could have displaced is displaced. All four mapped factors get what they want.
    expect(roleOf("Rewatch Potential")).toBeDefined();
    expect(bp.beats.filter((b) => b.weakness !== null)).toHaveLength(5);
  });

  it("gives close to Share Trigger — Rewatch Potential claims no role of its own", () => {
    // Rewatch Potential is a whole-video property with no single home. While it was mapped to
    // `close` it won the beat on emission order and pushed Share Trigger onto a fallback, which
    // then reported a share problem against a setup beat in the middle of the video.
    const segments = buildFixedBuckets(60);
    const bp = buildBlueprint(structural({
      segments,
      emotion_arc: [{ timestamp_ms: 30_000, intensity_0_1: 0.95 }],
      factors: [
        { name: "Scroll-Stop Power", score: 2, rationale: "a" },
        { name: "Completion Pull", score: 3, rationale: "b" },
        { name: "Rewatch Potential", score: 4, rationale: "c" },
        { name: "Share Trigger", score: 1, rationale: "d" },
        { name: "Emotional Charge", score: 4, rationale: "e" },
      ],
    }));

    const roleOf = (factor: string) =>
      bp.beats.find((b) => b.weakness?.factor === factor)?.role;

    expect(roleOf("Share Trigger")).toBe("close");
    // Still placed — a factor is never dropped — but by the longest-free fallback, not a claim.
    expect(roleOf("Rewatch Potential")).toBeDefined();
    expect(roleOf("Rewatch Potential")).not.toBe("close");
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
