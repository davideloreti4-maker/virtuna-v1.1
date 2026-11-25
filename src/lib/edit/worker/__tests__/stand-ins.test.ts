/**
 * stand-ins.test.ts — the REST stand-in holds the editor's tables as the migration has them (plan 2026-11-24-editor-screens-a,
 * Task 1): a turn keyed on its edit and number, an edit only on its creator's take, numbers ordered and compared as numbers,
 * and a session that reads its own edits and writes nothing. And, so that a route cannot pass here and fail on the database:
 * the tables' checks and the columns that may not be null on a write and on an update, the keys' cascades on a delete, and
 * `updated_at` only where a table has it.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { OTHER, TAKE, USER, jobRow, takeRow } from "./rows";
import { standIns } from "./stand-ins";

async function withEdit() {
  const world = standIns();
  world.rest.put("edit_takes", takeRow());
  const service = world.service();
  const made = await service.from("edits").insert({ user_id: USER, take_id: TAKE, title: "Good morning" }).select().single();
  if (made.error) throw new Error(made.error.message);
  return { world, service, edit: made.data };
}

/**
 * A first cut's turn of an edit, with what a test changes. Typed loosely: some of these rows the types refuse too, and the
 * table must refuse them on its own.
 */
const turn = (edit: { id: string }, over: Record<string, unknown> = {}) => ({ edit_id: edit.id, n: 1, kind: "cut", say: "Captions are on.", doc: {}, ...over }) as never;

/** The code the database answered a write with, or null when it took it. */
const code = async (asked: PromiseLike<{ error: { code: string } | null }>) => (await asked).error?.code ?? null;

