/**
 * POST /api/edit/takes/[id]/uploaded → 202 {job}
 *
 * The browser has put the take into R2. A HEAD checks it is there, whole (the size it was signed for); then
 * the take is moved from `uploading` to `analysing` (only from there, so one upload starts one analysis) and
 * its analysis is started on the worker (X41). `job` is `{id, status, stage, progress, error}`, to be watched
 * at `/api/edit/jobs/<id>`.
 *
 * 401 without a creator, 403 for one the edit tool is not open to · 415/403 for a body that is not JSON or a call
 * from another origin · 404 for a take that is not theirs, or is a reference · 409 for a take not waiting for its upload, an upload
 * not there whole, or while another analysis of theirs is live (A1: one at a time) · 502 {job, error} when the
 * worker cannot start the job, which is then failed.
 */
import { csrfGuard } from "@/lib/http/csrf-guard";
import { referencesAmong } from "@/lib/edit/style/reference";
import { creator, ownTake, refuse, route, started } from "../../../creator";
import { finishUpload } from "../../../upload";

/** It waits on the worker's web address, 9 to 17 s when that is cold (its own limit is 30 s). */
export const maxDuration = 60;

export const POST = route("POST /api/edit/takes/[id]/uploaded", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const take = await ownTake(who, (await context.params).id);
  if (take instanceof Response) return take;
  // An upload signed for as a reference is finished as one (`POST /api/edit/references/[id]`), never kept as a take (part 3, Task 11).
  if ((await referencesAmong(who.session, who.user, [take])).has(take.id)) return refuse(404, "no such take");
  const job = await finishUpload(who, take); // shared with a reference's upload (`POST /api/edit/references/[id]`)
  return job instanceof Response ? job : started(job);
});
