# Handoff — Discover rework: BUILT, awaiting owner verification + merge

**Date:** 2026-08-02 · **Worktree:** `~/virtuna-slot-c` · **Branch:** `task/discover-rework`
**HEAD:** `4230b7e2` (pushed, 0 commits behind `origin/main`) · **NOT MERGED**

> ⚠️ **Merging to `main` IS deploying** — production builds ~3s after the merge, there are no
> preview URLs, and a green Vercel check is not a build (`ignoreCommand` skips and posts success).
> The owner merges. Do not merge on their behalf.

---

## 0. What this session did

The owner rejected the one-page sketch (`docs/mockups/discover-rework-2026-08-02.html`, commit
`2405224e`) with: *"it all being on the same page isnt good at all. we wasted too much time on
sketching. lets just rework the current render on the live and make it clean and premium."*
Then, asked to choose the IA, they picked **three tabs** with one correction: **"sources isn't a
good name"** → the tab is called **Watchlist**.

Sketching is over. Everything below is shipped in `src/`.

### Commits

| sha | what |
|---|---|
| `2405224e` | sketch v3 (superseded — kept only as a design record) |
| `72db51ea` | **fix(billing)** — `/api/discover` priced at 5 credits, wall before gate |
| `4230b7e2` | **feat(discover)** — the three-tab rework |

---

## 1. What the surface is now

`/feed` — three tabs that switch **in place** (no navigation, so the old 16px tab-bar jump and the
changing `<h1>` are impossible by construction):

- **Outliers** (230) — every teardown baselined at ≥3×. Niche chips w/ counts · Recent / Highest × /
  Most viewed · Remix on card hover · a footer stating the newest-video date.
  **Thin-baseline extremes (≥100×) are excluded from the feed pool** — the corpus runs to 20,154×,
  so a "Highest ×" sort would otherwise open on a fantasy. They stay inside their collections,
  flagged `⚠`.
- **Collections** (105) — the curated `teardown_collections` groupings across 4 categories, drilling
  into hook rows with the three honest states: green `▲11.5×` · flagged `615× ⚠` · plain `curated`.
- **Watchlist** (6) — `tracked_accounts` ∪ `competitor_profiles` merged **for display**. Carries a
  `merged @chrisbumstead` chip on the cbum row; a failed scrape reads "Scrape failed — held back
  until a clean read" instead of `elmakbtn915 · 0 followers`.

One search field filters all three; `Pull live · 5 credits` appears only for a handle not already held.

### Files

| path | role |
|---|---|
| `src/lib/discover/corpus-reads.ts` | corpus read — feed pool, collections index, niche counts |
| `src/lib/discover/watchlist-reads.ts` | the two source tables merged |
| `src/components/discover/discover-hub.tsx` | shell + search + tab state |
| `src/components/discover/{outliers,collections,watchlist}-panel.tsx` | the three tabs |
| `src/components/discover/discover-primitives.tsx` | `MultiplierChip`, `Chip`, `Kicker`, formatters |
| `src/components/discover/use-remix-launch.ts` | the discover→remix chain, shared |
| `src/components/discover/discover-subpage-header.tsx` | back-link header for Pull / Add-a-creator |

**Deleted:** `lib/hooks/default-hooks.ts` · `feed/hooks/hooks-client.tsx` · `components/feed/hook-row.tsx`.
`/feed/hooks` → redirects to `/feed?tab=collections`.

### Two decisions worth not re-litigating

1. **`/competitors` renders the board again** (it was a redirect into the now-deleted Competitors
   tab). It owns the ONLY add-a-competitor flow and the `/compare` entry, so a redirect would have
   stranded both. **The tab merge is a READ merge**; the two write paths stay separate because the
   data does — a tracked account feeds `scraped_videos` with a multiplier, a competitor feeds
   `competitor_videos` + snapshots + compare.
2. **`routing-cut.test.ts` was inverted deliberately** — it used to assert each tab's `href`
   resolved; it now asserts the bar has **no** `href` at all. An href reappearing means the
   page-split came back.

---

## 2. State of the gates (all green as of `4230b7e2`)

