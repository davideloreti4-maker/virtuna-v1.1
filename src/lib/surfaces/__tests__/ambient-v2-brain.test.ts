/**
 * ambient-v2-brain.test.ts — the Brain-depth adapter (Phase C, the VIDEO producer).
 *
 * Locks the honesty spine: the attention curve IS the real `weighted_curve` (scaled to the 0..80
 * axis); the transcript is the REAL verbatim (falls back to segment labels, never fabricated); the
 * signal rows are the four real craft dims (0..10 → 0..100), omitted when absent; the "why this
 * second" describes the MEASURED dip only; and the four modeled Sapient-depth sections
 * (signalGrid/networkBars/kpiHeatmap/buyIntent/networks) are DELIBERATELY OMITTED.
 */
import { describe, it, expect } from "vitest";
import {
  buildBrainFrameData,
  buildVideoDomainTemplate,
  hasBrainData,
  type BrainSnapshotInput,
} from "../ambient-v2-brain";
import type { GeminiVideoSignals, HeatmapPayload, VerbatimPayload } from "@/lib/engine/types";

const HEATMAP: HeatmapPayload = {
  segments: [
    { idx: 0, t_start: 0, t_end: 3, label: "cold open", is_hook_zone: true, keyframe_uri: null },
    { idx: 1, t_start: 3, t_end: 6, label: "the claim", is_hook_zone: false, keyframe_uri: null },
    { idx: 2, t_start: 6, t_end: 9, label: "the stall", is_hook_zone: false, keyframe_uri: null },
    { idx: 3, t_start: 9, t_end: 12, label: "the payoff", is_hook_zone: false, keyframe_uri: null },
  ],
  personas: [],
  weighted_curve: [0.8, 0.7, 0.25, 0.5], // peak @ seg0 (0:00), dip @ seg2 (0:06)
  weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
  weights_source: "default",
  weighted_completion_pct: 0.56,
};

const SIGNALS: GeminiVideoSignals = {
  visual_production_quality: 7.2,
  hook_visual_impact: 8.5,
  pacing_score: 4.1,
  transition_quality: 3.0,
};

const VERBATIM: VerbatimPayload = {
  hook: { spoken_words: "I quit my 9-5", on_screen_text: null },
  segments: [
    { idx: 0, spoken_text: "I quit my nine to five", on_screen_text: null },
    { idx: 1, spoken_text: "with four hundred dollars", on_screen_text: null },
    { idx: 2, spoken_text: "here is what happened", on_screen_text: null },
    { idx: 3, spoken_text: "month one results", on_screen_text: null },
  ],
};

const base: BrainSnapshotInput = {
  heatmap: HEATMAP,
  videoSignals: SIGNALS,
  verbatim: VERBATIM,
  stopPct: 38,
  stimulusKey: "analysis-abc",
  conceptLabel: "hook",
};

describe("hasBrainData", () => {
  it("is true for a real curve, false for empty/absent", () => {
    expect(hasBrainData(HEATMAP)).toBe(true);
    expect(hasBrainData({ ...HEATMAP, weighted_curve: [] })).toBe(false);
    expect(hasBrainData(null)).toBe(false);
    expect(hasBrainData(undefined)).toBe(false);
  });
});

describe("buildBrainFrameData — attention driver (REAL curve)", () => {
  const brain = buildBrainFrameData(base);

  it("is an attention-scrubber whose points ARE the weighted_curve on the 0..80 axis", () => {
    expect(brain.driver.kind).toBe("attention-scrubber");
    const data = brain.driver.kind === "attention-scrubber" ? brain.driver.data : null;
    expect(data!.points).toEqual([64, 56, 20, 40]); // curve × 80, rounded
    expect(data!.points.every((v) => v >= 0 && v <= 80)).toBe(true);
  });

  it("clipSeconds is the last segment's end", () => {
    expect(brain.clipSeconds).toBe(12);
  });

  it("hold is the persisted weighted_completion_pct as a %", () => {
    const data = brain.driver.kind === "attention-scrubber" ? brain.driver.data : null;
    expect(data!.hold).toBe(56);
  });

  it("moments mark the real peak (0:00) and the deepest dip (0:06, coral)", () => {
    const data = brain.driver.kind === "attention-scrubber" ? brain.driver.data : null;
    const dip = data!.moments.find((m) => m.dip);
    expect(dip?.t).toBe("0:06");
    expect(dip?.v).toBe(20);
    expect(data!.moments.some((m) => m.t === "0:00" && !m.dip)).toBe(true);
  });

  it("transcript is the REAL joined spoken_text; peakWordIndex is in range", () => {
    const data = brain.driver.kind === "attention-scrubber" ? brain.driver.data : null;
    expect(data!.transcript).toContain("I quit my nine to five");
    const wc = data!.transcript.split(/\s+/).filter(Boolean).length;
    expect(data!.peakWordIndex).toBeGreaterThanOrEqual(0);
    expect(data!.peakWordIndex).toBeLessThan(wc);
  });
});

