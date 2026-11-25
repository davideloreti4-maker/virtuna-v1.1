/**
 * posted-words.ts — the words of a posted piece (plan 2026-11-24-after-posting, "Words" and "Fixed strings").
 *
 * Pure: no React, no clock (`footWords` is given `now`; a row's relative time word is given to `rowLine`).
 * Days and dates are the viewer's local ones, as the rest of the new look writes them (`src/lib/time-ago.ts`):
 * call `footWords` in the browser only, never on the server (ruling 9). A post with no known time is
 * "Posted" with no day (ruling 6).
 *
 * Counts: the compact form the new look's You page uses for followers (`Intl.NumberFormat` "en-US", compact,
 * one decimal at most, `src/components/you-next/you-words.ts`), written here because that one is not
 * exported. `compactCount` (`src/lib/flywheel/loop-summary.ts`) gives the plan's four examples too but may
 * not be imported, and it writes 999,950 as "1000K".
 */

import { LINKS_PER_DAY, roundRatio, type Posted, type PostedNumbers, type PostedUsual } from "./posted";

/** Every fixed string of the part, word for word as the plan has them. */
export const POSTED_STRINGS = {
  stage: "Posted",
  column: "After posting",
  emptyFilter: "Nothing posted yet. Add a posted video's link to a piece you simulated.",
  addItem: "Add posted link",
  removeItem: "Remove posted link",
  removeConfirm: "Remove the posted link?",
  remove: "Remove",
  cancel: "Cancel",
  askTitle: "Posted it?",
  askText: "Add the link and see what it did.",
  sheetTitle: "Posted it?",
  sheetText: "Paste the TikTok link. Maven reads the public numbers and shows them next to what it said.",
  field: "TikTok link",
  placeholder: "https://www.tiktok.com/@you/video/…",
  submit: "Add link",
  notTiktok: "That's not a TikTok link.",
  alreadyLinked: "This piece already has a posted link.",
  tooMany: `That's ${LINKS_PER_DAY} links today. Add more tomorrow.`,
  addFailed: "Couldn't add the link. Try again.",
  cardTitle: "After posting",
  said: "Maven said",
  got: "It got",
  reading: "Reading the post",
  readingText: "This takes about a minute.",
  unread: "Couldn't read this post. It may be private or deleted.",
  tryAgain: "Try again",
  menu: "More: posted link",
  removeFailed: "Couldn't remove the link.",
} as const;

const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** A count, compact: 940, 12.4K, 31K, 1.2M. */
export function viewsWord(n: number): string {
  return Number.isFinite(n) && n > 0 ? COMPACT.format(n) : "0";
}

/** "1.8× your usual"; from 10 a whole number ("12× your usual"); under 0.1 "under 0.1× your usual". */
export function usualWord(ratio: number): string {
  if (!(ratio >= 0.1)) return "under 0.1× your usual";
  return `${roundRatio(ratio)}× your usual`;
}

const viewUnit = (views: number) => (views === 1 ? "view" : "views");
const count = (n: number, one: string, many: string) => `${viewsWord(n)} ${n === 1 ? one : many}`;

export interface GotWords {
  number: string;
  unit: "views" | "views so far" | "view" | "view so far";
  usual: string | null;
}

/** "It got": the views and, once final, the usual. Null when there are no numbers to show (reading, not read). */
export function gotWords(posted: Posted): GotWords | null {
  const { numbers, state } = posted;
  if (numbers === null || (state !== "so-far" && state !== "final")) return null;
  const unit = viewUnit(numbers.views);
  return {
    number: viewsWord(numbers.views),
    unit: state === "final" ? unit : `${unit} so far`,
    usual: state === "final" && posted.usual ? usualWord(posted.usual.ratio) : null,
  };
}

