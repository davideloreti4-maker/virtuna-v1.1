/**
 * audience-model.ts — the Audience page's model (spec 2026-11-25-audience, sections 3 and 4): which audience
 * `/audience` shows, what kind it is, its ten groups with the ring's own counts, where it came from, the
 * account's figures, the read's two texts, the videos Maven read, and the switcher's rows.
 *
 * Pure: no React, no Next, no Supabase, no repository import (`__tests__/purity.test.ts` holds it). The clock
 * is given (`now`). What leaves here is serialisable (no Map, no Date): the server read hands it to the client.
 *
 * The counts a group shows are the ring's: `ringDots` decides them, so the ring and the text never disagree,
 * and they add up to 1,000. No stored picture is read (a connected account stores none), so every face is the
 * initial.
 */
import { accountForAudience, groupAudiences } from "@/components/audience/audience-display";
import type { AccountSnapshot } from "@/lib/account-metrics/account-metrics";
import type { Audience, CalibratedPersona, GoalIntent, SignaturePersona } from "@/lib/audience/audience-types";
import { ARCHETYPES, type Archetype } from "@/lib/engine/wave3/persona-registry";
import { HANDLE_PATTERN, toneOf } from "@/lib/posted/posted";
import { viewsWord } from "@/lib/posted/posted-words";
import { groupName } from "@/lib/result/format";
import { ringDots, type WedgeInput } from "@/lib/result/ring-layout";
import { firstSentence } from "@/lib/thread-next/first-sentence";
import { AUDIENCE_STRINGS, choiceLine, readOn, sourceLine, timesUsual, topicChip, videosTitle } from "./audience-words";

export const AUDIENCE_RING = { r1: 62, R: 138 } as const; // the text result's ring (TEXT_RING): a 286 box
export const USUAL_FROM_POSTS = 3; // "Usual views" and "× your usual" from three read posts up, pinned ones left out
export const TOP_VIDEOS = 3; // rows under "Your videos Maven read"
export const GROUPS_FIRST = 4; // rows before "All 10"
export const COVERS_SHOWN = 4; // covers on the building state's card
export const NAME_MAX = 80; // the longest name an audience takes (`PATCH /api/audiences/[id]`'s limit)
export const SLOW_AFTER_MS = 180_000; // "Taking longer than usual."
export const SETTLE_MAX_MS = 30_000; // after `done`, wait at most this for the stream to close (the route still stores the figures and posts)

export type AudienceKind = "own" | "other" | "described";
export type Whose = "your" | "their" | "the";
export interface Face {
  initial: string;
  picture: string | null;
}
export interface AccountRef {
  id: string;
  handle: string;
  platform: "tiktok" | "instagram" | "youtube";
  is_primary: boolean;
}

export interface PageGroup {
  group: Archetype;
  name: string; // groupName(group): "Quiet watchers"
  line: string | null; // the read's one-liner (signature persona `blurb`), outer quotes removed; the UI adds “ ”
  count: number; // its dots on the ring; all of them add up to 1,000
  percent: number; // Math.round(count / 10)
  judge: string | null; // signature persona `reaction_frame`: "How they judge a video"
  seen: string | null; // signature persona `evidence`: "Seen in your numbers"
}
export interface SplitText {
  first: string;
  rest: string | null;
}
export interface Figure {
  key: "followers" | "likes" | "posts" | "usual";
  label: string;
  value: string;
}
export interface ReadVideo {
  key: string; // post_id
  text: string; // the caption's first line without hashtags, or "No caption"
  views: string; // viewsWord(views): "259K"
  times: { words: string; tone: "above" | "around" | "below" } | null; // "20× your usual"; null without a usual
}
export interface AudiencePage {
  id: string;
  name: string; // the pill and the pushed title
  label: string; // "@handle" for an account's audience, else the name (toasts, questions)
  kind: AudienceKind;
  whose: Whose; // own "your", other "their", described "the"
  handle: string | null; // without "@", lower case
  face: Face;
  source: { title: string; line: string; description: string | null }; // `line` is "" when nothing is known: draw none
  wedges: WedgeInput[]; // largest first; weight = share × 100; present true
  groups: PageGroup[]; // the same order as `wedges`
  figures: Figure[]; // Followers, Likes (TikTok only), Posts, Usual views: those known, in that order
  texts: { works: SplitText | null; flat: SplitText | null };
  videos: { heading: string; rows: ReadVideo[]; topics: string[] } | null; // no count: the archive can hold more than one read's posts
  isDefault: boolean; // the audience new chats use
  removal: { kind: "disconnect"; accountId: string; handle: string } | { kind: "delete" };
  readAgain: { audienceId: string; handle: string; type: "personal" | "target"; goalIntent: GoalIntent; name: string } | null;
}
export interface SwitcherChoice {
  id: string;
  name: string;
  label: string;
  line: string;
  face: Face;
  selected: boolean;
}

