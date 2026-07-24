/**
 * ambient-v2-population.test.ts — the Population-depth adapter (Phase C).
 *
 * Locks the honesty spine: text tri-state has NO skim band (binary verdict); the modeled-depth
 * sections (audienceFit / amplification / swing) render as MODELED proxies (full parity, owner call
 * 2026-07-24) derived from the REAL segment stop rates; terrain districts + loss index + coded reasons
 * are the projection's REAL numbers; layout is deterministic.
 */
import { describe, it, expect } from "vitest";
import {
  buildPopulationFrameData,
  buildReasonBrainFrameData,
  buildDomainTemplate,
  type PopulationSnapshotInput,
} from "../ambient-v2-population";
import type { PopulationAggregate } from "@/lib/audience/population";

const AGG: PopulationAggregate = {
  total: 1000,
  stop: 620,
  scroll: 380,
  stopPct: 62,
  segments: [
    { archetype: "builder", displayName: "builders", share: 0.4, total: 400, stop: 340, stopPct: 85 },
    { archetype: "scroller", displayName: "scrollers", share: 0.35, total: 350, stop: 200, stopPct: 57 },
    { archetype: "skeptic", displayName: "skeptics", share: 0.25, total: 250, stop: 80, stopPct: 32 },
  ],
  reasons: [
    { reason: "The payoff comes too late", count: 253 },
    { reason: "The stake feels real", count: 190 },
  ],
};

const PERSONAS: PopulationSnapshotInput["personas"] = [
  { archetype: "skeptic", verdict: "scroll", quote: "i'd be gone before the point lands" },
  { archetype: "builder", verdict: "stop", quote: "that detail made me stay" },
];

const base: PopulationSnapshotInput = {
  aggregate: AGG,
  personas: PERSONAS,
  calibratedFrom: "your 4.2k followers",
  tier: "max",
};

