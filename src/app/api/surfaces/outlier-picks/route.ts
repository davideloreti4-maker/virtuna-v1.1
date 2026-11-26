/**
 * GET /api/surfaces/outlier-picks — today's six videos for Home's remix carousel, from the curated
 * collection (`outlier_teardowns`). No model call and no write: one read of the shared table, the
 * same six for every creator (see `src/lib/surfaces/outlier-picks.ts`).
 *
 * New look only (the carousel is new-look Home's): 404 otherwise, so the legacy look gains no route.
 */

import { createClient } from "@/lib/supabase/server";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { getCorpusClient, type SharedMatchRow } from "@/lib/grounding/corpus";
import { utcDayIndex } from "@/lib/surfaces/drop-select";
import { PICK_COLUMNS, dailyOutlierPicks } from "@/lib/surfaces/outlier-picks";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  if (!NEW_LOOK_ENABLED) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The rows the corpus reads serve (`match_shared_teardowns`: extracted or watched), TikTok only —
  // the one platform Remix can fetch.
  const { data, error } = await getCorpusClient()
    .from("outlier_teardowns")
    .select(PICK_COLUMNS)
    .eq("platform", "tiktok")
    .in("status", ["extracted", "watched"]);
  if (error) {
    console.error("[outlier-picks] corpus read failed:", error.message);
    return Response.json({ error: "picks_failed" }, { status: 502 });
  }

  // No vector query here, so no similarity: the structural order falls through to the multiplier.
  const rows = (data ?? []).map((row) => ({ ...(row as object), similarity: 0 }) as SharedMatchRow);
  return Response.json(
    { picks: dailyOutlierPicks(rows, utcDayIndex()) },
    // The same six all day for everyone: a browser may keep them for an hour.
    { headers: { "Cache-Control": "private, max-age=3600" } },
  );
}
