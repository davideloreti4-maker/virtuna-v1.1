"use client";

/**
 * net.ts — the editor page's side of its routes (plan 2026-11-24-editor-screens-a, Task 9): a call that always answers, a file
 * put into R2 that tells how far it is, and a route's refusal as one plain sentence. Ported from the dev page's `shared.ts`
 * (`call`, `put`) and `picking.ts` (`sentence`, `problemOf`, `stageLine`), which stay with that page until it goes (E14). Six
 * additions: a call may be a DELETE; an answer that is ok and has no body (a 204) carries no error; the PUT's type is the one
 * the upload was signed for; a PUT the address refused fails as `Refused`, told apart from one that got no answer; a PUT
 * can be stopped while it goes; and a call has a deadline (Task 10's fix round), so one that is never answered ends, with its
 * own sentence, and leaves the page's controls to the creator.
 */

/** How long a call waits for its answer unless it is told otherwise. A route that may take longer is called with its own time. */
export const CALL_MS = 30_000;
/** What is said of a call that was not answered in its time. */
export const NOT_IN_TIME = "The editor did not answer in time.";

/**
 * A call to the app's routes: its status and body. One that fails (the network, a server restarting) is an answer that is not
 * ok. A body that is no JSON is `{error}` naming the status when the answer is not ok, and empty when it is (a 204 has none).
 *
 * One that is not answered within `deadlineMs`, its body read, is given up: its request is aborted, so nothing of it is left
 * running, and it answers as one that never got there (status 0) with `NOT_IN_TIME` for its line.
 */
export async function call<T>(path: string, body?: unknown, method?: "POST" | "DELETE", deadlineMs: number = CALL_MS): Promise<{ ok: boolean; status: number; body: T & { error?: string } }> {
  const given = new AbortController();
  const late = setTimeout(() => given.abort(), deadlineMs);
  try {
    const init: RequestInit =
      body === undefined && method === undefined
        ? { cache: "no-store" }
        : { method: method ?? "POST", headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
    const response = await fetch(path, { ...init, signal: given.signal });
    const unread = (cause: unknown) => {
      if (given.signal.aborted) throw cause; // given up while its body came: not a body that is no JSON
      return response.ok ? {} : { error: `it answered ${response.status}` };
    };
    return { ok: response.ok, status: response.status, body: await response.json().catch(unread) };
  } catch (error) {
    return { ok: false, status: 0, body: { error: given.signal.aborted ? NOT_IN_TIME : String(error) } as T & { error?: string } };
  } finally {
    clearTimeout(late);
  }
}

/**
 * A PUT the signed address answered and refused (a 4xx: its hour has run out, or the file is not the one it was signed for).
 * The same PUT cannot pass on another try, unlike one that got no answer or met storage's own failure (a 5xx).
 */
export class Refused extends Error {}

/**
 * Puts the file into R2 at its signed address as `type` (the one signed into the address), telling how many bytes have gone.
 * It fails as `Refused` when the address refused the file, and as a plain error when the PUT got no answer or storage failed.
 * With a `signal`, the PUT is stopped when the signal says so: the browser's request is aborted, no more bytes go, and it
 * fails as an `AbortError`, which is a PUT stopped on purpose and nothing to show.
 */
export function put(url: string, file: File, onSent: (bytes: number) => void, type: string = file.type, signal?: AbortSignal): Promise<void> {
  return new Promise((done, fail) => {
    const stopped = () => fail(new DOMException("the upload was stopped", "AbortError"));
    if (signal?.aborted) return stopped();
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", type);
    request.upload.onprogress = (event) => onSent(event.loaded);
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) return done();
      const answered = `R2 answered ${request.status} to the upload`;
      fail(request.status < 500 ? new Refused(answered) : new Error(answered));
    };
    request.onerror = () => fail(new Error("the upload did not reach R2"));
    request.onabort = stopped;
    signal?.addEventListener("abort", () => request.abort(), { once: true });
    request.send(file);
  });
}

/** A route's line as a sentence: a capital first, a full stop last. */
export function sentence(text: string): string {
  const trimmed = text.trim();
  if (trimmed === "") return "";
  const capital = trimmed[0]!.toUpperCase() + trimmed.slice(1);
  return /[.!?…]$/.test(capital) ? capital : `${capital}.`;
}

export const UNREACHABLE = "The editor could not be reached. Check your connection.";
export const WENT_WRONG = "Something went wrong.";

/** What to show for a call that was not answered ok: the route's own sentence; else a plain line. Never a code or a stack. */
export function problemOf({ status, body }: { status: number; body: { error?: string } }): string {
  if (status === 0) return body.error === NOT_IN_TIME ? NOT_IN_TIME : UNREACHABLE;
  if (!body.error || /^it answered \d+$/.test(body.error)) return WENT_WRONG;
  return sentence(body.error);
}

/** A stage in a creator's words ("reading its cuts") as a line of progress. */
export function stageLine(stage: string): string {
  return `${stage[0]?.toUpperCase() ?? ""}${stage.slice(1)}…`;
}
