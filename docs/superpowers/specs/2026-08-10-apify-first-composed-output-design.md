# Apify-first sourcing + composed card output — design

**Date:** 2026-08-10
**Status:** design agreed in session; not implemented
**Scope:** Phases 0–2 (measurement · sourcing · output). The agent loop / tool-belt rework is
**Phase 3 and gets its own spec** — it is a separate subsystem and folding it in here would produce
a document too large for one implementation plan.

---

## 1. The problem

Two owner goals, one session:

1. **Sourcing is inverted.** The 532-row `outlier_teardowns` corpus is what the creator SEES —
   its creators, its numbers, its videos. It should be fallback. Live Apify scrapes should lead.
2. **Output is bland.** Maven answers open-ended asks in prose. The creator should be able to ask
   for anything ("3 viral formats for young startup founders", angles, an ad script, a comparison)
   and get a rich in-thread card carrying real, playable video proof.

### 1.1 Why "flip the priority" is not a config change

Apify and the corpus do not return the same kind of thing.

| | returns |
|---|---|
| Apify scrape (`RankedOutlier extends VideoData`) | views, likes, shares, multiplier, caption, coverUrl — **metrics** |
| Corpus (`outlier_teardowns`) | `hook_archetype`, `format`, `spoken_hook`, `hook_template`, `teardown`, `why_it_works` — **the decode** |

The corpus decode was produced **offline** by a batch pipeline (`scripts/build-corpus.ts` →
`scrapeRawToCache` → `bucketAndPersist` → `scripts/embed-corpus.ts`). No live path emits a single
structural field — verified across `/api/discover`, `/api/tools/explore` and `outlier-compute.ts`.

A *format* IS a decode. So "find me 3 viral formats" cannot be answered by a scrape alone: it would
return three thumbnails with big numbers and nothing explaining the shape. **Apify-first therefore
requires building a request-time decode step that does not exist today.** That is the real work of
Phase 1.

---

## 2. What was measured (evidence this design rests on)

### 2.1 Composition spike — `scripts/spike-slot-composer.ts`

6 varied asks × 2 models. Real DashScope, real pgvector over the real corpus. Output in `.spike-out/`
(gitignored). This script is retained as the **regression harness** for Phase 2.

| | qwen3.7-flash | qwen3.7-plus |
|---|---|---|
| emitted a card | 5/6 | 6/6 |
| schema-valid | 4/6 | 6/6 |
| searched corpus unprompted | 6/6 | 6/6 |
| **fabricated handles** | **0/6** | **0/6** |
| avg prose | 61 chars | 144 chars |

Both models compose multi-slot trees, get card counts right, and keep prose to a line. Across all
31 printed receipts: zero fabricated handles, correct handle↔multiplier pairing (verified by SQL
against prod), and the correct basis label `"vs their usual views"`.

**Three failures that shape the design:**

