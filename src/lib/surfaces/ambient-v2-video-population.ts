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
 *
 * 5. **The action intents are a ROOM profile, never a carrier ranking.** Measured across every
 *    10-persona row on prod: `sharer` tops `share_intent` on 9 of the 9 rows where a Sharer is cast
 *    (the other two rows have none); `lurker` sits at 0–2 share on every row; `tough_crowd` rewatch is
 *    always exactly 0. So "who spreads it" is decided by the persona REGISTRY, not by the video — a
 *    carrier list would print "Reach rides on The Sharer" forever. That is the same defect
 *    `modeledAmplification` was omitted for, only wearing a foregone conclusion instead of a tie. What
 *    genuinely moves per video is the room-level profile (save alone spans 6 → 48 across real rows),
 *    so that — and only that — is what this section reports. No carriers, and no reach claim: we hold
 *    intent, not distribution.
 */

import type { PopulationAggregate, SegmentReaction } from "@/lib/audience/population";
import { archetypeDisplayName } from "@/lib/audience/archetype-names";
import type { ActionIntentData } from "@/components/audience-lens/v2/domain-template";
import type {
  HeatmapPayload,
  PersonaBehavioralAggregate,
  PersonaSimulationResult,
} from "@/lib/engine/types";

/** The fold's real reception panel, as persisted on the analysis row. */
export interface VideoPopulationInput {
  /** `analysis_results.personas` — the Wave-3 / fold per-persona simulation results. */
  personas: PersonaSimulationResult[];
  /** `analysis_results.heatmap` — read ONLY for `weights` (the room mix) and the hook window. */
  heatmap?: HeatmapPayload | null;
  /** `analysis_results.persona_behavioral_aggregate` — the engine's own weighted intent read. Absent
   *  on a Wave-3-degraded row (the same 10-or-0 gate as `personas`), which omits the intent section. */
  aggregate?: PersonaBehavioralAggregate | null;
}

/**
 * The NUMBERS behind the action-intent section, exactly as sealed. Deliberately prose-free: the
 * one-line read is derived at RENDER (`buildActionIntent`), not baked into the seal, so a copy fix
 * never needs a re-seal. (The `skimmedPct` precedent seals a number for the same reason.)
 */
export interface VideoActionIntent {
  /** 0–100 INTENT INDEX per verb — the engine's top-3-enthusiast weighting, NOT a room rate.
   *  `rewatch` is absent when the row predates `loop_pct` (omit the row, never render a 0). */
  share: number;
  save: number;
  comment: number;
  rewatch?: number;
  /** The real population RATE — the flat mean of survivors' watch-through. A different KIND of
   *  number from the four above (see the honesty note in `buildActionIntent`). */
  watchThroughPct: number;
  /** Real headcounts off the real cast — no weighting, no threshold beyond "any intent at all". */
  total: number;
  /** Personas with at least one action intent above zero. */
  actors: number;
  /** Personas at zero on all four verbs. */
  inert: number;
  /** …of whom, the ones who never scrolled away — they watched it through and would still do nothing. */
  watchedButInert: number;
}

/** The aggregate plus the third band a video can honestly report (text's tri-state middle is 0). */
export interface VideoPopulation {
  aggregate: PopulationAggregate;
  /** % of the cast who stopped scrolling but did NOT reach the end (bailed after the hook). */
  skimmedPct: number;
  /** What the room would DO with it — omitted when the row carries no behavioral aggregate. */
  intents?: VideoActionIntent;
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

  const intents = actionIntent(personas, input.aggregate);

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
    ...(intents ? { intents } : {}),
  };
}

// ── the action intents ────────────────────────────────────────────────────────────────────────────

/** The four action verbs a persona carries, with the label the section prints. */
const INTENT_FIELDS = [
  { key: "share_intent", label: "share" },
  { key: "save_intent", label: "save" },
  { key: "comment_intent", label: "comment" },
  { key: "rewatch_intent", label: "rewatch" },
] as const;

const intentValue = (p: PersonaSimulationResult, key: (typeof INTENT_FIELDS)[number]["key"]): number => {
  const v = p[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
};

/** Round a 0–100 index to a whole number, or null when the engine did not emit it. */
function idx(v: number | undefined | null): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(100, Math.max(0, v))) : null;
}

/**
 * The room's action profile: the ENGINE's own weighted intent read + real headcounts off the cast.
 *
 * The four verb values come from `persona_behavioral_aggregate` rather than a fresh mean over
 * `personas` on purpose — that aggregate is the number the rest of the app already shows for this
 * video, and computing a second, differently-weighted "share" figure for the same run would put two
 * contradictory answers on screen. The price is that it is top-3-enthusiast weighted, so the section
 * MUST disclose that (it does — `note`). Headcounts are unweighted and exact.
 */
