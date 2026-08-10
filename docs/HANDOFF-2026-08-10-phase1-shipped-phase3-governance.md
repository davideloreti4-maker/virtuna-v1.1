# Handoff — Phase 1 SHIPPED, Phase 3 governance spec half-designed (2026-08-10)

**Branch:** `feat/apify-first-sourcing` → merged to `main`
**Gates at merge:** `tsc` clean · 5,865 tests green · `npm run build` succeeds
**Apify spend this session:** $0.106 (4 real runs). Account now **$3.06 / $5.00**, resets 2026-08-20.

---

## 1. What actually shipped

All 7 tasks of `docs/superpowers/plans/2026-08-10-apify-first-sourcing-phase1.md`, TDD, plus a
follow-up fix. Read that plan's **§ Execution record** for the full deviation list — it is the
authoritative record and it contradicts the plan body in seven places.

| module | what it does |
|---|---|
| `src/lib/discover/author-baseline.ts` | per-author outlier denominator + `formatMultiplier` (clamps at `50×+`) |
| `src/lib/scraping/types.ts` · `apify-provider.ts` | `VideoData.author` carries `fans/heart/videoCount`; `searchCreators()` = stage 1 of D12 |
| `src/lib/decode/vtt.ts` | free native subtitle → speech text, **two wire formats** |
| `src/lib/decode/live-decode.ts` | request-time structural decode on `qwen3.7-flash` |
| `src/lib/decode/decode-cache.ts` | gated, embedded write-back to `outlier_teardowns` |
| `scripts/verify-apify-first.ts` | one real end-to-end run; checks the Apify balance first |

### 🔴 The one thing that is NOT done

**The §2.7 multiplier defect is fixed in the library and STILL SHIPPING in the UI.**
`/api/discover` and `/api/tools/explore` still call `rankOutliers`, whose baseline is the median of
the returned set. A creator still sees a multiplier that moves with `resultsPerPage`. Switching
those call sites was deliberately deferred to Phase 2. Do not read "the fix landed" as "the bug is
gone" — see memory `multiplier-depends-on-scrape-size`.

Also still open: `own-median-views` is **not N-invariant either** (measured 5.2× at N=3 vs 3.0× at
N=6 on @thefounderadvisor). It kills the far worse *cross-creator* median, not sample-size
dependence. A fixed baseline N would close it.

---

## 2. What the live run found that no mocked test could

Four real Apify runs exposed four defects. Each is now fixed **with a test**, and each is the kind
that a green suite is structurally unable to see.

1. **`searchCreators` returned candidates in the actor's dataset order.** `handles[0]` was an
   18-follower account (median 11 views); the only relevant creator sat third. Now ordered by
   `authorMeta.fans`, which rides on every stage-1 item for free.
   **Spec D12 is half a fix:** `searchSection:"/user"` answers *a person rather than a caption*. It
   does not answer *which person*.
2. **`tiktokLink` serves TWO wire formats** — WEBVTT for some videos, and
   `{"utterances":[{text,start_time,text_color,…}]}` for others. The line filter had no opinion
   about JSON, so 13,472 chars of styling metadata reached the model as "Transcript:".
   Sniffing the shape: **5,401 → 664 prompt tokens** on the same video.
3. **`qwen3.7-flash` returns `structure` as a LIST** — array of strings on one run, array of
   `{step, description}` on the next. Right content, wrong container, whole decode discarded.
4. **A silent `null` is undebuggable.** #3 took a hand-written raw model call to find. `decodeVideo`
   now logs *why* it failed and still never throws.

⚠️ **Methodology trap, recorded in the source.** The first shape example in `SYSTEM` was written
from the test video itself, and flash returned it back **verbatim** — which reads exactly like a
perfect decode. The example is now from an unrelated domain (knife sharpening) so copying is
detectable on sight. This nearly shipped as "verified working".

---

## 3. The write-back fix (`8aabc9b5`) — read this before touching `decode-cache.ts`

The first cut of `storeDecode` wrote rows that were **unwarranted, unreachable, and carried a URL
that expires**. Found while designing Phase 3, whose warm-first lookup would have been reading them.

