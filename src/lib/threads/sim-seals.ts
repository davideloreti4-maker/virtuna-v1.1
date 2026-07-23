/**
 * sim-seals.ts — Ambient Audience v2 Phase D persistence helpers for `threads.sim_seals`.
 *
 * A sealed-sim verdict per stimulus, so a MEASURED "would-stop %" survives a reload. The store is a
 * single jsonb column on the thread row (migration `20260723090753_thread_sim_seals.sql`), keyed by
 * the card's TRIMMED concept text — content-addressed, because the descriptor's positional id
 * (`hook-0`) is not stable across reload. Written on a DELIBERATE Overview sim; read on rehydrate.
 *
 * No runtime Supabase import (the client takes `supabase` as a param), so `readSimSeals` is safe to
 * reach from any layer; `writeSimSeal` is non-fatal by contract (a seal-write failure must NEVER
 * break the reaction — mirrors the flywheel pin's content-first posture).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ThreadRow } from "./threads";
import type { Json } from "@/types/database.types";
import type { PopulationAggregate } from "@/lib/audience/population";
import type { PopulationPersona } from "@/lib/surfaces/ambient-v2-population";
import type { GeminiVideoSignals, HeatmapPayload, VerbatimPayload } from "@/lib/engine/types";

/** The Phase-C Brain (VIDEO) depth payload — the persisted-analysis read a video Test seals so the
 *  Brain drill survives reload. All REAL, from the `/api/analyze` Max row: the per-segment attention
 *  `heatmap`, the four `GeminiVideoSignals` craft dims, the `VerbatimPayload` transcript, and the
 *  honest would-stop `stopPct` (the first-2s hold). `ambient-v2-brain.ts` maps it → the Brain tab.
 *  Distinct from the TEXT-sim `population` depth above: a video seal carries `video`, a text seal
 *  carries `population` — the drill picks the Brain-first or Population-first Detail accordingly. */
export interface SimSealVideo {
  analysisId: string; // the persisted analysis this depth came from (stable id)
  stopPct: number; // 0..100 would-stop % (heatmap.weighted_hook_score) — drives the cortex + verdict
  heatmap: HeatmapPayload; // per-segment attention (weighted_curve) + the segment grid
  videoSignals?: GeminiVideoSignals | null; // the four craft dims (absent → no signal rows)
  verbatim?: VerbatimPayload | null; // the transcript (absent → the scrubber reads segment labels)
}

/** One sealed verdict — the honest aggregate, no fabricated precision.
 *
 *  `pct`/`band`/`at` are the reload-surviving Overview verdict (Phase D). The optional `population`/
 *  `personas`/`scrollQuote` are the Phase-C DEPTH payload (react's Stage-2 projection + the exemplar
 *  cast) so the audience-depth drill survives reload too — content-addressed by concept text, same
 *  key. All three are OPTIONAL: an older seal, or a General/uncalibrated audience (null population),
 *  writes only the verdict and the depth drill honestly falls back to its empty state. */
export interface SimSeal {
  pct: number; // 0..100 would-stop % (aggregateFlash "N/10 stop" as a percentage)
  band: string | null; // "Strong" | "Mixed" | "Weak" — the qualitative aggregate
  at: string; // ISO timestamp the seal was written
  population?: PopulationAggregate | null; // Stage-2 N-individual projection (Phase C text depth)
  personas?: PopulationPersona[]; // the 10 real per-persona reactions (exemplar voices)
  scrollQuote?: string; // the lead scroll-verdict quote (the room's headline objection)
  video?: SimSealVideo | null; // Phase C VIDEO depth (the persisted-analysis Brain read)
}

/** trimmed concept text → its sealed verdict. */
export type SimSealMap = Record<string, SimSeal>;

/** The stable seal key for a stimulus — the trimmed concept text (matches the client lookup). */
export function sealKey(stimulus: string): string {
  return stimulus.trim();
}

/** A minimal shape guard for a persisted `PopulationAggregate` — enough that the depth adapter can
 *  read it without throwing. A blob failing this is dropped (the verdict seal still survives). */
function isPopulationLike(v: unknown): boolean {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const p = v as { total?: unknown; segments?: unknown; reasons?: unknown };
  return typeof p.total === "number" && Array.isArray(p.segments) && Array.isArray(p.reasons);
}

/** A minimal shape guard for a persisted `SimSealVideo` — a real heatmap curve + the ids the Brain
 *  adapter reads. A blob failing this is dropped (the verdict seal still survives). */
function isVideoLike(v: unknown): boolean {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const p = v as { analysisId?: unknown; stopPct?: unknown; heatmap?: unknown };
  if (typeof p.analysisId !== "string" || typeof p.stopPct !== "number") return false;
  const h = p.heatmap as { weighted_curve?: unknown } | undefined | null;
  return !!h && typeof h === "object" && Array.isArray(h.weighted_curve) && h.weighted_curve.length > 0;
}

/** Parse a thread's `sim_seals` jsonb into a typed, validated map. Malformed entries are dropped
 *  (never guessed) so a corrupt row can never fabricate a seal. */
export function readSimSeals(thread: Pick<ThreadRow, "sim_seals">): SimSealMap {
  const raw = thread.sim_seals;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: SimSealMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const val = v as {
        pct?: unknown;
        band?: unknown;
        at?: unknown;
        population?: unknown;
        personas?: unknown;
        scrollQuote?: unknown;
        video?: unknown;
      };
      if (typeof val.pct === "number" && Number.isFinite(val.pct)) {
        const seal: SimSeal = {
          pct: val.pct,
          band: typeof val.band === "string" ? val.band : null,
          at: typeof val.at === "string" ? val.at : "",
        };
        // Optional Phase-C depth — passed through only when well-formed; a malformed depth blob is
        // dropped (never guessed) but the verdict seal survives.
        if (isPopulationLike(val.population)) {
          seal.population = val.population as PopulationAggregate;
        }
        if (Array.isArray(val.personas)) {
          seal.personas = val.personas as PopulationPersona[];
        }
        if (typeof val.scrollQuote === "string") seal.scrollQuote = val.scrollQuote;
        // Optional Phase-C VIDEO depth — passed through only when well-formed (a real heatmap curve);
        // a malformed blob is dropped but the verdict seal survives.
        if (isVideoLike(val.video)) {
          seal.video = val.video as SimSealVideo;
        }
        out[k] = seal;
      }
    }
  }
  return out;
}

/**
 * Merge one sealed verdict into a thread's `sim_seals` and persist it. Read-merge-write off the
 * ALREADY-loaded thread row (no extra select — the caller holds it). NON-FATAL: returns false on any
 * failure, never throws, so a persistence hiccup can't break the reaction the seal came from.
 */
export async function writeSimSeal(
  supabase: SupabaseClient,
  thread: Pick<ThreadRow, "id" | "sim_seals">,
  stimulus: string,
  seal: SimSeal,
): Promise<boolean> {
  const key = sealKey(stimulus);
  if (key.length === 0) return false;
  try {
    const next: SimSealMap = { ...readSimSeals(thread), [key]: seal };
    const { error } = await supabase
      .from("threads")
      .update({ sim_seals: next as unknown as Json })
      .eq("id", thread.id);
    if (error) {
      console.error("[sim-seals] seal write failed (non-fatal):", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      "[sim-seals] seal write threw (non-fatal):",
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}
