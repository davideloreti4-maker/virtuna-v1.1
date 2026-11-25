/**
 * GET /api/edit/references/[id] → 200 {status, stage, progress} · {status: "ready", style, judged} · {status: "failed", error}
 * POST /api/edit/references/[id] → 202 {id}
 * DELETE /api/edit/references/[id] → 204
 *
 * A reference of the creator's (part 3, Task 11): one of their takes whose analysis was asked as a reference's (its job's input
 * `{reference: true}`), or a take carrying the mark of an upload signed for as one, in whatever state (`referencesAmong`); any
 * other id is no reference (404), so a creator's own take is never read, written, started or dropped here.
 *
 * GET, as it stands:
 * - while it is uploaded or analysed: `{status: "analysing", stage, progress}`, `stage` in a creator's words (`stageOf`) and
 *   `progress` the worker's, 0 to 1;
 * - once its analysis is done: the sheet the worker made of it read from R2 and judged, and its style made (`readReference`),
 *   then it is dropped (`dropReference`: its files in R2, then its take row with its job rows) and the answer is
 *   `{status: "ready", style, judged}`; `judged` false when the sheet is missing or Qwen's judgement of it failed, the style
 *   then the measures' alone. One read at a time (`claimRead`): a poll while another reads it answers `reading its look`. Two reads at most: a
 *   first that fails gives its claim back and keeps the reference, and answers `reading its look` (logged), so the next poll
 *   reads it again at once; a second that fails, or dies, drops it and answers `{status: "failed", error}`;
 * - a failed analysis (a video over three minutes, say, in the worker's own words): dropped too, `{status: "failed", error}`;
 * - after the drop: 404.
 *
 * DELETE: the page stopped a read (another row picked, Start over, reads that failed, the page left): the reference is dropped
 * now, whatever state it is in (X96), rather than at the next sweep. Only a reference, as the GET asks it; any other id is 404 and
 * nothing is deleted.
 *
 * POST: the browser has put an uploaded reference into R2 (`POST /api/edit/references` with a file). As
 * `/api/edit/takes/[id]/uploaded`: a HEAD checks it arrived whole, the take moves from uploading to analysing, and its analysis
 * is started, here as a reference's.
 *
 * 401/403 as every edit route · 404 for an id that is none of the creator's references · POST and DELETE: 403 for a call from
 * another origin · POST: 415
 * for a body that is not JSON or a call from another origin · 409 for a take not waiting for its upload, an upload not there
 * whole, or while another analysis of theirs is live (A1) · 502 when the worker cannot start the job (the reference is then
 * dropped).
 */
import { NextResponse } from "next/server";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { createServiceClient } from "@/lib/supabase/service";
import { askQwen } from "@/lib/edit/agent/model";
import { READING_ITS_LOOK, UNREAD, claimRead, dropReference, readReference, referencesAmong, releaseRead, stageOf } from "@/lib/edit/style/reference";
import { isId, latestJob, type JobRow } from "@/lib/edit/worker/jobs";
import type { TakeRow } from "@/lib/edit/worker/takes";
import { creator, log, refuse, route, type Creator } from "../../creator";
import { finishUpload } from "../../upload";

export const dynamic = "force-dynamic";
/** The read waits on R2 for the sheet (up to 15 s), two judgements (up to 30 s each) and the drop. */
export const maxDuration = 300;

/**
 * One of the creator's references, read through their session, and its latest job as it stands (none yet for an upload not yet
 * started); null when the id is none (`referencesAmong`). Its job is read, and a stale one written failed (X41), only once it is
 * known to be a reference's: a creator's own take is never written here.
 */
async function referenceOf(who: Creator, id: string): Promise<{ take: TakeRow; job: JobRow | null } | null> {
  if (!isId(id)) return null;
  const { data: take, error } = await who.session.from("edit_takes").select("*").eq("id", id).eq("user_id", who.user).maybeSingle();
  if (error) throw new Error(`the reference could not be read: ${error.message}`);
  if (!take || !(await referencesAmong(who.session, who.user, [take])).has(take.id)) return null;
  return { take, job: await latestJob(who.session, createServiceClient(), who.user, take.id) };
}

