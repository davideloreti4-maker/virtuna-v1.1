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
import { buildActionIntent, buildVideoPopulation } from "../ambient-v2-video-population";
import { buildPopulationFrameData } from "../ambient-v2-population";
import type {
  HeatmapPayload,
  PersonaBehavioralAggregate,
  PersonaSimulationResult,
} from "@/lib/engine/types";

/** Real fold cast from `vSoTpo5AixUS` — archetypes, slots, bail seconds, watch-through and the four
 *  action intents, all verbatim from the row. */
const P = (
  persona_id: string,
  archetype: string,
  slot_type: PersonaSimulationResult["slot_type"],
  scroll_past_second: number,
  watch_through_pct: number,
  intents: [share: number, save: number, comment: number, rewatch: number] = [0, 0, 0, 0],
): PersonaSimulationResult => ({
  persona_id,
  archetype: archetype as PersonaSimulationResult["archetype"],
  slot_type,
  niche: "general",
  scroll_past_second,
  watch_through_pct,
  share_intent: intents[0],
  save_intent: intents[1],
  comment_intent: intents[2],
  rewatch_intent: intents[3],
  // The fold's REAL reasoning string — a stub, which is precisely why no coded reason can be built.
  reasoning: `fold-derived: ${archetype}`,
});

const PERSONAS: PersonaSimulationResult[] = [
  P("fyp-1", "tough_crowd", "fyp", 2.8, 15, [0, 0, 0, 0]),
  P("fyp-2", "lurker", "fyp", 0, 85, [0, 0, 0, 0]),
  P("fyp-3", "high_engager", "fyp", 0, 90, [45, 30, 60, 20]),
  P("fyp-4", "saver", "fyp", 0, 70, [5, 85, 2, 10]),
  P("fyp-5", "sharer", "fyp", 0, 60, [75, 10, 20, 5]),
  P("niche_deep-1", "niche_deep_buyer", "niche_deep", 0, 95, [10, 90, 15, 40]),
  P("niche_deep-2", "niche_deep_scout", "niche_deep", 12, 40, [5, 5, 10, 0]),
  P("loyalist-1", "loyalist", "loyalist", 0, 100, [50, 40, 80, 30]),
  P("loyalist-2", "loyalist", "loyalist", 0, 98, [40, 35, 70, 25]),
  P("cross_niche-1", "cross_niche_curiosity", "cross_niche", 8.5, 35, [15, 10, 5, 0]),
];

/** The row's REAL `persona_behavioral_aggregate` — the engine's own top-3-enthusiast weighting. */
const AGGREGATE: PersonaBehavioralAggregate = {
  completion_pct: 68.8,
  completion_percentile: "moderate intent",
  share_pct: 38.285714285714285,
  share_percentile: "low intent",
  save_pct: 48.142857142857146,
  save_percentile: "low intent",
  comment_pct: 44.971428571428575,
  comment_percentile: "low intent",
  loop_pct: 21,
  loop_percentile: "very low intent",
};

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

/**
 * The action-intent section. The rule under test is the one the browser taught on the ranked reads:
 * a difference must be MEASURED before it can be stated. Here the risk is the mirror image of a tie —
 * a foregone conclusion. Across every 10-persona prod row, `sharer` tops `share_intent` whenever a
 * Sharer is cast (9 of 9), so a carrier ranking would print the same winner forever; and the
 * top-to-second verb gap lands between 2.3 and 6.3 on ten of eleven rows, so a "what they'd do most"
 * crown would be reporting sort order. Hence: no carriers at all, and verbs group unless separated.
 */
describe("the action intents", () => {
  const out = buildVideoPopulation({ personas: PERSONAS, heatmap: HEATMAP, aggregate: AGGREGATE })!;

  it("reports the engine's OWN weighted intent read, rounded — never a second, rival average", () => {
    // Recomputing a plain mean here would put two different "share" numbers for one video on screen.
    expect(out.intents).toMatchObject({ share: 38, save: 48, comment: 45, rewatch: 21 });
    // …and the watch-through rate rides separately: it is a flat mean, a different KIND of number.
    expect(out.intents!.watchThroughPct).toBe(69);
  });

  it("counts real people for the headcounts — unweighted, and with no invented threshold", () => {
    // 8 of the cast carry at least one intent above zero; tough_crowd + lurker carry none.
    expect(out.intents).toMatchObject({ total: 10, actors: 8, inert: 2 });
    // …of those two, only the lurker never scrolled away. It watched to the end and would still do
    // nothing — a read the tri-state cannot make, and the reason "stayed" reuses the module's rule
    // (never bailed) rather than a watch-% threshold.
    expect(out.intents!.watchedButInert).toBe(1);
  });

  it("omits itself on a Wave-3-degraded row — the section is absent, never zeroed", () => {
    expect(buildVideoPopulation({ personas: PERSONAS, heatmap: HEATMAP })!.intents).toBeUndefined();
    expect(
      buildVideoPopulation({ personas: PERSONAS, heatmap: HEATMAP, aggregate: null })!.intents,
    ).toBeUndefined();
  });

  it("drops the rewatch ROW on an aggregate that predates loop_pct — never renders it as a 0", () => {
    const { loop_pct: _loop, loop_percentile: _label, ...noLoop } = AGGREGATE;
    const aged = buildVideoPopulation({ personas: PERSONAS, heatmap: HEATMAP, aggregate: noLoop })!;
    expect(aged.intents!.rewatch).toBeUndefined();
    expect(buildActionIntent(aged.intents!).rows.map((r) => r.label)).toEqual([
      "save",
      "comment",
      "share",
    ]);
  });
});

