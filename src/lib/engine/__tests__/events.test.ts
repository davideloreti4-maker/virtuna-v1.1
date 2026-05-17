/**
 * Unit tests for src/lib/engine/events.ts — StageEvent discriminated union + emit helpers.
 * Per CONTEXT.md D-02 (locked shape). Helpers use performance.now() (RESEARCH Anti-Pattern: never Date.now).
 */
import { describe, it, expect, vi } from "vitest";
import { emitStageStart, emitStageEnd, type StageEvent, type StageEventCallback } from "../events";

describe("events", () => {
  it("emitStageStart invokes callback with stage_start event", () => {
    const cb = vi.fn();
    const ts = emitStageStart(cb, "gemini_analysis", 1);
    expect(cb).toHaveBeenCalledTimes(1);
    const evt = cb.mock.calls[0][0] as StageEvent;
    expect(evt.type).toBe("stage_start");
    if (evt.type === "stage_start") {
      expect(evt.stage).toBe("gemini_analysis");
      expect(evt.wave).toBe(1);
      expect(evt.timestamp_ms).toBe(ts);
    }
  });

  it("emitStageEnd computes duration and defaults cost_cents=0, ok=true", () => {
    const cb = vi.fn();
    const start = emitStageStart(cb, "rule_scoring", 1);
    emitStageEnd(cb, "rule_scoring", 1, start);
    expect(cb).toHaveBeenCalledTimes(2);
    const endEvt = cb.mock.calls[1][0] as StageEvent;
    expect(endEvt.type).toBe("stage_end");
    if (endEvt.type === "stage_end") {
      expect(endEvt.cost_cents).toBe(0);
      expect(endEvt.ok).toBe(true);
      expect(endEvt.duration_ms).toBeGreaterThanOrEqual(0);
    }
  });

  it("emitStageEnd accepts cost_cents and warning overrides", () => {
    const cb = vi.fn();
    const start = emitStageStart(cb, "deepseek_reasoning", 2);
    emitStageEnd(cb, "deepseek_reasoning", 2, start, { cost_cents: 12, ok: false, warning: "DeepSeek timeout" });
    const endEvt = cb.mock.calls[1][0] as StageEvent;
    if (endEvt.type === "stage_end") {
      expect(endEvt.cost_cents).toBe(12);
      expect(endEvt.ok).toBe(false);
      expect(endEvt.warning).toBe("DeepSeek timeout");
    }
  });

  it("undefined callback is a no-op (does not throw)", () => {
    expect(() => emitStageStart(undefined as StageEventCallback | undefined, "foo", 0)).not.toThrow();
    expect(() => emitStageEnd(undefined as StageEventCallback | undefined, "foo", 0, performance.now())).not.toThrow();
  });

  it("wave field accepts 0|1|2|3|aggregator|post", () => {
    const cb = vi.fn();
    const waves: Array<StageEvent extends { wave: infer W } ? W : never> = [0, 1, 2, 3, "aggregator", "post"];
    for (const w of waves) {
      emitStageStart(cb, "x", w as 0);
    }
    expect(cb).toHaveBeenCalledTimes(6);
  });
});
