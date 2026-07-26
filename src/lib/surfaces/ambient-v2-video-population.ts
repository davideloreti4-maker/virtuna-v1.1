/**
 * ambient-v2-video-population.ts — the VIDEO producer for the Ambient v2 Population depth.
 *
 * The gap this closes: `AmbientOverviewRail` drilled a tested video into `buildVideoDomainTemplate`
 * with `population: null` — commented "the honest audience-unavailable state". It was never
 * unavailable. The `/api/analyze` Max run resolves the thread's active audience and repaints the
 * fold's 10 archetypes with it (`api/analyze/route.ts:803-838`), so the persisted row already holds a
 * REAL, audience-specific reception panel. It was simply never mapped.
 *
 * This module is the ONE new piece: fold reception → `PopulationAggregate`. Everything downstream is
 * the SHIPPED text-sim adapter, unchanged — `buildPopulationFrameData` and every `modeled*` depth
 * section take nothing but a `PopulationAggregate`, so terrain, tri-state, heroRead, audienceFit,
 * amplification, swing and the trust strip all fill from this one function ("extend, don't duplicate").
 *
 * ── The honesty spine (each rule cost a real decision) ───────────────────────────────────────────
 *
 * 1. **N is 10, and it says so.** The fold is a 10-reactor panel. Expanding it to a 100- or
 *    1,000-individual population (each bucket cloning its persona's verdict) would dress 10 distinct
 *    outcomes as N — resolution the run never had, and `RoomTrustData.simulated` would then overstate
 *    what was simulated. Sections that read thin at N=10 ("1 viewer stalled at the line") are
 *    honestly thin. The room COMPOSITION still rides through, on the segment shares.
 *
 * 2. **Room composition lives on `share`, not on the counts.** `heatmap.weights` is the real audience
 *    mix (fyp .65 / niche .20 / loyalist .10 / cross_niche .05). Each persona carries its slot's
 *    weight split across that slot's members, so the terrain districts are sized by the actual room
 *    while every count stays a real headcount.
 *
 * 3. **`reasons` is EMPTY, deliberately.** A video fold emits `reasoning: "fold-derived: <archetype>"`
 *    (a stub) and `segment_reasons: {}` — verified on prod rows. There are NO per-viewer objection
 *    quotes on a video run, unlike the text sim's real `scrollQuote`. Coding a "why" out of the
 *    archetype name would be fabrication. The video's real "why" is POSITIONAL and already shipped on
 *    the Brain tab (the measured-dip read over the attention curve + the true transcript).
 *
 * 4. **Stop means survived the hook**, matched to the verdict's meaning (the thumb-stop). A persona
 *    that bailed at 12s DID stop scrolling — it just didn't finish. That third state is real here and
 *    is reported as `skimmedPct`; the text sim honestly zeroes it (a binary verdict has no middle).
 *
 * The Population tab's verdict chip (`weighted_hook_score`) and this aggregate's `stopPct` are
 * DIFFERENT measures — a weighted attention level at the hook vs. how many of the cast survived it —
 * so they legitimately differ. Each is labelled with its own denominator; neither is derived from the
 * other.
 */

import type { PopulationAggregate, SegmentReaction } from "@/lib/audience/population";
import { archetypeDisplayName } from "@/lib/audience/archetype-names";
import type { HeatmapPayload, PersonaSimulationResult } from "@/lib/engine/types";

/** The fold's real reception panel, as persisted on the analysis row. */
export interface VideoPopulationInput {
  /** `analysis_results.personas` — the Wave-3 / fold per-persona simulation results. */
  personas: PersonaSimulationResult[];
  /** `analysis_results.heatmap` — read ONLY for `weights` (the room mix) and the hook window. */
  heatmap?: HeatmapPayload | null;
}

/** The aggregate plus the third band a video can honestly report (text's tri-state middle is 0). */
export interface VideoPopulation {
  aggregate: PopulationAggregate;
  /** % of the cast who stopped scrolling but did NOT reach the end (bailed after the hook). */
  skimmedPct: number;
}

/**
 * The default room mix, used only when a row predates `heatmap.weights` or the heatmap is absent.
 * Mirrors the engine's documented default (`HeatmapPayload.weights`) rather than inventing a mix.
 */
const DEFAULT_WEIGHTS = { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 } as const;

/** Fallback hook window (seconds) when the heatmap carries no segment grid to read it from. ~The
 *  first-2s thumb-stop plus a beat, matching the engine's `weighted_hook_score` framing. */
const FALLBACK_HOOK_END_S = 3;

type WeightKey = keyof typeof DEFAULT_WEIGHTS;

/**
 * A persona's slot → the `weights` key. The two schemas spell the niche slot differently —
 * `PersonaSlotTypeSchema` emits `niche_deep` while `HeatmapPayload.personas[].slot_type` emits
 * `niche` — and both appear on real rows, so BOTH map to the one `niche` weight.
 */
