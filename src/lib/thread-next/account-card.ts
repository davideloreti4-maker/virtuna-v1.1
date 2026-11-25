/**
 * account-card.ts — what the account read's card shows (thread depth spec, second part §3), read
 * off the block a run sends (§2). The runner's lines are mechanical, not prose
 * (`src/lib/account-read/account-read.ts`), so each is put in plain words here, never shown as sent.
 *
 * - Who was read: the handle without its "@", the initials for a missing picture, and
 *   "12.4K followers · 86 videos" (each half only when its number is there).
 * - "What works": the two most viewed videos, sorted here (the stored order is not trusted), each
 *   with its caption less the hashtags at its end, and "854K views".
 * - "To fix": one plain sentence pair for each `fix` line.
 * - The habits line: how many videos are short or long, and the opening that recurs.
 * - The ask the card's one button sends as an Ideas run.
 *
 * Counts go through `viewsLabel`, the formatter behind a hook row's "854K views" and the remix's
 * source row, so one number never reads two ways in the thread.
 *
 * Every field is read as possibly missing or of the wrong kind, whatever the type says: a read stored
 * months ago may lack one (the thread's `validateBlock` turns such a block away, but nothing here may
 * throw on one either). What cannot be read shows nothing.
 *
 * Pure: no React.
 */

import { viewsLabel } from "@/lib/multiple-words";
import type { AccountReadBlock } from "@/lib/tools/blocks";

type Props = AccountReadBlock["props"];
type Video = NonNullable<Props["analyzedVideos"]>[number];
type Patterns = NonNullable<Props["patterns"]>;

export interface AccountWho {
  /** Without the "@". */
  handle: string;
  /** Two letters for the avatar when there is no picture or it fails; empty when there is nothing to read. */
  initials: string;
  /** The picture's address; null when there is none. */
  avatar: string | null;
  /** "12.4K followers · 86 videos", either half, or null. */
  counts: string | null;
}

export interface AccountVideo {
  title: string;
  /** "854K views". */
  views: string;
  cover: string | null;
}

export interface AccountCard {
  who: AccountWho;
  /** The two most viewed, most viewed first; empty: no "What works" and no button. */
  videos: AccountVideo[];
  /** One sentence pair per `fix` line; empty: no "To fix". */
  fixes: string[];
  habits: string | null;
  /** What the button sends; null: no button. */
  ask: string | null;
}

/** How many videos "What works" shows. */
const TOP = 2;

/** A stored field as text, a list or a record; anything else is empty. */
const text = (v: unknown): string => (typeof v === "string" ? v : "");
const list = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : []);
const record = (v: unknown): Record<string, unknown> => (v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {});
/** A stored count: a finite number above 0, else 0 (the scrape's missing number). */
const countOf = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

const LETTER_OR_FIGURE = /[\p{L}\p{N}]/u;

/** A word's letters and figures only ("✨" is nothing, "creator.one" is "creatorone"). */
function lettersOf(word: string): string[] {
  return Array.from(word).filter((ch) => LETTER_OR_FIGURE.test(ch));
}

/**
 * The avatar's two letters: the first letters of the name's first two words, or the first two
 * letters of a one-word name (the drawing's "NL"; a name like "nia" gives "NI"). The display name
 * first, the handle when it has nothing to read.
 */
export function initialsOf(displayName: string, handle: string): string {
  for (const name of [displayName, handle]) {
    const words = name
      .split(/\s+/)
      .map(lettersOf)
      .filter((w) => w.length > 0);
    const first = words[0];
    if (!first) continue;
    const second = words[1];
    return (second ? `${first[0]}${second[0]}` : first.slice(0, 2).join("")).toUpperCase();
  }
  return "";
}

function counted(stored: unknown, one: string, many: string): string | null {
  const n = countOf(stored);
  return n > 0 ? `${viewsLabel(n)} ${n === 1 ? one : many}` : null;
}

/** Who was read. A count of 0 is no count (the scrape's missing number), as the run's own evidence line reads it. */
export function accountWhoOf(props: Props): AccountWho {
  const p = record(props);
  const handle = text(p.handle).trim().replace(/^@+/, "").trim();
  const profile = record(p.profile);
  const counts = [counted(profile.followerCount, "follower", "followers"), counted(profile.videoCount, "video", "videos")].filter(
    (c): c is string => c !== null,
  );
  return {
    handle,
    initials: initialsOf(text(profile.displayName), handle),
    avatar: text(profile.avatarUrl).trim() || null,
    counts: counts.length > 0 ? counts.join(" · ") : null,
  };
}

/** A caption as a row's title: whitespace collapsed, the hashtags at its end dropped; one that is only hashtags, whole. */
export function captionTitle(caption: string): string {
  const words = caption.split(/\s+/).filter((w) => w.length > 0);
  let end = words.length;
  while (end > 0 && words[end - 1]!.startsWith("#")) end -= 1;
  return (end === 0 ? words : words.slice(0, end)).join(" ");
}

/**
 * The two most viewed videos, sorted here (ties keep the stored order). A video with no words to
 * show (an empty caption) is passed over: its row would be a cover and a number, and the ask would
 * name nothing. A count that is not a number is not a video to rank.
 */
