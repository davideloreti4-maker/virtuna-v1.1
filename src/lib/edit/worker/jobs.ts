/**
 * jobs.ts — the worker's jobs, from the app (X41). A job starts as its row, written with the service client;
 * then the worker is asked to start it at its web address with the shared secret, from the server only. A job
 * is read back through the creator's session, as it stands: one that has stopped is written failed, so the
 * state is stored and not only shown.
 *
 * The worker's address is behind Modal's proxy auth (X81): every call carries the workspace's proxy token
 * (`Modal-Key`, `Modal-Secret`), without which Modal refuses it before any container starts; then the worker
 * checks the shared secret. A creator has one live job of a kind at a time (A1, `liveJob`; the routes ask).
 *
 * Server only: it reads the worker's address, secret and proxy token from the environment, and gives none out.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logger";
import type { Database, Json } from "@/types/database.types";
import { STALE_MS } from "./stale";

export type JobRow = Database["public"]["Tables"]["edit_jobs"]["Row"];
type Db = SupabaseClient<Database>;

const log = createLogger({ module: "edit.jobs" });
/** How long the worker's web address may take to answer: 9 to 15 s when its container is cold (Task 6). */
const START_TIMEOUT_MS = 30_000;

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Whether an id from a request can be a row's: anything else is no row, and is never sent to the database. */
export const isId = (id: string) => ID.test(id);

/** Why a job that had not ended has stopped, by the state it was left in. */
const STOPPED: Partial<Record<string, string>> = { running: "the worker stopped", queued: "the worker did not start the job" };

/** The job as it stands: running, or queued and never claimed, and untouched for two minutes, it has failed. */
export function jobState(job: JobRow, now: number): JobRow {
  const why = STOPPED[job.status];
  if (!why || now - Date.parse(job.updated_at) <= STALE_MS) return job;
  return { ...job, status: "failed", error: why };
}

/** What a creator is shown of a job. */
export function jobView(job: JobRow): Pick<JobRow, "status" | "stage" | "progress" | "error"> {
  return { status: job.status, stage: job.stage, progress: job.progress, error: job.error };
}

export interface WorkerSettings {
  url: string;
  secret: string;
  proxy: { key: string; secret: string };
}

/** A setting the worker cannot be called without; its name, never its value, when it is not set. */
function needed(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/**
 * The worker's address, secret and proxy token. The address is https, but in development (M5): the secret and the
 * proxy token go in its headers. Neither the address nor a value is ever in what this throws. Its stills (stills.ts) use it too.
 */
export function workerSettings(): WorkerSettings {
  const url = needed("EDIT_WORKER_URL");
  const protocol = URL.canParse(url) ? new URL(url).protocol : null; // not an address at all: refused as one that is not https
  if (protocol !== "https:" && !(protocol === "http:" && process.env.NODE_ENV === "development")) throw new Error("EDIT_WORKER_URL is not an https address");
  return {
    url: url.replace(/\/+$/, ""),
    secret: needed("EDIT_WORKER_SECRET"),
    proxy: { key: needed("EDIT_WORKER_PROXY_KEY"), secret: needed("EDIT_WORKER_PROXY_SECRET") },
  };
}

/**
 * Asks the worker to start a queued job (X64). Null when it took it; else why not, in plain words. A call that fails
 * outright says only that the worker could not be reached: what it threw may hold the worker's address, so it goes to
 * the log (143).
 */
async function askToStart(worker: WorkerSettings, job: string): Promise<string | null> {
  try {
    const response = await fetch(`${worker.url}/start`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${worker.secret}`,
        "Modal-Key": worker.proxy.key,
        "Modal-Secret": worker.proxy.secret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ job }),
      signal: AbortSignal.timeout(START_TIMEOUT_MS),
    });
    return response.status === 202 ? null : `it answered ${response.status}`;
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") return `it gave no answer in ${START_TIMEOUT_MS / 1000} s`;
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined;
    log.error("the worker could not be reached", { job, error: error instanceof Error ? error.message : String(error), cause });
    return "it could not be reached";
  }
}

/**
 * Writes a job's row and has the worker start it. When the worker cannot, the job is written failed with why
 * (only while it is still queued: a worker that took it after all keeps it), and that row is given back.
 * Throws when the row cannot be written; the database refuses a job on another creator's take (X70).
 */
export async function startJob(service: Db, ask: { user: string; kind: "analyse" | "render"; takeId?: string; input?: Json }): Promise<JobRow> {
  const worker = workerSettings();
  const { data: job, error } = await service
    .from("edit_jobs")
    .insert({ user_id: ask.user, kind: ask.kind, take_id: ask.takeId ?? null, input: ask.input ?? null })
    .select()
    .single();
  if (error) throw new Error(`the job could not be written: ${error.message}`);
  const why = await askToStart(worker, job.id);
  if (why === null) return job;
  const { data, error: unwritten } = await service
    .from("edit_jobs")
    .update({ status: "failed", error: `the worker could not start the job: ${why}`, finished_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("user_id", ask.user)
    .eq("status", "queued")
    .select();
  if (unwritten) throw new Error(`the job could not be written failed: ${unwritten.message}`);
  return data[0] ?? job; // nothing written: the worker took the job after all, and it is the worker's now
}

/**
 * Writes a job that has stopped failed, only if it is still as it was read and the creator's: a worker that
 * touched it since keeps it. Gives the job as it stands.
 */
async function settle(service: Db, user: string, job: JobRow, now: number): Promise<JobRow> {
  const state = jobState(job, now);
  if (state === job) return job;
  const { data, error } = await service
    .from("edit_jobs")
    .update({ status: "failed", error: state.error, finished_at: new Date(now).toISOString() })
    .eq("id", job.id)
    .eq("user_id", user)
    .eq("status", job.status)
    .lt("updated_at", new Date(now - STALE_MS).toISOString())
    .select();
  if (error) throw new Error(`the job could not be written failed: ${error.message}`);
  return data[0] ?? job;
}

/**
 * Whether the creator has a live job of `kind` (A1): queued or running, and touched in the last two minutes, so not
 * stale under X41 and X75. Read through their session. The routes refuse a second one (409); two asked at the very
 * same moment can both pass this read (known bound: the gate is the allowlist's creators, one at a time).
 */
export async function liveJob(session: Db, user: string, kind: "analyse" | "render", now = Date.now()): Promise<boolean> {
  const { data, error } = await session
    .from("edit_jobs")
    .select("id")
    .eq("user_id", user)
    .eq("kind", kind)
    .in("status", ["queued", "running"])
    .gt("updated_at", new Date(now - STALE_MS).toISOString())
    .limit(1);
  if (error) throw new Error(`the creator's jobs could not be read: ${error.message}`);
  return data.length > 0;
}

/** One of the creator's jobs, read through their session, as it stands; null when it is none of theirs. */
export async function readJob(session: Db, service: Db, user: string, id: string, now = Date.now()): Promise<JobRow | null> {
  if (!isId(id)) return null;
  const { data, error } = await session.from("edit_jobs").select("*").eq("id", id).eq("user_id", user).maybeSingle();
  if (error) throw new Error(`the job could not be read: ${error.message}`);
  return data ? settle(service, user, data, now) : null;
}

/** The latest job of one of the creator's takes, as it stands; null when the take has none. */
export async function latestJob(session: Db, service: Db, user: string, take: string, now = Date.now()): Promise<JobRow | null> {
  const { data, error } = await session
    .from("edit_jobs")
    .select("*")
    .eq("take_id", take)
    .eq("user_id", user)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`the take's jobs could not be read: ${error.message}`);
  return data ? settle(service, user, data, now) : null;
}
