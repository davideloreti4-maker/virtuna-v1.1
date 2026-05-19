/**
 * Unit tests for src/lib/engine/gemini/merge.ts — Phase 5 Plan 02 Task 2.
 *
 * Covers all 8 partial-failure permutations (HHH/HHF/HFH/HFF/FHH/FHF/FFH/FFF) per
 * CONTEXT D-08 (one pipeline_warning per failed segment, null-fill missing data)
 * and CONTEXT D-09 (3-of-3 failure → consolidated `gemini_video_unavailable` warning
 * + analysis: null). Also covers cost summation and hook_visual_impact passthrough.
 *
 * mergeSegments is a pure function over PromiseSettledResult inputs — no @google/genai
 * mocking needed. Inputs are synthesized from fixture builders below.
 */
import { describe, it, expect, vi } from "vitest";
import { mergeSegments } from "../gemini/merge";
import type {
  HookSegmentResult,
  BodySegmentResult,
  CtaSegmentResult,
} from "../gemini/schemas";
import type { SegmentResult } from "../gemini/hook-segment";
import type { StageEvent } from "../events";

// ===========================================================================
// Fixtures + fixture builders
// ===========================================================================

const HOOK_FIXTURE: HookSegmentResult = {
  factors: [
    {
      name: "Scroll-Stop Power",
      score: 7,
      rationale: "Strong face-first frame",
      improvement_tip: "Add motion in first 0.5s",
    },
    {
      name: "Completion Pull",
      score: 6,
      rationale: "Promises payoff",
      improvement_tip: "Tighten promise",
    },
    {
      name: "Rewatch Potential",
      score: 5,
      rationale: "Single-watch",
      improvement_tip: "Add hidden detail",
    },
    {
      name: "Share Trigger",
      score: 5,
      rationale: "Relatable",
      improvement_tip: "End with question",
    },
    {
      name: "Emotional Charge",
      score: 6,
      rationale: "Energetic",
      improvement_tip: "Sharpen mood",
    },
  ],
  overall_impression: "Solid hook",
  content_summary: "Beauty tutorial opener",
  hook_decomposition: {
    visual_stop_power: 7.5,
    audio_hook_quality: 6.0,
    text_overlay_score: 4.5,
    first_words_speech_score: 7.0,
    weakest_modality: "text_overlay_score",
    visual_audio_coherence: 7.0,
    cognitive_load: 3.0,
  },
};

const BODY_FIXTURE: BodySegmentResult = {
  video_signals: {
    visual_production_quality: 7,
    pacing_score: 6,
    transition_quality: 5,
  },
  body_summary: "Steady three-beat pacing through the middle.",
};

const CTA_FIXTURE: CtaSegmentResult = {
  cta_present: true,
  strength: 7,
  type: "follow",
  rationale: "Creator says 'follow for more' at 28s",
};

function fulfilledOk<T>(
  analysis: T,
  cost: number = 1.0,
  model: string = "test-model",
): PromiseFulfilledResult<SegmentResult<T>> {
  return {
    status: "fulfilled",
    value: { ok: true, analysis, cost_cents: cost, model },
  };
}

function fulfilledFail<T>(
  errorMessage: string = "synthetic failure",
): PromiseFulfilledResult<SegmentResult<T>> {
  return {
    status: "fulfilled",
    value: { ok: false, error: new Error(errorMessage) },
  };
}

function rejected<T>(
  errorMessage: string = "synthetic rejection",
): PromiseRejectedResult {
  // Cast via the unused generic so the test callsites can type-bind to the segment type.
  void ({} as T);
  return { status: "rejected", reason: new Error(errorMessage) };
}

function collectWarnings(events: StageEvent[]): Array<{
  stage?: string;
  message: string;
}> {
  return events
    .filter((e) => e.type === "pipeline_warning")
    .map((e) => ({
      stage: (e as { stage?: string }).stage,
      message: (e as { message: string }).message,
    }));
}