export function topVideosOf(videos: readonly Video[] | undefined): AccountVideo[] {
  return list(videos)
    .map(record)
    .filter((v): v is Record<string, unknown> & { views: number } => typeof v.views === "number" && Number.isFinite(v.views))
    .map((v) => ({ title: captionTitle(text(v.caption)), views: v.views, cover: text(v.coverUrl).trim() || null }))
    .filter((v) => v.title.length > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, TOP)
    .map((v) => ({ title: v.title, views: `${viewsLabel(v.views)} views`, cover: v.cover }));
}

/** The runner's three lines (`extractFix`), known by the viewer type that leads them. */
const KNOWN_FIX: Readonly<Record<string, string>> = {
  scanner: "Your openings lose people in the first seconds. Sharpen the first line.",
  lurker: "The middle loses people. Tighten it and cut the dead air.",
  skeptic: "Viewers are not convinced. Show proof or specifics earlier.",
};

const LEADING_WORD = /^([\p{L}\p{N}_-]+):\s*/u;

/** A sentence capitalised and ended with a full stop (a stop, question mark or ellipsis it has is kept). */
function sentence(text: string): string {
  const body = text.trim().replace(/[\s,;:]+$/, "");
  if (body.length === 0) return "";
  const capital = body.charAt(0).toUpperCase() + body.slice(1);
  return /[.?!…]$/.test(capital) ? capital : `${capital}.`;
}

/**
 * One `fix` line as plain sentences. A known viewer type: its sentence pair. Any other line: its
 * leading `word:` dropped, each " — " made a full stop, each sentence capitalised and ended. Null
 * when nothing is left.
 */
export function fixSentence(line: string): string | null {
  const trimmed = line.trim();
  const lead = LEADING_WORD.exec(trimmed);
  // An own key only: "constructor:" must not find Object's own.
  const key = lead?.[1]?.toLowerCase();
  if (key !== undefined && Object.prototype.hasOwnProperty.call(KNOWN_FIX, key)) return KNOWN_FIX[key]!;
  const rest = lead ? trimmed.slice(lead[0].length) : trimmed;
  const sentences = rest
    .split(/\s+—\s+/)
    .map(sentence)
    .filter((s) => s.length > 0);
  return sentences.length > 0 ? sentences.join(" ") : null;
}

export function fixSentencesOf(fix: readonly string[] | undefined): string[] {
  return list(fix)
    .filter((line): line is string => typeof line === "string")
    .map(fixSentence)
    .filter((s): s is string => s !== null);
}

const NUMBER_WORDS = ["", "", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

/** The runner's format label's seconds ("Short-form (≤30s)" → 30), or null. */
function secondsOf(label: string): number | null {
  const m = /(\d+)\s*s\b/.exec(label);
  return m ? Number(m[1]) : null;
}

/**
 * "21 of 30 videos are 30 s or shorter." or, when the long ones are the larger part, "… are longer
 * than 30 s." Nothing when one video or none was read: one video says nothing about a habit.
 */
function formatHalf(mix: readonly unknown[]): string | null {
  const entries = mix.map(record);
  const short = entries.find((e) => /^short/i.test(text(e.label).trim()));
  const long = entries.find((e) => /^long/i.test(text(e.label).trim()));
  const shortN = countOf(short?.count);
  const longN = countOf(long?.count);
  const total = shortN + longN;
  if (total <= 1) return null;
  const longer = longN > shortN;
  const entry = longer ? long : short;
  const seconds = secondsOf(text(entry?.label));
  if (seconds === null) return null;
  return longer
    ? `${longN} of ${total} videos are longer than ${seconds} s.`
    : `${shortN} of ${total} videos are ${seconds} s or shorter.`;
}

/** The runner's `"How I…" (3 posts)`: "Three videos open with “How I…”." (two to nine as words, 10 and up as figures). */
function openingHalf(hooks: readonly unknown[]): string | null {
  const first = hooks[0];
  if (typeof first !== "string") return null;
  const m = /^"(.+)"\s*\((\d+)\s+posts?\)$/.exec(first.trim());
  if (!m) return null;
  const n = Number(m[2]);
  if (n < 2) return null;
  const count = n < 10 ? NUMBER_WORDS[n] : String(n);
  return `${count} videos open with “${m[1]!.trim()}”.`;
}

/** The habits line: both halves, either alone, or null. */
export function habitsLineOf(patterns: Patterns | undefined): string | null {
  const p = record(patterns);
  const halves = [formatHalf(list(p.formatMix)), openingHalf(list(p.recurringHooks))].filter((h): h is string => h !== null);
  return halves.length > 0 ? halves.join(" ") : null;
}

/** What "Ideas from what works" sends: the ask, then "- caption (854K views)" per video, as the card shows them. */
export function ideasAskOf(videos: readonly AccountVideo[]): string | null {
  if (videos.length === 0) return null;
  return ["Give me ideas built on what already works on my account:", ...videos.map((v) => `- ${v.title} (${v.views})`)].join("\n");
}

export function accountCardOf(props: Props): AccountCard {
  const p = record(props);
  const videos = topVideosOf(p.analyzedVideos as Props["analyzedVideos"]);
  const patterns = p.patterns as Props["patterns"];
  return {
    who: accountWhoOf(props),
    videos,
    fixes: fixSentencesOf(record(patterns).fix as Patterns["fix"] | undefined),
    habits: habitsLineOf(patterns),
    ask: ideasAskOf(videos),
  };
}
