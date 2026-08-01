# Handoff — Discover rework: audit, direction, and the sketch awaiting feedback

**Date:** 2026-08-01 · **Worktree:** `~/virtuna-slot-c` · **Base:** `origin/main` `96ccff5b`
**Status:** audit complete · direction owner-approved · **sketch built, awaiting owner feedback**
**Nothing in `src/` has been touched.**

---

## 0. What the next session is for

The owner has feedback on the sketch at `docs/mockups/discover-rework-2026-08-01.html`.
**Open it first** (`open docs/mockups/discover-rework-2026-08-01.html`), take the feedback, iterate
the sketch, and only then build. §6 is the build plan once the sketch is signed off.

---

## 1. The complaint, and what was actually wrong

Owner: *"the discover page … at the moment its just scattered tabs with no good ui, ux, user value
and user flow."*

The tabs were real (six: Watching · Trending · Competitors ┃ Channels · Hooks · Pull), but the
layout was downstream of the real problem: **most of what the surface promised had no data behind
it, and the best content in the product had no surface at all.**

### 1.1 What Discover renders today — `scraped_videos`, 7,438 live rows

| Column the UI depends on | Coverage | Consequence |
|---|---|---|
| `outlier_multiplier` | **49** (0.7%) | Trending shows no outlier signal. Only `lib/channels/ingest.ts` writes it. |
| `primary_niche` | **0** | `feed-query.ts:172` falls back to the literal string `"Trending"` — **every** tile's creator line reads "Trending". |
| `posted_at` | **49** | "Most recent" returns 49 rows corpus-wide; "posted within N" empties the grid; no tile shows a date. |
| `metadata.cover_url` | **104** (1.4%) | Rows 1–24 have 23 covers; first 500 have 60. A cliff, under infinite scroll 7,438 deep. |

- Newest post in the corpus: **2026-02-11**. Last ingest: **2026-07-13**. "Trending" is a six-month-old archive.
- `scrape-trending`, `calculate-trends`, `refresh-competitors` exist as routes but are **not in
  `vercel.json`'s `crons`** (only `sync-whop`, `delete-retained-videos`, `sweep-orphan-videos` are).
  Nothing refreshes.
- **1 of 45 users** has tracked channels (5 rows); **2 of 45** have competitors (4). Watching is the
  landing tab and it is empty for ~98% of accounts.
- The dates *do* exist — `metadata.uploaded_at` on **7,272** rows, plus `followers` (4,050) and
  `bookmarks` (6,844). `feed-query.ts` reads none of them.

### 1.2 IA and craft defects (all verified live, signed in, at 1440px)

- **The one invariant the code claims is broken.** Three comments in `channels-client.tsx`,
  `hooks-client.tsx` and `discover-client.tsx` say the tool tabs mirror the hub "so the tab bar
  doesn't jump position." Measured: `[role=tablist]` top is **62px** on Watching/Trending/Competitors
  and **78px** on Channels/Hooks/Pull — a 16px jump on every crossing, because the tool tabs carry a
  mono subtitle the hub doesn't. The `<h1>` also changes identity: "Discover" → "Channels"/"Hooks"/"Pull".
- **Nested tab bars.** `/feed/channels` renders **10** `role="tab"` elements (6 hub + 4 panel);
  `/feed?tab=competitors` renders **8** (6 + Grid/Table).
- **Channels and Competitors are the same object stored twice** — `tracked_accounts` vs
  `user_competitors`→`competitor_profiles`. `chrisbumstead` sits in one, `cbum` in the other.
- **Every competitor card reads `Updated 3w agoScrape failed`** (missing space); all 6
  `competitor_profiles` rows are `scrape_status = 'failed'`.
- **`modernmillie` renders as `elmakbtn915 · 0 followers · 0 views`** with a blank avatar — a failed
  profile scrape written straight through to the watchlist.
- **Hooks was 12 hardcoded templates** whose multipliers/views are, per `default-hooks.ts`'s own
  comment, *"static illustration"* — rendered in the same green ▲ pill as the real measured
  multipliers two tabs over, sorted by "Biggest outlier", with a working CSV Export.
- Two tile components for the same object in one hub (`FeedCard` vs `OutlierTile`). Pull's idle state
  is ~85% empty dotted void. Competitors is 3 cards over 75% empty canvas.

### 1.3 Money leak — **fix this whatever else changes**

`POST /api/discover` (the Pull tab) runs a 30-video Apify scrape with **no credit gate**. The same
live-scrape action bills **5 credits** as `explore_scrape`; `/api/account-read` bills 5. Its only
limiter, `DISCOVER_DAILY_CAP = 20`, lives in a module-level `Map` in `lib/discover/discover-cache.ts`
— resets every serverless cold start, never shared across instances (the file's own header admits
it). Apify is on rotating FREE accounts with a **$5/mo hard cap**.

**Why the guard was green:** `lib/billing/__tests__/route-wiring.test.ts` checks a hardcoded
`PAID_ROUTES` list that names `account-read/route.ts` but **not** `discover/route.ts`. Same failure
as `docs`-recorded "guard scanned one directory" — suspect the guard's *premise*, not its assertions.

