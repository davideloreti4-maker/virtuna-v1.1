/**
 * /api/tools/ideas/develop — PINNED chain-anchor endpoint (Plan 04-02, Task 2).
 *
 * POST — "Develop this →" auto-fire seam (D-07): the user selects an idea and this endpoint:
 *   1. Validates auth + caps anchor length server-side (WARNING-5).
 *   2. Fences anchor via assembleBundle ({mode:"hooks", anchor}) for provenance.
 *   3. Loads creator profile by session user_id (for niche grounding — cold-start safe).
 *   4. Gets/creates the user's open thread (createOpenThreadLazy).
 *   5. Runs runHooksPipeline({ ask:"", platform, profileRow, anchor }) — REAL generation (D-07).
 *   6. Persists the ranked hook-card blocks to the SAME open thread (KC_GEN_VERSION stamped).
 *   7. Returns { threadId, messageId, fencedHooksBundle, ideaId } — PINNED CONTRACT.
 *
 * PLACEHOLDER REMOVED (D-07): the P3 markdown placeholder block is GONE. The /develop endpoint
 * now performs real Hooks generation inline. Plan 03's "Develop this →" CTA continues to
 * consume the same pinned response shape — messageId now points to the real hooks message.
 *
 * PINNED ENDPOINT CONTRACT (WARNING-1 — recorded in 03-03-SUMMARY.md + 04-02-SUMMARY.md):
 *   POST /api/tools/ideas/develop
 *   Payload: { ideaId?: string, anchor: string, platform: string }
 *   Response: { threadId: string, messageId: string, fencedHooksBundle: string, ideaId: string | null }
 *   NOTE: messageId now = the hooks message row id (real hook-card blocks, not placeholder).
 *
 * Security mitigations (T-04-03 – T-04-09, same as hooks/route.ts):
 *   - Auth before any DB read (T-04-03)
 *   - user_id from session only, never body (T-04-04/CR-01)
 *   - anchor length cap server-side (T-04-06/WARNING-5)
 *   - assembleBundle injection fence wraps anchor (T-04-05)
 *   - runHooksPipeline gated by band !== "Weak" (HOOKS-02 / T-04-06)
 *   - insertMessage re-validates all blocks at write boundary (T-04-07)
 *   - KC_GEN_VERSION stamp on every persisted message (D-10)
 *   - Qwen-only inside runHooksPipeline (T-04-08)
 */

import { createClient } from "@/lib/supabase/server";
import { maybeMockSkillRun } from "@/lib/tools/mock/mock-sse";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { billUsage, creditGate } from "@/lib/billing/credit-gate";
import { assembleBundle } from "@/lib/kc/assembler";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { runHooksPipeline } from "@/lib/tools/runners/hooks-runner";
import { kcStamp } from "@/lib/kc/kc-stamp";
import type { ProfileRow } from "@/lib/kc/profile-role-map";

// ── Cap constants ─────────────────────────────────────────────────────────────
// anchor is a full idea concept — allow more chars than a chat turn
const MAX_ANCHOR_LENGTH = 5000;

// ── POST /api/tools/ideas/develop ────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  // ── (1) Auth gate (T-04-03) ───────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Layer 2 mock short-circuit (dev only) — skip (no fixture stream yet), no engine call ──
  const mock = await maybeMockSkillRun("develop", user.id);
  if (mock) return mock;

  // ── (1b) CSRF guard — Content-Type 415 + cross-origin 403 (WR-01 / E1) ────
  const guard = csrfGuard(request);
  if (guard) return guard;

  // ── Credit gate (BILLING) — priced admission BEFORE any engine spend ─────────
  const { refusal, verdict: creditVerdict } = await creditGate(supabase, user.id, "develop");
  if (refusal) return refusal;

  // ── (2) Parse + validate body ─────────────────────────────────────────────
  let body: { anchor?: unknown; platform?: unknown; ideaId?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const anchor = typeof body.anchor === "string" ? body.anchor : "";
  const rawPlatform = typeof body.platform === "string" ? body.platform : "tiktok";
  const ideaId = typeof body.ideaId === "string" ? body.ideaId : undefined;

  if (!anchor.trim()) {
    return Response.json({ error: "anchor is required" }, { status: 400 });
  }

  // SERVER-SIDE ANCHOR CAP (WARNING-5): independent of client (T-04-06)
  if (anchor.length > MAX_ANCHOR_LENGTH) {
    return Response.json(
      { error: `anchor must be at most ${MAX_ANCHOR_LENGTH} characters` },
      { status: 400 },
    );
  }

  const platform = (
    ["tiktok", "instagram", "youtube"].includes(rawPlatform) ? rawPlatform : "tiktok"
  ) as "tiktok" | "instagram" | "youtube";

  // ── (3) Fence anchor via assembleBundle for provenance (T-04-05) ──────────
  // Assemble the hooks bundle so the injection fence is applied to the anchor.
  // The fencedHooksBundle is returned in the response for back-compat with Plan 03's
  // CTA shape (even though generation now happens server-side here).
  const fencedHooksBundle = assembleBundle(
    { ask: "Generate hooks for this idea", platform, mode: "hooks", anchor },
    null, // profile is loaded separately below for the pipeline call
  );

  // ── (4) Load creator profile (cold-start safe — D-09) ─────────────────────
  // Load by SESSION user_id (never from request body — T-04-04/CR-01).
  // Cold-start (no profile) is valid; runHooksPipeline degrades gracefully.
  const { data: rawProfileRow } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const profileRow = rawProfileRow as unknown as ProfileRow | null;

  // ── (5) Get/create open thread ────────────────────────────────────────────
  const openThread = await createOpenThreadLazy(user.id);

  // ── (6) Run REAL Hooks generation (D-07: placeholder REMOVED) ────────────
  // anchor is the upstream idea concept; pass it to the runner.
  // ask = "" (anchor-driven mode — the idea is the primary input).
  const { blocks } = await runHooksPipeline({
    ask: "",
    platform,
    profileRow: profileRow ?? null,
    anchor,
  });

  // ── (7) Persist hook-card blocks to the open thread (D-10) ──────────────
  // KC_GEN_VERSION stamp: blocks provenance stamped on this message.
  // insertMessage re-validates blocks at the write boundary (T-04-07/D-14).
  const msgRow = await insertMessage(openThread.id, "assistant", blocks, kcStamp().kcGenVersion);

  // BILL — on delivery only: the cards are persisted; nothing after can un-deliver them.
  await billUsage({ userId: user.id, action: "develop", tier: creditVerdict.tier });

  // ── (8) Return PINNED response shape ──────────────────────────────────────
  // Shape preserved from P3 contract (WARNING-1 — Plan 03's CTA depends on this).
  // messageId now = the real hooks message id (not a placeholder).
  // fencedHooksBundle kept for back-compat (generation happened server-side).
  return Response.json({
    threadId: openThread.id,
    messageId: msgRow.id,
    fencedHooksBundle,
    ideaId: ideaId ?? null,
  });
}
