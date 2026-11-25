/**
 * edit-turns.test.ts — the editor's turns (plan 2026-11-24-editor-screens-a, Task 7; spec §6, §7, E2, E5, E9; rulings R9, R13,
 * R16, R18, R19, R21, R22): the first cut and a cut in another look, a change, a word fixed and captions set by hand, Undo and
 * Redo; two turns at once, none while the export runs, and what each route asks before it works. Real routes, door, review,
 * first cut, loop and turns' rules; stand-ins at the network and the model only.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

import { MAX_FRAMES, analysisOf, applyOps, filmFrames, type Asset, type Edit, type Op } from "@/lib/edit";
import { agentDeps } from "@/lib/edit/agent/deps";
import type { EditView } from "@/lib/edit/edit-view";
import { findingKey } from "@/lib/edit/kept";
import { review, type Finding } from "@/lib/edit/review";
import { firstCutLine } from "@/lib/edit/said";
import { HOUSE_STYLE } from "@/lib/edit/style/house";
import { presetOf } from "@/lib/edit/style/presets";
import { firstEdit } from "@/lib/edit/worker/takes";
import { OTHER, TAKE, USER, keyOf, uploadingTake } from "@/lib/edit/worker/__tests__/rows";
import { holdAgent } from "../creator";
import { POST as cutRoute } from "../edits/[id]/cut/route";
import { POST as changeRoute } from "../edits/[id]/change/route";
import { POST as opsRoute } from "../edits/[id]/ops/route";
import { POST as headRoute } from "../edits/[id]/head/route";
import { POST as keptRoute } from "../edits/[id]/kept/route";
import { POST as retake } from "../edits/[id]/take/route";
import { BIGGER, NO_CHANGE, TAKE_ASSET, TAKE_FIRST, answer, by, changeOf, chose, cutOf, post, readyTake, seedEdit, through, wireEditWorld, type Seeded } from "./edit-world";

const w = wireEditWorld();
const SECOND = "44444444-4444-4444-8444-444444444444";
const TITLE = "Stop scrolling this changes everything";
/** The sentences the routes refuse with, written out: a change of their words is seen here. */
const UNREAD = "The editor could not read this call.";
const BUSY = "The editor is already working on a call of yours; try again when it is done.";
const EXPORTING = "Your video is being made; the edit holds still until it is done or cancelled.";
const CHANGED = "The edit changed while this was being made. Try again.";
const NO_CUT = "There is no cut of this edit yet.";
const FULL = "This edit has 300 changes, the most one edit keeps.";
const DIRECT_ONLY = "Only a word or the captions can be changed here.";
const NOT_MADE = "That change could not be made.";
const NO_VERSION = "There is no such version of this edit.";
const MOMENT = "That moment is not in this video.";
const NOT_TO_CHECK = "That is not among the things to check.";
/** The opening of the moment's block: the creator paused here and the request is about it (S13 a). */
const PAUSED_HERE = "The creator paused the video here, and the request is about this moment:";

const cut = (id: string, body: unknown = {}) => cutRoute(post(`/api/edit/edits/${id}/cut`, body), by(id));
const ask = (id: string, request: string, more: Record<string, unknown> = {}) => changeRoute(post(`/api/edit/edits/${id}/change`, { request, ...more }), by(id));
const ops = (id: string, list: unknown[]) => opsRoute(post(`/api/edit/edits/${id}/ops`, { ops: list }), by(id));
const move = (id: string, n: number) => headRoute(post(`/api/edit/edits/${id}/head`, { n }), by(id));
const keep = (id: string, finding: unknown) => keptRoute(post(`/api/edit/edits/${id}/kept`, { finding }), by(id));
const viewOf = async (response: Response): Promise<EditView> => {
  if (response.status !== 200) throw new Error(`${response.status} ${await response.text()}`);
  return (await response.json()) as EditView;
};
const refusal = async (response: Response) => ({ status: response.status, ...((await response.json()) as object) });
const turnNumbers = (id: string) => w.world.rest.tables.edit_turns.filter((turn) => turn.edit_id === id).map((turn) => turn.n);
const rowOf = (id: string) => w.world.rest.row("edits", id);
const turnRow = (id: string, n: number) => w.world.rest.tables.edit_turns.find((turn) => turn.edit_id === id && turn.n === n);
const chatOf = (threadId: string) => w.world.rest.row("threads", threadId);
/** The edit's row and its turns, as the table holds them: the same text before and after means nothing was written. */
const held = (id: string) => JSON.stringify([rowOf(id), w.world.rest.tables.edit_turns.filter((turn) => turn.edit_id === id)]);
/** A running render, as the edit's export. */
const runningExport = () => w.world.rest.put("edit_jobs", { user_id: USER, kind: "render", status: "running", updated_at: new Date().toISOString() });
/** An edit of these turns whose export, of its last turn, is at work. */
const exportingEdit = (turns: Seeded[]) => seedEdit(w.world, { turns, exportJob: String(runningExport().id), exportTurn: turns.length });
/**
 * A seeded edit, last written a minute ago, as an edit is when a call reads it. The stand-in's clock counts in milliseconds, so
 * without it a write made in the same millisecond as the seed would carry the seed's own stamp.
 */
function aged(seeded: { id: string; threadId: string }) {
  const row = rowOf(seeded.id);
  if (row) row.updated_at = row.created_at = new Date(Date.now() - 60_000).toISOString();
  return seeded;
}
/** Holds the agent as a call of the creator's does, for as long as `work` takes; let go however it ends. */
async function whileBusy<T>(work: () => Promise<T>): Promise<T> {
  const release = holdAgent(USER);
  if (!release) throw new Error("the agent is still held by a call that ended");
  try {
    return await work();
  } finally {
    release();
  }
}
/** An answer of the model's that waits: `asked` when the model has been asked, `open` to let it answer. */
function gated() {
  let open!: () => void;
  let told!: () => void;
  const gate = new Promise<void>((resolve) => (open = resolve));
  const asked = new Promise<void>((resolve) => (told = resolve));
  return { gate, told, asked, open };
}
const CUT: Seeded = { kind: "cut", doc: TAKE_FIRST, request: "house" };
const BIGGER_EDIT = through(TAKE_FIRST, [{ op: "captions.set", size: 96 }]);
/** A line with an answer that changed nothing in it: its runs end at turns 1, 3 and 4 (R9). */
const line = (): Seeded[] => [
  CUT,
  { kind: "change", doc: BIGGER_EDIT, request: "Bigger captions" },
  { kind: "said", doc: null, request: "Make it pop" },
  { kind: "direct", doc: through(BIGGER_EDIT, [{ op: "word.set", asset: TAKE, index: 0, text: "Halt" }]) },
];

