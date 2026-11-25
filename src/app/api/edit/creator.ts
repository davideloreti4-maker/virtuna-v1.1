/**
 * creator.ts — what the edit tool's routes share: the signed-in creator, one of their takes, the answer to a
 * job started, a refusal in plain words, and a plain 500 for what no route expects.
 *
 * Every route reads through the creator's session (the tables' policies give a creator their own rows) and
 * writes with the service client, after checking the row is theirs (worker plan, Task 7). Only the creators named
 * in EDIT_CREATORS get through (A1): the tool spends Modal's money, and is open to no one else until part 3's quota.
 */
import { NextResponse } from "next/server";
import { isAuthApiError, isAuthSessionMissingError, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { isId, jobView, type JobRow } from "@/lib/edit/worker/jobs";
import type { TakeRow } from "@/lib/edit/worker/takes";
import type { Database } from "@/types/database.types";

export const log = createLogger({ module: "edit.routes" });

export interface Creator {
  user: string;
  session: SupabaseClient<Database>;
}

export function refuse(status: number, error: string, more: Record<string, unknown> = {}): Response {
  return NextResponse.json({ error, ...more }, { status });
}

/** The creators the edit tool is open to (A1): EDIT_CREATORS, their ids, comma-separated. None when it is unset or empty. */
function openTo(): Set<string> {
  return new Set((process.env.EDIT_CREATORS ?? "").split(",").map((id) => id.trim()).filter(Boolean));
}

/**
 * The signed-in creator, or the answer to give: 401 without a session, with one the sign-in service refused,
 * or for an anonymous visitor of the funnel, who is no creator of films (X74); 503 when the sign-in service
 * could not be asked (429 too: the service is busy, the session may be fine), which says nothing about who is
 * asking; 403 for a creator the edit tool is not open to (A1).
 */
export async function creator(): Promise<Creator | Response> {
  const session = await createClient();
  const { data, error } = await session.auth.getUser();
  if (error && !isAuthSessionMissingError(error) && !(isAuthApiError(error) && error.status < 500 && error.status !== 429)) {
    log.error("the sign-in service could not be asked", { error: error.message, status: error.status });
    return refuse(503, "the sign-in service could not be reached; try again");
  }
  if (!data.user || data.user.is_anonymous) return refuse(401, "sign in to use the edit tool");
  if (!openTo().has(data.user.id)) return refuse(403, "the edit tool is not open to this account yet");
  return { user: data.user.id, session };
}

/** One of the creator's takes, read through their session; the 404 to answer when the id is no take of theirs. */
export async function ownTake(who: Creator, id: string): Promise<TakeRow | Response> {
  if (!isId(id)) return refuse(404, "no such take");
  const { data, error } = await who.session.from("edit_takes").select("*").eq("id", id).eq("user_id", who.user).maybeSingle();
  if (error) throw new Error(`the take could not be read: ${error.message}`);
  return data ?? refuse(404, "no such take");
}

/**
 * How long an agent's hold lasts at most: longer than the longest call (the agent's route stops at 180 s, `maxDuration`), so a
 * call the platform killed before it could let go holds its creator no longer than this.
 */
export const AGENT_HOLD_MS = 200_000;

/** The creators with an agent call running in this server (X92), each with when its hold was taken. */
const agentCalls = new Map<string, { at: number }>();

/**
 * Holds the agent for a creator while a call of theirs runs (X92: one at a time, as a render or an analysis is, A1): the
 * release, to be called however the call ends (more than once is the same as once), or null while a call of theirs is live.
 * A hold older than `AGENT_HOLD_MS` counts as let go; its own release, should it still come, leaves a later hold as it is.
 * Kept in this server's memory only: a second server does not see it.
 */
export function holdAgent(user: string, now = Date.now()): (() => void) | null {
  const live = agentCalls.get(user);
  if (live && now - live.at < AGENT_HOLD_MS) return null;
  const hold = { at: now };
  agentCalls.set(user, hold);
  return () => {
    if (agentCalls.get(user) === hold) agentCalls.delete(user);
  };
}

/** The answer to a job asked for: 202 `{job}`, or 502 `{job, error}` when the worker could not start it and it is failed. */
export function started(job: JobRow): Response {
  const shown = { job: { id: job.id, ...jobView(job) } };
  return job.status === "failed" ? refuse(502, job.error ?? "the worker could not start the job", shown) : NextResponse.json(shown, { status: 202 });
}

/**
 * A route's work, with anything it did not expect answered as a plain 500 and logged with its stack. What the
 * error says (a database's words, a key in the bucket, a setting's name) stays in the log.
 */
export function route<A extends unknown[]>(name: string, work: (...args: A) => Promise<Response>): (...args: A) => Promise<Response> {
  return async (...args) => {
    try {
      return await work(...args);
    } catch (error) {
      log.error(`${name} failed`, { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
      return refuse(500, "something went wrong");
    }
  };
}