---

## 2. The find that changed the plan

**`outlier_teardowns` + `teardown_collections` — the grounding corpus — is the best content in the
product and NO user-facing surface renders it.** It reaches the *model* only
(`lib/grounding/corpus-tool.ts` search tool, `components/thread/corpus-references-block.tsx`).

| | `scraped_videos` (what Discover shows) | `outlier_teardowns` (what it should) |
|---|---|---|
| Rows | 7,438 | **532** (524 `status='extracted'`, 8 failed) |
| Covers | 104 (1.4%) | **532 (100%)** — 516 durable (494 rehosted to Supabase storage + 22 ytimg) |
| Real multipliers | 49 (0.7%) | **396 (74%)**, all `baseline_label = 'vs their usual views'` |
| `posted_at` | 49 (0.7%) | **532 (100%)** |
| Taxonomy | none | 4 categories + 15 subcategories (below) |
| Per row | caption | `hook_template`, `spoken_hook`, `why_it_works`, `idea`, `template`, `teardown` |

**⚠️ The collections already exist — do NOT derive them from the taxonomy columns.**
`teardown_collections` (592 rows) is the curated mapping: `teardown_id`, `category`, `subcategory`,
`name`, `slug`, `family_slug`, `collection_uuid`.

| category | collections | memberships | subcategories |
|---|---|---|---|
| `formats` | 22 | 235 | — |
| `visual_hooks` | 47 | 160 | Subject Motion · Visual Effect // Transitions · Pattern Interrupt // Visual Switching · Graphic/Text Overlay · Visual Selection |
| `editing_styles` | 30 | 143 | In-World (Vlog) · Studio/Set · Faceless · In-World (Skit) · Greenscreen · Other |
| `signature_series` | 6 | 54 | — |

**105 collections. All 532 teardowns belong to ≥1.** The owner's Sandcastles reference screenshots
**are this data** — "About Me · 11 videos" and "Case Study / Breakdown · 9 videos" match our rows
exactly. The first sketch pass derived 82 collections from the `outlier_teardowns` columns instead
and produced a worse, different set. **Read the table.**

---

## 3. Owner's decisions (2026-08-01) — all settled, don't re-litigate

1. **Scope:** IA rework **+ data backfill**. **No new scraping spend** (Apify has ~$3.40 left).
2. **Hooks tab → collections** over the grounding corpus, "same as sandcastles ai did" (two reference
   screenshots supplied: a collection-card grid, and hook rows with real thumbnails + category chip +
   multiplier + views).
3. **Channels + Competitors → merged** into one Sources concept.
4. **NO TABS.** One scrolling page of shelves. *(Owner: "the tabs dont really make sense.")*
5. **Archive hidden** — the 7,438 rows stay in the DB and stay available to engine retrieval, but no
   shelf points at them. Nothing of user value is lost.

---

## 4. The sketch — what is built and awaiting feedback

**`docs/mockups/discover-rework-2026-08-01.html`** (400KB, standalone, real data, real covers).
Regenerate from live data with:

```bash
node scripts/discover-sketch/fetch-corpus.mjs   # → .scratch/corpus.json (needs .env.local)
node scripts/discover-sketch/build-sketch.mjs   # → docs/mockups/discover-rework-2026-08-01.html
```

**Layout — one page, no tabs:**

```
Discover
524 torn-down videos · 105 collections · 408 creators · 285 clear the 3× proof bar
[ Search proven videos, formats, hooks — or paste a @handle ]  [Pull live · 5 credits]

FROM CREATORS YOU WATCH   8 recent outliers · 5 creators      Manage sources →
  ← horizontal track of video cards, max 2 per creator →

FORMATS          The shape of the whole video.                   See all 22 →
VISUAL HOOKS     Subject Motion · Pattern Interrupt · …          See all 47 →
EDITING STYLES   Studio/Set · Faceless · Greenscreen · …         See all 30 →
SIGNATURE SERIES Repeatable formats a creator owns.              See all  6 →
```

- **Pull is an input, not a tab.** Search filters every shelf instantly and free; `Pull live` lights
  up only for a handle/URL not already held, and states the 5-credit cost before you press it.
- **Sources is a link**, not a tab — `Manage sources →` in the header of the shelf it configures.
- **Drill into a collection** → the reference's hook rows: thumbnail · `hook_template` ·
  "Inspired by @handle" · archetype chip · multiplier · views · `Remix →`.
- Empty watchlist → an "Add a creator" invitation sitting *above* 105 real collections, rather than
  a dead landing tab.
- All cards share a 161px cover height so every shelf has one rhythm. At 9:16 the watch shelf ran
  306px tall and swamped the library it exists to introduce.
- Max **2 videos per creator** on the watch shelf — unpicked, @khaby.lame held 6 of 8 slots.

### 4.1 Honesty rules the sketch already implements — reuse, don't re-roll

From `lib/grounding/`: `honestMultiplier()` + `hasKnownBaseline()` (`retrieve.ts`), `receipt()` +
`fmtMultiplier()` (`prompt.ts`), `MIN_OUTLIER_MULTIPLIER = 3` (`outlier-gate.ts`).

