/**
 * /api/tools/simulate — the Simulate verb route (Phase 5 Plan 05, SIMU-01/02/03).
 *
 * POST — authenticate, CSRF-guard, cap the drafted message, resolve the active General
 *        SIM via getAudience UNDER THE SESSION (RLS-scoped — never raw weights), normalize
 *        the message to a `Stimulus`, run `runSimulate`, and persist the resulting
 *        `reaction-distribution` block to the user's OPEN thread — the SAME thread the
 *        Profile READ was appended to (SIMU-03, the one-thread wow).
 *
 * Body (application/json): { audienceId, message }.
 *   - The route does NOT pass subjectKind — the resolved audience carries the persisted
 *     `custom_context` __subject_kind marker, and runSimulate reads it deterministically.
 *
 * Security spine (mirrors read/route.ts + profile/route.ts — T-05-14…17):
 *   - auth.getUser() 401 BEFORE any DB/LLM (T-05-14 / T-03-07)
 *   - csrfGuard 415/403 (WR-01)
 *   - MAX_MESSAGE_LENGTH cap — 400 on empty/oversize (T-05-16 / DoS)
 *   - audience resolved via getAudience under the session (RLS-scoped); bad id → 400
 *     audience_not_found — NEVER trusted as raw body weights (T-05-14)
 *   - insertMessage re-validates the block at the write boundary + KC stamp (T-03-11/12)
 *
 * D-08 isolation: the message is the reaction CONTENT (data, never steering) — enforced
 * structurally inside runSimulate (the steer rides the audience repaint, not the message).
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
import { resolveTier } from "@/lib/audience/resolve-tier";
import { runSimulate } from "@/lib/tools/runners/simulate-runner";
import type { Audience } from "@/lib/audience/audience-types";

/** Drafted-message cap (chars) — enforced server-side (T-05-16 / DoS). */
const MAX_MESSAGE_LENGTH = 2000;

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  // ── (1) Auth gate (T-05-14) — BEFORE any DB read or Flash run ────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Layer 2 mock short-circuit (dev only) — skip (no fixture stream yet), no engine call ──
  const mock = await maybeMockSkillRun("simulate", user.id);
  if (mock) return mock;

  // ── (1b) CSRF guard — Content-Type 415 + cross-origin 403 (WR-01) ────────────
  const guard = csrfGuard(request);
  if (guard) return guard;

  // ── Rate limit (HARDEN-01) — per user, per route; fail-open if unconfigured ──
  const limited = await rateLimitGuard(user.id, "simulate");
  if (limited) return limited;

  // ── Credit gate (BILLING) — priced admission BEFORE any engine spend ─────────
  const { refusal, verdict: creditVerdict } = await creditGate(supabase, user.id, "simulate");
  if (refusal) return refusal;

  // ── (2) Parse + cap the body ──────────────────────────────────────────────────
  let body: { audienceId?: unknown; message?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Malformed body → handled by the validation below.
  }

  const message = typeof body.message === "string" ? body.message : "";
  if (message.trim().length === 0) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return Response.json(
      { error: `message must be at most ${MAX_MESSAGE_LENGTH} characters` },
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

  // ── (3b) Eligibility (WR-03): Simulate runs ONLY against General (Directional)
  //    audiences. A resolvable-but-ineligible audience is a client error → 400, not a 500.
  //    resolveTier is the SSOT the runner also guards on (kept there as defense-in-depth).
  if (resolveTier(audience) !== "Directional") {
    return Response.json({ error: "audience_not_eligible" }, { status: 400 });
  }

  // ── (4) Normalize → run → persist to the SAME open thread (SIMU-03) ──────────
  try {
    const stimulus = await normalizeStimulus({ kind: "text", text: message });
    const openThread = await createOpenThreadLazy(user.id);
    const block = await runSimulate({ audience, stimulus });
    // insertMessage re-validates the block at the write boundary (T-03-11) + KC stamp.
    await insertMessage(openThread.id, "assistant", [block], kcStamp().kcGenVersion);
    
    // BILL — on delivery only: the block is persisted; nothing after can un-deliver it.
    await billUsage({ userId: user.id, action: "simulate", tier: creditVerdict.tier });
    return Response.json({ block });
  } catch (err) {
    // Do not echo raw err.message to the client — it can carry Zod/DB detail
    // (WR-02 info disclosure). Log server-side, return a generic message.
    console.error("[/api/tools/simulate] failed:", err);
    return Response.json({ error: "Simulate failed" }, { status: 500 });
  }
}