describe("POST …/cut", () => {
  it("makes the first cut in the house style, says it by code, and names the edit and its chat from the take's words", async () => {
    const { id, threadId } = seedEdit(w.world);
    const { model } = w.boundaries();
    const expected = await cutOf();
    const view = await viewOf(await cut(id));
    expect(view).toMatchObject({ head: 1, shown: 1, look: "house", undo: null, redo: null, title: TITLE });
    expect(view.edit).toEqual(expected.edit);
    expect(view.turns).toEqual([{ n: 1, kind: "cut", request: "house", at: null, say: firstCutLine(firstEdit(TAKE_ASSET), expected.edit), doc: true, findings: expected.findings, kept: [] }]);
    expect(chatOf(threadId)).toMatchObject({ title: TITLE });
    expect(rowOf(id)).toMatchObject({ head: 1, look: "house", title: TITLE });
    expect(rowOf(id)?.style).toEqual(JSON.parse(JSON.stringify(HOUSE_STYLE)));
    expect(model.calls[0]).toBe("cut");
  });

  it("cuts again in a preset after changes: a new turn, the changes kept behind Undo, the title kept", async () => {
    const { id, threadId } = seedEdit(w.world, { turns: [CUT, { kind: "change", doc: BIGGER_EDIT, request: "Bigger captions" }] });
    w.boundaries();
    const view = await viewOf(await cut(id, { style: { preset: "clean" } }));
    expect(view).toMatchObject({ head: 3, shown: 3, look: "clean", undo: 2, title: "IMG_0042" });
    expect(view.edit?.captions.look).toBe(presetOf("clean")!.profile.captions.look);
    expect(view.turns[2]).toMatchObject({ n: 3, kind: "cut", request: "clean", doc: true });
    expect(chatOf(threadId)).toMatchObject({ title: null }); // only the first cut names the chat
  });

  describe("after words fixed by hand (E9, changed by R31)", () => {
    const fix = (index: number, text: string): Op => ({ op: "word.set", asset: TAKE, index, text });
    const reviewed = (edit: Edit) => review(edit, { [TAKE]: analysisOf(readyTake()) });

    it("carries every word fixed by hand on the line into the new cut, through the door, by the take's own word", async () => {
      const fixed = through(TAKE_FIRST, [fix(0, "Halt")]);
      const again = through(fixed, [fix(4, "every"), fix(0, "Hold"), { op: "captions.set", on: false }]);
      const { id } = seedEdit(w.world, { turns: [CUT, { kind: "direct", doc: fixed }, { kind: "said", doc: null }, { kind: "direct", doc: again }] });
      w.boundaries();
      const expected = await cutOf(presetOf("clean")!.profile);
      const carried = through(expected.edit, [fix(0, "Hold"), fix(4, "every")]);
      const view = await viewOf(await cut(id, { style: { preset: "clean" } }));
      expect(view).toMatchObject({ head: 5, shown: 5, look: "clean", undo: 4 });
      expect(view.edit).toEqual(carried);
      expect(view.turns[4]).toEqual({ n: 5, kind: "cut", request: "clean", at: null, say: firstCutLine(firstEdit(TAKE_ASSET), carried), doc: true, findings: reviewed(carried), kept: [] });
      // Captions turned off by hand are no fact about the take: the look's own stand.
      expect(view.edit?.captions.on).toBe(expected.edit.captions.on);
      // Undo brings the edit before the cut back, as it was.
      expect((await viewOf(await move(id, 4))).edit).toEqual(again);
    });

    it("carries none that was undone, and drops one whose word the new cut does not hold, saying nothing of it", async () => {
      const undone = seedEdit(w.world, { turns: [CUT, { kind: "direct", doc: through(TAKE_FIRST, [fix(0, "Halt")]) }], head: 1 });
      w.boundaries();
      const expected = await cutOf();
      expect((await viewOf(await cut(undone.id))).edit).toEqual(expected.edit);

      // A line cut from the take as heard with one more word, fixed: the take holds no such word now.
      const heard = { ...TAKE_ASSET, words: [...(TAKE_ASSET.kind === "video" ? (TAKE_ASSET.words ?? []) : []), { text: "more", startMs: 7600, endMs: 7900 }] } as Asset;
      const first = firstEdit(heard);
      const made = applyOps(first, [fix(12, "More!")], [heard]);
      if (!made.ok) throw new Error("the door refused the seeded fix");
      const gone = seedEdit(w.world, { turns: [{ kind: "cut", doc: first, request: "house" }, { kind: "direct", doc: made.edit }] });
      w.boundaries();
      const view = await viewOf(await cut(gone.id));
      expect(view).toMatchObject({ head: 3, shown: 3 });
      expect(view.edit).toEqual(expected.edit);
    });
  });

  it("drops the turns after the head", async () => {
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST }, { kind: "change", doc: TAKE_FIRST }, { kind: "change", doc: TAKE_FIRST }], head: 1 });
    w.boundaries();
    expect((await viewOf(await cut(id))).turns.map((turn) => turn.n)).toEqual([1, 2]);
    expect(turnNumbers(id)).toEqual([1, 2]);
  });

  it("makes the first cut again when the first stopped half way: its left-over turn gives way (R21)", async () => {
    const { id, threadId } = seedEdit(w.world, { turns: [{ kind: "cut", doc: BIGGER_EDIT, request: "clean" }], head: null });
    Object.assign(rowOf(id) ?? {}, { look: null }); // as the stopped write left it: the turn written, the head and the look not
    w.boundaries();
    const expected = await cutOf();
    const view = await viewOf(await cut(id));
    expect(view).toMatchObject({ head: 1, shown: 1, look: "house", undo: null, redo: null, title: TITLE });
    expect(view.edit).toEqual(expected.edit);
    expect(view.turns.map((turn) => [turn.n, turn.kind, turn.request])).toEqual([[1, "cut", "house"]]);
    expect(turnNumbers(id)).toEqual([1]);
    expect(chatOf(threadId)).toMatchObject({ title: TITLE });
  });

  it("refuses a first cut whose take was changed while it was made, and leaves nothing of it: no turn, look, style or title (R19)", async () => {
    const { id, threadId } = aged(seedEdit(w.world));
    w.world.rest.put("edit_takes", readyTake({ id: SECOND, name: "second.mov" }));
    const model = gated();
    w.boundaries({ cut: [{ text: chose(), gate: model.gate, asked: model.told }] });
    const cutting = cut(id);
    await model.asked;
    expect((await retake(post(`/api/edit/edits/${id}/take`, { take: SECOND }), by(id))).status).toBe(200);
    model.open();
    expect(await refusal(await cutting)).toEqual({ status: 409, error: CHANGED });
    expect(turnNumbers(id)).toEqual([]);
    expect(rowOf(id)).toMatchObject({ head: null, take_id: SECOND, look: null, style: null, title: "second" });
    expect(chatOf(threadId)).toMatchObject({ title: null });
  });

  it("answers 502 when no style can be read from the words, writes nothing and lets the agent go; a style that is read is kept as the look `words`", async () => {
    const { id } = seedEdit(w.world);
    const { model } = w.boundaries({ words: ["not json", "still not json", JSON.stringify({ preset: "bold-pop", change: { zooms: "many", pace: "fast" }, named: false })] });
    expect(await refusal(await cut(id, { style: { words: "fast with zooms" } }))).toEqual({ status: 502, error: "The style could not be read from those words. Try other words or pick a preset." });
    expect(turnNumbers(id)).toEqual([]);
    expect(rowOf(id)).toMatchObject({ head: null, look: null, style: null, title: "IMG_0042" });
    const view = await viewOf(await cut(id, { style: { words: "fast with zooms" } }));
    expect(view).toMatchObject({ head: 1, shown: 1, look: "words" });
    expect(view.turns[0]).toMatchObject({ kind: "cut", request: "words" });
    expect(rowOf(id)?.style).toMatchObject({ source: { kind: "words" } });
    expect(model.calls.slice(0, 4)).toEqual(["words", "words", "words", "cut"]);
  });

  it("refuses while the export runs, while an agent call of theirs is live, and for a take not ready, asking the model nothing", async () => {
    const exporting = exportingEdit([CUT]);
    const { model } = w.boundaries();
    expect(await refusal(await cut(exporting.id))).toEqual({ status: 409, error: EXPORTING });
    const waiting = seedEdit(w.world, { take: uploadingTake({ id: SECOND, source_path: keyOf("source", SECOND) }) });
    // A busy creator is told so before the take is looked at, as the agent's route tells them (R16).
    expect(await whileBusy(async () => refusal(await cut(waiting.id)))).toEqual({ status: 409, error: BUSY });
    expect(await refusal(await cut(waiting.id))).toEqual({ status: 409, error: "That take has not finished uploading." });
    expect(model.calls).toEqual([]);
    expect(turnNumbers(exporting.id)).toEqual([1]);
    expect(turnNumbers(waiting.id)).toEqual([]);
  });

  it("404s another creator's edit, and 400s a style that is none", async () => {
    const { id } = seedEdit(w.world);
    const { model } = w.boundaries();
    expect(await refusal(await cut(id, { style: { preset: "nope" } }))).toEqual({ status: 400, error: "There is no preset of that name." });
    vi.stubEnv("EDIT_CREATORS", `${USER},${OTHER}`);
    w.signedIn = { id: OTHER };
    expect((await cut(id)).status).toBe(404);
    expect(model.calls).toEqual([]);
  });
});

