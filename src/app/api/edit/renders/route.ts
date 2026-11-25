/**
 * POST /api/edit/renders {edit} → 202 {job}
 *
 * Renders an edit on the worker. The edit must be one (`EditSchema`) that holds together (`checkEdit`), and
 * every file in it a kit file or a ready take of this creator's, as the worker measured it. The job's input is
 * `{edit, cover}`, `cover` being the film frame of the edit's cover, or null for the first (X63). `job` is
 * `{id, status, stage, progress, error}`, to be watched at `/api/edit/jobs/<id>`.
 *
 * 401 without a creator, 403 for one the edit tool is not open to · 415/403 for a body that is not JSON or a call
 * from another origin · 400 {error, problems} for a body that is no edit, an edit that does not hold together, or
 * a file that is not the creator's to render · 404 {error, problems} for a file that is a reference of theirs (part 3, Task 11:
 * read into a style and dropped, never a take to render) · 409 while another render of theirs is live (A1: one at a time) ·
 * 502 {job, error} when the worker cannot start the job, which is then failed.
 */
import { EditSchema, checkEdit } from "@/lib/edit";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { creator, refuse, route, started } from "../creator";
import { startRender } from "../render";

/** It waits on the worker's web address, 9 to 17 s when that is cold (its own limit is 30 s). */
export const maxDuration = 60;

export const POST = route("POST /api/edit/renders", async (request: Request) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = EditSchema.safeParse(typeof body === "object" && body !== null && "edit" in body ? body.edit : undefined);
  if (!parsed.success) {
    return refuse(400, "this is not an edit", { problems: parsed.error.issues.map((issue) => ({ path: issue.path.map(String).join("."), id: null, message: issue.message })) });
  }
  const edit = parsed.data;
  const problems = checkEdit(edit);
  if (problems.length > 0) return refuse(400, "the edit does not hold together", { problems });

  const job = await startRender(who, edit);
  return job instanceof Response ? job : started(job);
});
