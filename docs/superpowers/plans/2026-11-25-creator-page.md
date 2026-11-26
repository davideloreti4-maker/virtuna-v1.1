# The creator's page (the new Competitors): implementation plan

> **Built 2026-11-25.** This plan was written before several points were settled during the build (the
> count on a card reads "106K views", not "106.1K"; the columns split by the body's width; the name takes
> two lines; the answers to the questions at its end). Where it differs from the code, the spec's section 11
> ("As built") is what stands.

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. One task per
> implementer, a failing test first for every behaviour, a review after each task. Tasks run in order,
> 1 to 9; a task touches only the files its **Files** list names.

**Goal:** under the new look, a Watchlist row that carries a profile opens a page of that creator,
`/competitors/<handle>`: who they are, their numbers with the date Maven read them, the videos of the
last read by biggest jump, and from there Read again, Build their audience or Simulate for their
viewers, Pull their best videos, a video's sheet (Remix, Save, Watch), Open on TikTok and Remove. Under
the flag `/competitors` and `/competitors/compare` open the Watchlist. Spec:
`docs/superpowers/specs/2026-11-25-creator-page-design.md` (it wins over this plan; the controller's
`/Users/davideloreti/virtuna-next-look/.superpowers/sdd/2026-11-25-competitors/rulings.md` wins over
both). Drawing: `.scratch/next-look/part8c/competitors/competitors-drawing.png` (spec section 7 lists the
departures). Leads: `.scratch/next-look/part8c/competitors/seam-map-2.md` and `seam-map.md`
(corrections at the end of this plan).

**Shape:** no table, column, route, package or request shape is added. Added: one pure module
(`lib/discover-next/creator.ts`), one server read in code (`lib/discover/creator-read.ts`), one hook
beside the follow hook (`useReadChannel`), one container hook lifted out of the Watchlist
(`use-remove-creator.ts`), the page's parts and container in `components/discover-next/`, a route
branch in the three old competitor pages and their loading files, one rule in `nav-config.ts`, the
Watchlist row as a link, fixtures on `/dev/discover`. Lifted, so the pull page, the row and the new
page share one copy: the pulled card (`pulled-card.tsx`), the Remove question step (`remove-step.tsx`),
the pulled video's sheet with its Remix step (`pulled-video-next.tsx`). Branch `feat/competitors-page`,
base `30c972b7`.

**Stack:** Next.js 16 (`params` and `searchParams` are Promises), React 19, TypeScript, Supabase,
TanStack Query 5, Radix (`radix-ui`), Vitest 4 (happy-dom by pragma, Testing Library, vitest-axe),
Tailwind v4.

## Global constraints (every task)

- **Where.** Work only in `/Users/davideloreti/virtuna-competitors`. Never read, list, copy or print a
  `.env*` file.
- **The flag.** Everything new is under `NEW_LOOK_ENABLED` (`src/lib/flags/new-look.ts`). Flag off, the
  three old competitor screens, their loading files, the old Watchlist and every other screen render
  exactly as today; each old route file gains only lines that run when the flag is on, placed first.
  Never change an existing `@theme` value.
- **Never edit:** `src/components/competitors/**`, `src/components/discover/**`, `src/components/channels/**`,
  `src/components/feed/**`, `src/app/actions/**`, `src/app/api/**`, `src/lib/channels/**`,
  `src/lib/audience/**`, `src/lib/audience-next/**`, `src/lib/discover/watchlist-reads.ts`,
  `src/hooks/queries/use-audience-next.ts`, `src/components/shell/**` (but `nav-config.ts` in Task 7),
  `src/components/ui/**`, `src/app/(app)/feed/**`, `src/app/globals.css`, `docs/DESIGN-SYSTEM.md`,
  `package.json`, `supabase/**`; the old code under the new first lines of the competitor route and
  loading files. In `src/components/audience-next/` and `src/components/library-next/` only the three
  one-line edits Task 4 names.
- **Public repository.** No real creator handle, video id or link, email or storage path in code, tests,
  fixtures, comments or docs: `@jay.makes`, `@nia.cooks`, `dev.lifts`, `*.example` hosts,
  `proj.supabase.co` as a made-up Storage host. Never write in a comment or on screen that a route
  checks, limits or charges something it does not.
- **Commits.** Implementers and reviewers do not commit, stage, stash, push or open a pull request. The
  controller commits.
- **Tests.** A failing test first for every behaviour, exercising real behaviour: the real parts with
  Testing Library, the server read against stand-in Supabase clients. Stand-ins only for the router, the
  toast host, `fetch` / the Supabase clients / the competitor action module (a server call), `matchMedia`,
  the page's clock (`performance.now`) and the build-time flag; never for the unit under test; never `-u`.
  Component tests carry `/** @vitest-environment happy-dom */`. Run
  `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run <files> --testTimeout 30000`, then
  `pnpm exec tsc --noEmit`, then `pnpm exec eslint <changed files>`; read each exit status itself, never
  through `tail`.
- **No dev server, no build, no browser, no network, no database, no new dependency** in a task: the
  controller does the looks and the real checks.
- **Look.** Type sizes from the new look's roles only (`text-title`, `text-subhead`, `text-reading`,
  `text-ui`, `text-meta`, `text-label`), no `text-[Npx]` in a new file; colours from tokens only (no hex,
  `rgb(`, palette class), no glass, a shadow only as `shadow-[var(--shadow-…)]`, no accent. Motion (the
  turning Read again) is `motion-safe:` only.
- **Accessibility.** Every control is named; the page's states are announced as `PageNotice` does (the
  failure an alert); the sheet and the menus hand the focus back to what opened them; each screen state
  has a test and the screen's test runs axe, as `watchlist-row.test.tsx` does.
- **Words.** Every string on screen comes from `src/lib/discover-next/discover-words.ts` (the new block
  `creator`, its functions, or the existing blocks it reuses), except the four figure labels (Question 2).
  Never on screen: outlier, teardown, source, channel, scrape, track, usual (but the figure label),
  thread, Test.
- **Guard.** Every new file in `src/components/discover-next/` passes `discover-next-guard.test.ts` as it
  stands; the guard's only edit is ruling 14's (Task 3).
- Comments give the reason, never a task, ruling or review number.
- Reports: `/Users/davideloreti/virtuna-next-look/.superpowers/sdd/2026-11-25-competitors/task-N-report.md`.

## Constants and contracts (shared by all tasks)

### Types (`src/lib/discover-next/creator.ts`, Task 1)

```ts
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
export interface CreatorAudience { id: string; builtOn: string | null }

/** What the page draws. Plain data (a server component hands it to the client): no Date, no Map. */
export interface CreatorPage {
  handle: string;            // bare, lower case: the address, "@handle", the menus, Pull
  name: string | null;       // the display name trimmed; null when none, or held
  bio: string | null;        // trimmed; null when none, or held
  avatarUrl: string | null;  // the stored picture; null when none, or held
  held: boolean;             // the creator's read failed and nothing was kept ("Couldn't be read")
  read: string | null;       // "read 13 Jul" ("read 13 Jul 2025" in another year); null: never read
  canReadAgain: boolean;     // never read, or the last read is 24 hours old or older (the server's gate)
  figures: Figure[];         // Followers, Likes, Posts, Usual views: those known, in that order; none held
  videos: PulledVideo[];     // the last read's, biggest jump first; none held
  audience: CreatorAudience | null;
  removal: Removal | null;   // the records Remove clears; null: no Remove
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

export function creatorVideoOf(row: CreatorVideoRow, handle: string): PulledVideo | null;
export function lastReadOf(rows: readonly CreatorVideoRow[]): CreatorVideoRow[];
export function creatorVideosOf(rows: readonly CreatorVideoRow[], handle: string): { videos: PulledVideo[]; usual: number | null };
export function canReadAgainAt(lastScrapedAt: string | null, now: Date): boolean;
export function builtOn(iso: string | null | undefined, now: Date): string | null;
export function theirAudience(audiences: readonly Audience[], handles: readonly string[], now: Date): CreatorAudience | null;
export function creatorFiguresOf(profile: CreatorProfileRow, usual: number | null): Figure[];
export function creatorPageOf(input: CreatorInput): CreatorPage;
```

`import { kindOf … }` is a run-time import of a pure module (`audience-model.ts`; its purity is pinned by
`lib/audience-next/__tests__/purity.test.ts`). Only the server read and the dev fixtures import
`creator.ts` at run time; every part and container imports its types with `import type`.

### Addresses (`src/lib/discover-next/discover-view.ts`, Task 1, additive)

```ts
/** A handle as an address carries it: trimmed, without its "@", lower case. */
const bareHandle = (handle: string): string => handle.trim().replace(/^@+/, "").toLowerCase();

/** The creator an address names: decoded when it came encoded, trimmed, without "@", lower case; "" for none. */
export function creatorHandleOf(segment: string | null | undefined): string {
  let raw = segment ?? "";
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // A stray "%": read as written.
  }
  return bareHandle(raw);
}

/** A followed creator's page. */
export function creatorHref(handle: string): string {
  return `/competitors/${encodeURIComponent(bareHandle(handle))}`;
}

/** The new-audience page with the "Another creator" row chosen and its field filled. */
export function audienceFromHref(handle: string): string {
  return `/audience/new?door=handle&handle=${encodeURIComponent(bareHandle(handle))}`;
}

/** The Watchlist chip of Discover. */
export const WATCHLIST_HREF = discoverHref({ ...DEFAULT_DISCOVER_VIEW, tab: "watchlist" }); // "/feed?tab=watchlist"
```

### Words (`src/lib/discover-next/discover-words.ts`, Task 1)

Hoist two strings the Watchlist already writes so each is written once: `const HELD = "Couldn't be read";`,
`const PULL_THEIR_BEST = \`Pull their best videos · ${creditsWords(PULL_PRICE)}\`;`; `watchlist.held`
and `watchlist.pull` take them (their values do not change). Import `AUDIENCE_STRINGS` from
`@/lib/audience-next/audience-words` for the one sentence borrowed from the Audience page.

