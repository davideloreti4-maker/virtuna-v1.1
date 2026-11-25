/**
 * edits.test.ts — the editor's edit (plan 2026-11-24-editor-screens-a, Task 6; spec §6, §7): whether the editor is open to the
 * account, an edit made with its chat and the chat's card, the edit read as the page reads it, another take for an edit with
 * no cut. In process, with the real routes, gate, turns' rules and supabase-js; stand-ins at the network only (`edit-world.ts`).
 *
 * And the store the turns and the export are built on (Tasks 7 and 8), with no route between: a turn written, in which order,
 * what a write that stops half way leaves, what a write made on an edit that moved since it was read does; the edit a turn
 * holds; the export of the turn shown.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

import type { Edit } from "@/lib/edit";
import type { EditView } from "@/lib/edit/edit-view";
import { canMoveTo, type TurnKind } from "@/lib/edit/turns";
import { STALE_MS } from "@/lib/edit/worker/stale";
import { OTHER, TAKE, USER, jobRow, keyOf, uploadingTake } from "@/lib/edit/worker/__tests__/rows";
import { BUCKET } from "@/lib/edit/worker/__tests__/stand-ins";
import { GET as open } from "../open/route";
import { POST as make } from "../edits/route";
import { GET as read } from "../edits/[id]/route";
import { POST as retake } from "../edits/[id]/take/route";
import { commitTurn, docOf, exportLive, ownEdit, turnsOf, type TurnWritten } from "../edits/store";
import { TAKE_FIRST, by, get, post, readyTake, seedEdit, through, wireEditWorld, type Seeded } from "./edit-world";

const w = wireEditWorld();
const SECOND = "44444444-4444-4444-8444-444444444444";
const viewOf = async (response: Response): Promise<EditView> => {
  expect(response.status).toBe(200);
  return (await response.json()) as EditView;
};
const readEdit = (id: string) => read(get(`/api/edit/edits/${id}`), by(id));
const keyAt = (url: string | null) => (url ? decodeURIComponent(new URL(url).pathname) : null);

describe("GET /api/edit/open", () => {
  it("says the editor is open to a creator on the list and closed to anyone else, naming no one", async () => {
    expect(await (await open()).json()).toEqual({ open: true });
    w.signedIn = { id: OTHER };
    const closed = await open();
    expect(closed.status).toBe(200);
    expect(await closed.json()).toEqual({ open: false });
    w.signedIn = null;
    expect(await (await open()).json()).toEqual({ open: false });
  });
});

describe("POST /api/edit/edits", () => {
  it("makes the edit of a take still uploading, its own chat, and the chat's one card", async () => {
    w.world.rest.put("edit_takes", uploadingTake({ name: "IMG_0042.MOV" }));
    const made = await make(post("/api/edit/edits", { take: TAKE }));
    expect(made.status).toBe(201);
    const { id, threadId } = (await made.json()) as { id: string; threadId: string };
    expect(w.world.rest.row("edits", id)).toMatchObject({ user_id: USER, take_id: TAKE, thread_id: threadId, title: "IMG_0042", head: null, look: null });
    expect(w.world.rest.row("threads", threadId)).toMatchObject({ user_id: USER, type: "open", title: null });
    expect(w.world.rest.tables.messages).toEqual([expect.objectContaining({ thread_id: threadId, role: "assistant", body: [{ type: "edit", props: { editId: id } }] })]);
  });

  it("refuses another creator's take, a reference, and a body that is not {take}", async () => {
    w.world.rest.put("edit_takes", uploadingTake({ id: SECOND, user_id: OTHER, source_path: keyOf("source", SECOND, OTHER) }));
    expect((await make(post("/api/edit/edits", { take: SECOND }))).status).toBe(404);
    w.world.rest.put("edit_takes", readyTake({ analysis: { ...(readyTake().analysis as object), reference: true } as never }));
    expect((await make(post("/api/edit/edits", { take: TAKE }))).status).toBe(404);
    expect((await make(post("/api/edit/edits", { take: TAKE, more: 1 }))).status).toBe(400);
    expect(w.world.rest.tables.edits).toEqual([]);
  });

  it("asks for a creator the editor is open to, and a call from the app's own page", async () => {
    w.signedIn = { id: OTHER };
    expect((await make(post("/api/edit/edits", { take: TAKE }))).status).toBe(403);
    w.signedIn = { id: USER };
    expect((await make(post("/api/edit/edits", { take: TAKE }, "text/plain"))).status).toBe(415);
  });
});

describe("GET /api/edit/edits/[id]", () => {
  it("reads an edit whose take is still uploading: no addresses, no turn", async () => {
    const { id, threadId } = seedEdit(w.world, { take: uploadingTake() });
    const view = await viewOf(await readEdit(id));
    expect(view).toMatchObject({ id, threadId, title: "IMG_0042", look: null, head: null, shown: null, edit: null, undo: null, redo: null, turns: [], export: null });
    expect(view.take).toMatchObject({ id: TAKE, status: "uploading", previewUrl: null, posterUrl: null, asset: null, ms: null });
  });

  it("reads the edit shown, the turns' words, where Undo and Redo go, and fresh addresses of the ready take", async () => {
    const bigger = through(TAKE_FIRST, [{ op: "captions.set", size: 96 }]);
    const { id } = seedEdit(w.world, {
      turns: [{ kind: "cut", doc: TAKE_FIRST, request: "house" }, { kind: "change", doc: bigger, request: "Bigger captions" }, { kind: "said", doc: null, request: "Make it pop" }],
    });
    const view = await viewOf(await readEdit(id));
    expect(view).toMatchObject({ head: 3, shown: 2, undo: 1, redo: null, export: null });
    expect(view.edit).toEqual(bigger);
    expect(view.turns.map((turn) => [turn.n, turn.kind, turn.request, turn.doc])).toEqual([[1, "cut", "house", true], [2, "change", "Bigger captions", true], [3, "said", "Make it pop", false]]);
    expect(keyAt(view.take.previewUrl)).toBe(`/${BUCKET}/${keyOf("preview.mp4")}`);
    expect(keyAt(view.take.posterUrl)).toBe(`/${BUCKET}/${keyOf("poster.jpg")}`);
    expect(view.take).toMatchObject({ status: "ready", ms: 8000 });
    expect(view.take.asset?.id).toBe(TAKE);
  });

  it("fails a take whose analysis never started, and writes it so, as the take's own route does", async () => {
    const { id } = seedEdit(w.world, { take: uploadingTake({ status: "analysing", updated_at: new Date(Date.now() - STALE_MS - 1000).toISOString() }) });
    const view = await viewOf(await readEdit(id));
    expect(view.take).toMatchObject({ status: "failed", error: "its analysis was never started" });
    expect(w.world.rest.row("edit_takes", TAKE)).toMatchObject({ status: "failed" });
  });

  it("404s an edit that is not the creator's, and an id that is no edit's", async () => {
    const { id } = seedEdit(w.world);
    vi.stubEnv("EDIT_CREATORS", `${USER},${OTHER}`);
    w.signedIn = { id: OTHER };
    expect((await readEdit(id)).status).toBe(404);
    expect((await readEdit("nope")).status).toBe(404);
  });

  it("answers 401 signed out and 403 where the editor is not open: never the 404 of an edit that is not there", async () => {
    const { id } = seedEdit(w.world);
    w.signedIn = null;
    expect((await readEdit(id)).status).toBe(401);
    w.signedIn = { id: OTHER };
    expect((await readEdit(id)).status).toBe(403);
  });
});

describe("POST /api/edit/edits/[id]/take", () => {
  it("puts another take in an edit with no cut yet", async () => {
    const { id } = seedEdit(w.world, { take: uploadingTake() });
    w.world.rest.put("edit_takes", uploadingTake({ id: SECOND, name: "second.mov", source_path: keyOf("source", SECOND) }));
    const view = await viewOf(await retake(post(`/api/edit/edits/${id}/take`, { take: SECOND }), by(id)));
    expect(view.take.id).toBe(SECOND);
    expect(w.world.rest.row("edits", id)).toMatchObject({ take_id: SECOND, title: "second" });
  });

  it("refuses once the edit has a cut", async () => {
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST, request: "house" }] });
    w.world.rest.put("edit_takes", uploadingTake({ id: SECOND, source_path: keyOf("source", SECOND) }));
    const refused = await retake(post(`/api/edit/edits/${id}/take`, { take: SECOND }), by(id));
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: "This edit already has a cut; start a new edit for another video." });
  });

  it("refuses a take that is not theirs, a reference, a body that is not {take}, and an edit that is not theirs; the edit keeps its take", async () => {
    const { id } = seedEdit(w.world, { take: uploadingTake() });
    const THIRD = "66666666-6666-4666-8666-666666666666";
    w.world.rest.put("edit_takes", uploadingTake({ id: SECOND, user_id: OTHER, source_path: keyOf("source", SECOND, OTHER) }));
    w.world.rest.put("edit_takes", readyTake({ id: THIRD, analysis: { ...(readyTake({ id: THIRD }).analysis as object), reference: true } as never }));
    const put = (edit: string, body: unknown) => retake(post(`/api/edit/edits/${edit}/take`, body), by(edit));
    expect((await put(id, { take: SECOND })).status).toBe(404);
    expect((await put(id, { take: THIRD })).status).toBe(404);
    expect((await put(id, { take: TAKE, more: 1 })).status).toBe(400);
    expect((await put(id, {})).status).toBe(400);
    expect((await put(SECOND, { take: TAKE })).status).toBe(404);
    expect((await retake(post(`/api/edit/edits/${id}/take`, { take: TAKE }, "text/plain"), by(id))).status).toBe(415);
    w.signedIn = { id: OTHER };
    expect((await put(id, { take: SECOND })).status).toBe(403);
    expect(w.world.rest.row("edits", id)).toMatchObject({ take_id: TAKE, title: "IMG_0042" });
  });
});

/* ── the store, with no route between ── */

