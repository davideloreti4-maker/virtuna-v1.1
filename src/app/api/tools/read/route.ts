/**
 * /api/tools/read — the concept Read route (Plan 08-06, W4 / D-08/D-09; re-scoped by P3).
 *
 * POST — authenticate, resolve the SELECTED audience (thread pin, General when nothing
 *        is pinned), run runTwoAudienceRead against ONE concept, and persist the
 *        resulting `multi-audience-read` block to the user's open thread.
 *
 * P3 (owner-confirmed): the default Read scores ONLY the selected audience. The old
 * default dragged GENERAL_AUDIENCE in as a forced second side — a full extra Flash
 * pass, billed, on every Read of a pinned audience. A compare is now EXPLICIT only.
 *
 * Two resolution paths share the SAME runner + persistence:
 *   - DEFAULT (P3): the single audience from thread.active_audience_id; NULL = General.
 *     An ORPHANED pin (the row was deleted / the account disconnected) falls back to
 *     General and SAYS SO — the block carries `fallback: "audience-removed"`, which the
 *     renderer shows as one quiet line. Never a silent swap (the shadow-audience lesson).
 *     A transient load ERROR keeps the old silent General fallback (D-04) — it must not
 *     claim "removed" about an audience that still exists.
 *   - EXPLICIT PAIR (AUD-EDIT-02 / D-05): an OPTIONAL `audienceIds: [string, string]`
 *     body field selects an ARBITRARY pair of saved audiences. Each id is resolved via
 *     getAudience under the session (RLS-scoped); a bad id is rejected 400 (audience_not_found)
 *     — NO silent General fallback for an explicit pick. (The legacy `secondAudienceId`
 *     body field is GONE — it had zero callers and duplicated this path.)
 *
 * Security spine (mirrors the ideas route — T-03-07 … T-03-12):
 *   - Auth enforced BEFORE any DB read or Flash run (T-03-07)
 *   - Default-path audience id read from the THREAD (active_audience_id), never the
 *     body (T-03-08 / CR-01). Explicit-pair ids are still resolved via getAudience under the
 *     session (RLS-scoped) — never trusted as raw weights.
 *   - Server-side concept length cap (WARNING-5)
 *   - insertMessage re-validates the block at the write boundary (T-03-11)
 *   - KC_GEN_VERSION stamp on the persisted message (T-03-12)
 *
 * Cap (D-09): at most 2 audiences for v1 legibility. runTwoAudienceRead enforces the cap.
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
import { billUsage, creditGate } from "@/lib/billing/credit-gate";
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

  // ── Credit gate (BILLING) — priced admission BEFORE any engine spend ─────────
  const { refusal, verdict: creditVerdict } = await creditGate(supabase, user.id, "read");
  if (refusal) return refusal;

  // ── (2) Parse + validate body ────────────────────────────────────────────────
  // Body carries the concept text + an OPTIONAL explicit audience pair. The default
  // audience id is NEVER read from the body — it comes from the thread
  // (T-03-08 / CR-01). Explicit ids are still resolved under the session via
  // getAudience (RLS-scoped), never trusted as raw weights.
  let body: { concept?: unknown; audienceIds?: unknown } = {};
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

  // ── (4) Resolve WHAT gets read ─────────────────────────────────────────────────
  // Two paths share the SAME runner + persistence below:
  //   • Explicit-pair path (AUD-EDIT-02): exactly 2 arbitrary audienceIds, each
  //     resolved under the session. A bad id is rejected 400 — NO silent General
  //     fallback for an explicitly-requested pick (that would hide a bad pair).
  //   • Default path (P3): the SINGLE audience from thread.active_audience_id;
  //     NULL = General. No forced second side.
  let pick: Audience[];
  // Orphaned-pin marker (P3): the thread points at an audience whose row is GONE
  // (deleted / account disconnected). The Read falls back to General and the block
  // says so — never a silent swap.
  let audienceRemoved = false;

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
    pick = [firstAudience, secondPick];
  } else {
    // ── Default path (P3) — the selected audience, ALONE ─────────────────────────
    // thread.active_audience_id: NULL = General default. Non-null = load the row
    // (virtual ids short-circuit). getAudience distinguishes the two failure shapes:
    //   • null  = the row is GONE (deleted audience / disconnected account) — the
    //     orphaned pin. Fall back to General AND mark it, so the block says
    //     "Audience removed · scoring against General." out loud.
    //   • throw = a real DB error. The audience may still exist, so claiming
    //     "removed" would be false — keep the old silent General fallback (D-04).
    let activeAudience: Audience = GENERAL_AUDIENCE;
    const rawThread = openThread as typeof openThread & { active_audience_id?: string | null };
    const activeAudienceId = rawThread.active_audience_id ?? null;
    if (activeAudienceId) {
      try {
        const loaded = await getAudience(supabase, activeAudienceId);
        if (loaded) activeAudience = loaded;
        else audienceRemoved = true;
      } catch {
        // Non-fatal: fall back to General (no regression, D-04). NOT marked as
        // removed — a transient error is not a deletion.
      }
    }

    pick = [activeAudience];
  }

  // ── (6) Run the Read + persist the block ──────────────────────────────────────
  // Default path → ONE audience → a single-audience Read (P3). Explicit pair → the
  // compare. The runner still dedupes by identity (CR-02), so an explicit [a, a]
  // reads single rather than as a degenerate self-compare.
  try {
    const run = await runTwoAudienceRead(concept, pick);

    // Orphaned-pin honesty (P3): the fact is route-level (only the route sees the
    // thread pin), so it is attached here — the renderer turns it into one quiet
    // line. Typed by the block schema; insertMessage re-validates it below.
    const block = audienceRemoved
      ? { ...run, props: { ...run.props, fallback: "audience-removed" as const } }
      : run;

    // insertMessage re-validates the block at the write boundary (T-03-11) + stamps
    // KC_GEN_VERSION provenance (T-03-12).
    await insertMessage(openThread.id, "assistant", [block], kcStamp().kcGenVersion);

    
    // BILL — on delivery only: the block is persisted; nothing after can un-deliver it.
    await billUsage({ userId: user.id, action: "read", tier: creditVerdict.tier });
    return Response.json({ block });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Read failed" },
      { status: 500 },
    );
  }
}
