/**
 * ambient-v2-brain.test.ts — the Brain-depth adapter (Phase C, the VIDEO producer).
 *
 * Locks the honesty spine: the attention curve IS the real `weighted_curve` (scaled to the 0..80
 * axis); the transcript is the REAL verbatim (falls back to segment labels, never fabricated); the
 * signal rows are the four real craft dims (0..10 → 0..100), omitted when absent; the "why this
 * second" describes the MEASURED dip only; and the modeled-depth sections (signalGrid/networkBars/
 * kpiHeatmap/buyIntent/networks) render as MODELED proxies (full parity, owner call 2026-07-24) —
 * deterministic, coupled to the real stop rate + curve, carried by the one consolidated calibration line.
 */
import { describe, it, expect } from "vitest";
import {
  buildBrainFrameData,
  buildVideoDomainTemplate,
  curveBreak,
  hasBrainData,
  type BrainSnapshotInput,
} from "../ambient-v2-brain";
import { retentionCurveOf, watchStatsOf } from "../ambient-v2-drill";
import type { GeminiVideoSignals, HeatmapPayload, VerbatimPayload } from "@/lib/engine/types";

const HEATMAP: HeatmapPayload = {
  segments: [
    { idx: 0, t_start: 0, t_end: 3, label: "cold open", is_hook_zone: true, keyframe_uri: null },
    { idx: 1, t_start: 3, t_end: 6, label: "the claim", is_hook_zone: false, keyframe_uri: null },
    { idx: 2, t_start: 6, t_end: 9, label: "the stall", is_hook_zone: false, keyframe_uri: null },
    { idx: 3, t_start: 9, t_end: 12, label: "the payoff", is_hook_zone: false, keyframe_uri: null },
  ],
  // A REAL cast. This fixture used to carry `personas: []` beside a populated `weighted_curve` — a
  // shape production cannot emit, because the curve is COMPUTED from the personas. That mock is what
  // let the adapter read attention as retention for so long: with no personas there is no swipe data
  // to contradict it. Every persona holds the same attentions, so the weighted mean reproduces
  // `weighted_curve` exactly and the fixture is internally coherent.
  personas: [
    { id: "p1", slot_type: "fyp", attentions: [0.8, 0.7, 0.25, 0.5], swipe_predicted_at: 3, segment_reasons: {} },
    { id: "p2", slot_type: "fyp", attentions: [0.8, 0.7, 0.25, 0.5], swipe_predicted_at: 6, segment_reasons: {} },
    { id: "p3", slot_type: "fyp", attentions: [0.8, 0.7, 0.25, 0.5], swipe_predicted_at: 6, segment_reasons: {} },
    { id: "p4", slot_type: "fyp", attentions: [0.8, 0.7, 0.25, 0.5], swipe_predicted_at: 6, segment_reasons: {} },
    { id: "p5", slot_type: "fyp", attentions: [0.8, 0.7, 0.25, 0.5], swipe_predicted_at: 6, segment_reasons: {} },
    { id: "p6", slot_type: "fyp", attentions: [0.8, 0.7, 0.25, 0.5], swipe_predicted_at: null, segment_reasons: {} },
    { id: "p7", slot_type: "niche", attentions: [0.8, 0.7, 0.25, 0.5], swipe_predicted_at: null, segment_reasons: {} },
    { id: "p8", slot_type: "niche", attentions: [0.8, 0.7, 0.25, 0.5], swipe_predicted_at: null, segment_reasons: {} },
    { id: "p9", slot_type: "loyalist", attentions: [0.8, 0.7, 0.25, 0.5], swipe_predicted_at: null, segment_reasons: {} },
    { id: "p10", slot_type: "cross_niche", attentions: [0.8, 0.7, 0.25, 0.5], swipe_predicted_at: 9, segment_reasons: {} },
  ],
  weighted_curve: [0.8, 0.7, 0.25, 0.5], // ATTENTION: peak @ seg0 (0:00), dip @ seg2, RECOVERS @ seg3
  weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
  weights_source: "default",
  weighted_completion_pct: 0.56, // = mean(attentions), which is what this field actually holds
};

/** Retention implied by the swipe times above: 100% · 85% · 27% · 26%. Monotonic, unlike the
 *  attention curve beside it, and the collapse lands on seg2 (t=6) — the span the trim names. */
const EXPECTED_RETENTION = [1, 0.8539, 0.2697, 0.2584];

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