describe("buildBrainFrameData — signals (REAL craft dims)", () => {
  it("maps the four dims to 0..100 with honest bands", () => {
    const { signals } = buildBrainFrameData(base);
    expect(signals).toEqual([
      { label: "Visual pull", score: 85, band: "strong" },
      { label: "Production", score: 72, band: "strong" },
      { label: "Pacing", score: 41, band: "weak" },
      { label: "Transitions", score: 30, band: "weak" },
    ]);
  });

  it("omits vsBase (no per-creator baseline exists yet)", () => {
    const { signals } = buildBrainFrameData(base);
    expect(signals.every((s) => s.vsBase === undefined)).toBe(true);
  });

  it("is [] when craft dims are absent (text/degraded read)", () => {
    expect(buildBrainFrameData({ ...base, videoSignals: null }).signals).toEqual([]);
  });
});

describe("buildBrainFrameData — honesty: modeled sections OMITTED", () => {
  const brain = buildBrainFrameData(base);
  it("omits every NEW modeled Sapient-depth section", () => {
    expect(brain.signalGrid).toBeUndefined();
    expect(brain.networkBars).toBeUndefined();
    expect(brain.kpiHeatmap).toBeUndefined();
    expect(brain.buyIntent).toBeUndefined();
    expect(brain.networks).toBeUndefined();
  });
  it("carries the consolidated cortical-proxy honesty line", () => {
    expect(brain.calibrationNote).toMatch(/not measured attention/i);
  });
  it("stopRatio is the sealed verdict, cortexSeedKey is stable per stimulus", () => {
    expect(brain.stopRatio).toBeCloseTo(0.38);
    expect(brain.cortexSeedKey).toBe("analysis-abc");
  });
});

describe("buildBrainFrameData — whyThisSecond (MEASURED dip only)", () => {
  it("reads the deepest dip when the curve dips", () => {
    const w = buildBrainFrameData(base).whyThisSecond;
    expect(w?.moment).toBe("0:06 · the drop");
    expect(w?.segments.some((s) => s.loss)).toBe(true);
  });
  it("is omitted for an effectively flat curve (no decisive drop to claim)", () => {
    const flat = buildBrainFrameData({
      ...base,
      heatmap: { ...HEATMAP, weighted_curve: [0.6, 0.61, 0.59, 0.6] },
    });
    expect(flat.whyThisSecond).toBeUndefined();
  });
});

describe("transcript fallback (no fabrication)", () => {
  it("falls back to segment labels when verbatim is absent", () => {
    const brain = buildBrainFrameData({ ...base, verbatim: null });
    const data = brain.driver.kind === "attention-scrubber" ? brain.driver.data : null;
    expect(data!.transcript).toBe("cold open · the claim · the stall · the payoff");
  });
});

describe("buildVideoDomainTemplate", () => {
  it("attaches the REAL brain and a null population by default", () => {
    const t = buildVideoDomainTemplate(base);
    expect(t.brain).toBeDefined();
    expect(t.brain!.driver.kind).toBe("attention-scrubber");
    expect(t.population).toBeNull();
    expect(t.verdict).toEqual({ value: "38%", label: "would stop" });
    expect(t.pager).toBe("hook");
  });
  it("passes a supplied population read through", () => {
    const pop = { main: { kind: "tri-state" } } as never;
    const t = buildVideoDomainTemplate({ ...base, population: pop });
    expect(t.population).toBe(pop);
  });
});