1. **The hero rule fails on both models.** flash wrote a *label* in every hero ("The Faceless Case
   Study", "The 'Spite' Angle"). plus wrote real sentences. On the `hooks` case **neither** put the
   actual hook line in the hero. Every one of these passed schema validation. This is the exact bug
   `docs/subsystems/ui-skill-cards.md` §0.5 names: *"If your card's payoff is a sentence, that
   sentence is the hero — not a label, not a name."*
2. **flash `compare`** sent `cards` as a JSON **string** instead of an array — the classic
   double-encode, recoverable by a repair pass.
3. **flash `teardown`** wrote prose and never called the tool.

Failures 2 and 3 are "the model didn't reach for an unusual slot", not "the model can't compose".

### 2.2 The 50× band leaks (a pipeline defect, not a model one)

Measured against prod (`outlier_teardowns`, 532 rows):

| rows | band |
|---|---|
| 136 | no multiplier |
| 108 | < 3× |
| **211** | **3–50× (printable)** |
| 46 | 50–200× |
| 31 | > 200× (max **20,154×**) |

Retrieval serves the 77 out-of-band rows, so **11 of 31 receipts the spike printed were above the
band**, including 490× four times. The model copied faithfully; the pipeline handed it a number that
reads as broken.

### 2.3 Free transcripts are already plumbed

`VideoData.subtitleUrl` is a **free native TikTok WEBVTT URL** (no auth), already extracted by
`remapClockworksVideo` (prefers English `tiktokLink`). It is populated only when the actor input
carries `downloadSubtitlesOptions: "DOWNLOAD_SUBTITLES"` — which today only
`scrapeProfileBundle` passes. The niche/search path passes only
`{ searchQueries | profiles, resultsPerPage }`.

**Verified against the Apify actor input schemas: BOTH `clockworks/tiktok-scraper` and
`clockworks/tiktok-profile-scraper` accept `downloadSubtitlesOptions`.** The provider notes it is
the free tier — *"FREE native subs only. AI-transcribe costs extra."*

This matters because `qwen3.7-flash` is **sighted but DEAF** (`client.ts`): it accepts text, image
and video, but audio enters only through `QWEN_OMNI_MODEL`. Native subtitles deliver the spoken
words as text, so the deafness stops mattering for decoding.

### 2.4 The app can already play video

13 `<video>` sites exist, notably `src/components/reading/retention-scrubber.tsx` — a real
playhead-driven player that **degrades to a keyframe flipbook when no source resolves** — and
`src/components/offer/media-slot.tsx`. None are in `src/components/thread/**`, where every "video"
is a `CoverFill` thumbnail with a drawn play glyph.

So a playable proof tile **reuses a proven component**; it is not new work.

### 2.5 Apify account state and measured per-run cost

`arcuate_azurite` · **FREE plan** · **$2.88 of $5.00** used · cycle ends 2026-08-20.

Measured across the 19 most recent runs on this account:

| | |
|---|---|
| avg cost of a SUCCEEDED run | **$0.0513** |
| range | $0.0043 – $0.075 |
| wall-clock duration | **28–135s** (avg ~66s) |

**Development is not blocked:** $2.12 remaining ÷ $0.0513 ≈ **41 runs**, and the cycle resets
2026-08-20. Phase 0 needs one.

**Production is blocked:** $5.00/month ÷ $0.0513 ≈ **97 scrapes per month across all users
combined** — roughly 3 requests a day for the entire product before every scrape 403s and the
product falls back to the corpus permanently.

**Latency consequence:** a scrape costs 28–135s *before* decoding. Any Apify-first request is a
minute-plus wait, so it must present through the run capsule (§0.8 of `ui-skill-cards.md`) with
"Scraping…" as a REAL step — the Self-judge rule forbids a fictional one.

### 2.6 Phase 0 RESULTS — measured 2026-08-10 (`scripts/spike-free-subtitles.ts`)

One real run: `clockworks/tiktok-scraper`, `searchQueries: ["startup founder"]`, `resultsPerPage: 20`,
`downloadSubtitlesOptions: "DOWNLOAD_SUBTITLES"`. **20 items, 28s, $0.0750.**

**Free-subtitle coverage — D3 is viable:**

| | |
|---|---|
| carried a native subtitle URL | 12/20 (60%) |
| VTT fetched **and parsed to text** | **12/12 — zero failures** |
| coverage among videos with duration > 0 | **12/17 (71%)** |
| avg transcript length | **1195 chars** |

Three of the eight misses are **0-second photo slideshows** — no speech exists to miss. The five
genuine misses are short clips (8s, 10s, 12s, 15s, 71s), consistent with music-only or text-only posts.

The recovered text is exactly what a decode needs — e.g. *"So I made a huge mistake the last few
months as a founder…"* (personal-failure open) and *"The next trillion dollar company is not going to
be software. It's going to be this instead."* (contrarian open).

### 2.7 🔴 The multiplier is scrape-size dependent — a PRE-EXISTING production defect

`rankOutliers` sets `baseline = median(views of the returned set)`, so the multiplier is a
**within-set statistic**. Measured on the same real video (@corporate.bro, 1.4M views) from the run
above:

| N scraped | baseline | multiplier printed |
|---|---|---|
| 3 | 972,300 | **1.4×** |
| 6 | 191,950 | 7.3× |
| 10 | 117,250 | 11.9× |
| 20 | 49,350 | **28.4×** |

**The same video earns 1.4× or 28.4× purely from how many siblings were requested.** This is not a
new risk introduced by this design — `/api/discover` and `/api/tools/explore` already render
`outlier-grid` tiles carrying these numbers, so the defect ships today, and `resultsPerPage` is a
caller-supplied value.

**A date filter corrupts it further.** Filtering to `PAST_WEEK` and then taking the median of those
rows means "vs their usual" really means "vs their last week".

### 2.8 THE FIX — a per-author denominator, free, already in every row

Apify **cannot** filter for outliers, in principle: `leastDiggs`/`mostDiggs` filter on an *absolute*
like count, and an outlier is *relative* to a creator's own baseline. Checked all 32 actor params.

But `authorMeta` is already present on every scraped row and carries `fans`, `heart` (lifetime
likes) and `video` (post count). So **`heart ÷ video` = that author's lifetime average likes per
post** — a per-author denominator that costs nothing and does not move with scrape size.

Measured on the same run's data (@corporate.bro):

| N scraped | result-set median (current) | **`vs own avg` (proposed)** | `vs followers` |
|---|---|---|---|
| 3 | 1.4× | **5.7×** | 3.4× |
| 6 | 7.3× | **5.7×** | 3.4× |
| 10 | 11.9× | **5.7×** | 3.4× |
| 20 | 28.4× | **5.7×** | 3.4× |

Stable at every N, computable on **20/20 rows**.

**Consequence: scrape breadth becomes a pure product choice again.** Wanting 3 cards means scraping
~6 (headroom for undecodable posts), not 20. The earlier "scrape wide for an honest median"
requirement is **withdrawn** — it was compensating for a broken denominator rather than fixing it.

**Two honest limits, which the label must respect:**

1. `heart/video` is a **lifetime average, not a recent median**. A creator who has improved is
   flattered by their own weak back catalogue (@techwitbrianx reads 194.9× against a 405-video
   history averaging 138 likes).
2. It is **likes-based**; the corpus multiplier is views-based. It therefore CANNOT wear the corpus's
   `"vs their usual views"` label. Its honest label is **"vs their lifetime average"**.

For the true views-based basis, profile-scrape the creators actually being decoded (~$0.05 each) and
take the median views of their recent posts — the corpus's exact basis. That is the upgrade path,
not the default.

---

## 3. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Apify leads every request that needs **real-world video evidence** (formats, outliers, what's working, a named creator or niche, a comparison of real approaches). Asks that need no evidence — refining the creator's own draft, a hooks pack on a subject they gave — do not scrape. The corpus is consulted only when a scrape was warranted and yielded nothing | The owner goal, stated twice. Scoped to evidence-bearing asks so a draft refinement does not fire a minutes-long scrape |
| D2 | Decodes are **written back** to `outlier_teardowns`; the corpus becomes a self-filling cache, not a static library | Bounds cost: each video is decoded once, ever |
| D3 | Decode reads the **free subtitle VTT + caption + metrics** on flash by default; omni-flash only when the question is about delivery/tone | Removes the per-request video-token cost from the common path |
| D4 | Displayed multipliers are **clamped to `50×+`** above the band | Keeps all 77 out-of-band rows usable as proof while never printing a number that reads as broken |
| D5 | A video with no native subs escalates to flash-reads-frames; if that yields nothing it may appear as **proof** but never becomes a **format card**. A `durationSeconds === 0` post (photo slideshow) skips the subtitle step entirely — it has no speech by definition, so it goes straight to visual decode | A format card asserts a decode; an undecoded video cannot back that claim. Measured coverage is 71% of real videos (§2.6), so ~1 in 4 takes this path |
| D9 | **The multiplier is computed per AUTHOR, never from the result set.** Default basis is `likes ÷ (authorMeta.heart / authorMeta.video)`, labelled **"vs their lifetime average"** — free, in every row, stable at any scrape size (§2.8). The views-based `"vs their usual views"` basis requires a per-creator profile scrape and is an on-demand upgrade, used only for creators actually being decoded. Never print a bare multiplier without its basis label | §2.7 — the same video prints 1.4× or 28.4× depending on `resultsPerPage`. §2.8 — a per-author denominator is stable and costs nothing. The two bases measure different things (likes vs views) and must be labelled apart |
| D12 | **Scraping is TWO-STAGE: find creators, then read their posts.** Stage 1 `searchSection: "/user"` + `maxProfilesPerQuery` → real creators in the niche. Stage 2 `profiles: [handles]` + `excludePinnedPosts: true` + `profileSorting: "latest"` + `downloadSubtitlesOptions` → their recent posts. This makes D9's views-based `"vs their usual views"` the DEFAULT basis (the median of one creator's own posts), not a paid upgrade — so the free `heart/video` proxy is only the fallback when a profile scrape is unavailable | A keyword video-search matches caption text, not people: the Phase 0 run returned `@its_deepss` (*"okay bye bye love you…"*) and a 99-view post. `videoSearchSorting`/`videoSearchDateFilter` are charged AND only valid on `/video` search, so profile-first avoids them; `profileSorting: "latest"` is free. Costs 2 runs (~$0.13) and fixes quality + basis together |
| D11 | **Scrape breadth = what the request needs + headroom** (≈6 scraped for 3 cards), NOT a wide sample. Apify cannot filter on outliers at all (checked all 32 params); `leastDiggs` is an absolute like floor and may be used to raise candidate quality, but it is charged and cannot express "10×" | D9 removes the reason to scrape wide. An outlier threshold is applied by us post-scrape |
| D10 | Scrape config is exposed to the model as **tool parameters** (`date_filter`, `sorting`, `results`), but each Apify-charged filter is marked as such in the tool schema, and an outlier threshold ("only 10×+") is applied **post-scrape by us** — it is not an Apify capability | The actor marks `videoSearchDateFilter` / `videoSearchSorting` / `shouldDownloadVideos` as "Optional charged filter"; no outlier filter exists at all |
| D6 | The card's payoff is a **typed required field**, not a free-text `hero` | §2.1 finding 1 — the rule cannot be delegated to the model |
| D7 | Receipts are **materialized server-side from a row id**; the model never authors numbers | Moves fabrication-safety from empirical (0/31, luck) to structural |
| D8 | The renderer sorts slots into contract spine order; model order is ignored | §0.5: *"may omit a row it has no data for; may not reorder them"* |