```ts
  creator: {
    /** The page's title before it knows the creator (loading, gone, failed), as "Collection" and "Video". */
    title: "Creator",
    readAgain: "Read again",
    reading: "Reading…",
    readToday: "Read today. Maven reads a creator once a day.",
    held: HELD,
    heldLine: "Maven couldn't read this account. Read again, or remove it.",
    build: "Build their audience",
    buildLine: "Then simulate your video for their viewers. About two minutes. Free.",
    simulate: "Simulate a video for their viewers",
    /** Choosing their audience for new chats was refused: the Audience page's own sentence. */
    simulateFailed: AUDIENCE_STRINGS.switchFailed, // "Couldn't switch the audience."
    pull: PULL_THEIR_BEST,
    videos: "Their videos",
    order: BIGGEST_JUMP,
    noVideos: "No videos read yet. Read again to get their latest.",
    gone: "This creator isn't on your watchlist.",
    watchlist: "Watchlist",
    failed: "Couldn't load this creator.",
    tryAgain: TRY_AGAIN,
  },
```

```ts
/** A card's foot on a creator's page: "106.1K views", "1 view". */
export function viewsWords(n: number): string;            // `${viewsLabel(n)} ${n === 1 ? "view" : "views"}`
/** The card's line: "@jay.makes · TikTok · read 13 Jul · 12 videos"; a part not known is left out with its
 *  dot (`handle` null when the heading already is the handle; `videos` 0 leaves the count out). */
export function creatorLine(parts: { handle: string | null; read: string | null; videos: number }): string;
/** Under "Simulate a video for their viewers": "Their audience was built 14 Nov." */
export function audienceBuilt(day: string): string;
/** Read again failed: "Couldn't read @jay.makes. Try again later." */
export function readFailed(handle: string): string;
/** The More button's name: "More: @jay.makes". */
export function creatorMore(handle: string): string;
```

`creatorLine` joins, with ` · `: `at(handle)` when given, `PLATFORM_NAMES.tiktok`, `read`, and
`videosCount(videos)` when `videos > 0`. The menu's own words stay the Watchlist's
(`DISCOVER_STRINGS.watchlist.openOnTikTok`, `remove`, `cancel`, `removeQuestion`, `removeRefused`,
`DISCOVER_STRINGS.video.newTab`): it is the row's menu, moved.

### Lifted parts and hooks (Tasks 3 and 4)

```ts
// src/hooks/queries/use-channels.ts (Task 3, additive)
export function useReadChannel(): UseMutationResult<AddChannelResult["status"], AddChannelError, string>;
export function useChannelReadOut(handle: string): boolean; // (pending Q4)

// src/components/discover-next/use-remove-creator.ts (Task 3)
export function useRemoveCreator(): (removal: Removal) => Promise<boolean>;

// src/components/discover-next/video-card.tsx (Task 4, additive)
/** What a card says at its foot: "@handle · 39.8M" (Discover's grids), or "106.1K views" alone (a
 *  creator's page, whose cards are all theirs). */
export type CardFoot = "byline" | "views";
export function VideoCardFace(props: { video: CardVideo; id: string; foot?: CardFoot }): React.JSX.Element; // default "byline"
export function cardDescribedBy(id: string, video: CardVideo, foot?: CardFoot): string | undefined;

// src/components/discover-next/pulled-card.tsx (Task 4, moved from pull-screen.tsx)
export function PulledCard(props: { video: PulledVideo; onOpen(video: PulledVideo, from: HTMLElement): void; foot?: CardFoot }): React.JSX.Element;

// src/components/discover-next/remove-step.tsx (Task 4, moved from watchlist-row.tsx)
export const CONFIRM_WAIT_MS = 500;
export interface RemoveStepProps {
  handle: string;                                        // bare: "Remove @jay.makes?"
  askedAt: React.RefObject<number>;                      // when the question appeared (`performance.now()`)
  cancelRef: React.RefObject<HTMLButtonElement | null>;  // the caller focuses Cancel when the question appears
  onCancel(): void;
  onConfirm(): void;                                     // only 500 ms or more after the question appeared
}
export function RemoveStep(props: RemoveStepProps): React.JSX.Element;

// src/components/discover-next/pulled-video-next.tsx (Task 4, moved from pull-next.tsx)
export interface PulledVideoLayerProps {
  video: PulledVideo | null;            // the video whose sheet is open (or closing); null before the first
  open: boolean;
  onOpenChange(open: boolean): void;
  returnFocus(): HTMLElement | null;    // the card the sheet and the Remix question hand the focus back to
}
export function PulledVideoLayer(props: PulledVideoLayerProps): React.JSX.Element;

// src/components/discover-next/video-screen.tsx (Task 4): the private `COLUMNS` becomes
export const PAGE_COLUMNS = "mx-auto flex max-w-[980px] flex-col gap-4 md:grid md:grid-cols-[minmax(0,372fr)_minmax(0,588fr)] md:items-start md:gap-5";
```

### The screen (Task 5)

```ts
// src/components/discover-next/creator-screen.tsx
export interface CreatorActions {
  reading: boolean;      // a read is out: Read again turns and is busy, the line says "Reading…"
  onReadAgain(): void;
  simulating: boolean;   // their audience is being chosen for new chats: the main button waits
  onSimulate(): void;
  onPull(): void;
  onOpen(video: PulledVideo, from: HTMLElement): void; // a card is pressed (`from`: to come back to)
  onRemove(): void;      // Remove, confirmed in the menu
}
export type CreatorScreenProps =
  | { state: "loading" }
  | { state: "gone" }
  | { state: "failed"; onRetry(): void }
  | ({ state: "ready"; creator: CreatorPage } & CreatorActions);
export function CreatorScreen(props: CreatorScreenProps): React.JSX.Element;

// src/components/discover-next/creator-card.tsx
export interface CreatorCardProps {
  creator: CreatorPage;
  reading: boolean;
  onReadAgain(): void;
  more: React.ReactNode; // after Read again: the phone's More (the screen wraps it `md:hidden`)
}
export function CreatorCard(props: CreatorCardProps): React.JSX.Element;

// src/components/discover-next/creator-menu.tsx
export interface CreatorMenuProps {
  handle: string;
  removable: boolean;           // the page holds records Remove can clear
  onRemove(): void;
  surface: "card" | "ground";   // the round button's ground: in the card (a phone), in the header (a desk)
}
export function CreatorMenu(props: CreatorMenuProps): React.JSX.Element | null; // null: nothing to offer

// src/components/discover-next/creator-next.tsx (Task 6)
export interface CreatorNextProps { read: CreatorRead }
export function CreatorNext(props: CreatorNextProps): React.JSX.Element;
export function CreatorNextLoading(): React.JSX.Element;

// src/lib/discover/creator-read.ts (Task 2)
export function getCreatorPage(supabase: ServerClient, handle: string, now: Date): Promise<CreatorRead>;
```

---

### Task 1: words and the pure rules

**Files:** create `src/lib/discover-next/creator.ts`, `src/lib/discover-next/__tests__/creator.test.ts`;
modify `src/lib/discover-next/discover-words.ts`, `discover-view.ts`, `pull.ts` (three `export`
keywords, nothing else), and their tests `__tests__/discover-words.test.ts`, `discover-view.test.ts`,
`pull.test.ts`. **Must not touch** anything else.

**Failing tests first.**

`discover-words.test.ts`:
- `the creator's page` — `DISCOVER_STRINGS.creator` equals the contract object, values written out
  (`simulateFailed` is `"Couldn't switch the audience."`, `pull` `"Pull their best videos · 5 credits"`,
  `held` `"Couldn't be read"`), and `watchlist.held` / `watchlist.pull` keep their values.
- `the creator's sentences` — `viewsWords(106_100)` `"106.1K views"`, `(849_100)` `"849K views"`,
  `(1)` `"1 view"`; `creatorLine({ handle: "jay.makes", read: "read 13 Jul", videos: 12 })`
  `"@jay.makes · TikTok · read 13 Jul · 12 videos"`, `({ handle: null, read: "Reading…", videos: 1 })`
  `"TikTok · Reading… · 1 video"`, `({ handle: "jay.makes", read: null, videos: 0 })`
  `"@jay.makes · TikTok"`; `audienceBuilt("14 Nov")` `"Their audience was built 14 Nov."`;
  `readFailed("@jay.makes")` `"Couldn't read @jay.makes. Try again later."`; `creatorMore("jay.makes")`
  `"More: @jay.makes"`.
- the "words never on screen" list gains the outputs above.

`discover-view.test.ts`: `creatorHref(" @Jay.Makes ")` `"/competitors/jay.makes"`;
`creatorHandleOf("%40Jay.Makes")` `"jay.makes"`, `(" @nia.cooks ")` `"nia.cooks"`, `("50%")` `"50%"`,
`(undefined)` `""`; `audienceFromHref("@jay.makes")` `"/audience/new?door=handle&handle=jay.makes"`;
`WATCHLIST_HREF` `"/feed?tab=watchlist"`.

`pull.test.ts`: `PROVEN_FROM` is 3 and `EXTREME_FROM` 100; `captionLine("Day 3 #fyp #1 fan")`
`"Day 3 #1 fan"`, `("#fyp #foryou")` null (what the private function did; the existing cases stay).

`creator.test.ts` (pure; rows and audiences made up; audiences built with the builders of
`src/lib/audience-next/__tests__/audiences.ts`, imported by the test only; `NOW = new Date("2026-11-25T12:00:00Z")`):
- `a video row becomes the pulled video the sheet draws` — id `platform_video_id`, handle the creator's,
  platform `tiktok`, `captioned: true`, the caption without hashtags, views, likes, comments, `postedAt`,
  `videoUrl` from `webAddress`, `niche` null, `formats` [].
- `a cover only when Maven stores it` — `https://proj.supabase.co/storage/v1/object/public/covers/tiktok/v1.jpg`
  kept; a `https://p16-sign.tiktokcdn.example/…` cover and none are null.
- `"vs own" is handed on as their average; another label as stored` — `baselineLabel` `"vs their average"`
  and `multipleWords(video)?.text` `"12× their average"`; `"vs niche"` stays `"vs niche"`; null stays null.
- `proven from 3× with a label; clamped at 100; past 100 is extreme` — 2.9 not proven, 3 proven, a 4.2 with
  no label not proven, `"4.2"` (a string) read as 4.2, 412 gives `multiplier` 100 and `extreme` true.
- `a row with no id is left out; missing counts` — views null → 0, likes null → null.
- `the last read only` — rows of two reads (two `ingested_at` values) give the newer read's rows; a row
  without `ingested_at`, or with an unreadable one, is left out; none readable → no videos.
- `biggest jump first, then views` — raw multiples 412, 150, 12, 12 (views 9 and 90): 412, 150, then the
  12 with 90 views; each id once.
- `usual views: the last read's stored baseline` — the first finite one above zero (`"8600"` read as
  8600; 0 skipped); none → no Usual views figure.
