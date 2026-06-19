/**
 * /api/tools/read — the multi-audience Read route (Plan 08-06, W4 / D-08/D-09).
 *
 * POST — authenticate, resolve the default pair (active calibrated audience vs General),
 *        run runTwoAudienceRead against ONE concept, and persist the resulting
 *        `multi-audience-read` block to the user's open thread.
 *
 * The killer feature: score one concept against TWO audiences side by side, defaulting
 * to active-vs-General (which doubles as proof calibration MOVES the verdict). The DELTA
 * is the one-line Read + Lever — the foresight payoff.
 *
 * Security spine (mirrors the ideas route — T-03-07 … T-03-12):
 *   - Auth enforced BEFORE any DB read or Flash run (T-03-07)
 *   - Audience id read from the THREAD (active_audience_id), never from the body (T-03-08 / CR-01).
 *     The body carries the concept text + an OPTIONAL explicit second audience id; that id is
 *     still resolved via getAudience under the session (RLS-scoped) — never trusted as raw weights.
 *   - Server-side concept length cap (WARNING-5)
 *   - insertMessage re-validates the block at the write boundary (T-03-11)
 *   - KC_GEN_VERSION stamp on the persisted message (T-03-12)
 *
 * Cap (D-09): exactly 2 audiences for v1 legibility. runTwoAudienceRead enforces the cap;
 *   the route resolves at most a default pair + one explicit second pick.
 *
 * Honesty spine (Pitfall 5 / D-11): the emitted block is bands-only (no numeric score).
 */

import { createClient } from "@/lib/supabase/server";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { runTwoAudienceRead } from "@/lib/engine/flash/two-audience-read";
import { kcStamp } from "@/lib/kc/kc-stamp";
import { getAudience, GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import { csrfGuard } from "@/lib/http/csrf-guard";
import type { Audience } from "@/lib/audience/audience-types";

const MAX_CONCEPT_LENGTH = 2000; // chars — WARNING-5: enforced server-side

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  // ── (1) Auth gate (T-03-07) — BEFORE any DB read or Flash run ────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── (1b) CSRF guard — Content-Type 415 + cross-origin 403 (WR-01) ────────────
  const guard = csrfGuard(request);
  if (guard) return guard;

  // ── (2) Parse + validate body ────────────────────────────────────────────────
  // Body carries the concept text + an OPTIONAL explicit second audience id.
  // The PRIMARY (active) audience id is NEVER read from the body — it comes from the
  // thread (T-03-08 / CR-01). The optional second id is still resolved under the
  // session via getAudience (RLS-scoped), never trusted as raw weights.
  let body: { concept?: unknown; secondAudienceId?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Malformed body → concept defaults to empty (handled below).
  }

  const concept = typeof body.concept === "string" ? body.concept : "";
  if (concept.trim().length === 0) {
    return Response.json({ error: "concept is required" }, { status: 400 });
  }
  if (concept.length > MAX_CONCEPT_LENGTH) {
    return Response.json(
      { error: `concept must be at most ${MAX_CONCEPT_LENGTH} characters` },
      { status: 400 },
    );
  }
  const secondAudienceId =
    typeof body.secondAudienceId === "string" ? body.secondAudienceId : null;

  // ── (3) Get/create open thread ───────────────────────────────────────────────
  const openThread = await createOpenThreadLazy(user.id);

  // ── (4) Resolve the PRIMARY audience from the THREAD, never the body (CR-01) ──
  // thread.active_audience_id: NULL = General default. Non-null = load the row
  // (virtual ids short-circuit). Falls back to General on any load failure (no block).
  let activeAudience: Audience = GENERAL_AUDIENCE;
  const rawThread = openThread as typeof openThread & { active_audience_id?: string | null };
  const activeAudienceId = rawThread.active_audience_id ?? null;
  if (activeAudienceId) {
    try {
      const loaded = await getAudience(supabase, activeAudienceId);
      if (loaded) activeAudience = loaded;
    } catch {
      // Non-fatal: fall back to General (no regression, D-04).
    }
  }

  // ── (5) Resolve the SECOND audience (default = General) — D-09 default pair ───
  // The default pair is active-vs-General. An explicit secondAudienceId is honored
  // ONLY when it resolves under the session (RLS-scoped via getAudience). The cap of
  // 2 is enforced downstream by runTwoAudienceRead.
  let secondAudience: Audience = GENERAL_AUDIENCE;
  if (secondAudienceId && secondAudienceId !== activeAudienceId) {
    try {
      const loaded = await getAudience(supabase, secondAudienceId);
      if (loaded) secondAudience = loaded;
    } catch {
      // Non-fatal: keep General as the comparison pair.
    }
  }

  // ── (6) Run the 2-audience Read + persist the block ──────────────────────────
  // CR-02: the runner dedupes by audience IDENTITY. In the common default (no
  // calibrated audience pinned, no explicit second pick) both resolve to General,
  // and the runner collapses that self-pair to a SINGLE-audience Read instead of a
  // degenerate "General vs General" compare.
  try {
    const block = await runTwoAudienceRead(concept, [activeAudience, secondAudience]);

    // insertMessage re-validates the block at the write boundary (T-03-11) + stamps
    // KC_GEN_VERSION provenance (T-03-12).
    await insertMessage(openThread.id, "assistant", [block], kcStamp().kcGenVersion);

    return Response.json({ block });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Read failed" },
      { status: 500 },
    );
  }
}
