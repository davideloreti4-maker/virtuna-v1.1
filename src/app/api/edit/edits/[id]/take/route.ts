/**
 * POST /api/edit/edits/[id]/take {take} → 200 EditView
 *
 * Another take for an edit with no cut yet (spec §5.1 "upload stopped" and "take failed"; plan 2026-11-24-editor-screens-a,
 * Task 6): the page signs for a new take and uploads it, then puts it here. Its title is the new file's name. The take it
 * replaces stays; clearing old takes is piece 4's.
 *
 * 401/403 · 415/403 · 400 for a body that is not `{take}` · 404 for an edit or a take that is not theirs, or a reference ·
 * 409 once the edit has a cut.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { createServiceClient } from "@/lib/supabase/service";
import { takeTitle } from "@/lib/edit/said";
import { referencesAmong } from "@/lib/edit/style/reference";
import { creator, ownTake, refuse, route } from "../../../creator";
import { EDIT_SAID, ownEdit, turnsOf, viewOf } from "../../store";

const Body = z.strictObject({ take: z.string().max(64) });

export const POST = route("POST /api/edit/edits/[id]/take", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const body = Body.safeParse(await request.json().catch(() => undefined));
  if (!body.success) return refuse(400, "the body is {take}");
  const edit = await ownEdit(who, (await context.params).id);
  if (edit instanceof Response) return edit;
  const service = createServiceClient();
  if (edit.head !== null || (await turnsOf(service, edit.id)).length > 0) return refuse(409, EDIT_SAID.hasCut);
  const take = await ownTake(who, body.data.take);
  if (take instanceof Response) return take;
  if ((await referencesAmong(who.session, who.user, [take])).has(take.id)) return refuse(404, "no such take");
  const { data, error } = await service
    .from("edits")
    .update({ take_id: take.id, title: takeTitle(take.name, null) })
    .eq("id", edit.id)
    .eq("user_id", who.user)
    .is("head", null)
    .select();
  if (error) throw new Error(`the edit's take could not be written: ${error.message}`);
  const moved = data[0];
  return moved ? NextResponse.json(await viewOf(who, moved, service)) : refuse(409, EDIT_SAID.hasCut);
});
