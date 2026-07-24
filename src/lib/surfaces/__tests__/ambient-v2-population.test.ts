/**
 * ambient-v2-population.test.ts — the Population-depth adapter (Phase C).
 *
 * Locks the honesty spine: text tri-state has NO skim band (binary verdict); the three modeled-depth
 * sections (audienceFit / amplification / swing) are OMITTED (their producers aren't built); terrain
 * districts + loss index + coded reasons are the projection's REAL numbers; layout is deterministic.
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

  it("OMITS the modeled-depth sections (no fabrication)", () => {
    const p = buildPopulationFrameData(base);
    expect(p.audienceFit).toBeUndefined();
    expect(p.amplification).toBeUndefined();
    expect(p.swing).toBeUndefined();
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

  it("the driver is the REAL reason tally — weightiest first, humanized, shares over the stopper count", () => {
    const b = buildReasonBrainFrameData({ aggregate: AGG_REASONS, stopPct: 62, stimulusKey: "k1" });
    expect(b.driver.kind).toBe("reason-breakdown");
    if (b.driver.kind !== "reason-breakdown") throw new Error("expected reason-breakdown");
    const d = b.driver.data;
    expect(d.total).toBe(620); // agg.stop — the denominator
    expect(d.rows[0]).toMatchObject({ label: "Strong hook", count: 400 });
    expect(d.rows[0]!.share).toBeCloseTo(400 / 620, 4);
    // friction reasons ride loss (coral); pull reasons don't.
    expect(d.rows.find((r) => r.label === "Too slow")!.loss).toBe(true);
    expect(d.rows.find((r) => r.label === "Strong hook")!.loss).toBeUndefined();
    // rows are sorted weightiest-first.
    expect(d.rows.map((r) => r.count)).toEqual([400, 140, 80]);
    expect(d.read).toMatch(/strong hook/i);
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
});
