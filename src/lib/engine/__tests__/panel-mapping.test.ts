/**
 * Plan 01-02 T1 — assertions filled in. D-05, D-06 contract.
 */
import { describe, it, expect } from "vitest";
import { PANEL_IDS, STAGE_TO_PANEL, panelReadyFromStages } from "@/lib/engine/panel-mapping";
import { STAGE_EVENT_SEQUENCE } from "@/test/fixtures/stage-events";

describe("panel-mapping", () => {
  it("PANEL_IDS contains all 11 documented panels", () => {
    expect(PANEL_IDS).toEqual([
      "verdict", "retention", "persona_breakdown", "hook_decomp",
      "similar_videos", "reasoning", "emotion_arc", "comparative_baseline",
      "optimal_post", "anti_virality", "insight_hero",
    ]);
  });

  it("STAGE_TO_PANEL['wave_1'] includes hook_decomp, similar_videos, emotion_arc", () => {
    expect(STAGE_TO_PANEL.wave_1).toEqual(expect.arrayContaining(["hook_decomp", "similar_videos", "emotion_arc"]));
  });

  it("STAGE_TO_PANEL['wave_2'] includes reasoning + insight_hero", () => {
    expect(STAGE_TO_PANEL.wave_2).toEqual(["reasoning", "insight_hero"]);
  });

  it("STAGE_TO_PANEL['wave_3_personas'] includes retention + persona_breakdown", () => {
    expect(STAGE_TO_PANEL.wave_3_personas).toEqual(expect.arrayContaining(["retention", "persona_breakdown"]));
  });

  it("STAGE_TO_PANEL['aggregator'] includes verdict + comparative_baseline + optimal_post + anti_virality", () => {
    expect(STAGE_TO_PANEL.aggregator).toEqual(
      expect.arrayContaining(["verdict", "comparative_baseline", "optimal_post", "anti_virality"])
    );
  });

  it("every panel ID in PANEL_IDS is referenced by exactly one stage", () => {
    const seen = new Map<string, number>();
    for (const panels of Object.values(STAGE_TO_PANEL)) {
      for (const p of panels) seen.set(p, (seen.get(p) ?? 0) + 1);
    }
    for (const id of PANEL_IDS) {
      expect(seen.get(id), `panel ${id} should be mapped exactly once`).toBe(1);
    }
  });

  it("panelReadyFromStages([]) returns all 'idle'", () => {
    const r = panelReadyFromStages([]);
    for (const id of PANEL_IDS) expect(r[id]).toBe("idle");
  });

  it("panelReadyFromStages flips to 'loading' on stage_start", () => {
    const r = panelReadyFromStages([
      { type: "stage_start", stage: "wave_1", wave: 1, timestamp_ms: 0 },
    ]);
    expect(r.hook_decomp).toBe("loading");
    expect(r.verdict).toBe("idle"); // aggregator panels still idle
  });

  it("panelReadyFromStages flips to 'ready' on stage_end ok=true", () => {
    const r = panelReadyFromStages(STAGE_EVENT_SEQUENCE);
    expect(r.hook_decomp).toBe("ready");
    expect(r.verdict).toBe("ready");
  });

  it("panelReadyFromStages flips to 'error' on stage_end ok=false", () => {
    const r = panelReadyFromStages([
      { type: "stage_end", stage: "wave_1", wave: 1, duration_ms: 5, cost_cents: 0, ok: false, warning: "fail" },
    ]);
    expect(r.hook_decomp).toBe("error");
  });
});