describe("POST …/change", () => {
  it("makes the request on the edit shown and says what the agent said", async () => {
    const { edit } = await cutOf();
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: edit, request: "house" }] });
    const expected = await changeOf(edit, "make the captions bigger", { change: [answer("The captions are bigger now.", BIGGER)] });
    w.boundaries({ change: [answer("The captions are bigger now.", BIGGER)] });
    const view = await viewOf(await ask(id, "make the captions bigger", { at: 42 }));
    expect(view).toMatchObject({ head: 2, shown: 2, undo: 1, look: "house" });
    expect(view.edit).toEqual(expected.edit);
    expect(view.turns[1]).toEqual({ n: 2, kind: "change", request: "make the captions bigger", at: 42, say: "The captions are bigger now.", doc: true, findings: expected.findings, kept: [] });
  });

  it("sends the frame the video was paused on as the moment and keeps it on the turn; a frame off the film is refused, asking nothing (slice B, Task 2)", async () => {
    const { edit } = await cutOf();
    const frames = filmFrames(edit);
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: edit, request: "house" }] });
    const { model } = w.boundaries();
    /** The first user message of each call the model is asked. */
    const heard: string[] = [];
    const asked = agentDeps.ask;
    agentDeps.ask = async (messages, options) => {
      heard.push(String(messages[1]?.content));
      return asked(messages, options);
    };
    const before = held(id);
    for (const at of [frames, MAX_FRAMES]) expect(await refusal(await ask(id, "zoom in here", { at }))).toEqual({ status: 400, error: MOMENT });
    // Past the most frames a film may have, the body itself cannot be read.
    expect(await refusal(await ask(id, "zoom in here", { at: 9999 }))).toEqual({ status: 400, error: UNREAD });
    expect(model.calls).toEqual([]);
    expect(held(id)).toBe(before);

    const pausedOn = await viewOf(await ask(id, "zoom in here", { at: frames - 1 }));
    expect(heard[0]).toContain(`\n\nmoment:\n${PAUSED_HERE}`);
    expect(heard[0]).toContain(`\npaused frame=${frames - 1} of film ${frames}f:`);
    expect(pausedOn.turns.find((turn) => turn.n === 2)).toMatchObject({ request: "zoom in here", at: frames - 1 });
    const whole = await viewOf(await ask(id, "make it warmer"));
    expect(heard[1]).not.toContain("\nmoment:\n");
    expect(whole.turns.find((turn) => turn.n === 3)).toMatchObject({ request: "make it warmer", at: null });
    expect(heard).toHaveLength(2);
  });

  it("keeps an answer that changed nothing as said, the edit shown as it was, the head on the answer (R9)", async () => {
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST }] });
    w.boundaries({ change: [NO_CHANGE] });
    const view = await viewOf(await ask(id, "  make it better "));
    expect(view).toMatchObject({ head: 2, shown: 1, undo: null, redo: null });
    expect(view.edit).toEqual(TAKE_FIRST);
    expect(view.turns[1]).toMatchObject({ n: 2, kind: "said", request: "make it better", say: "I left the video as it is.", doc: false });
  });

  it("refuses the second of two turns made at once; the first lands", async () => {
    const { edit } = await cutOf();
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: edit }] });
    const model = gated();
    w.boundaries({ change: [{ text: answer("The captions are bigger now.", BIGGER), gate: model.gate, asked: model.told }] });
    const changing = ask(id, "make the captions bigger");
    await model.asked;
    const fixed = await viewOf(await ops(id, [{ op: "word.set", asset: TAKE, index: 0, text: "Stop!" }]));
    expect(fixed.head).toBe(2);
    model.open();
    expect(await refusal(await changing)).toEqual({ status: 409, error: CHANGED });
    expect(turnNumbers(id)).toEqual([1, 2]);
    expect(rowOf(id)).toMatchObject({ head: 2 });
    expect(w.world.rest.tables.edit_turns.find((turn) => turn.edit_id === id && turn.n === 2)).toMatchObject({ kind: "direct" }); // the one that landed
  });

  it("refuses a blank or a long request, an edit with no cut, and while the export runs, asking the model nothing", async () => {
    const none = seedEdit(w.world);
    const { model } = w.boundaries();
    expect(await refusal(await ask(none.id, "  "))).toEqual({ status: 400, error: "Say what to change." });
    expect(await refusal(await ask(none.id, "x".repeat(501)))).toEqual({ status: 400, error: "A request is at most 500 characters." });
    expect(await refusal(await ask(none.id, "shorter"))).toEqual({ status: 409, error: NO_CUT });
    const exporting = exportingEdit([{ kind: "cut", doc: TAKE_FIRST }]);
    expect(await refusal(await ask(exporting.id, "shorter"))).toEqual({ status: 409, error: EXPORTING });
    expect(model.calls).toEqual([]);
    expect(turnNumbers(exporting.id)).toEqual([1]);
  });

  it("tells a busy creator so before it looks at the edit or its take, as the agent's route does (R16)", async () => {
    const none = seedEdit(w.world, { take: uploadingTake() });
    const { model } = w.boundaries();
    expect(await whileBusy(async () => refusal(await ask(none.id, "shorter")))).toEqual({ status: 409, error: BUSY });
    expect(await refusal(await ask(none.id, "shorter"))).toEqual({ status: 409, error: NO_CUT });
    expect(model.calls).toEqual([]);
  });
});

