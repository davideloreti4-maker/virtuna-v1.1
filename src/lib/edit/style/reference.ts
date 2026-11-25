/**
 * reference.ts — a reference video in the app (part 3, Task 11; spec §12.2, X96, X98, X101 to X104). A link the creator pastes
 * (an outlier, or any TikTok) is fetched as Remix fetches one and put into R2 as a temporary take of theirs; a file they upload
 * comes in through the takes' signed upload. The worker analyses it in reference mode (its job's input `{reference: true}`:
 * at most three minutes, never heard, its text measured); once it is ready it is read into a style and dropped: its files in
 * R2, its job rows and its take row are deleted, and only the style is kept (X96).
 *
 * - `fetchReference`: a TikTok link through `resolveAndRehost` (a temporary signed copy, cleaned up always), into R2.
 * - `stageOf`: what is happening, in a creator's words, from the worker's stage: the one place they are mapped.
 * - `readReference`: the measures, the measured text, the sheet the worker made in the analysis (read from R2) judged by Qwen,
 *   and the style. A missing sheet, or a judgement that fails, leaves the style to the measures (`judged: false`).
 * - `dropReference`: everything of it deleted, each step tried even when one before it failed, each failure logged;
 *   `dropOldReferences`: a creator's references left over (an answer lost, never polled, an upload abandoned), dropped.
 * - `referencesAmong`: which of a creator's takes are references, so that the rest of the app never takes one for a take.
 *
 * Server only: R2, the worker and Qwen are reached through their clients, which read their settings from the environment.
 */
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAndRehost } from "@/lib/engine/remix/resolve-and-rehost";
import { createLogger } from "@/lib/logger";
import { IngestError } from "@/lib/scraping/types";
import type { Database } from "@/types/database.types";
import { analysisOf, type TakeAnalysis } from "../analysis";
import type { Ask } from "../agent/model";
import { frameAt } from "../time";
import { isId, type JobRow } from "../worker/jobs";
import { folderOf, isUnder, listedUnder, objectsUnder, removeObject, signGet, signPut, takeKey } from "../worker/r2";
import type { TakeRow } from "../worker/takes";
import { measuresOf } from "./measures";
import type { StyleProfile } from "./profile";
import { judgeSheet, styleOfReference, type Judgement } from "./read";
import { seenOf, textOf } from "./text";

type Db = SupabaseClient<Database>;

const log = createLogger({ module: "edit.references" });

/* ── the link ─────────────────────────────────────────────────────────────────────────────────── */

/**
 * A link to a TikTok video: https, on tiktok.com or one of its subdomains (www., vm., vt., m.). Remix's path fetches TikTok
 * only (`resolveVideoUrl`, one Apify run a link), so any other link is refused before anything is spent.
 */
export function isTikTokLink(link: string): boolean {
  if (!URL.canParse(link)) return false;
  const { protocol, hostname } = new URL(link);
  return protocol === "https:" && (hostname === "tiktok.com" || hostname.endsWith(".tiktok.com"));
}

/** A fetch refused in a creator's words, with the status to answer: the video is not there (422), or could not be had (502). */
export class FetchRefused extends Error {
  constructor(
    readonly status: 422 | 502,
    message: string,
  ) {
    super(message);
    this.name = "FetchRefused";
  }
}

/**
 * The most a fetched reference may weigh. It is held in memory twice on the way (`resolveAndRehost`'s copy, then ours), so it
 * is kept well under a function's memory; the five test references were 7 to 14 MB for 60 to 137 s.
 */
export const MAX_FETCHED_BYTES = 200 * 1024 ** 2;

/**
 * The video at a TikTok `link`, fetched as Remix fetches one (`resolveAndRehost`: through Apify into a temporary signed copy,
 * removed again in all cases) and put into R2 at `key`, the reference's source, as an MP4. Gives its size, its creator's
 * the seconds of each step (never who made the video: the fetch's handle is not kept, A-I2). A video that is not there, or could not be had, is a
 * `FetchRefused`; what fails on our side (the copy, R2) throws as it is.
 */
