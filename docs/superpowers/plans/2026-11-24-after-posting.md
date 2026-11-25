# After posting, step 1: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. One task per
> implementer, a failing test first for every behaviour, a review after each task.

**Goal:** a creator adds the TikTok link of a piece they simulated and posted; Maven stores it, reads the
post's public numbers, and shows them next to what it said, on the piece's result page, in Library and
on Home. Spec: `docs/superpowers/specs/2026-11-24-after-posting-design.md` (read it first; it wins over
this plan where they differ, and the controller's `rulings.md` wins over both).

**Shape:** one new table `piece_posts`; a pure module `src/lib/posted/` (states, the usual, words); a
server reader that takes the scraper as a parameter; four routes under `/api/posted`; the Library page
carries each chat's posted piece; three small components in `src/components/posted-next/`.

**Stack:** Next.js 16, TypeScript, Supabase (row level security), TanStack Query, Vitest, Tailwind v4.

## Global constraints (every task)

- Everything is behind `NEW_LOOK_ENABLED` (`src/lib/flags/new-look.ts`). Flag off: the routes answer 404,
  nothing renders, nothing reads the table, and the app is exactly as before. Never change an existing
  `@theme` value. Do not touch `src/app/(app)/settings/*`, `src/components/app/settings/*`,
  `src/lib/flywheel/*`, `src/app/api/outcomes/*`.
- A failing test first for every behaviour. Stand-ins only at I/O boundaries (the database client, the
  scraper, `fetch`, the clock) and for the build-time flag. Never a stand-in for the unit under test.
- No commit, no stash, no push. No `.env*` reads. No dev server, no build, no network, no scraper run, no
  model call, no database query: the controller applies the migration and runs the real checks.
- The repository is public: no ids, tokens, real handles or links of real people in code, tests,
  fixtures or docs. Test handles are made up (`nia.cooks`).
- Words on screen are exactly the ones in this plan. Plain words; "chat", never "thread"; "Simulate",
  never "Test".
- Text from outside the app (a post's caption, an author's name) is never stored and never rendered.
  The link shown to a post is built from the validated handle and post id, never from the pasted text.
- New-look styling rules of `CLAUDE.md` hold (`shadow-[var(--shadow-float)]`, tokens, no legacy
  screen patched). Green and coral are the tokens `--color-above` and `--color-below-text` and mean
  only "against your usual".
- Vitest needs `NODE_OPTIONS=--no-experimental-webstorage`. Never run vitest with `-u`.

## Constants and contracts (shared by all tasks)

`src/lib/posted/posted.ts` (pure, no React, no server imports):

```ts
export const SETTLE_HOURS = 72;        // a post's numbers are final from here
export const REFRESH_HOURS = 12;       // an unsettled post is read again at most this often
export const USUAL_MIN_POSTS = 5;      // fewer settled posts than this: no usual
export const USUAL_ABOVE = 1.5;        // ratio from which "x your usual" is green
export const USUAL_BELOW = 0.67;       // ratio up to which it is coral
export const MAX_ATTEMPTS = 3;         // failed reads before the piece says "couldn't read"
export const RETRY_MINUTES = 10;       // wait between failed reads
export const LINKS_PER_DAY = 20;       // links one person may add in 24 hours
export const READS_KEPT = 12;          // kept reads per post, newest last

export type PostedState = "reading" | "so-far" | "final" | "unread";
export interface PostedNumbers { views: number; likes: number; comments: number; shares: number; saves: number }
export interface PostedUsual { ratio: number; tone: "above" | "around" | "below" }
/** One posted piece as it leaves the server. */
export interface Posted {
  id: string;
  threadId: string | null;
  pieceKey: string;                       // a video's analysis id, or a text piece's result-page key
  said: { number: number; measure: "stop" | "end" };
  state: PostedState;
  linkedAt: string;                       // ISO
  postedAt: string | null;                // ISO; null until the first read
  finalAt: string | null;                 // postedAt + 72 h
  numbers: PostedNumbers | null;
  usual: PostedUsual | null;              // only when state is "final"
  handle: string | null;
  href: string | null;                    // https://www.tiktok.com/@<handle>/video/<id>
  due: boolean;                           // a read is owed now
}
```

Rules, each a pure function with tests:

- `parsePostLink(text)`: trimmed, at most 500 characters, parses as a URL, `https:`, and the host ends
  with `.tiktok.com` or `.tiktokv.com` (the bare apex is refused): the same rule as `isAllowedPostUrl`
  in `src/lib/scraping/apify-provider.ts`. A test feeds one table of cases to both and they agree
  (export `isAllowedPostUrl` for that; nothing else in that file changes).
- `postIdTime(postId)`: a TikTok post id holds its creation time in its top 32 bits
  (`Number(BigInt(id) >> 32n)` seconds). Returns a Date when the id is 5 to 25 digits and the time lies
  between 2016-01-01 and one day after `now`; otherwise null. `posted_at` is this time; when it is null,
  the scraper's `postedAt` is used only if it is more than five minutes before the read (the scraper
  fills a missing time with "now").