describe("POST …/ops", () => {
  it("fixes a word with no agent and no wait, and says it", async () => {
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST }] });
    const { model } = w.boundaries();
    const view = await viewOf(await ops(id, [{ op: "word.set", asset: TAKE, index: 1, text: "strolling" }]));
    const fixed = through(TAKE_FIRST, [{ op: "word.set", asset: TAKE, index: 1, text: "strolling" }]);
    expect(view).toMatchObject({ head: 2, shown: 2, undo: 1, redo: null });
    expect(view.edit).toEqual(fixed);
    expect(view.turns[1]).toEqual({ n: 2, kind: "direct", request: null, at: null, say: 'Changed "scrolling" to "strolling".', doc: true, findings: review(fixed, { [TAKE]: analysisOf(readyTake()) }), kept: [] });
    expect(model.calls).toEqual([]);
  });

  it("fixes every place a word was heard at once, and turns captions off", async () => {
    const twice = through(TAKE_FIRST, [{ op: "word.set", asset: TAKE, index: 2, text: "Stop" }]);
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: twice }] });
    const all = await viewOf(await ops(id, [{ op: "word.set", asset: TAKE, index: 0, text: "Halt" }, { op: "word.set", asset: TAKE, index: 2, text: "Halt" }]));
    expect(all.turns[1]?.say).toBe('Changed "Stop" to "Halt" in 2 places.');
    const off = await viewOf(await ops(id, [{ op: "captions.set", on: false }]));
    expect(off.edit?.captions.on).toBe(false);
    expect(off.turns[2]?.say).toBe("Captions are off.");
  });

  it.each<[string, unknown[]]>([
    ["a word set to the text it has", [{ op: "word.set", asset: TAKE, index: 0, text: "Stop" }]],
    ["captions set to the state they are in", [{ op: "captions.set", on: true }]],
    ["both at once", [{ op: "captions.set", on: true }, { op: "word.set", asset: TAKE, index: 1, text: "scrolling" }]],
  ])("writes nothing for %s: the view as it stands, the Redo line whole, the export kept (R22)", async (_what, list) => {
    const film = w.world.rest.put("edit_jobs", { user_id: USER, kind: "render", status: "done", progress: 1 });
    const { id } = seedEdit(w.world, { turns: line(), head: 1, exportJob: String(film.id), exportTurn: 1 });
    const before = held(id);
    const view = await viewOf(await ops(id, list));
    expect(view).toMatchObject({ head: 1, shown: 1, undo: null, redo: 3 });
    expect(view.edit).toEqual(TAKE_FIRST);
    expect(view.turns.map((turn) => turn.n)).toEqual([1]);
    expect(view.export).toMatchObject({ job: film.id, turn: 1, status: "done" });
    expect(held(id)).toBe(before); // no turn written, none dropped, the head and the export where they were, the row not stamped
    expect(turnNumbers(id)).toEqual([1, 2, 3, 4]);
  });

  it("writes one turn for a real change beside one that changes nothing, and says the real one (R22)", async () => {
    const { id } = seedEdit(w.world, { turns: line(), head: 1 });
    const view = await viewOf(await ops(id, [{ op: "word.set", asset: TAKE, index: 0, text: "Stop" }, { op: "word.set", asset: TAKE, index: 1, text: "strolling" }]));
    expect(view).toMatchObject({ head: 2, shown: 2, undo: 1, redo: null });
    expect(view.edit).toEqual(through(TAKE_FIRST, [{ op: "word.set", asset: TAKE, index: 1, text: "strolling" }]));
    expect(view.turns[1]).toMatchObject({ n: 2, kind: "direct", say: 'Changed "scrolling" to "strolling".', doc: true });
    expect(turnNumbers(id)).toEqual([1, 2]); // the Redo line gave way to the one new turn
  });

  it("answers a change that changes nothing at the 300th turn too: nothing is written, so the cap is not met (R22)", async () => {
    const { id } = seedEdit(w.world, { turns: [CUT, ...Array.from({ length: 299 }, (): Seeded => ({ kind: "said", doc: null }))] });
    const before = held(id);
    expect(await viewOf(await ops(id, [{ op: "captions.set", on: true }]))).toMatchObject({ head: 300, shown: 1 });
    expect(held(id)).toBe(before);
  });

  it.each<[string, unknown]>([
    ["another operation", { op: "look.set", preset: "mono" }],
    ["a word hidden", { op: "word.set", asset: TAKE, index: 0, hidden: true }],
    ["a word stressed along with its text", { op: "word.set", asset: TAKE, index: 0, text: "Halt", stress: true }],
    ["a word with nothing set", { op: "word.set", asset: TAKE, index: 0 }],
    ["the captions' size", { op: "captions.set", size: 96 }],
    ["the captions' size along with on and off", { op: "captions.set", on: true, size: 96 }],
    ["the captions with nothing set", { op: "captions.set" }],
    ["what is no operation", "word.set"],
  ])("refuses %s, among ones it would make, before it reads the edit (R13)", async (_what, op) => {
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST }] });
    expect(await refusal(await ops(id, [{ op: "captions.set", on: false }, op]))).toEqual({ status: 400, error: DIRECT_ONLY });
    expect(w.world.rest.calls).toEqual([]);
    expect(turnNumbers(id)).toEqual([1]);
  });

  it("refuses a change the door refuses, with the door's reasons, and writes nothing", async () => {
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST }] });
    expect(await refusal(await ops(id, [{ op: "word.set", asset: TAKE, index: 99, text: "x" }]))).toMatchObject({ status: 400, error: NOT_MADE, problems: [{ path: "ops.0" }] });
    expect(await refusal(await ops(id, [{ op: "captions.set", on: "yes" }]))).toMatchObject({ status: 400, error: NOT_MADE, problems: [{ path: "ops.0.on" }] });
    expect(turnNumbers(id)).toEqual([1]);
    expect(rowOf(id)).toMatchObject({ head: 1 });
  });

  it("refuses an edit with no cut", async () => {
    const none = seedEdit(w.world);
    expect(await refusal(await ops(none.id, [{ op: "captions.set", on: false }]))).toEqual({ status: 409, error: NO_CUT });
    expect(turnNumbers(none.id)).toEqual([]);
  });
});