export async function fetchReference(link: string, key: string): Promise<{ bytes: number; seconds: { fetch: number; store: number } }> {
  const started = performance.now();
  let rehosted: Awaited<ReturnType<typeof resolveAndRehost>>;
  try {
    rehosted = await resolveAndRehost(link, randomUUID());
  } catch (error) {
    if (!(error instanceof IngestError)) throw error;
    log.warn("a reference could not be fetched", { kind: error.kind });
    throw error.kind === "not_found"
      ? new FetchRefused(422, "that video could not be found: it may be private or taken down")
      : new FetchRefused(502, "that video could not be fetched; try again, or upload it");
  }
  try {
    const copy = await fetch(rehosted.signedUrl);
    if (!copy.ok) throw new Error(`the reference's temporary copy answered ${copy.status}`);
    const body = await cappedBody(copy, MAX_FETCHED_BYTES);
    if (body.byteLength === 0) throw new FetchRefused(502, "that video came back empty; try again, or upload it");
    const fetched = performance.now();
    const put = await fetch(await signPut(key, body.byteLength, "video/mp4"), { method: "PUT", headers: { "content-type": "video/mp4" }, body });
    if (!put.ok) throw new Error(`R2 answered ${put.status} to the reference's upload`);
    return { bytes: body.byteLength, seconds: { fetch: seconds(started, fetched), store: seconds(fetched) } };
  } finally {
    // Derive and drop (T-03-02): the temporary copy goes whatever became of the put. cleanup() logs its own failure.
    await rehosted.cleanup().catch((error: unknown) => log.warn("the reference's temporary copy could not be removed", { error: error instanceof Error ? error.message : String(error) }));
  }
}

const seconds = (from: number, to = performance.now()) => Math.round(to - from) / 1000;

/**
 * A response's body, refused past `most` bytes before it is held: on its stated length before a byte is read, and while it is
 * read, at the first chunk past it (a length can be missing or wrong), its stream then cancelled. With a length stated, the body is
 * read straight into one buffer of that length; without one, its chunks are kept and joined at the end.
 */
async function cappedBody(response: Response, most: number): Promise<Uint8Array<ArrayBuffer>> {
  const tooLarge = () => new FetchRefused(422, "that video is too large to read");
  // The stated length is the body's as sent: fetch decodes a gzip or br body, which then runs longer, so it is not held to it.
  const encoded = (response.headers.get("content-encoding") ?? "identity").toLowerCase() !== "identity";
  const stated = response.headers.has("content-length") && !encoded ? Number(response.headers.get("content-length")) : null;
  if (stated !== null && stated > most) {
    await response.body?.cancel();
    throw tooLarge();
  }
  const reader = response.body?.getReader();
  const held = stated !== null && Number.isInteger(stated) ? new Uint8Array(stated) : null;
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const read = await reader?.read();
    if (!read || read.done) break;
    if (length + read.value.byteLength > (held?.byteLength ?? most)) {
      await reader?.cancel();
      if (held && length + read.value.byteLength <= most) throw new Error("the reference's temporary copy is longer than it says");
      throw tooLarge();
    }
    if (held) held.set(read.value, length);
    else chunks.push(read.value);
    length += read.value.byteLength;
  }
  if (held) {
    if (length !== held.byteLength) throw new Error(`the reference's temporary copy is ${length} of the ${held.byteLength} bytes it says`);
    return held;
  }
  const body = new Uint8Array(length);
  chunks.reduce((at, chunk) => (body.set(chunk, at), at + chunk.byteLength), 0);
  return body;
}

/* ── what is happening ────────────────────────────────────────────────────────────────────────── */

/** What a creator is told is happening while a reference is read, in order. */
export const STAGES = ["getting the video", "reading its cuts", "reading its text", "reading its look", "done"] as const;
export type Stage = (typeof STAGES)[number];

/** What a creator is told while the look is read: the app's own read of the sheet, and a read under way when they poll. */
export const READING_ITS_LOOK = "reading its look" satisfies Stage;

