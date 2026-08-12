# Handoff — Apify-first sourcing + composed output (2026-08-10)

**Branch:** `feat/apify-first-sourcing` · **HEAD:** `3e840ebf` · working tree CLEAN
**Status:** design + plan DONE and committed. **Zero implementation done.** Start at Task 1.

---

## 1. What the owner asked for

Three goals, stated in this order:

1. **Invert sourcing** — the 532-row `outlier_teardowns` corpus should become FALLBACK; live Apify
   scrapes should lead most requests.
2. **Give Qwen a workflow/tool system** so a creator can ask for anything ("find me 3 viral video
   formats that went viral for young startup founders", angles, an ad script) and Maven runs the
   right steps.
3. **Deliver richer in-thread UI output**, and move toward real video rather than text paragraphs.

Decomposed into three subsystems. Owner chose to spec the **workflow/output layer first**, but the
session went deep on sourcing because it turned out to be the blocker. Current split:

- **Phase 0** — measurement. ✅ DONE.
- **Phase 1** — sourcing (Apify-first + live decode + write-back cache). **Planned, not built.**
- **Phase 2** — output (`composed-card` + recipes). Designed in the spec, **no plan written yet.**
- **Phase 3** — agent loop / tool belt. **Not designed.** Needs its own spec.

---

## 2. Read these, in this order

| file | what it is |
|---|---|
| `docs/superpowers/specs/2026-08-10-apify-first-composed-output-design.md` | The design. 12 decisions (D1–D12), all measurements. **Read first.** |
| `docs/superpowers/plans/2026-08-10-apify-first-sourcing-phase1.md` | Phase 1 implementation plan. 7 TDD tasks with complete code. |
| `scripts/spike-slot-composer.ts` | Harness: can the model compose a card? Re-run in Phase 2. |
| `scripts/spike-free-subtitles.ts` | Harness: subtitle coverage + the multiplier instability demo. |

Owner's global prefs: terse, no filler, lead with the answer. Verify before claiming anything works.

---

## 3. What was MEASURED (do not re-derive; do not treat as assumption)

### 3.1 The model can compose cards — `scripts/spike-slot-composer.ts`

6 varied asks × 2 models, real DashScope, real pgvector over the real corpus.

| | qwen3.7-flash | qwen3.7-plus |
|---|---|---|
| emitted a card | 5/6 | 6/6 |
| schema-valid | 4/6 | 6/6 |
| **fabricated handles** | **0/6** | **0/6** |

flash's 2 failures: `compare` sent `cards` as a JSON **string** not an array (repairable by a
re-parse); `teardown` wrote prose and never called the tool. Neither is "flash can't compose."

**The important finding, which pass/fail hides:** BOTH models violate the card contract's hero rule.
flash wrote a *label* in every hero ("The Faceless Case Study"); on `hooks`, NEITHER model put the
actual hook line in the hero. All of it passed schema validation. `docs/subsystems/ui-skill-cards.md`
§0.5 names this exact bug. Hence spec D6: the deliverable is a **typed required field**, not free text.

### 3.2 Free subtitles work — `scripts/spike-free-subtitles.ts`

One real run, `clockworks/tiktok-scraper`, "startup founder", 20 results, $0.0750, 28s.

- **71% coverage** of real videos (12/17). 3 of the 8 misses are 0-second photo slideshows — no
  speech exists to miss.
- **12/12 VTT fetched AND parsed**, zero failures, avg 1195 chars.
- Recovered text is real hook material: *"So I made a huge mistake the last few months as a founder…"*

`DOWNLOAD_SUBTITLES` = free native only. `DOWNLOAD_AND_TRANSCRIBE_*` and `TRANSCRIBE_ALL_VIDEOS` are
AI-charged — **never use those**. Verified BOTH clockworks actors accept the param. The niche path
currently passes only `{searchQueries, resultsPerPage}`, which is why nothing gets subtitles today.

### 3.3 🔴 The multiplier is a WITHIN-SET statistic — a bug that SHIPS TODAY

`rankOutliers` (`src/lib/discover/outlier-compute.ts`) sets `baseline = median(views of the returned
set)`. Same real video (@corporate.bro, 1.4M views):

| N scraped | multiplier printed |
|---|---|
| 3 | **1.4×** |
| 6 | 7.3× |
| 10 | 11.9× |
| 20 | **28.4×** |

`/api/discover` and `/api/tools/explore` render `outlier-grid` tiles carrying these numbers **now**,
and `resultsPerPage` is caller-supplied. Task 1 of the plan fixes this.

**The fix is free.** `authorMeta` is already on every scraped row: `fans`, `heart` (lifetime likes),
`video` (post count). `likes ÷ (heart/video)` is stable at every N (5.7× at N=3, 6, 10 and 20),
computable on 20/20 rows. ⚠️ It is a **lifetime average of LIKES**, so its label is
**"vs their lifetime average"** — it may NEVER wear the corpus's `"vs their usual views"` (views, and
a median). One row reads 194.9× because that creator has 405 posts averaging 138 likes.

### 3.4 Apify cannot filter outliers, and quality needs a two-stage scrape

All 32 actor params checked. `leastDiggs`/`mostDiggs` are **absolute** like floors; an outlier is
**relative**. No scraper can express it — an outlier threshold is applied by us, post-scrape.