- `node ./node_modules/typescript/bin/tsc --noEmit` → clean
- `node ./node_modules/vitest/vitest.mjs run` → **4,958 pass**, 42 skipped, 0 fail
  - ⚠️ 3 "Unhandled Errors" in `composer.test.tsx` are **pre-existing** — verified reproducible with
    this branch's changes stashed. Not caused here, not fixed here.
- `node ./node_modules/next/dist/bin/next build` → compiled successfully
- Signed-in visual pass at 1440px: tab bar at **144px on all three tabs**, `h1` stays "Discover",
  0 broken covers, Highest-× top row reads **99.3×**.

**Never `npm test`** — it prints a fake PASS. **Never `npx`** — the wrapper eats output.

---

## 3. Where to continue — ranked

### 3.1 Owner verification, then merge
Nothing is deployed. The dev server was left on **:3004** this session (a launchd reaper kills idle
servers after ~10 min; restart with the recipe in §4).

### 3.2 Schedule the crons — this is what makes Outliers a *feed*
**The corpus is FROZEN**: one bulk insert on 2026-07-14, newest video posted **2026-06-10**, nothing
since. The UI states the newest-video date rather than implying freshness, which is honest but it is
still a library, not a feed.
**8 of 11 cron routes exist but are not in `vercel.json`** — `scrape-trending`, `refresh-competitors`,
`refresh-account-snapshots`, `calculate-trends`, `reap-anonymous`, `refresh-corpus`, `audience-drift`,
`validate-rules`. Three carry doc comments asserting schedules that don't exist.
⚠️ `refresh-corpus` is a **pure stub** returning `{status:"stubbed"}` — scheduling it does nothing.
⚠️ Apify is on rotating FREE accounts, **$5/mo hard cap** — scheduling scrapers spends real money.

### 3.3 Four more unmetered Apify routes
`channels/ingest` (unlimited distinct handles; only a 24h per-handle freshness check) · `profile` ·
`connected-accounts/connect` · `audiences/calibrate`. All invisible to the wiring guard, which scans
`app/api/tools` only. Same fix shape as `72db51ea` — and **copy the ordering**: `isSealedVisitor` →
403 BEFORE `creditGate`, or an anonymous `/go` visitor gets a 402 regardless of
`BILLING_ENFORCE_QUOTA` (`enforced = isAnonymous || isQuotaEnforced()`, `quota.ts:308`).

### 3.4 Loose end I left — `whyExcerpt` is fetched and never rendered
`corpus-reads.ts` reads `why_it_works` (220-char excerpt) into every `CorpusVideo`, but no component
displays it — the sketch had a teardown detail view and the built version does not. **Either build
the detail (a card click → why-it-works + reusable template + Remix, which is real depth the corpus
already has) or drop the field from the select** to shed payload. Do not leave it as is.

### 3.5 Smaller, genuinely useful
- **Save to Library from an outlier card** — `saved_items.item_type` already includes an unused
  `"outlier"` value, so the store is waiting.
- **`posted_at` backfill** on `scraped_videos` from `metadata.uploaded_at` (7,272 rows). Much less
  urgent now that Discover no longer reads that table for content — it only aggregates outlier
  counts for the Watchlist. ⚠️ **`supabase db push` is UNSAFE here** (48 local-only / 41 remote-only
  migrations; it would recreate `threads`). Single migration via the SQL editor.
- **`/start` outlier rail is silently capped** — `lib/surfaces/outlier-reactions.ts` asks for
  `{tab:"trending", sort:"outlier"}` believing it reads top corpus outliers; `feed-query.ts:212`
  applies `.not(sortCol,"is",null)` to every sort, so it draws from the same 49 enriched rows.

---

## 4. Recipes that worked (reuse, don't rediscover)

**Dev server** — `npm run dev` OOMs:
```bash
NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev -p 3004
```

**Signed-in screenshots** — `.scratch/shoot-rework.mjs` is written and working. It mints the session
via the Supabase REST endpoint and writes the chunked `sb-<ref>-auth-token` cookie (creds are
`E2E_USER_EMAIL` / `E2E_USER_PASSWORD` in `.env.local`). Never `waitUntil:'networkidle'` — the HMR
socket never settles; use `domcontentloaded` + an explicit selector wait.

