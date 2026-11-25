/**
 * library-page.ts — one page of a creator's chats for the Library (plan 2026-11-23-library).
 *
 * SERVER ONLY: it reads through the service client. Reads only, never writes. For one page:
 *
 *  1. `threads`: the caller's open chats, newest `updated_at` first (equal times: larger id first),
 *     keyset-paged, one row more than a page to know whether there is a next. With a search, only
 *     titles that contain it; without, untitled chats too. On the first page (no cursor), beside it,
 *     the same chats that are pinned: most recently pinned first (equal times: larger id first), at
 *     most `LIBRARY_PINNED_MAX`. The page lists those first, then its chats by last message without
 *     them, so a chat is listed once. Its `next` is the read by last message's alone, as before:
 *     later pages hold a pinned chat in its place by last message (one pinned past the cap is lost
 *     to none of them), and the screen drops a chat it already lists.
 *  2. `messages`: every message of the page's chats in one select, oldest first. Another select
 *     follows only when the server's row cap (`max_rows`, 1,000 on Supabase) cut the answer short.
 *  3. `analysis_results`: the caller's runs behind the page's video cards in one select, skipped when
 *     the page holds no video: whether each run still exists, its stored video path, its stored
 *     frames, and, only when some video on the page has no seal, the run's time and heatmap (what a
 *     video's number needs).
 *  4. `piece_posts` (after posting, plan 2026-11-24-after-posting): the caller's live posted links of
 *     the page's chats in one select, beside the messages. A chat with one is at stage "posted" and
 *     carries it as it leaves the server (`toPosted`: never the pasted link or the kept reads); with
 *     several, the one linked last. Its `sim` (the gauge) stays what Maven said.
 *
 * Then each chat is summarised once by `chatSummaryOf`, over a seal map in which a deleted run's seal
 * is left out and an unsealed run gets the seal the card route would have written. An untitled chat
 * that is a plain chat (or empty) is left out. Only the summaries leave: no message body and no
 * simulated text (a text's link carries its result page's key), no population, personas, heatmap,
 * transcript or frames data.
 *
 * Ownership: the service client bypasses row-level security, so every select is scoped by hand, as
 * `listOpenThreads` does: threads, runs and posted links by `user_id`; messages (which have no user
 * column) by the ids of the threads the scoped thread select returned.
 */

import type { HeatmapPayload } from "@/lib/engine/types";
import { toPosted, type PiecePostRow, type Posted } from "@/lib/posted/posted";
import { postsOfThreads } from "@/lib/posted/posted-repo";
import { createServiceClient } from "@/lib/supabase/service";
import { sealHashOf } from "@/lib/thread-next/seal-hash";
import { readSimSeals, type SimSeal, type SimSealMap, type SimSealVideo } from "@/lib/threads/sim-seals";
import { chatSummaryOf, piecesOf, type ChatSummary, type PieceKind, type Stage } from "./chat-summary";

export const LIBRARY_PAGE_SIZE = 30;
/** The pinned chats the first page leads with, at most. */
export const LIBRARY_PINNED_MAX = 30;
/** The longest search text asked for, in characters; a longer one is cut. */
export const LIBRARY_SEARCH_MAX = 80;

/** `ChatSummary["sim"]` as it leaves the server: a text's link carries its result page's key, not the text. */
export interface LibrarySim {
  number: number;
  measure: "stop" | "end";
  at: string;
  kind: PieceKind;
  link: { type: "video"; analysisId: string } | { type: "text"; key: string; as: "hook" | "idea" | "opening" };
}

/** A chat's stage in the Library: the summary's, or "posted" once one of its pieces has a posted link. */
export type LibraryStage = Stage | "posted";

export interface LibrarySummary {
  counts: ChatSummary["counts"];
  lead: PieceKind;
  stage: LibraryStage;
  sim: LibrarySim | null;
  /** A stored frame of the row's video (a signed address that may have expired), or null. */
  frame: string | null;
  /** The stored file of the row's video, for a still when no frame is stored; null when there is none. */
  videoPath: string | null;
  /** The chat's posted piece (the one linked last), as it leaves the server, or null. */
  posted: Posted | null;
}

