/**
 * store.ts — an edit's rows (plan 2026-11-24-editor-screens-a, Task 6; spec §6): the creator's edit, its turns, the edit a turn
 * holds, a turn written, whether its export runs, and the edit as the page reads it (`EditView`). The edit is read through the
 * creator's session (their rows only); its turns, which carry no creator of their own, are read with the service client once
 * the edit is known to be theirs; every write is the service client's, filtered on the creator. The rules are `turns.ts`'s.
 *
 * Slice B (plan 2026-11-25-editor-screens-b, Task 8): a turn holds the keys of its findings put away (`kept`, `kept.ts`), read
 * and written with it; the view says the steps after the change shown (`next`, `nextSteps`), read from its edit and the one
 * before it.
 *
 * Server only.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EditSchema, type Edit } from "@/lib/edit";
import { LIVE_JOB, type EditView, type ExportShown, type TakeShown } from "@/lib/edit/edit-view";
import { nextSteps } from "@/lib/edit/next-steps";
import type { Finding } from "@/lib/edit/review";
import { nextTurn, redoTarget, shownTurn, spokenTurns, undoTarget, type TurnKind, type TurnMark } from "@/lib/edit/turns";
import { isId, readJob, type JobRow } from "@/lib/edit/worker/jobs";
import { bucket, folderOf, isUnder, signGet } from "@/lib/edit/worker/r2";
import { assetOf, copiesOf, type TakeRow, type TakeState } from "@/lib/edit/worker/takes";
import type { Database, Json } from "@/types/database.types";
import { ownTake, refuse, type Creator } from "../creator";
import { takeNow } from "../take-now";

type Db = SupabaseClient<Database>;
export type EditRow = Database["public"]["Tables"]["edits"]["Row"];

/** What the editor's routes say when they refuse, one plain sentence each. */
export const EDIT_SAID = {
  notHere: "no such edit",
  hasCut: "This edit already has a cut; start a new edit for another video.",
  noCut: "There is no cut of this edit yet.",
  exporting: "Your video is being made; the edit holds still until it is done or cancelled.",
  changed: "The edit changed while this was being made. Try again.",
  full: "This edit has 300 changes, the most one edit keeps.",
  direct: "Only a word or the captions can be changed here.",
  notMade: "That change could not be made.",
  noVersion: "There is no such version of this edit.",
  moment: "That moment is not in this video.",
  notToCheck: "That is not among the things to check.",
} as const;

/** One of the creator's edits, read through their session; the 404 to answer when the id is no edit of theirs. */
export async function ownEdit(who: Creator, id: string): Promise<EditRow | Response> {
  if (!isId(id)) return refuse(404, EDIT_SAID.notHere);
  const { data, error } = await who.session.from("edits").select("*").eq("id", id).eq("user_id", who.user).maybeSingle();
  if (error) throw new Error(`the edit could not be read: ${error.message}`);
  return data ?? refuse(404, EDIT_SAID.notHere);
}

/** A turn as the rules and the page read it: everything but its edit, and whether it holds one. */
export interface TurnLine extends TurnMark {
  request: string | null;
  at: number | null;
  say: string;
  findings: Finding[];
  /** The keys of its findings put away. */
  kept: string[];
}

interface TurnRead {
  n: number;
  kind: string;
  request: string | null;
  at: number | null;
  say: string;
  findings: Json;
  kept: Json;
  /** The edit's `v` (1) when the turn holds one, else null: whether it does, without reading the edit. */
  v: Json | null;
}

/** An edit's turns, in order, without their edits. */
export async function turnsOf(service: Db, edit: string): Promise<TurnLine[]> {
  const { data, error } = await service
    .from("edit_turns")
    .select("n,kind,request,at,say,findings,kept,v:doc->v")
    .eq("edit_id", edit)
    .order("n", { ascending: true })
    .returns<TurnRead[]>();
  if (error) throw new Error(`the edit's turns could not be read: ${error.message}`);
  return data.map((row) => ({
    n: row.n,
    kind: row.kind as TurnKind,
    request: row.request,
    at: row.at,
    say: row.say,
    findings: Array.isArray(row.findings) ? (row.findings as unknown as Finding[]) : [],
    kept: Array.isArray(row.kept) ? row.kept.filter((key): key is string => typeof key === "string") : [],
    doc: row.v !== null,
  }));
}

/** The edit turn `n` holds; throws for a turn that holds none, or one that is no edit. */
export async function docOf(service: Db, edit: string, n: number): Promise<Edit> {
  const { data, error } = await service.from("edit_turns").select("doc").eq("edit_id", edit).eq("n", n).maybeSingle();
  if (error) throw new Error(`the edit's turn could not be read: ${error.message}`);
  const doc = EditSchema.safeParse(data?.doc);
  if (!doc.success) throw new Error(`edit ${edit}: turn ${n} holds no edit`);
  return doc.data;
}