describe("POST …/head", () => {
  it("undoes to the end of the run before, the answer that changed nothing kept, and redoes back: a round trip (R9)", async () => {
    const turns = line();
    const { id } = seedEdit(w.world, { turns });
    const undone = await viewOf(await move(id, 3));
    expect(undone).toMatchObject({ head: 3, shown: 2, undo: 1, redo: 4 });
    expect(undone.turns.map((turn) => turn.n)).toEqual([1, 2, 3]);
    expect(undone.edit).toEqual(turns[1]!.doc);
    const first = await viewOf(await move(id, undone.undo!));
    expect(first).toMatchObject({ head: 1, shown: 1, undo: null, redo: 3 });
    expect(first.edit).toEqual(TAKE_FIRST);
    const back = await viewOf(await move(id, first.redo!));
    expect(back).toMatchObject({ head: 3, shown: 2, undo: 1, redo: 4 });
    const redone = await viewOf(await move(id, back.redo!));
    expect(redone).toMatchObject({ head: 4, shown: 4, undo: 3, redo: null });
    expect(redone.edit).toEqual(turns[3]!.doc);
    expect(turnNumbers(id)).toEqual([1, 2, 3, 4]); // a move drops nothing
  });

  it("leaves what comes after for Redo until a turn is made from there, which drops it", async () => {
    const { id } = seedEdit(w.world, { turns: line() });
    await viewOf(await move(id, 3));
    const off = await viewOf(await ops(id, [{ op: "captions.set", on: false }]));
    expect(off).toMatchObject({ head: 4, shown: 4, undo: 3, redo: null });
    expect(off.edit).toEqual(through(BIGGER_EDIT, [{ op: "captions.set", on: false }])); // made on the edit shown, turn 2's
    expect(off.turns.map((turn) => [turn.n, turn.kind])).toEqual([[1, "cut"], [2, "change"], [3, "said"], [4, "direct"]]);
    expect(turnNumbers(id)).toEqual([1, 2, 3, 4]);
  });

  it("names the look of the cut it lands on", async () => {
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST, request: "house" }, { kind: "cut", doc: TAKE_FIRST, request: "clean" }], look: "clean" });
    expect((await viewOf(await move(id, 1))).look).toBe("house");
    expect(rowOf(id)).toMatchObject({ head: 1, look: "house" });
    expect((await viewOf(await move(id, 2))).look).toBe("clean");
  });

  it("refuses a turn that is not the end of a run, and one that is not there", async () => {
    const { id } = seedEdit(w.world, { turns: line() });
    expect(await refusal(await move(id, 2))).toEqual({ status: 400, error: NO_VERSION }); // its answer, turn 3, would be left out
    expect(await refusal(await move(id, 5))).toEqual({ status: 400, error: NO_VERSION });
    expect(rowOf(id)).toMatchObject({ head: 4 });
  });

  it("refuses any move while there is no cut, a first cut's left-over turn included (R21)", async () => {
    const { id } = seedEdit(w.world, { turns: [CUT], head: null });
    expect(await refusal(await move(id, 1))).toEqual({ status: 409, error: NO_CUT });
    expect(rowOf(id)).toMatchObject({ head: null });
    const none = seedEdit(w.world);
    expect(await refusal(await move(none.id, 1))).toEqual({ status: 409, error: NO_CUT });
  });

  it.each([
    { what: "its head was moved", lands: () => ({ head: 1 }), left: { head: 1 } },
    { what: "its export was started", lands: () => ({ export_job: String(runningExport().id), export_turn: 4 }), left: { head: 4, export_turn: 4 } },
  ])("refuses a move made on an edit written since it was read ($what), and moves nothing (R19)", async ({ lands, left }) => {
    const { id } = aged(seedEdit(w.world, { turns: line() }));
    // The moment the route reads the turns, the other write lands: the stand-in's hook for a read to refuse, used to write in between.
    let landed = false;
    w.world.rest.failingRead = ({ table }) => {
      if (table === "edit_turns" && !landed) Object.assign(rowOf(id) ?? {}, lands(), { updated_at: new Date().toISOString() });
      landed ||= table === "edit_turns";
      return false;
    };
    expect(await refusal(await move(id, 3))).toEqual({ status: 409, error: CHANGED });
    expect(landed).toBe(true);
    expect(rowOf(id)).toMatchObject({ ...left, look: "house" });
  });
});