---

## 4. Architecture

### 4.1 Phase 1 — Sourcing

```
ask ──► STAGE 1  searchSection:"/user" + maxProfilesPerQuery   (D12)
          │      → real creators in the niche, not caption matches
          ▼
        STAGE 2  profiles:[handles] + excludePinnedPosts:true
          │      + profileSorting:"latest"
          │      + downloadSubtitlesOptions:"DOWNLOAD_SUBTITLES"
          ▼
        baseline = median views of THAT creator's own posts  (D9, true basis)
          │
          ▼
        rank by PER-AUTHOR multiplier (never the result set)
          │
          ▼
        for the top 3 of ~6 scraped:  cache hit? ──yes──► reuse stored decode
          │ no
          ▼
        DECODE (new)  ── VTT + caption + metrics ──► flash
          │              (escalate to frames, then omni-flash, per D3/D5)
          ▼
        write back to outlier_teardowns  ──► corpus grows
          │
          ▼
        compose (Phase 2)
```

**Scrape breadth / decode depth.** Scrape **roughly double what the request needs** (≈6 for 3 cards)
— headroom for posts that turn out undecodable (no subs, 0-duration slideshow, decode failure), not
for statistical reasons. Per D9/§2.8 the multiplier no longer depends on scrape size, so breadth is a
product choice. Decoding is the real cost; decode exactly what will be shown.

