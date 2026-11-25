/**
 * posted.ts — the rules of a posted piece (plan 2026-11-24-after-posting, "Constants and contracts"):
 * which pasted link may reach the reader, when a post was made, which account it is on, what state its
 * numbers are in, the account's usual, whether a read is owed, and the one shape that leaves the server.
 *
 * Pure: no React, no server imports, no clock (every rule that needs the time is given `now`). Types are
 * imported from the generated database types and the Library's summary, never values.
 *
 * `toPosted(row, now)` is the only place a stored row becomes what leaves the server. Text from outside the
 * app (a caption, an author's name, the pasted link) never reaches a `Posted`: the link shown is built from
 * the validated handle and post id.
 */

import type { PieceKind } from "@/lib/library/chat-summary";
import type { Database } from "@/types/database.types";

export const SETTLE_HOURS = 72; // a post's numbers are final from here
export const REFRESH_HOURS = 12; // an unsettled post is read again at most this often
export const USUAL_MIN_POSTS = 5; // fewer settled posts than this: no usual
export const USUAL_ABOVE = 1.5; // ratio as shown, one decimal, from which "x your usual" is green
export const USUAL_BELOW = 0.6; // ratio as shown, one decimal, up to which it is coral
export const MAX_ATTEMPTS = 3; // failed reads in a row after which a post with numbers is tried only every 12 h (rulings 14, 19a)
export const RETRY_MINUTES = 10; // wait between failed reads
export const RETRY_MAX = 8; // failed reads in a row after which "Try again" reads a post no more (ruling 27)
export const LINKS_PER_DAY = 20; // links one person may add in 24 hours
export const READS_KEPT = 12; // kept reads per post, newest last

/** The table's limits, held equal to the migration by `__tests__/migration.test.ts`. */
export const POST_LINK_MAX = 500;
export const PIECE_KEY_MAX = 200;
export const POST_ID_PATTERN = /^[0-9]{5,25}$/;
export const HANDLE_PATTERN = /^[a-z0-9._]{1,50}$/;
/** A video's analysis id as the analyze route mints them (uuid or nanoid), the Library's own rule. */
export const ANALYSIS_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
/** A chat's id (and any row's): a uuid, checked before it reaches a query (a malformed one is a 22P02, not a "not found"). */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const SAID_MEASURES = ["stop", "end"] as const;
export const READ_ERRORS = ["gone", "failed"] as const;

/** What a posted piece can be: the Library's piece kinds, without a plain chat or an edit (an edit's post is piece 3's). */
export type PostedPieceKind = Exclude<PieceKind, "chat" | "edit">;
/** Every kind once (a kind added to `PieceKind` and missing here, or one too many, fails the types). */
const KINDS = { video: true, script: true, remix: true, hooks: true, ideas: true, text: true } satisfies Record<PostedPieceKind, true>;
export const PIECE_KINDS = Object.keys(KINDS) as readonly PostedPieceKind[];

/** One stored row of `piece_posts`, as the generated types have it. */
export type PiecePostRow = Database["public"]["Tables"]["piece_posts"]["Row"];

export type PostedState = "reading" | "so-far" | "final" | "unread";
export interface PostedNumbers {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}
export interface PostedUsual {
  ratio: number;
  tone: "above" | "around" | "below";
}
/** One posted piece as it leaves the server. */
export interface Posted {
  id: string;
  threadId: string | null;
  pieceKey: string; // a video's analysis id, or a text piece's result-page key
  said: { number: number; measure: "stop" | "end" };
  state: PostedState;
  linkedAt: string; // ISO
  postedAt: string | null; // ISO; null until the first read
  finalAt: string | null; // postedAt + 72 h; without a post time, 72 h after the link (ruling 6)
  numbers: PostedNumbers | null;
  usual: PostedUsual | null; // only when state is "final"
  handle: string | null;
  href: string | null; // https://www.tiktok.com/@<handle>/video/<id>
  due: boolean; // a read is owed now
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const SETTLE_MS = SETTLE_HOURS * HOUR_MS;
/** No TikTok post is older than this. */
const EARLIEST_POST_MS = Date.UTC(2016, 0, 1);
/** The scraper fills a missing post time with the time of the read: a time this close to it is not one. */
const FILLED_TIME_MS = 5 * MINUTE_MS;

/** A stored or given time, or null when there is none or it cannot be read. */
function timeOf(value: string | Date | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}
const isoOf = (value: string | null): string | null => {
  const ms = timeOf(value);
  return ms === null ? null : new Date(ms).toISOString();
};

// ─── The pasted link ────────────────────────────────────────────────────────

/** Repeated from `isAllowedPostUrl` (`src/lib/scraping/apify-provider.ts`), a server module this pure one
 *  cannot import. `__tests__/posted.test.ts` feeds both one table of links and holds them alike. */
const POST_HOST_SUFFIXES = [".tiktok.com", ".tiktokv.com"] as const;
const PRIVATE_HOST_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
  /^localhost$/i,
];
/** A space, a line break or another control character inside the link. */
const INNER_BREAK = /[\s\u0000-\u001f\u007f]/;