/** What the review finds on the first cut once its captions are bigger (`BIGGER`): they touch Instagram's bar in the shot `s1-t1`. */
const TOUCHING = "under-buttons s1-t1";
/** A finding seeded on a turn: the shot `s1` zoomed past its take's sharp limit. */
const SOFT: Finding = { code: "soft-zoom", severity: "warn", where: { frame: 0, shot: "s1" }, says: "shot \"s1\" at 0.0 s is zoomed to 2.00, more than twice its take's own pixels; zoom out to 1.33 or less" };

describe("POST …/kept (slice B, Task 8)", () => {
  /** The first cut, then its captions made bigger through the route: turn 2 finds them touching a bar. */
  async function bigger() {
    const { edit } = await cutOf();
    const seeded = seedEdit(w.world, { turns: [{ kind: "cut", doc: edit, request: "house" }] });
    w.boundaries({ change: [answer("The captions are bigger now.", BIGGER)] });
    const view = await viewOf(await ask(seeded.id, "make the captions bigger"));
    expect(view.turns[1]).toMatchObject({ n: 2, kind: "change", kept: [] });
    expect(view.turns[1]!.findings.map(findingKey)).toEqual([TOUCHING]);
    return seeded;
  }

  it("puts a finding of the turn shown away: the view answers it kept; no turn is written and the edit's row is not, so Undo and Redo stand", async () => {
    const { id } = await bigger();
    const row = JSON.stringify(rowOf(id));
    const view = await viewOf(await keep(id, TOUCHING));
    expect(view).toMatchObject({ head: 2, shown: 2, undo: 1, redo: null });
    expect(view.turns[1]).toMatchObject({ n: 2, kept: [TOUCHING] });
    expect(turnNumbers(id)).toEqual([1, 2]);
    expect(JSON.stringify(rowOf(id))).toBe(row);
    await viewOf(await move(id, 1));
    const redone = await viewOf(await move(id, 2));
    expect(redone.turns[1]).toMatchObject({ n: 2, kept: [TOUCHING] });
  });

  it("writes nothing for a finding already put away, and answers the view as it stands", async () => {
    const { id } = await bigger();
    await viewOf(await keep(id, TOUCHING));
    const before = held(id);
    const again = await viewOf(await keep(id, TOUCHING));
    expect(again.turns[1]).toMatchObject({ kept: [TOUCHING] });
    expect(held(id)).toBe(before);
    expect(w.world.rest.calls.filter((call) => call.method === "PATCH" && call.table === "edit_turns")).toHaveLength(1); // the first keep's
  });

  it("carries it into a change whose findings still hold it, by the agent or by hand, and an answer that changed nothing; drops it once it is gone", async () => {
    const { id } = await bigger();
    await viewOf(await keep(id, TOUCHING));
    w.boundaries({ change: [answer("It is quieter now.", [{ op: "shot.set", id: "s1", volume: 0.9 }]), NO_CHANGE, answer("The captions are back to their size.", [{ op: "captions.set", size: 64 }])] });
    const quieter = await viewOf(await ask(id, "make it quieter"));
    expect(quieter.turns[2]).toMatchObject({ n: 3, kind: "change", kept: [TOUCHING] });
    expect(quieter.turns[2]!.findings.map(findingKey)).toEqual([TOUCHING]);
    const fixed = await viewOf(await ops(id, [{ op: "word.set", asset: TAKE, index: 0, text: "Halt" }]));
    expect(fixed.turns[3]).toMatchObject({ n: 4, kind: "direct", kept: [TOUCHING] });
    const said = await viewOf(await ask(id, "make it better"));
    expect(said.turns[4]).toMatchObject({ n: 5, kind: "said", kept: [TOUCHING] });
    const back = await viewOf(await ask(id, "make the captions smaller again"));
    expect(back.turns[5]).toMatchObject({ n: 6, kind: "change", findings: [], kept: [] });
  });

  it("carries a keep that lands while a change is being made into the turn it makes (fix round 1)", async () => {
    const { id } = await bigger();
    const model = gated();
    w.boundaries({ change: [{ text: answer("It is quieter now.", [{ op: "shot.set", id: "s1", volume: 0.9 }]), gate: model.gate, asked: model.told }] });
    const changing = ask(id, "make it quieter");
    await model.asked;
    expect((await viewOf(await keep(id, TOUCHING))).turns[1]).toMatchObject({ n: 2, kept: [TOUCHING] });
    model.open();
    const quieter = await viewOf(await changing);
    expect(quieter.turns[2]).toMatchObject({ n: 3, kind: "change", kept: [TOUCHING] });
    expect(quieter.turns[2]!.findings.map(findingKey)).toEqual([TOUCHING]);
  });

  it("carries a keep that lands while a change by hand is being made into the turn it makes (fix round 1)", async () => {
    const { id } = await bigger();
    // The moment the route reads the edit shown, after it read the turns, a keep lands on the turn shown.
    let reads = 0;
    w.world.rest.failingRead = ({ table }) => {
      if (table === "edit_turns" && ++reads === 2) Object.assign(turnRow(id, 2) ?? {}, { kept: [TOUCHING] });
      return false;
    };
    const fixed = await viewOf(await ops(id, [{ op: "word.set", asset: TAKE, index: 0, text: "Halt" }]));
    expect(reads).toBeGreaterThanOrEqual(2);
    expect(fixed.turns[2]).toMatchObject({ n: 3, kind: "direct", kept: [TOUCHING] });
  });

  it("refuses a keep whose turn is gone by the time it is written, and writes it nowhere (409)", async () => {
    const { id } = seedEdit(w.world, { turns: [CUT, { kind: "change", doc: BIGGER_EDIT, findings: [SOFT] }] });
    // As the keep is written, the turn it read is no longer there (a turn made from an earlier head dropped it).
    w.world.rest.failing = ({ method, table }) => {
      const rows = w.world.rest.tables.edit_turns;
      if (method === "PATCH" && table === "edit_turns") rows.splice(rows.findIndex((row) => row.edit_id === id && row.n === 2), 1);
      return false;
    };
    expect(await refusal(await keep(id, "soft-zoom s1"))).toEqual({ status: 409, error: CHANGED });
    expect(turnNumbers(id)).toEqual([1]);
    expect(w.world.rest.tables.edit_turns.filter((row) => row.edit_id === id).map((row) => row.kept)).toEqual([[]]);
  });

  it("starts again with none put away on a cut in another look, though the new cut finds the same (ruling S2)", async () => {
    const { id } = await bigger();
    await viewOf(await keep(id, TOUCHING));
    const clean = await viewOf(await cut(id, { style: { preset: "clean" } }));
    expect(clean.turns[2]).toMatchObject({ n: 3, kind: "cut", request: "clean", kept: [] });
    expect(clean.turns[2]!.findings.map(findingKey)).toContain(TOUCHING);
  });

  it("puts it away on the turn shown when the head rests on an answer that changed nothing after it, and while the export runs", async () => {
    const found: Seeded = { kind: "change", doc: BIGGER_EDIT, findings: [SOFT] };
    const { id } = seedEdit(w.world, { turns: [CUT, found, { kind: "said", doc: null }] });
    const view = await viewOf(await keep(id, "soft-zoom s1"));
    expect(view).toMatchObject({ head: 3, shown: 2 });
    expect(view.turns.map((turn) => turn.kept)).toEqual([[], ["soft-zoom s1"], []]);
    // A keep changes no film: the file of the turn shown goes on being made.
    const exporting = exportingEdit([CUT, found]);
    const kept = await viewOf(await keep(exporting.id, "soft-zoom s1"));
    expect(kept.turns[1]).toMatchObject({ kept: ["soft-zoom s1"] });
    expect(kept.export).toMatchObject({ status: "running", turn: 2 });
  });

  it("refuses a finding the turn shown does not have, and an edit with no cut, writing nothing", async () => {
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST, findings: [SOFT] }, { kind: "change", doc: BIGGER_EDIT, findings: [] }] });
    const before = held(id);
    // The turn before the one shown found it; the turn shown did not.
    expect(await refusal(await keep(id, "soft-zoom s1"))).toEqual({ status: 400, error: NOT_TO_CHECK });
    expect(await refusal(await keep(id, "soft-zoom"))).toEqual({ status: 400, error: NOT_TO_CHECK });
    expect(held(id)).toBe(before);
    const none = seedEdit(w.world);
    expect(await refusal(await keep(none.id, "soft-zoom s1"))).toEqual({ status: 409, error: NO_CUT });
  });

  it("refuses the chin's warning, which is never put to the creator, and still puts away the face covered (S18)", async () => {
    const chin: Finding = { code: "on-face", severity: "warn", where: { frame: 5, shot: "s1" }, says: "the captions at 0.2 s touch the chin; move them up or down" };
    const face: Finding = { code: "on-face", severity: "error", where: { frame: 90, shot: "s1" }, says: "the captions at 3.0 s cover the mouth; move them up or down" };
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: TAKE_FIRST, findings: [chin, face] }] });
    const before = held(id);
    expect(await refusal(await keep(id, "on-face warn s1"))).toEqual({ status: 400, error: NOT_TO_CHECK });
    // A key written before the level was part of it matches nothing.
    expect(await refusal(await keep(id, "on-face s1"))).toEqual({ status: 400, error: NOT_TO_CHECK });
    expect(held(id)).toBe(before);
    expect((await viewOf(await keep(id, "on-face error s1"))).turns[0]).toMatchObject({ kept: ["on-face error s1"] });
  });
});