describe("mergeSegments — Phase 5 Plan 02 Task 2", () => {
  it("Test 1 (HHH — all success): merged shape pulls from each segment with zero warnings", () => {
    const events: StageEvent[] = [];
    const result = mergeSegments(
      fulfilledOk(HOOK_FIXTURE, 1.3),
      fulfilledOk(BODY_FIXTURE, 0.5),
      fulfilledOk(CTA_FIXTURE, 0.2),
      (e) => events.push(e),
    );

    expect(result.analysis).not.toBeNull();
    expect(result.analysis!.factors).toEqual(HOOK_FIXTURE.factors);
    expect(result.analysis!.hook_decomposition).toEqual(HOOK_FIXTURE.hook_decomposition);
    expect(result.analysis!.video_signals.visual_production_quality).toBe(7);
    expect(result.analysis!.video_signals.pacing_score).toBe(6);
    expect(result.analysis!.video_signals.transition_quality).toBe(5);
    // hook_visual_impact passthrough from hook.hook_decomposition.visual_stop_power
    expect(result.analysis!.video_signals.hook_visual_impact).toBe(7.5);
    expect(result.analysis!.cta_segment).toEqual(CTA_FIXTURE);
    expect(result.signalAvailability).toEqual({
      gemini_hook: true,
      gemini_body: true,
      gemini_cta: true,
    });
    expect(collectWarnings(events)).toHaveLength(0);
  });

  it("Test 2 (HHF — CTA failed): cta_segment is null, ONE pipeline_warning fires for gemini_cta", () => {
    const events: StageEvent[] = [];
    const result = mergeSegments(
      fulfilledOk(HOOK_FIXTURE, 1.3),
      fulfilledOk(BODY_FIXTURE, 0.5),
      fulfilledFail<CtaSegmentResult>(),
      (e) => events.push(e),
    );

    expect(result.analysis).not.toBeNull();
    expect(result.analysis!.cta_segment).toBeNull();
    expect(result.analysis!.factors).toEqual(HOOK_FIXTURE.factors);
    expect(result.analysis!.video_signals.visual_production_quality).toBe(7);
    expect(result.signalAvailability).toEqual({
      gemini_hook: true,
      gemini_body: true,
      gemini_cta: false,
    });
    const warnings = collectWarnings(events);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.stage).toBe("gemini_cta");
  });

  it("Test 3 (HFH — body failed): body video_signals null-filled, hook_visual_impact still populated", () => {
    const events: StageEvent[] = [];
    const result = mergeSegments(
      fulfilledOk(HOOK_FIXTURE, 1.3),
      fulfilledFail<BodySegmentResult>(),
      fulfilledOk(CTA_FIXTURE, 0.2),
      (e) => events.push(e),
    );

    expect(result.analysis).not.toBeNull();
    expect(result.analysis!.video_signals.visual_production_quality).toBe(0);
    expect(result.analysis!.video_signals.pacing_score).toBe(0);
    expect(result.analysis!.video_signals.transition_quality).toBe(0);
    // hook_visual_impact still populated from hook
    expect(result.analysis!.video_signals.hook_visual_impact).toBe(7.5);
    expect(result.analysis!.cta_segment).toEqual(CTA_FIXTURE);
    expect(result.signalAvailability).toEqual({
      gemini_hook: true,
      gemini_body: false,
      gemini_cta: true,
    });
    const warnings = collectWarnings(events);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.stage).toBe("gemini_body");
  });

  it("Test 4 (FHH — hook failed): factors are DEFAULT_NULL_FACTORS, hook_decomposition null, hook_visual_impact null/zero", () => {
    const events: StageEvent[] = [];
    const result = mergeSegments(
      fulfilledFail<HookSegmentResult>(),
      fulfilledOk(BODY_FIXTURE, 0.5),
      fulfilledOk(CTA_FIXTURE, 0.2),
      (e) => events.push(e),
    );

    expect(result.analysis).not.toBeNull();
    expect(result.analysis!.factors).toHaveLength(5);
    for (const f of result.analysis!.factors) {
      expect(f.score).toBe(0);
      expect(f.rationale).toBe("Hook analysis unavailable");
    }
    expect(result.analysis!.hook_decomposition).toBeNull();
    // hook fail → hook_visual_impact uses structural fallback 0
    expect(result.analysis!.video_signals.hook_visual_impact).toBe(0);
    // body + CTA fields intact
    expect(result.analysis!.video_signals.visual_production_quality).toBe(7);
    expect(result.analysis!.cta_segment).toEqual(CTA_FIXTURE);
    expect(result.signalAvailability).toEqual({
      gemini_hook: false,
      gemini_body: true,
      gemini_cta: true,
    });
    const warnings = collectWarnings(events);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.stage).toBe("gemini_hook");
  });

  it("Test 5 (HFF — body + CTA failed): two pipeline_warning events, hook intact, null fields elsewhere", () => {
    const events: StageEvent[] = [];
    const result = mergeSegments(
      fulfilledOk(HOOK_FIXTURE, 1.3),
      fulfilledFail<BodySegmentResult>(),
      fulfilledFail<CtaSegmentResult>(),
      (e) => events.push(e),
    );

    expect(result.analysis).not.toBeNull();
    expect(result.analysis!.factors).toEqual(HOOK_FIXTURE.factors);
    expect(result.analysis!.hook_decomposition).toEqual(HOOK_FIXTURE.hook_decomposition);
    expect(result.analysis!.cta_segment).toBeNull();
    expect(result.signalAvailability).toEqual({
      gemini_hook: true,
      gemini_body: false,
      gemini_cta: false,
    });
    const warnings = collectWarnings(events);
    expect(warnings).toHaveLength(2);
    const stages = warnings.map((w) => w.stage).sort();
    expect(stages).toEqual(["gemini_body", "gemini_cta"]);
  });

  it("Test 6 (FHF — hook + CTA failed): two pipeline_warning events, body data preserved", () => {
    const events: StageEvent[] = [];
    const result = mergeSegments(
      fulfilledFail<HookSegmentResult>(),
      fulfilledOk(BODY_FIXTURE, 0.5),
      fulfilledFail<CtaSegmentResult>(),
      (e) => events.push(e),
    );

    expect(result.analysis).not.toBeNull();
    expect(result.analysis!.video_signals.visual_production_quality).toBe(7);
    expect(result.analysis!.hook_decomposition).toBeNull();
    expect(result.analysis!.cta_segment).toBeNull();
    expect(result.signalAvailability).toEqual({
      gemini_hook: false,
      gemini_body: true,
      gemini_cta: false,
    });
    const warnings = collectWarnings(events);
    expect(warnings).toHaveLength(2);
    const stages = warnings.map((w) => w.stage).sort();
    expect(stages).toEqual(["gemini_cta", "gemini_hook"]);
  });

  it("Test 7 (FFH — hook + body failed): two pipeline_warning events, CTA data preserved", () => {
    const events: StageEvent[] = [];
    const result = mergeSegments(
      fulfilledFail<HookSegmentResult>(),
      fulfilledFail<BodySegmentResult>(),
      fulfilledOk(CTA_FIXTURE, 0.2),
      (e) => events.push(e),
    );

    expect(result.analysis).not.toBeNull();
    expect(result.analysis!.hook_decomposition).toBeNull();
    expect(result.analysis!.video_signals.visual_production_quality).toBe(0);
    expect(result.analysis!.cta_segment).toEqual(CTA_FIXTURE);
    expect(result.signalAvailability).toEqual({
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: true,
    });
    const warnings = collectWarnings(events);
    expect(warnings).toHaveLength(2);
    const stages = warnings.map((w) => w.stage).sort();
    expect(stages).toEqual(["gemini_body", "gemini_hook"]);
  });

  it("Test 8 (FFF — all failed): analysis === null, cost_cents === 0, ONE consolidated `gemini_video_unavailable` warning (D-09)", () => {
    const events: StageEvent[] = [];
    const result = mergeSegments(
      fulfilledFail<HookSegmentResult>(),
      fulfilledFail<BodySegmentResult>(),
      fulfilledFail<CtaSegmentResult>(),
      (e) => events.push(e),
    );

    expect(result.analysis).toBeNull();
    expect(result.cost_cents).toBe(0);
    expect(result.signalAvailability).toEqual({
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
    });
    const warnings = collectWarnings(events);
    // D-09: ONE consolidated warning, NOT three.
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.stage).toBe("gemini_video_unavailable");
  });

  it("Test 9 (cost_cents summation): HHH sums all three; HFF sums only the hook cost", () => {
    const eventsHHH: StageEvent[] = [];
    const hhh = mergeSegments(
      fulfilledOk(HOOK_FIXTURE, 1.3),
      fulfilledOk(BODY_FIXTURE, 0.5),
      fulfilledOk(CTA_FIXTURE, 0.2),
      (e) => eventsHHH.push(e),
    );
    expect(hhh.cost_cents).toBeCloseTo(2.0, 5);

    const eventsHFF: StageEvent[] = [];
    const hff = mergeSegments(
      fulfilledOk(HOOK_FIXTURE, 1.3),
      fulfilledFail<BodySegmentResult>(),
      fulfilledFail<CtaSegmentResult>(),
      (e) => eventsHFF.push(e),
    );
    expect(hff.cost_cents).toBeCloseTo(1.3, 5);
  });

  it("Test 10 (hook_visual_impact passthrough): equals hook.hook_decomposition.visual_stop_power when hook ok; 0 when hook fails", () => {
    const eventsOk: StageEvent[] = [];
    const okResult = mergeSegments(
      fulfilledOk(HOOK_FIXTURE, 1.3),
      fulfilledOk(BODY_FIXTURE, 0.5),
      fulfilledOk(CTA_FIXTURE, 0.2),
      (e) => eventsOk.push(e),
    );
    expect(okResult.analysis!.video_signals.hook_visual_impact).toBe(
      HOOK_FIXTURE.hook_decomposition.visual_stop_power,
    );

    const eventsFail: StageEvent[] = [];
    const failResult = mergeSegments(
      fulfilledFail<HookSegmentResult>(),
      fulfilledOk(BODY_FIXTURE, 0.5),
      fulfilledOk(CTA_FIXTURE, 0.2),
      (e) => eventsFail.push(e),
    );
    expect(failResult.analysis!.video_signals.hook_visual_impact).toBe(0);
  });

  it("Test 11 (rejected status — Promise.allSettled rejection treated as failure)", () => {
    // mergeSegments must handle status: "rejected" identically to ok: false.
    const events: StageEvent[] = [];
    const result = mergeSegments(
      fulfilledOk(HOOK_FIXTURE, 1.3),
      rejected<BodySegmentResult>("body promise rejected"),
      fulfilledOk(CTA_FIXTURE, 0.2),
      (e) => events.push(e),
    );

    expect(result.analysis).not.toBeNull();
    expect(result.signalAvailability.gemini_body).toBe(false);
    const warnings = collectWarnings(events);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.stage).toBe("gemini_body");
  });

  it("Test 12 (no callback passed): function is safe when onStageEvent is undefined", () => {
    // Smoke test: no callback → no exceptions, signalAvailability still correct.
    const spy = vi.fn();
    const result = mergeSegments(
      fulfilledOk(HOOK_FIXTURE, 1.3),
      fulfilledFail<BodySegmentResult>(),
      fulfilledOk(CTA_FIXTURE, 0.2),
      undefined,
    );
    expect(result.analysis).not.toBeNull();
    expect(result.signalAvailability.gemini_body).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});
