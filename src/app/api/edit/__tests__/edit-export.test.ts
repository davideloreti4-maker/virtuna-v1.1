/**
 * edit-export.test.ts — the export of the edit shown, and giving it up (plan 2026-11-24-editor-screens-a, Task 8; spec E6, E20,
 * §7; rulings R2, R19, R20, R25). Real routes, store and turns' rules; stand-ins at the network only: the worker's start is the
 * stand-in's (`/start`), and a render that has finished is its row as the worker writes it.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

import { coverFrame } from "@/lib/edit";
import type { EditView } from "@/lib/edit/edit-view";
import { OTHER, TAKE, USER } from "@/lib/edit/worker/__tests__/rows";
import { BUCKET } from "@/lib/edit/worker/__tests__/stand-ins";
import { POST as exportRoute, DELETE as giveUp } from "../edits/[id]/export/route";
import { GET as read } from "../edits/[id]/route";
import { POST as opsRoute } from "../edits/[id]/ops/route";
import { TAKE_FIRST, by, del, get, post, seedEdit, through, wireEditWorld, type Seeded } from "./edit-world";

const w = wireEditWorld();
afterEach(() => {
  vi.useRealTimers();
});

const SECOND = "44444444-4444-4444-8444-444444444444";
/** The sentences the routes refuse with, written out: a change of their words is seen here. */
const EXPORTING = "Your video is being made; the edit holds still until it is done or cancelled.";
const CHANGED = "The edit changed while this was being made. Try again.";
const NO_CUT = "There is no cut of this edit yet.";
const RENDERING = "a render of yours is already running; try again when it ends";

const start = (id: string) => exportRoute(post(`/api/edit/edits/${id}/export`), by(id));
const cancel = (id: string) => giveUp(del(`/api/edit/edits/${id}/export`), by(id));
const viewOf = async (response: Response, status = 200): Promise<EditView> => {
  if (response.status !== status) throw new Error(`${response.status} ${await response.text()}`);
  return (await response.json()) as EditView;
};
const refusal = async (response: Response) => ({ status: response.status, ...((await response.json()) as object) });
const rowOf = (id: string) => w.world.rest.row("edits", id);
const jobOf = (id: string) => w.world.rest.row("edit_jobs", id);
/** A row the test is about to change by hand: one that is missing fails here, not at a later assertion. */
function there<T>(row: T | undefined): T {
  if (row === undefined) throw new Error("the row is not in the stand-in");
  return row;
}
/** What the stand-in was asked to write, in order: nothing here means no write was even tried. */
const writes = () => w.world.rest.calls.filter((call) => call.method !== "GET").map((call) => `${call.method} ${call.table}`);
const keyAt = (url: string | null | undefined) => (url ? decodeURIComponent(new URL(url).pathname) : null);
/** The edit's row, its turns and every job, as the tables hold them: the same text before and after means nothing was written. */
const held = (id: string) => JSON.stringify([rowOf(id), w.world.rest.tables.edit_turns.filter((turn) => turn.edit_id === id), w.world.rest.tables.edit_jobs]);
/** A render of the creator's as the worker writes it: at work unless told. Its id. */
const render = (over: Record<string, unknown> = {}) => String(w.world.rest.put("edit_jobs", { user_id: USER, kind: "render", status: "running", stage: "rendering", progress: 0.4, ...over }).id);
/** A render that has made its film, as the worker's last write leaves its row; and where the film is kept. */
const MADE = { status: "done", stage: null, progress: 1, result: { path: `u/${USER}/films/film-1.mp4`, ms: 7400 } };
const FILM_AT = `/${BUCKET}/u/${USER}/films/film-1.mp4`;
const film = () => render(MADE);
/**
 * A seeded edit, last written a minute ago, as an edit is when a call reads it. The stand-in's clock counts in milliseconds, so
 * without it a write made in the same millisecond as the seed would carry the seed's own stamp.
 */
function aged(seeded: { id: string; threadId: string }) {
  const row = rowOf(seeded.id);
  if (row) row.updated_at = row.created_at = new Date(Date.now() - 60_000).toISOString();
  return seeded;
}
/** Stops the clock (`Date` only), so that every stamp written from here on is the same one and a write is told by its head alone. */
const stopClock = () => vi.useFakeTimers({ toFake: ["Date"] });

const CUT: Seeded = { kind: "cut", doc: TAKE_FIRST, request: "house" };
const BIGGER_EDIT = through(TAKE_FIRST, [{ op: "captions.set", size: 96 }]);
const CHANGE: Seeded = { kind: "change", doc: BIGGER_EDIT, request: "Bigger captions" };

