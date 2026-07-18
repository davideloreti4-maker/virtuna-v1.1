/**
 * /api/tools/test/card — the /test in-thread card adapter (TEST-01).
 *
 * The heavy work already happened: the in-thread Test field ran the FULL /api/analyze Max
 * video pipeline (untouched) on the creator's real video, which billed + persisted a scored
 * analysis_results row. This route is the thin, CHEAP adapter that turns that persisted row
 * into the one honest thread card and drops it in the open thread — so the Test lands
 * in-thread like every other skill (owner: "all skills 1:1 in thread"), no navigate-out.
 *
 * It does NO engine work and spends NO money: it reads a row the caller already owns (RLS),
 * maps it (predictionResultToVideoTestCard — bands/words only, never the 0-100 score), and
 * persists the block. The paid leash lives entirely on /api/analyze upstream.
 *
 * Security spine (mirrors the read route):
 *   - Auth BEFORE any DB read.
 *   - CSRF guard (Content-Type 415 + cross-origin 403).
 *   - The row is loaded user-scoped (.eq user_id) — a forged/cross-user analysisId 404s.
 *   - The active audience id is read from the THREAD pin, never the body.
 *   - insertMessage re-validates the block at the write boundary + stamps KC_GEN_VERSION.
 *
 * Degrade honesty: a row with no per-persona results has no honest audience reaction to show,
 * so the mapper returns null and this route responds { degraded: "no_audience_reaction" } with
 * the analysisId — the field then points the creator at the full /analyze page instead of
 * fabricating a crowd (the account-read thin-fallback rule).
 */

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { kcStamp } from "@/lib/kc/kc-stamp";
import { getAudience, GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import { resolveTier } from "@/lib/audience/resolve-tier";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { computeOptimalPostWindow } from "@/lib/engine/optimal-post";
import {
  predictionResultToVideoTestCard,
  type VideoTestSource,
} from "@/lib/tools/video-test-card";
import type { Audience } from "@/lib/audience/audience-types";
import type { HeroBlock, OptimalPostWindow, PersonaSimulationResult, VerbatimPayload } from "@/lib/engine/types";

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  // ── (1) Auth gate — BEFORE any DB read ──────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── (2) CSRF guard — Content-Type 415 + cross-origin 403 ────────────────────
  const guard = csrfGuard(request);
  if (guard) return guard;

  // ── (3) Parse body — the analysisId of the run the field just completed ──────
  let body: { analysisId?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* handled below */
  }
  const analysisId = typeof body.analysisId === "string" ? body.analysisId.trim() : "";
  if (!analysisId) {
    return Response.json({ error: "analysisId is required" }, { status: 400 });
  }

  // ── (4) Load the persisted analysis row — user-scoped (a forged id 404s) ─────
  const { data: row, error: rowErr } = await supabase
    .from("analysis_results")
    .select("*")
    .eq("id", analysisId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();
  if (rowErr || !row) {
    return Response.json({ error: "analysis_not_found" }, { status: 404 });
  }

  // A row still running (placeholder overall_score:null + engine_version:'pending') has no
  // result to card yet — tell the field to keep waiting rather than emit an empty card.
  const overallRaw = (row as { overall_score?: number | string | null }).overall_score;
  const overall = typeof overallRaw === "string" ? Number.parseFloat(overallRaw) : overallRaw;
  if (overall == null || Number.isNaN(overall)) {
    return Response.json({ error: "analysis_not_ready" }, { status: 409 });
  }

  // ── (5) Resolve the active audience (thread pin) → name + tier ──────────────
  // Same per-thread pin the generative skills + the Read use. General on any miss/failure.
  const openThread = await createOpenThreadLazy(user.id);
  let audience: Audience = GENERAL_AUDIENCE;
  const rawThread = openThread as typeof openThread & { active_audience_id?: string | null };
  const activeAudienceId = rawThread.active_audience_id ?? null;
  if (activeAudienceId) {
    try {
      const loaded = await getAudience(supabase, activeAudienceId);
      if (loaded) audience = loaded;
    } catch {
      // Non-fatal — fall back to General (no regression).
    }
  }

  // ── (6) Assemble the narrow VideoTestSource from the row ────────────────────
  // hero + apollo live in the variants JSONB bag (analyze route persists them there); the
  // rest are first-class columns. optimal_post_window is backfilled from niche when the row
  // persisted null (mirrors /api/analysis/[id]) so the "best window" line isn't lost on reload.
  const variants = (row as { variants?: { hero?: HeroBlock | null; apollo?: VideoTestSource["apollo_reasoning"] } | null }).variants ?? null;
  let optimal_post_window =
    (row as { optimal_post_window?: OptimalPostWindow | null }).optimal_post_window ?? null;
  if (!optimal_post_window) {
    try {
      const service = createServiceClient();
      const { data: profile } = await service
        .from("creator_profiles")
        .select("niche_primary")
        .eq("user_id", user.id)
        .maybeSingle();
      optimal_post_window = await computeOptimalPostWindow(service, profile?.niche_primary ?? null, null);
    } catch {
      optimal_post_window = null; // non-fatal — the card drops the window line
    }
  }

  const source: VideoTestSource = {
    overall_score: overall,
    anti_virality_gated: (row as { anti_virality_gated?: boolean | null }).anti_virality_gated ?? false,
    persona_simulation_results:
      ((row as { personas?: PersonaSimulationResult[] | null }).personas ?? []) as PersonaSimulationResult[],
    hero: variants?.hero ?? null,
    apollo_reasoning: variants?.apollo ?? null,
    optimal_post_window,
    verbatim: (row as { verbatim?: VerbatimPayload | null }).verbatim ?? null,
  };

  // ── (7) Map → the honest card. No per-persona reactions → degrade to the link-out. ──
  const block = predictionResultToVideoTestCard(source, {
    analysisId,
    audienceName: audience.name,
    tier: resolveTier(audience),
  });
  if (!block) {
    // No honest audience reaction to show — the field points at the full /analyze page.
    return Response.json({ degraded: "no_audience_reaction", analysisId });
  }

  // ── (8) Persist the block to the open thread (re-validated + KC-stamped) ─────
  try {
    await insertMessage(openThread.id, "assistant", [block], kcStamp().kcGenVersion);
    return Response.json({ block });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to persist test card" },
      { status: 500 },
    );
  }
}