function weightKeyOf(slot: string): WeightKey {
  if (slot === "loyalist") return "loyalist";
  if (slot === "cross_niche") return "cross_niche";
  if (slot === "niche" || slot === "niche_deep") return "niche";
  return "fyp";
}

/** The end of the hook window: the first heatmap segment's real `t_end`, else the fallback. A
 *  persona that bailed inside it never stopped scrolling; one that bailed after it did. */
function hookEndSeconds(heatmap?: HeatmapPayload | null): number {
  const first = heatmap?.segments?.[0];
  const tEnd = first?.t_end;
  return typeof tEnd === "number" && Number.isFinite(tEnd) && tEnd > 0 ? tEnd : FALLBACK_HOOK_END_S;
}

/** A persona's bail time in seconds, or null when it never bailed. `scroll_past_second` is 0 on the
 *  fold's "never scrolled away" rows (verified against prod), so 0 reads as "stayed", not "left at 0". */
function bailedAt(p: PersonaSimulationResult): number | null {
  const s = p.scroll_past_second;
  return typeof s === "number" && Number.isFinite(s) && s > 0 ? s : null;
}

/**
 * Map a tested video's fold reception → the `PopulationAggregate` the shipped Population adapter
 * consumes. Returns null when the row carries no fold cast (a DEGRADED run — Wave-3 below threshold),
 * which keeps the drill on today's honest `population: null`. Pure: no DB, no clock, no randomness.
 */
export function buildVideoPopulation(input: VideoPopulationInput): VideoPopulation | null {
  const personas = (input.personas ?? []).filter(
    (p): p is PersonaSimulationResult => !!p && typeof p.archetype === "string",
  );
  if (personas.length === 0) return null;

  const hookEnd = hookEndSeconds(input.heatmap);
  const weights = input.heatmap?.weights ?? DEFAULT_WEIGHTS;

  // Each persona carries its slot's share of the room, split evenly across that slot's members.
  const slotCount = new Map<WeightKey, number>();
  for (const p of personas) {
    const k = weightKeyOf(p.slot_type);
    slotCount.set(k, (slotCount.get(k) ?? 0) + 1);
  }
  const rawShareOf = (p: PersonaSimulationResult): number => {
    const k = weightKeyOf(p.slot_type);
    const members = slotCount.get(k) ?? 1;
    const w = weights[k];
    return (typeof w === "number" && Number.isFinite(w) && w > 0 ? w : 0) / members;
  };
  // Normalize so the shares sum to 1 even when a slot is unrepresented on this row (its weight would
  // otherwise vanish and the districts would under-fill the terrain).
  const rawTotal = personas.reduce((a, p) => a + rawShareOf(p), 0);
  const shareOf = (p: PersonaSimulationResult): number =>
    rawTotal > 0 ? rawShareOf(p) / rawTotal : 1 / personas.length;

  // ── the three real bands ────────────────────────────────────────────────────
  // scrolled = bailed inside the hook window (never stopped)
  // skimmed  = bailed after it (stopped, didn't finish)
  // stayed   = never bailed
  let scrolled = 0;
  let skimmed = 0;
  for (const p of personas) {
    const at = bailedAt(p);
    if (at === null) continue;
    if (at <= hookEnd) scrolled += 1;
    else skimmed += 1;
  }
  const total = personas.length;
  const stop = total - scrolled; // stopped scrolling = skimmed + stayed
  const stopPct = Math.round((stop / total) * 100);

  // ── segments: one district per ARCHETYPE (two loyalist slots merge into one district) ──────────
  const byArchetype = new Map<string, PersonaSimulationResult[]>();
  for (const p of personas) {
    const list = byArchetype.get(p.archetype);
    if (list) list.push(p);
    else byArchetype.set(p.archetype, [p]);
  }
  const segments: SegmentReaction[] = [...byArchetype.entries()]
    .map(([archetype, members]) => {
      const segTotal = members.length;
      const segStop = members.filter((m) => {
        const at = bailedAt(m);
        return at === null || at > hookEnd;
      }).length;
      return {
        archetype,
        displayName: archetypeDisplayName(archetype),
        share: members.reduce((a, m) => a + shareOf(m), 0),
        total: segTotal,
        stop: segStop,
        stopPct: Math.round((segStop / segTotal) * 100),
      };
    })
    .sort((a, b) => b.share - a.share); // weightiest district first (the aggregate's contract)

  return {
    aggregate: {
      total,
      stop,
      scroll: scrolled,
      stopPct,
      segments,
      // Deliberately empty — a video fold emits no per-viewer reasons (see §3 above). The consumer
      // renders no receipts rather than coding a "why" out of an archetype name.
      reasons: [],
    },
    skimmedPct: Math.round((skimmed / total) * 100),
  };
}
