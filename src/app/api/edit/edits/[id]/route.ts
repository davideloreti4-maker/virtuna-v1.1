/**
 * GET /api/edit/edits/[id] → 200 EditView
 *
 * The edit as the page and its card read it (spec §7; plan 2026-11-24-editor-screens-a, Task 6): its take as it stands (an
 * analysis that stopped fails it, written so), the turns' words up to the head, the edit shown, where Undo and Redo go, and the
 * export of the turn shown; every address signed afresh. 401/403 as every edit route · 404 for an edit that is not theirs.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { creator, route } from "../../creator";
import { ownEdit, viewOf } from "../store";

export const dynamic = "force-dynamic";

export const GET = route("GET /api/edit/edits/[id]", async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const edit = await ownEdit(who, (await context.params).id);
  if (edit instanceof Response) return edit;
  return NextResponse.json(await viewOf(who, edit, createServiceClient()));
});