/**
 * The pasted link trimmed, when it may reach the reader; else null. The scraper's own rule (`https:`, a host
 * that ends with `.tiktok.com` or `.tiktokv.com`, never the bare apex, no private address), plus: at most
 * 500 characters (as the database counts them), and no space or line break inside. The URL parser drops a
 * line break silently, so "https://www.tik\ntok.com/…" would otherwise pass as tiktok.com.
 */
export function parsePostLink(text: string): string | null {
  if (typeof text !== "string") return null;
  const link = text.trim();
  if (link === "" || Array.from(link).length > POST_LINK_MAX || INNER_BREAK.test(link)) return null;
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname;
  if (PRIVATE_HOST_PATTERNS.some((re) => re.test(host))) return null;
  return POST_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix)) ? link : null;
}

// ─── A post's time ──────────────────────────────────────────────────────────

/**
 * When a TikTok post was made, from its id: the top 32 bits are the creation time in seconds since 1970.
 * Null for an id that is not 5 to 25 digits, or a time before 2016-01-01 or more than a day after `now`.
 */
export function postIdTime(postId: string, now: Date): Date | null {
  if (typeof postId !== "string" || !POST_ID_PATTERN.test(postId)) return null;
  const ms = Number(BigInt(postId) >> BigInt(32)) * 1000;
  return ms >= EARLIEST_POST_MS && ms <= now.getTime() + DAY_MS ? new Date(ms) : null;
}

/**
 * A post's `posted_at`: the time in its id; without one, the scraper's time, but only when it is more than
 * five minutes before the read (the scraper fills a missing time with "now", ruling 2).
 */
export function postedAtOf(postId: string | null, scraperTime: Date | null, readAt: Date): Date | null {
  const fromId = postId === null ? null : postIdTime(postId, readAt);
  if (fromId) return fromId;
  const ms = timeOf(scraperTime);
  if (ms === null || ms < EARLIEST_POST_MS || ms >= readAt.getTime() - FILLED_TIME_MS) return null;
  return new Date(ms);
}

// ─── The link shown, and the account ────────────────────────────────────────

/** The post's own address, built from a valid handle and id; never from pasted text. */
export function postHref(handle: string | null, postId: string | null): string | null {
  if (typeof handle !== "string" || typeof postId !== "string") return null;
  if (!HANDLE_PATTERN.test(handle) || !POST_ID_PATTERN.test(postId)) return null;
  return `https://www.tiktok.com/@${handle}/video/${postId}`;
}

/** What `handleOf` reads of a scraped video (`VideoData` has it). */
export interface HandleSource {
  videoUrl?: string | null;
  author?: { handle?: string | null } | null;
}

const CANONICAL_PATH = /^\/@([^/]+)\/video\/[0-9]+\/?$/;

function cleanHandle(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const handle = raw.trim().replace(/^@/, "").toLowerCase();
  return HANDLE_PATTERN.test(handle) ? handle : null;
}

function handleInLink(link: string | null | undefined): string | null {
  if (typeof link !== "string" || link === "") return null;
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.hostname !== "tiktok.com" && !url.hostname.endsWith(".tiktok.com")) return null;
  return cleanHandle(CANONICAL_PATH.exec(url.pathname)?.[1]);
}

/** The account a scraped post is on: from its canonical link (`/@<handle>/video/<id>`), else the author's
 *  handle; lower case, without "@"; null when neither is a valid handle. */
export function handleOf(video: HandleSource): string | null {
  return handleInLink(video.videoUrl) ?? cleanHandle(video.author?.handle);
}

// ─── States ─────────────────────────────────────────────────────────────────

type StateRow = Pick<PiecePostRow, "read_error" | "attempts" | "settled_at" | "read_at" | "views" | "likes" | "comments" | "shares" | "saves">;

