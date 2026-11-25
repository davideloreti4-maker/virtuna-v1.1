/**
 * A followed creator's page (`/competitors/<handle>`): what the server read hands the screen. Pure; the clock
 * is given (`now`), and what leaves here is plain data (no Date, no Map), so a server component can hand it
 * to the client.
 *
 * - The videos are those of the last read only: one read writes one time on all its rows, and an older
 *   read was measured against an older median. Biggest jump (the raw multiple) first, then views.
 * - A video becomes a pulled video (`pull.ts`), field by field as `pulledCardOf`, so its card and its sheet
 *   are the pull page's. The stored "vs own" label is handed on in words the multiple reads as "their
 *   average".
 * - The figures, the read's date and whether Read again may be pressed are worked out here, from `now`:
 *   the browser's clock is never asked.
 * - Their audience is another creator's audience among the caller's, read from this creator's handle (or
 *   the spelling that folded into it), by the Audience page's own rules.
 */

import type { Audience } from "@/lib/audience/audience-types";
import { kindOf, type Figure } from "@/lib/audience-next/audience-model";
import { AUDIENCE_STRINGS, readOn } from "@/lib/audience-next/audience-words";
import type { WatchlistSource } from "@/lib/discover/watchlist-reads";
import { HANDLE_PATTERN as ACCOUNT_HANDLE } from "@/lib/posted/posted";
import { viewsWord } from "@/lib/posted/posted-words";

import { isStoredCover } from "./covers";
import { creatorHandleOf } from "./discover-view";
import { EXTREME_FROM, PROVEN_FROM, captionLine, type PulledVideo } from "./pull";
import { webAddress } from "./video-words";
import { removalOf, type Removal } from "./watchlist";

/** A `competitor_profiles` row as the page reads it (service client, by id). */
export interface CreatorProfileRow {
  id: string;
  tiktok_handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  follower_count: number | null;
  heart_count: number | null;
  video_count: number | null;
  last_scraped_at: string | null;
  scrape_status: string | null;
}

/** A `scraped_videos` row as the page reads it (the caller's client). The three `metadata` keys arrive
 *  as text (`->>`); `outlier_multiplier` is numeric and may arrive as a string. */
export interface CreatorVideoRow {
  platform_video_id: string | null;
  video_url: string | null;
  description: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  posted_at: string | null;
  outlier_multiplier: number | string | null;
  baseline_label: string | null;
  cover_url: string | null;
  ingested_at: string | null;
  baseline_views: number | string | null;
}

/** The creator's audience among the caller's: its id, and the day of its read ("14 Nov"), or null. */
export interface CreatorAudience {
  id: string;
  builtOn: string | null;
}

/** What the page draws. Plain data (a server component hands it to the client): no Date, no Map. */
export interface CreatorPage {
  handle: string; // bare, lower case: the address, "@handle", the menus, Pull
  name: string | null; // the display name trimmed; null when none, or held
  bio: string | null; // trimmed; null when none, or held
  avatarUrl: string | null; // the stored picture; null when none, or held
  held: boolean; // the creator's read failed and nothing was kept ("Couldn't be read")
  read: string | null; // "read 13 Jul" ("read 13 Jul 2025" in another year); null: never read
  canReadAgain: boolean; // never read, or the last read is 24 hours old or older (the server's gate)
  figures: Figure[]; // Followers, Likes, Posts, Usual views: those known, in that order; none held
  videos: PulledVideo[]; // the last read's, biggest jump first; none held
  audience: CreatorAudience | null;
  removal: Removal | null; // the records Remove clears; null: no Remove
}

/** The server read's answer. `failed` is also what the route draws when the read throws. */
export type CreatorRead = { state: "ready"; creator: CreatorPage } | { state: "gone" } | { state: "failed" };

export interface CreatorInput {
  source: Pick<WatchlistSource, "held" | "mergedFrom" | "trackedIds" | "competitorId">;
  profile: CreatorProfileRow;
  videos: readonly CreatorVideoRow[];
  audiences: readonly Audience[];
  now: Date;
}