/**
 * The worker's stages of a reference's analysis (`worker/store.py`'s `fetching` and `storing` around `worker/media/analyse.py`'s
 * `STAGES`, as a reference runs them since Task 9c), in a creator's words:
 * - `fetching` and `copies` (its preview and its sound only): getting the video;
 * - `words` (only its pauses, never heard, X103), `faces`, `cuts` and `picture`: the pace's and the punch-ins' measures, reading
 *   its cuts;
 * - `text` (its text on screen and the sheet of its frames) and `storing` (the sheet, the one file stored): reading its text.
 * A reference has no `loudness` stage; were one named, it would come after the text, so it reads as that. Reading its look is
 * the app's own read once the analysis is done: the sheet judged by Qwen, a few seconds (`READING_ITS_LOOK`).
 */
const WORKER_STAGES: Record<string, Stage> = {
  fetching: "getting the video",
  copies: "getting the video",
  words: "reading its cuts",
  faces: "reading its cuts",
  cuts: "reading its cuts",
  picture: "reading its cuts",
  text: "reading its text",
  storing: "reading its text",
  loudness: "reading its text",
};

/**
 * What is happening to a reference whose analysis is `job` (none yet, or not yet claimed: the video is being got). A stage the
 * worker names that is not mapped here reads as its cuts: the analysis is under way.
 */
export function stageOf(job: Pick<JobRow, "status" | "stage"> | null): Stage {
  if (job?.status === "done") return "done";
  if (!job?.stage) return "getting the video";
  return Object.hasOwn(WORKER_STAGES, job.stage) ? WORKER_STAGES[job.stage]! : "reading its cuts";
}

/* ── the read ─────────────────────────────────────────────────────────────────────────────────── */

/** How long one call to Qwen may take in a read: it takes 4 to 7 s (Task 9b); past this the read goes on without it. */
export const JUDGE_TIMEOUT_MS = 30_000;
/** How long the read waits for R2 to give it the reference's sheet, a JPEG of 100 to 300 KB. */
export const SHEET_TIMEOUT_MS = 15_000;

/** A reference read: the style, whether Qwen judged it, and what the read did, for the log. */
export interface Reading {
  style: StyleProfile;
  judged: boolean;
  judgement: Judgement | null;
  /** The frames on the sheet, in cell order (its moments as film frames); none without a sheet. */
  frames: number[];
  /** The sheet's SHA-1, so a copy of it can be known for the one judged; null when there is none to read. */
  sheet: string | null;
  /** Why there is no sheet to judge, in a line; null when there is one. */
  unsheeted: string | null;
  /** The seconds to read the sheet from R2, and to have it judged. */
  seconds: { sheet: number; judgement: number };
}

/**
 * What a reference's take is called, whatever its link's page or its file was called: `reference.mp4`, or `reference.mov` for a
 * QuickTime upload. A reference never carries the name of who made it or of the creator's file (A-I2): not in its row, its job,
 * the worker's lines ("reference.mp4 is longer than 3 minutes …") or its log, nor in the style, whose `source.name` is null.
 */
export const referenceName = (type: string = "video/mp4"): string => `${LINK_NAME}.${type === "video/quicktime" ? "mov" : "mp4"}`;
/** The name every reference's take is given, before its file's extension. */
export const LINK_NAME = "reference";

/**
 * The sheet the worker made of a reference in its analysis (Task 9c) and stored beside it: the JPEG, in base64, read from R2 at
 * the key its row names (inside the reference's folder only), and its moments as film frames, in cell order. Throws a line for
 * an analysis with no sheet (its stage failed, or it was made before the worker made sheets) or a sheet that cannot be read.
 */