export interface LibraryChat {
  id: string;
  /** Null for an untitled chat (the screen names it). */
  title: string | null;
  updatedAt: string;
  pinned: boolean;
  summary: LibrarySummary;
}

/**
 * One page. `next` is decided by the rows read, not by the chats sent: untitled chats that hold
 * nothing are left out after reading, so a page can hold fewer than 30 chats, even none, and still
 * have a `next`. Ask for the next page until `next` is null.
 */
export interface LibraryPage {
  chats: LibraryChat[];
  next: string | null;
}

type Db = ReturnType<typeof createServiceClient>;

// ─── The cursor ──────────────────────────────────────────────────────────────

/** Where the page before ended: its last chat's stored `updated_at` (to the microsecond) and id. */
interface Cursor {
  updatedAt: string;
  id: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A `timestamptz` as PostgREST writes it ("2026-11-21T10:00:00.123456+00:00"). Nothing else gets in. */
const STORED_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::\d{2}){0,2})$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function encodeCursor(c: Cursor): string {
  return Buffer.from(`${c.updatedAt}|${c.id}`, "utf8").toString("base64url");
}

/**
 * The cursor a page's `next` carries, or null when `raw` is not one. Strict, because its two halves
 * are written into the select's filter: the base64url alphabet only, the one canonical encoding (the
 * decoder alone skips stray characters), a stored time and a uuid.
 */
export function decodeLibraryCursor(raw: string): Cursor | null {
  if (!BASE64URL.test(raw)) return null;
  const text = Buffer.from(raw, "base64url").toString("utf8");
  if (Buffer.from(text, "utf8").toString("base64url") !== raw) return null;
  const parts = text.split("|");
  if (parts.length !== 2) return null;
  const [updatedAt, id] = parts as [string, string];
  if (!STORED_TIME.test(updatedAt) || !Number.isFinite(Date.parse(updatedAt)) || !UUID.test(id)) return null;
  return { updatedAt, id };
}

// ─── The search ──────────────────────────────────────────────────────────────

/** The text searched for: trimmed, at most 80 characters (whole characters, never half of one). */
function searchTextOf(q: string | null | undefined): string {
  if (typeof q !== "string") return "";
  // A NUL cannot be in a Postgres text and would fail the select.
  return Array.from(q.replace(/\u0000/g, "").trim()).slice(0, LIBRARY_SEARCH_MAX).join("");
}

/**
 * `text` as a Postgres regular expression that matches exactly it. A regex and not ILIKE: PostgREST
 * turns every `*` of an ILIKE pattern into `%` with no way to escape it, so ILIKE cannot match a
 * literal `*`. Here every sign is escaped (`\` followed by a non-alphanumeric character is that
 * character, in Postgres AREs as in JavaScript), and `%` and `_` are not signs at all.
 */
function literalPattern(text: string): string {
  return text.replace(/[\\^$.|?*+()[\]{}]/g, "\\$&");
}

// ─── The runs ────────────────────────────────────────────────────────────────

/** A run id as the analyze route mints them (uuid or nanoid). Anything else is not looked up. */
const RUN_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** `frames` is the run's `variants.filmstrip_segments`, read on its own (the rest of `variants` is not). */
const RUN_COLUMNS = "id, deleted_at, video_storage_path, frames:variants->filmstrip_segments";
const RUN_COLUMNS_WITH_NUMBER =
  "id, deleted_at, video_storage_path, created_at, heatmap, frames:variants->filmstrip_segments";

interface Run {
  id: string;
  deleted_at: string | null;
  /** Null for a text run, and once the retention sweep has removed the file. */
  video_storage_path: string | null;
  frames: unknown;
  created_at?: string | null;
  heatmap?: unknown;
}