- **No baseline label → no number.** 136 of 532 rows have neither; they render `curated` and make no claim.
- Multiplier shown only when `>= 1` (below 1× the video underperformed its own account).
- `proven` = baselined **and** `>= 3×`.

### 4.2 ⚠️ The one product decision made without the owner — needs a ruling

Multipliers in the corpus run to **20,154×** (median **8.0×**; 56 of 396 exceed 100×). These are
thin-baseline artifacts — a creator whose "usual" was ~1k and one post hit millions. Two changes were
made on the assistant's judgement and the owner has **not** ruled on them:

1. **Collections sort by `views`, not by multiplier.** Sorting by ratio put the least trustworthy
   rows at the top of every collection.
2. **Three-state multiplier chip:** green `▲ 16.2×` (proven, 3–100×) · neutral `3235× ⚠` (real but
   thin-baseline) · neutral `curated` (no baseline).

This diverges from shipped `fmtMultiplier`, which prints `3235×` flat. Defensible — a prompt is not a
card someone judges at a glance — but **it is the owner's call.**

### 4.3 Known sketch artifacts (not bugs to chase)

- One card in the watch shelf shows a broken image: one of the **11 non-durable covers**
  (8 signed-TikTok now 403, 3 `gs://` which are not fetchable at all). In the build this falls back
  to the designed caption poster `FeedCard` already has.
- The sketch bakes its data in at build time; it is a mockup, not wired to any API.

---

## 5. Verification recipe used (reuse it)

Signed-in verification **works**. `e2e/auth.setup.ts` was not used; the cookie was minted directly:

```bash
node .scratch/shoot-discover.mjs   # (regenerate: see the recipe in memory `signed-in-verification-recipe`)
```

POST `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password` with `apikey` + `Bearer <ANON>`,
then write `sb-<projectRef>-auth-token` = `'base64-' + base64url(JSON.stringify(session))`, chunked at
3180 chars, `domain: 'localhost'`, `secure: false`. Credentials are in `.env.local`
(`E2E_USER_EMAIL` / `E2E_USER_PASSWORD`).

**Traps hit this session:**
- Dev server: `NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev -p 3003`.
  `npm run dev` OOMs; the `npx` wrapper eats output.
- A stale Turbopack cache referencing a **deleted** `/zz-preview/page` route caused a `FATAL` panic
  mid-run. `rm -rf .next` and restart.
- Never `waitUntil: 'networkidle'` — the HMR socket never settles. Use `domcontentloaded` + an
  explicit selector wait.

---

## 6. Build plan — only after the sketch is signed off

1. **`posted_at` backfill** from `metadata.uploaded_at` (7,272 rows). Single migration via the
   Supabase SQL editor — **`supabase db push` is UNSAFE here** (48 local-only / 41 remote-only
   migrations; it would recreate `threads`).
2. **Read layer** over `teardown_collections` → `outlier_teardowns`: a collections index query
   (category → collections with counts, proven counts, 4 cover URLs) and a collection-detail query.
   Reuse the `lib/grounding` honesty helpers at the boundary; do not re-implement them.
3. **The shelf surface** replacing `DiscoverHub` and its six tabs. Retire or redirect `/feed/hooks`,
   `/feed/channels`, `/feed/discover`; keep `/discover` and `/competitors` redirects alive.
4. **Merge Sources** — reconcile `tracked_accounts` with `user_competitors` (the `cbum` /
   `chrisbumstead` duplicate). Competitors' deep pages (`/competitors/[handle]`, `/compare`) stay,
   reachable from a row. Hold back profiles whose scrape failed rather than rendering
   `elmakbtn915 · 0 followers`.
5. **Price `/api/discover` at 5 credits AND add `discover/route.ts` to `PAID_ROUTES`** in
   `route-wiring.test.ts` — the missing entry is *why* it ran free.
6. Delete `lib/hooks/default-hooks.ts` and `hooks-client.tsx` once collections replace them.

**Gates before merge:** `node ./node_modules/typescript/bin/tsc --noEmit` ·
`node ./node_modules/vitest/vitest.mjs run` (never `npm test` — it prints a fake PASS) ·
a prod build · **and visual verification signed in, BEFORE merging.**
⚠️ **Merging to `main` IS deploying** — production builds ~3s after the merge and there are no
preview URLs. A green Vercel check on a PR is **not** a build (`ignoreCommand` skips and posts success).

---

## 7. Files this session touched

| Path | Status |
|---|---|
| `docs/mockups/discover-rework-2026-08-01.html` | new — the sketch |
| `scripts/discover-sketch/fetch-corpus.mjs` | new — dumps live data to `.scratch/corpus.json` |
| `scripts/discover-sketch/build-sketch.mjs` | new — renders the sketch from that JSON |
| `docs/HANDOFF-2026-08-01-discover-rework.md` | new — this file |
| `src/**` | **untouched** |

Memories written: `discover-corpus-is-invisible`, `discover-pull-is-ungated`.