- `the figures, those known, in order` — Followers, Likes, Posts, Usual views with
  `viewsWord` values (15_400_000 `"15.4M"`, 369_100_000 `"369.1M"`, 6_364 `"6.4K"`, 8_600 `"8.6K"`); a null
  or 0 count is left out; labels `"Followers"`, `"Likes"`, `"Posts"`, `"Usual views"` (`AUDIENCE_STRINGS`).
- `Read again: never read, or 24 hours old` — null true, unreadable true, 23 h 59 min false, 24 h true.
- `the read's date in words` — `creatorPageOf(…).read` `"read 13 Jul"`; another year `"read 13 Jul 2025"`;
  never `null`.
- `their audience` — another creator's audience read from this handle (`other({ calibration: { …, handle: "jay.makes" } })`)
  is found; by the read's own handle when the calibration has none; a thin read of the handle
  (`calibration.source "description"`, its handle, no `goal_label`) counts; the creator's own (`own`) and a
  described one whose provenance handle equals the handle do not; another creator's does not; the
  folded spelling (`mergedFrom`) matches; two of them: the newer read; an undated one only when no
  dated one; `builtOn` `"14 Nov"`, another year `"14 Nov 2025"`, undated `null`; none → `null`.
- `held: a failed read with nothing kept` — name, bio, picture null, no figures, no videos (even with
  rows), `read` and `canReadAgain` still worked out, `removal` kept.
- `the page` — `handle` from the profile (bare, lower case), name and bio trimmed (blank → null),
  `removal` from the source (`removalOf`), and the page survives a JSON round trip unchanged.

**Steps.**
1. `pull.ts`: `export` `PROVEN_FROM`, `EXTREME_FROM` and `captionLine` (`:34-35`, `:151`). Nothing else.
2. `discover-view.ts`, `discover-words.ts`: the contracts above.
3. `creator.ts`, the subtle parts in code:

```ts
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
export function creatorVideosOf(rows: readonly CreatorVideoRow[], handle: string) {
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

export function canReadAgainAt(lastScrapedAt: string | null, now: Date): boolean {
  const t = Date.parse(lastScrapedAt ?? "");
  return !Number.isFinite(t) || now.getTime() - t >= READ_GATE_MS;
}

/** The day of a read as the Audience page words it, without its "read ": "14 Nov", "14 Nov 2025". */
export function builtOn(iso: string | null | undefined, now: Date): string | null {
  return readOn(iso, now)?.replace(/^read /, "") ?? null;
}

/** A handle as the Audience page reads one off an audience (`handleText`, `audience-model.ts:136-141`). */
const handleText = (value: unknown): string | null => {
  const raw = text(value);
  if (raw === null) return null;
  const handle = raw.replace(/^@+/, "").toLowerCase();
  return ACCOUNT_HANDLE.test(handle) ? handle : null;
};
/** The handle an audience was read from, by `identityOf`'s rule with no account behind it
 *  (`audience-model.ts:390-393`, private there): the calibration's, else the read's. */
const audienceHandleOf = (a: Audience) => handleText(a.calibration?.handle) ?? handleText(a.signature?.provenance?.handle);
/** When it was read (`audience-model.ts:415`). */
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
```

`creatorFiguresOf`: Followers (`follower_count`), Likes (`heart_count`), Posts (`video_count`), Usual
views (`usual`), each only when `finite(n)` is above 0 (a 0 is a read that found none, as `rowLine`
says), the value `viewsWord(n)`, the label from `AUDIENCE_STRINGS` (`followers`, `likes`, `posts`,
`usualViews`). `creatorPageOf`: as the `CreatorPage` comments say; `handle` is
`creatorHandleOf(profile.tiktok_handle)`; when `source.held` the videos and figures are not worked out;
`audience` is `theirAudience(audiences, [handle, source.mergedFrom ?? ""], now)`.

**Done when** the four test files pass, every other test under `src/lib/discover-next/__tests__/` and
`src/lib/__tests__/multiple-words.test.ts` stay green, tsc is clean. **Report:** `task-1-report.md`.

### Task 2: the server read

**Files:** create `src/lib/discover/creator-read.ts`, `src/lib/discover/__tests__/creator-read.test.ts`.
**Must not touch** `watchlist-reads.ts` and its test, `audience-repo.ts`, anything else.

**The read** (comment header: why the profile is read with the service client, as `watchlist-reads.ts:19-29`
says, and that the Watchlist's read decides who the caller follows, so a page exists exactly for the rows
that carry a profile):

```ts
import { listAudiences } from "@/lib/audience/audience-repo";
import { creatorPageOf, type CreatorProfileRow, type CreatorRead, type CreatorVideoRow } from "@/lib/discover-next/creator";
import { creatorHandleOf } from "@/lib/discover-next/discover-view";
import { createServiceClient } from "@/lib/supabase/service";
import type { createClient } from "@/lib/supabase/server";

import { getWatchlistData } from "./watchlist-reads";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export const PROFILE_COLUMNS =
  "id, tiktok_handle, display_name, bio, avatar_url, follower_count, heart_count, video_count, last_scraped_at, scrape_status";
export const VIDEO_COLUMNS =
  "platform_video_id, video_url, description, views, likes, comments, posted_at, outlier_multiplier, baseline_label, " +
  "cover_url:metadata->>cover_url, ingested_at:metadata->>ingested_at, baseline_views:metadata->>baseline_views";

export async function getCreatorPage(supabase: ServerClient, rawHandle: string, now: Date): Promise<CreatorRead> {
  const handle = creatorHandleOf(rawHandle);
  if (!handle) return { state: "gone" };
  const watchlist = await getWatchlistData(supabase);
  // Whom the caller follows could not be told: the page's failure, never "not on your watchlist".
  if (watchlist.incomplete) return { state: "failed" };
  const source = watchlist.sources.find((s) => s.profileHandle !== null && creatorHandleOf(s.profileHandle) === handle);
  if (!source) return { state: "gone" };

  // A row with a profile is keyed by the profile's id (`watchlist-reads.ts`, `key: p.id`).
  const handles = [...new Set([creatorHandleOf(source.profileHandle), creatorHandleOf(source.mergedFrom)].filter(Boolean))];
  const [profileRes, videosRes, audiences] = await Promise.all([
    createServiceClient().from("competitor_profiles").select(PROFILE_COLUMNS).eq("id", source.key).maybeSingle(),
    supabase.from("scraped_videos").select(VIDEO_COLUMNS).eq("platform", "tiktok").in("creator_handle", handles)
      .not("outlier_multiplier", "is", null),
    listAudiences(supabase),
  ]);
  if (profileRes.error) throw new Error(`creator profile read failed: ${profileRes.error.message}`);
  if (videosRes.error) throw new Error(`creator videos read failed: ${videosRes.error.message}`);
  const profile = profileRes.data as CreatorProfileRow | null;
  if (!profile) return { state: "gone" };
  const videos = (videosRes.data ?? []) as CreatorVideoRow[];
  return { state: "ready", creator: creatorPageOf({ source, profile, videos, audiences, now }) };
}
```

A failed videos or audiences read fails the page (Question 7). No `"use server"`, no `"server-only"` (as
`watchlist-reads.ts`); only the route imports it.

**Failing tests first** (node env). The stand-in is the Watchlist read's (`watchlist-reads.test.ts:32-53`),
copied, with one addition: `maybeSingle()` answers the first row of the table matching every
`.eq(column, value)` recorded on that builder, or `null`. The caller's client and `createServiceClient`
(`vi.mock("@/lib/supabase/service")`) are the stand-ins; `getWatchlistData`, `listAudiences` and
`creatorPageOf` run for real. Fixture: `tracked_accounts` `jay.makes` (t-1, folding into the profile
`jaymakes`, id `p-jay`) and `dev.lifts` (t-2, no profile), `user_competitors` `p-jay` and `p-nia`; service
`competitor_profiles` `p-jay`, `p-nia` (`nia.cooks`, last read 2026-11-25T08:00:00Z), and `p-ari`
(`ari.codes`, `scrape_status: "failed"`, no followers, linked); `scraped_videos` rows for `jaymakes` and
`jay.makes` over two reads; `audiences` one row read from `jaymakes`.
- `a followed creator with a profile: the page` — `getCreatorPage(user, "jaymakes", NOW)` is `ready`
  with the handle, figures, the last read's videos in order, `read` `"read 13 Jul"`, `audience`.
- `the address is read as a handle` — `"%40JayMakes"` and `" @jaymakes "` find the same page.
- `the profile is read on the service client, by its id, with the page's columns` — the service calls
  hold `from competitor_profiles`, `select PROFILE_COLUMNS`, `eq("id", "p-jay")`, `maybeSingle`.
- `the videos on the caller's client: TikTok, both spellings, measured only` — the user calls hold
  `select VIDEO_COLUMNS`, `eq("platform","tiktok")`, `in("creator_handle", ["jaymakes","jay.makes"])`,
  `not("outlier_multiplier","is",null)`; a creator with no folded spelling asks for one handle.
- `the audiences on the caller's client` — a `from("audiences")` call on the user stand-in, none on the service one.
- `not followed, no such creator, a row with no profile: gone` — `"kai.wanders"`, `"dev.lifts"` (tracked, no
  profile), `""` (nothing read at all).
- `held: the page of a creator whose read failed with nothing kept` — `"ari.codes"`: `held` true.
- `whom the caller follows could not be read: failed, nothing more read` — `tracked_accounts` failing:
  `{ state: "failed" }` and no `scraped_videos`, `audiences` or by-id profile call.
- `a profile, videos or audiences read that fails throws` — three cases (`competitor_profiles` failing only
  on the by-id read: a builder holding an `eq("id", …)` answers an error), each `rejects.toThrow`.
- `the profile gone between the two reads: gone` — by-id read answers `null`.

**Done when** the test passes and `watchlist-reads.test.ts`, `read-degradation.test.ts` stay green,
tsc clean. **Report:** `task-2-report.md`.

### Task 3: the hooks, and the guard's allow-list

**Files:** modify `src/hooks/queries/use-channels.ts`, `src/hooks/queries/__tests__/use-channels.test.tsx`,
`src/components/discover-next/watchlist-next.tsx` (the Remove calls only),
`src/components/discover-next/__tests__/discover-next-guard.test.ts`; create
`src/components/discover-next/use-remove-creator.ts`, `__tests__/use-remove-creator.test.tsx`. **Must
not touch** `useAddChannel`'s behaviour, `watchlist-panel.test.tsx` (it stays green unchanged), the old
channel screens.

