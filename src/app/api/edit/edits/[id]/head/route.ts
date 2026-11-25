/**
 * POST /api/edit/edits/[id]/head {n} → 200 EditView
 *
 * Undo and Redo (spec §6; plan 2026-11-24-editor-screens-a, Task 7): the head moves to turn `n`, which must be the end of a run
 * (`canMoveTo`, R9: a turn that holds an edit with the answers that changed nothing after it), wherever the head rests now.
 * The edit's look follows, in the same write, to that of the cut it lands on (R18). Nothing is dropped: a new turn made from
 * there drops what comes after. Before the first cut there is nowhere to move, a turn left over from a first cut that stopped
 * half way included (R21).
 *
 * The head is moved on the edit's row as it was read, as a turn is written (R19): a move made on an edit written since then
 * (a turn made, the head moved, an export started) is refused, so no look is written for a line that is no longer there.
 *
 * 401/403 · 415/403 · 400 for a body that is not `{n}`, or a turn that is not the end of a run · 404 for an edit that is not
 * theirs · 409 while its export runs, with no cut yet, or when the edit changed meanwhile.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { createServiceClient } from "@/lib/supabase/service";
import { MOST_TURNS, canMoveTo, lookAt } from "@/lib/edit/turns";
import { SAID } from "../../../agent-calls";
import { creator, refuse, route } from "../../../creator";
import { EDIT_SAID, exportLive, ownEdit, turnsOf, viewOf } from "../../store";

const Body = z.strictObject({ n: z.number().int().min(1).max(MOST_TURNS) });

export const POST = route("POST /api/edit/edits/[id]/head", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const body = Body.safeParse(await request.json().catch(() => undefined));
  if (!body.success) return refuse(400, SAID.unread);
  const edit = await ownEdit(who, (await context.params).id);
  if (edit instanceof Response) return edit;
  const service = createServiceClient();
  if (await exportLive(who, service, edit)) return refuse(409, EDIT_SAID.exporting);
  if (edit.head === null) return refuse(409, EDIT_SAID.noCut);
  const turns = await turnsOf(service, edit.id);
  if (!canMoveTo(turns, body.data.n)) return refuse(400, EDIT_SAID.noVersion);
  const { data, error } = await service
    .from("edits")
    .update({ head: body.data.n, look: lookAt(turns, body.data.n) })
    .eq("id", edit.id)
    .eq("user_id", who.user)
    .eq("head", edit.head)
    .lte("updated_at", edit.updated_at)
    .select();
  if (error) throw new Error(`the edit's head could not be moved: ${error.message}`);
  const moved = data[0];
  return moved ? NextResponse.json(await viewOf(who, moved, service)) : refuse(409, EDIT_SAID.changed);
});