/** What the server hands the client screen. Serialisable: no Map, no Date. */
export type AudienceRead =
  | { kind: "redirect"; to: string }
  | { kind: "failed"; pushed: boolean }
  | { kind: "none"; pushed: boolean }
  | { kind: "audience"; pushed: boolean; page: AudiencePage; choices: SwitcherChoice[] };

/** What the page reads of an archived post (`AccountPost` of `account-posts-repo.ts` has these fields). */
export interface ArchivedPost {
  post_id: string;
  caption: string;
  views: number;
  is_pinned: boolean;
}
/** What the page reads of a topic the account posts about (`buildContentPillars`'s `Pillar` has these). */
export interface PostedTopic {
  name: string;
  count: number;
}

export interface PageInput {
  audience: Audience;
  audiences: readonly Audience[];
  accounts: readonly AccountRef[];
  defaultId: string | null;
  snapshot: AccountSnapshot | null;
  posts: readonly ArchivedPost[];
  pillars: readonly PostedTopic[];
}

const S = AUDIENCE_STRINGS;
const WHOSE: Record<AudienceKind, Whose> = { own: "your", other: "their", described: "the" };
const GOALS: ReadonlySet<string> = new Set<GoalIntent>(["grow", "sell", "authority", "nurture"]);
const GROUP_ORDER: ReadonlyMap<string, number> = new Map(ARCHETYPES.map((group, i) => [group, i]));

/** A stored text, trimmed; null when there is none. */
const textOf = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

/** A handle without "@", lower case, when it is a TikTok-shaped one; else null. */
function handleText(value: unknown): string | null {
  const raw = textOf(value);
  if (raw === null) return null;
  const handle = raw.replace(/^@+/, "").toLowerCase();
  return HANDLE_PATTERN.test(handle) ? handle : null;
}

// ─── The kind ────────────────────────────────────────────────────────────────

/**
 * A read of a handle that fell back to a niche search (too little on the account): `calibrateFromScrape`'s thin
 * branch stores it as a description that holds the handle and no description text. It is a read of that
 * account, never "Described by you": it holds no description.
 */
function isThinHandleRead(a: Audience): boolean {
  return a.calibration?.source === "description" && textOf(a.calibration.handle) !== null && textOf(a.goal_label) === null;
}

/**
 * How many of the account's videos were read, for the source and switcher lines. None for a thin
 * read, whose stored count is of the niche search's videos, not of that account's (own or another creator's).
 */
function videosRead(a: Audience): number | null {
  return isThinHandleRead(a) ? null : (a.signature?.provenance?.videos_analyzed ?? null);
}

/**
 * The creator's own account, another creator's, or a description. From the account behind the audience, else
 * from how it was read (`calibration.source`, and the thin read of a handle above). Never from
 * `signature.provenance.handle`: a description stores its own name there (`calibrateFromScrape` reads it
 * under its name).
 *
 * A thin read with `type: "personal"` is the creator's own handle (an account no longer behind it): it stays
 * theirs, as a full read of it does; a thin read of another creator's handle is theirs, by the same rule.
 */
