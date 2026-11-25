/**
 * take-now.ts — a take as it stands (plan 2026-11-24-editor-screens-a, Task 5; moved from `GET /api/edit/takes/[id]`): while it
 * is analysing its latest job decides its state (a failed or stopped one fails it, and so does having none two minutes on), and
 * its row is written so, filtered on the creator and only if it is still as it was read. Gives the state and that job.
 *
 * Server only.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { latestJob, type JobRow } from "@/lib/edit/worker/jobs";
import { takeState, type TakeRow, type TakeState } from "@/lib/edit/worker/takes";
import type { Database } from "@/types/database.types";
import type { Creator } from "./creator";

export async function takeNow(who: Creator, take: TakeRow, service: SupabaseClient<Database> = createServiceClient(), now = Date.now()): Promise<{ state: TakeState; job: JobRow | null }> {
  const latest = take.status === "analysing" ? await latestJob(who.session, service, who.user, take.id, now) : null;
  const state = takeState(take, latest, now);
  if (state.status !== take.status) {
    const { error } = await service
      .from("edit_takes")
      .update({ status: state.status, error: state.error })
      .eq("id", take.id)
      .eq("user_id", who.user)
      .eq("status", take.status)
      .lte("updated_at", take.updated_at); // untouched since it was read
    if (error) throw new Error(`the take could not be written ${state.status}: ${error.message}`);
  }
  return { state, job: latest };
}
