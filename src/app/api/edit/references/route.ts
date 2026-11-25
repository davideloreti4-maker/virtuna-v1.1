/**
 * POST /api/edit/references {url} → 202 {id} · {name, bytes, type} → 202 {id, upload}
 *
 * A reference (part 3, Task 11; spec §12.2, X96, X98): a video whose style a creator's take is to be cut in, read once into a
 * style and dropped. Either way it goes into R2 as a temporary take of the creator's, at `u/<user>/takes/<id>/source`, named
 * `reference.mp4` (or `.mov`), never after who made it or what the creator's file was called (A-I2).
 * - `{url}`: a TikTok link, an outlier from Maven or one the creator pastes. It is fetched as Remix fetches one
 *   (`fetchReference`) and its analysis started in reference mode (the job's input `{reference: true}`). `id` is watched at
 *   `/api/edit/references/<id>`.
 * - `{name, bytes, type}`: a file of the creator's own, signed for as a take is (`POST /api/edit/takes`): its row is written
 *   uploading and `upload` is the signed PUT for the browser. Once the file is in, the browser says so at
 *   `POST /api/edit/references/<id>`, which starts its analysis as a reference.
 *
 * Before anything else, the creator's references left over from before (more than 90 minutes old, in whatever state) are
 * dropped (`dropOldReferences`, which never fails the request). One analysis of a creator's at a time (A1): 409 while one is live, before anything is fetched
 * or signed, and again once a link is fetched, since the fetch takes 15 to 95 s: what was fetched is then dropped.
 * 401/403 as every edit route · 415/403 for a body that is not JSON or a call from another origin · 400 for a body that is
 * neither, or a link that is not TikTok's · 422 for a video that is not there · 502 for one that could not be fetched, or whose
 * analysis the worker could not start (the reference is then dropped).
 */
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { createServiceClient } from "@/lib/supabase/service";
import { FetchRefused, UPLOAD_MARK, dropOldReferences, dropReference, fetchReference, isTikTokLink, referenceName } from "@/lib/edit/style/reference";
import { liveJob, startJob } from "@/lib/edit/worker/jobs";
import { signPut, takeKey } from "@/lib/edit/worker/r2";
import { UploadSchema } from "@/lib/edit/worker/takes";
import { creator, log, refuse, route, type Creator } from "../creator";

/** The fetch waits on Apify (its run up to 180 s), the copy into R2 and the worker's web address (up to 30 s). */
export const maxDuration = 300;

const LinkSchema = z.strictObject({ url: z.string().trim().min(1).max(2048) });

export const POST = route("POST /api/edit/references", async (request: Request) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  await dropOldReferences(who.session, createServiceClient(), who.user);
  const body: unknown = await request.json().catch(() => undefined);
  const link = LinkSchema.safeParse(body);
  if (link.success) {
    if (!isTikTokLink(link.data.url)) return refuse(400, "a reference is a link to a TikTok video, or a file you upload");
    return (await liveJob(who.session, who.user, "analyse")) ? busy() : fromLink(who, link.data.url);
  }
  const file = UploadSchema.safeParse(body);
  if (!file.success) {
    const said = (typeof body === "object" && body !== null && "url" in body ? link : file).error.issues.map((issue) => issue.message).join("; ");
    return refuse(400, `the body is {url} or {name, bytes, type}: ${said}`);
  }
  return (await liveJob(who.session, who.user, "analyse")) ? busy() : fromUpload(who, file.data);
});

/** One analysis of a creator's at a time (A1). */
const busy = () => refuse(409, "an analysis of yours is already running; try again when it ends");

/**
 * A file of the creator's own: signed for as a take is, its row written uploading and marked a reference (`UPLOAD_MARK`, its one
 * mark until its job exists); its analysis starts once it is in.
 */
async function fromUpload(who: Creator, file: z.infer<typeof UploadSchema>): Promise<Response> {
  const id = randomUUID();
  const source = takeKey(who.user, id, "source");
  const upload = await signPut(source, file.bytes, file.type); // signed before the row is written, as a take's
  // Stored as `reference.mp4` or `.mov`, whatever the creator's file was called: no name of theirs or anyone's goes further (A-I2).
  const { error } = await createServiceClient().from("edit_takes").insert({ id, user_id: who.user, name: referenceName(file.type), bytes: file.bytes, source_path: source, analysis: UPLOAD_MARK });
  if (error) throw new Error(`the reference could not be written: ${error.message}`);
  return NextResponse.json({ id, upload }, { status: 202 });
}

/** A TikTok link: fetched into R2, its row written analysing, its analysis started as a reference's; dropped if that fails. */
async function fromLink(who: Creator, url: string): Promise<Response> {
  const id = randomUUID();
  const source = takeKey(who.user, id, "source");
  const started = performance.now();
  let fetched: Awaited<ReturnType<typeof fetchReference>>;
  const service = createServiceClient();
  try {
    fetched = await fetchReference(url, source);
  } catch (error) {
    if (error instanceof FetchRefused) return refuse(error.status, error.message); // refused before anything was put
    await dropReference(service, who.user, id); // a PUT that R2 stored though its answer was lost leaves nothing behind
    throw error;
  }
  try {
    if (await liveJob(who.session, who.user, "analyse")) {
      // Another analysis of theirs started while this was fetched (A1): what was put into R2 goes.
      await dropReference(service, who.user, id);
      return busy();
    }
    // Never named after who made it (A-I2); marked as an upload is, so a request that dies before its job leaves a reference
    // the sweep finds, never a row that reads as the creator's own take (D minor 1). The worker overwrites the mark.
    const { error } = await service.from("edit_takes").insert({ id, user_id: who.user, name: referenceName(), bytes: fetched.bytes, source_path: source, status: "analysing", analysis: UPLOAD_MARK });
    if (error) throw new Error(`the reference could not be written: ${error.message}`);
    const asked = performance.now();
    const job = await startJob(service, { user: who.user, kind: "analyse", takeId: id, input: { reference: true } });
    log.info("a reference was fetched", { reference: id, bytes: fetched.bytes, seconds: { ...fetched.seconds, start: seconds(asked), all: seconds(started) } });
    if (job.status !== "failed") return NextResponse.json({ id }, { status: 202 });
    await dropReference(service, who.user, id); // nothing will read it: none of it is kept
    return refuse(502, job.error ?? "the worker could not start the job");
  } catch (error) {
    await dropReference(service, who.user, id); // the source put into R2, and its row if it was written (a failed re-check too)
    throw error;
  }
}

const seconds = (from: number) => Math.round(performance.now() - from) / 1000;
