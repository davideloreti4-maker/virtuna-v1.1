/**
 * POST /api/surfaces/ideas — the /start daily-ideas refresh (Seams 1/2).
 *
 * On a cache miss (the first /start visit of the day, owner cadence), the client fires this
 * route: it runs the ideas skill for the user (buildLiveIdeas — generate→sim→rank in one call),
 * persists the batch to surface_reactions, and returns the real cards. No request body — the
 * audience is server-resolved (CR-01). Idempotent + safe to retry (upsert on the cache key).
 */

import { createClient } from "@/lib/supabase/server";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { buildLiveIdeas } from "@/lib/surfaces/idea-reactions";

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
    const ideas = await buildLiveIdeas(supabase, user.id);
    return Response.json({ ideas });
  } catch {
    // The generation / sim failed — honest 502; the client keeps its warming→empty state.
    return Response.json({ error: "ideas_failed" }, { status: 502 });
  }
}
