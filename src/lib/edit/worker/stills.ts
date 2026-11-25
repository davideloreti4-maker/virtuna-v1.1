/**
 * stills.ts — frames of an edit drawn by the worker, for the agent to look at (part 3, Task 6, X84): its own web address's
 * `POST /stills`, with the shared secret and the workspace's proxy token as `/start` is called (X41, X81). The worker signs the
 * edit's files as it signs a render's (each one of the creator's takes, X63), draws the frames with the film's own renderer,
 * and gives them back as JPEGs: each of half the stage (540x960), or with a sheet, up to 12 on one JPEG, four across, each a
 * quarter of the stage, in the order asked (the style read, Task 9). The worker refuses a frame past the film's end.
 *
 * Server only: it reads the worker's address, secret and proxy token from the environment, and gives none out. A failure
 * throws one plain line: the worker's own, or what became of the call; never the address.
 */
import "server-only";
import { z } from "zod";
import type { Edit } from "@/lib/edit";
import { createLogger } from "@/lib/logger";
import { workerSettings } from "./jobs";

const log = createLogger({ module: "edit.stills" });
/**
 * How long a call may take. The worker gives up first, at 60 s, and says so in its own line; this waits 75 s to hear it; the web
 * address outlasts both, at 90 s (worker/app.py, `STILLS_S`). Task 6 measured a cold call of three stills at 22.9 s and a cold
 * sheet of 12 at 35.3 s on a 12.7 s take. The agent's loop passes a shorter deadline of its own, as a signal (`Stopping`).
 */
export const STILLS_TIMEOUT_MS = 75_000;

/** One frame of the film, as a JPEG in base64. */
export interface Still {
  frame: number;
  jpeg: string;
}

/** A caller's own way to stop the call before `STILLS_TIMEOUT_MS`: the agent's loop passes what is left of its deadline. */
export interface Stopping {
  signal?: AbortSignal;
}

const StillsAnswer = z.object({ stills: z.array(z.object({ frame: z.number().int(), jpeg: z.string().min(1) })) });
const SheetAnswer = z.object({ sheet: z.string().min(1) });
const Failure = z.object({ error: z.string().min(1) });

/**
 * The worker's answer to a call that went well; throws the line to tell otherwise. The call stops at `STILLS_TIMEOUT_MS`, or
 * when the caller's signal is aborted, whichever comes first; each is told in its own line.
 */
async function asked(body: { user: string; edit: Edit; frames: number[]; sheet?: true }, { signal }: Stopping): Promise<unknown> {
  const worker = workerSettings();
  // A timer of our own rather than `AbortSignal.timeout`, so the line can tell our timeout from the caller's.
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(new DOMException(`no stills in ${STILLS_TIMEOUT_MS} ms`, "TimeoutError")), STILLS_TIMEOUT_MS);
  let response: Response;
  let text: string;
  try {
    response = await fetch(`${worker.url}/stills`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${worker.secret}`,
        "Modal-Key": worker.proxy.key,
        "Modal-Secret": worker.proxy.secret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([timeout.signal, signal]) : timeout.signal,
    });
    text = await response.text();
  } catch (error) {
    if (signal?.aborted) throw new Error("the stills were stopped before the worker answered");
    if (timeout.signal.aborted || (error instanceof Error && error.name === "TimeoutError")) throw new Error(`the worker gave no stills in ${STILLS_TIMEOUT_MS / 1000} s`);
    // What the call threw may hold the worker's address: the log has it, the caller does not (as jobs.ts, 143).
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined;
    log.error("the worker could not be reached", { error: error instanceof Error ? error.message : String(error), cause });
    throw new Error("the worker could not be reached");
  } finally {
    clearTimeout(timer);
  }
  let answer: unknown = null;
  try {
    answer = JSON.parse(text);
  } catch {
    // Modal's proxy answers in words of its own, and a gateway in HTML: no line of the worker's.
  }
  if (!response.ok) {
    const failure = Failure.safeParse(answer);
    throw new Error(failure.success ? failure.data.error : `the worker answered ${response.status}`);
  }
  return answer;
}

/**
 * The frames of `edit` as the worker draws them, in the order asked (at most 6). `user` is the creator whose takes the edit's files
 * must be (X63): the signed-in session's user, never one taken from the request. `signal` stops the call sooner (`Stopping`).
 */
export async function stillsOf(user: string, edit: Edit, frames: number[], stopping: Stopping = {}): Promise<Still[]> {
  const answer = StillsAnswer.safeParse(await asked({ user, edit, frames }, stopping));
  if (!answer.success || answer.data.stills.length !== frames.length || answer.data.stills.some((still, i) => still.frame !== frames[i])) {
    throw new Error("the worker's answer is not the stills asked");
  }
  return answer.data.stills;
}

/**
 * The frames of `edit` on one JPEG in base64 (at most 12): four across, in the order asked. `user` is the creator whose takes the
 * edit's files must be (X63): the signed-in session's user, never one taken from the request. `signal` stops the call sooner
 * (`Stopping`).
 */
export async function sheetOf(user: string, edit: Edit, frames: number[], stopping: Stopping = {}): Promise<string> {
  const answer = SheetAnswer.safeParse(await asked({ user, edit, frames, sheet: true }, stopping));
  if (!answer.success) throw new Error("the worker's answer is not the sheet asked");
  return answer.data.sheet;
}
