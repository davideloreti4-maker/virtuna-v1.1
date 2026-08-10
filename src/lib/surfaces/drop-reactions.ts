/**
 * drop-reactions.ts — the DROPS producer (v8 Phase 2, the shelf).
 *
 * The proactive pipe: six proven corpus outliers (multiplier > 3× only, structural
 * round-robin, daily rotation) → each adapted into the user's niche by the REAL
 * adapt.ts call (3 concepts, rank-1 leads the card). Cached in surface_reactions
 * (kind 'drop') once/day/audience — same TTL + lazy re-warm as /start's sections.
 *
 * ⚠️ NO SIM RUNS HERE (owner ruling 2026-08-10): drops arrive UNSCORED — the sim is
 * a completely separate surface. The card's number is the source's receipt (views +
 * "N× their usual views"), not a prediction. The old batched Flash pre-score and the
 * "drops are the only pre-scored surface" law are dead.
 *
 * Cost per warm: 1 embedding + ≤9 adapt calls (6 + up to 3 salvage spares).
 * ⚠️ Drop economics is OWNER CALL #3 — no billing/quota wiring here; the route
 * above this is 404 unless CONCEPT_V8_ENABLED. Do not ship past the flag.
 *
 * Security (CR-01): userId is the SERVER-resolved session user; the audience is
 * resolved server-side. Corpus reads use the service corpus client (shared table);
 * cache reads/writes use the RLS-scoped session client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveUserAudience } from "@/lib/audience/resolve-user-audience";
import { embedQueryText } from "@/lib/grounding/embedder";
import {
  getCorpusClient,
  matchSharedTeardowns,
  type SharedMatchRow,
} from "@/lib/grounding/corpus";
import { generateAdaptConcepts } from "@/lib/engine/remix/adapt";
import type { AdaptConcept } from "@/lib/engine/remix/decode-types";
import type { ProfileRow } from "@/lib/kc/profile-role-map";
import { compactViews, type LiveDropCard } from "./live-cards";
import { corpusRowToAdaptInput } from "./drop-adapt-input";
import { selectDailyDrops, utcDayIndex } from "./drop-select";
import { audienceKeyOf, getFreshSurfaceCards, upsertSurfaceCards } from "./surface-reactions-repo";

/** Six cards on the shelf (spec §1 — owner call: six, not three). */
export const DROP_TARGET = 6;

/** Extra picks adapted only when a first-wave row fails (5/6-shelf salvage). */
export const DROP_SPARES = 3;

/** Injectable I/O boundaries (tests swap these; prod uses the real modules). */
export interface BuildDropsDeps {
  resolveAudience?: typeof resolveUserAudience;
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
 * Build today's real, per-audience drop cards (+ persist to the cache). Total: any
 * full failure (no corpus, embed error, sim error) yields [] → the shelf shows its
 * honest empty state (greeting-only arrival), never a fabricated card.
 */
export async function buildLiveDrops(
  supabase: SupabaseClient,
  userId: string,
  deps: BuildDropsDeps = {},
): Promise<LiveDropCard[]> {
  const resolveAudience = deps.resolveAudience ?? resolveUserAudience;
  const embed = deps.embed ?? embedQueryText;
  const match = deps.match ?? matchSharedTeardowns;
  const adapt = deps.adapt ?? generateAdaptConcepts;
  const corpusClient = deps.corpusClient ?? getCorpusClient;

  // (1) Audience + cache-first (mirrors outlier-reactions 1/1a): a fresh batch for
  //     THIS audience is returned as-is — the daily TTL is the only re-warm trigger.
  const audience = await resolveAudience(supabase, userId);
  const cached = await getFreshSurfaceCards<LiveDropCard>(
    supabase,
    userId,
    audienceKeyOf(audience),
    "drop",
  );
  if (cached) return cached;

  // (2) Profile → niche (remix-runner's exact steer recipe, REMIX-01): a calibrated
  //     audience steers the adapt toward its name + goal; General → profile niche.
  const { data: rawProfile } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const profileRow = rawProfile as unknown as ProfileRow | null;
  const profileNiche = profileRow?.niche_primary ?? "general";
  const isCalibrated = Boolean(audience && !audience.is_general);
  const audienceNiche =
    isCalibrated && audience
      ? `${profileNiche} · ${audience.name}${audience.goal_label ? ` (${audience.goal_label})` : ""}`
      : profileNiche;

  // (3) Retrieval: whole-corpus structural pool — topic orders, never gates (rank.ts
  //     contract; the same no-floor policy the hooks slice runs on).
  let rows: SharedMatchRow[];
  try {
    const embedding = await embed(profileNiche);
    rows = await match(corpusClient(), { embedding, count: 2000 });
  } catch {
    return [];
  }

  // (4) Today's picks: six + spares (drop-ready gate incl. >3× multiplier + daily
  //     rotation). Spares are adapted ONLY when a first-wave row fails — so a bad
  //     adapt no longer costs the shelf a card (the 5/6-shelf defect, 2026-08-10).
  const window = selectDailyDrops(rows, DROP_TARGET + DROP_SPARES, utcDayIndex());
  const picks = window.slice(0, DROP_TARGET);
  const spares = window.slice(DROP_TARGET);
  if (picks.length === 0) return [];

  // (5) Adapt (parallel; a null adapt drops its row, spares refill up to target).
  //     Concepts rank by the adapt call's own /10 projection so the strongest
  //     adapted hook leads the card (mirrors remix-runner's keep-all rank).
  const adaptRow = async (row: SharedMatchRow) => {
    const input = corpusRowToAdaptInput(row, audienceNiche);
    if (!input) return null;
    const concepts = await adapt(input).catch(() => null);
    if (!concepts || concepts.length === 0) return null;
    const ranked = [...concepts].sort(
      (a, b) => clampStops(b.personaStops) - clampStops(a.personaStops),
    );
    return { row, ranked };
  };
  const isAdapted = (x: unknown): x is { row: SharedMatchRow; ranked: AdaptConcept[] } =>
    x !== null;

  const adapted = (await Promise.all(picks.map(adaptRow))).filter(isAdapted);
  const missing = DROP_TARGET - adapted.length;
  if (missing > 0 && spares.length > 0) {
    const refill = (await Promise.all(spares.slice(0, missing).map(adaptRow))).filter(isAdapted);
    adapted.push(...refill);
  }
  if (adapted.length === 0) return [];

  // (6) Assemble — UNSCORED (no sim ran; the receipt is the only number).
  //     Donor niche/prose stay behind: only the receipt-safe fields cross over.
  const cards: LiveDropCard[] = [];
  for (const { row, ranked } of adapted) {
    cards.push({
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
    });
    if (cards.length >= DROP_TARGET) break;
  }

  // (8) Persist for lazy re-warm (best-effort — the cards return regardless).
  try {
    await upsertSurfaceCards(supabase, userId, audienceKeyOf(audience), "drop", cards);
  } catch {
    // Non-fatal: the cache is an optimization, not the source of truth.
  }

  return cards;
}
