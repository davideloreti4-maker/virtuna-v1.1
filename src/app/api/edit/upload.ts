/**
 * upload.ts — the finish of an upload, one for both routes that finish one: a take's (`POST /api/edit/takes/[id]/uploaded`) and a
 * reference's (`POST /api/edit/references/[id]`, its job's input `{reference: true}`, part 3 Task 11). The HEAD that checks the
 * file arrived whole is what makes the size signed into the upload's PUT hold, so it lives in one place.
 *
 * Server only: it reads R2 and asks the worker through their clients.
 */
import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { liveJob, startJob, type JobRow } from "@/lib/edit/worker/jobs";
import { sizeOf } from "@/lib/edit/worker/r2";
import type { TakeRow } from "@/lib/edit/worker/takes";
import type { Json } from "@/types/database.types";
import { log, refuse, type Creator } from "./creator";

/**
 * Finishes the upload of `take`: it must be waiting for its upload, with no analysis of the creator's live (A1), and its file in R2
 * whole, as a HEAD finds it (the size it was signed for); then it is moved from uploading to analysing (only from there, so one
 * upload starts one analysis) and its analysis started on the worker with `input`. Gives the job as written, or the 409 to answer,
 * in words that call it a `noun`. A job that cannot be written puts the take back to uploading, so the creator's retry starts one,
 * and throws; should that fail too, the take reads failed two minutes on, its analysis never started (`takeState`).
 */
export async function finishUpload(who: Creator, take: TakeRow, { input, noun = "take" }: { input?: Json; noun?: string } = {}): Promise<JobRow | Response> {
  if (take.status !== "uploading") return refuse(409, `the ${noun} is ${take.status}: it is not waiting for its upload`);
  if (await liveJob(who.session, who.user, "analyse")) return refuse(409, "an analysis of yours is already running; try again when it ends");

  const stored = await sizeOf(take.source_path);
  if (stored === null) return refuse(409, `${take.name} is not in storage: its upload did not arrive`);
  if (stored !== take.bytes) return refuse(409, `${take.name} did not arrive whole: ${stored} of its ${take.bytes} bytes are stored`);

  const service = createServiceClient();
  const { data: moved, error: unmoved } = await service
    .from("edit_takes")
    .update({ status: "analysing" })
    .eq("id", take.id)
    .eq("user_id", who.user)
    .eq("status", "uploading")
    .select();
  if (unmoved) throw new Error(`the ${noun} could not be written analysing: ${unmoved.message}`);
  if (moved.length === 0) return refuse(409, `the ${noun} is no longer waiting for its upload`);

  try {
    return await startJob(service, { user: who.user, kind: "analyse", takeId: take.id, input });
  } catch (cause) {
    // No job was written: the take waits for its upload again, rather than analysing with nothing to analyse it.
    const { error } = await service.from("edit_takes").update({ status: "uploading" }).eq("id", take.id).eq("user_id", who.user).eq("status", "analysing");
    if (error) log.error(`a ${noun} with no job could not be put back to uploading`, { [noun]: take.id, error: error.message });
    throw cause;
  }
}
