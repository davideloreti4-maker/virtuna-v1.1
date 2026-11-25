/**
 * POST /api/edit/edits/[id]/export → 202 EditView
 * DELETE /api/edit/edits/[id]/export → 200 EditView
 *
 * The export of the edit shown (spec E6, E20, §7; plan 2026-11-24-editor-screens-a, Task 8): its render started on the worker as
 * `POST /api/edit/renders` starts one (`startRender`), and kept on the edit as the export of that turn. The turn exported is the
 * turn shown, never the head, which may rest on an answer that changed nothing (R9). The edit then holds still (no turn, no
 * move: the turns' routes refuse) until the render ends or is given up. An export that has ended stays readable until the next
 * turn forgets it; a move away hides it and a move back to its turn finds it again; a new export takes its place.
 *
 * DELETE gives the export up (R2): its job is written failed from queued or running ("the creator cancelled it"), in one write
 * that takes only a job still at work, and the worker, which claims only a queued job and writes its progress only to a running
 * one, stops at its next step (`worker/store.py`, `Stopped`); the app cannot stop the worker's call itself. The edit then lets
 * go of its export and is answered whole (R20). By how the export's job stands:
 *   - at work: written failed, and the edit lets go of it;
 *   - failed already, by the worker or by an earlier cancel: left as it failed, and the edit lets go of it (a failed export is
 *     put away so);
 *   - done, the file made: nothing is written and the edit keeps it, so the page shows the finished file (R25). The same when
 *     the file is made between the job's read and the write that would fail it: that write then takes nothing, and the job is
 *     read again for how it ended. A done job is never written failed.
 * An edit with no export is answered as it stands, and nothing is written.
 *
 * The edit's row is read once and written as it was read (R19), as `commitTurn` writes a head: an export started, or let go of,
 * on an edit written since then is refused. A render started for an export that is refused so is given up at once, so that no
 * render of the creator's is left at work for an edit that does not hold it; the refusal stands even if that write fails, which
 * is logged. DELETE writes the job before the edit: stopped between the two, the edit shows an export that failed, and can be
 * changed and exported again.
 *
 * Known bounds: a call that stops between the render's start and the edit's write leaves a render at work that no edit holds. It
 * ends by itself, and until then the worker's rule (one live render a creator) refuses their next export. And a file kept
 * (R25) is answered on the edit as it was read, like any read of it.
 *
 * POST: 401/403 · 415/403 · 404 for an edit that is not theirs, or a file that is a reference · 400 for a file not theirs to
 * render · 409 while its export or another render of theirs runs, with no cut yet, or when the edit changed meanwhile ·
 * 502 {job, error} when the worker cannot start it, which keeps no export.
 * DELETE: 401/403 · 403 from another origin · 404 for an edit that is not theirs · 409 when the edit changed meanwhile ·
 * 200 with the export still on the edit when its file was made first.
 */
import { NextResponse } from "next/server";
import { LIVE_JOB } from "@/lib/edit/edit-view";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { createServiceClient } from "@/lib/supabase/service";
import { shownTurn } from "@/lib/edit/turns";
import { readJob } from "@/lib/edit/worker/jobs";
import { creator, log, refuse, route, started } from "../../../creator";
import { startRender } from "../../../render";
import { EDIT_SAID, docOf, exportLive, ownEdit, turnsOf, viewOf, type EditRow } from "../../store";

/** It waits on the worker's web address, 9 to 17 s when that is cold (its own limit is 30 s). */
export const maxDuration = 60;

type Service = ReturnType<typeof createServiceClient>;

/**
 * Writes a render failed, with why, in one write that takes it only while it has not ended, so that the worker gives it up (R2).
 * Whether it was written: false for a render that had ended, which is left as it is.
 */
async function giveUp(service: Service, user: string, job: string, why: string): Promise<boolean> {
  const { data, error } = await service
    .from("edit_jobs")
    .update({ status: "failed", error: why, finished_at: new Date().toISOString() })
    .eq("id", job)
    .eq("user_id", user)
    .in("status", [...LIVE_JOB])
    .select("id");
  if (error) throw new Error(`the export could not be given up: ${error.message}`);
  return data.length > 0;
}

/**
 * Writes the edit's export on its row as it was read (R19): only while its head is where it was and the row has not been
 * written since (`updated_at`, stamped by the table's trigger on every update). Gives the row as written; null when the edit
 * is no longer as it was read, and then nothing is written.
 */
async function writeExport(service: Service, edit: EditRow, exported: { export_job: string | null; export_turn: number | null }): Promise<EditRow | null> {
  const writing = service.from("edits").update(exported).eq("id", edit.id).eq("user_id", edit.user_id).lte("updated_at", edit.updated_at);
  const { data, error } = await (edit.head === null ? writing.is("head", null) : writing.eq("head", edit.head)).select();
  if (error) throw new Error(`the edit's export could not be written: ${error.message}`);
  return data[0] ?? null;
}

export const POST = route("POST /api/edit/edits/[id]/export", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const edit = await ownEdit(who, (await context.params).id);
  if (edit instanceof Response) return edit;
  const service = createServiceClient();
  if (await exportLive(who, service, edit)) return refuse(409, EDIT_SAID.exporting);
  const shown = shownTurn(await turnsOf(service, edit.id), edit.head);
  if (shown === null) return refuse(409, EDIT_SAID.noCut);

  const job = await startRender(who, await docOf(service, edit.id, shown));
  if (job instanceof Response) return job;
  if (job.status === "failed") return started(job);
  const written = await writeExport(service, edit, { export_job: job.id, export_turn: shown });
  if (written === null) {
    // The refusal stands whether or not its render could be given up; one that could not ends by itself.
    await giveUp(service, who.user, job.id, "the edit changed while its export was started").catch((error: unknown) =>
      log.error("the render of a refused export could not be given up", { job: job.id, error: error instanceof Error ? error.message : String(error) }),
    );
    return refuse(409, EDIT_SAID.changed);
  }
  return NextResponse.json(await viewOf(who, written, service), { status: 202 });
});

export const DELETE = route("DELETE /api/edit/edits/[id]/export", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const edit = await ownEdit(who, (await context.params).id);
  if (edit instanceof Response) return edit;
  const service = createServiceClient();
  if (edit.export_job === null) return NextResponse.json(await viewOf(who, edit, service));

  let job = await readJob(who.session, service, who.user, edit.export_job);
  if (job !== null && LIVE_JOB.has(job.status)) {
    const stopped = await giveUp(service, who.user, job.id, "the creator cancelled it");
    // It ended between its read and that write: how, is read again.
    if (!stopped) job = await readJob(who.session, service, who.user, job.id);
  }
  // The file is made: the edit keeps it, and nothing is written (R25).
  if (job?.status === "done") return NextResponse.json(await viewOf(who, edit, service));
  const written = await writeExport(service, edit, { export_job: null, export_turn: null });
  return written ? NextResponse.json(await viewOf(who, written, service)) : refuse(409, EDIT_SAID.changed);
});
