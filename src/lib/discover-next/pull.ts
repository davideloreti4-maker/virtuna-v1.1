/**
 * Pulling a creator or words live (spec 3.6). The offer is a row, never a start: these rules say what
 * an input asks to pull, when the hub offers it, what a refused pull says, and how the answer's videos
 * become cards. Pure.
 *
 * - An input is a creator (a @handle or a TikTok profile link, read as TikTok writes it), a link to
 *   another platform (nothing to pull: the screen says only TikTok can be read), or words. A handle Maven
 *   cannot read, a lone "@" among them, offers nothing: a pull costs credits, and the server would only
 *   fail it.
 * - The length is counted as the server counts it (`/api/discover`: UTF-16 units), so nothing the screen
 *   offers is refused there for its length.
 * - A pulled video has no spoken line: its card shows the caption without its hashtags, marked as a
 *   caption so it is shown as written (the spoken line's placeholder rules are not for it). Its multiple is
 *   the server's receipt (against the creator's own average, or their followers), proven at 3× or more
 *   with a basis, clamped at 100 as the library's are.
 */

import { classifyDiscoverInput } from "@/lib/discover/classify-input";
import { DISCOVER_DAILY_CAP } from "@/lib/discover/discover-cache";

import { handleOf } from "./card";
import { DISCOVER_STRINGS, pullFailed, pullLimit } from "./discover-words";
import type { CardVideo } from "./hub-data";
import { webAddress } from "./video-words";
import { HANDLE_PATTERN } from "./watchlist";

/** The longest input the server takes (`/api/discover`, `MAX_INPUT_LENGTH`). */
export const PULL_INPUT_MAX = 200;

/** The fewest characters words need before they are worth a pull. */
const WORDS_MIN = 3;

/** A multiple from which a pulled video is proof, and the one past which it is shaky. */
export const PROVEN_FROM = 3;
export const EXTREME_FROM = 100;

/** What a pull reads: a creator ("@jay.makes") or words. `input` is what the server is sent. */
export type PullSubject =
  | { kind: "handle"; input: string; handle: string; shown: string }
  | { kind: "words"; input: string; handle: null; shown: string };

/** A link to another platform: said, never pulled. */
export interface NotTikTok {
  kind: "not-tiktok";
  input: string;
  shown: string;
}

export type PullTarget = PullSubject | NotTikTok;

/** What an input asks to pull, or null when there is nothing worth offering. */
export function pullSubjectOf(raw: string | null | undefined): PullTarget | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed.length > PULL_INPUT_MAX) return null;
  const read = classifyDiscoverInput(trimmed);
  if (read.mode === "profile") {
    if (!HANDLE_PATTERN.test(read.normalized)) return null;
    const at = `@${read.normalized}`;
    return { kind: "handle", input: at, handle: read.normalized, shown: at };
  }
  if (read.mode === "unsupported") return { kind: "not-tiktok", input: trimmed, shown: trimmed };
  if (Array.from(trimmed).length < WORDS_MIN) return null;
  return { kind: "words", input: trimmed, handle: null, shown: trimmed };
}

export interface OfferContext {
  /** How many of the library's proven videos the search finds, filters aside. */
  libraryMatches: number;
  /** Whether a creator (the bare handle) is on the watchlist already. */
  followed(handle: string): boolean;
}

/**
 * The row above the hub's grid for a search: a creator not followed yet (whatever the library holds of
 * them), a link to another platform (said, not offered), or words the library has no video for. Else none.
 */
export function offerFor(q: string, { libraryMatches, followed }: OfferContext): PullTarget | null {
  const target = pullSubjectOf(q);
  if (!target) return null;
  if (target.kind === "handle") return followed(target.handle) ? null : target;
  if (target.kind === "words") return libraryMatches === 0 ? target : null;
  return target;
}

/**
 * A refused pull, in words. Only "read" offers Try again: the others would get the same answer. A
 * "refused" pull says it could not be read, but the server turned the request away (a visitor it walls
 * off, a request from elsewhere, a request it cannot take), so a second press would be turned away too.
 */
export interface PullFailure {
  kind: "limit" | "not-tiktok" | "read" | "refused";
  sentence: string;
}

/** Answers a retry cannot change: the request is turned away, not the read failed. */
const TURNED_AWAY = new Set([403, 415]);

