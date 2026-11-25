/**
 * POST /api/edit/edits/[id]/cut {style?} → 200 EditView
 *
 * The first cut, or a cut in another look (spec §7, E2, E9; plan 2026-11-24-editor-screens-a, Task 7): the take cut by the agent
 * as `POST /api/edit/agent` cuts it (`cutTake`), in the style asked (none: the house's; `{preset}`; `{words}`; a reference's
 * profile), written as a new turn after the head: its line written by code (`firstCutLine`), its findings, its edit. A cut after
 * changes starts again from the take; Undo brings the changes back. But a caption word fixed by hand is a fact about the take
 * (E9, changed by R31): the line's hand-made fixes up to the head are carried into the new cut through the door, each by the
 * take's own word (`carriedFixes`), before it is reviewed and stored; one that no longer finds its word is dropped, silently.
 * The findings put away are not carried: a cut starts again from the take, with none put away (ruling S2; slice B, Task 8).
 * The first cut names the edit and its chat from the take's first words; so does a first cut made again after one that stopped
 * half way (no head yet, its turn left over: that turn gives way as any turn after the head does, R21).
 *
 * Checked in the order of the agent's route (R16): the gate, the call's origin, the body and its style, then one agent call of a
 * creator's at a time (`holdAgent`, X92), and only then the edit, its export and its take. The edit's row is read once and
 * handed to `commitTurn` as it was read (R19): the cut's look, style and title are written with the head, by nothing before it.
 *
 * 401/403 · 415/403 · 400 for a body or a style that is none · 404 for an edit that is not theirs, or a take that is a reference ·
 * 409 while an agent call of theirs is live, while its export runs, for a take not ready, when the edit changed meanwhile or holds
 * 300 turns · 502 when no style could be read from the words.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { analysisOf, applyOps, type Edit, type Op } from "@/lib/edit";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { createServiceClient } from "@/lib/supabase/service";
import { review, type Finding } from "@/lib/edit/review";
import { firstCutLine, takeTitle } from "@/lib/edit/said";
import { carriedFixes, fixedWords, handTurns, nextTurn } from "@/lib/edit/turns";
import { bucket } from "@/lib/edit/worker/r2";
import { assetOf, firstEdit, type TakeRow } from "@/lib/edit/worker/takes";
import { setThreadTitleIfEmpty } from "@/lib/threads/threads";
import type { Json } from "@/types/database.types";
import { SAID, cutTake, lookKeyOf, readyTakes, styleOf } from "../../../agent-calls";
import { creator, holdAgent, log, refuse, route } from "../../../creator";
import { EDIT_SAID, commitTurn, docsOf, exportLive, ownEdit, turnsOf, viewOf } from "../../store";

/** A first cut stops at 170 s (X89), its words' style read included. */
export const maxDuration = 180;

const Body = z.strictObject({ style: z.unknown().optional() });

export const POST = route("POST /api/edit/edits/[id]/cut", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const begun = Date.now();
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const body = Body.safeParse(await request.json().catch(() => undefined));
  if (!body.success) return refuse(400, SAID.unread);
  const styled = styleOf(body.data.style);
  if (styled instanceof Response) return styled;

  const release = holdAgent(who.user);
  if (!release) return refuse(409, SAID.busy);
  try {
    const edit = await ownEdit(who, (await context.params).id);
    if (edit instanceof Response) return edit;
    const service = createServiceClient();
    if (await exportLive(who, service, edit)) return refuse(409, EDIT_SAID.exporting);
    const turns = await turnsOf(service, edit.id);
    if (!nextTurn(turns, edit.head).ok) return refuse(409, EDIT_SAID.full);
    const takes = await readyTakes(who, [edit.take_id]);
    if (takes instanceof Response) return takes;
    const take = takes[0]!;
    // The words fixed by hand on the line, read before the cut is asked for: what the new cut carries.
    const hand = handTurns(turns, edit.head);
    const docs = await docsOf(service, edit.id, hand.flatMap(({ n, on }) => [n, on]));
    const fixes = hand.flatMap(({ n, on }) => fixedWords(docs.get(on)!, docs.get(n)!));

    const cut = await cutTake(who, take, styled, begun);
    if (cut instanceof Response) return cut;
    const asset = assetOf(take, bucket());
    const { doc, findings, carried } = carry(cut.result, carriedFixes(cut.result.edit, fixes), take);
    const look = lookKeyOf(body.data.style, styled);
    const title = edit.head === null ? takeTitle(take.name, asset.kind === "video" ? asset.words : null) : undefined;
    const written = await commitTurn(
      service, edit, turns,
      { kind: "cut", request: look, at: null, say: firstCutLine(firstEdit(asset), doc), findings, kept: [], doc },
      { look, style: cut.style as unknown as Json, ...(title === undefined ? {} : { title }) },
    );
    if (written === "full") return refuse(409, EDIT_SAID.full);
    if (written === "conflict") return refuse(409, EDIT_SAID.changed);
    if (title !== undefined && edit.thread_id !== null) await setThreadTitleIfEmpty(who.user, edit.thread_id, title);
    log.info("an edit's cut", { look, rounds: cut.result.rounds.length, carried, cost: cut.cost, ms: Date.now() - begun });
    return NextResponse.json(await viewOf(who, written, service));
  } finally {
    release();
  }
});

/**
 * The cut with the words fixed by hand carried into it (`ops`, from `carriedFixes`): through the door, then reviewed again, so
 * the findings stored are the stored edit's; `carried` counts the words. With none to carry, the cut as the agent made it. The
 * door takes a word's new text on a word that is there; should it refuse all the same, the cut is kept as made and the refusal
 * logged: the creator loses the fixes in this cut, which Undo still holds, and not the cut.
 */
function carry(made: { edit: Edit; findings: Finding[] }, ops: Op[], take: TakeRow): { doc: Edit; findings: Finding[]; carried: number } {
  if (ops.length === 0) return { doc: made.edit, findings: made.findings, carried: 0 };
  const fixed = applyOps(made.edit, ops, [assetOf(take, bucket())]);
  if (!fixed.ok) {
    log.warn("the words fixed by hand could not be carried into a cut", { take: take.id, problems: fixed.problems.map((problem) => problem.message) });
    return { doc: made.edit, findings: made.findings, carried: 0 };
  }
  return { doc: fixed.edit, findings: review(fixed.edit, { [take.id]: analysisOf(take) }), carried: ops.length };
}
