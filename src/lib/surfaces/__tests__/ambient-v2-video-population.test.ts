/**
 * ambient-v2-video-population.test.ts — the VIDEO Population producer (the fold reception panel).
 *
 * The fixture is the REAL prod row `vSoTpo5AixUS` (a 29s TikTok Max run), transcribed field-for-field:
 * 10 fold personas, the true `scroll_past_second` values, and the real segment grid whose first
 * `t_end` is 3.0s — so the hook window under test is the engine's own, not a guess.
 *
 * Locks the honesty spine documented in the module:
 *   - N is the real cast (10). No expansion to a 100/1,000-individual population.
 *   - Room composition rides on segment `share` (heatmap weights), never on the counts.
 *   - `reasons` is empty — a video fold emits no per-viewer objections, so none are invented.
 *   - "Stopped" = survived the hook; a late bail is a SKIM, which is a real third band for video.
 */
import { describe, it, expect } from "vitest";
import { buildVideoPopulation } from "../ambient-v2-video-population";
import { buildPopulationFrameData } from "../ambient-v2-population";
import type { HeatmapPayload, PersonaSimulationResult } from "@/lib/engine/types";

/** Real fold cast from `vSoTpo5AixUS` — archetypes, slots, bail seconds and watch-through verbatim. */
const P = (
  persona_id: string,
  archetype: string,
  slot_type: PersonaSimulationResult["slot_type"],
  scroll_past_second: number,
  watch_through_pct: number,
): PersonaSimulationResult => ({
  persona_id,
  archetype: archetype as PersonaSimulationResult["archetype"],
  slot_type,
  niche: "general",
  scroll_past_second,
  watch_through_pct,
  comment_intent: 0,
  share_intent: 0,
  save_intent: 0,
  rewatch_intent: 0,
  // The fold's REAL reasoning string — a stub, which is precisely why no coded reason can be built.
  reasoning: `fold-derived: ${archetype}`,
});

const PERSONAS: PersonaSimulationResult[] = [
  P("fyp-1", "tough_crowd", "fyp", 2.8, 15),
  P("fyp-2", "lurker", "fyp", 0, 85),
  P("fyp-3", "high_engager", "fyp", 0, 90),
  P("fyp-4", "saver", "fyp", 0, 70),
  P("fyp-5", "sharer", "fyp", 0, 60),
  P("niche_deep-1", "niche_deep_buyer", "niche_deep", 0, 95),
  P("niche_deep-2", "niche_deep_scout", "niche_deep", 12, 40),
  P("loyalist-1", "loyalist", "loyalist", 0, 100),
  P("loyalist-2", "loyalist", "loyalist", 0, 98),
  P("cross_niche-1", "cross_niche_curiosity", "cross_niche", 8.5, 35),
];

/** The real segment grid + room mix. Only `segments[0].t_end` (3.0) and `weights` are read. */
const HEATMAP = {
  segments: [3, 5.5, 11.5, 20.5, 29].map((t_end, idx) => ({
    idx,
    t_start: idx === 0 ? 0 : [3, 5.5, 11.5, 20.5][idx - 1]!,
    t_end,
    is_hook_zone: idx === 0,
    keyframe_uri: null,
  })),
  personas: [],
  weighted_curve: [0.779, 0.744, 0.699, 0.561, 0.479],
  weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
  weights_source: "default",
} as unknown as HeatmapPayload;