/** "2.1K likes · 84 comments · 310 shares · 420 saves". */
export function countsLine(numbers: PostedNumbers): string {
  return [
    count(numbers.likes, "like", "likes"),
    count(numbers.comments, "comment", "comments"),
    count(numbers.shares, "share", "shares"),
    count(numbers.saves, "save", "saves"),
  ].join(" · ");
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "Fri 20 Nov", in local time. */
const dateWord = (at: Date) => `${DAYS[at.getDay()]!.slice(0, 3)} ${at.getDate()} ${MONTHS[at.getMonth()]}`;
/** Local calendar days from `now` to `at` (0 today, 1 tomorrow). */
const daysFrom = (now: Date, at: Date) =>
  Math.round((new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000);

export interface FootWords {
  /** "Posted Fri 20 Nov on TikTok" ("Posted on TikTok" before the post's time is known). */
  lead: string;
  /** "@nia.cooks", the part the card makes a link (to `posted.href`), or null. */
  handle: string | null;
  /** " · final numbers" (final), " · final numbers Thursday" / " · … tomorrow" / " · … today" (so far), else "". */
  tail: string;
  /** The whole line: lead, ", " and the handle, tail. */
  text: string;
}

/** The card's foot: "Posted Fri 20 Nov on TikTok, @nia.cooks · final numbers". */
export function footWords(posted: Posted, now: Date): FootWords {
  const postedAt = posted.postedAt === null ? null : new Date(posted.postedAt);
  const lead = postedAt && Number.isFinite(postedAt.getTime()) ? `Posted ${dateWord(postedAt)} on TikTok` : "Posted on TikTok";
  const handle = posted.handle === null ? null : `@${posted.handle}`;
  let tail = "";
  if (posted.state === "final") tail = " · final numbers";
  if (posted.state === "so-far" && posted.finalAt !== null) {
    const finalAt = new Date(posted.finalAt);
    const days = daysFrom(now, finalAt);
    tail = ` · final numbers ${days <= 0 ? "today" : days === 1 ? "tomorrow" : DAYS[finalAt.getDay()]}`;
  }
  return { lead, handle, tail, text: `${lead}${handle ? `, ${handle}` : ""}${tail}` };
}

export interface RowLine {
  /** The line's words, whole: `lead` and `rest` joined with " · " ("Posted 4d ago · 31K views"). */
  text: string;
  /** "Posted 4d ago" | "Posted" (no known post time). */
  lead: string;
  /** "31K views", "12.4K views so far" (the numbers), or "reading the post", "couldn't read the post". */
  rest: string;
  /** `rest` is the numbers: a phone draws them as one unbroken piece (ruling 30). */
  numbers: boolean;
  /** "1.8× your usual" with its tone, kept apart: the row colours it and puts it on its own line, with no
   *  separator before it (ruling 30); or null. */
  mark: { text: string; tone: PostedUsual["tone"] } | null;
}

/**
 * A Library row's posted line, as a phone and Home's Recent draw it: "Posted 4d ago · 31K views" and the
 * mark "1.8× your usual"; "Posted 1d ago · 12.4K views so far"; "Posted · reading the post";
 * "Posted · couldn't read the post". In parts (ruling 30). `when` is the row's own relative-time word for
 * `postedAt`; it is left out when `postedAt` is null.
 */
export function rowLine(posted: Posted, when: string | null): RowLine {
  const line = (lead: string, rest: string, numbers: boolean, mark: RowLine["mark"] = null): RowLine => ({
    text: `${lead} · ${rest}`,
    lead,
    rest,
    numbers,
    mark,
  });
  const got = gotWords(posted);
  if (posted.state === "unread") return line("Posted", "couldn't read the post", false);
  if (got === null) return line("Posted", "reading the post", false);
  // No post time, no day (ruling 6): "Posted", whatever word the row was given.
  const lead = when && posted.postedAt !== null ? `Posted ${when}` : "Posted";
  return line(lead, `${got.number} ${got.unit}`, true, got.usual && posted.usual ? { text: got.usual, tone: posted.usual.tone } : null);
}

export interface CellWords {
  top: string;
  under: string | null;
}

/** The desktop column "After posting": "31K views" over "1.8× your usual" (or "so far"); "Reading"; "Not read". */
export function cellWords(posted: Posted): CellWords {
  if (posted.state === "unread") return { top: "Not read", under: null };
  const got = gotWords(posted);
  if (got === null) return { top: "Reading", under: null };
  const top = `${got.number} ${viewUnit(posted.numbers!.views)}`;
  return { top, under: posted.state === "so-far" ? "so far" : got.usual };
}
