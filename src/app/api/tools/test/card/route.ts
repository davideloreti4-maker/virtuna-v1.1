/**
 * /api/tools/test/card — the /test in-thread CRAFT-teardown adapter (TEST-01).
 *
 * The heavy work already happened: the in-thread Test field ran the FULL /api/analyze Max
 * video pipeline (untouched) on the creator's real video, which billed + persisted a scored
 * analysis_results row. This route is the CHEAP adapter that turns that persisted row into
 * the one honest thread card — a frame-by-frame read of how well-MADE the video is ("the
 * editor's cut") — and drops it in the open thread. No navigate-out (owner: "all skills 1:1
 * in thread"); the only door out of the card is "Simulate it →".
 *
 * It does NO engine work: it reads a row the caller already owns (RLS), maps the CRAFT slice
 * (Apollo craft dims → the score + drivers; heatmap segments → the filmstrip; counterfactual
 * fixes → the director's notes), re-signs the persisted keyframes, and — best-effort — grounds
 * the top 1–2 fixes in a real corpus outlier. Reception (retention curve, the crowd, reach,
 * who-stops) is NOT read here — it belongs to the separate Simulation surface.
 *
 * Security spine (mirrors the read route):
 *   - Auth BEFORE any DB read.
 *   - CSRF guard (Content-Type 415 + cross-origin 403).
 *   - The row is loaded user-scoped (.eq user_id) — a forged/cross-user analysisId 404s.
 *   - Keyframe re-signing runs AFTER that ownership gate (signAnalysisFrames uses the service
 *     client on an already-scoped id).
 *   - insertMessage re-validates the block at the write boundary + stamps KC_GEN_VERSION.
 *
 * Degrade honesty: a row with NO craft material (Apollo down AND no filmstrip AND no fixes) has
 * nothing to teach, so the mapper returns null and this route responds { degraded: "no_craft" }
 * with the analysisId — the field then points the creator at the full /analyze page.
 */

import { createClient } from "@/lib/supabase/server";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { kcStamp } from "@/lib/kc/kc-stamp";
import { getAudience, GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import { resolveTier } from "@/lib/audience/resolve-tier";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { signAnalysisFrames } from "@/lib/engine/filmstrip/storage";
import { executeCorpusSearch } from "@/lib/grounding/corpus-tool";
import { retrieveCachedExamples } from "@/lib/grounding/retrieve";
import { buildProofFromSource } from "@/lib/tools/runners/build-proof";
import {
  predictionResultToVideoTestCard,
  deriveFixGroundingQueries,
  type VideoTestSource,
} from "@/lib/tools/video-test-card";
import type { Audience } from "@/lib/audience/audience-types";
import type {
  ApolloDimension,
  ApolloRewrite,
  CounterfactualResult,
  HeatmapPayload,
  VerbatimPayload,
} from "@/lib/engine/types";

/** Ground at most the top N fixes — cheap cache retrieval, but bounded so the card stays snappy. */
const MAX_GROUNDED_FIXES = 2;

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

  // ── (6) Assemble the narrow CRAFT VideoTestSource from the row ──────────────
  // apollo lives in the variants JSONB bag (the analyze route persists variants.apollo — the FULL
  // Apollo object, incl. dimensions); heatmap / counterfactuals / verbatim are first-class columns.
  const variants =
    (row as { variants?: { apollo?: { dimensions?: ApolloDimension[]; rewrites?: ApolloRewrite[] } | null } | null })
      .variants ?? null;
  const source: VideoTestSource = {
    apollo_reasoning: variants?.apollo
      ? { dimensions: variants.apollo.dimensions ?? null, rewrites: variants.apollo.rewrites ?? null }
      : null,
    heatmap: (row as { heatmap?: HeatmapPayload | null }).heatmap ?? null,
    counterfactuals: (row as { counterfactuals?: CounterfactualResult | null }).counterfactuals ?? null,
    verbatim: (row as { verbatim?: VerbatimPayload | null }).verbatim ?? null,
  };

  // ── (7) Re-sign the persisted keyframes (their frames, ephemeral). Ownership gated at (4). ──
  const frames = await signAnalysisFrames(analysisId);

  // ── (8) Map → the craft card. No craft material at all → degrade to the link-out. ──
  const block = predictionResultToVideoTestCard(source, {
    analysisId,
    audienceName: audience.name,
    tier: resolveTier(audience),
    frames,
  });
  if (!block) {
    return Response.json({ degraded: "no_craft", analysisId });
  }

  // ── (9) Ground the top 1–2 fixes in a real corpus outlier (best-effort). ─────
  // Structural retrieval keyed off each fix (deriveFixGroundingQueries), citable-subset only, via
  // the shared build-proof mapper — so a curated row is never dressed as a proven outlier. Any
  // failure leaves the fix honestly bare (proof:null); the card already renders without it.
  try {
    const queries = deriveFixGroundingQueries(source);
    for (let i = 0; i < Math.min(MAX_GROUNDED_FIXES, block.props.fixes.length); i++) {
      const q = queries[i];
      if (!q) continue;
      try {
        const { citable } = await executeCorpusSearch(
          { query: q.query, axis: q.axis },
          "tiktok",
          i + 1,
          retrieveCachedExamples,
        );
        const proof = buildProofFromSource(1, citable);
        if (proof) block.props.fixes[i]!.proof = proof;
      } catch {
        /* one fix failing to ground never fails the card */
      }
    }
  } catch {
    /* grounding is additive — never blocks the card */
  }

  // ── (10) Persist the block to the open thread (re-validated + KC-stamped) ────
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