/** The first stored frame address of a run (the lowest scene index that has one), or null. */
function firstFrameOf(frames: unknown): string | null {
  if (!Array.isArray(frames)) return null;
  let best: { idx: number; uri: string } | null = null;
  for (const f of frames) {
    if (!f || typeof f !== "object") continue;
    const { idx, keyframe_uri: uri } = f as { idx?: unknown; keyframe_uri?: unknown };
    if (typeof uri !== "string" || uri.length === 0) continue;
    const at = typeof idx === "number" && Number.isFinite(idx) ? idx : Number.POSITIVE_INFINITY;
    if (!best || at < best.idx) best = { idx: at, uri };
  }
  return best?.uri ?? null;
}

/**
 * The seal `/api/tools/test/card` writes for a finished run (step 9b), built from the run's own row,
 * for a video the chat holds without one (video seals are written only with AMBIENT_V2 on). In
 * memory only: handed to `chatSummaryOf`, never stored, never sent.
 *
 * `chatSummaryOf` reads a video seal's `heatmap` and `at` only, so the heavy depth the card route also
 * copies (transcript, craft signals, the fold's population) is not read for it and stays empty. The
 * card route's own write condition (a curve and a hold) is not applied: the number is whatever the
 * result page draws from this heatmap (`audienceOf`), and no audience means no number.
 */
function sealOfRun(run: Run): SimSeal | null {
  const stored = run.heatmap;
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
  const heatmap = stored as HeatmapPayload; // the engine's stored `analysis_results.heatmap` shape
  const hold = heatmap.weighted_hook_score ?? heatmap.weighted_completion_pct ?? null;
  const pct = typeof hold === "number" && Number.isFinite(hold) ? Math.max(0, Math.min(100, Math.round(hold * 100))) : 0;
  const video: SimSealVideo = { analysisId: run.id, stopPct: pct, craftScore: null, heatmap, videoSignals: null, verbatim: null };
  return { pct, band: null, at: run.created_at ?? "", video };
}

async function readRuns(db: Db, userId: string, ids: readonly string[], withNumber: boolean): Promise<Map<string, Run>> {
  const { data, error } = await db
    .from("analysis_results")
    .select(withNumber ? RUN_COLUMNS_WITH_NUMBER : RUN_COLUMNS)
    .eq("user_id", userId)
    .in("id", [...ids]);
  if (error) throw new Error(`analysis_results read failed: ${error.message}`);
  return new Map(((data ?? []) as unknown as Run[]).map((run) => [run.id, run]));
}

// ─── The messages ────────────────────────────────────────────────────────────

/** Rows asked for per select. The server may answer fewer (its `max_rows`); the count says if more. */
const MESSAGES_PER_SELECT = 1000;

/** Each chat's stored message bodies, oldest first. */
async function readBodies(db: Db, threadIds: readonly string[]): Promise<Map<string, unknown[]>> {
  const bodies = new Map<string, unknown[]>(threadIds.map((id) => [id, []]));
  let total: number | null = null;
  for (let read = 0; total === null || read < total; ) {
    const { data, error, count } = await db
      .from("messages")
      .select("thread_id, body, created_at", read === 0 ? { count: "exact" } : undefined)
      .in("thread_id", [...threadIds])
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }) // a total order, so a second select continues where the first ended
      .range(read, read + MESSAGES_PER_SELECT - 1);
    if (error) throw new Error(`messages read failed: ${error.message}`);
    const rows = data ?? [];
    if (total === null) total = count ?? rows.length;
    for (const row of rows) bodies.get(row.thread_id)?.push(row.body);
    if (rows.length === 0) break;
    read += rows.length;
  }
  return bodies;
}

// ─── The page ────────────────────────────────────────────────────────────────

const own = (map: object, key: string) => Object.prototype.hasOwnProperty.call(map, key);
const hasVideoSeal = (seals: SimSealMap, id: string) => own(seals, id) && !!seals[id]?.video;