export const GET = route("GET /api/edit/references/[id]", async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const found = await referenceOf(who, (await context.params).id);
  if (!found) return refuse(404, "no such reference");
  const { take, job } = found;
  const service = createServiceClient();

  if (!job) return NextResponse.json({ status: "analysing", stage: stageOf(null), progress: 0 }); // an upload not yet started
  if (job.status === "failed" || take.status === "failed") {
    await dropReference(service, who.user, take.id);
    return NextResponse.json({ status: "failed", error: job.error ?? take.error ?? "its analysis failed" });
  }
  if (job.status !== "done" || take.status !== "ready") return NextResponse.json({ status: "analysing", stage: stageOf(job), progress: job.progress });
  const claim = await claimRead(service, who.user, job);
  if (claim === "busy") return NextResponse.json({ status: "analysing", stage: READING_ITS_LOOK, progress: 1 });
  if (claim === "spent") return unread(service, who.user, take.id, "its second read did not end");

  const started = performance.now();
  let reading: Awaited<ReturnType<typeof readReference>>;
  try {
    reading = await readReference(who.user, take, askQwen);
  } catch (error) {
    // A first read that failed gives its claim back and keeps the reference, and the poll is told it is still reading, so the
    // next one reads it again at once; a second is the last: the reference is dropped and the read failed. Each is logged.
    if (claim.read === 1) {
      log.error("a reference's first read failed; the next poll reads it again", { reference: take.id, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
      await releaseRead(service, who.user, job);
      return NextResponse.json({ status: "analysing", stage: READING_ITS_LOOK, progress: 1 });
    }
    return unread(service, who.user, take.id, error instanceof Error ? error.message : String(error));
  }
  // Dropped only once the style is made (X96): nothing of the reference is kept past its read.
  const dropping = performance.now();
  await dropReference(service, who.user, take.id);
  const { style, judged, judgement, sheet, unsheeted, seconds } = reading;
  log.info("a reference was read", {
    reference: take.id, read: claim.read, seconds: { ...seconds, drop: since(dropping), all: since(started) }, judged, judgement, sheet, unsheeted, notMatched: style.notMatched.length,
  });
  return NextResponse.json({ status: "ready", style, judged });
});

const since = (from: number) => Math.round(performance.now() - from) / 1000;

/** Both reads failed: the reference is dropped and the read answered failed, in a creator's words; why goes to the log. */
async function unread(service: ReturnType<typeof createServiceClient>, user: string, id: string, why: string): Promise<Response> {
  log.error("a reference could not be read twice; it is dropped", { reference: id, error: why });
  await dropReference(service, user, id);
  return NextResponse.json({ status: "failed", error: UNREAD });
}

/** The upload is in: its analysis started as a reference's (`finishUpload`, as a take's upload is finished). */
export const POST = route("POST /api/edit/references/[id]", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const { id } = await context.params;
  const { data: take, error } = isId(id) ? await who.session.from("edit_takes").select("*").eq("id", id).eq("user_id", who.user).maybeSingle() : { data: null, error: null };
  if (error) throw new Error(`the reference could not be read: ${error.message}`);
  // Only an upload signed for as a reference's: a creator's own take is never started as one.
  if (!take || !(await referencesAmong(who.session, who.user, [take])).has(take.id)) return refuse(404, "no such reference");

  const job = await finishUpload(who, take, { input: { reference: true }, noun: "reference" });
  if (job instanceof Response) return job;
  if (job.status !== "failed") return NextResponse.json({ id: take.id }, { status: 202 });
  await dropReference(createServiceClient(), who.user, take.id); // nothing will read it: none of it is kept
  return refuse(502, job.error ?? "the worker could not start the job");
});

export const DELETE = route("DELETE /api/edit/references/[id]", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request); // a DELETE has no body: only its origin is held
  if (guard) return guard;
  const { id } = await context.params;
  const { data: take, error } = isId(id) ? await who.session.from("edit_takes").select("id,analysis").eq("id", id).eq("user_id", who.user).maybeSingle() : { data: null, error: null };
  if (error) throw new Error(`the reference could not be read: ${error.message}`);
  if (!take || !(await referencesAmong(who.session, who.user, [take])).has(take.id)) return refuse(404, "no such reference");
  await dropReference(createServiceClient(), who.user, take.id);
  log.info("a reference was dropped when its read was stopped", { reference: take.id });
  return new Response(null, { status: 204 });
});
