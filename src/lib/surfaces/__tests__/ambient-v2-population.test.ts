/**
 * ambient-v2-population.test.ts — the Population-depth adapter (Phase C).
 *
 * Locks the honesty spine: text tri-state has NO skim band (binary verdict); the three modeled-depth
 * sections (audienceFit / amplification / swing) are OMITTED (their producers aren't built); terrain
 * districts + loss index + coded reasons are the projection's REAL numbers; layout is deterministic.
 */
import { describe, it, expect } from "vitest";
import { buildPopulationFrameData, type PopulationSnapshotInput } from "../ambient-v2-population";
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