/** The simulation as it leaves: a text's result page key (`sealHashOf`, as every link computes it), never the text. */
async function librarySimOf(sim: ChatSummary["sim"]): Promise<LibrarySim | null> {
  if (!sim) return null;
  const { number, measure, at, kind, link } = sim;
  if (link.type === "video") return { number, measure, at, kind, link: { type: "video", analysisId: link.analysisId } };
  return { number, measure, at, kind, link: { type: "text", key: await sealHashOf(link.text), as: link.as } };
}

/**
 * The row's simulation for a chat with a posted piece (ruling 31): the posted piece itself, as Maven said it
 * when the link was added (`said_*`, so the row and the piece's card always agree, also after the piece is
 * simulated again), at `said_at` (else the link's time), its kind, and a link to its own result page. A text
 * piece's `as` is the one the chat's own card of it gets (`piecesOf`, matched by the result-page key; the
 * later card when two hold it, as `piece-said.ts` chose its kind); with no such card, the result page's own
 * default ("hook", as `textResultHref`).
 */
async function postedSimOf(post: PiecePostRow, bodies: readonly unknown[]): Promise<LibrarySim> {
  const base = {
    number: post.said_number,
    measure: post.said_measure === "end" ? ("end" as const) : ("stop" as const),
    at: post.said_at ?? post.created_at,
    kind: post.piece_kind as PieceKind,
  };
  if (post.piece_kind === "video") return { ...base, link: { type: "video", analysisId: post.piece_key } };
  let as: Extract<LibrarySim["link"], { type: "text" }>["as"] = "hook";
  for (const piece of piecesOf(bodies)) {
    if (piece.kind !== "video" && (await sealHashOf(piece.key)) === post.piece_key) as = piece.as;
  }
  return { ...base, link: { type: "text", key: post.piece_key, as } };
}

/**
 * One page of `userId`'s chats. `cursor` is the `next` of the page before (a malformed one throws:
 * check it with `decodeLibraryCursor` first); `q` searches the titles. Throws on a database error.
 */