- `postHref(handle, postId)`: handle `/^[a-z0-9._]{1,50}$/`, id `/^[0-9]{5,25}$/`, else null.
- `handleOf(video)`: from the canonical `videoUrl` (`/@<handle>/video/<id>`), else `author.handle`;
  lower case, without "@"; null when neither validates.
- `stateOf(row, now)`: `unread` when `read_error` is set and (`attempts >= MAX_ATTEMPTS` or the error is
  `gone`); `reading` when no numbers were ever read; `final` when `settled_at` is set; else `so-far`.
- `usualOf(videos, excludePostId, now)`: from the given videos, not pinned, not the excluded one, each
  posted at least 72 hours before `now`: the median of their views and how many there are; null under
  `USUAL_MIN_POSTS`. A median of 0 gives null.
- `toneOf(ratio)`: `above` from 1.5, `below` up to 0.67, else `around`.
- `isDue(row, now)`: false when settled, or `unread`; false within `RETRY_MINUTES` of
  `last_attempt_at`; true when nothing was read yet; true when `posted_at + 72 h <= now`; else true when
  `read_at` is older than `REFRESH_HOURS`.
- `toPosted(row, now)`: the row as `Posted`.

Words, `src/lib/posted/posted-words.ts` (pure):

| Function | Result |
|---|---|
| `viewsWord(n)` | compact, like the app's other counts: `940`, `12.4K`, `31K`, `1.2M` (reuse the new look's existing formatter if one fits; say which) |
| `usualWord(ratio)` | `1.8× your usual`; from 10 a whole number (`12× your usual`); under 0.1 `under 0.1× your usual` |
| `gotWords(posted)` | `{ number: "31K", unit: "views" \| "views so far", usual: "1.8× your usual" \| null }` |
| `countsLine(numbers)` | `2.1K likes · 84 comments · 310 shares · 420 saves` |
| `footWords(posted, now)` | `Posted Fri 20 Nov on TikTok, @nia.cooks` and a tail: ` · final numbers` (final), ` · final numbers Thursday` (so far; `today` / `tomorrow` when it is) |
| `rowLine(posted, when)` | `{ text, mark }`: `Posted 4d ago · 31K views` + mark `1.8× your usual` (with its tone); `Posted 1d ago · 12.4K views so far`; `Posted · reading the post`; `Posted · couldn't read the post`. `when` is the row's own relative-time word for `postedAt` |
| `cellWords(posted)` | desktop column: `{ top: "31K views", under: "1.8× your usual" \| "so far" \| null }`; reading `{ top: "Reading", under: null }`; unread `{ top: "Not read", under: null }` |

