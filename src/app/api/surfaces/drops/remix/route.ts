/**
 * POST /api/surfaces/drops/remix { contentId } — Remix a drop (v8 Phase 2).
 *
 * Seeds a REAL persisted thread from the CACHED drop: a user turn + the card's
 * 3 ranked adapt concepts as remix-card blocks (provenance "projected"). ZERO
 * model calls — the adapt output was computed by the daily warm; the sim stays
 * fire-on-demand (v8 rule: the angles arrive unscored; the shelf meter was the
 * only pre-score). The composer's normal open-thread rehydration renders it.
 *
 * contentId is looked up ONLY inside the caller's own cached batch for the
 * server-resolved audience (CR-01 — no cross-user reads possible by construction).
 * A stale/absent cache → 404 drop_not_found (the shelf re-warms tomorrow's cards).
 *
 * ⚠️ 404 unless CONCEPT_V8_ENABLED (flag-off byte-identical, incl. no new routes).
 */

import { createClient } from "@/lib/supabase/server";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { CONCEPT_V8_ENABLED } from "@/lib/flags/concept-v8";
import { resolveUserAudience } from "@/lib/audience/resolve-user-audience";
import { audienceKeyOf, getFreshSurfaceCards } from "@/lib/surfaces/surface-reactions-repo";
import type { LiveDropCard } from "@/lib/surfaces/live-cards";
import { dropCardToRemixBlocks, dropUserTurnText } from "@/lib/surfaces/drop-seed";
import { createNewThread, setThreadTitleIfEmpty } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";

export const runtime = "nodejs";

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

  const guard = csrfGuard(request);
  if (guard) return guard;

  let contentId: unknown;
  try {
    ({ contentId } = (await request.json()) as { contentId?: unknown });
  } catch {
    // falls through to the 400 below
  }
  if (typeof contentId !== "string" || !contentId) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const audience = await resolveUserAudience(supabase, user.id);
    const cached = await getFreshSurfaceCards<LiveDropCard>(
      supabase,
      user.id,
      audienceKeyOf(audience),
      "drop",
    );
    const card = cached?.find((c) => c.contentId === contentId);
    if (!card) {
      return Response.json({ error: "drop_not_found" }, { status: 404 });
    }

    const audienceName = audience && !audience.is_general ? audience.name : null;
    const blocks = dropCardToRemixBlocks(card, audienceName);
    if (blocks.length === 0) {
      return Response.json({ error: "seed_failed" }, { status: 502 });
    }

    // A REAL thread: sidebar row, rehydration, later Script/Simulate turns all work
    // because these are ordinary persisted messages (insertMessage re-validates, D-14).
    const thread = await createNewThread(user.id);
    await insertMessage(thread.id, "user", [
      { type: "markdown", props: { text: dropUserTurnText(card) } },
    ]);
    await insertMessage(thread.id, "assistant", blocks);
    await setThreadTitleIfEmpty(user.id, thread.id, card.hook);

    return Response.json({ threadId: thread.id });
  } catch {
    return Response.json({ error: "seed_failed" }, { status: 502 });
  }
}
