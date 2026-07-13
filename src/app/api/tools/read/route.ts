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
 * Two pair-resolution paths share the SAME runner + persistence:
 *   - DEFAULT (08-06): primary from thread.active_audience_id, optional secondAudienceId
 *     from the body, default second = General (active-vs-General).
 *   - EXPLICIT PAIR (AUD-EDIT-02 / D-05): an OPTIONAL `audienceIds: [string, string]`
 *     body field selects an ARBITRARY pair of saved audiences. Each id is resolved via
 *     getAudience under the session (RLS-scoped); a bad id is rejected 400 (audience_not_found)
 *     — NO silent General fallback for an explicit pick.
 *
 * Security spine (mirrors the ideas route — T-03-07 … T-03-12):
 *   - Auth enforced BEFORE any DB read or Flash run (T-03-07)
 *   - Default-path primary audience id read from the THREAD (active_audience_id), never the
 *     body (T-03-08 / CR-01). Explicit-pair ids are still resolved via getAudience under the
 *     session (RLS-scoped) — never trusted as raw weights.
 *   - Server-side concept length cap (WARNING-5)
 *   - insertMessage re-validates the block at the write boundary (T-03-11)
 *   - KC_GEN_VERSION stamp on the persisted message (T-03-12)
 *
 * Cap (D-09): exactly 2 audiences for v1 legibility. runTwoAudienceRead enforces the cap;
 *   the route resolves a default pair, one explicit second pick, OR an explicit arbitrary pair.
 *
 * Honesty spine (Pitfall 5 / D-11): the emitted block is bands-only (no numeric score).
 */

import { createClient } from "@/lib/supabase/server";
import { maybeMockSkillRun } from "@/lib/tools/mock/mock-sse";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { runTwoAudienceRead } from "@/lib/engine/flash/two-audience-read";
import { kcStamp } from "@/lib/kc/kc-stamp";
import { getAudience, GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { rateLimitGuard } from "@/lib/http/rate-limit";
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

  // ── Layer 2 mock short-circuit (dev only) — skip (no fixture stream yet), no engine call ──
  const mock = await maybeMockSkillRun("read", user.id);
  if (mock) return mock;

  // ── (1b) CSRF guard — Content-Type 415 + cross-origin 403 (WR-01) ────────────
  const guard = csrfGuard(request);
  if (guard) return guard;

  // ── Rate limit (HARDEN-01) — per user, per route; fail-open if unconfigured ──
  const limited = await rateLimitGuard(user.id, "read");
  if (limited) return limited;

  // ── (2) Parse + validate body ────────────────────────────────────────────────
  // Body carries the concept text + an OPTIONAL explicit second audience id.
  // The PRIMARY (active) audience id is NEVER read from the body — it comes from the
  // thread (T-03-08 / CR-01). The optional second id is still resolved under the
  // session via getAudience (RLS-scoped), never trusted as raw weights.
  let body: { concept?: unknown; secondAudienceId?: unknown; audienceIds?: unknown } = {};
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

  // Explicit arbitrary-pair input (NEW, AUD-EDIT-02 / D-05): an OPTIONAL array of
  // string audience ids. When it carries exactly 2 entries, the route compares that
  // ARBITRARY pair (not the thread-derived active-vs-General default). Each id is
  // still resolved via getAudience under the session (RLS-scoped, CR-01/T-03-08) —
  // never trusted as raw weights.
  const audienceIds = Array.isArray(body.audienceIds)
    ? body.audienceIds.filter((x): x is string => typeof x === "string")
    : null;

  // ── (3) Get/create open thread ───────────────────────────────────────────────
  const openThread = await createOpenThreadLazy(user.id);

  // ── (4) Resolve the comparison PAIR ───────────────────────────────────────────
  // Two paths share the SAME runner + persistence below:
  //   • Explicit-pair path (AUD-EDIT-02): exactly 2 arbitrary audienceIds, each
  //     resolved under the session. A bad id is rejected 400 — NO silent General
  //     fallback for an explicitly-requested pick (that would hide a bad pair).
  //   • Default path (UNCHANGED, 08-06): primary from thread.active_audience_id,
  //     optional secondAudienceId from the body, default second = General.
  let pair: [Audience, Audience];

  if (audienceIds && audienceIds.length === 2) {
    // ── Explicit arbitrary-pair path (NEW) ──────────────────────────────────────
    // Resolve BOTH ids under the session (RLS-scoped). The 2-audience cap (D-09)
    // is already enforced downstream by runTwoAudienceRead; same-identity pairs
    // collapse to a single-audience Read there.
    let firstAudience: Audience | null = null;
    let secondPick: Audience | null = null;
    try {
      firstAudience = await getAudience(supabase, audienceIds[0]!);
      secondPick = await getAudience(supabase, audienceIds[1]!);
    } catch {
      // A resolve THROW (not just a missing row) is also a failed pick — reject 400.
      firstAudience = null;
    }
    if (!firstAudience || !secondPick) {
      // An explicitly-requested id did not resolve under the session → reject.
      // Do NOT silently fall back to General for an explicit pair (CR-01).
      return Response.json({ error: "audience_not_found" }, { status: 400 });
    }

    // MODE-01 — a cross-mode pair is not a comparison. A socials audience is asked whether it
    // would stop scrolling; a general audience is asked whether it is convinced. The two answer
    // DIFFERENT QUESTIONS, so a delta between their bands is not a fact about the concept — it's
    // an artifact of the frame. Refuse rather than print a confident "X wins — Y bombs" on it.
    // (Same-mode pairs are fine: panel-vs-panel and crowd-vs-crowd both compare like with like.)
    if (firstAudience.mode !== secondPick.mode) {
      return Response.json(
        {
          error: "audience_mode_mismatch",
          message:
            "These two audiences can't be compared — one is a social audience and the other is a custom one. They're asked different questions, so the result wouldn't mean anything.",
        },
        { status: 400 },
      );
    }
    pair = [firstAudience, secondPick];
  } else {
    // ── Default path (UNCHANGED) — active-vs-General (08-06) ─────────────────────
    // thread.active_audience_id: NULL = General default. Non-null = load the row
    // (virtual ids short-circuit). Falls back to General on any load failure.
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

    // Resolve the SECOND audience (default = General) — D-09 default pair.
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

    pair = [activeAudience, secondAudience];
  }

  // ── (6) Run the 2-audience Read + persist the block ──────────────────────────
  // CR-02: the runner dedupes by audience IDENTITY. In the common default (no
  // calibrated audience pinned, no explicit second pick) both resolve to General,
  // and the runner collapses that self-pair to a SINGLE-audience Read instead of a
  // degenerate "General vs General" compare.
  try {
    const block = await runTwoAudienceRead(concept, pair);

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
