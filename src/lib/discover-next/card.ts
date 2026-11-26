/**
 * A video's card (spec 3.2): the spoken line it shows, its badge,
 * its meta line, and its accessible name. Pure.
 */

import { timesLabel, viewsLabel } from "@/lib/multiple-words";

import type { CardVideo } from "./hub-data";

/** A fill-in slot or a note: any [...], {...} or <...> part. */
const SLOT = /\[[^\]]*\]|\{[^}]*\}|<[^>]*>/;
/** A whole line that only says there is none. */
const NO_LINE = /^(?:null|none|n\/a)$/i;
/** A note in round brackets at the start: "(None - …)", "(no spoken audio; …)", "(Inferred): …". */
const NOTE = /^\((?:none\b|no |inferred\b)/i;

/**
 * The spoken line a card shows, or null for none (the placeholders measured on the live
 * library 2026-11-25). Whitespace collapsed and trimmed; none when it is empty, holds no letter,
 * holds a slot, is only "null" / "none" / "n/a", or opens on a note in round brackets. A line that
 * opens on another bracketed word ("(coughs) Was that a cough?") is real speech and is kept.
 */
export function cardLine(spokenHook: string | null | undefined): string | null {
  const line = (spokenHook ?? "").replace(/\s+/g, " ").trim();
  if (!line) return null;
  if (!/\p{L}/u.test(line)) return null;
  if (SLOT.test(line)) return null;
  if (NO_LINE.test(line)) return null;
  if (NOTE.test(line)) return null;
  return line;
}

/**
 * The line a card shows: a spoken line by the placeholder rules (`cardLine`); a caption, the creator's own
 * words, as written (spaces collapsed): a caption with "[part 2]" or opening on "(no way)" is no note.
 */
export function lineOf(video: Pick<CardVideo, "spokenHook" | "captioned">): string | null {
  if (!video.captioned) return cardLine(video.spokenHook);
  const caption = (video.spokenHook ?? "").replace(/\s+/g, " ").trim();
  return caption || null;
}

/** A handle as stored, without "@" and blanks; null for none. */
export function handleOf(handle: string | null | undefined): string | null {
  const h = (handle ?? "").trim().replace(/^@+/, "").trim();
  return h || null;
}

/**
 * The badge at the card's top left: on a proven video ("100×+" past 100), and on a creator's own video that
 * beat their usual (`beat`), which the card draws without the ▲.
 */
export function badgeOf(video: Pick<CardVideo, "proven" | "extreme" | "multiplier" | "beat">): string | null {
  if (!video.proven && !video.beat) return null;
  if (video.extreme) return "100×+";
  return video.multiplier !== null && Number.isFinite(video.multiplier) ? timesLabel(video.multiplier) : null;
}

/** Views the card may print: a count above zero (a row with none is stored as 0). */
export function shownViews(views: number): number | null {
  return Number.isFinite(views) && views > 0 ? views : null;
}

/** The meta's two parts, drawn apart so a long handle is the part a narrow card cuts, never the count. */
export function cardMetaParts(video: Pick<CardVideo, "handle" | "views">): { handle: string | null; views: string | null } {
  const handle = handleOf(video.handle);
  const views = shownViews(video.views);
  return { handle: handle ? `@${handle}` : null, views: views !== null ? viewsLabel(views) : null };
}

/** A card's accessible name: its line, else "Video by @handle", else "Video". */
export function cardName(video: Pick<CardVideo, "spokenHook" | "handle" | "captioned">): string {
  const line = lineOf(video);
  if (line) return line;
  const handle = handleOf(video.handle);
  return handle ? `Video by @${handle}` : "Video";
}