describe("the stand-in's edits and turns", () => {
  it("refuses a second turn of the same number, as the key does", async () => {
    const { service, edit } = await withEdit();
    const turn = { edit_id: edit.id, n: 1, kind: "cut", say: "Captions are on.", doc: {} }; // a cut holds a doc, as the table's check has it
    expect((await service.from("edit_turns").insert(turn)).error).toBeNull();
    expect((await service.from("edit_turns").insert(turn)).error?.code).toBe("23505");
  });

  it("orders turns and compares their numbers as numbers", async () => {
    const { service, edit } = await withEdit();
    for (let n = 1; n <= 12; n++) await service.from("edit_turns").insert({ edit_id: edit.id, n, kind: "change", say: `turn ${n}`, doc: { n } });
    const read = await service.from("edit_turns").select("n").eq("edit_id", edit.id).order("n", { ascending: true });
    expect(read.data?.map((row) => row.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    await service.from("edit_turns").delete().eq("edit_id", edit.id).gte("n", 10);
    const left = await service.from("edit_turns").select("n").eq("edit_id", edit.id).gt("n", 8);
    expect(left.data?.map((row) => row.n)).toEqual([9]);
  });

  it("gives a turn no id of its own and an edit the migration's defaults", async () => {
    const { world, service, edit } = await withEdit();
    await service.from("edit_turns").insert({ edit_id: edit.id, n: 1, kind: "said", say: "I left the video as it is." });
    expect(world.rest.tables.edit_turns[0]).not.toHaveProperty("id");
    expect(world.rest.tables.edit_turns[0]).toMatchObject({ request: null, at: null, findings: [], kept: [], doc: null });
    expect(edit).toMatchObject({ thread_id: null, look: null, style: null, head: null, export_job: null, export_turn: null });
  });

  it("refuses an edit on another creator's take", async () => {
    const { service } = await withEdit();
    const made = await service.from("edits").insert({ user_id: OTHER, take_id: TAKE, title: "Not theirs" });
    expect(made.error?.code).toBe("23503");
  });

  it("lets a session read its own edits and write none", async () => {
    const { world, edit } = await withEdit();
    const session = world.session({ id: USER });
    expect((await session.from("edits").select("id").eq("id", edit.id)).data).toEqual([{ id: edit.id }]);
    expect((await world.session({ id: OTHER }).from("edits").select("id").eq("id", edit.id)).data).toEqual([]);
    expect((await session.from("edits").update({ head: 1 }).eq("id", edit.id)).error?.code).toBe("42501");
  });

  it("holds threads and messages for the edit's chat", async () => {
    const { service } = await withEdit();
    const thread = await service.from("threads").insert({ type: "open", reading_id: null, user_id: USER }).select("*").single();
    expect(thread.data).toMatchObject({ title: null, sim_seals: {}, type: "open" });
    const message = await service.from("messages").insert({ thread_id: thread.data!.id, role: "assistant", body: [] }).select("*").single();
    expect(message.error).toBeNull();
  });
});

describe("the stand-in's checks, as the migration has them", () => {
  it("refuses a said turn with a doc, and any other turn without one", async () => {
    const { world, service, edit } = await withEdit();
    expect(await code(service.from("edit_turns").insert(turn(edit, { kind: "said" })))).toBe("23514");
    for (const kind of ["cut", "change", "direct"]) expect(await code(service.from("edit_turns").insert(turn(edit, { kind, doc: null })))).toBe("23514");
    expect(world.rest.tables.edit_turns).toEqual([]);
    expect(await code(service.from("edit_turns").insert(turn(edit)))).toBeNull();
    expect(await code(service.from("edit_turns").update({ doc: null }).eq("edit_id", edit.id))).toBe("23514");
    expect(world.rest.tables.edit_turns[0]?.doc).toEqual({});
  });

  it("refuses a kind the table does not know", async () => {
    const { service, edit } = await withEdit();
    expect(await code(service.from("edit_turns").insert(turn(edit, { kind: "undo" })))).toBe("23514");
    expect(await code(service.from("edit_turns").insert(turn(edit, { kind: "direct" })))).toBeNull();
    expect(await code(service.from("edit_turns").update({ kind: "undo" }).eq("edit_id", edit.id))).toBe("23514");
  });

  it("refuses a turn's number, an edit's head and its export's turn outside 1 to 300", async () => {
    const { world, service, edit } = await withEdit();
    for (const n of [0, 301]) expect(await code(service.from("edit_turns").insert(turn(edit, { n })))).toBe("23514");
    expect(await code(service.from("edit_turns").insert(turn(edit, { n: 300 })))).toBeNull();
    expect(await code(service.from("edits").insert({ user_id: USER, take_id: TAKE, title: "Let us begin", head: 301 }))).toBe("23514");
    expect(await code(service.from("edits").update({ head: 0 }).eq("id", edit.id))).toBe("23514");
    expect(await code(service.from("edits").update({ head: 301 }).eq("id", edit.id))).toBe("23514");
    expect(await code(service.from("edits").update({ export_turn: 0 }).eq("id", edit.id))).toBe("23514");
    expect(await code(service.from("edits").update({ export_turn: 301 }).eq("id", edit.id))).toBe("23514");
    expect(await code(service.from("edits").update({ head: 300, export_turn: 1 }).eq("id", edit.id))).toBeNull();
    expect(world.rest.row("edits", edit.id)).toMatchObject({ head: 300, export_turn: 1 });
  });

  it("refuses a look that is not written as a preset's id is", async () => {
    const { world, service, edit } = await withEdit();
    for (const look of ["Clean Bold", "9-lives", "", "a".repeat(41)]) expect(await code(service.from("edits").update({ look }).eq("id", edit.id))).toBe("23514");
    expect(await code(service.from("edits").insert({ user_id: USER, take_id: TAKE, title: "Let us begin", look: "Clean" }))).toBe("23514");
    expect(await code(service.from("edits").update({ look: "clean-bold" }).eq("id", edit.id))).toBeNull();
    expect(await code(service.from("edits").update({ look: "a".repeat(40) }).eq("id", edit.id))).toBeNull();
    expect(await code(service.from("edits").update({ look: null }).eq("id", edit.id))).toBeNull();
    expect(world.rest.row("edits", edit.id)?.look).toBeNull();
  });

  it("refuses a title of no letters, or of more than 200", async () => {
    const { world, service, edit } = await withEdit();
    expect(await code(service.from("edits").insert({ user_id: USER, take_id: TAKE, title: "" }))).toBe("23514");
    expect(await code(service.from("edits").update({ title: "a".repeat(201) }).eq("id", edit.id))).toBe("23514");
    expect(world.rest.row("edits", edit.id)?.title).toBe("Good morning");
    expect(await code(service.from("edits").update({ title: "a".repeat(200) }).eq("id", edit.id))).toBeNull();
  });

  it("refuses a request of more than 500 letters, and a frame past the longest film's last", async () => {
    const { service, edit } = await withEdit();
    expect(await code(service.from("edit_turns").insert(turn(edit, { request: "a".repeat(501) })))).toBe("23514");
    for (const at of [-1, 5401]) expect(await code(service.from("edit_turns").insert(turn(edit, { at })))).toBe("23514");
    expect(await code(service.from("edit_turns").insert(turn(edit, { request: "a".repeat(500), at: 5400 })))).toBeNull();
  });

  it("refuses a turn with no sentence and an edit with no title", async () => {
    const { world, service, edit } = await withEdit();
    expect(await code(service.from("edit_turns").insert(turn(edit, { say: undefined })))).toBe("23502");
    expect(await code(service.from("edit_turns").insert(turn(edit, { say: null })))).toBe("23502");
    expect(await code(service.from("edit_turns").insert(turn(edit, { findings: null })))).toBe("23502");
    expect(await code(service.from("edits").insert({ user_id: USER, take_id: TAKE } as never))).toBe("23502");
    expect(await code(service.from("edits").update({ title: null } as never).eq("id", edit.id))).toBe("23502");
    expect(world.rest.tables.edit_turns).toEqual([]);
    expect(world.rest.tables.edits).toHaveLength(1);
  });

  it("refuses a turn of an edit that is not there", async () => {
    const { world, service } = await withEdit();
    expect(await code(service.from("edit_turns").insert(turn({ id: randomUUID() })))).toBe("23503");
    expect(world.rest.tables.edit_turns).toEqual([]);
  });

  it("keeps nothing of a statement one row of which is refused", async () => {
    const { world, service, edit } = await withEdit();
    expect(await code(service.from("edit_turns").insert([turn(edit), turn(edit, { n: 2, kind: "undo" })]))).toBe("23514");
    expect(world.rest.tables.edit_turns).toEqual([]);
    await service.from("edit_turns").insert([turn(edit), turn(edit, { n: 2, kind: "said", say: "I left the video as it is.", doc: null })]);
    // One update of both turns: the second would be an answer that holds a doc.
    expect(await code(service.from("edit_turns").update({ doc: { changed: true } }).eq("edit_id", edit.id))).toBe("23514");
    expect(world.rest.tables.edit_turns.map((row) => row.doc)).toEqual([{}, null]);
  });

  it("checks only what an update sets, so a row a test put in can still be moved on", async () => {
    const { world, service } = await withEdit();
    // A row the table would not hold (no such take, no title): a fixture's, put in past the checks.
    const loose = world.rest.put("edits", { user_id: USER, take_id: randomUUID(), title: "" });
    expect(await code(service.from("edits").update({ head: 2 }).eq("id", String(loose.id)))).toBeNull();
    expect(loose.head).toBe(2);
    expect(await code(service.from("edits").update({ title: "" }).eq("id", String(loose.id)))).toBe("23514");
  });
});

describe("the stand-in's deletes, as the migration's keys have them", () => {
  it("drops an edit's turns with it, and no other edit's", async () => {
    const { world, service, edit } = await withEdit();
    const other = await service.from("edits").insert({ user_id: USER, take_id: TAKE, title: "Let us begin" }).select().single();
    await service.from("edit_turns").insert([turn(edit), turn(edit, { n: 2 }), turn(other.data!)]);
    await service.from("edits").delete().eq("id", edit.id);
    expect(world.rest.tables.edit_turns.map((row) => row.edit_id)).toEqual([other.data!.id]);
  });

  it("drops a take's edits, and their turns, with it", async () => {
    const { world, service, edit } = await withEdit();
    const second = randomUUID();
    world.rest.put("edit_takes", takeRow({ id: second }));
    const kept = await service.from("edits").insert({ user_id: USER, take_id: second, title: "Let us begin" }).select().single();
    await service.from("edit_turns").insert([turn(edit), turn(kept.data!)]);
    await service.from("edit_takes").delete().eq("id", TAKE);
    expect(world.rest.tables.edits.map((row) => row.id)).toEqual([kept.data!.id]);
    expect(world.rest.tables.edit_turns.map((row) => row.edit_id)).toEqual([kept.data!.id]);
  });

  it("lets an edit go of an export's job and of a chat that are deleted", async () => {
    const { world, service, edit } = await withEdit();
    const job = world.rest.put("edit_jobs", jobRow({ kind: "render", take_id: null }));
    const thread = world.rest.put("threads", { user_id: USER, type: "open" });
    await service.from("edits").update({ export_job: String(job.id), export_turn: 1, thread_id: String(thread.id) }).eq("id", edit.id);
    await service.from("edit_jobs").delete().eq("id", String(job.id));
    await service.from("threads").delete().eq("id", String(thread.id));
    expect(world.rest.row("edits", edit.id)).toMatchObject({ export_job: null, thread_id: null, export_turn: 1 });
  });
});

describe("the stand-in's columns, as the tables have them", () => {
  it("gives a turn and a message no updated_at, on a write or on an update", async () => {
    const { world, service, edit } = await withEdit();
    await service.from("edit_turns").insert(turn(edit));
    await service.from("edit_turns").update({ kept: ["a finding"] }).eq("edit_id", edit.id);
    const thread = await service.from("threads").insert({ type: "open", user_id: USER }).select().single();
    const message = await service.from("messages").insert({ thread_id: thread.data!.id, role: "user" }).select().single();
    await service.from("messages").update({ role: "assistant" }).eq("id", message.data!.id);
    expect(world.rest.tables.edit_turns[0]).toMatchObject({ kept: ["a finding"] });
    expect(world.rest.tables.edit_turns[0]).not.toHaveProperty("updated_at");
    expect(world.rest.tables.messages[0]).toMatchObject({ role: "assistant" });
    expect(world.rest.tables.messages[0]).not.toHaveProperty("updated_at");
  });

  it("stamps an edit's updated_at on every update, and leaves a thread's to the app", async () => {
    const { world, service } = await withEdit();
    const then = "2026-11-21T10:00:00.000Z";
    const edit = world.rest.put("edits", { user_id: USER, take_id: TAKE, title: "Let us begin", updated_at: then });
    const thread = world.rest.put("threads", { user_id: USER, type: "open", updated_at: then });
    await service.from("edits").update({ head: 1 }).eq("id", String(edit.id));
    await service.from("threads").update({ title: "Let us begin" }).eq("id", String(thread.id));
    expect(edit.updated_at).not.toBe(then);
    expect(thread).toMatchObject({ title: "Let us begin", updated_at: then });
  });

  it("gives a thread no type of its own: the column has no default", async () => {
    const { world, service } = await withEdit();
    expect(await code(service.from("threads").insert({ user_id: USER } as never))).toBe("23502");
    expect(world.rest.tables.threads).toEqual([]);
  });
});
