/**
 * piece-said.ts — what Maven said about a piece, on the server, for its owner only (plan
 * 2026-11-24-after-posting, Task 2). Copied once into `piece_posts` when the link is added.
 *
 * SERVER ONLY in use (it takes a Supabase client; the routes give it the service client, so every select
 * is scoped by hand to the caller: chats and runs by `user_id`, messages by the id of the chat the scoped
 * select returned).
 *
 * - A text piece (hook, idea, script opening line, remix's adapted hook, brought text): the caller's chat
 *   and the stored simulation whose result-page key is `key`, found by the hook result page's own lookup
 *   (`textSealOfKey`), which also gives its number, `stopNumberOf(seal)` ("would stop to watch"); its time the seal's.
 *   Its kind is the kind of the chat's card that holds the text (the later card when two do; "text",
 *   brought text, when none of the chat's cards does).
 * - A video: the caller's live run. Its number is the result page's, `headlineOf(audienceOf(row))`
 *   ("watch to the end"), its time the run's. Its chat is the caller's chat whose stored simulations hold
 *   the analysis id as a key, the one written to last; none: no chat.
 *
 * A piece that is not the caller's (or not there, or one its result page would not show) is `not_found`;
 * a video run with no audience the page can draw (or still running) is `no_number`. Throws on a database
 * error, with the database's text (never a pasted link: none reaches this module).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { piecesOf } from "@/lib/library/chat-summary";
import { audienceOf } from "@/lib/result/curve";
import { headlineOf } from "@/lib/result/headline";
import type { ResultRow } from "@/lib/result/types";
import { isSealHash } from "@/lib/thread-next/seal-hash";
import { textSealOfKey } from "@/lib/thread-next/text-seal";
import { readSimSeals } from "@/lib/threads/sim-seals";
import type { Database } from "@/types/database.types";
import { ANALYSIS_ID_PATTERN, UUID_PATTERN, type PostedPieceKind } from "./posted";
import type { NewPost } from "./posted-repo";

type Db = SupabaseClient<Database>;

/** Which piece: a text one by its chat and result-page key, or a video by its analysis id. */
export type PieceRef = { kind: "text"; threadId: string; key: string } | { kind: "video"; analysisId: string };

/** The piece and what Maven said about it, as `insertPost` takes them (all but the link). */
export type PieceSaid = Omit<NewPost, "postUrl">;

export type PieceSaidResult = { found: true; piece: PieceSaid } | { found: false; why: "not_found" | "no_number" };

const NOT_FOUND = { found: false, why: "not_found" } as const;
const NO_NUMBER = { found: false, why: "no_number" } as const;

/** A stored time, or null when it is not one (the column is a `timestamptz`). */
const timeOrNull = (at: unknown): string | null => (typeof at === "string" && Number.isFinite(Date.parse(at)) ? at : null);

/** A number the table takes (0 to 100, whole), or null. */
const saidNumber = (n: number | null): number | null => (n !== null && Number.isInteger(n) && n >= 0 && n <= 100 ? n : null);

export async function pieceSaid(client: Db, userId: string, ref: PieceRef): Promise<PieceSaidResult> {
  return ref.kind === "text" ? textSaid(client, userId, ref.threadId, ref.key) : videoSaid(client, userId, ref.analysisId);
}

// ─── A text piece ────────────────────────────────────────────────────────────

async function textSaid(client: Db, userId: string, threadId: string, key: string): Promise<PieceSaidResult> {
  // A non-uuid id would be a 22P02 from Postgres, not a "not found".
  if (typeof threadId !== "string" || !UUID_PATTERN.test(threadId) || typeof key !== "string" || !isSealHash(key)) return NOT_FOUND;

  const { data: chat, error } = await client
    .from("threads")
    .select("id, sim_seals")
    .eq("id", threadId)
    .eq("user_id", userId) // ownership: the service client bypasses row level security
    .maybeSingle();
  if (error) throw new Error(`threads read failed: ${error.message}`);
  if (!chat) return NOT_FOUND;

  // Only a seal its result page shows can match, so a text piece found always has a number (0 to 100, whole):
  // a seal without one is not found, as on its page.
  const found = await textSealOfKey(readSimSeals(chat), key);
  if (!found) return NOT_FOUND;

  return {
    found: true,
    piece: {
      threadId: chat.id,
      pieceKey: key,
      pieceKind: await kindOfText(client, chat.id, found.text),
      said: { number: found.number, measure: "stop", at: timeOrNull(found.seal.at) },
    },
  };
}

/** The kind of the chat's card whose seal key is `text` (the later card when two are); brought text
 *  ("text") when no card of the chat holds it. One select of the chat's message bodies. */
async function kindOfText(client: Db, threadId: string, text: string): Promise<PostedPieceKind> {
  const { data, error } = await client
    .from("messages")
    .select("body")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(`messages read failed: ${error.message}`);
  let kind: PostedPieceKind = "text";
  for (const piece of piecesOf((data ?? []).map((row) => row.body))) {
    if (piece.kind !== "video" && piece.key === text) kind = piece.kind;
  }
  return kind;
}

// ─── A video ─────────────────────────────────────────────────────────────────

interface RunRow {
  id: string;
  created_at: string | null;
  heatmap: unknown;
  overall_score: number | string | null;
  engine_version: string | null;
}

/** The video result page's number for the run, or null when it shows none (as `videoStateOf` decides). */
function videoNumberOf(run: RunRow): number | null {
  // In flight: the analyze route's placeholder row, until the pipeline writes the run (`api/analysis/[id]`).
  if (run.overall_score == null && run.engine_version === "pending") return null;
  try {
    const audience = audienceOf({ id: run.id, heatmap: run.heatmap as ResultRow["heatmap"] });
    return audience ? saidNumber(headlineOf(audience).value) : null;
  } catch {
    // A stored heatmap broken inside: the page could not draw it either.
    return null;
  }
}

async function videoSaid(client: Db, userId: string, analysisId: string): Promise<PieceSaidResult> {
  if (typeof analysisId !== "string" || !ANALYSIS_ID_PATTERN.test(analysisId)) return NOT_FOUND;

  const { data, error } = await client
    .from("analysis_results")
    .select("id, created_at, heatmap, overall_score, engine_version")
    .eq("id", analysisId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`analysis_results read failed: ${error.message}`);
  if (!data) return NOT_FOUND;
  const run = data as unknown as RunRow;
  const number = videoNumberOf(run);
  if (number === null) return NO_NUMBER;

  // The chat that holds it: a stored simulation keyed by the analysis id (jsonb `@>`: any object under
  // that key contains `{}`). The id is a run id, so it is safe as a key.
  const { data: chats, error: chatError } = await client
    .from("threads")
    .select("id")
    .eq("user_id", userId)
    .contains("sim_seals", { [analysisId]: {} })
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);
  if (chatError) throw new Error(`threads read failed: ${chatError.message}`);

  return {
    found: true,
    piece: {
      threadId: chats?.[0]?.id ?? null,
      pieceKey: run.id,
      pieceKind: "video",
      said: { number, measure: "end", at: timeOrNull(run.created_at) },
    },
  };
}
