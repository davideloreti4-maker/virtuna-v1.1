/**
 * /api/tools/predict — the Predict verb route (Phase 6 Plan 06, PRED-01/03).
 *
 * POST — authenticate, CSRF-guard, cap the scenario, resolve the active General analyst
 *        panel via getAudience UNDER THE SESSION (RLS-scoped — never raw weights), reject a
 *        non-General / person-marked audience as a 400 (the honest WR-03 fold — never a 500),
 *        normalize the scenario to a `Stimulus`, run `runPredict`, and persist the resulting
 *        `prediction-gauge` block to the user's OPEN thread — the one-thread wow (PRED-01).
 *
 * Body (application/json): { audienceId, scenario | message }.
 *   - The route does NOT pass subjectKind into runPredict — the resolved audience carries the
 *     persisted `__subject_kind` marker, and runPredict reads it deterministically. The route's
 *     own person-reject uses the SHARED exported `readSubjectKind` BEFORE the run (D-03/D-08).
 *
 * Security spine (mirrors simulate/route.ts — T-06-14…20):
 *   - auth.getUser() 401 BEFORE any DB/LLM (T-06-14)
 *   - csrfGuard 415/403 (T-06-15)
 *   - MAX_MESSAGE_LENGTH cap — 400 on empty/oversize (T-06-16 / DoS)
 *   - audience resolved via getAudience under the session (RLS-scoped); bad id → 400
 *     audience_not_found — NEVER trusted as raw body weights (T-06-17)
 *   - D-08 honesty guards (BEFORE the try): mode !== general → 400 predict_requires_general_panel;
 *     person-marked → 400 predict_requires_panel + nudge — never the runner's throw→500 (T-06-20)
 *   - insertMessage re-validates the block at the write boundary + KC stamp (T-06-19)
 *   - generic 500 "Predict failed" — NEVER echo the raw thrown detail (WR-02 / T-06-19)
 *
 * D-07 isolation: the scenario is the prediction CONTENT (data, never steering) — enforced
 * structurally inside runPredict (the steer rides the analyst-roster repaint, not the scenario;
 * the route concatenates nothing into a prompt).
 */

import { createClient } from "@/lib/supabase/server";
import { maybeMockSkillRun } from "@/lib/tools/mock/mock-sse";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { kcStamp } from "@/lib/kc/kc-stamp";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { billUsage, creditGate } from "@/lib/billing/credit-gate";
import { rateLimitGuard } from "@/lib/http/rate-limit";
import { normalizeStimulus } from "@/lib/engine/stimulus/normalize";
import { getAudience } from "@/lib/audience/audience-repo";
import { runPredict, readSubjectKind } from "@/lib/tools/runners/predict-runner";
import type { Audience } from "@/lib/audience/audience-types";

/** Scenario cap (chars) — enforced server-side (T-06-16 / DoS). */
const MAX_MESSAGE_LENGTH = 2000;

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  // ── (1) Auth gate (T-06-14) — BEFORE any DB read or Flash run ────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Layer 2 mock short-circuit (dev only) — skip (no fixture stream yet), no engine call ──
  const mock = await maybeMockSkillRun("predict", user.id);
  if (mock) return mock;

  // ── (1b) CSRF guard — Content-Type 415 + cross-origin 403 (T-06-15) ──────────
  const guard = csrfGuard(request);
  if (guard) return guard;

  // ── Rate limit (HARDEN-01) — per user, per route; fail-open if unconfigured ──
  const limited = await rateLimitGuard(user.id, "predict");
  if (limited) return limited;

  // ── Credit gate (BILLING) — priced admission BEFORE any engine spend ─────────
  const { refusal, verdict: creditVerdict } = await creditGate(supabase, user.id, "predict");
  if (refusal) return refusal;

  // ── (2) Parse + cap the body (accept `scenario` and/or `message`) ────────────
  let body: { audienceId?: unknown; scenario?: unknown; message?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Malformed body → handled by the validation below.
  }

  const scenario =
    typeof body.scenario === "string"
      ? body.scenario
      : typeof body.message === "string"
        ? body.message
        : "";
  if (scenario.trim().length === 0) {
    return Response.json({ error: "scenario is required" }, { status: 400 });
  }
  if (scenario.length > MAX_MESSAGE_LENGTH) {
    return Response.json(
      { error: `scenario must be at most ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 },
    );
  }

  const audienceId = typeof body.audienceId === "string" ? body.audienceId : "";

  // ── (3) Resolve the audience under the session (RLS-scoped — never raw weights) ──
  // A bad/unresolvable id → 400; we never fall back to a different audience for an
  // explicit pick (CR-01). The resolved row carries the persisted subjectKind marker.
  let audience: Audience | null = null;
  try {
    audience = await getAudience(supabase, audienceId);
  } catch {
    audience = null;
  }
  if (!audience) {
    return Response.json({ error: "audience_not_found" }, { status: 400 });
  }

  // ── (3b) D-08 honesty guards — 400, never the runner's throw→500 (T-06-20) ───
  // Predict needs a General analyst panel. A non-General audience → 400; a person-marked
  // SIM → 400 + a redirect nudge. The marker-absent default `template-analyst` (mode
  // general, custom_context []) reads as "panel" and proceeds (Pitfall 3).
  if (audience.mode !== "general") {
    return Response.json(
      { error: "predict_requires_general_panel" },
      { status: 400 },
    );
  }
  if (readSubjectKind(audience) === "person") {
    return Response.json(
      {
        error: "predict_requires_panel",
        message: "Predict needs a panel — try the Analyst Panel.",
      },
      { status: 400 },
    );
  }

  // ── (4) Normalize → run → persist to the SAME open thread (PRED-01) ──────────
  try {
    const stimulus = await normalizeStimulus({ kind: "text", text: scenario });
    const openThread = await createOpenThreadLazy(user.id);
    const block = await runPredict({ audience, stimulus });
    // insertMessage re-validates the block at the write boundary (T-06-19) + KC stamp.
    await insertMessage(openThread.id, "assistant", [block], kcStamp().kcGenVersion);
    
    // BILL — on delivery only: the block is persisted; nothing after can un-deliver it.
    await billUsage({ userId: user.id, action: "predict", tier: creditVerdict.tier });
    return Response.json({ block });
  } catch (err) {
    // Do not echo the raw thrown detail to the client — it can carry Zod/DB internals
    // (WR-02 info disclosure). Log server-side, return a generic message.
    console.error("[/api/tools/predict] failed:", err);
    return Response.json({ error: "Predict failed" }, { status: 500 });
  }
}