describe("the steps after a change (the view's `next`, slice B, Task 8)", () => {
  /** A push, as a zoom here makes one: the zoom step is offered after it (I1). */
  const ZOOM: Op[] = [{ op: "shot.set", id: "s1", framing: { from: { zoom: 1, x: 0, y: 0 }, move: { to: { zoom: 1.1, x: 0, y: 0 }, ease: "out", part: [0, 4] } } }];
  /** A still zoom: no move lowers it, so no zoom step (I1). */
  const STILL: Op[] = [{ op: "shot.set", id: "s1", framing: { from: { zoom: 1.1, x: 0, y: 0 }, move: null } }];

  it("are none after a still zoom: the code has no move for less (I1)", async () => {
    const { id } = seedEdit(w.world);
    w.boundaries({ change: [answer("Zoomed in.", STILL)] });
    await cut(id);
    const zoomed = await viewOf(await ask(id, "zoom in"));
    expect(zoomed).toMatchObject({ head: 2, shown: 2 });
    expect(zoomed.next).toEqual([]);
  });

  it("are none after the first cut; the zoom step after a change that pushed in, still with the head on an answer after it; none on Undo", async () => {
    const { id } = seedEdit(w.world);
    w.boundaries({ change: [answer("Zoomed in.", ZOOM), NO_CHANGE] });
    expect((await viewOf(await cut(id))).next).toEqual([]);
    const zoomed = await viewOf(await ask(id, "zoom in"));
    expect(zoomed).toMatchObject({ head: 2, shown: 2 });
    expect(zoomed.next).toEqual([{ kind: "zoom", label: "Zoom less", request: "Zoom in less here.", at: 0 }]);
    const said = await viewOf(await ask(id, "make it pop"));
    expect(said).toMatchObject({ head: 3, shown: 2 });
    expect(said.next).toEqual(zoomed.next);
    expect((await viewOf(await move(id, 1))).next).toEqual([]);
  });

  it("are smaller captions after bigger ones, and none after a change by hand", async () => {
    const { edit } = await cutOf();
    const { id } = seedEdit(w.world, { turns: [{ kind: "cut", doc: edit, request: "house" }] });
    w.boundaries({ change: [answer("The captions are bigger now.", BIGGER)] });
    expect((await viewOf(await ask(id, "make the captions bigger"))).next).toEqual([
      { kind: "captions", label: "Smaller captions", request: "Make the captions a little smaller.", at: null },
    ]);
    expect((await viewOf(await ops(id, [{ op: "captions.set", on: false }]))).next).toEqual([]);
  });
});