describe("buildBrainFrameData — modeled-depth parity (full render)", () => {
  const brain = buildBrainFrameData(base);
  it("emits every modeled Sapient-depth section (full parity with the authored template)", () => {
    expect(brain.signalGrid).toHaveLength(9);
    expect(brain.networkBars).toHaveLength(7);
    expect(brain.networks).toHaveLength(4);
    expect(brain.kpiHeatmap!.rows).toHaveLength(10);
    expect(brain.buyIntent).toBeUndefined(); // commerce-only figure — omitted for creator (matches authored)
  });
  it("the signalGrid Visual Pull anchors on the REAL craft dim (hook_visual_impact 8.5 → ~85)", () => {
    const visual = brain.signalGrid!.find((c) => c.key === "visual")!;
    // score = modeled·0.4 + craft(85)·0.6 → lands in the strong band, near the measured dim
    expect(visual.score).toBeGreaterThan(60);
    expect(brain.signalGrid!.every((c) => c.score >= 6 && c.score <= 96)).toBe(true);
  });
  it("the kpiHeatmap has one intensity per clip-second (0..100)", () => {
    const { seconds, rows } = brain.kpiHeatmap!;
    expect(rows.every((r) => r.values.length === seconds)).toBe(true);
    expect(rows.every((r) => r.values.every((v) => v >= 6 && v <= 100))).toBe(true);
  });
  it("the signalGrid SPREADS into a real story (not all one flat band)", () => {
    const tones = new Set(brain.signalGrid!.map((c) => c.tone));
    expect(tones.size).toBeGreaterThanOrEqual(2); // weak/okay/strong mix, not a flat wall of OKAY
  });
  it("is DETERMINISTIC — same stimulus, byte-identical proxies", () => {
    expect(buildBrainFrameData(base).signalGrid).toEqual(brain.signalGrid);
    expect(buildBrainFrameData(base).networkBars).toEqual(brain.networkBars);
    expect(buildBrainFrameData(base).kpiHeatmap).toEqual(brain.kpiHeatmap);
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
  it("passes a supplied population read through, plus the pool split off the fold's own weights", () => {
    const pop = { main: { kind: "tri-state" } } as never;
    const t = buildVideoDomainTemplate({ ...base, population: pop });
    expect(t.population).toMatchObject({ main: { kind: "tri-state" } });
    // The one taxonomy — relationship to the creator, from `heatmap.weights`. Nothing is invented:
    // a heatmap with no weights leaves the caller's object untouched (the next case).
    expect(t.population!.pools!.rows.map((r) => r.label)).toEqual([
      "New viewers",
      "Returning",
      "Followers",
      "Outside niche",
    ]);
  });

  it("adds no pool split when there are no weights to read — the absence is the honest answer", () => {
    const pop = { main: { kind: "tri-state" } } as never;
    const t = buildVideoDomainTemplate({ ...base, heatmap: { ...HEATMAP, weights: undefined as never }, population: pop });
    expect(t.population!.pools).toBeUndefined();
    expect(t.population).toMatchObject({ main: { kind: "tri-state" } });
    // With no follower split to read, the Audience hero falls back to the room's own hold rate —
    // and never to "would stop", which meant the GOOD outcome here and the loss everywhere else.
    expect(t.population!.heroVerdict).toEqual({ value: "38%", label: "kept watching" });
  });
});

// ── §3.2 — the unlock was structurally absent on EVERY real video drill ──────────────────────────
// `AmbientOverviewRail` cannot pass `reasons`: a video fold codes none by design. `modeledUnlock`
// needs one friction AND one pull reason, so it returned undefined and the page's only actionable
// element never rendered in production. The suite was green throughout, because every test that
// exercised the unlock handed it reasons the real mount never has.
describe("buildVideoDomainTemplate — the unlock a VIDEO drill actually gets (§3.2)", () => {
  it("emits an unlock with NO reasons at all — the real mount's exact input", () => {
    const t = buildVideoDomainTemplate(base);
    expect(t.unlock).toBeDefined();
    // the lever names the span to cut, read off the measured collapse (seg 2 starts at 0:06)
    expect(t.unlock!.lever).toBe("Trim 0:00–0:06");
    // and the insight is arithmetic on the same curve, not a template sentence. 73% is the share of
    // the ROOM gone by 0:06 — off the retention curve. Read off `weighted_curve` this said 75%, and
    // its companion figure was "200% of the room still watching stays to the end", because attention
    // RECOVERS from 0.25 to 0.5 across the break and a ratio of two attention values is not a share.
    expect(t.unlock!.insight).toMatch(/73%/);
    expect(t.unlock!.insight).toMatch(/96% of the room/);
    // no percentage anywhere in the sentence may exceed 100 — the tell that a ratio got read as a share
    for (const m of t.unlock!.insight.matchAll(/(\d+)%/g)) expect(Number(m[1])).toBeLessThanOrEqual(100);
  });

  it("still prefers the reason-derived lever when reasons DO exist", () => {
    const t = buildVideoDomainTemplate({
      ...base,
      reasons: [
        { reason: "too-slow", count: 253 },
        { reason: "strong-hook", count: 190 },
      ],
    });
    expect(t.unlock!.lever).toBe("Fix too slow");
  });

  it("omits the unlock on a curve that never breaks — an honest absence, not a fabricated lever", () => {
    // "Never breaks" is now a statement about people, so it is the SWIPE times that go flat. Flattening
    // `weighted_curve` no longer suppresses the break, and that is the point: attention was never what
    // the lever was about.
    const flat = { ...HEATMAP, personas: HEATMAP.personas.map((p) => ({ ...p, swipe_predicted_at: null })) };
    expect(buildVideoDomainTemplate({ ...base, heatmap: flat }).unlock).toBeUndefined();
  });

  it("omits it when the break is at 0:00 — there is nothing before the start to trim", () => {
    const early = {
      ...HEATMAP,
      personas: HEATMAP.personas.map((p) => ({ ...p, swipe_predicted_at: 0 })),
    };
    expect(buildVideoDomainTemplate({ ...base, heatmap: early }).unlock).toBeUndefined();
  });
});

// ── retention is NOT the attention curve ─────────────────────────────────────────────────────────
// `weighted_curve` is "weighted aggregate ATTENTION per segment" (engine/types.ts) — an intensity that
// legitimately rises. It was being drawn under the title "Retention", annotated "N% gone by 0:0X" and
// arithmetic'd into "Avg watch" / "Watched full". The share still watching comes from `swipe_predicted_at`.
describe("retentionCurveOf — the share still watching, derived from the swipe times", () => {
  it("never rises, while the attention curve beside it does", () => {
    const r = retentionCurveOf(HEATMAP)!;
    expect(r).toBeDefined();
    r.forEach((v, i) => expect(v).toBeCloseTo(EXPECTED_RETENTION[i]!, 3));
    // the guard that would have caught the shipped bug
    for (let i = 1; i < r.length; i++) expect(r[i]!).toBeLessThanOrEqual(r[i - 1]!);
    // ...and the curve it was confused with does NOT have that property
    const att = HEATMAP.weighted_curve;
    expect(att[3]!).toBeGreaterThan(att[2]!);
  });

  it("is null when no persona carries a swipe time — an absent producer, not a flat 100%", () => {
    const legacy = {
      ...HEATMAP,
      personas: HEATMAP.personas.map(({ swipe_predicted_at: _drop, ...rest }) => rest as (typeof HEATMAP.personas)[number]),
    };
    expect(retentionCurveOf(legacy)).toBeNull();
    // a PRESENT null is a real "watched to the end", and must still produce a curve
    const stayed = { ...HEATMAP, personas: HEATMAP.personas.map((p) => ({ ...p, swipe_predicted_at: null })) };
    expect(retentionCurveOf(stayed)).toEqual([1, 1, 1, 1]);
  });

  it("the break reports a share of the ROOM — 73% gone by 0:06, not 75% of the attention", () => {
    const brk = curveBreak(HEATMAP)!;
    expect(brk.atSec).toBe(6);
    expect(brk.heldPct).toBe(27);
    expect(brk.lostPct).toBe(73);
  });
});

describe("watchStatsOf — avg watch and watched-full, off the swipe times", () => {
  it("counts seconds actually watched, not mean attention x duration", () => {
    const s = watchStatsOf(HEATMAP, 12)!;
    // 0.65x3 + 4x0.65x6 + 0.65x12 + 2x0.20x12 + 0.10x12 + 0.05x9 = 31.8, over 4.45 of weight
    expect(s.avgWatchS).toBeCloseTo(7.146, 2);
    // the five who never swiped — NOT weighted_completion_pct (0.56), which is mean attention
    expect(s.completedShare).toBeCloseTo(0.2584, 3);
    const meanAttention = HEATMAP.weighted_curve.reduce((a, b) => a + b, 0) / 4;
    expect(s.completedShare).not.toBeCloseTo(meanAttention, 2);
  });

  it("a room that never swiped watched the whole clip", () => {
    const stayed = { ...HEATMAP, personas: HEATMAP.personas.map((p) => ({ ...p, swipe_predicted_at: null })) };
    const s = watchStatsOf(stayed, 12)!;
    expect(s.avgWatchS).toBeCloseTo(12, 5);
    expect(s.completedShare).toBe(1);
  });
});

describe("the Engagement frame the live drill actually renders", () => {
  it("names its scale, and every share it states is a share", () => {
    const t = buildVideoDomainTemplate(base);
    const e = t.engagement!;
    expect(e.watch!.meta).toBe("this clip · no baseline yet");
    expect(e.watch!.tiles.map((x) => x.value)).toEqual(["7.1s", "26%"]);
    expect(e.retention!.curve).toHaveLength(4);
    expect(e.retention!.anno).toBe("73% gone by 0:06");
    // the moment chips read off the same curve the headline claims — the contradiction that started this
    e.retention!.moments.forEach((m) => expect(m.pct).toBeLessThanOrEqual(100));
    const atBreak = e.retention!.moments.find((m) => m.at === 6);
    expect(atBreak?.pct).toBe(27);
  });

  it("drops the whole Engagement instrument when there is no swipe data to derive it from", () => {
    const legacy = {
      ...HEATMAP,
      personas: HEATMAP.personas.map(({ swipe_predicted_at: _drop, ...rest }) => rest as (typeof HEATMAP.personas)[number]),
    };
    const t = buildVideoDomainTemplate({ ...base, heatmap: legacy });
    expect(t.engagement?.retention).toBeUndefined();
    expect(t.engagement?.watch).toBeUndefined();
    expect(t.answer).toBeUndefined();
  });
});