describe("the action-intent read", () => {
  const RAW = { total: 10, actors: 8, inert: 2, watchedButInert: 1, watchThroughPct: 69 };

  it("GROUPS the head when the leader is inside the gap — the crowning defect, one axis over", () => {
    // The real `vSoTpo5AixUS` profile: save 48 tops comment 45 by 3.1 points. Ten of eleven prod rows
    // sit in that noise band, so naming a leader here reports the sort, not the video.
    const read = buildActionIntent(
      buildVideoPopulation({ personas: PERSONAS, heatmap: HEATMAP, aggregate: AGGREGATE })!.intents!,
    ).read;
    expect(read).toBe("Save, comment and share run together (38–48); rewatch is the floor at 21.");
    expect(read).not.toMatch(/^Save leads/);
  });

  it("names the floor when it IS separated — the one place these numbers reliably differ", () => {
    // The real `o4_e2zalqzc0` profile: share 36 / comment 31 / rewatch 14 / save 6. The head is a
    // 5-point noise gap (grouped) but save sits 8 clear of the pack, so it is named.
    const read = buildActionIntent({ ...RAW, share: 36, comment: 31, rewatch: 14, save: 6 }).read;
    expect(read).toBe("Share and comment run together (31–36); save is the floor at 6.");
  });

  it("names a leader ONLY once it clears the measured gap", () => {
    // 12.1 points was the single genuine separation across every prod row; 8 is the bar.
    const read = buildActionIntent({ ...RAW, comment: 46, share: 34, rewatch: 24, save: 13 }).read;
    expect(read).toBe("Comment leads at 46; save is the floor at 13.");
  });

  it("refuses to rank at all when nothing is separated", () => {
    const read = buildActionIntent({ ...RAW, share: 38, comment: 36, save: 33, rewatch: 31 }).read;
    expect(read).toBe("All four verbs land in the same band (31–38) — nothing separates them.");
    const flat = buildActionIntent({ ...RAW, share: 30, comment: 30, save: 30, rewatch: 30 }).read;
    expect(flat).toBe("All four verbs land on 30 — the room draws no distinction between them.");
  });

  it("states its denominator — the four verbs are an index, not a rate", () => {
    const data = buildActionIntent({ ...RAW, share: 36, comment: 31, rewatch: 14, save: 6 });
    expect(data.note).toMatch(/not a room average/);
    // one sentence, two facts — no third, interpretive clause to drift into a hardcoded closer
    expect(data.read.split(". ").filter(Boolean)).toHaveLength(1);
    expect(data.read).not.toMatch(/—/);
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

  it("omits 'who spreads it' — the reshare priors do not know these archetypes, so it has no answer", () => {
    // `RESHARE_PRIOR` is keyed on the TEXT vocabulary, so every fold archetype defaults to ×1.0.
    // Rendered, that was ten identical carriers plus "Reach rides on Tough Crowd resharing" — naming
    // the district that bailed at 2.8s as the lead spreader, purely on a tie-break.
    expect(frame.amplification).toBeUndefined();
  });

  it("counts a tie instead of crowning one of its members, and reads the shape it describes", () => {
    const read = frame.audienceFit!.read;
    // 8 of 9 districts sit at 100%: naming the first of them would present a sort order as a finding.
    expect(read).toMatch(/8 districts/);
    expect(read).not.toMatch(/over-indexes with (Quiet Watchers|Regulars|Commenters)/);
    // Tough Crowd genuinely IS alone at the bottom, so it is named.
    expect(read).toContain("Tough Crowd");
    // …and a result where most of the room holds must not call itself narrow.
    expect(read).not.toMatch(/narrower/);
    expect(read).toMatch(/plays broad/);
  });

  it("carries the action profile in the slot 'who spreads it' vacated — intent, never reach", () => {
    const withIntent = buildPopulationFrameData({
      aggregate: out.aggregate,
      personas: [],
      calibratedFrom: "your audience",
      tier: "max",
      actionIntent: buildVideoPopulation({ personas: PERSONAS, heatmap: HEATMAP, aggregate: AGGREGATE })!
        .intents,
    });
    expect(withIntent.actionIntent!.rows).toHaveLength(4);
    // and it did NOT resurrect the reach claim it sits next to: no multiplier, no cascade, no carriers
    expect(withIntent.amplification).toBeUndefined();
    expect(Object.keys(withIntent.actionIntent!)).not.toContain("carriers");
  });

  it("is absent on the TEXT path — a binary verdict has no action axis to report", () => {
    expect(frame.actionIntent).toBeUndefined();
  });

  it("still carries the sections its real numbers DO support", () => {
    expect(frame.audienceFit).toBeDefined();
    expect(frame.room!.calibratedOn).toBe("your audience");
    // the hero read counts the 8-way tie at the top and names the district genuinely alone at the
    // bottom — the same rule the fit read follows, via the shared `peerLabel`
    expect(frame.heroRead).toBe("8 districts stop most (100%); Tough Crowd are the ceiling (0%).");
  });
});