describe("each of the four, and the keep", () => {
  const ROUTES = [
    { name: "cut", route: cutRoute, body: {} },
    { name: "change", route: changeRoute, body: { request: "Shorter" } },
    { name: "ops", route: opsRoute, body: { ops: [{ op: "captions.set", on: false }] } },
    { name: "head", route: headRoute, body: { n: 1 } },
    { name: "kept", route: keptRoute, body: { finding: TOUCHING } },
  ];
  /** The four that change the film: they hold still while the export runs; a keep changes none. */
  const FILM = ROUTES.filter((each) => each.name !== "kept");
  const send = (name: string, id: string, body: unknown, type?: string) => ROUTES.find((each) => each.name === name)!.route(post(`/api/edit/edits/${id}/${name}`, body, type), by(id));

  it.each(ROUTES)("$name asks for a creator the editor is open to, a call from the app's own page, and an edit of theirs", async ({ name, body }) => {
    const { id } = seedEdit(w.world, { turns: [CUT, { kind: "change", doc: BIGGER_EDIT }] });
    const { model } = w.boundaries();
    const before = held(id);
    expect((await send(name, id, body, "text/plain")).status).toBe(415);
    expect(await refusal(await send(name, "nope", body))).toEqual({ status: 404, error: "no such edit" });
    expect(await refusal(await send(name, SECOND, body))).toEqual({ status: 404, error: "no such edit" });
    w.signedIn = null;
    expect((await send(name, id, body)).status).toBe(401);
    w.signedIn = { id: OTHER };
    expect((await send(name, id, body)).status).toBe(403);
    vi.stubEnv("EDIT_CREATORS", `${USER},${OTHER}`);
    expect(await refusal(await send(name, id, body))).toEqual({ status: 404, error: "no such edit" });
    expect(model.calls).toEqual([]);
    expect(held(id)).toBe(before);
  });

  it.each<[string, unknown]>([
    ["cut", { look: "clean" }],
    ["cut", "{"],
    ["change", {}],
    ["change", { request: 5 }],
    ["change", { request: "Shorter", at: -1 }],
    ["change", { request: "Shorter", at: 5401 }],
    ["change", { request: "Shorter", at: 1.5 }],
    ["change", { request: "Shorter", edit: {} }],
    ["ops", {}],
    ["ops", { ops: [] }],
    ["ops", { ops: "captions.set" }],
    ["ops", { ops: Array.from({ length: 201 }, () => ({ op: "captions.set", on: false })) }],
    ["head", {}],
    ["head", { n: 0 }],
    ["head", { n: 301 }],
    ["head", { n: 1.5 }],
    ["head", { n: "1" }],
    ["head", { n: 1, look: "clean" }],
    ["kept", {}],
    ["kept", { finding: "" }],
    ["kept", { finding: 5 }],
    ["kept", { finding: "x".repeat(121) }],
    ["kept", { finding: TOUCHING, turn: 2 }],
  ])("%s refuses the body %j", async (name, body) => {
    const { id } = seedEdit(w.world, { turns: [CUT, { kind: "change", doc: BIGGER_EDIT }] });
    const { model } = w.boundaries();
    expect(await refusal(await send(name, id, body))).toEqual({ status: 400, error: UNREAD });
    expect(w.world.rest.calls).toEqual([]); // before anything is read
    expect(model.calls).toEqual([]);
  });

  it.each(FILM)("$name makes no turn and moves no head while the edit's export runs (spec §7)", async ({ name, body }) => {
    const { id } = exportingEdit([CUT, { kind: "change", doc: BIGGER_EDIT }]);
    const { model } = w.boundaries();
    const before = held(id);
    expect(await refusal(await send(name, id, body))).toEqual({ status: 409, error: EXPORTING });
    expect(model.calls).toEqual([]);
    expect(held(id)).toBe(before);
  });

  it.each(ROUTES.slice(0, 3))("$name refuses a turn past the 300th, asking the model nothing", async ({ name, body }) => {
    const { id } = seedEdit(w.world, { turns: [CUT, ...Array.from({ length: 299 }, (): Seeded => ({ kind: "said", doc: null }))] });
    const { model } = w.boundaries();
    expect(await refusal(await send(name, id, body))).toEqual({ status: 409, error: FULL });
    expect(model.calls).toEqual([]);
    expect(turnNumbers(id)).toHaveLength(300);
    expect(rowOf(id)).toMatchObject({ head: 300 });
  });

  it.each(ROUTES.slice(1, 3))("$name writes the look of the cut the new head sits on, with the head (R18)", async ({ name, body }) => {
    // An edit whose row names the look of a cut that is no longer on its line.
    const { id } = seedEdit(w.world, { turns: [CUT, { kind: "cut", doc: TAKE_FIRST, request: "clean" }], head: 1, look: "clean" });
    w.boundaries();
    const view = await viewOf(await send(name, id, body));
    expect(view).toMatchObject({ head: 2, look: "house" });
    expect(rowOf(id)).toMatchObject({ head: 2, look: "house" });
  });
});
