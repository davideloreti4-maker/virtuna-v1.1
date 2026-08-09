/**
 * POST /api/surfaces/lanes — the day-0 lane reveal (v8 Phase 5, spec §4.2).
 *
 * The creator's 20-minute answer → 2-3 candidate lanes (synthesizeLanes) → one proven
 * format adapted into each and pre-scored (buildLaneDrops). Fires ONLY on an explicit
 * submit — never on navigation (fire-on-demand law, SSOT §1).
 *
 * Gate order is the spend contract: flag → auth → CSRF → body. A blank answer never
 * reaches a model, and a failed synthesis never reaches the adapt/Flash calls.
 *
 * ⚠️ 404 unless CONCEPT_V8_ENABLED: flag-off must stay byte-identical INCLUDING no new
 * spend surface (drop economics = owner call #3 — this route must not be reachable in
 * an environment that hasn't opted into v8).
 */

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { CONCEPT_V8_ENABLED } from "@/lib/flags/concept-v8";
import { synthesizeLanes } from "@/lib/engine/lanes/synthesize-lanes";
import { buildLaneDrops } from "@/lib/surfaces/lane-drops";

export const runtime = "nodejs";
// One synthesis call + <= 3 adapt calls (90s cap each, parallel) + one batched Flash.
export const maxDuration = 300;

const BodySchema = z.object({ answer: z.string().trim().min(1).max(500) });

export async function POST(request: Request): Promise<Response> {
  if (!CONCEPT_V8_ENABLED) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const supabase = await createClient();

  // Auth gate (CR-01) — before any DB read and before any billable call.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // CSRF guard — Content-Type 415 + cross-origin 403 (mirrors the surfaces routes).
  const guard = csrfGuard(request);
  if (guard) return guard;

  let answer: string;
  try {
    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "invalid_body" }, { status: 400 });
    }
    answer = parsed.data.answer;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const lanes = await synthesizeLanes(answer);
  if (!lanes) {
    // Synthesis failed — do NOT spend adapt/Flash on nothing.
    return Response.json({ error: "lanes_failed" }, { status: 502 });
  }

  try {
    const shelves = await buildLaneDrops(supabase, user.id, lanes);
    return Response.json({ shelves });
  } catch {
    // The corpus read / adapt / sim failed — honest 502; the client offers the describe door.
    return Response.json({ error: "lanes_failed" }, { status: 502 });
  }
}
