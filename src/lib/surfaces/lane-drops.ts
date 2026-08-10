/**
 * lane-drops.ts — the day-0 LANE producer (v8 Phase 5, spec §4.2 / mock §9 right).
 *
 * The same proactive pipe as the shelf (drop-reactions.ts), pointed at candidate
 * lanes instead of a calibrated audience: one proven corpus outlier per lane →
 * adapted into THAT lane's niche by the real adapt.ts call. The reveal is the shelf,
 * grouped (spec §4.3).
 *
 * ⚠️ NO SIM RUNS HERE (owner ruling 2026-08-12). Lane cards used to carry a pre-score
 * from ONE batched Flash against GENERAL_AUDIENCE — a day-zero user has no calibrated
 * audience, that is the premise of the flow. So the meter printed a number that LOOKED
 * personal and wasn't, on the very first screen that teaches what your numbers mean,
 * and it billed a batch on unconverted traffic. The card's number is now the same
 * RECEIPT the shipped shelf carries: the source's real views + its outlier multiplier
 * ("N× their usual views"), which is a fact about the VIDEO and needs no audience.
 * Both fields ride on the corpus row this producer already holds — zero extra calls,
 * and `isDropReady` guarantees `outlier_multiplier > 3` on every pick.
 *
 * NO CACHE, by design. The drops shelf caches once/day/audience because it re-warms
 * every day; a lane reveal happens once, for a user who does not yet have an audience
 * to key a cache on. It runs on an explicit submit and never on navigation.
 *
 * Cost per reveal: 1 embedding + <= LANE_MAX adapt calls.
 * ⚠️ Drop economics is OWNER CALL #3 — no billing/quota wiring here; the route above
 * this is 404 unless CONCEPT_V8_ENABLED.
 *
 * Security (CR-01): this producer reads NO user-scoped data at all any more — the corpus
 * is a shared service table. The route above it still gates on the server-resolved session
 * user before spending; that gate is the one that matters and it has not moved.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { embedQueryText } from "@/lib/grounding/embedder";
import {
  getCorpusClient,
  matchSharedTeardowns,
  type SharedMatchRow,
} from "@/lib/grounding/corpus";
import { generateAdaptConcepts } from "@/lib/engine/remix/adapt";
import type { AdaptConcept } from "@/lib/engine/remix/decode-types";
import type { Lane } from "@/lib/engine/lanes/lane-types";
import { compactViews, type LiveDropCard } from "./live-cards";
import { corpusRowToAdaptInput } from "./drop-adapt-input";
import { selectDailyDrops, utcDayIndex } from "./drop-select";

/** Mock §9 shows exactly one card under each lane head. */
export const CARDS_PER_LANE = 1;

/** One lane and the proven card that argues for it. */
export interface LaneShelf {
  lane: Lane;
  cards: LiveDropCard[];
}

/** Injectable I/O boundaries (tests swap these; prod uses the real modules). */
export interface BuildLaneDropsDeps {
  embed?: typeof embedQueryText;
  match?: typeof matchSharedTeardowns;
  adapt?: typeof generateAdaptConcepts;
  corpusClient?: () => SupabaseClient;
}

function clampStops(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
  return Math.min(10, Math.max(0, n));
}

/**
 * Build one card per lane. Total: any full failure (no corpus, embed error) yields [] →
 * the reveal shows its honest empty state, never a fabricated lane.
 *
 * ⚠️ Takes NO supabase client and NO userId. It used to read `creator_profiles` for the
 * Flash panel's niche steer; with the sim gone that read had no consumer, and there is no
 * other user-scoped read here — the corpus is a shared service table.
 */
export async function buildLaneDrops(
  lanes: Lane[],
  deps: BuildLaneDropsDeps = {},
): Promise<LaneShelf[]> {
  if (lanes.length === 0) return [];

  const embed = deps.embed ?? embedQueryText;
  const match = deps.match ?? matchSharedTeardowns;
  const adapt = deps.adapt ?? generateAdaptConcepts;
  const corpusClient = deps.corpusClient ?? getCorpusClient;

  // (1) Retrieval, steered by the lanes themselves — the creator has no niche yet, so the
  //     lane niches ARE the query. Topic orders the pool, never gates it (rank.ts contract).
  let rows: SharedMatchRow[];
  try {
    const embedding = await embed(lanes.map((l) => l.niche).join(" · "));
    rows = await match(corpusClient(), { embedding, count: 2000 });
  } catch {
    return [];
  }

  // (2) One distinct drop-ready row per lane (structural round-robin — different SHAPES,
  //     so no two lanes argue with the same format). `isDropReady` inside this gate is also
  //     what guarantees every pick carries an `outlier_multiplier` > 3 for the card receipt.
  const picks = selectDailyDrops(rows, lanes.length * CARDS_PER_LANE, utcDayIndex());
  if (picks.length === 0) return [];

  // (3) Adapt each lane's row into THAT lane's niche (parallel; a null adapt drops its lane
  //     and leaves the others standing — per-lane salvage).
  const adapted = (
    await Promise.all(
      lanes.map(async (lane, i) => {
        const row = picks[i % picks.length];
        if (!row) return null;
        const input = corpusRowToAdaptInput(row, lane.niche);
        if (!input) return null;
        const concepts = await adapt(input).catch(() => null);
        if (!concepts || concepts.length === 0) return null;
        const ranked = [...concepts].sort(
          (a, b) => clampStops(b.personaStops) - clampStops(a.personaStops),
        );
        return { lane, row, ranked };
      }),
    )
  ).filter((x): x is { lane: Lane; row: SharedMatchRow; ranked: AdaptConcept[] } => x !== null);
  if (adapted.length === 0) return [];

  // (4) Assemble. Donor niche/prose stay behind: only the receipt-safe fields cross over.
  //     `multiplier`/`baselineLabel` are the card's number now — a fact about the video,
  //     carried off the row for free. No `personas`: nothing here is simmed.
  return adapted.map(({ lane, row, ranked }) => ({
    lane,
    cards: [
      {
        contentId: row.id,
        hook: ranked[0]!.hook,
        coverUrl: row.cover_url!,
        videoUrl: row.video_url,
        views: compactViews(row.views ?? 0),
        viewsRaw: row.views ?? 0,
        handle: row.creator_handle!.trim(),
        archetype: row.hook_archetype,
        hookTemplate: row.hook_template,
        multiplier: row.outlier_multiplier!,
        baselineLabel: row.baseline_label,
        concepts: ranked,
      },
    ],
  }));
}