const JOB = "55555555-5555-4555-8555-555555555555";
const BIGGER_EDIT = through(TAKE_FIRST, [{ op: "captions.set", size: 96 }]);
const CUT: Seeded = { kind: "cut", doc: TAKE_FIRST, request: "house" };
const CHANGE: Seeded = { kind: "change", doc: BIGGER_EDIT, request: "Bigger captions" };

/** An edit's row and its turns as a route reads them before it writes a turn, and the clients it writes with. */
async function readFor(id: string) {
  const who = { user: USER, session: w.world.session({ id: USER }) };
  const service = w.world.service();
  const edit = await ownEdit(who, id);
  if (edit instanceof Response) throw new Error("the seeded edit is not there");
  return { who, service, edit, turns: await turnsOf(service, id) };
}
const turn = (kind: TurnKind, doc: Edit | null, request: string): TurnWritten => ({ kind, request, at: null, say: `said of ${request}`, findings: [], kept: [], doc });
/** The edit's turns as the table holds them: number, kind, request. */
const stored = (id: string) =>
  w.world.rest.tables.edit_turns.filter((row) => row.edit_id === id).map((row) => [row.n, row.kind, row.request]).sort((a, b) => Number(a[0]) - Number(b[0]));
const headOf = (id: string) => w.world.rest.row("edits", id)?.head;
/** When the edit's row was last written, as the table's trigger stamps it. */
const stampOf = (id: string) => Date.parse(String(w.world.rest.row("edits", id)?.updated_at));
/** Whether the head rests where the rules let it: on the end of a run. */
const rests = async (id: string) => canMoveTo(await turnsOf(w.world.service(), id), Number(headOf(id)));
/**
 * A seeded edit, last written a minute ago, as an edit is when a call reads it. The stand-in's clock counts in milliseconds, so
 * without it a write made in the same millisecond as the seed would carry the seed's own stamp.
 */
