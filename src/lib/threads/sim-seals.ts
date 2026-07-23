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

/** One sealed verdict — the honest aggregate, no fabricated precision. */
export interface SimSeal {
  pct: number; // 0..100 would-stop % (aggregateFlash "N/10 stop" as a percentage)
  band: string | null; // "Strong" | "Mixed" | "Weak" — the qualitative aggregate
  at: string; // ISO timestamp the seal was written
}

/** trimmed concept text → its sealed verdict. */
export type SimSealMap = Record<string, SimSeal>;

/** The stable seal key for a stimulus — the trimmed concept text (matches the client lookup). */
export function sealKey(stimulus: string): string {
  return stimulus.trim();
}

/** Parse a thread's `sim_seals` jsonb into a typed, validated map. Malformed entries are dropped
 *  (never guessed) so a corrupt row can never fabricate a seal. */
export function readSimSeals(thread: Pick<ThreadRow, "sim_seals">): SimSealMap {
  const raw = thread.sim_seals;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: SimSealMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const val = v as { pct?: unknown; band?: unknown; at?: unknown };
      if (typeof val.pct === "number" && Number.isFinite(val.pct)) {
        out[k] = {
          pct: val.pct,
          band: typeof val.band === "string" ? val.band : null,
          at: typeof val.at === "string" ? val.at : "",
        };
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
