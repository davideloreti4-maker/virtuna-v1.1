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
 * Since 2026-11-26 the card is built by `addTestCardToThread` (src/lib/tools/test-card.ts), which
 * `/api/analyze` also calls when a run completes: the run remembers the chat it was started in and
 * the SERVER adds the card there. This route is the client's seal after `complete`: with the run's
 * `threadId` it is idempotent (the server's card comes back, no second one); without one it falls
 * back to the open chat, as before.
 *
 * Degrade honesty: a row with NO craft material (Apollo down AND no filmstrip AND no fixes) has
 * nothing to teach, so the mapper returns null and this route responds { degraded: "no_craft" }
 * with the analysisId — the field then points the creator at the full /analyze page.
 */

import { createClient } from "@/lib/supabase/server";
import { createOpenThreadLazy, getOwnedOpenThread } from "@/lib/threads/threads";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { addTestCardToThread } from "@/lib/tools/test-card";

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

  // ── (3) Parse body — the analysisId of the run, and the chat it was started in ──
  let body: { analysisId?: unknown; threadId?: unknown; runNonce?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* handled below */
  }
  const analysisId = typeof body.analysisId === "string" ? body.analysisId.trim() : "";
  if (!analysisId) {
    return Response.json({ error: "analysisId is required" }, { status: 400 });
  }
  const threadId = typeof body.threadId === "string" ? body.threadId.trim() : "";
  // The run's own nonce (made when it was armed, sent with the run too): one card per run.
  const runNonce =
    typeof body.runNonce === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(body.runNonce) ? body.runNonce : null;

  // ── (4) The chat: the run's own (the caller's, or 404), else the open one (as before) ──
  const thread = threadId ? await getOwnedOpenThread(user.id, threadId) : await createOpenThreadLazy(user.id);
  if (!thread) {
    return Response.json({ error: "thread_not_found" }, { status: 404 });
  }

  // ── (5) Build + add the card, at most once per analysis per chat ────────────
  try {
    const res = await addTestCardToThread({ supabase, userId: user.id, analysisId, thread, runNonce });
    switch (res.kind) {
      case "not_found":
        return Response.json({ error: "analysis_not_found" }, { status: 404 });
      case "not_ready":
        return Response.json({ error: "analysis_not_ready" }, { status: 409 });
      case "degraded":
        return Response.json({ degraded: "no_craft", analysisId });
      default:
        return Response.json({ block: res.block });
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to persist test card" },
      { status: 500 },
    );
  }
}
