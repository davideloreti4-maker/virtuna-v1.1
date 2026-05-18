/**
 * Unit tests for Wave 0, Wave 3, Stage 10, Stage 11 no-op stubs.
 * Per CONTEXT.md D-16/17/18/19. Future phases (4, 7, 9) fill these with real V3 calls.
 */
import { describe, it, expect, vi } from "vitest";
import { runWave0 } from "../wave0";
import { runWave3 } from "../wave3";
import { runStage10Critique } from "../stage10-critique";
import { runStage11Counterfactuals } from "../stage11-counterfactuals";
import type { StageEvent } from "../events";
import type { ContentPayload, PredictionResult } from "../types";
import type { CreatorContext } from "../creator";

const fakePayload = {} as ContentPayload;
const fakeAggregate = {} as PredictionResult;
const fakeCreatorContext = {} as CreatorContext;

describe("Wave 0 backwards-compat (Phase 3 stub contract preserved by Phase 4 orchestrator)", () => {
  // Phase 4 widened the signature to runWave0(payload, creatorContext, onEvent?).
  // The detectors emit their own stage_start/stage_end pairs on the no-video path
  // (no_video_input_skipping_content_type warning), so the net "2 starts + 2 ends"
  // event count is preserved even though wave0.ts itself no longer emits events.
  // Both detectors return null when given an empty payload + missing env vars
  // (D-16 graceful degradation), so the result shape stays { content_type: null, niche: null }.

  it("returns { content_type: null, niche: null } when both detectors return null", async () => {
    const result = await runWave0(fakePayload, fakeCreatorContext);
    expect(result).toEqual({ content_type: null, niche: null });
  });

  it("emits 2 stage_start + 2 stage_end events with wave=0 (event ownership moved DOWN to detectors)", async () => {
    const cb = vi.fn();
    await runWave0(fakePayload, fakeCreatorContext, cb);
    const events = cb.mock.calls.map(c => c[0] as StageEvent);
    expect(events).toHaveLength(4);
    const starts = events.filter(e => e.type === "stage_start");
    const ends = events.filter(e => e.type === "stage_end");
    expect(starts).toHaveLength(2);
    expect(ends).toHaveLength(2);
    expect(starts.map(e => "stage" in e && e.stage).sort()).toEqual(["wave_0_content_type", "wave_0_niche_detector"]);
    for (const e of ends) {
      if (e.type === "stage_end") {
        expect(e.wave).toBe(0);
        expect(e.cost_cents).toBe(0);
      }
    }
  });

  it("accepts undefined callback without throwing", async () => {
    await expect(runWave0(fakePayload, fakeCreatorContext, undefined)).resolves.toBeDefined();
  });
});

describe("Wave 3 stub", () => {
  it("returns []", async () => {
    const result = await runWave3(fakePayload, null);
    expect(result).toEqual([]);
  });

  it("emits 1 stage_start + 1 stage_end with stage='wave_3_personas' and wave=3", async () => {
    const cb = vi.fn();
    await runWave3(fakePayload, null, cb);
    const events = cb.mock.calls.map(c => c[0] as StageEvent);
    expect(events).toHaveLength(2);
    const start = events.find(e => e.type === "stage_start");
    const end = events.find(e => e.type === "stage_end");
    if (start && start.type === "stage_start") {
      expect(start.stage).toBe("wave_3_personas");
      expect(start.wave).toBe(3);
    }
    if (end && end.type === "stage_end") {
      expect(end.cost_cents).toBe(0);
      expect(end.ok).toBe(true);
    }
  });
});

describe("Stage 10 critique stub", () => {
  it("returns null", async () => {
    const result = await runStage10Critique(fakeAggregate);
    expect(result).toBeNull();
  });

  it("emits start + end with wave='post' and stage='stage_10_critique'", async () => {
    const cb = vi.fn();
    await runStage10Critique(fakeAggregate, cb);
    const events = cb.mock.calls.map(c => c[0] as StageEvent);
    expect(events).toHaveLength(2);
    for (const e of events) {
      if ("wave" in e) expect(e.wave).toBe("post");
      if ("stage" in e && e.stage) expect(e.stage).toBe("stage_10_critique");
    }
  });
});

describe("Stage 11 counterfactuals stub", () => {
  it("returns null", async () => {
    const result = await runStage11Counterfactuals(fakeAggregate);
    expect(result).toBeNull();
  });

  it("emits start + end with wave='post' and stage='stage_11_counterfactuals'", async () => {
    const cb = vi.fn();
    await runStage11Counterfactuals(fakeAggregate, cb);
    const events = cb.mock.calls.map(c => c[0] as StageEvent);
    expect(events).toHaveLength(2);
    for (const e of events) {
      if ("wave" in e) expect(e.wave).toBe("post");
      if ("stage" in e && e.stage) expect(e.stage).toBe("stage_11_counterfactuals");
    }
  });
});