export async function readLibraryPage(
  userId: string,
  opts: { cursor?: string | null; q?: string | null },
): Promise<LibraryPage> {
  const after = opts.cursor ? decodeLibraryCursor(opts.cursor) : null;
  if (opts.cursor && !after) throw new RangeError("readLibraryPage: malformed cursor");
  const search = searchTextOf(opts.q);
  const db = createServiceClient();
  const now = new Date();

  // 1. The chats: the caller's open ones (every read starts from this scope). Without a search,
  // untitled ones too: whether they hold anything is known only once their messages are read (a
  // video-only chat often has no title).
  const callersChats = () => {
    let threads = db
      .from("threads")
      .select("id, title, updated_at, pinned_at, sim_seals")
      .eq("user_id", userId)
      .eq("type", "open")
      .is("reading_id", null);
    if (search) {
      threads = threads
        .not("title", "is", null)
        .regexMatch("title", "\\S") // not blank
        .regexIMatch("title", literalPattern(search));
    }
    return threads;
  };
  let byTime = callersChats();
  if (after) {
    // Older, or the same time and a smaller id. Quoted: a stored time holds `:` and `.`.
    byTime = byTime.or(`updated_at.lt."${after.updatedAt}",and(updated_at.eq."${after.updatedAt}",id.lt."${after.id}")`);
  }
  // On the first page, beside it, the pinned ones (the same scope and search).
  const [timeRead, pinRead] = await Promise.all([
    byTime
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(LIBRARY_PAGE_SIZE + 1),
    after
      ? null
      : callersChats()
          .not("pinned_at", "is", null)
          .order("pinned_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(LIBRARY_PINNED_MAX),
  ]);
  if (timeRead.error) throw new Error(`threads read failed: ${timeRead.error.message}`);
  if (pinRead?.error) throw new Error(`threads read failed: ${pinRead.error.message}`);

  const rows = timeRead.data ?? [];
  const page = rows.slice(0, LIBRARY_PAGE_SIZE);
  const last = page[page.length - 1];
  const next = rows.length > LIBRARY_PAGE_SIZE && last ? encodeCursor({ updatedAt: last.updated_at, id: last.id }) : null;

  // The pinned chats first, then the page's by last message without them: each chat once, and each
  // summarised once below.
  const pinned = pinRead?.data ?? [];
  const pinnedIds = new Set(pinned.map((row) => row.id));
  const ordered = [...pinned, ...page.filter((row) => !pinnedIds.has(row.id))];
  if (ordered.length === 0) return { chats: [], next };

  // 2. What they hold, and (4.) their posted links, linked last first: a chat's first is its own.
  const ids = ordered.map((row) => row.id);
  const [bodiesById, posts] = await Promise.all([readBodies(db, ids), postsOfThreads(db, userId, ids)]);
  const postedOf = new Map<string, PiecePostRow>();
  for (const post of posts) if (post.thread_id !== null && !postedOf.has(post.thread_id)) postedOf.set(post.thread_id, post);
  const chats = ordered.map((row) => {
    const bodies = bodiesById.get(row.id) ?? [];
    const videos = piecesOf(bodies).flatMap((p) => (p.kind === "video" ? [p.analysisId] : []));
    return { row, bodies, seals: readSimSeals(row), videos };
  });

  // 3. The runs behind their videos.
  const runIds = [...new Set(chats.flatMap((c) => c.videos))].filter((id) => RUN_ID.test(id));
  const unsealed = chats.some((c) => c.videos.some((id) => RUN_ID.test(id) && !hasVideoSeal(c.seals, id)));
  const runs = runIds.length > 0 ? await readRuns(db, userId, runIds, unsealed) : new Map<string, Run>();
  const live = (id: string): Run | null => {
    const run = runs.get(id);
    return run && run.deleted_at == null ? run : null;
  };

  const listed = await Promise.all(
    chats.map(async ({ row, bodies, seals, videos }): Promise<LibraryChat | null> => {
      const title = typeof row.title === "string" && /\S/.test(row.title) ? row.title : null;

      // A deleted run (or one not among the caller's rows) does not count; an unsealed live one does.
      const counted: SimSealMap = { ...seals };
      for (const id of videos) {
        const run = live(id);
        if (hasVideoSeal(seals, id)) {
          if (!run) delete counted[id];
        } else if (run) {
          const seal = sealOfRun(run);
          if (seal) counted[id] = seal;
        }
      }
      const summary = chatSummaryOf(bodies, counted);
      // An untitled chat with nothing in it (only chat turns, or no message) has nothing to show.
      if (title === null && summary.stage === "chat") return null;

      // The row's video: the simulated one, else (nothing simulated) the last one; none when a text
      // was simulated last. Its picture: the run's stored frames first, else what the seal's heatmap
      // recorded. Its stored file, while the retention sweep has not removed it. Neither for a
      // deleted run.
      const pictured = summary.sim
        ? summary.sim.link.type === "video"
          ? summary.sim.link.analysisId
          : null
        : (videos[videos.length - 1] ?? null);
      let frame = summary.frame;
      let videoPath: string | null = null;
      if (pictured !== null) {
        const run = live(pictured);
        frame = run ? (firstFrameOf(run.frames) ?? summary.frame) : null;
        const path = run?.video_storage_path;
        videoPath = typeof path === "string" && path.length > 0 ? path : null;
      }

      const post = postedOf.get(row.id);
      return {
        id: row.id,
        title,
        updatedAt: row.updated_at,
        pinned: row.pinned_at !== null,
        summary: {
          counts: summary.counts,
          lead: summary.lead,
          stage: post ? "posted" : summary.stage,
          // A posted chat's row is about its posted piece (ruling 31); its counts, lead and frame stay the chat's.
          sim: post ? await postedSimOf(post, bodies) : await librarySimOf(summary.sim),
          frame,
          videoPath,
          posted: post ? toPosted(post, now) : null,
        },
      };
    }),
  );

  return { chats: listed.filter((chat): chat is LibraryChat => chat !== null), next };
}