describe("buildPopulationFrameData", () => {
  it("tri-state is binary — skim band is honestly 0, stopped = stopPct", () => {
    const p = buildPopulationFrameData(base);
    expect(p.main.kind).toBe("tri-state");
    if (p.main.kind !== "tri-state") throw new Error("expected tri-state");
    expect(p.main.data).toEqual({ stopped: 62, skimmed: 0, scrolled: 38 });
  });

  it("emits the modeled-depth sections, each derived from the REAL segment numbers", () => {
    const p = buildPopulationFrameData(base);
    // audienceFit: builders (85% vs 62% mean) over-index; skeptics (32%) cool + carry loss
    expect(p.audienceFit!.rows[0]!.label).toBe("builders");
    expect(p.audienceFit!.rows[0]!.index).toBeGreaterThan(0);
    const skeptic = p.audienceFit!.rows.find((r) => r.label === "skeptics")!;
    expect(skeptic.index).toBeLessThan(0);
    expect(skeptic.loss).toBe(true);
    // amplification: cascade top = the real sample; builders lead the carriers (highest reshare prior)
    expect(p.amplification!.cascade[0]).toEqual({ label: "saw it", count: 1000 });
    expect(p.amplification!.carriers[0]!.label).toBe("builders");
    expect(p.amplification!.carriers[0]!.lead).toBe(true);
    // swing: a real fence-sitter count + a bounded modeled gain (from → to)
    expect(p.swing!.fromPct).toBe(62);
    expect(p.swing!.toPct).toBeGreaterThan(p.swing!.fromPct);
    expect(p.swing!.gainLabel).toMatch(/would stop/);
  });

  it("the modeled-depth sections are DETERMINISTIC (byte-identical across calls)", () => {
    const a = buildPopulationFrameData(base);
    const b = buildPopulationFrameData(base);
    expect(a.audienceFit).toEqual(b.audienceFit);
    expect(a.amplification).toEqual(b.amplification);
    expect(a.swing).toEqual(b.swing);
  });

  it("counts are en-US grouped regardless of machine locale (1,000 — never European 1.000)", () => {
    const p = buildPopulationFrameData(base);
    if (p.main.kind !== "tri-state") throw new Error("expected tri-state");
    expect(p.main.percentileLine).toContain("1,000");
    expect(p.voices.kicker).toContain("1,000");
    expect(p.main.percentileLine).not.toContain("1.000");
  });

  it("terrain districts are the real segments; loss index = lowest stop rate", () => {
    const p = buildPopulationFrameData(base);
    expect(p.terrain.clusters.map((c) => c.name)).toEqual(["builders", "scrollers", "skeptics"]);
    expect(p.terrain.clusters[0]!.lit).toBeCloseTo(0.85); // builders' real stop rate
    expect(p.terrain.lossClusterIndex).toBe(2); // skeptics, 32% — the loudest no
  });

  it("terrain layout is deterministic + inside the viewBox", () => {
    const a = buildPopulationFrameData(base).terrain.clusters;
    const b = buildPopulationFrameData(base).terrain.clusters;
    expect(a).toEqual(b);
    for (const c of a) {
      expect(c.cx).toBeGreaterThanOrEqual(0);
      expect(c.cx).toBeLessThanOrEqual(380);
      expect(c.cy).toBeGreaterThanOrEqual(0);
      expect(c.cy).toBeLessThanOrEqual(210);
      expect(c.n).toBeGreaterThanOrEqual(1);
    }
  });

  it("coded reasons carry the projection's real label + count, illustrated by a real quote", () => {
    const p = buildPopulationFrameData(base);
    expect(p.voices.total).toBe(1000);
    expect(p.voices.reasons[0]!.label).toBe("The payoff comes too late");
    expect(p.voices.reasons[0]!.count).toBe(253);
    expect(PERSONAS.map((x) => x.quote)).toContain(p.voices.reasons[0]!.quote); // a REAL voice
  });

  it("voices humanize the pStop reason TOKENS for display (weak-hook → Weak hook)", () => {
    const p = buildPopulationFrameData({
      ...base,
      aggregate: { ...AGG, reasons: [{ reason: "weak-hook", count: 200 }, { reason: "interest", count: 90 }] },
    });
    expect(p.voices.reasons.map((r) => r.label)).toEqual(["Weak hook", "On-topic interest"]);
  });

  it("the trust strip is the real sample; confidence is modeled (labeled)", () => {
    const p = buildPopulationFrameData(base);
    expect(p.room!.simulated).toBe(1000);
    expect(p.room!.calibratedOn).toBe("your 4.2k followers");
    expect(p.room!.note).toMatch(/modeled/i);
  });

  it("heroRead names the strongest vs weakest real district", () => {
    const p = buildPopulationFrameData(base);
    expect(p.heroRead).toContain("builders");
    expect(p.heroRead).toContain("skeptics");
  });

  it("decisionStates partition the whole room into four action-states (sold → gone), summing to total", () => {
    const p = buildPopulationFrameData(base);
    const ds = p.decisionStates!;
    expect(ds.states.map((s) => s.key)).toEqual(["sold", "winnable", "skeptical", "gone"]);
    // sold = the stoppers; the four counts partition the room exactly
    expect(ds.states.find((s) => s.key === "sold")!.count).toBe(620); // agg.stop
    expect(ds.states.reduce((a, s) => a + s.count, 0)).toBe(ds.total); // === agg.total (1000)
    expect(ds.total).toBe(1000);
    // winnable = the fence segment's non-stoppers (scrollers 350 − 200); skeptical = the loss segment's
    // non-stoppers (skeptics 250 − 80); gone = the remaining scrollers.
    expect(ds.states.find((s) => s.key === "winnable")!.count).toBe(150);
    expect(ds.states.find((s) => s.key === "skeptical")!.count).toBe(170);
    expect(ds.states.find((s) => s.key === "gone")!.count).toBe(60);
    // only the gone state is the definitive loss (coral)
    expect(ds.states.find((s) => s.key === "gone")!.loss).toBe(true);
    expect(ds.states.filter((s) => s.loss)).toHaveLength(1);
    // shares are % of the room
    expect(ds.states.find((s) => s.key === "sold")!.share).toBe(62);
  });
});

