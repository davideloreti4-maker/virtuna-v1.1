"use client";

/**
 * shared.ts — what the edit tool's dev pages share to talk to its routes (`/dev-edit/worker`, `/dev-edit/agent`): a call that
 * always answers, an upload that tells how far it is, and a job read until it ends.
 */
import { useEffect, useState } from "react";

export interface JobShown {
  status: string;
  stage: string | null;
  progress: number;
  error: string | null;
  filmUrl?: string;
}

/** The states a job ends in. */
export const ENDED = new Set(["done", "failed"]);

/** A call to the app's routes: its status and body. A call that fails (the network, the dev server restarting) is one more answer that is not ok. */
export async function call<T>(path: string, body?: unknown): Promise<{ ok: boolean; status: number; body: T & { error?: string } }> {
  try {
    const response = await fetch(path, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: response.ok, status: response.status, body: await response.json().catch(() => ({ error: `it answered ${response.status}` })) };
  } catch (error) {
    return { ok: false, status: 0, body: { error: String(error) } as T & { error?: string } };
  }
}

/** Puts the file into R2 at its signed address, telling how many bytes have gone. */
export function put(url: string, file: File, onSent: (bytes: number) => void): Promise<void> {
  return new Promise((done, fail) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = (event) => onSent(event.loaded);
    request.onload = () => (request.status >= 200 && request.status < 300 ? done() : fail(new Error(`R2 answered ${request.status} to the upload`)));
    request.onerror = () => fail(new Error("the upload did not reach R2"));
    request.send(file);
  });
}

/** How long to wait before reading a job again after a read failed: doubling from a second, at most 15 s. */
const RETRY_MS = (failures: number) => Math.min(15_000, 1000 * 2 ** failures);

/** What is known of the job being read: `of` names the reading it belongs to, so nothing of an earlier job is ever shown. */
interface Reading {
  of: string;
  job: JobShown | null;
  unread: string | null;
  lost: number | null;
}

/**
 * A job, read every second until it has ended. Its row holds its progress, so this goes on across a reload. A
 * read that fails (the network, the dev server restarting, a 500) is tried again, later each time; it is shown
 * as a read that failed, never as a failed job. Only a job that is not there (404) stops it.
 *
 * With a `bound`, the reading also gives up: after `most` failed reads in a row, and at once when the creator is
 * no longer let in (401, 403). `lost` is then the status of the read it stopped at (0 for a call that never got
 * there), and 404 for a job that is not there; null while the job is being read or has ended. `again`, counted up,
 * reads the same job anew. A page with nothing waiting on the job gives no bound and is told of every try, as before.
 */
export function useJob(id: string | null, bound?: { most: number; again?: number }): { job: JobShown | null; unread: string | null; lost: number | null } {
  const [reading, setReading] = useState<Reading | null>(null);
  const most = bound?.most;
  const of = id === null ? null : `${id} ${bound?.again ?? 0}`;
  useEffect(() => {
    if (!id || of === null) return;
    let stopped = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tell = (more: Partial<Reading>) => setReading((was) => ({ ...(was?.of === of ? was : { of, job: null, unread: null, lost: null }), ...more }));
    const read = async () => {
      const answer = await call<JobShown>(`/api/edit/jobs/${id}`);
      if (stopped) return;
      if (answer.ok) {
        failures = 0;
        tell({ job: answer.body, unread: null });
        if (!ENDED.has(answer.body.status)) timer = setTimeout(read, 1000);
        return;
      }
      if (answer.status === 404) return tell({ unread: "this job is not there", lost: 404 });
      failures += 1;
      const why = `the job could not be read (${answer.body.error ?? answer.status})`;
      if (most !== undefined && (failures >= most || answer.status === 401 || answer.status === 403)) return tell({ unread: why, lost: answer.status });
      tell({ unread: `${why}; reading it again` });
      timer = setTimeout(read, RETRY_MS(failures - 1));
    };
    void read();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id, of, most]);
  return reading !== null && reading.of === of ? { job: reading.job, unread: reading.unread, lost: reading.lost } : { job: null, unread: null, lost: null };
}