**RLS facts that cost time here — both verified live, do not re-derive:**
- `outlier_teardowns` + `teardown_collections` have **RLS on with NO policies**. No browser session
  can read them. All corpus reads go through `getCorpusClient()` (the grounding service client).
- `competitor_profiles` / `competitor_videos` RLS exposes only rows linked through
  `user_competitors`. A creator added via the **channel ingest** writes a profile row with no such
  link, so the user cannot read the avatar and follower count their own add just captured —
  @zachking and @garyvee rendered as bare letter-avatars until fixed. `watchlist-reads.ts` enriches
  via the service client scoped to the user's own handles + competitor ids;
  `/api/channels/watchlist` had already hit this and solved it identically.

**Live data shape** (service-key dump, `scripts/discover-sketch/fetch-corpus.mjs` → `.scratch/corpus.json`):
524 extracted teardowns · 100% covers · 396 baselined · 288 at ≥3× (230 once extremes are excluded) ·
105 collections / 592 memberships, zero orphans · newest post 2026-06-10 · 45 users, of whom **1**
tracks channels and 2 have competitors.

---

## 5. Refinement backlog — observed this session, NOT acted on

Ordered by whether they are defects or taste. The first two are real.

### 5.1 🔴 Remix is unreachable without a mouse
`OutlierCard`'s Remix button is `opacity-0 … group-hover:opacity-100` (plus `focus-visible`). On a
touch device there is no hover, so **the feed's only action cannot be reached at all** on mobile.
`focus-visible` saves the keyboard path, not the touch one. Options: always-visible on `< lg`, a
tap-to-reveal, or make the whole card open a detail view that carries the action (which pairs with
§3.4 below). Decide with the detail-view question, not separately.

### 5.2 🔴 A corpus read failure 500s the whole page
`getDiscoverCorpus()` throws on a Supabase error and `/feed` has no error boundary, so one bad read
takes out Discover entirely — including Watchlist and Collections, which don't depend on it. The
grounding layer's own convention (`lib/grounding/corpus.ts` header) is *"RPC failures throw; the
caller wraps in try/catch + graceful degradation"* — this caller doesn't. Wrap per-read and let a
failed corpus render an honest empty state while the other tabs still work.

### 5.3 The teardown detail view (the §3.4 loose end, restated as design)
`why_it_works` is read into every card and rendered nowhere. The corpus also holds `hook_template`
(the reusable pattern) separately from `spoken_hook` (what the video actually says) — the card shows
the spoken line, and the template currently only appears in collection rows. A card → detail with
cover · spoken hook · **why it works** · template · Remix is the natural next increment, and it
resolves §5.1 at the same time.

### 5.4 Taste / polish
- **Kicker truncation** — `PATTERN INTERRUPT // VISUAL SWITCHING` clips to `PATTERN INTERRUPT // VISUAL S…`
  on collection cards. Either shorten the subcategory labels for display or drop to the category.
- **Search is per-tab** — typing filters only the active tab; there is no "12 in Collections" hint
  that results exist elsewhere. Cheap to add, and it is the main thing that would make the three
  tabs feel like one surface.
- **Watchlist "latest" strip** clips its last card at the container edge (it is a horizontal
  scroller, so this is honest, but a right-edge fade would read better).
- **Pull live navigates away** to `/feed/discover`. Deliberate — its results have no covers
  (`VideoData` carries none), so they would look broken in the premium grid. If Pull should feel
  inline, the cover gap is the thing to fix first, not the layout.
- **Empty states are untested against a real empty account** — 44 of 45 users track nothing, so the
  Watchlist tab most users see is the invitation, and it has only been seen with 6 sources present.
  Worth one pass signed in as a fresh account.

### 5.5 Explicitly settled — do not reopen without the owner
- Three tabs, named **Outliers · Collections · Watchlist** (owner named Watchlist; "Sources" was
  rejected).
- Tabs switch in place; the bar carries no `href` (pinned by `routing-cut.test.ts`).
- The ≥100× exclusion from the feed pool, and the three-state multiplier chip.
- Collections sort by views, not by multiplier.
- `/competitors` renders the board; the tab merge is a READ merge only.