**`useReadChannel` and `useChannelReadOut`** (beside `useAddChannel`):

```ts
// the file's TanStack import gains `useMutationState`
/** The key a read alone is sent under, so a page opened again can tell one is still out. */
const READ_KEY = [...queryKeys.channels.all, "read"] as const;

/**
 * MUTATION: read a creator again, without following: `POST /api/channels/ingest {handle}` alone. Answers
 * the route's `status`: "scraped" (read now) or "cached" (read in the last day; the server read nothing).
 * Refused as the add's read step is: `status` (none when no answer came) and `step: "read"`.
 */
export function useReadChannel() {
  return useMutation<AddChannelResult["status"], AddChannelError, string>({
    mutationKey: READ_KEY,
    mutationFn: async (handle) => {
      const res = await call("read", () =>
        fetch("/api/channels/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle }),
        }),
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw addRefusal(new Error(body?.message ?? "Could not read this channel"), "read", res.status);
      }
      const result = (await res.json().catch(() => null)) as Partial<AddChannelResult> | null;
      return result?.status === "cached" ? "cached" : "scraped";
    },
  });
}

/** Whether a read of `handle` (`useReadChannel`) is still out, sent from any page of this tab. */
export function useChannelReadOut(handle: string): boolean {
  const out = useMutationState({
    filters: { mutationKey: READ_KEY, status: "pending" },
    select: (mutation) => mutation.state.variables,
  });
  return out.some((variables) => variables === handle);
}
```

(`useMutationState` is TanStack Query 5's; check its typing in the installed `node_modules` before
writing, and keep the signature above.)

**`use-remove-creator.ts`** (container hook; the calls of `watchlist-next.tsx:92-105`, moved):

```ts
"use client";

import { useCallback } from "react";

import { removeCompetitor } from "@/app/actions/competitors/remove";
import { useUntrackChannel } from "@/hooks/queries/use-channels";
import type { Removal } from "@/lib/discover-next/watchlist";

/**
 * Remove a followed creator: every record the row rests on, side by side (each followed spelling, and the
 * competitor link). True when all are gone; false when one was refused (a thrown call, or the action's
 * answer with an error). One copy, for the Watchlist and the creator's page.
 */
export function useRemoveCreator(): (removal: Removal) => Promise<boolean> {
  const { mutateAsync: untrack } = useUntrackChannel();
  return useCallback(
    async (removal: Removal) => {
      const calls: Promise<unknown>[] = [
        ...removal.trackedIds.map((id) => untrack(id)),
        ...(removal.competitorId
          ? [
              Promise.resolve(removal.competitorId)
                .then(removeCompetitor)
                .then((result) => {
                  if (result?.error) throw new Error(result.error);
                }),
            ]
          : []),
      ];
      const results = await Promise.allSettled(calls);
      return results.every((r) => r.status === "fulfilled");
    },
    [untrack],
  );
}
```

`watchlist-next.tsx`: `const removeCreator = useRemoveCreator();`; in `remove`, the `calls` /
`allSettled` block becomes `const done = await removeCreator(removal);` and the branch reads `if (!done)`;
`useUntrackChannel` and `removeCompetitor` leave its imports. Everything else in the file stays.

**The guard** (`discover-next-guard.test.ts`): `ALLOWED` gains `"@/hooks/queries/use-audience-next"`;
rule 4 of the header comment says `use-saved-items`, `use-channels` and `use-audience-next` (the
creator's page chooses their audience for new chats); "the guard itself" gains
`'import { useSetDefaultAudience } from "@/hooks/queries/use-audience-next";'` in "a container may
import" and in "a part may not import a data hook or a server action". Nothing else.

**Failing tests first.**
- `use-channels.test.tsx` (stand-in: `fetch`; a real `QueryClient`):
  `useReadChannel sends the read alone: one POST /api/channels/ingest with the handle, no follow`;
  `answers the route's status: scraped, cached`; `a refusal says step "read" and its status, with the
  route's message` (404 with `message`; 401 with none: `"Could not read this channel"`; a gateway's
  HTML 504); `no answer: its own error, step "read", no status`;
  `useChannelReadOut: true while a read of that handle is out, from another hook on the same client too;
  false for another handle and once it settles` (a held `fetch`; two `renderHook`s on one client, the
  second mounted after the read was sent). The existing `useAddChannel` cases stay unchanged.
- `use-remove-creator.test.tsx` (stand-ins: `fetch` for `DELETE /api/tracked-accounts?id=`, the action
  module as `watchlist-panel.test.tsx:22-23` stubs it): `a followed-only creator: one DELETE per record,
  no action`; `a linked-only creator: the action, no DELETE`; `a merged creator: both records and the
  link, sent side by side` (all three started before any answers); `all answered: true`; `a refused
  DELETE: false`; `the action's answer with an error: false`; `the action throwing: false`.
- `discover-next-guard.test.ts`: the new "guard itself" cases, and every file of the folder stays green.
- `watchlist-panel.test.tsx` runs unchanged and green (its Remove cases now go through the hook).

**Done when** these pass, tsc clean, eslint clean on the changed files. **Report:** `task-3-report.md`.

### Task 4: the shared parts, lifted

**Files:** create `src/components/discover-next/pulled-card.tsx`, `remove-step.tsx`, `pulled-video-next.tsx`;
modify `video-card.tsx`, `pull-screen.tsx`, `pull-next.tsx`, `watchlist-row.tsx`, `video-screen.tsx` (the
export only), `__tests__/video-card.test.tsx`; and three one-line edits outside the folder:
`src/components/library-next/row-menu-layer.tsx` (the `firstRef` type), `src/components/audience-next/source-card.tsx`
(`export` on `ReadAgainIcon`), `src/components/audience-next/audience-screen.tsx` (`export` on
`ArrowGlyph`). **Must not touch** any markup the moved code draws (the pull page, the row and the menus
render the same DOM), `pull-next.test.tsx`, `watchlist-row.test.tsx`, `watchlist-panel.test.tsx`,
`video-next.test.tsx`, Library's and You's menus.

**Steps.**
1. `video-card.tsx`: `CardFoot`, `VideoCardFace`'s `foot` (default `"byline"`, today's markup unchanged)
   and `cardDescribedBy`'s third argument (default `"byline"`). With `"views"` the meta is one
   `<span id={`${id}-meta`} data-part="views" className="shrink-0 whitespace-pre">` holding
   `viewsWords(views)` when `shownViews(video.views)` is not null, inside the same meta line; no handle
   part; `cardDescribedBy` names `${id}-meta` only when that count is shown.
2. `pulled-card.tsx`: `PulledCard` moves out of `pull-screen.tsx:88-107` as it is, with `foot` handed to
   `VideoCardFace` and `cardDescribedBy`. `pull-screen.tsx` imports it; `useId`, `cardName`,
   `cardDescribedBy`, `CARD_BOX`, `VideoCardFace` leave its imports when unused.
3. `remove-step.tsx`: the three `MenuRow`s of `watchlist-row.tsx:177-197` as they are (the question as a
   `<p id={useId()}>` reading `removeQuestion(handle)`, Cancel with `cancelRef`, the confirming Remove
   `aria-describedby` the question), and the 500 ms check moved into the part:
   ```ts
   const confirm = () => {
     // Inside the window the press is dropped, not kept for later.
     if (performance.now() - askedAt.current < CONFIRM_WAIT_MS) return;
     onConfirm();
   };
   ```
   `watchlist-row.tsx`: `step === "remove"` renders `<RemoveStep handle={handle} askedAt={askedAt}
   cancelRef={cancelRef} onCancel={close} onConfirm={confirmRemove} />`; `confirmRemove` keeps its `live`
   check and loses the time check; `CONFIRM_WAIT_MS` and `questionId` leave the row.
4. `pulled-video-next.tsx` (a container: it holds Save): `OpenedSheet` moves from `pull-next.tsx:51-57`
   unchanged; `PulledVideoLayer` holds what `pull-next.tsx:111-141` held:
   ```tsx
   export function PulledVideoLayer({ video, open, onOpenChange, returnFocus }: PulledVideoLayerProps): React.JSX.Element {
     const { newThreadAt } = useThreadActions();
     const [asking, setAsking] = useState(false);
     // A remix left for Home, from this video or another: every Remix of the page waits until it goes. A
     // remix is paid, and one is all a creator asked for. Left as of the last press, not the last render.
     const [waiting, setWaiting] = useState(false);
     const starting = useRef(false);
     const startRemix = (brief: string | null) => {
       if (!video || starting.current || waiting) return;
       if (!leaveRemixFrom({ url: video.videoUrl ?? "", platform: video.platform, brief })) return;
       starting.current = true;
       setWaiting(true);
       newThreadAt("/home");
     };
     const remix = () => (onOpenChange(false), setAsking(true));
     return (
       <>
         {video && <OpenedSheet key={video.id} video={video} open={open} onOpenChange={onOpenChange} remixWaiting={waiting} onRemix={remix} returnFocus={returnFocus} />}
         <RemixSheet open={asking} onOpenChange={setAsking} onRemix={startRemix} returnFocus={returnFocus} />
       </>
     );
   }
   ```
   `pull-next.tsx`: keeps `opened`, `sheetOpen`, `card`, `toCard`, `open`; renders
   `<PulledVideoLayer video={opened} open={sheetOpen} onOpenChange={setSheetOpen} returnFocus={toCard} />`
   after `PullScreen`; its header comment keeps its Remix bullet (the layer does it).
5. `video-screen.tsx`: `const COLUMNS` becomes `export const PAGE_COLUMNS` (same value; its two uses at
   `:261` and `:321` follow).
6. `row-menu-layer.tsx`: `firstRef: React.RefObject<HTMLElement | null>;` (was `HTMLButtonElement`), so a
   link can be a menu's first item; its callers' button refs still fit.
7. `source-card.tsx:27` and `audience-screen.tsx:128`: `export function`, nothing else (the creator's card
   draws the Audience's Read again glyph, its main button the Audience's arrow: one drawing each).

**Failing tests first** (`video-card.test.tsx`):
- `a card's foot: the byline by default` — `@a.very.long.made.up.handle` and ` · 86.3M` as today.
- `a card's foot: the views alone on a creator's page` — `foot="views"`: `86.3M views`, no handle part,
  described by it; a video with 0 views: no foot, no description from it; one view: `1 view`.
