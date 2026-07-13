/**
 * idea-reactions — the DAILY-IDEAS producer (Seams 1/2, docs/SURFACE-SEAM-SPEC.md).
 *
 * Where outliers sim EXISTING competitor videos, daily-ideas needs the content GENERATED first —
 * but the `ideas` skill (runIdeasPipeline) already generate→sim→ranks in ONE call, emitting ≤3
 * idea-card blocks that each carry their own real Flash reaction (S3′ `personas`). So this is NOT
 * a from-scratch pipeline: run the pipeline for the user, take its ranked blocks, and map each to
 * a LiveIdeaCard whose face + opened Room derive from those real personas (honesty spine).
 *
 * Cost: ONE ideas run per (user × audience) per refresh, cached in surface_reactions and re-warmed
 * lazily on the first /start visit of the day (owner cadence). Caller: POST /api/surfaces/ideas.
 *
 * Security (CR-01): userId is the SERVER-resolved session user; the audience is resolved
 * server-side (resolveUserAudience), never from a request body.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveUserAudience } from "@/lib/audience/resolve-user-audience";
import { runIdeasPipeline } from "@/lib/tools/runners/ideas-runner";
import { goalIntentToLens } from "@/lib/audience/intent-lens";
import type { IdeaCardBlock } from "@/lib/tools/blocks";
import type { ProfileRow } from "@/lib/kc/profile-role-map";
import type { LiveIdeaCard } from "./live-cards";
import { audienceKeyOf, getFreshSurfaceCards, upsertSurfaceCards } from "./surface-reactions-repo";

/** Cards shown on /start (the pipeline over-generates → ≤3 ranked blocks). */
const IDEA_TARGET = 4;

/** Map the block's free-text `format` to the card's type pill (Carousel vs Reel — the two shapes). */
function typeOf(format: string | null): LiveIdeaCard["type"] {
  return format != null && /carousel|slide|photo|post/i.test(format) ? "Carousel" : "Reel";
}

/**
 * Build the real, per-audience daily-idea cards for a user (+ persist to the cache). Total: any
 * failure (pipeline error, no personas) yields [] → the section shows its honest empty state.
 */
export async function buildLiveIdeas(
  supabase: SupabaseClient,
  userId: string,
): Promise<LiveIdeaCard[]> {
  // (1) The audience the room reacts as — the user-level last-used (same read the dock + threads use).
  const audience = await resolveUserAudience(supabase, userId);

  // (1a) Cache-first. A fresh batch for THIS audience (within the TTL) is returned as-is — no
  //      re-sim. This makes an audience switch on the dock a cache HIT for an already-warm
  //      audience: the cost is one ideas run per never-seen audience, then served from cache until
  //      the daily re-warm. A miss / stale entry falls through to a fresh generate→sim→rank below.
  const cached = await getFreshSurfaceCards<LiveIdeaCard>(
    supabase,
    userId,
    audienceKeyOf(audience),
    "idea",
  );
  if (cached) return cached;

  // (2) Creator profile → grounds generation (cold-start safe; null degrades gracefully).
  const { data: rawProfile } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const profileRow = rawProfile as unknown as ProfileRow | null;

  // (3) Generate → sim → rank in ONE call. Proactive (no ask → the pipeline's own profile prompt);
  //     intent gated to a calibrated audience (General → no-op inside the runner).
  let blocks: IdeaCardBlock[] = [];
  try {
    const result = await runIdeasPipeline({
      ask: "",
      platform: "tiktok",
      profileRow: profileRow ?? null,
      audience,
      intent: goalIntentToLens(audience.goal_intent),
      pin: { supabase, analysisId: null },
    });
    blocks = result.blocks as IdeaCardBlock[];
  } catch {
    return [];
  }

  // (4) Map ranked blocks → cards, keeping only those carrying a real reaction (S3′ personas),
  //     capped at TARGET. A block without personas can't open a real Room — skip it (honesty spine).
  const cards: LiveIdeaCard[] = [];
  blocks.forEach((b, i) => {
    const personas = b.props.personas;
    if (!personas || personas.length === 0) return;
    cards.push({
      contentId: `idea-${i}`,
      type: typeOf(b.props.format),
      title: b.props.title,
      personas,
      // GROUNDING (§11f): carry the frozen source receipt when the grounded pipeline attributed
      // this idea to a real outlier. null on ungrounded runs (flag OFF) → the card degrades to the
      // pre-grounding shape (byte-identical, cache-safe). The glance card renders <ProofLine>.
      proof: b.props.proof ?? null,
    });
  });
  const top = cards.slice(0, IDEA_TARGET);

  // (5) Persist for lazy re-warm (best-effort — the cards return regardless of the write).
  try {
    await upsertSurfaceCards(supabase, userId, audienceKeyOf(audience), "idea", top);
  } catch {
    // Non-fatal: the cache is an optimization, not the source of truth.
  }

  return top;
}
