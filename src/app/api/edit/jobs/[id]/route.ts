/**
 * GET /api/edit/jobs/[id] → 200 {status, stage, progress, error, filmUrl?}
 *
 * A job as it stands, read through the creator's session: a running job not touched for two minutes is
 * failed, "the worker stopped", and written so (X41); so is a queued one no worker claimed in that time. A
 * rendered film comes with `filmUrl`, a signed read of two hours that a browser saves as a file, of a path
 * that lies in the creator's films (one that does not is a 500, logged).
 *
 * 401 without a creator · 404 for a job that is not theirs.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { jobView, readJob } from "@/lib/edit/worker/jobs";
import { folderOf, isUnder, signGet } from "@/lib/edit/worker/r2";
import { creator, refuse, route } from "../../creator";

export const dynamic = "force-dynamic";

export const GET = route("GET /api/edit/jobs/[id]", async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const who = await creator();
  if (who instanceof Response) return who;
  const { id } = await context.params;
  const job = await readJob(who.session, createServiceClient(), who.user, id);
  if (!job) return refuse(404, "no such job");
  const film = job.kind === "render" && job.status === "done" ? (job.result as { path?: unknown } | null)?.path : undefined;
  if (typeof film !== "string") return NextResponse.json(jobView(job));
  if (!isUnder(film, folderOf(who.user, "films"))) throw new Error(`job ${job.id}: its film is kept outside the creator's films`);
  return NextResponse.json({ ...jobView(job), filmUrl: await signGet(film, "film.mp4") });
});