/** The numbers last read, or null when none were ever read. */
function numbersOf(row: Pick<PiecePostRow, "views" | "likes" | "comments" | "shares" | "saves">): PostedNumbers | null {
  const { views, likes, comments, shares, saves } = row;
  if (views === null || likes === null || comments === null || shares === null || saves === null) return null;
  return { views: Number(views), likes: Number(likes), comments: Number(comments), shares: Number(shares), saves: Number(saves) };
}

/** Gone, or never read and its last read failed (ruling 19a: one failed first read is enough; "Try again"
 *  starts another). A failed read never hides numbers already read (ruling 14): a post with numbers is never
 *  unread for failures, only when it is gone. */
const isUnread = (row: Pick<PiecePostRow, "read_error" | "read_at">): boolean =>
  row.read_error === "gone" || (row.read_at === null && row.read_error !== null);

/**
 * `final` once settled with numbers (also a post closed at its `RETRY_MAX`-th failure, gone or not: ruling 34);
 * `unread` when the post is gone, or when it was never read and its last read failed; `reading` until numbers
 * were read; else `so-far` (also when later reads failed: ruling 14). No state depends on the
 * clock (a row becomes final only when the reader settles it).
 */
export function stateOf(row: StateRow): PostedState {
  const numbers = numbersOf(row);
  // Settled with numbers is final, also a post closed at its last failed read, found gone (ruling 34).
  if (row.settled_at !== null && numbers !== null) return "final";
  if (isUnread(row)) return "unread";
  if (numbers === null) return "reading";
  return "so-far";
}

// ─── The usual ──────────────────────────────────────────────────────────────

/** What `usualOf` reads of a scraped post (`VideoData` has it). */
export interface UsualVideo {
  platformVideoId: string;
  views: number;
  postedAt: Date;
  isPinned?: boolean;
}

/**
 * The account's usual views: the median of the given posts' views (not pinned, not `excludePostId`, each
 * made at least 72 hours before `now`, each counted once) and how many it rests on. A post's age is taken
 * from its id first (`postedAtOf`). Null under five posts, and for a median of 0.
 */
export function usualOf(videos: readonly UsualVideo[], excludePostId: string | null, now: Date): { views: number; posts: number } | null {
  const seen = new Set<string>();
  const views: number[] = [];
  for (const v of videos) {
    if (v.isPinned || v.platformVideoId === excludePostId || seen.has(v.platformVideoId)) continue;
    if (!Number.isFinite(v.views) || v.views < 0) continue;
    const at = postedAtOf(v.platformVideoId, v.postedAt, now);
    if (at === null || now.getTime() - at.getTime() < SETTLE_MS) continue;
    seen.add(v.platformVideoId);
    views.push(v.views);
  }
  if (views.length < USUAL_MIN_POSTS) return null;
  views.sort((a, b) => a - b);
  const mid = Math.floor(views.length / 2);
  const median = views.length % 2 === 1 ? views[mid]! : (views[mid - 1]! + views[mid]!) / 2;
  const rounded = Math.round(median);
  return rounded > 0 ? { views: rounded, posts: views.length } : null;
}

/**
 * The colour of "× your usual", decided on the ratio as shown (ruling 7): green from a shown 1.5×, coral up to
 * a shown 0.6×, ink between. It rounds what it is given itself (`roundRatio`), so a raw ratio and its shown
 * value always get the same colour: raw 1.45 shows 1.5 (green), raw 1.449 shows 1.4 (ink), raw 0.65 shows 0.7
 * (ink), raw 0.649 shows 0.6 (coral).
 */
export function toneOf(ratio: number): PostedUsual["tone"] {
  const shown = roundRatio(ratio);
  if (shown >= USUAL_ABOVE) return "above";
  if (shown <= USUAL_BELOW) return "below";
  return "around";
}

/**
 * A ratio as the words show it. The rule: under 0.1, not rounded (shown as "under 0.1×"); under 10, half up at
 * the first decimal (`Math.round(ratio × 10) / 10`: 1.45 → 1.5, 1.449 → 1.4, 0.65 → 0.7, 9.96 → 10); from 10,
 * half up to a whole number (12.4 → 12). Checked for every x.x5 below 10 and for every views / usual pair of
 * whole numbers in the tests' ranges: the binary product never misrounds a half. Rounding a shown value again
 * changes nothing.
 */
export function roundRatio(ratio: number): number {
  if (ratio < 0.1) return ratio;
  const tenth = Math.round(ratio * 10) / 10;
  return tenth >= 10 ? Math.round(ratio) : tenth;
}