**New module: `src/lib/decode/live-decode.ts`.** One video in → the structural fields
`outlier_teardowns` already stores. Reuses the existing decode contract from
`src/lib/engine/remix/decode-prompts.ts` (`hook_pattern` · `structure_pacing` · `the_turn` ·
`emotional_beat`) so live decodes and corpus rows are the same shape by construction.

**Changed:** the discover/explore actor input gains `downloadSubtitlesOptions`. A VTT fetch+parse
helper is new (the URL is stored today but never read).

**Fallback is visible, never silent.** When the scrape returns nothing — bad niche, private account,
or the Apify cap — the card falls back to corpus rows and **says so**. A capped account currently
masquerades as *"check your handle is public"*, which cost a merge gate on PR #411.

### 4.2 Phase 2 — Output

One new block type, `composed-card`:

```ts
{ type: "composed-card", props: {
    recipe:      RecipeId,
    eyebrow?:    string,
    deliverable: { kind: "line" | "claim" | "name", text: string },  // D6
    receiptRef?: string,        // a teardown row id — server materializes the numbers (D7)
    why?:        string,
    body:        Slot[],
    disclosure?: Slot[],        // enforces the contract's ONE disclosure
    actions?:    ActionId[],    // closed enum — nothing that spends a credit is model-authored
}}
```

**Slot vocabulary (10):** `proof_strip · beats · stat_row · bullets · quote · label_values ·
script_timeline · comparison · chips · note`.

**Recipe registry** — each declares its required deliverable kind, legal slots, and card count. The
recipe *is* the validation schema, which is what fixes §2.1 failures 2 and 3 without a larger model:

| recipe | deliverable | shape |
|---|---|---|
| `hook-set` | `line` | receipt · 3–5 cards |
| `format-set` | `claim` | proof_strip + beats |
| `angle-set` / `idea-set` | `claim` | beats |
| `script` | `claim` | script_timeline |
| `comparison` | `claim` | comparison + bullets |
| `teardown` | `claim` | proof_strip + beats |
| `brief` | `claim` | fallback |

**`proof_strip` renders playable video** by reusing `retention-scrubber`'s player and its
keyframe-flipbook degrade (§2.4).

**Arg repair:** before validation, a `cards` value arriving as a string is re-parsed once (§2.1
failure 2).

### 4.3 Why this is the right shape

`docs/subsystems/ui-skill-cards.md` §0.6 records 5 cards marked 🔴 STRUCTURAL and 3 🟡, and states
the cause plainly: *"cards drifted precisely because each was built alone with nothing to conform
to."* A composer makes the contract **unbreakable by construction** rather than by discipline —
which is what 16 hand-built cards demonstrably failed at. It is also what makes "the creator can ask
for anything" reachable: new output types stop costing a Zod schema plus a bespoke React file.

---

## 5. Error handling and degrade

| failure | behaviour |
|---|---|
| Apify cap / 403 | fall back to corpus rows, **labelled as not-live**; never disguised as a bad handle |
| scrape returns 0 videos | same, plus an honest sentence naming the niche as the reason |
| no native subs on a video | escalate per D5; may still be proof, never a format card |
| decode fails | the video is dropped from the card, not zero-filled |
| model emits an invalid tree | one repair attempt, then degrade to prose (never a broken card) |
| multiplier above band | clamped to `50×+` (D4) |
| model names a nonexistent row id | receipt omitted — the card renders without it (D7 makes fabrication impossible, not merely unlikely) |

---

## 6. Testing

- **`scripts/spike-slot-composer.ts` re-run** after the recipe + repair work; compare to the §2.1
  baseline. This is what decides flash vs plus — the model tier is settled by measurement, not guess.
- Unit: recipe validation (each recipe rejects a tree missing its required slot), arg repair, spine
  ordering, multiplier clamping, receipt materialization from row id.
- Unit: decode write-back is idempotent (the same video decoded twice does not duplicate a row).
- A test asserting model-supplied handles never reach the DOM — only server-materialized receipts do.
- `/dev/cards` gains one entry per recipe (the existing cheap visual gate).
- Live: one real niche scrape end-to-end, confirming subtitles arrive and a decode is written back.

---

## 7. Phasing

- **Phase 0 — ✅ DONE 2026-08-10.** `scripts/spike-free-subtitles.ts`. Coverage 71% of real videos,
  VTT parse 12/12, $0.075/run (§2.6). D3 confirmed viable. Surfaced §2.7 as a bonus.
- **Phase 1 — sourcing** (§4.1). **Its own implementation plan.**
- **Phase 2 — output** (§4.2). **Its own implementation plan.**
- **Phase 3 — the agent loop / tool belt.** Separate spec *and* plan.

Phases 1 and 2 are one design because they share the receipt seam (D7) and the decode contract, but
they are **two implementation plans** — each is substantial (a new request-time pipeline; a new
block type plus renderer and registry), and bundling them would produce a plan too large to execute
with review checkpoints. Phase 1 ships behind a flag and is independently verifiable: a decode
written back to `outlier_teardowns` is observable without any UI change.

---

## 8. Assumptions

1. **A paid Apify plan is in place before Phase 1 SHIPS — not before it is BUILT.** Measured at
   $0.0513/run (§2.5), the free account has ~41 runs left and resets 2026-08-20, which is ample for
   Phase 0 and Phase 1 development. What it cannot carry is production: ~97 scrapes/month total
   across all users. This is a purchase, not a design change, and it gates the *release* of Phase 1,
   not the work.
2. ~~Phase 0's coverage number is acceptable.~~ **RESOLVED 2026-08-10** — 71% of real videos, all
   parseable (§2.6). D3 stands.
3. Corpus write-back is legal under the existing corpus decisions. `outlier_teardowns` was curated;
   D2 makes it accumulative. Rows written by live decode should carry a `source_pool` value marking
   them as such, so curated and accumulated rows stay distinguishable.
4. `docs/DECISION-outlier-corpus-2026-08-07.md` — which chose curated-corpus-first deliberately — is
   **superseded** for sourcing priority by the owner decision in this session. Its quality concern
   (an on-demand scrape cannot be QA'd) is answered by D2: decodes accumulate and are reusable, so
   quality compounds instead of being re-rolled per request.
