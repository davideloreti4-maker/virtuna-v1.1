# Handoff — Discover rework: SHIPPED, merged, and live in production

**Date:** 2026-08-02 · **Built in:** `~/virtuna-slot-c` on `task/discover-rework`
**Merged:** PR **#418** → `main` as **`c7df0b2e`**, deploy READY in 130s, **live on numenmachines.com**

> ✅ **Session 3 (2026-08-02, later still) shipped it.** The owner asked for anything still open in
> the worktree to be merged, which is the authorisation §3.1 was waiting on. Jump to **§7** for the
> merge record and the only list that still matters: what is left to do.

> **Session 2** closed §5.1, §5.2, §5.3 and the §3.4 loose end, and did the empty-account pass
> §5.4 asked for. **§6** is what it changed.

> ⚠️ **Merging to `main` IS deploying** — production builds within seconds of the merge and there
> are no preview URLs, so **verify before you merge, never after**. A green Vercel check is not a
> build. `vercel.json`'s `ignoreCommand` is
> `[ "$VERCEL_ENV" = "production" ] && exit 1 || exit 0` — production **always** builds (exit 1),
> every other environment always skips *and posts success*. Even a docs-only merge redeploys prod.

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

### 3.1 ~~Owner verification, then merge~~ — ✅ DONE, see §7
Merged as `c7df0b2e` and verified live. Everything below §3.1 is still open.

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

> ⚠️ **§5.1–§5.3 and the §3.4 loose end are CLOSED — see §6.** §5.4's empty-state bullet is done
> too. The rest of §5.4 is still open. The two corrections §6 makes to the text above are marked
> there; the descriptions in §5.1/§5.2 were each wrong in one detail.

### 5.5 Explicitly settled — do not reopen without the owner
- Three tabs, named **Outliers · Collections · Watchlist** (owner named Watchlist; "Sources" was
  rejected).
- Tabs switch in place; the bar carries no `href` (pinned by `routing-cut.test.ts`).
- The ≥100× exclusion from the feed pool, and the three-state multiplier chip.
- Collections sort by views, not by multiplier.
- `/competitors` renders the board; the tab merge is a READ merge only.

---

## 6. Session 2 — the two defects, the detail view, and the empty account

Everything here is shipped in `src/` and verified signed-in. Nothing is deployed.

### 6.1 §5.2 — a failed corpus read no longer takes the page down

`/feed` settles its two reads with `Promise.allSettled`. Each degrades to its own empty shape and
the hub receives a `failures` flag beside it, so a tab whose read failed says *"We couldn't load
the outlier library just now"* with a Retry, while the other tabs keep working.

> 🔑 **Correction to §5.2: `/feed` DOES have an error boundary** — `src/app/(app)/error.tsx`
> covers the whole route group. The defect was real but the mechanism was not "unhandled throw";
> it was that the boundary is page-wide, so a corpus failure swapped the entire hub for the
> generic error screen and took Watchlist — which reads two other tables through a different
> client — down with it. The fix is per-read degradation, NOT another boundary.

A failed read arrives as an empty corpus, and empty is indistinguishable from "nothing there" —
so the flag travels separately and the surface **omits** counts rather than printing `0`. The
header restates itself too; it never claims "0 proven outliers · 0 collections" about a library
it could not open.

**Verified against the real failure**, not a mock: a dev server booted with a bogus
`SUPABASE_SERVICE_ROLE_KEY` makes the corpus read genuinely throw. Outliers and Collections each
showed their own banner, both counts vanished from the tab bar, and Watchlist still rendered its
sources and both add-doors. `.scratch/shots/corpus-fail-*.png`.

### 6.2 §5.1 + §5.3 — the card opens a teardown detail, and that is where Remix lives

`components/discover/teardown-detail.tsx` — a dialog opened from an outlier card **and** from a
collection row (the hub owns the open id; one instance over one `corpus.teardowns` map). It shows
cover · kicker (`archetype · niche`) · spoken hook · receipt chip · **why it works, in full** ·
the reusable template · the taxonomy · a plain always-visible **Remix → Read**.