export function kindOf(a: Audience, account: AccountRef | undefined): AudienceKind {
  if (account) return "own";
  if (a.calibration?.source === "scrape" || isThinHandleRead(a)) return a.type === "personal" ? "own" : "other";
  return "described";
}

/**
 * The connected account behind an audience, by the existing pairing (`accountForAudience`: the stored link, or
 * a read of the same handle on the same platform; among several, the one with the groups wins).
 */
export function accountFor(a: Audience, accounts: readonly AccountRef[], audiences: readonly Audience[]): AccountRef | undefined {
  const list = audiences.some((x) => x.id === a.id) ? audiences : [...audiences, a];
  return accountForAudience(a, accounts as AccountRef[], list as Audience[]);
}

// ─── The groups ──────────────────────────────────────────────────────────────

type RosterRow = SignaturePersona | CalibratedPersona;

/**
 * The read's groups that can be drawn: the signature's personas when it has any, else the legacy `personas`;
 * known groups only, the first good row of each, finite shares above 0 (a group with no share has
 * no dots, so it gets no wedge and no row); largest share first, equal shares in the app's group order.
 * Nothing when no share is left.
 */
function rosterOf(a: Audience): RosterRow[] {
  const signed = a.signature?.audience?.personas ?? [];
  const roster: readonly RosterRow[] = signed.length > 0 ? signed : (a.personas ?? []);
  const seen = new Set<string>();
  const rows: RosterRow[] = [];
  for (const p of roster) {
    if (!p || typeof p.archetype !== "string" || !GROUP_ORDER.has(p.archetype)) continue;
    if (typeof p.share !== "number" || !Number.isFinite(p.share) || p.share <= 0) continue;
    if (seen.has(p.archetype)) continue;
    seen.add(p.archetype);
    rows.push(p);
  }
  return rows.sort((x, y) => y.share - x.share || GROUP_ORDER.get(x.archetype)! - GROUP_ORDER.get(y.archetype)!);
}

