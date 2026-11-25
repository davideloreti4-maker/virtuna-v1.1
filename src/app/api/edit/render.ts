/**
 * render.ts — a render of an edit started on the worker (plan 2026-11-24-editor-screens-a, Task 5; moved from
 * `POST /api/edit/renders`): every file of the edit a kit file or a ready take of this creator's as the worker measured it,
 * no reference among them, no other render of theirs live (A1); then the job, with its cover frame (X63). Gives the job as
 * written (failed when the worker could not start it), or the refusal: 404 {error, problems} for a reference, 400 {error,
 * problems} for a file not theirs to render, 409 while another render of theirs is live.
 *
 * Server only.
 */
import "server-only";
import { coverFrame, type Edit } from "@/lib/edit";
import { createServiceClient } from "@/lib/supabase/service";
import { referencesAmong } from "@/lib/edit/style/reference";
import { isId, liveJob, startJob, type JobRow } from "@/lib/edit/worker/jobs";
import { bucket } from "@/lib/edit/worker/r2";
import { refusedFiles } from "@/lib/edit/worker/takes";
import { refuse, type Creator } from "./creator";

export async function startRender(who: Creator, edit: Edit): Promise<JobRow | Response> {
  // Only an id that can be a row's is asked for; any other is no take of anyone's.
  const ids = edit.assets.filter((asset) => !("kit" in asset.at) && isId(asset.id)).map((asset) => asset.id);
  const { data: takes, error } = ids.length > 0 ? await who.session.from("edit_takes").select("*").in("id", ids).eq("user_id", who.user) : { data: [], error: null };
  if (error) throw new Error(`the edit's takes could not be read: ${error.message}`);
  const references = await referencesAmong(who.session, who.user, takes);
  if (references.size > 0) {
    const problems = edit.assets.flatMap((asset, i) => (references.has(asset.id) ? [{ path: `assets.${i}`, id: asset.id, message: `the file "${asset.id}" is not one of your takes` }] : []));
    return refuse(404, "no such take", { problems });
  }
  const refused = refusedFiles(edit, takes, bucket());
  if (refused.length > 0) return refuse(400, "a file of the edit is not yours to render", { problems: refused });
  if (await liveJob(who.session, who.user, "render")) return refuse(409, "a render of yours is already running; try again when it ends");
  return startJob(createServiceClient(), { user: who.user, kind: "render", input: { edit, cover: coverFrame(edit) } });
}