The naive keyword search returns junk (a 99-view post; a clip transcribing as *"okay bye bye love
you…"*). Fix is **two-stage** (spec D12):

1. `searchSection: "/user"` + `maxProfilesPerQuery` → real creators, not caption matches
2. `profiles: [handles]` + `excludePinnedPosts: true` + `profileSorting: "latest"` +
   `downloadSubtitlesOptions: "DOWNLOAD_SUBTITLES"` → their recent posts

**Stage 2 also gives the TRUE denominator for free** — the median views of one creator's own posts is
exactly the corpus's `"vs their usual views"` basis. So the paid "upgrade path" becomes the default.

Charged filters to use sparingly: `videoSearchSorting`, `videoSearchDateFilter`, `shouldDownloadVideos`.
`profileSorting: "latest"` is free and covers recency.

### 3.5 Apify account — the release gate

`arcuate_azurite` · **FREE** · **$2.93 / $5.00** used · cycle resets **2026-08-20**.
Measured **$0.0513/run** average, 28–135s per run.

- **Development is fine:** ~27 runs left; Task 7 needs 2.
- **Production is NOT:** ~97 scrapes/month total across all users. **A paid plan gates SHIPPING
  Phase 1, not building it.** This is a purchase decision the owner has not yet made.
- ⚠️ At the cap, Apify 403s and the app disguises it as *"check your handle is public"*. Check the
  ACCOUNT before debugging any scrape failure.

---

## 4. Architecture decided (spec has full rationale)

**Sourcing:** two-stage scrape → per-author multiplier → decode from free VTT + caption + metrics on
`qwen3.7-flash` → **write the decode back to `outlier_teardowns`**. The corpus becomes a
**self-filling cache of decodes**, not a static library. Each video decoded once, ever — that is what
bounds the cost. Corpus serves only when a scrape yields nothing, and that fallback must be VISIBLE.

**Why a live decode is needed at all:** Apify returns METRICS; the corpus stores the DECODE
(`hook_archetype`, `format`, `teardown`, `why_it_works`), produced offline by `scripts/build-corpus.ts`.
No live path emits a single structural field. **A format IS a decode**, so "find me 3 viral formats"
cannot be answered by a scrape alone. Building that decode step is the real work of Phase 1.

**Output (Phase 2, designed not planned):** one `composed-card` block whose props are a validated slot
tree — the model picks WHICH slots and their content; the design system owns every pixel; `actions` is
a closed enum so nothing that spends a credit is model-authored. Receipts are **materialized
server-side from a row id**, making fabrication structurally impossible rather than merely absent.
~10 slot kinds + a recipe registry. `proof_strip` plays real video by reusing
`src/components/reading/retention-scrubber.tsx` (a real player with a keyframe-flipbook degrade) —
**there is no `<video>` anywhere in `src/components/thread/**` today**, every "video" is a `CoverFill`
thumbnail with a drawn play glyph.

**Model tier:** owner chose *build the fixes (typed deliverable + recipes + arg repair), then re-run
`spike-slot-composer.ts` and let the measurement decide flash vs plus.* Do not pay 10× on a guess.

---

## 5. How to resume

Branch `feat/apify-first-sourcing` is checked out at `3e840ebf`, tree clean.

Execute `docs/superpowers/plans/2026-08-10-apify-first-sourcing-phase1.md` — 7 tasks, TDD, each with
complete test and implementation code:

1. Per-author baseline + multiplier (pure) — **fixes §3.3 on its own, zero dependencies**
2. Carry `authorMeta` through the scrape boundary (`VideoData.author`)
3. Subtitle VTT fetch + parse
4. Two-stage creator search + free subs on the post scrape
5. Live decode from transcript + caption + metrics
6. Write-back cache (needs a unique index on `platform_video_id` — Task 6 Step 3 checks)
7. One real end-to-end run (checks the Apify balance FIRST)

An SDD workspace + ledger exists at
`.superpowers/sdd/2026-08-10-apify-first-sourcing-phase1/` (git-ignored) with `task-1-brief.md`
already extracted. Ignore it if not using subagent-driven execution.

### Repo gotchas that will cost you time

- **Run vitest as `node node_modules/vitest/vitest.mjs run <path>`** — npx output is wrapped and
  swallowed here. Same for tsx: `node node_modules/tsx/dist/cli.mjs` (`.bin/tsx` is a shell wrapper
  and fails under `node`).
- **`npx tsc --noEmit` before every commit.** A green Vercel check is not a build; vitest does not
  typecheck.
- **The post-commit hook AUTO-PUSHES.**
- **`supabase db push` is UNSAFE here** (migration-ledger drift) — single migrations via the SQL editor.
- Supabase project: `qyxvxleheckijapurisj`. Table `outlier_teardowns` uses `creator_handle`,
  **not** `handle`.
- Scripts needing `.env.local` must run from the repo root and load dotenv themselves.

---

## 6. Open decisions the owner still owes

1. **Paid Apify plan** — gates SHIPPING Phase 1 (§3.5). Not needed to build.
2. **D9 basis** — spec says niche pulls use `"vs their lifetime average"` unless a profile scrape
   supplies the views median. Owner has seen this and not objected, but it changes a number that
   Explore renders today.
3. **Phase 2 has no plan yet** — the spec covers it; writing-plans has not been run for it.
4. **Phase 3 (agent loop / tool belt) has no spec** — this was the owner's original #1 priority and
   is still undesigned. It is where "the creator can ask for anything" actually gets delivered.
