/**
 * POST /api/edit/edits/[id]/change {request, at?} → 200 EditView
 *
 * The agent's change on the edit shown (spec §7; plan 2026-11-24-editor-screens-a, Task 7), as `POST /api/edit/agent` makes one
 * (`changeEdit`), written as a new turn after the head: `change` with the edit it made, or `said` (no edit) when it changed
 * nothing. Either way the head moves to it (R9). Its sentence is the agent's, shown as it is. `at`, the film frame of the edit
 * shown the video was paused on, goes to the agent as the request's moment (slice B, E15) and is stored on the turn. The
 * findings put away on the turn shown stay put away on the new turn while it still finds them (`carryKept`, slice B, Task 8),
 * read again once the agent has answered, so a keep made meanwhile is carried too (`keptNow`).
 * A turn made meanwhile wins and this one is refused (409).
 *
 * Checked in the order of the agent's route (R16): the gate, the call's origin, the body, then one agent call of a creator's at
 * a time (`holdAgent`, X92), and only then the edit, its export and its take, and, once the edit shown is read, `at` against
 * its length. The edit's row is read once and handed to `commitTurn` as it was read (R19); the look of the cut the new head
 * sits on is written with the head (R18).
 *
 * 401/403 · 415/403 · 400 for a body that is not `{request, at?}`, a request blank or over 500 characters, an `at` past the end
 * of the edit shown · 404 for an edit that is not theirs · 409 while an agent call of theirs is live, while its export runs,
 * with no cut yet, for a take not ready, when the edit changed meanwhile or holds 300 turns · 422 for an edit whose files are
 * not the take as measured.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_FRAMES, filmFrames } from "@/lib/edit";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { createServiceClient } from "@/lib/supabase/service";
import { carryKept } from "@/lib/edit/kept";
import { lookAt, nextTurn, shownTurn } from "@/lib/edit/turns";
import { MOST, SAID, changeEdit, readyTakes } from "../../../agent-calls";
import { creator, holdAgent, log, refuse, route } from "../../../creator";
import { EDIT_SAID, commitTurn, docOf, exportLive, keptNow, ownEdit, turnsOf, viewOf } from "../../store";

/** A change stops at 50 s (X89). */
export const maxDuration = 60;

const Body = z.strictObject({ request: z.string(), at: z.number().int().min(0).max(MAX_FRAMES).nullable().optional() });

export const POST = route("POST /api/edit/edits/[id]/change", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const begun = Date.now();
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const body = Body.safeParse(await request.json().catch(() => undefined));
  if (!body.success) return refuse(400, SAID.unread);
  const asked = body.data.request.trim();
  if (asked === "") return refuse(400, SAID.blank);
  if (asked.length > MOST.request) return refuse(400, SAID.long);

  const release = holdAgent(who.user);
  if (!release) return refuse(409, SAID.busy);
  try {
    const edit = await ownEdit(who, (await context.params).id);
    if (edit instanceof Response) return edit;
    const service = createServiceClient();
    if (await exportLive(who, service, edit)) return refuse(409, EDIT_SAID.exporting);
    const turns = await turnsOf(service, edit.id);
    const shown = shownTurn(turns, edit.head);
    if (shown === null) return refuse(409, EDIT_SAID.noCut);
    if (!nextTurn(turns, edit.head).ok) return refuse(409, EDIT_SAID.full);
    const takes = await readyTakes(who, [edit.take_id]);
    if (takes instanceof Response) return takes;
    const doc = await docOf(service, edit.id, shown);
    // The frame the video was paused on is a frame of the edit shown, or the request is about a moment that is not there.
    const at = body.data.at ?? null;
    if (at !== null && at >= filmFrames(doc)) return refuse(400, EDIT_SAID.moment);

    const result = await changeEdit(who, takes, doc, asked, begun, at);
    if (result instanceof Response) return result;
    const kept = carryKept(await keptNow(service, edit.id, shown), result.findings);
    const written = await commitTurn(
      service, edit, turns,
      {
        kind: result.changed ? "change" : "said", request: asked, at, say: result.say, findings: result.findings,
        kept, doc: result.changed ? result.edit : null,
      },
      { look: lookAt(turns, edit.head) },
    );
    if (written === "full") return refuse(409, EDIT_SAID.full);
    if (written === "conflict") return refuse(409, EDIT_SAID.changed);
    log.info("an edit's change", { rounds: result.rounds.length, changed: result.changed, cost: result.cost, ms: Date.now() - begun });
    return NextResponse.json(await viewOf(who, written, service));
  } finally {
    release();
  }
});