describe("buildVideoPopulation", () => {
  it("reports the REAL cast size — 10 reactors, never an expanded population", () => {
    const out = buildVideoPopulation({ personas: PERSONAS, heatmap: HEATMAP })!;
    expect(out.aggregate.total).toBe(10);
    // and the trust strip therefore claims exactly what was simulated
    const frame = buildPopulationFrameData({
      aggregate: out.aggregate,
      personas: [],
      calibratedFrom: "your audience",
      tier: "max",
    });
    expect(frame.room!.simulated).toBe(10);
  });

  it("splits the three real bands on the engine's own 3.0s hook window", () => {
    const out = buildVideoPopulation({ personas: PERSONAS, heatmap: HEATMAP })!;
    // tough_crowd bailed at 2.8s (inside the hook) → never stopped.
    expect(out.aggregate.scroll).toBe(1);
    // cross_niche_curiosity (8.5s) + niche_deep_scout (12s) bailed AFTER it → they stopped, then left.
    expect(out.skimmedPct).toBe(20);
    expect(out.aggregate.stop).toBe(9);
    expect(out.aggregate.stopPct).toBe(90);
  });

  it("carries room composition on segment SHARE, not on the counts", () => {
    const out = buildVideoPopulation({ personas: PERSONAS, heatmap: HEATMAP })!;
    const shares = Object.fromEntries(out.aggregate.segments.map((s) => [s.archetype, s.share]));
    // fyp weight .65 across 5 fyp personas
    expect(shares.tough_crowd).toBeCloseTo(0.13, 5);
    // the two loyalist slots merge into ONE district carrying the whole .10 loyalist weight
    expect(shares.loyalist).toBeCloseTo(0.1, 5);
    // niche .20 across the two niche_deep personas — proving `niche_deep` maps to the `niche` weight
    // (the two schemas spell this slot differently and BOTH occur on real rows)
    expect(shares.niche_deep_buyer).toBeCloseTo(0.1, 5);
    const sum = out.aggregate.segments.reduce((a, s) => a + s.share, 0);
    expect(sum).toBeCloseTo(1, 6);
    // every count stays a headcount: 9 districts (the two loyalists merged), 10 reactors
    expect(out.aggregate.segments).toHaveLength(9);
    expect(out.aggregate.segments.reduce((a, s) => a + s.total, 0)).toBe(10);
  });

  it("names the loss district from the REAL bail — tough_crowd is the only 0%", () => {
    const out = buildVideoPopulation({ personas: PERSONAS, heatmap: HEATMAP })!;
    const zero = out.aggregate.segments.filter((s) => s.stopPct === 0);
    expect(zero.map((s) => s.archetype)).toEqual(["tough_crowd"]);
    const frame = buildPopulationFrameData({
      aggregate: out.aggregate,
      personas: [],
      calibratedFrom: "your audience",
      tier: "max",
    });
    expect(frame.terrain.clusters[frame.terrain.lossClusterIndex]!.name).toBe(
      out.aggregate.segments.find((s) => s.archetype === "tough_crowd")!.displayName,
    );
  });

  it("emits NO coded reasons — the fold has no per-viewer objections to code", () => {
    const out = buildVideoPopulation({ personas: PERSONAS, heatmap: HEATMAP })!;
    expect(out.aggregate.reasons).toEqual([]);
  });

  it("degrades to null on a Wave-3-degraded row (no fold cast) — never a fabricated room", () => {
    expect(buildVideoPopulation({ personas: [], heatmap: HEATMAP })).toBeNull();
    expect(buildVideoPopulation({ personas: [], heatmap: null })).toBeNull();
  });

  it("falls back to the documented default room mix when the heatmap is absent", () => {
    const out = buildVideoPopulation({ personas: PERSONAS, heatmap: null })!;
    // no segment grid ⇒ the 3s fallback hook window; tough_crowd (2.8s) still the only scroller
    expect(out.aggregate.scroll).toBe(1);
    const shares = Object.fromEntries(out.aggregate.segments.map((s) => [s.archetype, s.share]));
    expect(shares.tough_crowd).toBeCloseTo(0.13, 5);
  });
});

describe("the frame the video aggregate produces", () => {
  const out = buildVideoPopulation({ personas: PERSONAS, heatmap: HEATMAP })!;
  const frame = buildPopulationFrameData({
    aggregate: out.aggregate,
    personas: [], // a video fold supplies no exemplar voices
    calibratedFrom: "your audience",
    tier: "max",
    skimmedPct: out.skimmedPct,
  });

  it("fills the tri-state's MIDDLE band — the one read video has and text cannot", () => {
    if (frame.main.kind !== "tri-state") throw new Error("expected tri-state");
    expect(frame.main.data).toEqual({ stopped: 70, skimmed: 20, scrolled: 10 });
    // the three bands still partition the room exactly
    const { stopped, skimmed, scrolled } = frame.main.data;
    expect(stopped + skimmed + scrolled).toBe(100);
  });

  it("renders NO receipts section — no reasons means no voices, never an empty heading", () => {
    expect(frame.voices.reasons).toEqual([]);
  });

  it("omits decisionStates (no reasons ⇒ no real levers) so the archetype ledger reads instead", () => {
    expect(frame.decisionStates).toBeUndefined();
  });

  it("omits the swing when every district is decided — no fence-sitters, no upside claim", () => {
    expect(frame.swing).toBeUndefined();
  });

  it("still carries the sections its real numbers DO support", () => {
    expect(frame.audienceFit).toBeDefined();
    expect(frame.amplification).toBeDefined();
    expect(frame.heroRead).toContain("Tough Crowd");
    expect(frame.room!.calibratedOn).toBe("your audience");
  });
});