> 🔑 **Correction to §5.1: it was worse than "unreachable".** The `opacity-0` Remix still occupied
> its slot and still took the tap, so on a touch device a thumb landing on the lower third of a
> card fired a remix nobody could see and got dropped on `/home`. Not a missing affordance — a
> mis-firing invisible one. The button now carries `pointer-events-none` until
> `group-hover`, is `aria-hidden` + `tabIndex={-1}` (a duplicate of an action the detail offers
> accessibly), and the card gets a stretched overlay button that is its single tab stop.
>
> **Proven on a real touch context**: tapping the exact pixel the invisible button occupied
> opens the detail, the URL stays `/feed`, and **zero POSTs fire**.

### 6.3 §3.4 — `whyExcerpt` is gone, and the detail reads one row instead

The loose end said "render it or drop it". Both, in the right places. `why_it_works` is a **p50 of
578 characters** across all 524 rows (min 234, max 760), so the 220-char excerpt broke mid-sentence
on ~95% of them — there is no excerpt that is both cheap and whole.

| `whyExcerpt` in the corpus read | raw | gzip |
|---|---|---|
| dropped | 324KB | **75KB** |
| 220 chars (what shipped) | 436KB | **113KB** |
| full essay | 620KB | **173KB** |

> ⚠️ **What that table is, precisely:** `JSON.stringify` + gzip of the 524 `CorpusVideo` objects
> as the read builds them, from the live service-key dump (`.scratch/corpus.json`). It is the
> corpus half of the page payload — the part this change moves — **not** a measured
> before/after of the whole RSC response, which was never A/B'd. Treat the ~38KB gzip saving as
> "the corpus data got that much smaller", not as a page-weight benchmark. The decision does not
> hinge on the exact figure: the ratio is what matters, and shipping 524 essays to render one is
> wrong at any of these numbers.

So the corpus read dropped the column and `app/actions/discover/teardown.ts` fetches one row on
open — which **also** unlocked `format` / `visual_hook` / `editing_style`, populated on all 524
rows and never selected before. The analysis is finally rendered whole. The server action is auth-checked (it is a public POST endpoint) and
reads through `getCorpusClient()`, because `outlier_teardowns` still has RLS on with no policies.

⚠️ A guard in `feed/__tests__/read-degradation.test.ts` fails if those columns reappear in the
hub's `.select()` — that is the payload coming back.

### 6.4 The empty account (§5.4's last bullet)

44 of 45 accounts track nothing, and that Watchlist rendered as **two stacked dashed boxes**: a
bare "You're not watching anyone yet." carrying no action, and separately the block that held the
invitation and both doors. Now one block — icon, headline, the two-kinds sentence, both doors, and
a line out to the library (*"230 proven outliers are already in the library"*, which switches tabs).
A filter miss keeps its own thin line; it is a different state.

> ⚠️ **What this does NOT prove.** No fresh account was created — dev and prod share one Supabase
> project and that would have written a real user row. The empty state was forced with a temporary
> one-line env guard in `getWatchlistData`, screenshotted, and the file restored from a checksummed
> copy (verified: no probe code in `src/`). So the **rendering** is confirmed with real eyes;
> a fresh account's RLS path is not. `.scratch/shots/empty-acct-v2-watchlist.png`.

### 6.5 Three defects this session's own verification caught

- **`link-name` — the detail's cover was a nameless link.** Its only content is a decorative
  cover image, so a screen reader announced a bare URL; the mobile thumbnail had no text at all.
  The desktop one *looked* named only because its "Watch original" overlay text sits in the DOM
  at `opacity-0` — text that appears on hover is not an accessible name. Found by adding `axe`
  to the new components, not by review. Both covers now carry an explicit `aria-label`, and the
  axe assertions are permanent (`teardown-detail.test.tsx` → "a11y").
- **The dialog's mobile layout was wrong on the first build.** The desktop cover column ran 437px
  of a 664px viewport, so "Why it works" — the reason the dialog exists — opened below the fold.
  The cover is now a thumbnail beside the title under `sm`, the full column above it.
- **`truncate` on the Kicker does nothing.** It is an inline `<span>`, and overflow does not apply
  to inline boxes, so at phone width the kicker ran *under* the close button instead of
  ellipsizing. It needs a block wrapper. **This is the same root cause as §5.4's kicker-truncation
  item** — worth checking there when that one is picked up.