Fixed strings: chip and stage `Posted`; column head `After posting`; the Posted filter's empty text
`Nothing posted yet. Add a posted video's link to a piece you simulated.`; menu items `Add posted link`,
`Remove posted link`; the confirm `Remove the posted link?` with `Remove` and `Cancel`; the ask row
`Posted it?` / `Add the link and see what it did.`; the sheet's title `Posted it?`, text `Paste the
TikTok link. Maven reads the public numbers and shows them next to what it said.`, field name `TikTok
link`, placeholder `https://www.tiktok.com/@you/video/…`, button `Add link`; errors `That's not a TikTok
link.`, `This piece already has a posted link.`, `That's 20 links today. Add more tomorrow.`,
`Couldn't add the link. Try again.`; the card's title `After posting`, labels `Maven said` and `It got`,
reading `Reading the post` / `This takes about a minute.`, unread `Couldn't read this post. It may be
private or deleted.` with `Try again` and `Remove`.

---

### Task 1: the table, the rules, the repository

**Files:** create `supabase/migrations/20261124130606_piece_posts.sql`,
`src/lib/posted/posted.ts`, `src/lib/posted/posted-words.ts`, `src/lib/posted/posted-repo.ts`,
tests under `src/lib/posted/__tests__/`; modify `src/types/database.types.ts` (add the table in the
file's own format), `src/lib/scraping/apify-provider.ts` (export `isAllowedPostUrl`, nothing else).

- [ ] **The migration** (additive, safe to run twice; written here, applied by the controller only):

```sql
create table if not exists public.piece_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid references public.threads(id) on delete cascade,
  piece_key text not null check (char_length(piece_key) between 1 and 200),
  piece_kind text not null check (piece_kind in ('video','script','remix','hooks','ideas','text')),
  said_number smallint not null check (said_number between 0 and 100),
  said_measure text not null check (said_measure in ('stop','end')),
  said_at timestamptz,
  platform text not null default 'tiktok' check (platform in ('tiktok')),
  post_url text not null check (char_length(post_url) between 1 and 500),
  post_id text check (post_id ~ '^[0-9]{5,25}$'),
  handle text check (handle ~ '^[a-z0-9._]{1,50}$'),
  posted_at timestamptz,
  views bigint check (views >= 0),
  likes bigint check (likes >= 0),
  comments bigint check (comments >= 0),
  shares bigint check (shares >= 0),
  saves bigint check (saves >= 0),
  read_at timestamptz,
  reads jsonb not null default '[]'::jsonb,
  settled_at timestamptz,
  usual_views bigint check (usual_views > 0),
  usual_posts smallint check (usual_posts >= 5),
  attempts smallint not null default 0 check (attempts >= 0),
  read_error text check (read_error in ('gone','failed')),
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists piece_posts_one_per_piece
  on public.piece_posts (user_id, coalesce(thread_id, '00000000-0000-0000-0000-000000000000'::uuid), piece_key);
create index if not exists piece_posts_thread on public.piece_posts (thread_id);
create index if not exists piece_posts_user_handle on public.piece_posts (user_id, handle);
alter table public.piece_posts enable row level security;
-- one policy, own rows, in the (select auth.uid()) form the newer migrations use; guarded so a second run is a no-op
```

  Check `threads.id`'s type and the piece kinds (`PieceKind` in `src/lib/library/chat-summary.ts`, without
  `chat`) against the code before you fix the SQL; say what you found. A test reads the SQL file and
  proves the code's limits against it (the pattern of `src/lib/you/__tests__/facts.test.ts`).
- [ ] **The rules and the words** above, tests first: every branch, the boundaries (71 h 59 min and 72 h;
  0.67, 1.5; 4 and 5 posts; an even and an odd count for the median; a pinned post; the excluded post),
  the link table (https only, hosts, apex, 501 characters, spaces, `javascript:`), an id's time against a
  hand-computed value, and a wrong id.