const OPEN_CLOSE: Readonly<Record<string, string>> = { '"': '"”', "“": "”\"", "'": "'’", "‘": "’'" };
const DOUBLE_QUOTE = /["“”]/;

/**
 * The read's one-liner without the quotes it was written in (the screen adds its own “ ”): `"Saving this".`
 * is `Saving this`. A leading quote that is never closed, or a text that quotes two things (`"One" and
 * "two"`), stays as it is. Blank is null.
 */
export function lineOf(value: unknown): string | null {
  const t = textOf(value);
  if (t === null) return null;
  const closes = OPEN_CLOSE[t[0]!];
  if (!closes) return t;
  const body = t.replace(/[.,;:!?…]+$/u, ""); // the stop after a closing quote goes with the quotes
  if (body.length < 2 || !closes.includes(body.at(-1)!)) return t;
  const inner = body.slice(1, -1).trim();
  if (inner === "") return null;
  if (DOUBLE_QUOTE.test(t[0]!) && DOUBLE_QUOTE.test(inner)) return t;
  return inner;
}

/** The ring's wedges and the page's groups, in one order, each group's count the ring's own. */
export function groupsOf(a: Audience): { wedges: WedgeInput[]; groups: PageGroup[] } {
  const rows = rosterOf(a);
  if (rows.length === 0) return { wedges: [], groups: [] };
  const wedges: WedgeInput[] = rows.map((p) => ({ group: p.archetype, weight: p.share * 100, present: true }));
  const layout = ringDots(wedges, AUDIENCE_RING); // the ring's own counts: ring and text agree
  const groups = rows.map((p, i): PageGroup => {
    const read = p as Partial<SignaturePersona>; // a legacy persona has none of the read's texts
    const count = layout.wedges[i]!.dots.length;
    return {
      group: p.archetype,
      name: groupName(p.archetype),
      line: lineOf(read.blurb),
      count,
      percent: Math.round(count / 10),
      judge: textOf(read.reaction_frame),
      seen: textOf(read.evidence),
    };
  });
  return { wedges, groups };
}

// ─── The numbers ─────────────────────────────────────────────────────────────

/**
 * The account's usual views: the middle value of the read posts' views, from three posts up; pinned posts are
 * left out (they stay on top whatever their views, as After posting leaves them out), each post counted once.
 * Two middle values: their mean, rounded. Null with fewer than three posts or a middle value of 0.
 */
function usualViewsOf(posts: readonly ArchivedPost[]): number | null {
  const seen = new Set<string>();
  const views: number[] = [];
  for (const p of posts) {
    if (p.is_pinned || seen.has(p.post_id)) continue;
    if (typeof p.views !== "number" || !Number.isFinite(p.views) || p.views < 0) continue;
    seen.add(p.post_id);
    views.push(p.views);
  }
  if (views.length < USUAL_FROM_POSTS) return null;
  views.sort((x, y) => x - y);
  const mid = Math.floor(views.length / 2);
  const middle = views.length % 2 === 1 ? views[mid]! : (views[mid - 1]! + views[mid]!) / 2;
  const usual = Math.round(middle);
  return usual > 0 ? usual : null;
}

function figuresOf(snapshot: AccountSnapshot | null, platform: string, usual: number | null): Figure[] {
  const figures: Figure[] = [];
  const add = (key: Figure["key"], label: string, n: unknown) => {
    if (typeof n === "number" && Number.isFinite(n) && n >= 0) figures.push({ key, label, value: viewsWord(n) });
  };
  if (snapshot) {
    add("followers", S.followers, snapshot.follower_count);
    if (platform === "tiktok") add("likes", S.likes, snapshot.heart_count);
    add("posts", S.posts, snapshot.video_count);
  }
  if (usual !== null) add("usual", S.usualViews, usual);
  return figures;
}

/** A hashtag: "#" at the start of a word, not before a digit ("#1 fan" and "Day #12" are words). */
const HASHTAG = /(^|\s)#(?!\d)\S*/gu;
/** The longest a row's text runs before "…", in characters. */
const CAPTION_MAX = 160;

/** At most `CAPTION_MAX` characters, cut on a whole word and ended with "…"; one long token is cut where it is. */
function capped(line: string): string {
  const chars = Array.from(line);
  if (chars.length <= CAPTION_MAX) return line;
  const head = chars.slice(0, CAPTION_MAX + 1).join(""); // one more: a space right after the limit ends a whole word
  const lastSpace = head.lastIndexOf(" ");
  const lead = lastSpace >= CAPTION_MAX / 2 ? head.slice(0, lastSpace) : chars.slice(0, CAPTION_MAX).join("");
  return `${lead.replace(/[\s,;:.!?–—-]+$/u, "")}…`;
}

/**
 * A caption's first line that holds words once its hashtags are gone (a first line of hashtags says nothing), cut at 160
 * characters on a whole word; "No caption" when no line holds words.
 */
export function captionLine(caption: unknown): string {
  if (typeof caption !== "string") return S.noCaption;
  for (const line of caption.split(/\r?\n/)) {
    const words = line.replace(HASHTAG, "$1").replace(/\s+/g, " ").trim();
    if (words !== "") return capped(words);
  }
  return S.noCaption;
}

const viewsOf = (p: ArchivedPost) => (typeof p.views === "number" && Number.isFinite(p.views) && p.views > 0 ? p.views : 0);

/** Each post once, the first copy of it kept. */
function uniquePosts(posts: readonly ArchivedPost[]): ArchivedPost[] {
  const seen = new Set<string>();
  return posts.filter((p) => !seen.has(p.post_id) && (seen.add(p.post_id), true));
}

function videosOf(
  kind: AudienceKind,
  allPosts: readonly ArchivedPost[],
  pillars: readonly PostedTopic[],
  usual: number | null,
  whose: Whose,
): AudiencePage["videos"] {
  const posts = uniquePosts(allPosts);
  if (kind === "described" || posts.length === 0) return null;
  const rows = posts
    .map((p, i) => ({ p, i }))
    .sort((x, y) => viewsOf(y.p) - viewsOf(x.p) || x.i - y.i)
    .slice(0, TOP_VIDEOS)
    .map(({ p }): ReadVideo => {
      const views = viewsOf(p);
      return {
        key: p.post_id,
        text: captionLine(p.caption),
        views: viewsWord(views),
        times: usual === null ? null : { words: timesUsual(views / usual, whose), tone: toneOf(views / usual) },
      };
    });
  const topics = pillars
    .map((t, i) => ({ name: textOf(t.name), count: t.count, i }))
    .filter((t): t is { name: string; count: number; i: number } => t.name !== null && Number.isFinite(t.count) && t.count > 0)
    .sort((x, y) => y.count - x.count || x.i - y.i)
    .map((t) => topicChip(t.name, t.count));
  return { heading: videosTitle(whose), rows, topics };
}

// ─── The texts ───────────────────────────────────────────────────────────────

/** A text's first sentence and the rest ("e.g. robots" ends none); null when there is no text. */
export function splitFirst(value: unknown): SplitText | null {
  const t = textOf(value);
  if (t === null) return null;
  const first = firstSentence(t) ?? t;
  const rest = t.slice(first.length).trim();
  return { first, rest: rest === "" ? null : rest };
}

// ─── The page ────────────────────────────────────────────────────────────────

/** The initial a face shows: the first letter or digit of the label ("@nia.tests" → "N"). Exported so a
 *  name given on the client (a rename) gets the same letter the server's page would. */
export function initialOf(label: string): string {
  const letter = /[\p{L}\p{N}]/u.exec(label)?.[0] ?? Array.from(label.trim())[0] ?? "";
  return letter.toUpperCase();
}

interface Identity {
  account: AccountRef | undefined;
  kind: AudienceKind;
  handle: string | null;
  name: string;
  label: string;
  platform: string;
}

function identityOf(a: Audience, accounts: readonly AccountRef[], audiences: readonly Audience[]): Identity {
  const account = accountFor(a, accounts, audiences);
  const kind = kindOf(a, account);
  const handle =
    kind === "described"
      ? null
      : (handleText(account?.handle) ?? handleText(a.calibration?.handle) ?? handleText(a.signature?.provenance?.handle));
  const name = textOf(a.name) ?? (handle !== null ? `@${handle}` : S.title);
  const label = handle !== null ? `@${handle}` : name;
  return { account, kind, handle, name, label, platform: account?.platform ?? a.platform };
}

/** The page of one audience, from what the server read. */
export function audiencePageOf(input: PageInput, now: Date): AudiencePage {
  const a = input.audience;
  const { account, kind, handle, name, label, platform } = identityOf(a, input.accounts, input.audiences);
  const whose = WHOSE[kind];
  const provenance = a.signature?.provenance;

  const source: AudiencePage["source"] =
    kind === "described"
      ? { title: name, line: S.describedBy, description: a.calibration?.source === "description" ? textOf(a.goal_label) : null }
      : {
          title: label,
          // May be "" when nothing is known (no platform name, no date, no count): the screen then draws no line.
          line: sourceLine(
            kind,
            platform,
            readOn(textOf(provenance?.scraped_at) ?? textOf(a.calibration?.scraped_at), now),
            videosRead(a),
          ),
          description: null,
        };

  const thin = isThinHandleRead(a);
  // A description has no account: no figures and no videos, whatever is passed in.
  const usual = kind === "described" ? null : usualViewsOf(input.posts);
  const { wedges, groups } = groupsOf(a);
  const goal: GoalIntent = typeof a.goal_intent === "string" && GOALS.has(a.goal_intent) ? a.goal_intent : "grow";

  return {
    id: a.id,
    name,
    label,
    kind,
    whose,
    handle,
    face: { initial: initialOf(label), picture: null },
    source,
    wedges,
    groups,
    // A thin read: the niche search stood in, so the snapshot the read seeded is made up (0 followers, its
    // count of niche videos) and the posts archived with it are the niche's, not the account's. No figures and
    // no videos then; a full read brings both back.
    figures: kind === "described" || thin ? [] : figuresOf(input.snapshot, platform, usual),
    texts: {
      works: splitFirst(a.signature?.audience?.what_resonates),
      flat: splitFirst(a.signature?.audience?.what_falls_flat),
    },
    videos: thin ? null : videosOf(kind, input.posts, input.pillars, usual, whose),
    isDefault: input.defaultId !== null && a.id === input.defaultId,
    removal: account
      ? { kind: "disconnect", accountId: account.id, handle: handle ?? account.handle.replace(/^@+/, "").toLowerCase() }
      : { kind: "delete" },
    // Not for the creator's own audience with no account behind it: they disconnected it, and a read of a
    // personal audience connects its account again.
    readAgain:
      kind !== "described" && handle !== null && platform === "tiktok" && (kind === "other" || account !== undefined)
        ? { audienceId: a.id, handle, type: a.type === "personal" ? "personal" : "target", goalIntent: goal, name }
        : null,
  };
}

// ─── The switcher and the pick ───────────────────────────────────────────────

/** The creator's own audiences: no General, no preset, no `mode: "general"` row. */
export const ownAudiences = (audiences: readonly Audience[]): Audience[] => groupAudiences([...audiences]).yours;

/** The switcher's rows: the creator's own audiences, their own account's first, each part in list order. */
export function switcherChoicesOf(
  audiences: readonly Audience[],
  accounts: readonly AccountRef[],
  defaultId: string | null,
): SwitcherChoice[] {
  const rows = ownAudiences(audiences).map((a) => {
    const { kind, name, label, platform } = identityOf(a, accounts, audiences);
    const choice: SwitcherChoice = {
      id: a.id,
      name,
      label,
      line: choiceLine(kind, platform, videosRead(a)),
      face: { initial: initialOf(label), picture: null },
      selected: defaultId !== null && a.id === defaultId,
    };
    return { kind, choice };
  });
  return [...rows.filter((r) => r.kind === "own"), ...rows.filter((r) => r.kind !== "own")].map((r) => r.choice);
}

/** The newest by `created_at`; an equal or unreadable date goes to the later in the list (the list is oldest first). */
function newest(list: readonly Audience[]): Audience | undefined {
  let best: Audience | undefined;
  let bestAt = Number.NEGATIVE_INFINITY;
  for (const a of list) {
    const ms = Date.parse(a.created_at);
    const at = Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
    if (best === undefined || at >= bestAt) {
      best = a;
      bestAt = at;
    }
  }
  return best;
}

/**
 * Which audience `/audience` shows: the default when it is one of the creator's with groups;
 * else the newest own-account audience with groups; else the newest with groups; else the newest; none of the
 * creator's own → null.
 */
export function pickAudience(audiences: readonly Audience[], accounts: readonly AccountRef[], defaultId: string | null): Audience | null {
  const yours = ownAudiences(audiences);
  const withGroups = yours.filter((a) => rosterOf(a).length > 0);
  const byDefault = defaultId === null ? undefined : withGroups.find((a) => a.id === defaultId);
  if (byDefault) return byDefault;
  const ownWithGroups = withGroups.filter((a) => kindOf(a, accountFor(a, accounts, audiences)) === "own");
  return newest(ownWithGroups) ?? newest(withGroups) ?? newest(yours) ?? null;
}
