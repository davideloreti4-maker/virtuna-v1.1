/**
 * The Watchlist chip's rules (spec 3.5): what a followed creator's row says, which rows a search keeps,
 * what the Follow sheet accepts, and what a row's Remove clears. Pure; the read's type is imported as a
 * type only, so no server module enters a client bundle.
 */

import { classifyDiscoverInput } from "@/lib/discover/classify-input";
import type { WatchlistData, WatchlistSource } from "@/lib/discover/watchlist-reads";

import { DISCOVER_STRINGS, followers, provenTally } from "./discover-words";

/** What the hub draws of the watchlist read: its rows, and whether the read was whole. */
export type HubWatchlist = Pick<WatchlistData, "sources" | "incomplete">;

/** A TikTok handle Maven can read: lower-case letters, digits, dots and underscores, 2 to 24 of them. */
export const HANDLE_PATTERN = /^[a-z0-9._]{2,24}$/;

/** The covers a row draws at its right. */
export const ROW_COVERS = 3;

/** A handle as compared: trimmed, without its "@", lower case. */
const bare = (handle: string | null | undefined): string => (handle ?? "").trim().replace(/^@+/, "").toLowerCase();

/**
 * Under the handle: "162M followers", "· 12 proven" when Maven holds measured videos of the creator at
 * 3× or more, or "Couldn't be read" for a creator whose read failed with nothing kept. Null when there is
 * nothing to say (a count of 0 is a read that found none, not a number to print).
 */
export function rowLine(source: Pick<WatchlistSource, "held" | "followerCount" | "provenCount">): string | null {
  if (source.held) return DISCOVER_STRINGS.watchlist.held;
  const parts: string[] = [];
  if (source.followerCount && source.followerCount > 0) parts.push(followers(source.followerCount));
  if (source.provenCount && source.provenCount > 0) parts.push(provenTally(source.provenCount));
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * The rows a search keeps, in order: the handle or the name holds what is typed, in any case, the "@"
 * ignored. A pasted TikTok profile link is read as its handle. An empty search keeps every row.
 */
export function filterRows<T extends Pick<WatchlistSource, "handle" | "name">>(sources: readonly T[], q: string): T[] {
  const read = classifyDiscoverInput(q);
  const needle = (read.mode === "profile" ? read.normalized : q).replace(/@/g, "").trim().toLowerCase();
  if (!needle) return [...sources];
  return sources.filter((s) => s.handle.toLowerCase().includes(needle) || s.name.toLowerCase().includes(needle));
}

/**
 * What the Follow sheet sends: the handle of a TikTok @handle or profile link, when it is one Maven can
 * read; else null (nothing is sent, and the sheet says what it takes).
 */
export function followInput(text: string): string | null {
  const read = classifyDiscoverInput(text);
  if (read.mode !== "profile") return null;
  return HANDLE_PATTERN.test(read.normalized) ? read.normalized : null;
}

/** A creator already on the watchlist: a row's handle, or the spelling that folded into a row. */
export function isFollowed(sources: readonly Pick<WatchlistSource, "handle" | "mergedFrom">[], handle: string): boolean {
  const wanted = bare(handle);
  if (!wanted) return false;
  return sources.some((s) => bare(s.handle) === wanted || (s.mergedFrom != null && bare(s.mergedFrom) === wanted));
}

/** The creator's TikTok profile, for a handle Maven can read; else null (no link is offered). */
export function profileHref(handle: string | null | undefined): string | null {
  const h = bare(handle);
  return HANDLE_PATTERN.test(h) ? `https://www.tiktok.com/@${h}` : null;
}

/** What a row's Pull hands the pull page ("@jay.makes"), for a handle Maven can read; else null (no Pull). */
export function pullInput(handle: string | null | undefined): string | null {
  const h = bare(handle);
  return HANDLE_PATTERN.test(h) ? `@${h}` : null;
}

/** The records a row's Remove clears. */
export interface Removal {
  trackedIds: string[];
  competitorId: string | null;
}

/**
 * Every record a row rests on, so Remove clears the creator on every platform; null when it rests on
 * none the read could name (then the row offers no Remove).
 */
export function removalOf(source: Pick<WatchlistSource, "trackedIds" | "competitorId">): Removal | null {
  const trackedIds = [...(source.trackedIds ?? [])];
  const competitorId = source.competitorId ?? null;
  return trackedIds.length > 0 || competitorId !== null ? { trackedIds, competitorId } : null;
}

/**
 * A row's identity on screen. The read's key alone can repeat (one handle followed on two platforms
 * with no profile behind it gives two rows of one key), the records it rests on cannot.
 */
export function rowKey(source: Pick<WatchlistSource, "key" | "trackedIds" | "competitorId">): string {
  return [source.key, source.competitorId ?? "", ...(source.trackedIds ?? [])].join("|");
}

/**
 * A key for each row on screen, in order: its `rowKey`, and for a row whose key an earlier row already
 * has (the read can repeat one), that key with its place among its namesakes. React needs each once.
 */
export function rowKeys(sources: readonly Pick<WatchlistSource, "key" | "trackedIds" | "competitorId">[]): string[] {
  const seen = new Map<string, number>();
  return sources.map((source) => {
    const key = rowKey(source);
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return n === 1 ? key : `${key}#${n}`;
  });
}

/** The covers a row draws: the read's, newest first, each once, at most three. */
export function rowCovers(source: Pick<WatchlistSource, "covers">): string[] {
  return [...new Set(source.covers ?? [])].slice(0, ROW_COVERS);
}

/** The letter on the disc of a creator without a picture: the handle's first letter or digit. */
export function initialOf(handle: string): string {
  const first = bare(handle).match(/[\p{L}\p{N}]/u)?.[0];
  return first ? first.toUpperCase() : "@";
}