describe("POST …/export", () => {
  it("renders the edit shown on the worker and keeps the job as the export of that turn", async () => {
    const { id } = seedEdit(w.world, { turns: [CUT] });
    const view = await viewOf(await start(id), 202);
    expect(view).toMatchObject({ id, head: 1, shown: 1 });
    expect(view.export).toMatchObject({ turn: 1, status: "queued", filmUrl: null });
    const job = jobOf(view.export!.job)!;
    expect(job).toMatchObject({ user_id: USER, kind: "render", input: { edit: TAKE_FIRST, cover: coverFrame(TAKE_FIRST) } });
    expect(w.world.worker.started).toEqual([view.export!.job]);
    expect(rowOf(id)).toMatchObject({ export_job: view.export!.job, export_turn: 1, head: 1 });
  });

  it.each<{ what: string; turns: Seeded[]; head: number; shown: number }>([
    // The head rests on the answer that changed nothing (R9); the edit shown is the change before it.
    { what: "an answer that changed nothing after it", turns: [CUT, CHANGE, { kind: "said", doc: null, request: "Make it pop" }], head: 3, shown: 2 },
    { what: "turns after it left for Redo", turns: [CUT, CHANGE, { kind: "direct", doc: TAKE_FIRST }], head: 2, shown: 2 },
  ])("exports the turn shown, never the head or the last turn: with $what", async ({ turns, head, shown }) => {
    const { id } = seedEdit(w.world, { turns, head });
    const view = await viewOf(await start(id), 202);
    expect(view).toMatchObject({ head, shown });
    expect(view.export).toMatchObject({ turn: shown, status: "queued" });
    expect(jobOf(view.export!.job)).toMatchObject({ input: { edit: BIGGER_EDIT, cover: coverFrame(BIGGER_EDIT) } });
    expect(rowOf(id)).toMatchObject({ export_job: view.export!.job, export_turn: shown, head });
  });

  it("refuses a second export while one runs, and an edit with no cut, a first cut's left-over turn included, starting nothing", async () => {
    const { id } = seedEdit(w.world, { turns: [CUT] });
    const first = await viewOf(await start(id), 202);
    expect(await refusal(await start(id))).toEqual({ status: 409, error: EXPORTING });
    expect(rowOf(id)).toMatchObject({ export_job: first.export!.job, export_turn: 1 });
    const none = seedEdit(w.world);
    expect(await refusal(await start(none.id))).toEqual({ status: 409, error: NO_CUT });
    const stopped = seedEdit(w.world, { turns: [CUT], head: null }); // R21
    expect(await refusal(await start(stopped.id))).toEqual({ status: 409, error: NO_CUT });
    expect(w.world.worker.started).toEqual([first.export!.job]);
    expect(w.world.rest.tables.edit_jobs).toHaveLength(1);
    expect(rowOf(stopped.id)).toMatchObject({ export_job: null, export_turn: null });
  });

  it("passes on what the render itself refuses, keeping no export: another render of theirs at work, a file not theirs to render", async () => {
    const one = seedEdit(w.world, { turns: [CUT] });
    const other = seedEdit(w.world, { turns: [CUT] });
    const first = await viewOf(await start(one.id), 202);
    expect(await refusal(await start(other.id))).toEqual({ status: 409, error: RENDERING }); // one live render a creator (A1)
    expect(rowOf(other.id)).toMatchObject({ export_job: null, export_turn: null });
    await viewOf(await cancel(one.id));
    // The take is no longer a ready one: no file of this creator's as the worker measured it.
    Object.assign(there(w.world.rest.row("edit_takes", TAKE)), { status: "failed", error: "the worker stopped" });
    expect(await refusal(await start(other.id))).toMatchObject({ status: 400, error: "a file of the edit is not yours to render", problems: [{ path: "assets.0", id: TAKE }] });
    expect(rowOf(other.id)).toMatchObject({ export_job: null, export_turn: null });
    expect(w.world.worker.started).toEqual([first.export!.job]);
    expect(w.world.rest.tables.edit_jobs).toHaveLength(1);
  });

  it("502s when the worker cannot start the render, and keeps no export", async () => {
    const { id } = seedEdit(w.world, { turns: [CUT] });
    w.world.worker.answer = 500;
    const refused = await refusal(await start(id));
    expect(refused).toMatchObject({ status: 502, error: "the worker could not start the job: it answered 500", job: { status: "failed" } });
    expect(rowOf(id)).toMatchObject({ export_job: null, export_turn: null });
    expect((await viewOf(await read(get(`/api/edit/edits/${id}`), by(id)))).export).toBeNull();
  });

  it("keeps the render the worker took though its answer was lost", async () => {
    const { id } = seedEdit(w.world, { turns: [CUT] });
    w.world.worker.answer = "took it, then 500";
    const view = await viewOf(await start(id), 202);
    expect(view.export).toMatchObject({ turn: 1, status: "running" });
    expect(rowOf(id)).toMatchObject({ export_job: view.export!.job, export_turn: 1 });
  });

  it("makes the film again after an export that ended, and after one given up: the new render is the edit's export", async () => {
    const made = film();
    const { id } = seedEdit(w.world, { turns: [CUT], exportJob: made, exportTurn: 1 });
    const again = await viewOf(await start(id), 202);
    expect(again.export).toMatchObject({ turn: 1, status: "queued", filmUrl: null });
    expect(again.export!.job).not.toBe(made);
    expect(jobOf(made)).toMatchObject({ status: "done" });
    await viewOf(await cancel(id));
    const third = await viewOf(await start(id), 202);
    expect(third.export).toMatchObject({ turn: 1, status: "queued" });
    expect(third.export!.job).not.toBe(again.export!.job);
    expect(rowOf(id)).toMatchObject({ export_job: third.export!.job, export_turn: 1 });
    expect(w.world.worker.started).toEqual([again.export!.job, third.export!.job]);
  });

  it.each<{ what: string; byHead: boolean; lands: () => Record<string, unknown> }>([
    // Told by the stamp: the head has not moved. The edit is a minute old, so the other export's stamp is later than the one read.
    { what: "another export of it was started", byHead: false, lands: () => ({ export_job: render(), export_turn: 2 }) },
    // Told by the head: the clock is stopped, so the stamp is the one read.
    { what: "its head was moved", byHead: true, lands: () => ({ head: 1 }) },
  ])("refuses an export of an edit written since it was read ($what): the row is left as that write left it, and the render started is given up (R19)", async ({ byHead, lands }) => {
    if (byHead) stopClock();
    const made = seedEdit(w.world, { turns: [CUT, CHANGE] });
    const { id } = byHead ? made : aged(made);
    // The moment the render's job is written, the other write lands: the stand-in's hook for a write to refuse, used to write in between.
    const landed: Record<string, unknown>[] = [];
    w.world.rest.failing = ({ method, table }) => {
      if (method === "POST" && table === "edit_jobs" && landed.length === 0) {
        landed.push(lands());
        Object.assign(there(rowOf(id)), landed[0], { updated_at: new Date().toISOString() });
      }
      return false;
    };
    expect(await refusal(await start(id))).toEqual({ status: 409, error: CHANGED });
    expect(landed).toHaveLength(1);
    expect(rowOf(id)).toMatchObject({ head: 2, export_job: null, export_turn: null, ...landed[0] });
    // Its own render was started, and is failed while it had not ended, so that the worker stops and no render of theirs is left at work.
    const [mine] = w.world.worker.started;
    expect(w.world.worker.started).toHaveLength(1);
    expect(jobOf(mine!)).toMatchObject({ status: "failed", error: "the edit changed while its export was started", finished_at: expect.any(String) });
    // The other export is not touched.
    const theirs = landed[0]?.export_job;
    if (typeof theirs === "string") expect(jobOf(theirs)).toMatchObject({ status: "running", error: null });
  });

  it("refuses such an export all the same when its render cannot be given up, and logs that", async () => {
    const { id } = aged(seedEdit(w.world, { turns: [CUT, CHANGE] }));
    w.world.rest.failing = ({ method, table }) => {
      if (method === "POST" && table === "edit_jobs") Object.assign(there(rowOf(id)), { head: 1, updated_at: new Date().toISOString() });
      return method === "PATCH" && table === "edit_jobs"; // the database refuses the write that would fail the render
    };
    expect(await refusal(await start(id))).toEqual({ status: 409, error: CHANGED });
    expect(w.errorsLogged()).toContain("the render of a refused export could not be given up");
    expect(rowOf(id)).toMatchObject({ head: 1, export_job: null, export_turn: null });
    expect(jobOf(there(w.world.worker.started[0]))).toMatchObject({ status: "queued", error: null }); // it ends by itself
  });
});