function aged(seeded: { id: string; threadId: string }) {
  const row = w.world.rest.row("edits", seeded.id);
  if (row) row.updated_at = row.created_at = new Date(Date.now() - 60_000).toISOString();
  return seeded;
}
/**
 * Stops the clock (`Date` only), so that every stamp written from here on is the same one and a write is told from the edit as
 * it was read by its head alone. Every head's move stamps the row too, so without this the stamp would refuse it first.
 */
const stopClock = () => vi.useFakeTimers({ toFake: ["Date"] });
afterEach(() => {
  vi.useRealTimers();
});
/** An export's job: a render at work unless told. */
const render = (over: Parameters<typeof jobRow>[0] = {}) => jobRow({ id: JOB, kind: "render", take_id: null, stage: "rendering", progress: 0.4, updated_at: new Date().toISOString(), ...over });
/** What the export's route writes to the edit when it starts one (Task 8). */
const startExport = (id: string) => w.world.service().from("edits").update({ export_job: JOB, export_turn: 1 }).eq("id", id);

describe("a turn written (commitTurn)", () => {
  it("writes the first cut as turn 1 and moves the head to it, with the cut's look and title", async () => {
    const { id } = seedEdit(w.world);
    const { service, edit, turns } = await readFor(id);
    const written = await commitTurn(service, edit, turns, turn("cut", TAKE_FIRST, "house"), { look: "house", title: "Stop scrolling" });
    expect(written).toMatchObject({ id, head: 1, look: "house", title: "Stop scrolling" });
    expect(w.world.rest.row("edits", id)).toMatchObject({ head: 1, look: "house", title: "Stop scrolling" });
    expect(await turnsOf(service, id)).toEqual([{ n: 1, kind: "cut", request: "house", at: null, say: "said of house", findings: [], kept: [], doc: true }]);
    expect(await docOf(service, id, 1)).toEqual(TAKE_FIRST);
  });

  it("writes the findings a turn keeps put away, and reads them back with its turns (slice B, Task 8)", async () => {
    const { id } = seedEdit(w.world, { turns: [CUT] });
    const { service, edit, turns } = await readFor(id);
    const soft = { code: "soft-zoom" as const, severity: "warn" as const, where: { frame: 0, shot: "s1" }, says: "shot s1 is zoomed past its take's sharp limit" };
    expect(await commitTurn(service, edit, turns, { ...turn("change", BIGGER_EDIT, "Bigger"), findings: [soft], kept: ["soft-zoom s1"] })).toMatchObject({ head: 2 });
    expect((await turnsOf(service, id)).map((each) => [each.n, each.kept])).toEqual([[1, []], [2, ["soft-zoom s1"]]]);
  });

  it("puts a turn right after the head, drops the line after it, moves the head to it though it changed nothing, and forgets the export", async () => {
    w.world.rest.put("edit_jobs", jobRow({ id: JOB, kind: "render", take_id: null, status: "done", stage: null, progress: 1 }));
    const { id } = seedEdit(w.world, { turns: [CUT, CHANGE, CHANGE], head: 1, exportJob: JOB, exportTurn: 1 });
    const { service, edit, turns } = await readFor(id);
    const written = await commitTurn(service, edit, turns, turn("said", null, "Make it pop"));
    expect(written).toMatchObject({ head: 2, export_job: null, export_turn: null, look: "house", title: "IMG_0042" });
    expect(stored(id)).toEqual([[1, "cut", "house"], [2, "said", "Make it pop"]]);
    expect(headOf(id)).toBe(2);
    expect(await rests(id)).toBe(true);
  });

  it("refuses a second turn made on the same read once the first is written, and keeps the first", async () => {
    stopClock();
    const { id } = seedEdit(w.world, { turns: [CUT] });
    const [first, second] = [await readFor(id), await readFor(id)];
    expect(await commitTurn(first.service, first.edit, first.turns, turn("change", BIGGER_EDIT, "first"))).toMatchObject({ head: 2 });
    expect(await commitTurn(second.service, second.edit, second.turns, turn("change", BIGGER_EDIT, "second"))).toBe("conflict");
    expect(stored(id)).toEqual([[1, "cut", "house"], [2, "change", "first"]]);
    expect(headOf(id)).toBe(2);
  });

  it("writes one of two turns made at the very same moment: the turns' key refuses the other", async () => {
    const { id } = seedEdit(w.world, { turns: [CUT] });
    const [first, second] = [await readFor(id), await readFor(id)];
    const made = await Promise.all([
      commitTurn(first.service, first.edit, first.turns, turn("change", BIGGER_EDIT, "first")),
      commitTurn(second.service, second.edit, second.turns, turn("change", BIGGER_EDIT, "second")),
    ]);
    expect(made.filter((each) => each === "conflict")).toHaveLength(1);
    expect(made.find((each) => each !== "conflict")).toMatchObject({ head: 2 });
    expect(w.world.rest.calls.filter((call) => call.method === "POST" && call.table === "edit_turns")).toHaveLength(2); // both got as far as the key
    expect(stored(id)).toHaveLength(2);
    expect(headOf(id)).toBe(2);
    expect(await rests(id)).toBe(true);
  });

  it("drops nothing when the head moved since the edit was read: a turn written meanwhile stays", async () => {
    stopClock();
    const { id } = seedEdit(w.world, { turns: [CUT, CHANGE, CHANGE], head: 1 });
    const stale = await readFor(id); // read with a line after its head, so its write would drop from turn 2 on
    const fresh = await readFor(id);
    expect(await commitTurn(fresh.service, fresh.edit, fresh.turns, turn("change", BIGGER_EDIT, "theirs"))).toMatchObject({ head: 2 });
    expect(await commitTurn(stale.service, stale.edit, stale.turns, turn("change", BIGGER_EDIT, "mine"))).toBe("conflict");
    expect(stored(id)).toEqual([[1, "cut", "house"], [2, "change", "theirs"]]);
    expect(headOf(id)).toBe(2);
  });

  it("writes nothing when the head was moved back meanwhile; the edit reads as it was left, and the next turn is made", async () => {
    stopClock();
    const { id } = seedEdit(w.world, { turns: [CUT, CHANGE] });
    const stale = await readFor(id);
    await stale.service.from("edits").update({ head: 1 }).eq("id", id); // an Undo
    expect(await commitTurn(stale.service, stale.edit, stale.turns, turn("change", BIGGER_EDIT, "late"))).toBe("conflict");
    expect(stored(id)).toEqual([[1, "cut", "house"], [2, "change", "Bigger captions"]]);
    expect(headOf(id)).toBe(1);
    expect(await rests(id)).toBe(true);
    expect(await viewOf(await readEdit(id))).toMatchObject({ head: 1, shown: 1, edit: TAKE_FIRST, redo: 2 });
    const again = await readFor(id);
    expect(await commitTurn(again.service, again.edit, again.turns, turn("change", BIGGER_EDIT, "again"))).toMatchObject({ head: 2 });
    expect(stored(id)).toEqual([[1, "cut", "house"], [2, "change", "again"]]);
  });

  it("writes nothing when the head left and came back to the same number meanwhile, on another turn", async () => {
    const { id } = aged(seedEdit(w.world, { turns: [CUT, CHANGE] }));
    const stale = await readFor(id); // read at head 2, its change made on that turn 2
    await stale.service.from("edits").update({ head: 1 }).eq("id", id); // an Undo
    const other = await readFor(id);
    expect(await commitTurn(other.service, other.edit, other.turns, turn("change", TAKE_FIRST, "theirs"))).toMatchObject({ head: 2 }); // head 2 again
    expect(stampOf(id)).toBeGreaterThan(Date.parse(stale.edit.updated_at)); // each move of the head stamped the row
    expect(await commitTurn(stale.service, stale.edit, stale.turns, turn("change", BIGGER_EDIT, "late"))).toBe("conflict");
    expect(stored(id)).toEqual([[1, "cut", "house"], [2, "change", "theirs"]]);
    expect(headOf(id)).toBe(2);
    expect(await viewOf(await readEdit(id))).toMatchObject({ head: 2, shown: 2, edit: TAKE_FIRST, redo: null });
  });

  it.each([
    { line: "no line after its head", turns: [CUT] },
    { line: "a line after its head", turns: [CUT, CHANGE, CHANGE] },
  ])("writes nothing when an export was started meanwhile, with $line: the export stands", async ({ turns: seeded }) => {
    w.world.rest.put("edit_jobs", render());
    const { id } = aged(seedEdit(w.world, { turns: seeded, head: 1 }));
    const before = stored(id);
    const stale = await readFor(id);
    await startExport(id);
    expect(stampOf(id)).toBeGreaterThan(Date.parse(stale.edit.updated_at)); // the export's start stamped the row
    expect(await commitTurn(stale.service, stale.edit, stale.turns, turn("change", BIGGER_EDIT, "late"))).toBe("conflict");
    expect(stored(id)).toEqual(before);
    expect(w.world.rest.row("edits", id)).toMatchObject({ head: 1, export_job: JOB, export_turn: 1 });
    expect((await viewOf(await readEdit(id))).export).toMatchObject({ job: JOB, turn: 1, status: "running" });
  });

  it("writes nothing when the take was changed during a first cut: no cut of the old take is left under the new one", async () => {
    const { id } = aged(seedEdit(w.world));
    w.world.rest.put("edit_takes", readyTake({ id: SECOND, name: "second.mov" }));
    const stale = await readFor(id); // the first cut's read, of the first take
    expect((await retake(post(`/api/edit/edits/${id}/take`, { take: SECOND }), by(id))).status).toBe(200);
    expect(stampOf(id)).toBeGreaterThan(Date.parse(stale.edit.updated_at)); // the take's change stamped the row
    expect(await commitTurn(stale.service, stale.edit, stale.turns, turn("cut", TAKE_FIRST, "house"), { look: "house", title: "Stop scrolling" })).toBe("conflict");
    expect(stored(id)).toEqual([]);
    expect(w.world.rest.row("edits", id)).toMatchObject({ head: null, take_id: SECOND, look: null, title: "second" });
    const view = await viewOf(await readEdit(id));
    expect(view).toMatchObject({ head: null, shown: null, edit: null, redo: null });
    expect(view.take.id).toBe(SECOND);
  });

  it.each([
    // Told by the stamp: the head has not moved. The edit is a minute old, so the export's stamp is later than the one read.
    { what: "an export is started", byHead: false, turns: [CUT], lands: { export_job: JOB, export_turn: 1 }, left: { head: 1, export_job: JOB, export_turn: 1 }, at: 2 },
    // Told by the head: the clock is stopped, so the stamp is the one read.
    { what: "the head is moved back", byHead: true, turns: [CUT, CHANGE], lands: { head: 1 }, left: { head: 1 }, at: 3 },
  ])("answers conflict, and moves no head, when $what between the edit's read again and the head's move", async ({ byHead, turns: seeded, lands, left, at }) => {
    if (byHead) stopClock();
    w.world.rest.put("edit_jobs", render());
    const made = seedEdit(w.world, { turns: seeded });
    const { id } = byHead ? made : aged(made);
    const { service, edit, turns } = await readFor(id);
    // The moment the turn is written, the other write lands: the stand-in's hook for a write to refuse, used to write in between.
    w.world.rest.failing = ({ method, table }) => {
      if (method === "POST" && table === "edit_turns") Object.assign(w.world.rest.row("edits", id) ?? {}, lands, { updated_at: new Date().toISOString() });
      return false;
    };
    expect(await commitTurn(service, edit, turns, turn("change", BIGGER_EDIT, "late"))).toBe("conflict");
    expect(w.world.rest.row("edits", id)).toMatchObject(left);
    expect(stored(id).at(-1)).toEqual([at, "change", "late"]); // the turn stays after the line, as when a write stops there
    expect(await rests(id)).toBe(true);
  });

  it.each([
    { kind: "said" as const, doc: BIGGER_EDIT, why: "a said turn holds no edit" },
    { kind: "change" as const, doc: null, why: "a change turn must hold an edit" },
  ])("refuses a turn the table would not take ($why) before it drops anything", async ({ kind, doc, why }) => {
    const { id } = seedEdit(w.world, { turns: [CUT, CHANGE, CHANGE], head: 1 });
    const { service, edit, turns } = await readFor(id);
    await expect(commitTurn(service, edit, turns, turn(kind, doc, "Shorter"))).rejects.toThrow(why);
    expect(stored(id)).toEqual([[1, "cut", "house"], [2, "change", "Bigger captions"], [3, "change", "Bigger captions"]]);
    expect(headOf(id)).toBe(1);
  });

  it("refuses a turn past the 300th and writes nothing", async () => {
    const { id } = seedEdit(w.world, { turns: [CUT, ...Array.from({ length: 299 }, (): Seeded => ({ kind: "said", doc: null }))] });
    const { service, edit, turns } = await readFor(id);
    expect(await commitTurn(service, edit, turns, turn("change", BIGGER_EDIT, "one more"))).toBe("full");
    expect(stored(id)).toHaveLength(300);
    expect(headOf(id)).toBe(300);
  });

  it("stopped after the drop: the edit stands at its head, the line after it gone", async () => {
    const { id } = seedEdit(w.world, { turns: [CUT, CHANGE, CHANGE], head: 1 });
    const { service, edit, turns } = await readFor(id);
    w.world.rest.failing = ({ method, table }) => method === "POST" && table === "edit_turns";
    await expect(commitTurn(service, edit, turns, turn("change", BIGGER_EDIT, "Shorter"))).rejects.toThrow("the turn could not be written");
    expect(stored(id)).toEqual([[1, "cut", "house"]]);
    expect(headOf(id)).toBe(1);
    expect(await rests(id)).toBe(true);
    expect(await viewOf(await readEdit(id))).toMatchObject({ head: 1, shown: 1, edit: TAKE_FIRST, undo: null, redo: null });
  });

  it.each([
    { kind: "change" as const, doc: BIGGER_EDIT, redo: 2 }, // a turn that holds an edit is where Redo goes
    { kind: "said" as const, doc: null, redo: null }, // an answer that changed nothing is not shown
  ])("stopped after a $kind turn is written: the edit reads as it was read, and the next turn takes its place", async ({ kind, doc, redo }) => {
    const { id } = seedEdit(w.world, { turns: [CUT] });
    const { service, edit, turns } = await readFor(id);
    w.world.rest.failing = ({ method, table }) => method === "PATCH" && table === "edits";
    await expect(commitTurn(service, edit, turns, turn(kind, doc, "Shorter"))).rejects.toThrow("the edit's head could not be moved");
    w.world.rest.failing = null;
    expect(stored(id)).toEqual([[1, "cut", "house"], [2, kind, "Shorter"]]);
    expect(headOf(id)).toBe(1);
    const view = await viewOf(await readEdit(id));
    expect(view).toMatchObject({ head: 1, shown: 1, edit: TAKE_FIRST, undo: null, redo });
    expect(view.turns.map((each) => each.n)).toEqual([1]);
    const again = await readFor(id);
    expect(await commitTurn(again.service, again.edit, again.turns, turn("change", BIGGER_EDIT, "again"))).toMatchObject({ head: 2 });
    expect(stored(id)).toEqual([[1, "cut", "house"], [2, "change", "again"]]);
    expect(await rests(id)).toBe(true);
  });
});