// ─── A read owed ────────────────────────────────────────────────────────────

/**
 * When a post's numbers become final: 72 hours after the post, or, when its time is unknown, 72 hours after
 * the link (`posted_at ?? created_at`, ruling 6: a post is always made before it is linked, so this is never
 * early). Null only when neither time can be read. The reader settles a row by this time too.
 */
export function finalAtOf(row: Pick<PiecePostRow, "posted_at" | "created_at">): Date | null {
  const start = timeOf(row.posted_at) ?? timeOf(row.created_at);
  return start === null ? null : new Date(start + SETTLE_MS);
}

type DueRow = StateRow & Pick<PiecePostRow, "last_attempt_at" | "read_at" | "posted_at" | "created_at">;

/**
 * Whether a read is owed now: never once settled, unread, or spent (`RETRY_MAX` failures in a row, ruling 34);
 * not within ten minutes of a failed read; after
 * `MAX_ATTEMPTS` failures in a row (a post with numbers: one without is unread), not within 12 hours of the
 * last attempt (ruling 14); yes when nothing was read yet; yes from `finalAtOf` (the settling read); else yes
 * when the last read is 12 hours old.
 */
export function isDue(row: DueRow, now: Date): boolean {
  // Never once settled, unread, or spent: `RETRY_MAX` failures in a row (ruling 34).
  if (row.settled_at !== null || isUnread(row) || row.attempts >= RETRY_MAX) return false;
  const t = now.getTime();
  const lastAttempt = timeOf(row.last_attempt_at);
  if (lastAttempt !== null && t - lastAttempt < RETRY_MINUTES * MINUTE_MS) return false;
  if (row.attempts >= MAX_ATTEMPTS && lastAttempt !== null && t - lastAttempt < REFRESH_HOURS * HOUR_MS) return false;
  const readAt = timeOf(row.read_at);
  if (readAt === null || numbersOf(row) === null) return true;
  const finalAt = finalAtOf(row);
  if (finalAt !== null && finalAt.getTime() <= t) return true;
  return t - readAt >= REFRESH_HOURS * HOUR_MS;
}

// ─── A read in progress ─────────────────────────────────────────────────────

/** How long a claimed read holds its post, at most, unless it ends sooner (rulings 18, 22, 26): the longest
 *  read can take (a single read waits up to 180 s on the scraper; real ones took 24 and 27 s). */
export const CLAIM_SECONDS = 240;

/**
 * Whether another read is on the post now (rulings 22, 26): its last attempt is under `CLAIM_SECONDS` old AND
 * has not ended. An attempt has ended when it failed (`read_error` set) or worked (`read_at` at or after it; a good
 * read writes both at the same time). A claim sets the attempt and clears `read_error`, so a claimed post
 * reads as in progress to every other caller until its read writes its end.
 */
export function isBeingRead(row: Pick<PiecePostRow, "last_attempt_at" | "read_error" | "read_at">, now: Date): boolean {
  const attempt = timeOf(row.last_attempt_at);
  if (attempt === null || now.getTime() - attempt >= CLAIM_SECONDS * 1000) return false;
  if (row.read_error !== null) return false;
  const readAt = timeOf(row.read_at);
  return readAt === null || readAt < attempt;
}

// ─── What leaves the server ─────────────────────────────────────────────────

/** One stored row as it leaves the server. The only place a row becomes a `Posted`. */
export function toPosted(row: PiecePostRow, now: Date): Posted {
  const state = stateOf(row);
  const numbers = numbersOf(row);
  const postedAt = isoOf(row.posted_at);
  const handle = typeof row.handle === "string" && HANDLE_PATTERN.test(row.handle) ? row.handle : null;
  const usualViews = row.usual_views === null ? null : Number(row.usual_views);
  let usual: PostedUsual | null = null;
  if (state === "final" && numbers && usualViews !== null && usualViews > 0) {
    const raw = numbers.views / usualViews;
    usual = { ratio: roundRatio(raw), tone: toneOf(raw) };
  }
  const finalAt = finalAtOf(row);
  return {
    id: row.id,
    threadId: row.thread_id,
    pieceKey: row.piece_key,
    said: { number: row.said_number, measure: row.said_measure === "end" ? "end" : "stop" },
    state,
    linkedAt: isoOf(row.created_at) ?? row.created_at,
    postedAt,
    finalAt: finalAt === null ? null : finalAt.toISOString(),
    numbers,
    usual,
    handle,
    href: postHref(handle, row.post_id),
    due: isDue(row, now),
  };
}