function actionIntent(
  personas: PersonaSimulationResult[],
  aggregate?: PersonaBehavioralAggregate | null,
): VideoActionIntent | undefined {
  if (!aggregate) return undefined;
  const share = idx(aggregate.share_pct);
  const save = idx(aggregate.save_pct);
  const comment = idx(aggregate.comment_pct);
  const watchThroughPct = idx(aggregate.completion_pct);
  // The three core verbs are required by the schema; a row missing any of them is malformed, and a
  // profile with holes in it is worse than no profile. `loop_pct` IS optional (older aggregates
  // predate it) so its absence just drops that one row.
  if (share === null || save === null || comment === null || watchThroughPct === null) return undefined;
  const rewatch = idx(aggregate.loop_pct);

  const acts = (p: PersonaSimulationResult): boolean =>
    INTENT_FIELDS.some((f) => intentValue(p, f.key) > 0);
  const actors = personas.filter(acts).length;
  const inertCast = personas.filter((p) => !acts(p));

  return {
    share,
    save,
    comment,
    ...(rewatch !== null ? { rewatch } : {}),
    watchThroughPct,
    total: personas.length,
    actors,
    inert: inertCast.length,
    // "watched it through" reuses the module's own stayed rule (never scrolled away) rather than a
    // watch-% threshold, so the count means exactly what the tri-state's `stayed` band means.
    watchedButInert: inertCast.filter((p) => bailedAt(p) === null).length,
  };
}

/**
 * The gap (index points) a verb must clear to be named alone.
 *
 * Measured on every 10-persona prod row: the top-to-second gap lands at 2.3 · 3.0 · 3.0 · 3.1 · 4.6 ·
 * 5.0 · 5.1 · 5.3 · 6.1 · 6.3 · 12.1. Share and comment are effectively locked together, so a
 * "what they'd do most" crown would be reporting SORT ORDER on ten of eleven videos — the
 * `peerLabel` defect again, one axis over. 8 sits clear above the noise cluster (max 6.3) and below
 * the one genuine separation (12.1). Below the gap, verbs are GROUPED, never ranked.
 */
const INTENT_GAP_MIN = 8;

/** The maximal run from `from` (walking by `step`) whose CONSECUTIVE gaps all stay under the min. */
function runWithinGap(values: number[], from: number, step: 1 | -1): number {
  let n = 1;
  for (let i = from + step; i >= 0 && i < values.length; i += step) {
    if (Math.abs(values[i]! - values[i - step]!) >= INTENT_GAP_MIN) break;
    n += 1;
  }
  return n;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** "save, comment and share" */
function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * Derive the section's one-line read from the sealed numbers. TWO facts, one sentence: what leads
 * (or what runs together) and what the floor is. There is deliberately no third, interpretive clause
 * — every section in this frame that shipped one ended up hardcoding it (`modeledAudienceFit` closed
 * with "a narrower, higher-intent cut" no matter what it had just reported).
 */
export function buildActionIntent(raw: VideoActionIntent): ActionIntentData {
  const rows = [
    { label: "share", value: raw.share },
    { label: "save", value: raw.save },
    { label: "comment", value: raw.comment },
    ...(typeof raw.rewatch === "number" ? [{ label: "rewatch", value: raw.rewatch }] : []),
  ].sort((a, b) => b.value - a.value);

  const values = rows.map((r) => r.value);
  const headN = runWithinGap(values, 0, 1);
  const floorN = runWithinGap(values, values.length - 1, -1);

  let read: string;
  if (headN >= rows.length) {
    // Nothing is separated from anything — say so flatly rather than manufacture a leader.
    const lo = values[values.length - 1]!;
    const hi = values[0]!;
    read =
      lo === hi
        ? `All four verbs land on ${hi} — the room draws no distinction between them.`
        : `All four verbs land in the same band (${lo}–${hi}) — nothing separates them.`;
  } else {
    const head = rows.slice(0, headN);
    const floor = rows.slice(rows.length - floorN);
    const headClause =
      head.length === 1
        ? `${cap(head[0]!.label)} leads at ${head[0]!.value}`
        : `${cap(joinLabels(head.map((r) => r.label)))} run together (${head[head.length - 1]!.value}–${head[0]!.value})`;
    const floorClause =
      floor.length === 1
        ? `${floor[0]!.label} is the floor at ${floor[0]!.value}`
        : `${joinLabels(floor.map((r) => r.label))} are the floor (${floor[floor.length - 1]!.value}–${floor[0]!.value})`;
    read = `${headClause}; ${floorClause}.`;
  }

  return {
    rows,
    watchThroughPct: raw.watchThroughPct,
    total: raw.total,
    actors: raw.actors,
    inert: raw.inert,
    watchedButInert: raw.watchedButInert,
    read,
    // The denominator disclosure. Without it the four values read as rates ("38% would share"), which
    // they are not — unlike `watchThroughPct`, which is a real flat mean and rides the header instead.
    note: "intent index 0–100 · weighted toward the 3 keenest, not a room average",
  };
}