1. **No warrant.** `retrieve.ts` is explicit that the corpus's two pools are admitted on different
   grounds: a curated row was hand-picked, so curation IS the warrant; a **scraped** row has nobody
   in the loop, so the metric is the only thing separating a lesson from a random video, and the
   orchestrator applies `MIN_OUTLIER_MULTIPLIER` (3×) **at write time**. `storeDecode` applied
   nothing — the live run put a **0.298×** video, one that underperformed its own creator, into a
   pool other surfaces cite as *proof*.
2. **Unreachable.** Retrieval is cosine over `embedding`; it wrote none, and no `niche` either.
   Every row it created was findable only by exact `platform_video_id` — the one key nobody has
   when asking about a niche. **The self-filling cache was filling a bucket nothing reads.**
3. **Expiring cover.** It persisted the signed TikTok cover URL directly — the exact failure
   `corpus-durable-cover.test.ts` exists to prevent.

Root cause of all three: a **second, hand-rolled writer** for a table that already had a canonical
one. `storeDecode` now delegates to `upsertOutlierTeardown`, which owns the conflict target and
`durableCover()`.

**Useful side effect:** `outlier-gate.ts` §14 says the durable `views ÷ followers` receipt needs a
per-survivor profile scrape because "follower_count is not inline on a niche pull, and VideoData
carries none." **It carries one now** (Task 2), so the pool-standard receipt is free on every
scraped row.

---

## 4. Schema facts that cost real time — do not re-derive

`outlier_teardowns`, verified against prod:

```
CHECK (source_pool IN ('curated','competitor','scraped','expanded'))   -- NOT 'live-scrape'
CHECK (status      IN ('metadata','extracted','watched','failed'))    -- NOT 'active'
CHECK (hook_source IN ('native_transcript','caption_fallback','omni'))
UNIQUE INDEX ON (platform, platform_video_id)   -- onConflict needs BOTH columns
```

All three of the plan's proposed values were wrong, and **all three would have failed silently** —
`supabase-js` RETURNS `{error}`, it does not throw, so a best-effort writer discards the rejection.
No migration was needed or applied. Memory: `supabase-check-constraints-fail-silently`.

**Corpus state:** 524 `curated`/`extracted` + 8 `curated`/`failed`. Zero `scraped` rows — every
verification row was deleted. `scripts/verify-apify-first.ts --keep` retains one.

---

## 5. Phase 3 — where the design got to

The handoff said Phase 3 was undesigned. **That was wrong.** `src/lib/tools/chat-agent-loop.ts`
(1,267 lines) is a real streaming agent loop with tool calls, a billing gate, transcript replay and
hard anti-fabrication guards. What is missing is narrower.

**The actual blocker, documented in `skill-dispatch.ts`:**

> `account-read`, `explore` and `remix` stay behind a confirm tap because they hit **Apify scrapes**
> — on a $5/month hard cap — and an agent that can decide to scrape can burn that cap with nobody
> tapping anything.

The agent can call 4 skills (`generate_ideas`, `generate_hooks`, `write_script`, `read_concept`)
plus `search_corpus` and `request_input`. Seven others it **cannot call at all**.

**And even with a tap, the data never comes back.** A confirmed `explore` run returns to the agent
as one ≤240-char prose line describing **tile[0] only**
(`chat-prior-turns.ts` → `SKILL_BLOCK_RECORD["outlier-grid"]`, `MAX_RECORD_LENGTH = 240`). It never
receives the other 11 videos and no decode at all. "Find me 3 viral formats" is unanswerable because
the agent has nothing to reason over.

### Decisions taken (owner-approved)

| # | decision |
|---|---|
| 1 | **Governance first** — spend authority before new tools before planning |
| 2 | **Agent proposes, one tap confirms** — the agent fills the args; the creator reviews a decision, not a form |
| 3 | **Two-turn resume** — the tap runs the skill server-side and opens a NEW turn carrying a real structured tool result |
| 4 | **Cap-out → answer warm, name the limit, no charge, no tap offered** |
| 5 | **Warm-first** — the cache answers free when it can; "pull fresh" is a follow-up affordance, not the default |
| 6 | **Approach C: governance in the DISPATCHER, not the model** — the agent calls `explore(niche)` and never learns about money |