- [ ] **The repository** (takes a Supabase client; every query filters by `user_id` as well as RLS):
  `insertPost`, `postOfPiece(userId, { threadId, pieceKey })`, `postsOfThreads(userId, threadIds)`,
  `duePosts(userId)`, `postsOfHandle(userId, handle)`, `updatePost(userId, id, patch)`,
  `deletePost(userId, id)`, `linksInLastDay(userId)`. `appendRead(reads, read)` keeps the newest
  `READS_KEPT`. Tests against a stand-in client that records the calls (boundary), as the Library's
  repository tests do.

**Report:** `.superpowers/sdd/2026-11-24-after-posting/task-1-report.md`.

### Task 2: the reader, the routes, the Library page

**Files:** create `src/lib/posted/read-posts.ts`, `src/lib/posted/piece-said.ts`,
`src/app/api/posted/route.ts` (POST, GET), `src/app/api/posted/[id]/route.ts` (DELETE),
`src/app/api/posted/refresh/route.ts` (POST), tests beside them; modify
`src/lib/library/library-page.ts` (+ its tests).

- [ ] **`piece-said.ts`**: what Maven said about a piece, on the server, for the owner only.
  Text: the chat (owned) and the stored simulation whose result-page key is `key` (reuse the lookup of
  `src/app/api/threads/[id]/seals/[key]/route.ts`; move it to a shared function rather than copying it):
  `{ number: stopNumberOf(seal), measure: "stop", at: seal.at, kind }`. Video: the analysis row (owned):
  `headlineOf(audienceOf(row))`, measure `end`, `at: created_at`, and the chat that holds it (a stored
  simulation keyed by the analysis id), or no chat. No number: null.
- [ ] **`read-posts.ts`**: `readDue(client, userId, provider, now, { only?, retry? })`. The provider is a
  parameter with exactly the two calls used: `scrapeSinglePostMetrics(url)` and
  `scrapeVideos(handle, 30, "profile")`. At most 3 provider calls per run. In order:
  1. A due row never read: one single read. `null` → `read_error = 'gone'`. A throw →
     `read_error = 'failed'`, `attempts + 1`, `last_attempt_at`. A video → post id, handle, `posted_at`
     (rule above), the numbers, `read_at`, one kept read, `read_error = null`, `attempts = 0`, and
     `post_url` becomes the canonical link when handle and id validate.
  2. Then per handle with due rows (read ones): ONE account read. Each of that person's unsettled rows
     of the handle found in it by post id gets the numbers and a kept read. A row whose
     `posted_at + 72 h <= now` is settled: `settled_at = now`, `usual_views`, `usual_posts` from
     `usualOf(list, its post id, now)` (null stays null). A row past 72 hours that is not in the list
     gets one single read, then settles with the list's usual.
  3. A row with no handle is read alone, and settles without a usual.
  `retry` (with `only`) first sets that row's `attempts = 0`, `read_error = null`.
  Tests with a recording provider: each branch, the 3-call cap, two rows of one handle cost one account
  read, a throw in one row does not stop the others, nothing is written for another person's rows.