describe("a first cut stopped after its turn is written", () => {
  it("leaves no cut shown and nowhere for Redo to go (R21), and the first cut made again takes its place", async () => {
    const { id } = seedEdit(w.world);
    const { service, edit, turns } = await readFor(id);
    w.world.rest.failing = ({ method, table }) => method === "PATCH" && table === "edits";
    await expect(commitTurn(service, edit, turns, turn("cut", TAKE_FIRST, "house"), { look: "house", title: "Stop scrolling" })).rejects.toThrow("the edit's head could not be moved");
    w.world.rest.failing = null;
    expect(stored(id)).toEqual([[1, "cut", "house"]]);
    expect(w.world.rest.row("edits", id)).toMatchObject({ head: null, look: null, title: "IMG_0042" });
    const view = await viewOf(await readEdit(id));
    expect(view).toMatchObject({ head: null, shown: null, edit: null, look: null, title: "IMG_0042", undo: null, redo: null, turns: [], export: null });
    expect(view.take).toMatchObject({ id: TAKE, status: "ready" });
    // The take cannot be changed under the turn that holds its cut.
    w.world.rest.put("edit_takes", uploadingTake({ id: SECOND, source_path: keyOf("source", SECOND) }));
    expect((await retake(post(`/api/edit/edits/${id}/take`, { take: SECOND }), by(id))).status).toBe(409);
    const again = await readFor(id);
    expect(await commitTurn(again.service, again.edit, again.turns, turn("cut", BIGGER_EDIT, "bold-pop"), { look: "bold-pop", title: "Stop scrolling" })).toMatchObject({ head: 1, look: "bold-pop", title: "Stop scrolling" });
    expect(stored(id)).toEqual([[1, "cut", "bold-pop"]]);
    expect(await docOf(again.service, id, 1)).toEqual(BIGGER_EDIT);
  });
});

