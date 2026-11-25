/**
 * download.ts — what the page shows of a download, and which of its controls are on (Task 13b, fix round 1). Both are read
 * off the page's state and nothing else, so they are tested without a browser. Pure.
 *
 * The rule: a creator can always get back to their cut. A video being made turns off only Download itself; the field, undo
 * and Start over are off only while a call of the agent's is out. And a video whose progress can no longer be read is not
 * waited on for ever: the reader gives up (`MOST_UNREAD`), the page says so in a sentence, and "Try again" reads it again.
 */
import type { Edit } from "@/lib/edit";
import type { JobShown } from "../shared";
import { canUndo, type Session } from "./session";

/** The video asked for: of which edit, its job once started, why it was not started, and how often its job was read anew. */
export interface Film {
  edit: Edit;
  job: string | null;
  problem: string | null;
  tries: number;
}

/** What the job's reader knows (`useJob`): the job as last read, and the status it gave up at. */
export interface JobRead {
  job: JobShown | null;
  lost: number | null;
}

/**
 * What the download is at. A failed one says in `again` what "Try again" does: `make` asks for the video anew (it was not
 * made, or its job is gone), `read` reads the same job again (it may well be there: only its reading failed).
 */
export type Download = { at: "idle" } | { at: "making"; share: number | null } | { at: "made"; url: string } | { at: "failed"; problem: string; again: "make" | "read" };

/**
 * How many reads of a job in a row may fail before the page stops waiting: five. The reader waits 1, 2, 4 and 8 s between
 * them, so that is 15 s with no word of the video: longer than a dev server's restart or a connection that drops and comes
 * back, and short beside a render's 40 to 200 s. A creator who is no longer let in (401, 403) is told at once.
 */
export const MOST_UNREAD = 5;

export const NOT_MADE = "The video could not be made.";
export const LOST_TOUCH = "The connection was lost while the video was being made.";

/** The download as the row under the phone shows it: only of the edit on the phone (`cut`), else there is none. */
export function downloadOf(film: Film | null, cut: Edit | null, { job, lost }: JobRead): Download {
  if (!film || film.edit !== cut) return { at: "idle" };
  if (film.problem) return { at: "failed", problem: film.problem, again: "make" };
  if (job?.status === "failed" || lost === 404 || (job?.status === "done" && !job.filmUrl)) return { at: "failed", problem: NOT_MADE, again: "make" };
  if (job?.filmUrl) return { at: "made", url: job.filmUrl };
  if (lost !== null) return { at: "failed", problem: LOST_TOUCH, again: "read" };
  return { at: "making", share: job ? job.progress : null };
}

/** Which controls are on. */
export interface Controls {
  /** The four rows and the takes: off while the take is cut. On while a video's style is read: picking another row stops it. */
  rows: boolean;
  /** The request field, Send, the suggestions and each answer's undo. */
  ask: boolean;
  /** The row's Undo: also needs an edit to go back to. */
  undo: boolean;
  startOver: boolean;
  /** Download, or its "Try again": off too while the video is being made (the bar stands in its place). */
  download: boolean;
}

export function controlsOf(session: Session, download: Download): Controls {
  const free = session.working === null; // no call of the agent's is out
  const cut = session.cut !== null;
  return {
    rows: !cut && session.working?.what !== "cut",
    ask: cut && free,
    undo: canUndo(session),
    startOver: cut && free,
    download: cut && free && download.at !== "making",
  };
}
