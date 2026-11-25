/**
 * audience-words.ts — every word the Audience part shows (spec 2026-11-25-audience, section 6), with the
 * building view's quiet `keepOpen` line. Components take their words from here and never type one.
 *
 * Pure: no React, no clock (`readOn` is given `now`). Dates are UTC days, so the server and the browser write
 * the same one. The multiple is rounded as After posting rounds it (`roundRatio` of `src/lib/posted/posted.ts`).
 * A function given a handle takes it with or without its "@" and writes it with one.
 *
 * Never said here: persona, calibrate, sync, source, simulated (as a kind of audience), test, thread,
 * Audiences, General (`__tests__/audience-words.test.ts` scans every string and output).
 */
import { roundRatio } from "@/lib/posted/posted";
import type { AudienceKind, Whose } from "./audience-model";

/** Every fixed string of the part, word for word. */
export const AUDIENCE_STRINGS = {
  title: "Audience",
  ringTotal: "1,000",
  ringUnit: "viewers",
  simulate: "Simulate a video for them",
  useForNewChats: "Use for new chats",
  readAgain: "Read again",
  describedBy: "Described by you",
  anotherCreator: "Another creator",
  groups: "Groups",
  more: "More",
  works: "What works with them",
  flat: "What falls flat",
  judge: "How they judge a video",
  followers: "Followers",
  likes: "Likes",
  posts: "Posts",
  usualViews: "Usual views",
  noCaption: "No caption",
  loading: "Loading your audience",
  loadFailed: "Couldn't load your audience.",
  tryAgain: "Try again",
  noneTitle: "These are general viewers",
  noneText: "Read your TikTok account and Maven simulates for the people who watch you. About two minutes, free.",
  buildMine: "Build my audience",
  describeInstead: "Describe one instead",
  switcherTitle: "Audience",
  switcherLine: "Whose viewers Maven simulates",
  newAudience: "New audience",
  newAudienceLine: "From an account or a description",
  rename: "Rename",
  save: "Save",
  cancel: "Cancel",
  close: "Close",
  deleteAudience: "Delete audience",
  delete: "Delete",
  disconnect: "Disconnect",
  removeLine: "Chats that use this audience go back to general viewers. This can't be undone.",
  renameFailed: "Couldn't rename that audience.",
  deleteFailed: "Couldn't delete that audience.",
  switchFailed: "Couldn't switch the audience.",
  doorOwn: "Your TikTok account",
  doorOwnLine: "Built from your own videos",
  doorOther: "Another creator",
  doorOtherLine: "Any public TikTok account",
  doorDescribe: "Describe them",
  doorDescribeLine: "Write who they are",
  ownPlaceholder: "@yourhandle",
  otherPlaceholder: "@handle",
  describePlaceholder: "Who are they, and what makes them stop scrolling?",
  ownField: "Your TikTok handle",
  otherField: "Their TikTok handle",
  describeField: "Who they are",
  build: "Build audience",
  buildLine: "About two minutes. Free.",
  onlyTikTok: "Instagram and YouTube can't be read into an audience yet.",
  connectOnYou: "Connect them on You",
  building: "Building your audience",
  slow: "Taking longer than usual.",
  thinTitle: "Couldn't read enough yet",
  useGeneral: "Use general viewers",
  tryAnother: "Try another account",
  changeDescription: "Change the description",
  accountNotFound: "Account not found. Check the handle. Private accounts can't be read.",
  describeFailed: "Couldn't build from that description. Try again.",
  keptAsWas: "The groups stay as they were.",
  stepDone: "done",
  stepNow: "now",
  stepNext: "next",
  keepOpen: "Keep this page open.",
  back: "Back",
  // A build from a description already on its way, met again from another page (a toast).
  stillBuilding: "Maven is still building that audience.",
} as const;

const S = AUDIENCE_STRINGS;
const COUNT = new Intl.NumberFormat("en-US");

const PLATFORM_NAMES: Readonly<Record<string, string>> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" };

/** A platform's name as the page writes it; null for one with no name ("custom", unknown, none). */
export function platformName(platform: string | null | undefined): string | null {
  return typeof platform === "string" ? (PLATFORM_NAMES[platform] ?? null) : null;
}

/** "@handle", from a handle with or without its "@". */
const at = (handle: string) => `@${handle.trim().replace(/^@+/, "")}`;

/** "12 videos", "1 video"; null for none or an unknown count. */
function videoCount(n: number | null | undefined): string | null {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
  return `${COUNT.format(n)} ${n === 1 ? "video" : "videos"}`;
}

const joined = (parts: ReadonlyArray<string | null>) => parts.filter((p): p is string => p !== null && p !== "").join(" · ");

/** "share of your viewers" / "share of their viewers" / "share of the viewers". */
export const shareOf = (whose: Whose): string => `share of ${whose} viewers`;

/** "All 10": the row that opens the rest of the groups. */
export const allGroups = (n: number): string => `All ${n}`;