/** The edits the turns `ns` hold, by number, in one read; throws for one that holds none, or one that is no edit (as `docOf`). */
export async function docsOf(service: Db, edit: string, ns: readonly number[]): Promise<Map<number, Edit>> {
  const wanted = [...new Set(ns)];
  const docs = new Map<number, Edit>();
  if (wanted.length === 0) return docs;
  const { data, error } = await service.from("edit_turns").select("n,doc").eq("edit_id", edit).in("n", wanted);
  if (error) throw new Error(`the edit's turns could not be read: ${error.message}`);
  for (const row of data) {
    const doc = EditSchema.safeParse(row.doc);
    if (doc.success) docs.set(row.n, doc.data);
  }
  const none = wanted.find((n) => !docs.has(n));
  if (none !== undefined) throw new Error(`edit ${edit}: turn ${none} holds no edit`);
  return docs;
}

/** A turn to write. */
export interface TurnWritten {
  kind: TurnKind;
  request: string | null;
  at: number | null;
  say: string;
  findings: readonly Finding[];
  /** The keys of its findings put away: those carried from the turn it was made on (`carryKept`), none for a cut. */
  kept: readonly string[];
  doc: Edit | null;
}

/**
 * Writes a turn after the head the edit was read at (`nextTurn`): the turns from there on dropped, the turn inserted (its key
 * `(edit_id, n)` refuses a second one made at the same moment), then the head moved to it and the export forgotten. `more` is
 * written with the head (a cut's look, style and title). Gives the edit as written; `conflict` when the edit is no longer as it
 * was read; `full` at the cap. `edit` is the row as last read: a caller that has written the edit itself since then passes the
 * row that write gave back, or its own write refuses it.
 *
 * "As it was read" is its head where it was and its row not written since (`updated_at`, which the table's trigger stamps on
 * every update, no later than the one read): so also not when the head left and came back to the same number, an export was
 * started, or the take was changed, during a call that takes up to three minutes.
 *
 * A read and three writes, with no transaction between them, in the one order that leaves an edit that reads right wherever it
 * stops. A turn the table would refuse for its kind is thrown out before any of them.
 *   0. the edit read again: `conflict` unless it is as it was read, so a write made on an old read drops and writes nothing.
 *   1. the drop, when the edit was read with turns after its head. Stopped here, the edit stands at its head with nothing after
 *      it: Redo is gone, as the new turn would have had it.
 *   2. the turn. Stopped here, the head is where it was and the turn sits right after it: one that holds an edit is where Redo
 *      goes; an answer that changed nothing is not shown, and comes back only by Undo then Redo. The next turn made at this
 *      head drops it either way.
 *   3. the head, only if the edit is still as it was read: `conflict` if it was written between 0 and here, the turn left as
 *      in 2. Nothing is deleted after the turn is written, so a write that loses here takes nothing with it.
 */
export async function commitTurn(
  service: Db, edit: EditRow, turns: readonly TurnMark[], turn: TurnWritten,
  more: { look?: string | null; style?: Json | null; title?: string } = {},
): Promise<EditRow | "conflict" | "full"> {
  if ((turn.kind === "said") !== (turn.doc === null)) throw new Error(`edit ${edit.id}: a ${turn.kind} turn ${turn.doc === null ? "must hold an edit" : "holds no edit"}`);
  const next = nextTurn(turns, edit.head);
  if (!next.ok) return "full";
  const reading = service.from("edits").select("id").eq("id", edit.id).eq("user_id", edit.user_id).lte("updated_at", edit.updated_at);
  const { data: asRead, error: unread } = await (edit.head === null ? reading.is("head", null) : reading.eq("head", edit.head)).maybeSingle();
  if (unread) throw new Error(`the edit could not be read again: ${unread.message}`);
  if (!asRead) return "conflict";
  if (next.drops.length > 0) {
    const { error } = await service.from("edit_turns").delete().eq("edit_id", edit.id).gte("n", next.n);
    if (error) throw new Error(`the turns after the head could not be dropped: ${error.message}`);
  }
  const { error: unwritten } = await service.from("edit_turns").insert({
    edit_id: edit.id, n: next.n, kind: turn.kind, request: turn.request, at: turn.at, say: turn.say,
    findings: turn.findings as unknown as Json, kept: turn.kept as unknown as Json, doc: turn.doc as unknown as Json,
  });
  if (unwritten?.code === "23505") return "conflict";
  if (unwritten) throw new Error(`the turn could not be written: ${unwritten.message}`);
  const moving = service
    .from("edits")
    .update({ head: next.n, export_job: null, export_turn: null, ...more })
    .eq("id", edit.id)
    .eq("user_id", edit.user_id)
    .lte("updated_at", edit.updated_at);
  const { data, error } = await (edit.head === null ? moving.is("head", null) : moving.eq("head", edit.head)).select();
  if (error) throw new Error(`the edit's head could not be moved: ${error.message}`);
  return data[0] ?? "conflict";
}

/** The export job of the edit, as it stands (`readJob` writes a stopped one failed); null when there is none. */
async function exportJobOf(who: Creator, service: Db, edit: EditRow): Promise<JobRow | null> {
  return edit.export_job === null ? null : readJob(who.session, service, who.user, edit.export_job);
}