- the source test `the pulled card draws the library card's face, and keeps no copy of it` reads
  `pulled-card.tsx` instead of `pull-screen.tsx` (the card moved; the assertion is the same).
- `a pulled card is a button that opens its video` — `PulledCard` named by its line, `aria-haspopup`
  `dialog`, a press calls `onOpen` with the video and the button, which has the focus.

**Done when** these pass and, unchanged, `pull-next.test.tsx`, `watchlist-row.test.tsx`,
`watchlist-panel.test.tsx`, `video-next.test.tsx`, `src/components/library-next/__tests__/row-menu.test.tsx`,
`src/components/you-next/__tests__/account-menu.test.tsx`, `src/components/audience-next` (all), the
discover, library and audience guards, and `src/app/(app)/dev/discover/__tests__/page.test.ts` stay
green. **Report:** `task-4-report.md`.

### Task 5: the parts and the screen with its states

**Files:** create `src/components/discover-next/creator-card.tsx`, `creator-menu.tsx`, `creator-screen.tsx`,
`__tests__/creator-screen.test.tsx`. **Must not touch** anything else.

**`CreatorCard`** (spec 3.2.2, 3.3; drawing frame 2). `Card` (`ui/card`) as the Audience's source card,
`className="flex flex-col rounded-[22px] px-3.5 py-3"`, `data-part="creator-card"`. Top row
`flex items-center gap-3`: `Face` (`audience-next/face`) with `{ initial: initialOf(handle), picture: avatarUrl }`
(`initialOf` of `watchlist.ts`) at 48; the words column `min-w-0 flex-1`: the heading `h2`
(`line-clamp-2 break-words text-title font-[650] text-foreground`): the name, else `@handle` (held:
`@handle`); the line `p` (`break-words text-meta text-foreground-secondary tabular-nums`,
`aria-live="polite"`): held `S.held`, else `creatorLine({ handle: named ? handle : null, read: reading ?
S.reading : read, videos: videos.length })`; at the right `flex shrink-0 items-center gap-2`: Read again,
then `more`. Under the row, when not held and there is a bio: `p` `mt-2.5 line-clamp-3 break-words text-ui
text-foreground-secondary`.

Read again: `IconButton surface="card" aria-label={S.readAgain}` holding (`ReadAgainIcon` from
`audience-next/source-card`, exported in Task 4) `<ReadAgainIcon aria-hidden
className={cn(reading && "motion-safe:animate-spin")} />`.
- Reading: `aria-busy` and `aria-disabled`, a press does nothing.
- Not reading and `!canReadAgain` (dimmed): `aria-disabled`, `className="opacity-40"`,
  `aria-describedby` a `sr-only` span holding `S.readToday`; a press still calls `onReadAgain` (the
  container says the sentence).
- Else a press calls `onReadAgain`.

**`CreatorMenu`** (spec 3.2 "More"): the row's menu moved onto the page. `RowMenuLayer` with `name` and
`heading` `@handle`, `waitsForRow={false}`, `divided={step === "menu"}`, and its own round trigger:
```tsx
renderTrigger={(ref) => (
  <IconButton ref={ref} surface={surface} aria-label={creatorMore(handle)}>
    <DotsIcon aria-hidden />
  </IconButton>
)}
```
Items (`W = DISCOVER_STRINGS.watchlist`; `MENU_ITEM`, `MenuRow`, `RowMenuLayer` from
`library-next/row-menu-layer`, `DotsIcon` from `library-next/library-icons`): "Open on TikTok" (`<a
href={profileHref(handle)} target="_blank" rel="noopener noreferrer"
aria-label={`${W.openOnTikTok}${DISCOVER_STRINGS.video.newTab}`} onClick={close} className={MENU_ITEM}>`
with `ArrowSquareOut`, as the row), only when `profileHref(handle)` is not null; "Remove" (`UserMinus`)
only when `removable`. `null` when neither. The step logic is the row's (`watchlist-row.tsx:107-174`):
`live` and `askedAt` refs, `onOpenChange` resets the step to `"menu"` on open, `askRemove` =
`flushSync(() => setStep("remove")); askedAt.current = performance.now(); cancelRef.current?.focus();`,
`confirmRemove` = `if (!live.current) return; live.current = false; flushSync(() => setOpen(false));
triggerRef.current?.focus(); onRemove();`. The first item takes the focus on open: two refs,
`linkRef = useRef<HTMLAnchorElement>(null)` and `removeRef = useRef<HTMLButtonElement>(null)`, and
`firstRef={profile ? linkRef : removeRef}`. The question step is `<RemoveStep … />`.

**`CreatorScreen`** (spec 3.2, 3.4, 3.5). `Page` as `collection-screen.tsx:51-61` with a `trailing`:
`usePushedTitle(title)`, `<PushedHeader title={title} trailing={trailing} />`, the body
`px-4 pb-[calc(env(safe-area-inset-bottom)+40px)] md:px-8 md:pb-12` around `mx-auto w-full max-w-[980px]
pt-3 md:pt-1`, `data-testid="creator-next"`, `aria-busy` when loading.
- `loading`: title `S.title`; `PAGE_COLUMNS` holding, `aria-hidden`, a left column of outlines
  (`data-part="outline"`: the card `h-[92px] rounded-[22px] bg-surface-sunken`, four tiles in
  `grid grid-cols-4 gap-2` each `h-[60px] rounded-[18px] bg-surface-sunken`, two buttons `h-12 rounded-full
  bg-surface-sunken`) and at the right `VideosOutline`.
- `gone`: title `S.title`; `PageNotice line={S.gone}` with `<Link href={WATCHLIST_HREF} prefetch={false}
  className={CHIP_LINK}>{S.watchlist}</Link>`.
- `failed`: title `S.title`; `PageNotice line={S.failed} alert` with `<Chip onClick={onRetry}>{S.tryAgain}</Chip>`.
- `ready`: title `@handle`; `trailing` the desk's `<CreatorMenu surface="ground" …/>` (the header shows
  from 768 only); the body `<div className={PAGE_COLUMNS}>`:
  - left, `data-part="creator"`, `@container flex min-w-0 flex-col gap-3` (the container `Figures`'
    four-in-a-row reads): `CreatorCard` with `more={<div className="flex md:hidden"><CreatorMenu
    surface="card" …/></div>}`; then held: `p` `px-1 text-ui text-foreground-secondary` `S.heldLine`, and
    nothing more on the page. Else `Figures` (`audience-next/figures`, pending Q3) when there are any; the
    main action; the pull button when `pullInput(handle)` is not null: `<Button type="button"
    variant="secondary" size="lg" onClick={onPull} className="w-full next:rounded-full">{S.pull}</Button>`.
  - right (not held), `<section data-part="videos" aria-labelledby={videosId} className="min-w-0">`:
    a row `flex min-h-11 items-center gap-3 px-1` with `<h2 id={videosId} className="text-reading
    font-[640] text-foreground">{S.videos}</h2>` and, when there are videos,
    `<span className="ml-auto text-ui text-foreground-secondary">{S.order}</span>`; then no videos:
    `p` `px-1 py-6 text-ui text-foreground-secondary` `S.noVideos`; else `<div className="@container
    mt-1.5"><ul aria-labelledby={videosId} className={GRID}>` of `<li key={video.id}><PulledCard
    video={video} onOpen={onOpen} foot="views" /></li>`.
- The main action (`flex flex-col gap-1.5`), the line under it `p` `px-2 text-center text-meta
  text-foreground-secondary` with an id the control is described by:
  - no audience: `<Button asChild variant="primary" size="lg" className="w-full next:rounded-full"><Link
    href={audienceFromHref(handle)} prefetch={false} aria-describedby={lineId}>{S.build}<ArrowGlyph
    /></Link></Button>` (the link drawn as the main button, as `audience-screen.tsx:236-238`; `ArrowGlyph`
    from `audience-next/audience-screen`, exported in Task 4), line `S.buildLine`.
  - their audience: `<Button type="button" variant="primary" size="lg" aria-busy={simulating ||
    undefined} aria-disabled={simulating || undefined} onClick={() => { if (!simulating) onSimulate(); }}
    className="w-full next:rounded-full aria-busy:cursor-progress aria-busy:opacity-70">{S.simulate}<ArrowGlyph
    /></Button>`, line `audienceBuilt(builtOn)` only when `builtOn` is not null.

**Failing tests first** (`creator-screen.test.tsx`; the real parts; stand-ins: the router (`PushedHeader`'s
Back), `matchMedia` (phone or desk, as `watchlist-row.test.tsx:19-33`), `performance.now` where a press is
timed, the flag. A `creator(over)` builder of a `CreatorPage` for `jay.makes`: name `Jay Makes`, bio, read
`read 13 Jul`, `canReadAgain` true, four figures, twelve videos (three proven, the first `12×`), no
audience, a removal):
- `loading: the outline, busy, titled Creator` (h1 `Creator`; `[data-part="outline"]` present; no button).
- `gone: the sentence and the way to the Watchlist` (link `Watchlist` to `/feed?tab=watchlist`; not an alert).
- `failed: an alert and Try again` (calls `onRetry` once).
- `ready: titled by the handle, on the phone's band and the desk's header` (h1 `@jay.makes`;
  `useShellStore.getState().pushedTitle` `@jay.makes`).
- `the card: the name, the line, the bio` (h2 `Jay Makes`; `@jay.makes · TikTok · read 13 Jul · 12 videos`).
- `no name: the handle is the heading and the line leaves it out` (h2 `@jay.makes`; `TikTok · read 13 Jul · 12 videos`).
- `a part not known is left out with its dot` (never read, no videos: `@jay.makes · TikTok`).
- `the figures: those known share the row` (four `dt`s in order; two known: two).
- `no audience of theirs: Build their audience, a link to the new-audience page with the handle` (href
  `/audience/new?door=handle&handle=jay.makes`; described by `S.buildLine`).
- `their audience: Simulate a video for their viewers, with the day it was built` (a press calls
  `onSimulate`; described by `Their audience was built 14 Nov.`; `builtOn` null: no line).
- `simulating: the button waits, and a press does nothing` (`aria-busy`, `aria-disabled`; `onSimulate` not called).
- `Pull their best videos · 5 credits calls onPull; a handle Maven cannot read has no Pull`.
- `their videos: biggest jump first, each a button opening its sheet, the views at its foot, no handle`
  (heading `Their videos`, `Biggest jump`; the list labelled `Their videos`; twelve buttons in the given
  order; the first described by `12×` and `106.1K views`; no `@jay.makes` inside a card; a press calls
  `onOpen(video, button)`).