### 6.5b Verified by mutation, not by assertion

The new tests were run against the PRE-change code (`git stash push -- src/`, which leaves the
untracked new files in place). **11 of 16 failed**, including `read-degradation` failing with the
raw `Error: PGRST — corpus unavailable` escaping the page — the defect itself, reproduced.

The 5 that passed are expected and worth knowing so nobody "fixes" them: 4 cover
`TeardownDetailDialog`, a new untracked file that survives the stash, so they cannot fail against
a past in which it did not exist; the 5th is the filter-miss guard, which deliberately protects
behaviour this pass PRESERVED rather than added.

### 6.6 Gates — and a correction to how §2 reported them

`tsc --noEmit` clean · `next build` compiled · signed-in visual pass at 1440px and on an iPhone 13
touch context, 0 console errors · **0 test failures attributable to this branch** (the discover +
feed scope runs 76/76; the new files 13/13).

> 🔑 **`vitest run` EXITS 1 in this worktree, before and after this branch. §2's "0 fail" was read
> through a pipe.** `node …/vitest.mjs run 2>&1 | tail -8` reports **`tail`'s** exit code, which is
> always 0 — the same wrapper-swallowing trap the repo already documents for `npx`. Unpiped, the
> real state of `~/virtuna-slot-c` is:
>
> 1. **3 unhandled rejections** in `composer.test.tsx` (`Cannot read properties of undefined
>    (reading 'catch')`, `composer.tsx:2011`). Vitest exits non-zero on unhandled errors **even
>    with 0 failed tests**. Reproduces running that file alone.
> 2. **2 reproducible failures** — `composer-fold-on-close` and `composer-stop-disc`, both
>    `Test timed out in 5000ms`. **They fail identically with this branch's changes stashed**
>    (same worktree, same `node_modules`), and they PASS in `~/virtuna-v1.1`. The difference is
>    the worktree's own dependency tree: **slot-c has vitest 4.1.10, trunk has 4.0.18**. Both test
>    files and `composer.tsx` are byte-identical to `origin/main`, and composer has no import path
>    to anything under `discover/`.
> 3. **Intermittent 5s timeouts under machine load** — seen in `reading.*`,
>    `remix-core-grounding`, `api/tools/chat`; count varied 2 → 7 across back-to-back runs on a
>    loaded machine. No `testTimeout` is configured, so the default 5000ms applies suite-wide.
>
> ⚠️ So **do not treat a non-zero `vitest` exit here as a signal about Discover.** Diff the failing
> file against `origin/main` first, and re-run it in isolation. Worth fixing separately: aligning
> the slot worktrees' vitest version with trunk's, and raising `testTimeout` in `vitest.config.ts`.

The pass counts quoted above and in §2 (4,958 / 4,970 / 4,974 / 4,976) are all real — the suite
genuinely reaches 0 failures on a quiet machine — but the **exit code was never 0**.

New tests: `feed/__tests__/read-degradation.test.ts` (the read split + the payload guard),
`discover/__tests__/teardown-detail.test.tsx` (touch reachability + the detail),
`discover/__tests__/watchlist-empty.test.tsx` (one dashed box, not two).

### 6.7 Still open from §5.4

Kicker truncation on collection cards (see 6.5 — likely the same inline-span cause) · no cross-tab
search hint ("12 in Collections") · the Watchlist "latest" strip clips its last card at the
container edge · Pull live still navigates away to `/feed/discover`, because its results carry no
covers. Plus everything in §3.2/§3.3/§3.5, untouched.

**One known polish gap:** closing the detail unmounts it immediately, so Radix's exit animation
never plays. The open animation does. Left as-is deliberately — fixing it means holding the last
video in state purely to animate it out.

---

## 7. Session 3 — merged, deployed, verified. And what is actually left.

### 7.1 The merge record

`task/discover-rework` was 8 commits ahead / **29 behind** `origin/main` and had **no PR**. Rebased
onto `a7ff97f6` — the branch's 37 changed files and main's 70 had **zero overlap**, so all 8 commits
replayed with no conflicts. PR **#418** → merge **`c7df0b2e`** (parents `a7ff97f6` + `1dc727c6`).
Deploy `dpl_8sbE4xRoZuRJQPB8eWkQXBgwh35Z` READY in **130s**, aliased to `numenmachines.com`.