/** A field of an answer read as JSON, whatever its shape: undefined when it is not an object. */
export function field(body: unknown, key: string): unknown {
  return body !== null && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
}

/**
 * What a refused pull says, once the app's walls (no credits, a lapsed session) have had their turn:
 * the daily limit with the answer's own number (else the app's cap), a link the server cannot read, or
 * that the creator or the words could not be read (with no Try again when the request was turned away).
 */
export function pullFailureOf(status: number, body: unknown, subject: PullSubject): PullFailure {
  if (status === 429) {
    const limit = field(body, "limit");
    const n = typeof limit === "number" && Number.isInteger(limit) && limit > 0 ? limit : DISCOVER_DAILY_CAP;
    return { kind: "limit", sentence: pullLimit(n) };
  }
  if (status === 400 && field(body, "error") === "unsupported_input") {
    return { kind: "not-tiktok", sentence: DISCOVER_STRINGS.pull.notTikTok };
  }
  if (TURNED_AWAY.has(status)) return { kind: "refused", sentence: pullFailed(subject) };
  return { kind: "read", sentence: pullFailed(subject) };
}

/**
 * A video as `/api/discover` answers it. Written by hand: the route's type is a server module's, so the
 * compiler cannot hold the two together; every field is read as possibly missing.
 */
export interface PullTile {
  platformVideoId: string;
  videoUrl: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  postedAt: string;
  /** The receipt: against the creator's own average, or their followers; null with no honest basis. */
  multiplier: number | null;
  baselineLabel: string | null;
  coverUrl?: string;
  author?: { handle: string };
}

/** A pulled video as its card, its sheet and Save read it. */
export interface PulledVideo extends CardVideo {
  likes: number | null;
  comments: number | null;
  videoUrl: string | null;
}

/** A hashtag: "#" and a word holding at least one letter ("#1" is a number, and stays). */
const HASHTAG = /#(?=[\p{L}\p{N}_]*\p{L})[\p{L}\p{N}_]+/gu;

/** The caption as a card's line: without its hashtags, spaces collapsed; null when nothing is left. */
export function captionLine(caption: unknown): string | null {
  if (typeof caption !== "string") return null;
  const line = caption.replace(HASHTAG, " ").replace(/\s+/g, " ").trim();
  return line || null;
}

const finite = (n: unknown): number | null => (typeof n === "number" && Number.isFinite(n) ? n : null);
const count = (n: unknown): number | null => {
  const value = finite(n);
  return value !== null && value >= 0 ? value : null;
};
const text = (s: unknown): string | null => (typeof s === "string" && s.trim() ? s.trim() : null);

/** One pulled video as a card. */
export function pulledCardOf(tile: PullTile, subject: PullSubject): PulledVideo {
  const raw = finite(tile.multiplier);
  const baselineLabel = text(tile.baselineLabel);
  const proven = baselineLabel !== null && raw !== null && raw >= PROVEN_FROM;
  return {
    id: tile.platformVideoId,
    coverUrl: text(tile.coverUrl),
    handle: handleOf(tile.author?.handle) ?? subject.handle,
    spokenHook: captionLine(tile.caption),
    niche: null,
    platform: "tiktok",
    views: count(tile.views) ?? 0,
    postedAt: text(tile.postedAt),
    multiplier: raw === null ? null : Math.min(raw, EXTREME_FROM),
    baselineLabel,
    proven,
    extreme: raw !== null && raw >= EXTREME_FROM,
    formats: [],
    captioned: true,
    likes: count(tile.likes),
    comments: count(tile.comments),
    videoUrl: webAddress(tile.videoUrl),
  };
}

/**
 * The answer's videos as cards, in the server's order (its ranking is the order shown). An entry with
 * no id is skipped, a repeated id kept once. Not a list: null (the answer could not be read).
 */
export function pulledCardsOf(tiles: unknown, subject: PullSubject): PulledVideo[] | null {
  if (!Array.isArray(tiles)) return null;
  const cards: PulledVideo[] = [];
  const seen = new Set<string>();
  for (const entry of tiles) {
    const id = field(entry, "platformVideoId");
    if (typeof id !== "string" || !id || seen.has(id)) continue;
    seen.add(id);
    cards.push(pulledCardOf(entry as PullTile, subject));
  }
  return cards;
}

/** Where a pull stands: not started (the offer), reading, read, or refused. */
export type PullState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; videos: PulledVideo[] }
  | { kind: "failed"; failure: PullFailure };
