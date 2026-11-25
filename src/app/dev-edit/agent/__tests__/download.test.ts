/**
 * download.test.ts — what the page shows of a download and which controls are on (Task 13b, fix round 1). The rule under
 * test: a creator can always get back to their cut. A video being made, or one whose progress cannot be read, never turns off
 * the field, undo or Start over.
 */
import { describe, expect, it } from "vitest";
import type { Edit } from "@/lib/edit";
import type { JobShown } from "../../shared";
import { LOST_TOUCH, MOST_UNREAD, NOT_MADE, controlsOf, downloadOf, type Download, type Film } from "../download";
import { START, reduce, type Action, type Answer, type Session } from "../session";

const edit = (name: string) => ({ name }) as unknown as Edit;
const CUT = edit("cut");
const film = (more: Partial<Film> = {}): Film => ({ edit: CUT, job: "job", problem: null, tries: 0, ...more });
const job = (more: Partial<JobShown> = {}): JobShown => ({ status: "running", stage: "rendering", progress: 0.4, error: null, ...more });
const read = (shown: JobShown | null = null, lost: number | null = null) => ({ job: shown, lost });

describe("downloadOf", () => {
  it("is none before one is asked for, and none for an edit other than the one asked for", () => {
    expect(downloadOf(null, CUT, read())).toEqual({ at: "idle" });
    expect(downloadOf(film({ edit: edit("an earlier edit") }), CUT, read(job({ status: "done", progress: 1, filmUrl: "https://films.example/old.mp4" })))).toEqual({ at: "idle" });
  });

  it("is being made from the click: with no share until the job is read, then the job's own", () => {
    expect(downloadOf(film({ job: null }), CUT, read())).toEqual({ at: "making", share: null });
    expect(downloadOf(film(), CUT, read())).toEqual({ at: "making", share: null });
    expect(downloadOf(film(), CUT, read(job({ progress: 0.4 })))).toEqual({ at: "making", share: 0.4 });
  });

  it("is made once the job gives the film", () => {
    expect(downloadOf(film(), CUT, read(job({ status: "done", progress: 1, filmUrl: "https://films.example/film.mp4" })))).toEqual({ at: "made", url: "https://films.example/film.mp4" });
  });

  it("failed to start: the route's sentence, and trying again asks for the video anew", () => {
    const refused = "A render of yours is already running; try again when it ends.";
    expect(downloadOf(film({ job: null, problem: refused }), CUT, read())).toEqual({ at: "failed", problem: refused, again: "make" });
  });

  it("could not be made: a failed job, a job that is not there, or one done with no film; trying again makes it anew", () => {
    const failed: Download = { at: "failed", problem: NOT_MADE, again: "make" };
    expect(downloadOf(film(), CUT, read(job({ status: "failed", error: "the worker stopped" })))).toEqual(failed);
    expect(downloadOf(film(), CUT, read(null, 404))).toEqual(failed);
    expect(downloadOf(film(), CUT, read(job({ status: "done", progress: 1 })))).toEqual(failed);
  });

  it("lost touch: the reader gave up on a job that may still be there, so trying again reads it again", () => {
    const lost: Download = { at: "failed", problem: LOST_TOUCH, again: "read" };
    for (const status of [0, 401, 403, 500, 502]) expect(downloadOf(film(), CUT, read(job({ progress: 0.4 }), status))).toEqual(lost);
    expect(downloadOf(film(), CUT, read(null, 0))).toEqual(lost);
  });

  it("goes by what the job said last, not by a read that failed after it: a film that was given is still offered", () => {
    expect(downloadOf(film(), CUT, read(job({ status: "done", progress: 1, filmUrl: "https://films.example/film.mp4" }), 500))).toMatchObject({ at: "made" });
  });

  it("waits for five failed reads in a row: 15 s at the reader's pace", () => {
    expect(MOST_UNREAD).toBe(5);
  });
});

const answer = (name: string, changed = true): Answer => ({ say: name, edit: edit(name), findings: [], rounds: 1, ms: 1, cost: 0, changed, match: null, style: null, styleSay: null });
const after = (...actions: Action[]): Session => actions.reduce(reduce, START);
const CUT_MADE: Action[] = [{ type: "cutting", stage: "Cutting your take…", share: null }, { type: "cut", answer: answer("first") }];
const CHANGED: Action[] = [...CUT_MADE, { type: "asking", request: "Black and white" }, { type: "answered", answer: answer("mono") }];
const IDLE: Download = { at: "idle" };
const MAKING: Download = { at: "making", share: 0.4 };

describe("controlsOf", () => {
  it("before the cut: the rows are on, and nothing of the cut's is", () => {
    expect(controlsOf(START, IDLE)).toEqual({ rows: true, ask: false, undo: false, startOver: false, download: false });
  });

  it("while a video's style is read the rows stay on (picking another stops it); while the take is cut they are off", () => {
    expect(controlsOf(after({ type: "reading", stage: "Reading its cuts…", share: 0.4 }), IDLE).rows).toBe(true);
    expect(controlsOf(after({ type: "cutting", stage: "Cutting your take…", share: null }), IDLE).rows).toBe(false);
  });

  it("at the first cut: everything is on but undo, which has nothing to go back to", () => {
    expect(controlsOf(after(...CUT_MADE), IDLE)).toEqual({ rows: false, ask: true, undo: false, startOver: true, download: true });
    expect(controlsOf(after(...CHANGED), IDLE).undo).toBe(true);
  });

  it("while a change is out: everything is off", () => {
    const out = after(...CHANGED, { type: "asking", request: "Tighter cuts" });
    expect(controlsOf(out, IDLE)).toEqual({ rows: false, ask: false, undo: false, startOver: false, download: false });
  });

  it("while the video is being made: only Download is off; the field, undo and Start over stay on", () => {
    expect(controlsOf(after(...CHANGED), MAKING)).toEqual({ rows: false, ask: true, undo: true, startOver: true, download: false });
  });

  it("when the download failed, however: everything is on, Download's Try again among it", () => {
    for (const again of ["make", "read"] as const) {
      expect(controlsOf(after(...CHANGED), { at: "failed", problem: "…", again })).toEqual({ rows: false, ask: true, undo: true, startOver: true, download: true });
    }
  });

  it("a video that is made leaves Download's place to the link; the rest stays on", () => {
    expect(controlsOf(after(...CHANGED), { at: "made", url: "https://films.example/film.mp4" })).toMatchObject({ ask: true, undo: true, startOver: true });
  });
});