/** "114 of 1,000 viewers". */
export const groupCount = (count: number): string => `${COUNT.format(count)} of ${S.ringTotal} ${S.ringUnit}`;

/** "Seen in your numbers" / "Seen in their numbers" / "Seen in the numbers". */
export const seenIn = (whose: Whose): string => `Seen in ${whose} numbers`;

/** "Your videos Maven read" / "Their videos Maven read". */
export const videosTitle = (whose: Whose): string => `${whose[0]!.toUpperCase()}${whose.slice(1)} videos Maven read`;

/** "20× your usual", "1.9× their usual", "under 0.1× your usual": After posting's rounding. */
export function timesUsual(ratio: number, whose: Whose): string {
  if (!(ratio >= 0.1)) return `under 0.1× ${whose} usual`;
  return `${roundRatio(ratio)}× ${whose} usual`;
}

/** "Future tech · 6". */
export const topicChip = (name: string, count: number): string => `${name} · ${COUNT.format(count)}`;

const DAY_MONTH = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC" });

/** "read 14 Aug"; in another year than `now`'s "read 14 Aug 2025"; never "Sept"; null for no date or a bad one. */
export function readOn(iso: string | null | undefined, now: Date): string | null {
  if (typeof iso !== "string" || iso.trim() === "") return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  const parts = DAY_MONTH.formatToParts(date);
  const day = parts.find((p) => p.type === "day")?.value;
  const month = parts.find((p) => p.type === "month")?.value.slice(0, 3); // a locale's "Sept" is "Sep"
  if (!day || !month) return null;
  const year = date.getUTCFullYear();
  return year === now.getUTCFullYear() ? `read ${day} ${month}` : `read ${day} ${month} ${year}`;
}

/**
 * The source card's line: "TikTok · read 14 Aug · 12 videos"; another creator's starts "Another creator · ";
 * a part that is not known is left out; a described audience is "Described by you".
 */
export function sourceLine(kind: AudienceKind, platform: string | null, read: string | null, videos: number | null): string {
  if (kind === "described") return S.describedBy;
  return joined([kind === "other" ? S.anotherCreator : null, platformName(platform), read, videoCount(videos)]);
}

/** The switcher's line: "TikTok · 12 videos read" (or "TikTok"), "Another creator · TikTok", "Described by you". */
export function choiceLine(kind: AudienceKind, platform: string | null, videos: number | null): string {
  if (kind === "described") return S.describedBy;
  if (kind === "other") return joined([S.anotherCreator, platformName(platform)]);
  const read = videoCount(videos);
  return joined([platformName(platform), read === null ? null : `${read} read`]);
}

/** The toast after a switch: "New chats use @nia.tests". */
export const newChatsUse = (label: string): string => `New chats use ${label}`;

/** More's item for an account's audience: "Disconnect @nia.tests". */
export const disconnectItem = (handle: string): string => `${S.disconnect} ${at(handle)}`;

/** "Disconnect @nia.tests?". */
export const disconnectQuestion = (handle: string): string => `${S.disconnect} ${at(handle)}?`;

/** "Delete Busy parents who meal-prep?". */
export const deleteQuestion = (name: string): string => `${S.delete} ${name}?`;

/** "Couldn't disconnect @nia.tests.". */
export const disconnectFailed = (handle: string): string => `Couldn't disconnect ${at(handle)}.`;

/** The rename field's name: "Rename @nia.tests". */
export const renameLabel = (name: string): string => `${S.rename} ${name}`;

/** More's name (it shows only its dots): "More: @nia.tests". */
export const moreLabel = (name: string): string => `${S.more}: ${name}`;

/** The pill's name (it shows the name and a caret: what it does is said here): "Audience: @nia.tests". */
export const pillLabel = (name: string): string => `${S.switcherTitle}: ${name}`;

/** A read of this account already on its way, met again from another page (a toast): "Maven is still reading @nia.tests.". */
export const stillReading = (handle: string): string => `Maven is still reading ${at(handle)}.`;

/** Read again's question: "Maven reads @nia.tests again and rebuilds the groups. About two minutes.". */
export const readAgainLine = (handle: string): string => `Maven reads ${at(handle)} again and rebuilds the groups. About two minutes.`;

/** The building state's card: "From your videos" / "From their videos". */
export const fromVideos = (whose: Whose): string => `From ${whose} videos`;

/** "12 read". */
export const readCount = (n: number): string => `${COUNT.format(n)} read`;

/** The name of what an account posts about (the topics under its read videos): "What you post about" / "What they post about". */
export const postsAbout = (whose: Whose): string => `What ${whose === "your" ? "you" : "they"} post about`;

/** Why a read gave too little: about the handle, or, with none, about the description. */
export function thinWhy(handle: string | null): string {
  if (handle !== null && handle.trim().replace(/^@+/, "") !== "") return `${at(handle)} doesn't have enough public videos to read yet.`;
  return "There weren't enough videos for that description yet.";
}

/** A row's views for screen readers: "259K views", "1 view". */
export const viewsLabel = (views: string): string => `${views} ${views === "1" ? "view" : "views"}`;
