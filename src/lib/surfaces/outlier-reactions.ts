/**
 * outlier-reactions — the OUTLIERS producer (Seams 1/2, docs/SURFACE-SEAM-SPEC.md).
 *
 * Sources the /start "outliers to remix" cards from REAL content simmed against the user's
 * people: the ingested competitor/feed corpus (scraped_videos, via queryFeed) already exists,
 * so no generation is needed — each top outlier's caption is reacted to by the user's resolved
 * audience in ONE batched Flash call (runFlashTextModeBatch — the same niche-discriminating sim
 * the ideas/hooks runners use; never a reinvented scorer). The result is the real per-persona
 * reaction the card face + the opened Room both derive from (honesty spine — nothing fabricated).
 *
 * Cost: ONE batched sim per (user × audience) per refresh, cached in surface_reactions and
 * re-warmed lazily on the first /start visit of the day (owner cadence, 2026-07-05). Callers:
 * the /start refresh route (POST /api/surfaces/outliers) on a cache miss.
 *
 * Security (CR-01): userId is the SERVER-resolved session user; the audience is resolved
 * server-side (resolveUserAudience), never from a request body.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveUserAudience } from "@/lib/audience/resolve-user-audience";
import { buildReactionPanel } from "@/lib/engine/flash/build-reaction-panel";
import { runFlashTextModeBatch } from "@/lib/engine/flash/run-flash-text-mode";
import { goalIntentToLens } from "@/lib/audience/intent-lens";
import { queryFeed, type FeedTile } from "@/lib/feed/feed-query";
import type { ProfileRow } from "@/lib/kc/profile-role-map";
import type { LiveOutlierCard } from "./live-cards";
import { audienceKeyOf, getFreshSurfaceCards, upsertSurfaceCards } from "./surface-reactions-repo";

/** Cards shown on /start (the outlier rail is 3-across on desktop). */
const OUTLIER_TARGET = 3;
/** Over-fetch so empty-caption rows + per-candidate sim misses still leave TARGET cards. */
const OUTLIER_FETCH = 6;

/** 118000 → "118K", 1_200_000 → "1.2M" (honest compaction; real scraped views). */
function compactViews(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}

/** 1.83 → "1.8x". */
function fmtMult(m: number): string {
  const v = Number.isFinite(m) && m > 0 ? m : 0;
  return `${v.toFixed(1)}x`;
}

/** A readable @handle for the card, from the tile's tracked handle or its niche/source label. */
function handleOf(t: FeedTile): string {
  if (t.trackHandle) return `@${t.trackHandle}`;
  return t.source || "creator";
}

/**
 * Build the real, per-audience outlier cards for a user (+ persist to the cache). Total: any
 * failure (no corpus, sim error) yields [] → the section shows its honest empty state.
 */
export async function buildLiveOutliers(
  supabase: SupabaseClient,
  userId: string,
): Promise<LiveOutlierCard[]> {
  // (1) The audience the room reacts as — the user-level last-used (same read the dock + threads use).
  const audience = await resolveUserAudience(supabase, userId);

  // (1a) Cache-first. A fresh batch for THIS audience (within the TTL) is returned as-is — no
  //      re-sim. This makes an audience switch on the dock a cache HIT for an already-warm
  //      audience: the cost is one batched sim per never-seen audience, then served from cache
  //      until the daily re-warm. A miss / stale entry falls through to a fresh sim below.
  const cached = await getFreshSurfaceCards<LiveOutlierCard>(
    supabase,
    userId,
    audienceKeyOf(audience),
    "outlier",
  );
  if (cached) return cached;

  // (2) Creator profile → niche panel (cold-start safe; null → honest generic panel).
  const { data: rawProfile } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const profileRow = rawProfile as unknown as ProfileRow | null;

  // (3) The top outliers in the corpus (trending = the whole non-archived set, best multiplier first).
  let tiles: FeedTile[] = [];
  try {
    const page = await queryFeed(
      supabase,
      { tab: "trending", sort: "outlier", limit: OUTLIER_FETCH, cursor: null, filters: {} },
      null,
    );
    tiles = page.tiles;
  } catch {
    tiles = [];
  }
  // The sim reacts to the caption/hook — drop rows with no caption to react to.
  const usable = tiles.filter((t) => t.caption.trim().length > 0);
  if (usable.length === 0) return [];

  // (4) The niche panel + audience repaint + per-run intent lens (mirrors the react route).
  const { panel, audienceRepaint } = buildReactionPanel(profileRow, audience);
  const intent =
    audience && !audience.is_general ? goalIntentToLens(audience.goal_intent) : undefined;

  // (5) ONE batched Flash sim scoring every outlier's caption by all 10 archetypes.
  const candidates = usable.map((t) => ({ id: t.platformVideoId, text: t.caption }));
  let results: Awaited<ReturnType<typeof runFlashTextModeBatch>>["results"];
  try {
    ({ results } = await runFlashTextModeBatch(candidates, "hook", panel, audienceRepaint, intent));
  } catch {
    return [];
  }

  // (6) Assemble the cards, keeping only outliers that returned a valid sim, capped at TARGET.
  const cards: LiveOutlierCard[] = [];
  for (const t of usable) {
    const result = results.get(t.platformVideoId);
    if (!result) continue; // per-candidate salvage — a malformed one drops itself
    cards.push({
      contentId: t.platformVideoId,
      handle: handleOf(t),
      caption: t.caption,
      mult: fmtMult(t.multiplier),
      views: compactViews(t.views),
      coverUrl: t.coverUrl,
      personas: result.personas,
    });
    if (cards.length >= OUTLIER_TARGET) break;
  }

  // (7) Persist for lazy re-warm (best-effort — the cards return regardless of the write).
  try {
    await upsertSurfaceCards(supabase, userId, audienceKeyOf(audience), "outlier", cards);
  } catch {
    // Non-fatal: the cache is an optimization, not the source of truth.
  }

  return cards;
}