- [ ] **Routes** (all: 404 with the flag off and for a funnel visitor (`isSealedVisitor`); 401 signed
  out; `csrfGuard` on writes; errors are logged without the pasted link):
  - `POST /api/posted` body `{ kind: "text", threadId, key, url }` or `{ kind: "video", analysisId, url }`
    (zod). 400 `not_tiktok` for a link `parsePostLink` refuses; 404 when the piece is not the caller's;
    422 `no_number`; 409 `already_linked`; 429 `too_many` at `LINKS_PER_DAY` (counted in the table);
    201 `{ posted }`. It does NOT read the post.
  - `GET /api/posted?threadId=&key=` or `?analysisId=` → 200 `{ posted: Posted | null }`.
  - `DELETE /api/posted/[id]` → 204; 404 when it is not the caller's.
  - `POST /api/posted/refresh` body `{ id?, retry? }` → runs `readDue` with a real
    `ApifyScrapingProvider`; 200 `{ posted: Posted[] }` (the caller's rows it touched).
    `export const maxDuration = 300`.
  Tests call the real handlers; the database client and the provider are the stand-ins.
- [ ] **The Library page**: `LibrarySummary` gains `posted: Posted | null`, and its `stage` becomes
  `Stage | "posted"` (export `LibraryStage`); a chat with a posted piece has stage `posted`. One more
  query per page (`postsOfThreads` for the page's chat ids); several posted pieces in one chat: the one
  linked last. `chat-summary.ts` (the pure summary) is not changed. A failed posted query fails the page
  as any other read does. Tests: a page with none, one, two in one chat; the query is one per page.

**Report:** `task-2-report.md`.

### Task 3: the sheet and the card, on both result pages

**Files:** create `src/hooks/queries/use-posted.ts`, `src/components/posted-next/posted-sheet.tsx`,
`posted-ask.tsx`, `after-posting-card.tsx`, tests; modify `src/components/result/text-result.tsx`,
`src/components/result/video-result.tsx` (or their screens: mount where the data is).

- [ ] **`use-posted.ts`**: `usePosted(piece)`, `useAddPosted()`, `useRemovePosted()`,
  `useRefreshPosted()`; keys `postedKeys`; adding, removing and a finished refresh invalidate the posted
  key and the Library's keys (`libraryKeys` in `use-library.ts`). After a successful add the hook starts
  one refresh for that id by itself. While `posted.due` is true on a mounted page, one refresh is asked
  for per mount (never in a loop: a refresh that returns the row still due does not start another).
- [ ] **`PostedSheet`** (`open`, `onOpenChange`, `piece`): the app's own sheet (the one
  `src/components/thread-next/more-sheet.tsx` and the You page use: bottom sheet on a phone, a centred
  dialog from `md`; name the primitive you used). One labelled field (`TikTok link`), `Add link`. The
  field takes focus on open; Enter submits; an empty or refused link shows `That's not a TikTok link.`
  under the field (`aria-describedby`, `aria-invalid`) and sends nothing; the server's answers map to the
  fixed strings; while the request runs the button waits and a second submit sends nothing; on success
  the sheet closes and focus returns to what opened it.
- [ ] **`PostedAsk`**: the quiet row (`Posted it?` / `Add the link and see what it did.`), a button that
  opens the sheet. Shown only when the piece has a number and no posted link.
- [ ] **`AfterPostingCard`** (`posted`, `now`): the states of spec 3.2 and 3.3 with the words above. Two
  tiles side by side (`Maven said`, `It got`); the usual line in its tone's colour; the counts line; the
  foot, whose handle is a link (`posted.href`, `target="_blank"`, `rel="noopener noreferrer"`) only when
  `href` is not null. A menu button named `More: posted link` with `Remove posted link` → the confirm
  step (a second tap never lands on `Remove`: follow `src/components/you-next/account-menu.tsx`).
  `unread`: the sentence, `Try again` (refresh with `retry`), `Remove`. `reading`: the two lines and no
  numbers; it is announced politely (`role="status"`).
- [ ] **Mounting:** the hook's page (`/simulation/hook/[threadId]/[key]`) and the video's
  (`/simulation/[id]`), directly under the page's first block: the card when posted, else the ask row.
  Nothing with the flag off (these pages exist only with the flag on; prove the old `/analyze/[id]` board
  is untouched by not importing anything there). Not on a result that has no number.
- [ ] Tests through the real components (queries with a real `QueryClient`, `fetch` the stand-in): each
  state, each error, the double submit, focus, the menu's confirm, phone and desktop variants of the
  sheet, and that no caption or pasted text is ever rendered.

**Report:** `task-3-report.md`.

### Task 4: Library and Home

**Files:** modify `src/lib/library/library-view.ts`, `src/components/library-next/library-screen.tsx`,
`library-next.tsx`, `chat-row.tsx`, `chat-row-data.ts`, `row-line.ts`, `row-menu.tsx`,
`src/components/home-next/home-next.tsx` (+ tests of each).

- [ ] **Filter:** `LibraryFilter` gains `"posted"`; the chips are All · Drafts · Simulated · Posted ·
  Saved; `?filter=posted` is accepted; `keeps`: posted = `summary.stage === "posted"`; Simulated no
  longer lists posted chats. The chip row scrolls sideways on a narrow phone (no visible scrollbar, the
  selected chip is scrolled into view, each chip keeps its 44 px target), and nothing else on the page
  scrolls sideways at 320.
- [ ] **Row:** stage word `Posted`; the second line is `rowLine(...)`: its text, then the mark as one
  unbroken piece in its tone's colour (it may wrap to its own line, never mid-phrase); the gauge is
  unchanged (what Maven said). Desktop: a column `After posting` after `Simulated` (`cellWords`); the
  table still fits from `md` up with the sidebar open (measure at 768, 1024, 1440; say what you changed
  in the grid).
- [ ] **Menu:** `Add posted link` when the chat has a simulated piece and no posted one (opens
  `PostedSheet` for `summary.sim`'s piece); `Remove posted link` when it has one (the same confirm as on
  the card). Order: Rename, Pin, the posted item, Delete.
- [ ] **Reading on a visit:** when any loaded chat's `summary.posted.due` is true, Library asks for one
  refresh per visit (the hook of Task 3) and the rows update when it returns.
- [ ] **Home's Recent:** the same line through the same row data (no gauge change, no menu).
- [ ] Tests: the filter and its address, the three row states plus unread, the mark's colour by tone,
  the menu items by state, one refresh per visit, Home's line; and the existing Library and Home tests
  stay green without weakening one.

**Report:** `task-4-report.md`.

### Task 5: checks (the controller)

Apply the migration after Task 1's review (alone, to the one live database) and name the file as the
database records it. Then, with the new look on and live grounding scrapes off: a real public TikTok
link on the test account through every state of spec 3.2, phone and desktop, light and dark, keyboard;
the refusals of spec 10.4; the test account left as found. Types, lint, the whole suite, both production
builds, flag off against the baseline. About 8 scraper runs, announced to the owner beforehand.

---

## Result (2026-11-24)

Built in one afternoon: four build tasks (Opus), a review after each (Sonnet), one whole-branch review (Opus,
"Ready with fixes") and one fix round, a simplify pass, then the checks. 36 controller rulings changed the plan
along the way; they are folded into the spec's section 11 ("As built"). The main ones: removing a link keeps
its row; the browser reads its rows and writes none; a read claims its rows first; "Try again" is bounded; a
posted chat's row is about its posted piece.

**Checks on the final tree**

| Check | Result |
|---|---|
| Types | clean |
| Whole suite | 765 files, 10,848 tests passed, 42 skipped, none failed |
| Lint | clean on the changed source files |
| Production build, flag off | builds; the comparison with the recorded baseline equals the accepted one of the part before (no real difference); every new route answers 404 |
| Production build, flag on | builds; the routes answer |
| The real app, test account | 8 scraper reads: a fresh post ("so far"), the same post made 80 hours old in the database ("final", no usual), a 12-day-old post on a video ("3M views, 0.1× your usual" from 29 posts), a post that does not exist ("couldn't read", "Try again", Remove), a hook that is not its chat's last simulated piece (the row shows that hook's number); 16 refusals by direct request; Library and its menus on phone and desktop, light and dark, at 320, 393, 768, 1024 and 1440 |

The four test links were deleted afterwards; the table is empty.

**Not done, said plainly**

- Home's Recent with a posted row was not seen in the real app (no recent chat of the test account is posted).
- Instagram and YouTube posts; more than one post per piece; the rule for "right" and the record; a scheduled
  job. See the spec, sections 8 and 11.
- The shared rate limiter is switched off where its store is not configured, as for every other route.