describe("the export as the page reads it", () => {
  it("gives the film's address once it is made, for the turn shown only", async () => {
    const { id } = seedEdit(w.world, { turns: [CUT, CHANGE], exportJob: film(), exportTurn: 2 });
    const view = await viewOf(await read(get(`/api/edit/edits/${id}`), by(id)));
    expect(view.export).toMatchObject({ turn: 2, status: "done", ms: 7400 });
    expect(keyAt(view.export?.filmUrl)).toBe(FILM_AT);
    rowOf(id)!.head = 1;
    expect((await viewOf(await read(get(`/api/edit/edits/${id}`), by(id)))).export).toBeNull();
  });

  it("is forgotten when a new turn is made", async () => {
    const { id } = seedEdit(w.world, { turns: [CUT] });
    const started = await viewOf(await start(id), 202);
    jobOf(started.export!.job)!.status = "done";
    const view = await viewOf(await opsRoute(post(`/api/edit/edits/${id}/ops`, { ops: [{ op: "captions.set", on: false }] }), by(id)));
    expect(view.export).toBeNull();
    expect(rowOf(id)).toMatchObject({ export_job: null, export_turn: null });
  });
});

describe("DELETE …/export", () => {
  it.each(["running", "queued"])("writes the %s render failed, so the worker gives it up, and gives the whole edit back (R2, R20)", async (status) => {
    const { id } = seedEdit(w.world, { turns: [CUT] });
    const started = await viewOf(await start(id), 202);
    jobOf(started.export!.job)!.status = status;
    const view = await viewOf(await cancel(id));
    expect(view).toMatchObject({ id, head: 1, shown: 1, undo: null, redo: null, export: null });
    expect(view.edit).toEqual(TAKE_FIRST);
    expect(view.turns.map((turn) => turn.n)).toEqual([1]);
    expect(jobOf(started.export!.job)).toMatchObject({ status: "failed", error: "the creator cancelled it", finished_at: expect.any(String) });
    expect(rowOf(id)).toMatchObject({ export_job: null, export_turn: null, head: 1 });
    // The edit is theirs to change again.
    expect((await opsRoute(post(`/api/edit/edits/${id}/ops`, { ops: [{ op: "word.set", asset: TAKE, index: 0, text: "Halt" }] }), by(id))).status).toBe(200);
  });

  it("keeps the file when the cancel arrives after it is made: nothing is written, and the view shows it (R25)", async () => {
    const made = film();
    const { id } = seedEdit(w.world, { turns: [CUT], exportJob: made, exportTurn: 1 });
    const before = held(id);
    const view = await viewOf(await cancel(id));
    expect(view).toMatchObject({ id, head: 1, shown: 1 });
    expect(view.export).toMatchObject({ job: made, turn: 1, status: "done", error: null, ms: 7400 });
    expect(keyAt(view.export?.filmUrl)).toBe(FILM_AT);
    expect(held(id)).toBe(before);
    expect(writes()).toEqual([]);
  });

  it("keeps the file when it is made between the cancel's read and its write: the render is not written failed (R25)", async () => {
    const { id } = seedEdit(w.world, { turns: [CUT] });
    const job = (await viewOf(await start(id), 202)).export!.job;
    Object.assign(there(jobOf(job)), { status: "running", stage: "rendering", progress: 0.9 });
    // The moment the render would be written failed, the worker's last write lands: the stand-in's hook for a write to refuse,
    // used to write in between.
    const landed: string[] = [];
    w.world.rest.failing = ({ method, table }) => {
      if (method === "PATCH" && table === "edit_jobs" && landed.length === 0) {
        landed.push(new Date().toISOString());
        Object.assign(there(jobOf(job)), MADE, { finished_at: landed[0], updated_at: landed[0] });
      }
      return false;
    };
    const before = writes();
    const view = await viewOf(await cancel(id));
    expect(landed).toHaveLength(1);
    expect(view.export).toMatchObject({ job, turn: 1, status: "done", error: null, ms: 7400 });
    expect(keyAt(view.export?.filmUrl)).toBe(FILM_AT);
    expect(jobOf(job)).toMatchObject({ ...MADE, error: null });
    expect(rowOf(id)).toMatchObject({ export_job: job, export_turn: 1 });
    expect(writes().slice(before.length)).toEqual(["PATCH edit_jobs"]); // the one guarded write, which changed nothing; the edit's row is not written
  });

  it("lets go of an export that failed on its own, before the cancel or between its read and its write: the job is left as it failed", async () => {
    const WHY = "the render failed on our side";
    const failed = render({ status: "failed", stage: null, error: WHY });
    const one = seedEdit(w.world, { turns: [CUT], exportJob: failed, exportTurn: 1 });
    expect((await viewOf(await cancel(one.id))).export).toBeNull();
    expect(rowOf(one.id)).toMatchObject({ export_job: null, export_turn: null });
    expect(writes()).toEqual(["PATCH edits"]);

    const failing = render();
    const other = seedEdit(w.world, { turns: [CUT], exportJob: failing, exportTurn: 1 });
    w.world.rest.failing = ({ method, table }) => {
      if (method === "PATCH" && table === "edit_jobs") Object.assign(there(jobOf(failing)), { status: "failed", stage: null, error: WHY });
      return false;
    };
    expect((await viewOf(await cancel(other.id))).export).toBeNull();
    expect(rowOf(other.id)).toMatchObject({ export_job: null, export_turn: null });
    expect([jobOf(failed), jobOf(failing)]).toMatchObject([{ status: "failed", error: WHY }, { status: "failed", error: WHY }]);
  });

  it("writes nothing for an edit with no export: the view as it stands", async () => {
    const { id } = seedEdit(w.world, { turns: [CUT, CHANGE] });
    const before = held(id);
    expect(await viewOf(await cancel(id))).toMatchObject({ head: 2, shown: 2, undo: 1, export: null });
    expect(held(id)).toBe(before);
    expect(w.world.rest.calls.filter((call) => call.method !== "GET")).toEqual([]);
  });

  it("refuses on an edit written since it was read: an export started meanwhile is not the one let go of, and stands (R19)", async () => {
    const old = render({ status: "failed", stage: null, error: "the render failed on our side" });
    const { id } = aged(seedEdit(w.world, { turns: [CUT], exportJob: old, exportTurn: 1 }));
    // Between the edit's read and its write another export is started (the old one had failed, so nothing held the edit still):
    // the stand-in's hook for a read to refuse, used to write in between, at the moment the old export's job is read.
    const started: string[] = [];
    w.world.rest.failingRead = ({ table }) => {
      if (table === "edit_jobs" && started.length === 0) {
        started.push(render());
        Object.assign(there(rowOf(id)), { export_job: started[0], export_turn: 1, updated_at: new Date().toISOString() });
      }
      return false;
    };
    expect(await refusal(await cancel(id))).toEqual({ status: 409, error: CHANGED });
    const newer = there(started[0]);
    expect(rowOf(id)).toMatchObject({ export_job: newer, export_turn: 1 });
    expect(jobOf(newer)).toMatchObject({ status: "running", error: null });
    expect((await viewOf(await read(get(`/api/edit/edits/${id}`), by(id)))).export).toMatchObject({ job: newer, status: "running" });
  });
});

