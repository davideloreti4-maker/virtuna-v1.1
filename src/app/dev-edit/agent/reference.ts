/**
 * reference.ts — a style read from a video (Task 13b): the page's side of `/api/edit/references`. A link is sent and fetched by
 * the route (15 to 95 s); a file is signed for, put into the bucket and started. Either is then read again every second and a
 * half until its style is ready (one to three minutes today), telling the stage in a creator's words and how far the bar is.
 * The reference is deleted by the route once it is read. A read the page does not finish has it deleted at once (X96,
 * `DELETE /api/edit/references/<id>`): one it stops (the creator picked another row or started over), one that cannot go on
 * (its upload or its start refused, three reads in a row that did not get there), and, best effort, one the page is left during
 * (`pagehide`, with `keepalive`). A stopped read then asks nothing more of the route and tells nothing more.
 */
import { call as callRoute, put as putFile } from "../shared";
import { UNREACHABLE, problemOf, sentence, stageLine } from "./picking";

export type Source = { link: string } | { file: File };

/** What is shown while it is read: the line, and the bar's share (null while it cannot be told). */
export interface Progress {
  stage: string;
  share: number | null;
}

/** The style, or one plain sentence of why there is none; or `stopped`: the page told it to stop, and nothing is to be shown. */
export type Read = { ok: true; style: unknown; judged: boolean } | { ok: false; problem: string } | { ok: false; stopped: true };

type Shown = { status: "analysing"; stage: string; progress: number } | { status: "ready"; style: unknown; judged: boolean } | { status: "failed"; error: string };

/**
 * The bar's share at each step: the upload the first fifth, the analysis the next three, the look's read at four fifths. The
 * last fifth is the cut's, which the page shows after this.
 */
const SHARE = { upload: 0.2, analysis: 0.6, look: 0.8 } as const;
const GETTING = stageLine("getting the video");
const LOOK = "reading its look";
const GONE = "The video could not be read into a style. Try it again, or another video.";
const NOT_UPLOADED = "The video did not upload. Check your connection.";
/** How long between two reads, and how many reads in a row may fail before it gives up. */
const EVERY_MS = 1500;
const MOST_UNREAD = 3;

interface Deps {
  put?: typeof putFile;
  wait?: (ms: number) => Promise<void>;
  /** Aborted by the page when the creator moves on (another row, another page): the read stops at its next step. */
  signal?: AbortSignal;
}

const STOPPED: Read = { ok: false, stopped: true };

/**
 * Asks the route to drop a reference the page will not read to its end, once: never awaited, and a failure is left to the
 * route's sweep. With `keepalive` the request outlives the page that is being left.
 */
function dropper(): { known: (id: string) => void; drop: (keepalive?: boolean) => void } {
  let id: string | null = null;
  let dropped = false;
  return {
    known: (made) => void (id = made),
    drop: (keepalive = false) => {
      if (id === null || dropped) return;
      dropped = true;
      void fetch(`/api/edit/references/${id}`, { method: "DELETE", keepalive }).catch(() => undefined);
    },
  };
}

/**
 * The style of a video: `tell` is called at each step with what to show, and the answer is the style (a `StyleProfile` for
 * the agent's route, which checks it) or one plain sentence of why there is none.
 */
export async function readStyle(source: Source, tell: (progress: Progress) => void, deps: Deps = {}): Promise<Read> {
  const reference = dropper();
  const stop = () => reference.drop(); // the creator moved on: at once, even while a read is out
  const leave = () => reference.drop(true); // the page is going: a request that outlives it
  const page = typeof window === "undefined" ? null : window;
  deps.signal?.addEventListener("abort", stop, { once: true });
  page?.addEventListener("pagehide", leave);
  try {
    return await reading(source, tell, deps, reference);
  } finally {
    deps.signal?.removeEventListener("abort", stop);
    page?.removeEventListener("pagehide", leave);
  }
}

/** The read itself: a reference the route has made is made `known`, and dropped on every way out but its style or its failure. */
async function reading(source: Source, tell: (progress: Progress) => void, { put = putFile, wait = (ms) => new Promise((done) => setTimeout(done, ms)), signal }: Deps, reference: ReturnType<typeof dropper>): Promise<Read> {
  const stopped = () => signal?.aborted === true; // asked after every step that waits: a read that was stopped tells nothing more
  const end = (read: Read): Read => (reference.drop(), read); // a read that goes no further: the route's reference goes too
  let id: string;
  if ("link" in source) {
    tell({ stage: GETTING, share: null }); // the route fetches it: how far it is cannot be told
    const made = await callRoute<{ id: string }>("/api/edit/references", { url: source.link.trim() });
    if (made.ok) reference.known(made.body.id);
    if (stopped()) return end(STOPPED);
    if (!made.ok) return { ok: false, problem: problemOf(made) };
    id = made.body.id;
  } else {
    const { file } = source;
    tell({ stage: GETTING, share: 0 });
    const made = await callRoute<{ id: string; upload: string }>("/api/edit/references", { name: file.name, bytes: file.size, type: file.type });
    if (made.ok) reference.known(made.body.id);
    if (stopped()) return end(STOPPED);
    if (!made.ok) return { ok: false, problem: problemOf(made) };
    id = made.body.id;
    try {
      await put(made.body.upload, file, (sent) => (stopped() ? undefined : tell({ stage: GETTING, share: SHARE.upload * Math.min(1, sent / file.size) })));
    } catch {
      return end(stopped() ? STOPPED : { ok: false, problem: NOT_UPLOADED });
    }
    if (stopped()) return end(STOPPED);
    const started = await callRoute<{ id: string }>(`/api/edit/references/${id}`, {});
    if (stopped()) return end(STOPPED);
    if (!started.ok) return end({ ok: false, problem: problemOf(started) });
  }

  let share: number = "file" in source ? SHARE.upload : 0;
  for (let reads = 0, unread = 0; ; reads++) {
    if (reads > 0) await wait(EVERY_MS);
    if (stopped()) return end(STOPPED);
    const read = await callRoute<Shown>(`/api/edit/references/${id}`);
    if (stopped()) return end(STOPPED);
    if (read.status === 404) return { ok: false, problem: GONE }; // dropped: read elsewhere, or left too long
    if (!read.ok) {
      if (++unread >= MOST_UNREAD) return end({ ok: false, problem: read.status === 0 ? UNREACHABLE : problemOf(read) });
      continue;
    }
    unread = 0;
    const shown = read.body;
    if (shown.status === "ready") return { ok: true, style: shown.style, judged: shown.judged };
    if (shown.status === "failed") return { ok: false, problem: sentence(shown.error) };
    // The bar only grows: the worker's progress is its own, and the look's read starts at four fifths.
    share = Math.max(share, shown.stage === LOOK ? SHARE.look : SHARE.upload + SHARE.analysis * Math.min(1, Math.max(0, shown.progress)));
    tell({ stage: stageLine(shown.stage), share });
  }
}
