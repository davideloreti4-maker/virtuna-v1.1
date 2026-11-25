/**
 * POST /api/edit/edits/[id]/ops {ops} → 200 EditView
 *
 * What the creator changes by hand (spec E5, §7; plan 2026-11-24-editor-screens-a, Task 7): from a list of two, a word's text
 * (`word.set` with `text`: a word heard wrong, in one place or every place it was heard) and captions on or off (`captions.set`
 * with `on`). No agent, no wait: through the door (`applyOps`), read again by the review, written as a `direct` turn with a
 * sentence written by code (`opsSay`). The findings put away on the turn shown stay put away while the review still finds them
 * (`carryKept`, slice B, Task 8), read again just before the turn is written, so a keep made meanwhile is carried too (`keptNow`).
 *
 * Each of the two is taken with the fields it carries and no other (R13): a word hidden or stressed, a caption setting other
 * than on and off, any other operation is refused before the edit is read. `opsSay` has no words for those and throws for
 * them, so none reaches it. The edit's row is read once and handed to `commitTurn` as it was read (R19); the look of the cut the
 * new head sits on is written with the head (R18).
 *
 * A change that changes nothing writes nothing (R22): when the edit after the door is the edit before it (a word set to the
 * text it has, captions set to the state they are in), the answer is the edit as it stands: no turn, the turns after the head
 * and the export left as they are. The edits are compared, not the operations, so one real change in the list is a turn.
 *
 * 401/403 · 415/403 · 400 for a body that is not `{ops}`, any other change, or one the door refuses (`{error, problems}`) ·
 * 404 for an edit that is not theirs · 409 while its export runs, with no cut yet, for a take not ready, when the edit changed
 * meanwhile or holds 300 turns.
 */
import { isDeepStrictEqual } from "node:util";
import { NextResponse } from "next/server";
import { z } from "zod";
import { OpsSchema, analysisOf, applyOps } from "@/lib/edit";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { createServiceClient } from "@/lib/supabase/service";
import { carryKept } from "@/lib/edit/kept";
import { review } from "@/lib/edit/review";
import { opsSay } from "@/lib/edit/said";
import { lookAt, shownTurn } from "@/lib/edit/turns";
import { bucket } from "@/lib/edit/worker/r2";
import { assetOf } from "@/lib/edit/worker/takes";
import { SAID, isObject, readyTakes } from "../../../agent-calls";
import { creator, refuse, route } from "../../../creator";
import { EDIT_SAID, commitTurn, docOf, exportLive, keptNow, ownEdit, turnsOf, viewOf } from "../../store";

/** The two changes made by hand in this piece (E5), each by the fields it carries: all of them, and no other (R13). */
const DIRECT: ReadonlyMap<string, readonly string[]> = new Map([
  ["word.set", ["op", "asset", "index", "text"]],
  ["captions.set", ["op", "on"]],
]);
/** Whether `op` is one of the two, with its fields and no other. What the fields hold is the door's to judge. */
function isDirect(op: unknown): boolean {
  if (!isObject(op) || typeof op.op !== "string") return false;
  const fields = DIRECT.get(op.op);
  return fields !== undefined && Object.keys(op).length === fields.length && fields.every((field) => Object.hasOwn(op, field));
}
/** At most a word fixed in every place it was heard. */
const Body = z.strictObject({ ops: z.array(z.unknown()).min(1).max(200) });

export const POST = route("POST /api/edit/edits/[id]/ops", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const body = Body.safeParse(await request.json().catch(() => undefined));
  if (!body.success) return refuse(400, SAID.unread);
  if (!body.data.ops.every(isDirect)) return refuse(400, EDIT_SAID.direct);
  const ops = OpsSchema.safeParse(body.data.ops);
  // Said as the door says a list it cannot read: each problem at its place in the list.
  if (!ops.success) return refuse(400, EDIT_SAID.notMade, { problems: ops.error.issues.map((issue) => ({ path: ["ops", ...issue.path].map(String).join("."), id: null, message: issue.message })) });

  const edit = await ownEdit(who, (await context.params).id);
  if (edit instanceof Response) return edit;
  const service = createServiceClient();
  if (await exportLive(who, service, edit)) return refuse(409, EDIT_SAID.exporting);
  const turns = await turnsOf(service, edit.id);
  const shown = shownTurn(turns, edit.head);
  if (shown === null) return refuse(409, EDIT_SAID.noCut);
  const takes = await readyTakes(who, [edit.take_id]);
  if (takes instanceof Response) return takes;
  const take = takes[0]!;
  const doc = await docOf(service, edit.id, shown);

  const made = applyOps(doc, ops.data, [assetOf(take, bucket())]);
  if (!made.ok) return refuse(400, EDIT_SAID.notMade, { problems: made.problems });
  if (isDeepStrictEqual(made.edit, doc)) return NextResponse.json(await viewOf(who, edit, service));
  const findings = review(made.edit, { [take.id]: analysisOf(take) });
  const kept = carryKept(await keptNow(service, edit.id, shown), findings);
  const written = await commitTurn(
    service, edit, turns,
    { kind: "direct", request: null, at: null, say: opsSay(doc, ops.data), findings, kept, doc: made.edit },
    { look: lookAt(turns, edit.head) },
  );
  if (written === "full") return refuse(409, EDIT_SAID.full);
  if (written === "conflict") return refuse(409, EDIT_SAID.changed);
  return NextResponse.json(await viewOf(who, written, service));
});
