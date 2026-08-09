/**
 * lane-drops.ts — the day-0 LANE producer (v8 Phase 5, spec §4.2 / mock §9 right).
 *
 * The same proactive pipe as the shelf (drop-reactions.ts), pointed at candidate
 * lanes instead of a calibrated audience: one proven corpus outlier per lane →
 * adapted into THAT lane's niche by the real adapt.ts call → ONE batched Flash sim
 * of the lead hooks. The reveal is the shelf, grouped (spec §4.3).
 *
 * NO CACHE, by design. The drops shelf caches once/day/audience because it re-warms
 * every day; a lane reveal happens once, for a user who does not yet have an audience
 * to key a cache on. It runs on an explicit submit and never on navigation.
 *
 * ⚠️ Simmed against GENERAL_AUDIENCE — the virtual baseline constant (never touches the
 * DB). At this point in onboarding there IS no calibrated audience; that is the premise
 * of the whole flow. The Flash SIM is platform-blind; nothing here may imply otherwise.
 *
 * Cost per reveal: 1 embedding + <= LANE_MAX adapt calls + 1 batched Flash.
 * ⚠️ Drop economics is OWNER CALL #3 — no billing/quota wiring here; the route above
 * this is 404 unless CONCEPT_V8_ENABLED.
 *
 * Security (CR-01): userId is the SERVER-resolved session user. Corpus reads use the
 * service corpus client (shared table); the profile read uses the RLS-scoped client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import { buildReactionPanel } from "@/lib/engine/flash/build-reaction-panel";
import { runFlashTextModeBatch } from "@/lib/engine/flash/run-flash-text-mode";
import { embedQueryText } from "@/lib/grounding/embedder";
import {
  getCorpusClient,
  matchSharedTeardowns,
  type SharedMatchRow,
} from "@/lib/grounding/corpus";
import { generateAdaptConcepts } from "@/lib/engine/remix/adapt";
import type { AdaptConcept } from "@/lib/engine/remix/decode-types";
import type { ProfileRow } from "@/lib/kc/profile-role-map";
import type { Lane } from "@/lib/engine/lanes/lane-types";
import { compactViews, type LiveDropCard } from "./live-cards";
import { corpusRowToAdaptInput } from "./drop-adapt-input";
import { selectDailyDrops, utcDayIndex } from "./drop-select";

/** Mock §9 shows exactly one card under each lane head. */
export const CARDS_PER_LANE = 1;

/** One lane and the pre-scored card that argues for it. */
export interface LaneShelf {
  lane: Lane;
  cards: LiveDropCard[];
}

/** Injectable I/O boundaries (tests swap these; prod uses the real modules). */
export interface BuildLaneDropsDeps {
  embed?: typeof embedQueryText;
  match?: typeof matchSharedTeardowns;
  adapt?: typeof generateAdaptConcepts;
  flashBatch?: typeof runFlashTextModeBatch;
  corpusClient?: () => SupabaseClient;
}

function clampStops(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
  return Math.min(10, Math.max(0, n));
}

/**
 * Build one pre-scored card per lane. Total: any full failure (no corpus, embed error,
 * sim error) yields [] → the reveal shows its honest empty state, never a fabricated lane.
 */
export async function buildLaneDrops(
  supabase: SupabaseClient,
  userId: string,
  lanes: Lane[],
  deps: BuildLaneDropsDeps = {},
): Promise<LaneShelf[]> {
  if (lanes.length === 0) return [];

  const embed = deps.embed ?? embedQueryText;
  const match = deps.match ?? matchSharedTeardowns;
  const adapt = deps.adapt ?? generateAdaptConcepts;
  const flashBatch = deps.flashBatch ?? runFlashTextModeBatch;
  const corpusClient = deps.corpusClient ?? getCorpusClient;

  // (1) Profile — the Flash panel's niche steer. Absent for a day-0 user, which is fine:
  //     buildReactionPanel resolves a generic panel from null.
  const { data: rawProfile } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const profileRow = rawProfile as unknown as ProfileRow | null;

  // (2) Retrieval, steered by the lanes themselves — the creator has no niche yet, so the
  //     lane niches ARE the query. Topic orders the pool, never gates it (rank.ts contract).
  let rows: SharedMatchRow[];
  try {
    const embedding = await embed(lanes.map((l) => l.niche).join(" · "));
    rows = await match(corpusClient(), { embedding, count: 2000 });
  } catch {
    return [];
  }

  // (3) One distinct drop-ready row per lane (structural round-robin — different SHAPES,
  //     so no two lanes argue with the same format).
  const picks = selectDailyDrops(rows, lanes.length * CARDS_PER_LANE, utcDayIndex());
  if (picks.length === 0) return [];

  // (4) Adapt each lane's row into THAT lane's niche (parallel; a null adapt drops its lane
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

  // (5) ONE batched Flash across every lane's lead hook — the sanctioned proactive pipe.
  //     No intent lens: GENERAL_AUDIENCE carries no goal_intent to derive one from.
  const { panel, audienceRepaint } = buildReactionPanel(profileRow, GENERAL_AUDIENCE);
  let results: Awaited<ReturnType<typeof runFlashTextModeBatch>>["results"];
  try {
    ({ results } = await flashBatch(
      adapted.map(({ row, ranked }) => ({ id: row.id, text: ranked[0]!.hook })),
      "hook",
      panel,
      audienceRepaint,
    ));
  } catch {
    return [];
  }

  // (6) Assemble — a lane whose row got no sim result drops itself (no meter, no card).
  //     Donor niche/prose stay behind: only the receipt-safe fields cross over.
  const shelves: LaneShelf[] = [];
  for (const { lane, row, ranked } of adapted) {
    const sim = results.get(row.id);
    if (!sim) continue;
    shelves.push({
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
          concepts: ranked,
          personas: sim.personas,
        },
      ],
    });
  }

  return shelves;
}