Why C: every decision above becomes *structural* rather than prompt-borne. Warm-first is a branch
the model cannot route around; adding a paid skill later needs zero prompt changes. Same principle
the loop already reached for after prompt text failed twice —
*"ground rule #1 of this lane applies: structure beats prompt text."*

### Approved architecture (section 1 of 4)

```
explore(niche)                                    ← the dispatcher decides, not the model
  ├─1  warmCoverage(niche)   rows ≥3× only, count + newest age
  │      sufficient? ──▶ answer free, state count + age        ← the common path
  ├─2  spendAuthority.check()   platform Apify cap
  │      capped + warm rows ──▶ answer stale, name the limit, no tap
  │      capped + nothing   ──▶ honest "cannot source right now", no charge
  ├─3  billing.gate(action)     creator credits  → relay the 402 body
  └─4  cold + funded ──▶ single-use proposal, args server-persisted, ONE per turn
                          tap → /api/chat/confirm re-checks 2+3, runs it,
                                opens a NEW turn with the real payload
```

**The ordering is the design.** Warm before any gate (the common path touches no budget); the
platform cap before the creator's credits (a cap-out is not their fault and must never render as a
paywall); the proposal last (spending is the exception).

`SpendAuthority` is a new seam mirroring the existing `SkillBilling` — creator money vs platform
money, both injected by the route, both network-free under test.

### Still to design — sections 2, 3, 4

- **§2 Budget authority** — where `SpendAuthority` reads the Apify cap, caching/TTL, fail-closed
  behaviour. (`GET https://api.apify.com/v2/users/me/limits?token=…` →
  `data.current.monthlyUsageUsd` / `data.limits.maxMonthlyUsageUsd`.)
- **§3 The proposal round trip** — block shape, single-use token, **server-persisted args** (a
  client-supplied arg would let a creator scrape anything), the resume route's transcript shape,
  and how it supersedes the 240-char record path.
- **§4 Error handling + testing** — including how a turn is prevented from ending with no visible
  output, and the interaction with `DEFAULT_MAX_SKILL_RUNS` (a proposal must not consume the leash
  but must be capped at one per turn).

`request_input` stays exactly as it is. It answers "I need a value you haven't given me," which is a
real and different question from "authorize this spend."

---

## 6. Repo gotchas that will cost you time

- **vitest:** `node node_modules/vitest/vitest.mjs run <path>` — npx output is swallowed here.
  **tsx:** `node node_modules/tsx/dist/cli.mjs` (`.bin/tsx` fails under `node`).
- **`npx tsc --noEmit` before every commit.** A green Vercel check is not a build. 🔴 Git is
  DISCONNECTED — **merging does NOT deploy**, contra `CLAUDE.md`.
- **The post-commit hook AUTO-PUSHES.** Amending after it fires needs a force-push.
- **A tsx script must live inside the repo** — module resolution fails from the scratchpad.
- **`supabase db push` is UNSAFE here.** Single migrations via the SQL editor.
- Supabase project `qyxvxleheckijapurisj`. The table uses `creator_handle`, not `handle`.
- ⚠️ At the Apify cap, Apify 403s and the app disguises it as *"check your handle is public."*
  **Check the ACCOUNT before debugging any scrape failure.**
- One flaky test under full-suite load: `omni-analysis-critical-field-retry.test.ts` (timing).
  Passes in isolation and on a clean run; unrelated to this work.

---

## 7. Open decisions the owner still owes

1. **Paid Apify plan.** Gates SHIPPING Phase 1, not building it. At $5/mo the whole platform gets
   ~97 scrapes/month across all users. This is a purchase decision, still unmade.
2. **Phase 2 has no plan** — the spec covers the `composed-card` output layer; `writing-plans` has
   not been run for it.
3. **Phase 3 sections 2–4** — half-designed, above.
4. **D9 basis** — niche pulls use `"vs their lifetime average"` unless a profile scrape supplies the
   views median. Now partly moot: scraped corpus rows carry the pool-standard `"vs followers"`.