async function storedSheet(user: string, take: TakeRow, analysis: TakeAnalysis): Promise<{ jpeg: string; frames: number[] }> {
  if (!analysis.sheet) throw new Error("its analysis has no sheet");
  const named = (take.analysis as { files?: { sheet?: unknown } } | null)?.files?.sheet;
  const key = typeof named === "string" ? named : takeKey(user, take.id, analysis.sheet.file);
  if (!isUnder(key, folderOf(user, { take: take.id }))) throw new Error("its sheet is kept outside its folder");
  const response = await fetch(await signGet(key), { signal: AbortSignal.timeout(SHEET_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`R2 answered ${response.status} to a read of its sheet`);
  return { jpeg: Buffer.from(await response.arrayBuffer()).toString("base64"), frames: analysis.sheet.ms.map((at) => frameAt(at, 1)) };
}

/**
 * The style of `take`, a ready reference of `user`'s (spec §12.2 as X101 and Task 9c remade it): the measures and the measured
 * text from its analysis; the sheet the worker made of it, read from R2 (`storedSheet`), judged by Qwen (`ask`, each call held to
 * `JUDGE_TIMEOUT_MS`) and told the sheet's moments; the style made in the kit's terms. It asks for no copy of the reference:
 * a reference has none but its sheet. Neither a missing sheet nor a failed judgement fails it: the measures do not need them,
 * and it says so (`judged: false`). Throws for a take whose row holds no reference's analysis.
 */
export async function readReference(user: string, take: TakeRow, ask: Ask): Promise<Reading> {
  const ms = (take.facts as { ms?: unknown } | null)?.ms;
  if (typeof ms !== "number" || ms <= 0) throw new Error(`reference ${take.id}: its row holds no length`);
  const analysis = analysisOf(take);
  const measures = measuresOf(analysis, ms);
  const text = textOf(analysis, ms);

  let started = performance.now();
  let sheet: { jpeg: string; frames: number[] } | null = null;
  let unsheeted: string | null = null;
  try {
    sheet = await storedSheet(user, take, analysis);
  } catch (error) {
    unsheeted = error instanceof Error ? error.message : String(error); // told in the read's one log line, as `unsheeted`
  }
  const read = seconds(started);

  started = performance.now();
  const bounded: Ask = (messages, options) => ask(messages, { ...options, signal: AbortSignal.timeout(JUDGE_TIMEOUT_MS) });
  const judgement = sheet === null ? null : await judgeSheet(sheet.jpeg, sheet.frames, seenOf(analysis, ms), bounded);
  const judged = seconds(started);

  return {
    style: styleOfReference(measures, text, judgement, null), // never named (A-I2)
    judged: judgement !== null,
    judgement,
    frames: sheet?.frames ?? [],
    sheet: sheet === null ? null : createHash("sha1").update(sheet.jpeg).digest("hex"),
    unsheeted,
    seconds: { sheet: read, judgement: judged },
  };
}

/* ── one read at a time, and two at most ─────────────────────────────────────────────────────── */

/**
 * The stages a done job's row is given while its reference is read (its worker leaves it none): a first read under way, a
 * first read that failed and gave its claim back, and the second and last read under way.
 */
export const READ_STAGES = { first: "reading", failed: "read failed", second: "reading again" } as const;
/** How long a read's claim holds: a read takes at most the sheet's 15 s from R2, two judgements of 30 s and the drop; one older died. */
export const READ_CLAIM_MS = 3 * 60 * 1000;

/** A claim on a reference's read: which read this is; or another poll reads it now (`busy`); or both reads failed (`spent`). */
export type Claim = { read: 1 | 2 } | "busy" | "spent";

/**
 * Claims the read of a reference whose analysis `job` is done, so that two polls at once read it once, in one conditional write
 * on the job's stage (the trigger stamps its time; `READ_STAGES`):
 * - none yet: the first read;
 * - a first read that failed (`releaseRead`): the second, at once;
 * - a first read older than `READ_CLAIM_MS`, which died without giving its claim back: the second;
 * - a second read older than that: `spent`, both reads failed;
 * - a read under way, or a write that another poll made first: `busy`.
 */
export async function claimRead(service: Db, user: string, job: JobRow, now = Date.now()): Promise<Claim> {
  const stale = now - Date.parse(job.updated_at) > READ_CLAIM_MS;
  if (job.stage === READ_STAGES.second) return stale ? "spent" : "busy";
  if (job.stage === READ_STAGES.first && !stale) return "busy";
  const read = job.stage === READ_STAGES.first || job.stage === READ_STAGES.failed ? 2 : 1;
  const write = service.from("edit_jobs").update({ stage: read === 1 ? READ_STAGES.first : READ_STAGES.second }).eq("id", job.id).eq("user_id", user).eq("status", "done");
  const asRead = job.stage === null ? write.is("stage", null) : write.eq("stage", job.stage);
  const { data, error } = await (job.stage === READ_STAGES.first ? asRead.lt("updated_at", new Date(now - READ_CLAIM_MS).toISOString()) : asRead).select("id");
  if (error) throw new Error(`the reference's read could not be claimed: ${error.message}`);
  return data.length > 0 ? { read } : "busy";
}

/** What a creator is told when both reads of a reference failed, and it is dropped. */
export const UNREAD = "the video could not be read into a style; try it again, or another video";

/**
 * Gives back the claim of a first read that failed, so that the next poll reads again at once, as the second and last read,
 * rather than after `READ_CLAIM_MS`. A claim that cannot be given back is logged, and taken over when it is that old.
 */
export async function releaseRead(service: Db, user: string, job: JobRow): Promise<void> {
  const { error } = await service.from("edit_jobs").update({ stage: READ_STAGES.failed }).eq("id", job.id).eq("user_id", user).eq("status", "done").eq("stage", READ_STAGES.first);
  if (error) log.error("a reference's first read could not give its claim back; it is taken over in three minutes", { reference: job.take_id, error: error.message });
}

/* ── the drop ─────────────────────────────────────────────────────────────────────────────────── */

/**
 * Drops the reference `id` of `user` (X96): every object in R2 under its folder (`u/<user>/takes/<id>/`), then its take row, and
 * with it its job rows (X70's key cascades), with the service client and filtered on the creator. The take and its jobs go in one
 * statement, so a drop that fails part way never leaves a take row without the job that marks it a reference, which would read
 * as the creator's own take. Each step is tried even when the one before it failed, and each failure is logged; it never throws.
 * Files left by a step that failed have no row once the take is gone: the sweep finds such a folder by listing the creator's
 * takes in R2 (`dropOrphanFolders`).
 */
export async function dropReference(service: Db, user: string, id: string): Promise<void> {
  if (!isId(id)) {
    // A prefix built from anything but a take's id could reach past one reference's folder: nothing is listed or deleted.
    log.error("a reference's drop was asked for an id that is no take's; nothing was dropped", { reference: id });
    return;
  }
  const tried = async (what: string, work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      log.error(`a reference's ${what} could not be dropped`, { reference: id, error: error instanceof Error ? error.message : String(error) });
    }
  };
  await tried("files", () => dropFiles(user, id));
  await tried("take", async () => {
    const { error } = await service.from("edit_takes").delete().eq("id", id).eq("user_id", user);
    if (error) throw new Error(error.message);
  });
}

/** Deletes every object under a take's folder (`u/<user>/takes/<id>/`), and nothing else; throws a line for what is left. */
async function dropFiles(user: string, id: string): Promise<void> {
  const keys = await objectsUnder(folderOf(user, { take: id }));
  const results = await Promise.allSettled(keys.map((key) => removeObject(key)));
  const left = results.flatMap((result, i) => (result.status === "rejected" ? [`${keys[i]}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`] : []));
  if (left.length > 0) throw new Error(`${left.length} of its ${keys.length} files are left (${left.join("; ")})`);
}

/* ── a reference is never a take ──────────────────────────────────────────────────────────────── */

/**
 * What an uploaded reference's row holds in `analysis` from its signing until the worker writes its analysis there: the one
 * mark it has before its job exists (`edit_takes` has no column for it). The worker overwrites it when the reference is ready.
 */
export const UPLOAD_MARK = { reference: true } as const;

/** Whether a job is the analysis of a reference: an analysis asked with the input `{reference: true}` (worker/store.py, `reference_of`). */
export const isReferenceJob = (job: Pick<JobRow, "kind" | "input">): boolean => job.kind === "analyse" && (job.input as { reference?: unknown } | null)?.reference === true;

/**
 * Whether a take's row carries the upload's mark (`UPLOAD_MARK`): an uploaded reference before the worker wrote its analysis, in
 * whatever state (the worker never writes a `reference` key there, so no take of the creator's own carries it).
 */
const isMarked = (take: Pick<TakeRow, "analysis">): boolean => (take.analysis as { reference?: unknown } | null)?.reference === true;

/**
 * The ids, among `takes` (rows of `user`'s, as their session reads them), of those that are references: a take with an analysis
 * job asked as a reference's (`isReferenceJob`), or one carrying the upload's mark (`UPLOAD_MARK`), in whatever state. Read
 * through the creator's session; nothing is written. The rest of the app uses it so that a reference is never a take there.
 */
export async function referencesAmong(session: Db, user: string, takes: readonly Pick<TakeRow, "id" | "analysis">[]): Promise<Set<string>> {
  const found = new Set(takes.filter(isMarked).map((take) => take.id));
  const ids = takes.filter((take) => !found.has(take.id)).map((take) => take.id);
  if (ids.length === 0) return found;
  const { data, error } = await session.from("edit_jobs").select("take_id,kind,input").in("take_id", ids).eq("user_id", user).eq("kind", "analyse");
  if (error) throw new Error(`the takes' analyses could not be read: ${error.message}`);
  for (const job of data) if (job.take_id && isReferenceJob(job)) found.add(job.take_id);
  return found;
}

/**
 * How long a reference may stand untouched before the next sweep drops it (`POST /api/edit/references` and `GET /api/edit/takes`
 * run one), in whatever state: 90 minutes,
 * past anything that can still write to it. An upload's signed PUT lives 60 minutes (`UPLOAD_SECONDS`), and an analysis at most
 * 30 (`worker/app.py`, the analyse function's timeout), counted from its job (or, for an upload, from the finish that starts it).
 */
export const LEFT_OVER_MS = 90 * 60 * 1000;

/**
 * The ids of `user`'s references older than `LEFT_OVER_MS`, and which of the two reads failed, by kind. Only what can be a
 * reference is read, through the creator's session, never the creator's other takes:
 * - their analysis jobs asked as a reference's (`input->>reference`), aged by when the job was made;
 * - the takes carrying the upload's mark (`analysis->>reference`), aged by when the take was last touched (`updated_at`: its
 *   finish and its failure touch it, an abandoned upload's is when it was signed for), and never a ready one, whose analysis is
 *   always the worker's and never carries the mark (so Postgres never opens a ready take's analysis); a ready reference is
 *   found by its job.
 */
export async function oldReferences(session: Db, user: string, now = Date.now()): Promise<{ ids: string[]; failed: { kind: string; error: string }[] }> {
  const before = new Date(now - LEFT_OVER_MS).toISOString();
  const [jobs, uploads] = await Promise.all([
    session.from("edit_jobs").select("take_id").eq("user_id", user).eq("kind", "analyse").eq("input->>reference", "true").lt("created_at", before),
    session.from("edit_takes").select("id").eq("user_id", user).neq("status", "ready").eq("analysis->>reference", "true").lt("updated_at", before),
  ]);
  const failed = [
    ...(jobs.error ? [{ kind: "reference jobs", error: jobs.error.message }] : []),
    ...(uploads.error ? [{ kind: "marked uploads", error: uploads.error.message }] : []),
  ];
  const ids = [...new Set([...(jobs.data ?? []).flatMap((job) => (job.take_id ? [job.take_id] : [])), ...(uploads.data ?? []).map((take) => take.id)])];
  return { ids, failed };
}

/** How much of a creator's takes in R2 one sweep looks at, and how many folders with no row it drops at most. */
export const ORPHANS = { keys: 2000, folders: 10 } as const;

/**
 * Drops folders under `u/<user>/takes/` that have no take row (A-I1, D-I2): the files a drop could not delete before its row went,
 * the worker's sheet stored after a drop, a link's source put into R2 by a request that died before its row was written. A folder
 * counts only when all its files are older than `LEFT_OVER_MS`, so a link being fetched, an upload being put or an analysis being
 * stored is never one. Bounded: at most `ORPHANS.keys` keys are listed, from just after a random take id and then from the start,
 * so that over sweeps every folder is looked at; at most `ORPHANS.folders` are dropped, logged by their count. Gives how many.
 * Throws when R2 or the rows cannot be read.
 *
 * It fails closed: whether a folder has a row is read with the service client (which sees every row, whatever the rules a
 * creator's session reads by), filtered on the creator and the take's ids, in fifties; and an orphan's drop deletes its files
 * only, never a row. A row this read misses is never deleted with them.
 */
export async function dropOrphanFolders(service: Db, user: string, now = Date.now(), from: string = randomUUID()): Promise<number> {
  const root = `u/${user}/takes/`;
  const listed = new Map((await listedUnder(root, { most: ORPHANS.keys, after: `${root}${from}` })).map((each) => [each.key, each.modified]));
  if (listed.size < ORPHANS.keys) for (const each of await listedUnder(root, { most: ORPHANS.keys - listed.size })) listed.set(each.key, each.modified);
  const newest = new Map<string, number>();
  for (const [key, modified] of listed) {
    const id = key.slice(root.length).split("/")[0] ?? "";
    newest.set(id, Math.max(newest.get(id) ?? 0, modified));
  }
  const old = [...newest].filter(([id, modified]) => isId(id) && modified < now - LEFT_OVER_MS).map(([id]) => id);
  const rowed = new Set<string>();
  for (let at = 0; at < old.length; at += 50) {
    const { data, error } = await service.from("edit_takes").select("id").eq("user_id", user).in("id", old.slice(at, at + 50));
    if (error) throw new Error(`the creator's takes could not be read: ${error.message}`);
    for (const take of data) rowed.add(take.id);
  }
  const orphans = old.filter((id) => !rowed.has(id)).slice(0, ORPHANS.folders);
  for (const id of orphans) {
    try {
      await dropFiles(user, id); // its files only: a row, were there one, is never touched here
    } catch (error) {
      log.error("a folder with no row could not be dropped", { reference: id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (orphans.length > 0) log.info("folders with no row dropped", { count: orphans.length });
  return orphans.length;
}

/**
 * Drops `user`'s left-overs: each reference older than `LEFT_OVER_MS` (`oldReferences`), in whatever state (an answer lost,
 * never polled, an upload abandoned), with `dropReference`; then the folders in R2 with no row (`dropOrphanFolders`). Logged by
 * their counts. A read that fails is logged by its kind and the rest still swept: it never throws, so a sweep never fails the
 * request it runs in (`POST /api/edit/references` and `GET /api/edit/takes`). Gives how many were dropped.
 */
export async function dropOldReferences(session: Db, service: Db, user: string, now = Date.now()): Promise<number> {
  let dropped = 0;
  try {
    const { ids, failed } = await oldReferences(session, user, now);
    for (const { kind, error } of failed) log.error("left-over references could not be read; the request goes on", { kind, error });
    for (const id of ids) await dropReference(service, user, id);
    if (ids.length > 0) log.info("left-over references dropped", { count: ids.length });
    dropped += ids.length;
  } catch (error) {
    log.error("left-over references could not be read; the request goes on", { kind: "references", error: error instanceof Error ? error.message : String(error) });
  }
  try {
    dropped += await dropOrphanFolders(service, user, now);
  } catch (error) {
    log.error("left-over references could not be read; the request goes on", { kind: "folders with no row", error: error instanceof Error ? error.message : String(error) });
  }
  return dropped;
}
