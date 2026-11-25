/**
 * POST /api/edit/edits/[id]/kept {finding} → 200 EditView
 *
 * A finding of the turn shown put away ("Keep it"; spec §7, E18; plan 2026-11-25-editor-screens-b, Task 8): its key
 * (`findingKey`) is added to that turn's `kept`, so it is no longer among the things to check; a change made from there keeps it
 * put away while the review still finds it (`carryKept`), a cut in another look starts again with none (ruling S2).
 *
 * It writes no turn and moves no head, and the edit's row is not written: Undo and Redo stand as they were, and a turn being made
 * meanwhile is not refused for it (R19 reads the row). It asks the agent nothing, so it holds no agent call (`holdAgent`), and it
 * changes no film, so it is not refused while the export runs. A finding already put away writes nothing.
 *
 * Checked in the order of the other edit routes (R16), less what it does not do: the gate, the call's origin, the body, then
 * the edit, its turns and the turn shown, and the finding among that turn's. The turn's `kept` is read with the turns and
 * written whole, so two keeps of the same turn at the same moment, from two tabs, may lose one of them: the page makes one call
 * at a time. A turn dropped meanwhile (a new turn made at an earlier head) is not written to: 409, and the page reads again.
 *
 * 401/403 · 415/403 · 400 for a body that is not `{finding}` with a key of 1 to 120 characters, or a finding the turn shown does
 * not have · 404 for an edit that is not theirs · 409 with no cut yet, or when the turn shown was dropped meanwhile.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { createServiceClient } from "@/lib/supabase/service";
import { findingKey, toCheck } from "@/lib/edit/kept";
import { shownTurn } from "@/lib/edit/turns";
import type { Json } from "@/types/database.types";
import { SAID } from "../../../agent-calls";
import { creator, refuse, route } from "../../../creator";
import { EDIT_SAID, ownEdit, turnsOf, viewOf } from "../../store";

/** A finding's key: its code and the id of the thing it is about. */
const Body = z.strictObject({ finding: z.string().min(1).max(120) });

export const POST = route("POST /api/edit/edits/[id]/kept", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const body = Body.safeParse(await request.json().catch(() => undefined));
  if (!body.success) return refuse(400, SAID.unread);
  const key = body.data.finding;

  const edit = await ownEdit(who, (await context.params).id);
  if (edit instanceof Response) return edit;
  const service = createServiceClient();
  const turns = await turnsOf(service, edit.id);
  const shown = shownTurn(turns, edit.head);
  const turn = turns.find((each) => each.n === shown);
  if (!turn) return refuse(409, EDIT_SAID.noCut);
  // Only what the creator is asked to check may be put away (`toCheck`): never the chin touched (S18).
  if (!toCheck(turn.findings, []).some((finding) => findingKey(finding) === key)) return refuse(400, EDIT_SAID.notToCheck);
  if (turn.kept.includes(key)) return NextResponse.json(await viewOf(who, edit, service));

  const { data, error } = await service
    .from("edit_turns")
    .update({ kept: [...turn.kept, key] as unknown as Json })
    .eq("edit_id", edit.id)
    .eq("n", turn.n)
    .select("n");
  if (error) throw new Error(`the finding could not be put away: ${error.message}`);
  if (data.length === 0) return refuse(409, EDIT_SAID.changed);
  return NextResponse.json(await viewOf(who, edit, service));
});
