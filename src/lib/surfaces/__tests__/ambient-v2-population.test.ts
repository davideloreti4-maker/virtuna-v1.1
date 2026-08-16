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
  // REAL archetype slugs, with the generator's baked `displayName` deliberately WRONG — the
  // display layer must translate to the curated nouns at render (old seals carry names like
  // "The Tech Trend Hunter"; the slug is what makes the curated name recoverable).
  segments: [
    { archetype: "niche_deep_buyer", displayName: "The Deep Domain Devotee", share: 0.4, total: 400, stop: 340, stopPct: 85 },
    { archetype: "lurker", displayName: "The Scroll-Stopping Scroller", share: 0.35, total: 350, stop: 200, stopPct: 57 },
    { archetype: "tough_crowd", displayName: "The Skeptical Realist", share: 0.25, total: 250, stop: 80, stopPct: 32 },
  ],
  reasons: [
    { reason: "The payoff comes too late", count: 253 },
    { reason: "The stake feels real", count: 190 },
  ],
};

const PERSONAS: PopulationSnapshotInput["personas"] = [
  { archetype: "tough_crowd", verdict: "scroll", quote: "i'd be gone before the point lands" },
  { archetype: "niche_deep_buyer", verdict: "stop", quote: "that detail made me stay" },
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
    // audienceFit: Deep Fans (85% vs 62% mean) over-index; Tough Crowd (32%) cool + carry loss
    expect(p.audienceFit!.rows[0]!.label).toBe("Deep Fans");
    expect(p.audienceFit!.rows[0]!.index).toBeGreaterThan(0);
    const skeptic = p.audienceFit!.rows.find((r) => r.label === "Tough Crowd")!;
    expect(skeptic.index).toBeLessThan(0);
    expect(skeptic.loss).toBe(true);
    // amplification: HONESTLY OMITTED for engine-slug segments — RESHARE_PRIOR discriminates only
    // the retired text vocabulary (builder/scroller/…); the 10 engine archetypes all tie at the
    // 1.0 default and a tie is not a ranking (see modeledAmplification). This is the LIVE shape:
    // calibrated signatures store engine slugs, so the section never renders on a real text run.
    expect(p.amplification).toBeUndefined();
    // swing: a real fence-sitter count + a bounded modeled gain (from → to)
    expect(p.swing!.fromPct).toBe(62);
    expect(p.swing!.toPct).toBeGreaterThan(p.swing!.fromPct);
    // "would stop" is BANNED — it meant stopped SCROLLING (good) here and the loss everywhere else.
    expect(p.swing!.gainLabel).toMatch(/^\+\d+% of the room$/);
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
    expect(p.terrain.clusters.map((c) => c.name)).toEqual(["Deep Fans", "Quiet Watchers", "Tough Crowd"]);
    expect(p.terrain.clusters[0]!.lit).toBeCloseTo(0.85); // Deep Fans' real stop rate
    expect(p.terrain.lossClusterIndex).toBe(2); // Tough Crowd, 32% — the loudest no
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

  it("heroRead names the strongest vs weakest district in CURATED names, even off a seal with baked marketing-persona names", () => {
    const p = buildPopulationFrameData(base);
    expect(p.heroRead).toContain("Deep Fans");
    expect(p.heroRead).toContain("Tough Crowd");
    expect(p.heroRead).not.toContain("The Deep Domain Devotee");
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

  // §3.3 — VIDEO AND TEXT ARE INVERSE INSTRUMENTS. The 2026-07-24 parity pass gave text a MODELED
  // retention curve so both kinds drew the same figure; a modeled timeline is exactly what a text
  // concept does not have, so rev 12 puts the REAL coded-reason tally back in the driver slot. The
  // depth sections below are unchanged: parity is about the instrument, not about faking an axis.
  it("the driver is the REAL coded-reason tally — text has the voices and no timeline", () => {
    const b = buildReasonBrainFrameData({
      aggregate: AGG_REASONS,
      stopPct: 62,
      stimulusKey: "k1",
      transcript: "the promise in the first line pulls you in",
    });
    expect(b.driver.kind).toBe("reason-breakdown");
    if (b.driver.kind !== "reason-breakdown") throw new Error("expected reason-breakdown");
    const d = b.driver.data;
    expect(d.total).toBe(620); // the real stopper count is the denominator
    expect(d.rows[0]!.label).toBe("Strong hook"); // weightiest first, humanized from the token
    expect(d.rows.find((r) => r.label === "Too slow")!.loss).toBe(true); // friction rides `loss`
    expect(d.rows.every((r) => r.share >= 0 && r.share <= 1)).toBe(true);
  });

  it("carries no modeled attention axis at all — the absence IS the honest answer", () => {
    const b = buildReasonBrainFrameData({ aggregate: AGG_REASONS, stopPct: 62, stimulusKey: "k1" });
    expect(b.driver.kind).not.toBe("attention-scrubber");
    expect(b.retentionCurve).toBeUndefined();
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
    expect(tpl.brain!.driver.kind).toBe("reason-breakdown");
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

  it("the activation grid keeps every row but NOT the clock (§3.3 — a text concept has no seconds)", () => {
    const b = buildReasonBrainFrameData({ aggregate: AGG_REASONS, stopPct: 62, stimulusKey: "k1" });
    // parity survives — same ten systems as video
    expect(b.kpiHeatmap!.rows).toHaveLength(10);
    // ...but `clipSeconds: 6` is a nominal proxy for the cortex loop, and it was reaching the card as
    // "6s · 10 systems / 0s → 6s / each cell = 1s". The renderer drops the axis on this flag.
    expect(b.kpiHeatmap!.untimed).toBe(true);
    // the same adapter already refuses a modeled TIMELINE for text; the two now agree
    expect(b.driver.kind).toBe("reason-breakdown");
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
    expect(tpl.unlock!.gain).toMatch(/^\+\d+% of the room$/);
  });
});
