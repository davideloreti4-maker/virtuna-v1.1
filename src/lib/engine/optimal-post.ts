import { createLogger } from "@/lib/logger";
import type { createServiceClient } from "@/lib/supabase/service";
import type { CreatorContext } from "./creator";

const log = createLogger({ module: "engine.optimal-post" });

/**
 * Locked by CONTEXT D-13 — shape that the P5 "When to post" panel (R6.2)
 * consumes from PredictionResult.optimal_post_window.
 *
 * `source` enum is future-proofed for M2-II creator-aware overrides (D-12);
 * P1 only emits 'niche' or 'fallback'.
 */
export interface OptimalPostWindow {
  day_of_week: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  hour_range: [number, number]; // 0-23, half-open
  timezone: "UTC";
  reasoning: string;
  source: "niche" | "creator" | "fallback";
}

/**
 * Default recommendation when niche-specific data is unavailable.
 *
 * Tue 18:00-21:00 UTC chosen as a defensible neutral default:
 *  - Tuesday is the most consistent mid-week engagement day across niches
 *    (avoids Mon-fatigue + Fri-distraction edges).
 *  - 18:00-21:00 UTC overlaps the EU evening + US afternoon prime windows.
 *
 * P5 panel renders this with source='fallback' as a soft suggestion ("Default
 * recommendation — niche-specific data unavailable") rather than a niche
 * insight.
 */
export const FALLBACK_POST_WINDOW: OptimalPostWindow = {
  day_of_week: "Tue",
  hour_range: [18, 21],
  timezone: "UTC",
  reasoning: "Default recommendation — niche-specific data unavailable",
  source: "fallback",
};

/**
 * Phase 1 (R6.1, D-15) — niche-aware optimal posting window.
 *
 * Behavior:
 *  - niche null → FALLBACK_POST_WINDOW (no DB call)
 *  - niche found in niche_post_windows → OptimalPostWindow with source='niche'
 *  - niche NOT found (PGRST116 no-rows) → FALLBACK_POST_WINDOW
 *  - Supabase error (table missing, network, etc.) → null (non-fatal per D-15;
 *    aggregator caller catches and degrades the panel to generic copy)
 *
 * `_creator` is unused in P1 per D-12 — creator-aware weighting is deferred to
 * M2-II until outcome data justifies the override. Schema is future-proofed via
 * the `source: 'creator'` enum value so a future helper can return creator-
 * overridden windows without breaking the consumer contract.
 *
 * No new LLM call — pure DB lookup against the materialized aggregate. Latency
 * budget: <50ms (single PRIMARY KEY lookup; Pitfall #4 ordering).
 */
export async function computeOptimalPostWindow(
  supabase: ReturnType<typeof createServiceClient>,
  niche: string | null,
  _creator: CreatorContext | null,
): Promise<OptimalPostWindow | null> {
  if (!niche) return FALLBACK_POST_WINDOW;

  // Internal row shape for the niche_post_windows aggregate. The Supabase
  // generated `Database` type does NOT yet include this table (Plan 07 BLOCKING
  // gate runs `supabase db push` + types regeneration). Use the same
  // cast-through-unknown pattern as calibration.ts:fetchOutcomePairs to satisfy
  // tsc on the un-typed table until then.
  interface NichePostWindowRow {
    day_of_week: string;
    hour_start: number;
    hour_end: number;
    sample_size: number;
  }

  try {
    const { data, error } = (await supabase
      .from("niche_post_windows" as never)
      .select("day_of_week, hour_start, hour_end, sample_size")
      .eq("niche" as never, niche)
      .single()) as unknown as {
      data: NichePostWindowRow | null;
      error: { code?: string; message?: string } | null;
    };

    if (error) {
      // PGRST116 (no rows for .single()) is the expected "unknown niche" path —
      // degrade to FALLBACK, not null. Distinguishes "we don't have data for
      // your niche yet" from "the DB is broken".
      if (error.code === "PGRST116") {
        return FALLBACK_POST_WINDOW;
      }
      log.warn("niche_post_windows lookup error", {
        niche,
        code: error.code,
        message: error.message,
      });
      return null; // non-fatal per D-15
    }
    if (!data) return FALLBACK_POST_WINDOW;

    const dow = data.day_of_week as OptimalPostWindow["day_of_week"];
    return {
      day_of_week: dow,
      hour_range: [data.hour_start, data.hour_end],
      timezone: "UTC",
      reasoning: `Your niche peaks ${dow} ${data.hour_start}:00-${data.hour_end}:00 UTC (n=${data.sample_size} videos)`,
      source: "niche",
    };
  } catch (err) {
    log.error("computeOptimalPostWindow threw", {
      niche,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