describe("each of the two", () => {
  const at = (id: string) => `http://localhost:3000/api/edit/edits/${id}/export`;
  const CALLS = [
    {
      name: "POST",
      // An edit it would export.
      seeded: () => seedEdit(w.world, { turns: [CUT] }),
      send: (id: string, headers: Record<string, string> = {}) => exportRoute(new Request(at(id), { method: "POST", headers: { "content-type": "application/json", ...headers }, body: "{}" }), by(id)),
    },
    {
      name: "DELETE",
      // An edit whose export it would give up.
      seeded: () => seedEdit(w.world, { turns: [CUT], exportJob: render(), exportTurn: 1 }),
      send: (id: string, headers: Record<string, string> = {}) => giveUp(new Request(at(id), { method: "DELETE", headers }), by(id)),
    },
  ];

  it.each(CALLS)("$name asks for a creator the editor is open to, a call from the app's own page, and an edit of theirs", async ({ seeded, send }) => {
    const { id } = seeded();
    const before = held(id);
    expect(await refusal(await send(id, { origin: "https://evil.example" }))).toEqual({ status: 403, error: "Cross-origin request denied" });
    expect(await refusal(await send("nope"))).toEqual({ status: 404, error: "no such edit" });
    expect(await refusal(await send(SECOND))).toEqual({ status: 404, error: "no such edit" });
    w.signedIn = null;
    expect((await send(id)).status).toBe(401);
    w.signedIn = { id: OTHER };
    expect((await send(id)).status).toBe(403);
    vi.stubEnv("EDIT_CREATORS", `${USER},${OTHER}`);
    expect(await refusal(await send(id))).toEqual({ status: 404, error: "no such edit" });
    expect(held(id)).toBe(before);
    expect(w.world.worker.started).toEqual([]);
  });

  it("POST refuses a call that is not JSON, before anything is read", async () => {
    const { id } = seedEdit(w.world, { turns: [CUT] });
    expect((await exportRoute(post(`/api/edit/edits/${id}/export`, {}, "text/plain"), by(id))).status).toBe(415);
    expect(w.world.rest.calls).toEqual([]);
  });
});