/** Whether the edit's export is still at work: then no turn is made and the head holds still (E20). */
export async function exportLive(who: Creator, service: Db, edit: EditRow): Promise<boolean> {
  const job = await exportJobOf(who, service, edit);
  return job !== null && LIVE_JOB.has(job.status);
}

/** The take as the page reads it: its state, its analysis's progress, and once ready its facts and fresh addresses. */
async function takeShownOf(who: Creator, take: TakeRow, state: TakeState, job: JobRow | null): Promise<TakeShown> {
  const ready = state.status === "ready";
  const ms = (take.facts as { ms?: unknown } | null)?.ms;
  let previewUrl: string | null = null;
  let posterUrl: string | null = null;
  if (ready) {
    const files = copiesOf(take);
    const folder = folderOf(who.user, { take: take.id });
    if (!isUnder(files.preview, folder) || !isUnder(files.poster, folder)) throw new Error(`take ${take.id}: its copies are kept outside its folder`);
    [previewUrl, posterUrl] = await Promise.all([signGet(files.preview), signGet(files.poster)]);
  }
  return {
    id: take.id, name: take.name, status: state.status, error: state.error,
    stage: job?.stage ?? null, progress: job ? job.progress : null,
    ms: ready && typeof ms === "number" ? ms : null, posterUrl, previewUrl, asset: ready ? assetOf(take, bucket()) : null,
  };
}

/** The export of the turn shown, as it stands, with a fresh address of the film once it is made. */
async function exportShownOf(who: Creator, job: JobRow, turn: number): Promise<ExportShown> {
  const result = job.result as { path?: unknown; ms?: unknown } | null;
  const film = job.status === "done" && typeof result?.path === "string" ? result.path : null;
  if (film !== null && !isUnder(film, folderOf(who.user, "films"))) throw new Error(`job ${job.id}: its film is kept outside the creator's films`);
  return {
    job: job.id, turn, status: job.status, stage: job.stage, progress: job.progress, error: job.error,
    filmUrl: film === null ? null : await signGet(film, "video.mp4"), ms: typeof result?.ms === "number" ? result.ms : null,
  };
}

/**
 * The keys put away on turn `n` as the table holds them now; none for a turn that is not there. A route that makes a turn
 * reads them just before it writes it (Task 8, fix round 1): a keep takes no hold and writes no edit's row, so one made while
 * the turn was being made (an agent's change takes up to 50 s) is seen only here, and is carried.
 */
export async function keptNow(service: Db, edit: string, n: number): Promise<string[]> {
  const { data, error } = await service.from("edit_turns").select("kept").eq("edit_id", edit).eq("n", n).maybeSingle();
  if (error) throw new Error(`the turn's findings put away could not be read: ${error.message}`);
  return Array.isArray(data?.kept) ? data.kept.filter((key): key is string => typeof key === "string") : [];
}

/**
 * The edit as the page reads it (`EditView`): its take, its turns up to the head, the edit shown, Undo, Redo, the export, and
 * the steps after the change shown. With no cut yet there is nowhere for Redo to go, though a turn may be left over from a first
 * cut that stopped after its turn was written (R21): the first cut is made again, and that turn gives way.
 *
 * The steps are told from the edit shown and the one it was made on, the edit shown at the turn before it (a turn is made at the
 * head, on the edit shown there), read together; only for a change of the agent's (§5.3), so none for a cut, a change by hand,
 * or the first cut. A head on an answer that changed nothing after a change shows that change, and so its steps.
 */
export async function viewOf(who: Creator, edit: EditRow, service: Db): Promise<EditView> {
  const take = await ownTake(who, edit.take_id);
  if (take instanceof Response) throw new Error(`edit ${edit.id}: its take cannot be read`);
  const [{ state, job }, turns] = await Promise.all([takeNow(who, take, service), turnsOf(service, edit.id)]);
  const shown = shownTurn(turns, edit.head);
  const before = shown !== null && turns.find((turn) => turn.n === shown)?.kind === "change" ? shownTurn(turns, shown - 1) : null;
  const exported = shown !== null && edit.export_turn === shown ? await exportJobOf(who, service, edit) : null;
  const [takeShown, docs, exportShown] = await Promise.all([
    takeShownOf(who, take, state, job),
    shown === null ? null : docsOf(service, edit.id, before === null ? [shown] : [shown, before]),
    exported === null || shown === null ? null : exportShownOf(who, exported, shown),
  ]);
  const doc = shown === null ? null : (docs?.get(shown) ?? null);
  const was = before === null ? null : (docs?.get(before) ?? null);
  return {
    id: edit.id, title: edit.title, threadId: edit.thread_id, look: edit.look, updatedAt: edit.updated_at,
    take: takeShown, head: edit.head, shown, edit: doc,
    undo: undoTarget(turns, edit.head), redo: edit.head === null ? null : redoTarget(turns, edit.head),
    turns: spokenTurns(turns, edit.head).map(({ n, kind, request, at, say, findings, kept, doc: holds }) => ({ n, kind, request, at, say, findings, kept, doc: holds })),
    export: exportShown,
    next: was === null || doc === null ? [] : nextSteps(was, doc),
  };
}
