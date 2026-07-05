/**
 * POST /api/surfaces/outliers — the /start outliers refresh (Seams 1/2).
 *
 * On a cache miss (the first /start visit of the day, owner cadence 2026-07-05), the client
 * fires this route: it re-sims the top corpus outliers against the user's resolved audience
 * (buildLiveOutliers — ONE batched Flash call), persists the batch to surface_reactions, and
 * returns the real cards. No request body — the audience is server-resolved (CR-01), never
 * from the client. Idempotent + safe to retry (upsert on the cache key).
 */

import { createClient } from "@/lib/supabase/server";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { buildLiveOutliers } from "@/lib/surfaces/outlier-reactions";

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  // Auth gate (CR-01) — before any DB read.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // CSRF guard — Content-Type 415 + cross-origin 403 (mirrors the react/ideas routes).
  const guard = csrfGuard(request);
  if (guard) return guard;

  try {
    const outliers = await buildLiveOutliers(supabase, user.id);
    return Response.json({ outliers });
  } catch {
    // The sim / feed read failed — honest 502; the client keeps its warming→empty state.
    return Response.json({ error: "outliers_failed" }, { status: 502 });
  }
}