**Gates were re-run after the rebase, not inherited from §2/§6.6.** 29 commits of `main` had landed
underneath, so the old numbers described a tree that no longer existed:

| gate | result |
|---|---|
| `tsc --noEmit` | exit **0**, no output |
| `next build` | exit **0**, compiled in 20.1s |
| full `vitest run` | **5021 passed, 0 failed**, 42 skipped |
| discover + feed + billing scope | **141/141**, exit **0** |
| signed-in @1440px, dev | tabs 230/105/6, bar 144px on all three, 0 broken covers on `/feed` |
| signed-in on **production**, post-deploy | same counts, 24 cards, `/feed/hooks`→collections, **0 console errors** |

### 7.2 §6.6's vitest finding, diagnosed

§6.6 was right that `vitest run` exits 1 here regardless of this branch, and right not to trust it.
The **cause** is now known: this worktree carries **vitest 4.1.10**, trunk `~/virtuna-v1.1` carries
**4.0.18** — each slot ran its own `npm install` at a different time against the same semver range.
The 3 unhandled rejections in `composer.test.tsx` (`composer.tsx:2012`) reproduce running that file
**alone**, on files byte-identical to `origin/main`, in a component with no import path to
`discover/`. §6.6's two `composer-*` timeout failures did **not** recur on a quiet machine, which
matches its own "intermittent under load" note.

> 🔑 **So the exit code is corrupt in every slot worktree, not just for Discover.** Align the slots'
> vitest with trunk's before trusting a slot's exit code again. Until then: read the pass/fail
> counts, and diff any failing file against `origin/main` before believing it.

### 7.3 Two live-data notes

- **Two Watchlist images are 404ing** — expired TikTok signed URLs (`x-expires` decodes to
  2026-07-12) stored in the DB. Pre-existing rot, not a rendering bug, and both degrade correctly
  (play placeholder; letter avatar + "Scrape failed — held back until a clean read"). Same class the
  corpus cover repair fixed before: TikTok oEmbed re-signs the same asset for free.
- **The `/api/discover` pricing is live in production**, so the Apify leak is closed on the money
  path, not just on a branch. Ordering verified in the merged source: `isSealedVisitor` → 403 fires
  **before** `creditGate`; the gate sits **after** the cache check so a warm repeat pull stays free;
  `billUsage` runs only on delivery.

### 7.4 What is left — the whole list, ranked

Nothing here is blocked; all of it is off `main` now.

1. **Schedule the crons — the only thing that makes Outliers a *feed*.** §3.2. The corpus is still
   frozen (newest video 2026-06-10); the UI is honest about it, but it is a library. ⚠️ Two traps
   that make this bigger than it looks: `refresh-corpus` is a **pure stub** returning
   `{status:"stubbed"}`, and Apify is on rotating FREE accounts with a **$5/mo hard cap** — this
   spends real money.
2. **Four Apify routes are still unmetered** — §3.3: `channels/ingest` (unlimited distinct handles),
   `profile`, `connected-accounts/connect`, `audiences/calibrate`. All invisible to the wiring
   guard, which scans `app/api/tools` only. Copy `72db51ea`'s shape **including the ordering**.
3. **Align the slot worktrees' vitest with trunk's** — §7.2. Cheap, and it restores a gate that is
   currently useless in three worktrees.
4. **§5.4 polish, still open** — kicker truncation on collection cards (§6.5 found the root cause:
   `truncate` on an inline `<span>` does nothing, it needs a block wrapper) · no cross-tab search
   hint ("12 in Collections") · the Watchlist "latest" strip clips its last card · Pull live still
   navigates away, because its results carry no covers (fix the cover gap first, not the layout).
5. **§3.5 smaller wins** — Save-to-Library from an outlier card (`saved_items.item_type` already has
   an unused `"outlier"` value) · `posted_at` backfill (⚠️ single migration via the SQL editor;
   `supabase db push` is UNSAFE here) · `/start`'s silently-capped outlier rail.

**Do not reopen §5.5** — the three tab names, in-place switching, the ≥100× exclusion, collections
sorted by views, and `/competitors` keeping the board are all owner-settled.