describe("buildReasonBrainFrameData (the text brain — owner call 2026-07-24)", () => {
  const AGG_REASONS: PopulationAggregate = {
    ...AGG,
    reasons: [
      { reason: "strong-hook", count: 400 },
      { reason: "interest", count: 140 },
      { reason: "too-slow", count: 80 },
    ],
  };

  it("the driver is the SAME attention-scrubber as video — a MODELED retention curve + the REAL transcript", () => {
    const b = buildReasonBrainFrameData({
      aggregate: AGG_REASONS,
      stopPct: 62,
      stimulusKey: "k1",
      transcript: "the promise in the first line pulls you in",
    });
    expect(b.driver.kind).toBe("attention-scrubber");
    if (b.driver.kind !== "attention-scrubber") throw new Error("expected attention-scrubber");
    const d = b.driver.data;
    expect(d.transcript).toBe("the promise in the first line pulls you in"); // the REAL words
    expect(d.points.length).toBeGreaterThanOrEqual(4); // a modeled curve, not empty
    expect(d.points.every((v) => v >= 0 && v <= 80)).toBe(true); // on the scrubber's 0..80 axis
    expect(d.moments.length).toBeGreaterThanOrEqual(1);
  });

  it("with no transcript the scrubber falls back to the coded reasons (never empty)", () => {
    const b = buildReasonBrainFrameData({ aggregate: AGG_REASONS, stopPct: 62, stimulusKey: "k1" });
    if (b.driver.kind !== "attention-scrubber") throw new Error("expected attention-scrubber");
    expect(b.driver.data.transcript.length).toBeGreaterThan(0);
  });

  it("the 'why' that heads the scrubber is the REAL top friction reason (coral on the loss clause)", () => {
    const b = buildReasonBrainFrameData({ aggregate: AGG_REASONS, stopPct: 62, stimulusKey: "k1" });
    // the top LOSS reason (too-slow, 80) leads; total denominator = agg.stop (620)
    expect(b.whyThisSecond).toBeDefined();
    const seg = b.whyThisSecond!.segments;
    expect(seg.some((s) => s.loss && /too slow/i.test(s.text))).toBe(true);
    expect(seg.map((s) => s.text).join("")).toMatch(/80 of 620/);
  });

  it("the cortex is a seeded MODELED proxy driven by the real stop-ratio; the honesty line says so", () => {
    const b = buildReasonBrainFrameData({ aggregate: AGG_REASONS, stopPct: 62, stimulusKey: "k1" });
    expect(b.cortexSeedKey).toBe("k1");
    expect(b.stopRatio).toBeCloseTo(0.62, 4);
    expect(b.signals).toEqual([]); // no visual craft dims on a text sim
    expect(b.calibrationNote).toMatch(/proxy/i);
    expect(b.calibrationNote).toMatch(/not measured/i);
  });

  it("buildDomainTemplate now ships a REAL brain for a text sim (no longer undefined)", () => {
    const tpl = buildDomainTemplate({ ...base, aggregate: AGG_REASONS, pct: 62, stimulusKey: "k1", conceptLabel: "hook" });
    expect(tpl.brain).toBeDefined();
    expect(tpl.brain!.driver.kind).toBe("attention-scrubber");
    expect(tpl.population).not.toBeNull(); // both tabs real
  });

  it("text renders the SAME modeled-depth parity as video (9 signals · 7 nets · heatmap · buy · why)", () => {
    const b = buildReasonBrainFrameData({ aggregate: AGG_REASONS, stopPct: 62, stimulusKey: "k1" });
    expect(b.signalGrid).toHaveLength(9);
    expect(b.networkBars).toHaveLength(7);
    expect(b.networks).toHaveLength(4);
    expect(b.kpiHeatmap!.rows).toHaveLength(10);
    expect(b.buyIntent).toBeUndefined(); // commerce-only figure — omitted (matches authored)
    expect(b.whyThisSecond).toBeDefined(); // the real reason, in the video's measured-dip slot
  });

  it("the visual-only reads are GREYED on a text sim (no video substrate to measure)", () => {
    const b = buildReasonBrainFrameData({ aggregate: AGG_REASONS, stopPct: 62, stimulusKey: "k1" });
    // the Visual Pull signal cell is muted; the rest are not
    const visualCell = b.signalGrid!.find((c) => c.key === "visual")!;
    expect(visualCell.muted).toBe(true);
    expect(b.signalGrid!.filter((c) => c.muted).map((c) => c.key)).toEqual(["visual"]);
    // the Visual/Audio/Face KPI rows are muted; the text-applicable systems are not
    const muted = b.kpiHeatmap!.rows.filter((r) => r.muted).map((r) => r.label);
    expect(muted).toEqual(["Visual", "Audio", "Face"]);
    expect(b.kpiHeatmap!.rows.find((r) => r.label === "Text")!.muted).toBeUndefined();
  });

  it("the unlock is built from REAL reason labels (top pull works · top friction leaks)", () => {
    const tpl = buildDomainTemplate({ ...base, aggregate: AGG_REASONS, pct: 62, stimulusKey: "k1" });
    expect(tpl.unlock!.lever.toLowerCase()).toContain("too slow");
    expect(tpl.unlock!.insight).toMatch(/Strong hook/);
    expect(tpl.unlock!.gain).toMatch(/would stop/);
  });
});
