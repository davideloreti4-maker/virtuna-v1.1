/**
 * POST /api/surfaces/drops — the v8 shelf warm (Phase 2).
 *
 * On a cache miss (first /home visit of the day), the client fires this route:
 * it builds today's six drops for the server-resolved audience (buildLiveDrops —
 * ≤6 adapt calls + ONE batched Flash sim), persists to surface_reactions
 * (kind 'drop'), and returns the real cards. No request body (CR-01).
 *
 * ⚠️ 404 unless CONCEPT_V8_ENABLED: flag-off must stay byte-identical INCLUDING
 * no new spend surface (drop economics = owner call #3 — this route must not be
 * reachable in an environment that hasn't opted into v8).
 */

import { createClient } from "@/lib/supabase/server";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { CONCEPT_V8_ENABLED } from "@/lib/flags/concept-v8";
import { buildLiveDrops } from "@/lib/surfaces/drop-reactions";

export const runtime = "nodejs";
// ≤6 adapt calls (90s cap each, parallel) + one batched Flash — mirrors remix's cap.
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  if (!CONCEPT_V8_ENABLED) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const supabase = await createClient();

  // Auth gate (CR-01) — before any DB read.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // CSRF guard — Content-Type 415 + cross-origin 403 (mirrors the surfaces routes).
  const guard = csrfGuard(request);
  if (guard) return guard;

  try {
    const drops = await buildLiveDrops(supabase, user.id);
    return Response.json({ drops });
  } catch {
    // The adapt / sim / corpus read failed — honest 502; the client keeps warming→empty.
    return Response.json({ error: "drops_failed" }, { status: 502 });
  }
}