/** The ingest's stored label for a multiple measured against the creator's own median. */
export const OWN_LABEL = "vs own";
/** That label handed on in words `basisOf` reads as "their average" (`lib/multiple-words.ts`). */
export const OWN_AVERAGE_LABEL = "vs their average";
/** The ingest's gate (`CHANNEL_RESCRAPE_HOURS`, `lib/channels/ingest.ts`, a server module this pure one
 *  cannot import): a creator read less than this ago is answered "cached". */
export const READ_GATE_MS = 24 * 60 * 60 * 1000;

const text = (s: unknown): string | null => (typeof s === "string" && s.trim() ? s.trim() : null);
/** A number as stored: a finite number, or a numeric string; else null. */
const finite = (v: unknown): number | null => {
  const n = typeof v === "string" ? (v.trim() ? Number(v) : NaN) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const count = (v: unknown): number | null => ((n) => (n !== null && n >= 0 ? n : null))(finite(v));

/** One video of a read, as a pulled video's card and sheet draw it; null when it has no id. Field by field
 *  as `pulledCardOf` (`pull.ts`), so the two kinds of card cannot drift. */
export function creatorVideoOf(row: CreatorVideoRow, handle: string): PulledVideo | null {
  const id = text(row.platform_video_id);
  if (!id) return null;
  const raw = finite(row.outlier_multiplier);
  const stored = text(row.baseline_label);
  const baselineLabel = stored !== null && stored.toLowerCase() === OWN_LABEL ? OWN_AVERAGE_LABEL : stored;
  return {
    id,
    coverUrl: isStoredCover(row.cover_url) ? row.cover_url : null,
    handle,
    spokenHook: captionLine(row.description),
    niche: null,
    platform: "tiktok",
    views: count(row.views) ?? 0,
    postedAt: text(row.posted_at),
    multiplier: raw === null ? null : Math.min(raw, EXTREME_FROM),
    baselineLabel,
    proven: baselineLabel !== null && raw !== null && raw >= PROVEN_FROM,
    extreme: raw !== null && raw >= EXTREME_FROM,
    formats: [],
    captioned: true,
    likes: count(row.likes),
    comments: count(row.comments),
    videoUrl: webAddress(row.video_url),
  };
}

/** The rows of the last read: one read writes one `ingested_at` on all its rows; older reads were
 *  measured against an older median and are not mixed in. Rows without a readable time are left out. */
export function lastReadOf(rows: readonly CreatorVideoRow[]): CreatorVideoRow[] {
  const at = (row: CreatorVideoRow) => Date.parse(row.ingested_at ?? "");
  let newest = -Infinity;
  for (const row of rows) if (Number.isFinite(at(row)) && at(row) > newest) newest = at(row);
  return Number.isFinite(newest) ? rows.filter((row) => at(row) === newest) : [];
}

/** The last read's videos, biggest jump (the raw multiple) first, then views; and its stored median. */
export function creatorVideosOf(rows: readonly CreatorVideoRow[], handle: string): { videos: PulledVideo[]; usual: number | null } {
  const last = lastReadOf(rows);
  const raw = (row: CreatorVideoRow) => finite(row.outlier_multiplier) ?? -Infinity;
  const views = (row: CreatorVideoRow) => count(row.views) ?? 0;
  const sorted = [...last].sort(
    (a, b) => raw(b) - raw(a) || views(b) - views(a) || String(a.platform_video_id).localeCompare(String(b.platform_video_id)),
  );
  const seen = new Set<string>();
  const videos = sorted
    .map((row) => creatorVideoOf(row, handle))
    .filter((v): v is PulledVideo => v !== null && !seen.has(v.id) && Boolean(seen.add(v.id)));
  const usual = last.map((row) => finite(row.baseline_views)).find((n): n is number => n !== null && n > 0) ?? null;
  return { videos, usual };
}

/** Whether Read again may be pressed: never read (or no readable time), or the last read is 24 hours old. */
export function canReadAgainAt(lastScrapedAt: string | null, now: Date): boolean {
  const t = Date.parse(lastScrapedAt ?? "");
  return !Number.isFinite(t) || now.getTime() - t >= READ_GATE_MS;
}

/** The day of a read as the Audience page words it, without its "read ": "14 Nov", "14 Nov 2025". */
export function builtOn(iso: string | null | undefined, now: Date): string | null {
  return readOn(iso, now)?.replace(/^read /, "") ?? null;
}

/** A handle as the Audience page reads one off an audience (`handleText`, private to `audience-model.ts`). */
const handleText = (value: unknown): string | null => {
  const raw = text(value);
  if (raw === null) return null;
  const handle = raw.replace(/^@+/, "").toLowerCase();
  return ACCOUNT_HANDLE.test(handle) ? handle : null;
};
/** The handle an audience was read from, by the Audience page's rule with no account behind it
 *  (`identityOf`, private to `audience-model.ts`): the calibration's, else the read's. */
const audienceHandleOf = (a: Audience) => handleText(a.calibration?.handle) ?? handleText(a.signature?.provenance?.handle);
/** When it was read, as the Audience page dates its source line. */
const readAtOf = (a: Audience) => text(a.signature?.provenance?.scraped_at) ?? text(a.calibration?.scraped_at);

/** Among the caller's audiences, another creator's read from one of `handles`; two or more: the newer read. */
export function theirAudience(audiences: readonly Audience[], handles: readonly string[], now: Date): CreatorAudience | null {
  const wanted = new Set(handles.map(creatorHandleOf).filter(Boolean));
  const time = (iso: string | null | undefined) => (Number.isFinite(Date.parse(iso ?? "")) ? Date.parse(iso ?? "") : -Infinity);
  const pick = audiences
    .filter((a) => kindOf(a, undefined) === "other" && wanted.has(audienceHandleOf(a) ?? ""))
    .sort((x, y) => time(readAtOf(y)) - time(readAtOf(x)) || time(y.created_at) - time(x.created_at) || x.id.localeCompare(y.id))[0];
  return pick ? { id: pick.id, builtOn: builtOn(readAtOf(pick), now) } : null;
}

/** A count worth a figure: finite and above 0 (a 0 is a read that found none, as the Watchlist's line says). */
const shown = (v: unknown): number | null => ((n) => (n !== null && n > 0 ? n : null))(finite(v));

/** Followers, Likes, Posts, Usual views: those known, in that order, with the Audience page's labels. */
export function creatorFiguresOf(profile: CreatorProfileRow, usual: number | null): Figure[] {
  const rows: ReadonlyArray<[Figure["key"], string, unknown]> = [
    ["followers", AUDIENCE_STRINGS.followers, profile.follower_count],
    ["likes", AUDIENCE_STRINGS.likes, profile.heart_count],
    ["posts", AUDIENCE_STRINGS.posts, profile.video_count],
    ["usual", AUDIENCE_STRINGS.usualViews, usual],
  ];
  return rows.flatMap(([key, label, value]) => {
    const n = shown(value);
    return n === null ? [] : [{ key, label, value: viewsWord(n) }];
  });
}

/** The page of one followed creator, from what the server read. A held creator shows who they are by
 *  handle only: no name, bio, picture, figures or videos (a failed read kept nothing worth showing). */
export function creatorPageOf({ source, profile, videos, audiences, now }: CreatorInput): CreatorPage {
  const handle = creatorHandleOf(profile.tiktok_handle);
  const held = source.held;
  const read = held ? { videos: [], usual: null } : creatorVideosOf(videos, handle);
  return {
    handle,
    name: held ? null : text(profile.display_name),
    bio: held ? null : text(profile.bio),
    avatarUrl: held ? null : text(profile.avatar_url),
    held,
    read: readOn(profile.last_scraped_at, now),
    canReadAgain: canReadAgainAt(profile.last_scraped_at, now),
    figures: held ? [] : creatorFiguresOf(profile, read.usual),
    videos: read.videos,
    audience: theirAudience(audiences, [handle, source.mergedFrom ?? ""], now),
    removal: removalOf(source),
  };
}