describe("the edit a turn holds (docOf)", () => {
  it("throws for a turn that holds none, and for a turn that is not there", async () => {
    const { id } = seedEdit(w.world, { turns: [CUT, { kind: "said", doc: null }] });
    const service = w.world.service();
    expect(await docOf(service, id, 1)).toEqual(TAKE_FIRST);
    await expect(docOf(service, id, 2)).rejects.toThrow("turn 2 holds no edit");
    await expect(docOf(service, id, 3)).rejects.toThrow("turn 3 holds no edit");
  });
});

describe("the export of the turn shown", () => {
  const film = `u/${USER}/films/${JOB}.mp4`;

  it("is live while its job is at work, and shown with no film yet", async () => {
    w.world.rest.put("edit_jobs", render());
    const { id } = seedEdit(w.world, { turns: [CUT], exportJob: JOB, exportTurn: 1 });
    const { who, service, edit } = await readFor(id);
    expect(await exportLive(who, service, edit)).toBe(true);
    expect((await viewOf(await readEdit(id))).export).toEqual({ job: JOB, turn: 1, status: "running", stage: "rendering", progress: 0.4, error: null, filmUrl: null, ms: null });
  });

  it("is over once the film is made, which comes with a fresh address that saves it as a file", async () => {
    w.world.rest.put("edit_jobs", render({ status: "done", stage: null, progress: 1, result: { path: film, cover: `u/${USER}/films/${JOB}.jpg`, ms: 7400 } }));
    const { id } = seedEdit(w.world, { turns: [CUT], exportJob: JOB, exportTurn: 1 });
    const { who, service, edit } = await readFor(id);
    expect(await exportLive(who, service, edit)).toBe(false);
    const shown = (await viewOf(await readEdit(id))).export;
    expect(shown).toMatchObject({ job: JOB, turn: 1, status: "done", progress: 1, ms: 7400 });
    expect(keyAt(shown?.filmUrl ?? null)).toBe(`/${BUCKET}/${film}`);
    expect(new URL(shown?.filmUrl ?? "").searchParams.get("response-content-disposition")).toBe('attachment; filename="video.mp4"');
  });

  it("is over, and written failed, once its job has stopped", async () => {
    w.world.rest.put("edit_jobs", render({ updated_at: new Date(Date.now() - STALE_MS - 1000).toISOString() }));
    const { id } = seedEdit(w.world, { turns: [CUT], exportJob: JOB, exportTurn: 1 });
    const { who, service, edit } = await readFor(id);
    expect(await exportLive(who, service, edit)).toBe(false);
    expect(w.world.rest.row("edit_jobs", JOB)).toMatchObject({ status: "failed", error: "the worker stopped" });
    expect((await viewOf(await readEdit(id))).export).toMatchObject({ status: "failed", error: "the worker stopped", filmUrl: null });
  });

  it("is not shown for another turn than the one shown, nor without one", async () => {
    w.world.rest.put("edit_jobs", render({ status: "done", stage: null, progress: 1, result: { path: film, ms: 7400 } }));
    const { id } = seedEdit(w.world, { turns: [CUT, CHANGE], exportJob: JOB, exportTurn: 1 });
    expect((await viewOf(await readEdit(id))).export).toBeNull();
    const none = seedEdit(w.world, { turns: [CUT] });
    const { who, service, edit } = await readFor(none.id);
    expect(await exportLive(who, service, edit)).toBe(false);
  });

  it("answers a plain 500 for a film kept outside the creator's films", async () => {
    w.world.rest.put("edit_jobs", render({ status: "done", stage: null, progress: 1, result: { path: `u/${OTHER}/films/${JOB}.mp4`, ms: 7400 } }));
    const { id } = seedEdit(w.world, { turns: [CUT], exportJob: JOB, exportTurn: 1 });
    const refused = await readEdit(id);
    expect(refused.status).toBe(500);
    expect(await refused.json()).toEqual({ error: "something went wrong" });
    expect(w.errorsLogged()).toContain("its film is kept outside the creator's films");
  });
});