- `the badge only on a proven video` (a 2.7× card has no `[data-part="badge"]`).
- `Read again: a press reads` (calls `onReadAgain`).
- `read today: Read again is dimmed and says why; a press still asks` (`aria-disabled`, described by
  `Read today. Maven reads a creator once a day.`; a press calls `onReadAgain`).
- `reading: Read again turns, only where motion is allowed, and the line says Reading…` (`aria-busy`;
  the glyph's classes hold `motion-safe:animate-spin` and no bare `animate-spin`; the line
  `@jay.makes · TikTok · Reading… · 12 videos`; a press does nothing).
- `held: the initial, the handle, Couldn't be read, Read again and More, one sentence, nothing else`
  (no `dl`, no main or pull button, no `Their videos`).
- `no videos read: the sentence where the grid would be` (`No videos read yet. Read again to get their latest.`; no list; no `Biggest jump`).
- `More stands twice: in the card on a phone, in the header on a desk` (two buttons named
  `More: @jay.makes`; the card's inside an `md:hidden` wrapper, the other inside `PushedHeader`).
- `More, on a phone: Open on TikTok in a new tab, Remove; the focus on Open on TikTok` (dialog named
  `@jay.makes`; link `https://www.tiktok.com/@jay.makes`, `target="_blank"`, named
  `Open on TikTok, opens in a new tab`).
- `More, on a desk: a menu standing on the header's button` (popover; Escape gives the focus back to it).
- `Remove asks once more; a second press within 500 ms does nothing; after it, onRemove once, the focus on More`.
- `Cancel: nothing removed, the focus back on More`.
- `no records to clear: no Remove; nothing to offer: no More` (removal null; and a handle `profileHref`
  refuses with no removal).
- `the desk: two columns, the creator at the left, their videos at the right` (the body holds the
  `PAGE_COLUMNS` classes; `[data-part="creator"]` before `[data-part="videos"]`; the grid in an
  `@container`).
- `axe: ready, the menu open, the question; held; no videos; gone; failed; loading` (phone and desk for ready).

**Done when** this file passes, the guard passes over the new files, tsc and eslint clean. **Report:**
`task-5-report.md`.

### Task 6: the container

**Files:** create `src/components/discover-next/creator-next.tsx`, `__tests__/creator-next.test.tsx`.
**Must not touch** anything else.

Imports, these modules exactly (the guard reads them): `useThreadActions` (`@/components/shell/use-thread-actions`),
`useToast` (`@/components/ui/toast`), `useSetDefaultAudience` (`@/hooks/queries/use-audience-next`),
`useChannelReadOut`, `useReadChannel`, `type AddChannelError` (`@/hooks/queries/use-channels`),
`isSessionExpiredRefusal`, `reportSession401` (`@/lib/auth/session-expired`), types from
`@/lib/discover-next/creator` and `pull`, `WATCHLIST_HREF`, `pullHref` (`discover-view`), `armPull`, `dropPull`,
`keepPullOnlyAt` (`pull-intent`), `pullInput` (`watchlist`), `buildThreadLaunchHref`
(`@/lib/room-contract/thread-launch`), and `./creator-screen`, `./pulled-video-next`, `./use-remove-creator`.

```tsx
const S = DISCOVER_STRINGS.creator;
/** Home on a new chat with Simulate picked, as the Audience page's "Simulate a video for them" opens it
 *  (`audience-next.tsx:80`). (pending Q1) */
const SIMULATE_HREF = buildThreadLaunchHref({ input: "", verb: "Test" });

function ReadyCreator({ creator }: { creator: CreatorPage }) {
  const router = useRouter();
  const { toast } = useToast();
  const { newThreadAt } = useThreadActions();
  const read = useReadChannel();
  const readOut = useChannelReadOut(creator.handle); // (pending Q4; without it: `read.isPending`)
  const setDefault = useSetDefaultAudience();
  const removeCreator = useRemoveCreator();

  // A Pull pressed here arms its pull page's intent. Arriving, any press left behind is dropped; leaving,
  // it is kept only for the page the press opened (the hub's rule, `discover-next.tsx:173-181`).
  useEffect(() => {
    dropPull();
    return () => keepPullOnlyAt(window.location.pathname + window.location.search);
  }, []);

  // Read again. Out as of the last press, not the last render. Awaited, not handed callbacks: the toast and
  // the router stand above the page, so a read that ends after the creator has left is still said.
  const reading = useRef(false);
  const readAgain = async () => {
    if (!creator.canReadAgain) return void toast({ variant: "default", title: S.readToday });
    if (reading.current || readOut) return;
    reading.current = true;
    try {
      if ((await read.mutateAsync(creator.handle)) === "cached") toast({ variant: "default", title: S.readToday });
      router.refresh();
    } catch (error) {
      const refusal = error as Partial<AddChannelError>;
      if (typeof refusal.status === "number" && reportSession401(refusal.status)) return;
      toast({ variant: "error", title: readFailed(creator.handle) });
    } finally {
      reading.current = false;
    }
  };

  // Simulate for their viewers: their audience becomes the one new chats use, then Home opens on a new
  // chat. The button waits until the page goes; refused, it is pressable again.
  const [simulating, setSimulating] = useState(false);
  const choosing = useRef(false);
  const simulate = async () => {
    const audience = creator.audience;
    if (!audience || choosing.current) return;
    choosing.current = true;
    setSimulating(true);
    try {
      await setDefault.mutateAsync(audience.id);
    } catch (error) {
      choosing.current = false;
      setSimulating(false);
      if (!isSessionExpiredRefusal(error)) toast({ variant: "error", title: S.simulateFailed });
      return;
    }
    newThreadAt(SIMULATE_HREF);
  };

  // Remove. Out as of the last press. Done: the Watchlist opens in this page's place, read again.
  const removing = useRef(false);
  const remove = async () => {
    const removal = creator.removal;
    if (!removal || removing.current) return;
    removing.current = true;
    const done = await removeCreator(removal);
    removing.current = false;
    if (!done) return void toast({ variant: "error", title: removeRefused(creator.handle) });
    router.replace(WATCHLIST_HREF);
    router.refresh();
  };
  // … Pull (`pullInput`, `armPull`, `router.push(pullHref(input))`, as `watchlist-next.tsx:116-121`), the
  // opened video, `sheetOpen` and the card ref (as `pull-next.tsx:99-109`); it renders
  // `<CreatorScreen state="ready" … reading={readOut} />` and
  // `<PulledVideoLayer video={opened} open={sheetOpen} onOpenChange={setSheetOpen} returnFocus={() => card.current} />`.
}

export function CreatorNext({ read }: CreatorNextProps): React.JSX.Element {
  const router = useRouter();
  if (read.state === "failed") return <CreatorScreen state="failed" onRetry={() => router.refresh()} />;
  if (read.state === "gone") return <CreatorScreen state="gone" />;
  // Keyed by the creator: another creator starts with its own sheet and its own presses.
  return <ReadyCreator key={read.creator.handle} creator={read.creator} />;
}

/** The route's loading file under the new look: the page's outline, nothing sent. */
export function CreatorNextLoading(): React.JSX.Element {
  return <CreatorScreen state="loading" />;
}
```

The header comment lists, as `pull-next.tsx`'s does: Read again (and the 24-hour sentence), Simulate,
Build (a link, no request), Pull (the intent), a video's sheet (the layer), More (Open on TikTok, Remove).

**Failing tests first** (`creator-next.test.tsx`; the real container, screen, parts, sheet, Remix step,
Save over the saved-items hooks, `useReadChannel`, `useSetDefaultAudience`, `useRemoveCreator`, a real
`QueryClient`, the real `ToastProvider` and `useThreadActions`; stand-ins: `fetch` (`/api/channels/ingest`,
`/api/settings/last-audience`, `DELETE /api/tracked-accounts`, `/api/saved*`), the action module, the
router, `matchMedia`, `performance.now`, the flag; `beforeEach` resets the shell store and the thread cookie
as `pull-next.test.tsx` does):
- `failed: Try again reads the page again` (`router.refresh` once); `gone: the sentence and Watchlist`.
- `Read again reads the creator alone: one POST /api/channels/ingest with the handle, nothing else`.
- `while it reads: the button turns, the line says Reading…, a second press sends nothing`.
- `read: the page reads itself again, no toast` (`scraped` → `router.refresh` once).
- `read today by the server: the sentence, and the page reads itself again` (`cached` → toast
  `Read today. Maven reads a creator once a day.`, `router.refresh`).
- `refused: Couldn't read @jay.makes. Try again later., and the page keeps what it showed` (502; no refresh).
- `a lapsed session: the app's sign-in dialog, no toast of ours` (401; `SESSION_EXPIRED_EVENT` heard once).
- `inside 24 hours: a press says the sentence and sends nothing` (`canReadAgain` false).
- `opened again while its read is out: Reading…, and a press sends nothing` (unmount mid-read, mount on the
  same client) (pending Q4).
- `Build their audience is a link: nothing sent`.
- `Simulate: their audience becomes the one new chats use, then Home opens on a new chat` (`PUT
  /api/settings/last-audience` with `{ audienceId }`, then `router.push` with `/home?v=Test` (pending Q1);
  the active chat cookie the sentinel).
- `Simulate waits: a second press sends nothing`; `refused: Couldn't switch the audience., pressable
  again, Home not opened`; `a lapsed session: the dialog, no toast`.
- `Pull: armed for @jay.makes, then the pull page; nothing sent` (`router.push("/feed/discover?input=%40jay.makes")`,
  `takePull("@jay.makes")` true, no `fetch`).
- `a Pull armed and the page left elsewhere: dropped` (unmount with the address elsewhere; `takePull` false).
- `Remove: every record, then the Watchlist in the page's place, read again` (a merged creator: two
  DELETEs and the action; `router.replace("/feed?tab=watchlist")` before `router.refresh()`).
- `Remove refused: the toast, and the page stays` (no `replace`).
- `a video: its sheet, Remix leaves it for a new chat, nothing sent from here` (sheet titled by its line,
  `12× their average`, `Remix this · 10 credits`; Remix → the question → Remix: `takeRemixFrom()` gives the
  link, `tiktok`, the brief; `router.push("/home")`; no `fetch` but the saved list's read).
- `Save keeps the video under its TikTok id` (`POST` body `ref_id` `tiktok:<id>`, `thread_id` null).
- `closing the sheet gives the focus back to its card`.
- `CreatorNextLoading: the outline, and nothing sent`.

**Done when** this passes, `pull-next.test.tsx` stays green, the guard passes, tsc and eslint clean.
**Report:** `task-6-report.md`.

### Task 7: the routes, the redirects, Back

**Files:** create `src/app/(app)/competitors/[handle]/creator-page.tsx`,
`src/app/(app)/competitors/__tests__/page.test.ts`; modify `src/app/(app)/competitors/page.tsx`,
`competitors/loading.tsx`, `competitors/[handle]/page.tsx`, `competitors/[handle]/loading.tsx`,
`competitors/compare/page.tsx`, `competitors/compare/loading.tsx`, `src/components/shell/nav-config.ts`,
`src/app/(app)/__tests__/routing-cut.test.ts`, `src/components/shell/__tests__/nav-config.test.ts`. **Must
not touch** a line of the old code under the new first lines, `competitors-client.tsx`,
`comparison-client.tsx`, the rest of the shell.

**`creator-page.tsx`** (server; as `feed/next-hub.tsx` is to `/feed`):

```tsx
import { CreatorNext } from "@/components/discover-next/creator-next";
import { getCreatorPage } from "@/lib/discover/creator-read";
import type { CreatorRead } from "@/lib/discover-next/creator";
import { createClient } from "@/lib/supabase/server";

/**
 * /competitors/<handle> under the new look: a followed creator's page (spec 2026-11-25-creator-page).
 * Signed out: nothing (the layout and the middleware send the visitor to log in). A creator not on the
 * caller's watchlist is the page's own "gone" state, not a 404: Back after a Remove lands here. A read that
 * fails is the page's failure state, and is logged.
 */
export async function creatorPage(params: Promise<{ handle: string }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { handle } = await params;
  let read: CreatorRead;
  try {
    read = await getCreatorPage(supabase, handle, new Date());
  } catch (error) {
    console.error("[discover] creator read failed", error);
    read = { state: "failed" };
  }
  return <CreatorNext read={read} />;
}
```

**The old pages** (each a new first statement and its imports; nothing else):
- `[handle]/page.tsx`: `if (NEW_LOOK_ENABLED) return creatorPage(params);` first in
  `CompetitorDetailPage`; `generateMetadata` returns `title: NEW_LOOK_ENABLED ? `@${creatorHandleOf(handle)} | Maven`
  : `@${handle} | Competitors | Maven``.
- `[handle]/loading.tsx`: `if (NEW_LOOK_ENABLED) return <CreatorNextLoading />;` first.
- `competitors/loading.tsx`: `if (NEW_LOOK_ENABLED) return <CreatorNextLoading />;` first (pending Q5):
  Next wraps everything under a folder's `loading.tsx` in its boundary, so opening `/competitors/<handle>`
  from Discover would show the old board's skeleton before the page.
- `compare/loading.tsx`: `if (NEW_LOOK_ENABLED) return null;` first (pending Q5).
- `competitors/page.tsx` and `compare/page.tsx`: `if (NEW_LOOK_ENABLED) redirect("/feed?tab=watchlist");`
  as the first statement of the default export (imports `redirect` from `next/navigation`,
  `NEW_LOOK_ENABLED`), with the comment: under the new look the creators followed are Discover's
  Watchlist chip; old links land there. Both keep `export default async function`.

**`nav-config.ts`** (`backInHistory`): one more clause and a bullet in its comment (a creator's page is
opened from the Watchlist chip, whose search lives in the hub's history entry):

```ts
    /^\/competitors\/(?!compare$)[^/]+$/.test(pathname) ||
```

**`routing-cut.test.ts`**: the case at `:61-70` becomes, word for word:

```ts
  it('/competitors: under the new look it opens the Watchlist; without it the board renders', () => {
    // The new look has one list of the creators followed: Discover's Watchlist chip. The board stays for
    // the old look. Its one redirect is the flag's, the default export's first statement, so the board
    // under it still resolves to something real.
    const src = read('competitors/page.tsx');
    expect(src.match(/redirect\(/g) ?? []).toHaveLength(1);
    expect(src).toMatch(
      /export default async function \w+\([^)]*\)\s*\{\s*if \(NEW_LOOK_ENABLED\) redirect\(\s*['"]\/feed\?tab=watchlist['"]\s*\);/,
    );
    expect(src).toMatch(/<CompetitorsClient\b/);
  });

  it('/competitors/compare: under the new look it opens the Watchlist; without it the comparison renders', () => {
    const src = read('competitors/compare/page.tsx');
    expect(src).toMatch(
      /export default async function \w+\([^)]*\)\s*\{\s*if \(NEW_LOOK_ENABLED\) redirect\(\s*['"]\/feed\?tab=watchlist['"]\s*\);/,
    );
    expect(src).toMatch(/<ComparisonClient\b/);
  });
```

Everything else in the file stays (the `it.each` at `:48-59` still holds for both pages).

**Failing tests first.**
- `competitors/__tests__/page.test.ts` (node; each case loads the files fresh per flag value, as
  `feed/channels/__tests__/page.test.ts` does; stand-ins: the flag, `@/lib/supabase/server` (a session
  read counter and, for the old detail page, `from(…).select(…).eq(…).single()` answering `{ data: null }`),
  `@/lib/discover/creator-read` (the route's read, as the collection page's test stands in its read); if
  importing the old detail page fails on a module that reads a key at import, stand in that module too and
  say which in the report):
  - `/competitors, flag on: the Watchlist, before anything is read` (`NEXT_REDIRECT;…;/feed?tab=watchlist;`;
    no session read); `flag off: signed out, nothing, and the board's title` (`Competitors | Maven`).
  - `/competitors/compare, flag on: the Watchlist, before anything is read`; `flag off: signed out, nothing`.
  - `/competitors/[handle], flag on: the creator's page from the read` (`CreatorNext` with the read's
    answer; the read called once with the caller's client, `"jay.makes"` and a `Date`); `a read that throws:
    the failure state, logged` (`[discover] creator read failed`); `signed out: nothing, nothing read`;
    `its title` (`@jay.makes | Maven` from `"%40Jay.Makes"`).
  - `/competitors/[handle], flag off: the old page, the new read never called` (a missing profile is the
    404 as before; title `@jay.makes | Competitors | Maven`).
  - `the loading files`: `[handle]` and `competitors` flag on → `CreatorNextLoading`, flag off → their old
    skeleton (an element whose type is not `CreatorNextLoading`); `compare` flag on → null, off → its skeleton.
- `routing-cut.test.ts`: the two cases above.
- `nav-config.test.ts`: `activePlace` lights Discover for `/competitors/jay.makes`; a new describe
  `backInHistory: a creator's page goes back to the Watchlist as it was left`: true for
  `/competitors/jay.makes`, `/competitors/nia.cooks`; false for `/competitors`, `/competitors/`,
  `/competitors/compare`, `/competitors/jay.makes/videos`; `backTarget('/competitors/jay.makes')` stays
  `/feed` (Question 6).

**Done when** these pass and `next-shell.test.tsx`, `next-shell-pushed-title.test.tsx` stay green, tsc and
eslint clean. **Report:** `task-7-report.md`.

### Task 8: the Watchlist row as a link

**Files:** modify `src/components/discover-next/watchlist-row.tsx`, `watchlist-panel.tsx`,
`__tests__/watchlist-row.test.tsx`, `__tests__/watchlist-panel.test.tsx`,
`src/app/(app)/dev/discover/dev-watchlist.tsx` (one row gains a profile),
`src/app/(app)/dev/discover/__tests__/page.test.ts` (the watchlist case). **Must not touch** the row
without a profile (its markup and menu stay exactly as today), the panel's other behaviour.

**Steps.**
1. `watchlist-row.tsx` (spec 3.1; imports `Link` from `next/link` and `creatorHref` from `discover-view`):
   after the hooks and `face`, before the plain-line return:
   ```tsx
   // A creator with a profile has a page: the row opens it, and the menu's actions are there.
   if (source.profileHandle) {
     return (
       <Link href={creatorHref(source.profileHandle)} prefetch={false} aria-label={name} aria-describedby={line ? lineId : undefined} className={ROW}>
         {face}
       </Link>
     );
   }
   ```
   The header comment says a row with a profile is a link to the creator's page, a row without one (a
   creator on Instagram or YouTube followed from the Explore grid) opens the menu.
2. `watchlist-panel.tsx:86-88`: the rows the focus is handed to are each row's control, a link or a button:
   `":scope > li[data-row] > a, :scope > li[data-row] > button"` (a selector list returns them in
   document order); its comment says so.
3. `dev-watchlist.tsx`: the `nia.cooks` row gains `profileHandle: "nia.cooks"`.

**Failing tests first.**
- `watchlist-row.test.tsx`: the `source()` default gains `profileHandle: null` with a comment ("a row
  without a profile: the menu"), so every existing case keeps running on the menu's row, unchanged. New,
  `WatchlistRow — a creator with a profile`: `a link to their page, named @handle, described by its line`
  (href `/competitors/jay.makes`; no `aria-haspopup`; no button); `the same face: the picture, the line, the
  covers` (`[data-part="picture"]`, `[data-part="covers"] img` ×3); `it opens no menu` (a click: no
  dialog); `a held creator with a profile is a link too, described by Couldn't be read`; `axe finds nothing`.
- `watchlist-panel.test.tsx`: `JAY` and `NIA` gain `profileHandle: null` with a comment ("drawn as menus:
  the Remove cases run through a row's menu; a row with a profile is a link, below"), so every existing
  case keeps its meaning; new: `a creator with a profile is a link to their page; one without keeps its
  menu` (a `KAI` row `kai.wanders` with a profile beside `DEV`); `a removed row's focus goes to the link now
  in its place` (rows `DEV`, `KAI`: remove `DEV`, the focus on `KAI`'s link).
- `dev/discover/__tests__/page.test.ts`, the `watchlist` case: `@nia.cooks` is a link to
  `/competitors/nia.cooks`; its other assertions stay.

**Done when** these pass, `discover-next.test.tsx` and `pull-offer.test.tsx` stay green, tsc and eslint
clean. **Report:** `task-8-report.md`.

### Task 9: the dev fixtures

**Files:** create `src/app/(app)/dev/discover/creator-fixtures.ts`, `dev-creator.tsx`; modify
`src/app/(app)/dev/discover/page.tsx` (the docblock, `CREATOR_STATES`, one branch),
`src/app/(app)/dev/discover/__tests__/page.test.ts`. **Must not touch** the other dev files.

- `creator-fixtures.ts`: made-up rows for `jay.makes` (`DEV_NOW = new Date("2026-11-25T12:00:00Z")`): a
  profile (`Jay Makes`, a two-line bio, 15_400_000 followers, 369_100_000 likes, 6_364 posts, last read
  `2026-07-13T09:00:00Z`) and twelve video rows of one read (`ingested_at` that time, `baseline_views`
  `"8600"`, `baseline_label` `"vs own"`, multiples 12, 4.8, 3.1, 2.7, 1.7, 1.2, 0.9, 0.8, 0.6, 0.5, 0.4,
  0.3; captions from `DEV_VIDEOS`' lines with a few hashtags; one with no caption; views around the
  multiple × 8,600), run through the real `creatorPageOf` (source: not held, `trackedIds: ["t-jay"]`,
  `competitorId: "p-jay"`). The rule keeps only covers Maven stores, so the cards then take
  `DEV_VIDEOS`' drawn covers (`{ ...video, coverUrl: DEV_VIDEOS[i].coverUrl }`), with that reason in a
  comment. Exports `DEV_CREATOR: CreatorPage`.
- `dev-creator.tsx` (`"use client"`), `DevCreatorState` = `"creator" | "creator-audience" |
  "creator-fresh" | "creator-reading" | "creator-held" | "creator-empty" | "creator-gone" |
  "creator-failed" | "creator-loading" | "creator-sheet"`. The real `CreatorScreen`, `PulledSheet` and
  `RemixSheet` on local state, as `dev-pull.tsx` does; nothing sent: Read again reads for 1.5 s, then the
  line says `read 25 Nov` and the button is dimmed; Simulate waits 1.5 s and stops; Pull, Remove and
  Remix do nothing; Save marks here only; Build is the real link. The states: `creator` (as built),
  `creator-audience` (`audience: { id: "dev-audience", builtOn: "14 Nov" }`, set by hand: the dev page
  holds no audience rows), `creator-fresh` (last read `2026-11-25T08:00:00Z` through `creatorPageOf`),
  `creator-reading` (reading, held there), `creator-held` (`held` source), `creator-empty` (no video rows),
  `creator-gone`, `creator-failed`, `creator-loading`, `creator-sheet` (the first video's sheet open on mount).
- `page.tsx`: the docblock lists `/dev/discover?state=creator|creator-audience|…|creator-sheet` with one
  line each; `CREATOR_STATES` and `isCreatorState` as the other families; `if (isCreatorState(state))
  return <DevCreator key={state} state={state} />;`.

**Failing tests first** (`page.test.ts`, one case each): `creator: the card, the line, four figures, Build
their audience, Pull, twelve videos, the first ▲ 12×` (`@jay.makes · TikTok · read 13 Jul · 12 videos`);
`creator-audience: Simulate a video for their viewers, built 14 Nov`; `creator-fresh: Read again dimmed,
and why`; `creator-reading: Read again busy, Reading… in the line`; `creator-held: Couldn't be read and its
sentence, no figures`; `creator-empty: No videos read yet`; `creator-gone: the sentence and Watchlist`;
`creator-failed: the alert and Try again`; `creator-loading: the outline, busy`; `creator-sheet: the first
video's sheet, 12× their average, Remix this · 10 credits`.

**Done when** the dev page test passes whole, tsc and eslint clean. **Report:** `task-9-report.md`.

---

## Final checks (the controller runs these; not an implementer)

1. `df -h /` first. `pnpm exec tsc --noEmit`; the whole suite
   (`NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run`); `pnpm exec eslint` on every changed
   file; both production builds (flag on, flag off). Read each exit status itself.
2. Flag off against the accepted baseline (`scripts/next-look-compare.cjs`): unchanged; `/competitors`,
   `/competitors/<a followed creator>` and `/competitors/compare` render the three old screens.
3. Flag on, `/dev/discover?state=creator…` each state, phone 320, 375, 393 and desk 768, 1024, 1440, light
   and dark: the card, the figures' row (Question 3), the buttons and their lines, the grid by width, the
   menus on their buttons, the turning Read again (and none with reduced motion), the sheet as a centred
   dialog on a desk.
4. Flag on, the test account: a Watchlist row with a profile opens the page; one without keeps its menu;
   Back returns to the Watchlist; `/competitors` and `/competitors/compare` open the Watchlist; the page of
   a creator not followed says so; Build their audience opens the form filled; with their audience,
   Simulate opens Home on a new chat with that audience chosen (Question 1); More: Open on TikTok, Remove
   (then follow the creator again); a video's sheet, Save (and un-save); Read again on a creator read
   today says the sentence. Spend, announced to the owner first: a Read again, a Pull, a Remix.
5. Keyboard and a screen reader through the card, the menus, the question, the grid and the sheet.

## Corrections to the seam maps

1. `seam-map-2.md` F, summary 8: the Audience page's "Simulate a video for them" does not open `/home` but
   `SIMULATE_HREF = buildThreadLaunchHref({ input: "", verb: "Test" })`, Home with Simulate picked
   (`audience-next.tsx:80`, `:282`, `:293`). Question 1.
2. `seam-map-2.md` F: `readOn` writes "read 14 Aug" with its "read " (`audience-words.ts:139-150`); "built 14
   Nov" takes the day without it (`builtOn`).
3. `seam-map-2.md` G: `RowMenuLayer` needs `name`, `heading`, `open`, `onOpenChange`, `onClose`, `firstRef`,
   `triggerRef`, `divided`, `children` whatever the trigger; `firstRef` is typed `HTMLButtonElement`
   (`row-menu-layer.tsx:81`), so a link cannot be the first item without widening it; its default dots
   wait for a `group/row` hover on a desk and are 24 drawn on a phone (the page draws its own trigger).
4. `seam-map-2.md` H misses `watchlist-panel.tsx:87`: the focus is handed on through
   `:scope > li[data-row] > button`; a row that is a link drops out of that count (Task 8).
5. `seam-map-2.md` H misses `video-card.test.tsx:70-74`: it reads `pull-screen.tsx`'s source for
   `VideoCardFace`; lifting the pulled card moves that read to `pulled-card.tsx` (Task 4).
6. `seam-map-2.md` I: `Figures`' four-in-a-row is a container query (`figures.tsx:17`): it needs an
   `@container` above it, and under a 360 column it is two by two. `figuresOf` is private and drops Likes
   off TikTok; the page builds its own, whose labels cannot be Discover's words (Question 2).
7. Neither map says that `competitors/loading.tsx` wraps `[handle]` and `compare` in its boundary (Question 5).
8. `seam-map.md` 3 / 8 / 9: the guard forbids imports from the old folders, not addresses: a link to
   `/competitors/<handle>` passes it. `backInHistory` (`nav-config.ts:139-147`) also holds `/you`, `/earn`,
   `/settings`. The ingest's gate is `ingest.ts:85-101`, `CHANNEL_RESCRAPE_HOURS` `:29`.
9. `seam-map-2.md` B: `"vs own"` is `CHANNEL_BASELINE_LABEL` (`compute-channel-metrics.ts:26`); the stored
   `baseline_views` is `median || 1`, never 0.

## Self-review

- Spec 3.1: Task 8. 3.2 to 3.5: Tasks 2 to 6. 3.6: Task 7. 4: Tasks 1, 2. 5: no task adds a chart, a
  comparison, a model card or a second list. 6: Task 1. 7: Tasks 1, 4, 5, 6. 10: the tests and the final checks.

## Questions for the controller

Each with the plan's recommendation in brackets; the tasks build it, marked "(pending Q n)".

1. **Where "Simulate a video for their viewers" lands.** Ruling 14 says `newThreadAt("/home")`. The
   Audience page's button of the same name opens `newThreadAt(SIMULATE_HREF)`, Home with Simulate picked
   (`audience-next.tsx:80`); `/home` alone opens a blank chat with nothing picked. Options: (a) `/home`, as
   ruled; (b) the Audience's address, built with `buildThreadLaunchHref` (`lib/room-contract/thread-launch.ts`).
   [(b): the same button lands where the same button lands.]
2. **The figure label "Usual views" cannot be one of Discover's words.** Spec 6 puts every word in
   `discover-words.ts`; that file's test refuses "usual" in any of Discover's strings
   (`discover-words.test.ts:231`). Options: (a) the four labels are the Audience's (`AUDIENCE_STRINGS`),
   read by `creatorFiguresOf` on the server, one copy for both figure rows; (b) put them in the `creator`
   block and let the test except that one label. [(a)]
3. **The figures' row on a phone.** Spec 3.2.3 says one row of four. The Audience's `Figures` goes two by
   two in a column under 360 (a 375 phone gives 343): "Usual views" does not fit a quarter of it. Options:
   (a) reuse `Figures` as it is (one row from a 393 phone and on a desk, two by two below); (b) a row of
   four of the page's own, with the label cut. [(a)]
4. **A read still out when the page is opened again.** A read can take minutes and survives leaving the
   page. Without more, the page opened again offers Read again, and a press sends a second read while the
   first is still scraping. Options: (a) `useChannelReadOut` (the read sent under a mutation key; the page
   reads the client's pending mutations: "Reading…", and a press sends nothing; lost on a reload);
   (b) leave it. [(a)]
5. **The old board's loading file under the flag.** Ruling 21 names `[handle]/loading.tsx` only; Next also
   shows `competitors/loading.tsx` (the old board's skeleton) on the way to a creator's page. [Under the
   flag `competitors/loading.tsx` draws `CreatorNextLoading`, `compare/loading.tsx` nothing; flag off both
   unchanged.]
6. **Back with no history** (a pasted link): the shell's `backTarget` and `PushedHeader` both go to `/feed`,
   the Videos chip, not the Watchlist. With history Back returns to the Watchlist as it was left. Changing
   the fallback edits the shell (ruling 22: nothing else there). [Leave it.]
7. **A part of the read that fails.** When the videos or the audiences cannot be read, the plan draws the
   page's failure ("Couldn't load this creator.", Try again), rather than "No videos read yet" or "Build
   their audience" over a read it could not make. [As planned.]
8. **Words the spec does not give**, as written in the plan: `Creator` (the page's title while loading, gone
   or failed, as `Collection` and `Video`); `Couldn't switch the audience.` (Simulate refused, the Audience
   page's sentence); `More: @jay.makes` (More's name); no line under Simulate when their audience has no
   date; with no display name the heading is `@handle` and the line leaves the handle out. [As written.]
