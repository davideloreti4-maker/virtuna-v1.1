/**
 * The rank strip's producer — the creator's own last-N catalogue.
 *
 * This is the first benchmark the surface has ever drawn, and §5.3 refused to draw one for twelve
 * revisions on the grounds that a benchmark is the creator's own catalogue or it is nothing. So the
 * tests here are mostly about what the producer REFUSES: rows from engines that cannot report a
 * finisher, catalogues too thin to have a middle, and a marker derived separately from the tile it
 * is ranking.
 */
import { describe, expect, it } from "vitest";
import type { HeatmapPayload } from "@/lib/engine/types";

import { buildVideoDomainTemplate } from "../ambient-v2-brain";
import { rankOf, watchCatalogueOf, watchStatsOf } from "../ambient-v2-drill";

const SEGMENTS = [
  { idx: 0, t_start: 0, t_end: 3, label: "cold open", is_hook_zone: true, keyframe_uri: null },
  { idx: 1, t_start: 3, t_end: 6, label: "the claim", is_hook_zone: false, keyframe_uri: null },
  { idx: 2, t_start: 6, t_end: 9, label: "the stall", is_hook_zone: false, keyframe_uri: null },
  { idx: 3, t_start: 9, t_end: 12, label: "the payoff", is_hook_zone: false, keyframe_uri: null },
];

/** `finishers` personas never swipe; the rest bail at 6s. A real 10-slot cast either way. */
const heatmapWith = (finishers: number): HeatmapPayload =>
  ({
    segments: SEGMENTS,
    personas: Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`,
      slot_type: i < 6 ? "fyp" : i < 8 ? "niche" : i === 8 ? "loyalist" : "cross_niche",
      attentions: [0.8, 0.7, 0.25, 0.5],
      swipe_predicted_at: i < finishers ? null : 6,
      segment_reasons: {},
    })),
    weighted_curve: [0.8, 0.7, 0.25, 0.5],
    weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
    weights_source: "default",
    weighted_completion_pct: 0.56,
  }) as unknown as HeatmapPayload;

const row = (engine_version: string | null, finishers = 4) => ({
  heatmap: heatmapWith(finishers),
  engine_version,
});

describe("watchCatalogueOf — which past runs are allowed into a baseline", () => {
  it("admits rows at and above the measured engine floor", () => {
    const values = watchCatalogueOf([row("3.8.0"), row("3.13.0"), row("3.21.0"), row("4.0.0")]);
    expect(values).toHaveLength(4);
    expect(values.every((v) => v > 0)).toBe(true);
  });

  it("REFUSES the pre-3.8.0 rows whose engines never emitted a finisher sentinel", () => {
    // Measured on prod 2026-08-04: six of seven rows written by 3.0.0/3.2.0 carry zero personas with
    // `swipe_predicted_at === null`, while reporting a completion_pct of 77–83 in the same row. Their
    // engines did not distinguish a finisher. Admitted, they would each contribute a 0% entry to the
    // creator's own baseline — dragging the median down so every new clip ranks flatteringly well.
    expect(watchCatalogueOf([row("3.0.0"), row("3.2.0"), row("3.7.9")])).toEqual([]);
  });

  it("refuses a row that will not say which engine wrote it", () => {
    expect(watchCatalogueOf([row(null), row(undefined as never), row("")])).toEqual([]);
    expect(watchCatalogueOf([{ heatmap: heatmapWith(4) }])).toEqual([]);
  });

  it("refuses a row with no heatmap at all rather than scoring it zero", () => {
    expect(watchCatalogueOf([{ heatmap: null, engine_version: "3.21.0" }])).toEqual([]);
  });

  it("compares versions numerically, not as strings — 3.10.0 is above 3.8.0", () => {
    // "3.10.0" < "3.8.0" lexically, which is the classic way a version floor silently drops
    // everything modern and leaves a baseline built only from the oldest rows it meant to exclude.
    expect(watchCatalogueOf([row("3.10.0")])).toHaveLength(1);
    expect(watchCatalogueOf([row("3.100.2")])).toHaveLength(1);
  });

  it("reports the SAME number the Watched-full tile shows, from the same producer", () => {
    const h = heatmapWith(4);
    const stats = watchStatsOf(h, 12)!;
    expect(watchCatalogueOf([{ heatmap: h, engine_version: "3.21.0" }])).toEqual([
      Math.round(stats.completedShare * 100),
    ]);
  });
});

describe("rankOf — a middle needs enough runs to have one", () => {
  it("omits itself below the floor rather than calling four runs a median", () => {
    expect(rankOf([40, 50, 60, 70], 22)).toBeUndefined();
    expect(rankOf([], 22)).toBeUndefined();
  });

  it("draws once the catalogue is deep enough, on a full 0–100 axis", () => {
    const rank = rankOf([40, 50, 60, 70, 80], 22)!;
    expect(rank.median).toBe(60);
    expect(rank.value).toBe(22);
    expect(rank.max).toBe(100); // a share of the room has a real ceiling; never rescale to the best
    expect(rank.unit).toBe("%");
    expect(rank.values).toHaveLength(5);
  });

  it("takes the mean of the two middles on an even catalogue", () => {
    expect(rankOf([40, 40, 50, 60, 70, 80], 22)!.median).toBe(55);
  });

  it("does not flatter the clip — a below-median clip stays below the median", () => {
    // The dev fixture's own catalogue. Eight of the fourteen sit at 40, so both middles are 40 and
    // the median is 40 — not the 45 a glance at the spread suggests.
    const rank = rankOf([80, 70, 60, 50, 50, 50, 40, 40, 40, 40, 40, 40, 40, 40], 22)!;
    expect(rank.median).toBe(40);
    expect(rank.value).toBeLessThan(rank.median);
  });
});

describe("the strip on the assembled template", () => {
  const base = {
    heatmap: heatmapWith(4),
    videoSignals: null,
    verbatim: null,
    stopPct: 62,
    stimulusKey: "an-1",
  } as never;

  it("says it has no baseline when no catalogue was supplied", () => {
    const t = buildVideoDomainTemplate(base);
    expect(t.engagement?.watch?.rank).toBeUndefined();
    expect(t.engagement?.watch?.meta).toBe("this clip · no baseline yet");
  });

  it("names the scale SIMULATIONS, never videos — these are modeled runs, not measured posts", () => {
    const t = buildVideoDomainTemplate({ ...(base as object), catalogue: [40, 50, 60, 70, 80] } as never);
    expect(t.engagement?.watch?.meta).toBe("vs your last 5 simulations");
    expect(t.engagement?.watch?.meta).not.toMatch(/videos/i);
  });

  it("marks the clip at exactly the Watched-full tile's value — one derivation, one number", () => {
    const t = buildVideoDomainTemplate({ ...(base as object), catalogue: [40, 50, 60, 70, 80] } as never);
    const tile = t.engagement?.watch?.tiles.find((x) => x.label === "Watched full");
    expect(t.engagement?.watch?.rank?.value).toBe(Number.parseInt(tile!.value, 10));
  });

  it("stays silent on a thin catalogue rather than ranking against three runs", () => {
    const t = buildVideoDomainTemplate({ ...(base as object), catalogue: [40, 50, 60] } as never);
    expect(t.engagement?.watch?.rank).toBeUndefined();
    expect(t.engagement?.watch?.meta).toBe("this clip · no baseline yet");
  });
});
