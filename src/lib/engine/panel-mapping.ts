/**
 * Phase 1 (D-06) — Single source of truth for stage → result-panel readiness mapping.
 * Co-located with events.ts. Consumed by useAnalysisStream (Plan 02) and every
 * result panel in P3-P5 (panels import PANEL_IDS for their own `data-panel-id`
 * attributes + test selectors). Treat as breaking contract.
 */

import type { StageEvent } from "./events";

export const PANEL_IDS = [
  "verdict",
  "retention",
  "persona_breakdown",
  "hook_decomp",
  "similar_videos",
  "reasoning",
  "emotion_arc",
  "comparative_baseline",
  "optimal_post",
  "anti_virality",
] as const;

export type PanelId = (typeof PANEL_IDS)[number];

export type PanelReadyState = "idle" | "loading" | "ready" | "error";

/**
 * Per RESEARCH Pattern 4. Stage names match the `stage` field emitted by
 * pipeline.ts / aggregator.ts via emitStageStart/emitStageEnd (events.ts).
 * If pipeline stage names change, update this table FIRST — it is the contract.
 */
export const STAGE_TO_PANEL: Record<string, readonly PanelId[]> = {
  wave_1: ["hook_decomp", "similar_videos", "emotion_arc"],
  wave_2: ["reasoning"],
  wave_3_personas: ["retention", "persona_breakdown"],
  aggregator: ["verdict", "comparative_baseline", "optimal_post", "anti_virality"],
};

function initialPanelReady(): Record<PanelId, PanelReadyState> {
  const out = {} as Record<PanelId, PanelReadyState>;
  for (const id of PANEL_IDS) out[id] = "idle";
  return out;
}

/**
 * Pure reducer — derives per-panel readiness from the full StageEvent[] log.
 * Safe to call on every render (cheap O(n) over stages).
 * Hook uses this to recompute panelReady whenever stages[] grows.
 */
export function panelReadyFromStages(
  stages: ReadonlyArray<StageEvent>,
): Record<PanelId, PanelReadyState> {
  const ready = initialPanelReady();
  for (const ev of stages) {
    if (ev.type !== "stage_start" && ev.type !== "stage_end") continue;
    const panels = STAGE_TO_PANEL[ev.stage];
    if (!panels) continue;
    if (ev.type === "stage_start") {
      for (const p of panels) {
        if (ready[p] === "idle") ready[p] = "loading";
      }
    } else if (ev.type === "stage_end") {
      const next: PanelReadyState = ev.ok ? "ready" : "error";
      for (const p of panels) ready[p] = next;
    }
  }
  return ready;
}
