---
phase: 08-discover-remix-read-the-competitor-niche-moat-chain
verified: 2026-06-19T11:22:00Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
gaps: []
deferred: []
---

# Phase 8: Discover & Remix→Read — the competitor/niche moat chain — Verification Report

**Phase Goal:** Open a new funnel-top competitors stop short of — Discover real outliers (creator/competitor profile AND niche/keyword via Apify, ranked by outlier-score = over-performance vs the source channel's own baseline, plus value metrics) → audience-steered Remix (deconstruct hook/structure/format, regenerate the concept FOR the active calibrated audience) → multi-audience concept Read (verbatim quote panel, who-it's-NOT-for) BEFORE filming. The category is foresight. (Comment seeding DEFERRED out of P8.)

**Verified:** 2026-06-19T11:22:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1 | W0 persona-bias tables carry real values (no `[ASSUMED]`), regression gate green (ENGINE_VERSION 3.19.0, General→DEFAULT no-op) | ✓ VERIFIED | `grep -ic ASSUMED` = 0 in both `goal-intent.ts` + `temperature-disposition.ts`; `version.ts:127` ENGINE_VERSION="3.19.0"; `audience-regression-gate.test.ts` 5/5 pass; `goal-intent.test.ts` 13/13, `temperature-disposition.test.ts` 19/19 pass |
| 2 | apidojo provider swap on Discover scrape path; Remix rehost (`resolveVideoUrl`) stays on clockworks (Pitfall 2) | ✓ VERIFIED | `apify-provider.ts:19-20` DISCOVER_PROFILE_ACTOR/DISCOVER_VIDEO_ACTOR = apidojo slugs; `:26` VIDEO_ACTOR=clockworks; `:185` resolveVideoUrl uses VIDEO_ACTOR (clockworks). apidojo field remap (`bookmarks→saves`, `uploadedAt→postedAt`) at `:86-103` |
| 3 | `rankOutliers` computes outlier-score (baseline median, "vs own"/"vs niche" label, 90d decay, save/share tiebreak) | ✓ VERIFIED | `outlier-compute.ts` (82 lines) exports `rankOutliers`; `outlier-compute.test.ts` 9/9 pass (over-performer ranks #1, mode labels, 90d window, tiebreak) |
| 4 | Per-(input,mode,day) cache + per-user cap; in-memory (no migration) | ✓ VERIFIED | `discover-cache.ts` (113 lines) exports getCachedDiscover/setCachedDiscover/checkUserCap + DISCOVER_DAILY_CAP=20; no migration refs |
| 5 | `POST /api/discover` auth-gated → classify → cap → cache → apidojo scrape → rank → source-tagged tiles, NO SIM score | ✓ VERIFIED | `discover/route.ts:49` auth getUser before work; `:55` csrfGuard; `:78` classify; `:81` cap; `:96` cache; `:104` scrapeVideos; `:106` rankOutliers; `:113` source tag; no band/score emitted |
| 6 | `(app)/discover` grid view + OutlierTile (labelled multiplier, source tag, single coral Remix→Read CTA) | ✓ VERIFIED | page.tsx (26), discover-client.tsx (173), outlier-tile.tsx (120), discover-grid.tsx (145), discover-entry.tsx (77) all exist; OutlierGridBlockSchema (`blocks.ts:259-260` multiplier+baselineLabel, NO sim1-flash field) |
| 7 | discover→remix CHAIN_HANDOFFS handoff launches the chain (Remix→Read CTA → /api/tools/remix/run, anchorFrom card) | ✓ VERIFIED | `chain-handoff.ts` discover in SkillId union (`:53`) + handoff entry `from:discover→to:remix`, ctaLabel "Remix → Read", endpoint /api/tools/remix/run, anchorFrom:"card" |
| 8 | Audience-steered Remix across all 4 runners (remix/hooks/script/chat); General→DEFAULT byte-identical no-op | ✓ VERIFIED | All 4 runners import buildAudienceGroundingLine + feed audienceRepaint→runFlashTextMode (remix-runner.ts:122-133); all 4 routes load active_audience_id+getAudience; `steer-closure.test.ts` 11/11 pass (no-op vs calibrated per runner) |
| 9 | Single-audience concept Read block — bands only (no fabricated 0-100 score), who-it's-NOT-for | ✓ VERIFIED | MultiAudienceReadBlockSchema `.strict()` per entry, band enum only, NO z.number score; renderer `multi-audience-read-block.tsx` consumes interpretation/lever/whoNotFor (`:78`) |
| 10 | Two-audience compare Read (default active-vs-General) + verbatim quote wall | ✓ VERIFIED | `runTwoAudienceRead` resolves each audience separately, DELTA from band ranks; `POST /api/tools/read` (active-vs-General default); VerbatimWall mounted in JSX (`:216`); `two-audience-read.test.ts` 9/9 pass |
| 11 | who-it's-NOT-for derived honestly (cold-temperature selection, CR-01 fix) | ✓ VERIFIED | `who-not-for.ts:82-83` selects by `TEMPERATURE_DISPOSITION[archetype].temperature === "cold"`; `who-not-for.test.ts` 7/7 incl. explicit warm `purposeful_viewer` NOT scrolls-past + cold `cross_niche_curiosity` IS |

**Score:** 11/11 truths verified

### Post-Review Fix Verification (CR-01 / CR-02 / WR-01)

| Fix | Status | Evidence |
| --- | ------ | -------- |
| **CR-01** who-not-for selects by `temperature==="cold"`, not disposition string | ✓ VERIFIED | `who-not-for.ts:82-83` temperature lookup; dedicated test asserts warm purposeful_viewer (disposition scanner) → `""`, cold cross_niche_curiosity (disposition scanner) → "Scanners", mixed excludes warm scanner |
| **CR-02** two-audience-read dedupes by audience IDENTITY (`id`); General-only collapses to single-audience Read | ✓ VERIFIED | `two-audience-read.ts:170-216` dedupes by `id` BEFORE defaulting, `isSelfPair` collapses to 1-entry single-audience Read (no degenerate General-vs-General); test covers General-only single-audience path |
| **WR-01** shared `csrf-guard.ts` applied to all 6 mutating POST routes | ✓ VERIFIED | `csrf-guard.ts` (415 Content-Type + 403 cross-origin); imported + `guard=csrfGuard(request); if(guard) return guard` in read/chat/hooks/script/discover/remix-run; `csrf-guard.test.ts` 7/7 pass |

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `src/lib/audience/goal-intent.ts` (GOAL_INTENT_BIAS locked) | ✓ VERIFIED | 0 [ASSUMED] markers; preset-membership tested |
| `src/lib/audience/temperature-disposition.ts` (lens locked) | ✓ VERIFIED | 0 [ASSUMED] markers; low/hot spread tested |
| `src/lib/discover/outlier-compute.ts` (rankOutliers) | ✓ VERIFIED | 82 lines, pure, 9 tests pass |
| `src/lib/discover/classify-input.ts` | ✓ VERIFIED | 42 lines, pure |
| `src/lib/discover/discover-cache.ts` | ✓ VERIFIED | 113 lines, in-memory, cap+cache |
| `src/app/api/discover/route.ts` (POST) | ✓ VERIFIED | 130 lines, auth+csrf+chain wired |
| `src/lib/scraping/apify-provider.ts` (apidojo swap) | ✓ VERIFIED | Discover actors apidojo; resolveVideoUrl clockworks |
| `src/components/discover/*` (tile/grid/entry) | ✓ VERIFIED | All 3 present, substantive |
| `src/app/(app)/discover/*` (page/client) | ✓ VERIFIED | RSC + client, POSTs /api/discover, launches chain |
| `src/lib/tools/runners/{remix,hooks,script,chat}-runner.ts` (steer) | ✓ VERIFIED | All 4 steer; steer-closure 11 tests pass |
| `src/components/thread/multi-audience-read-block.tsx` | ✓ VERIFIED | 222 lines, consumes whoNotFor/interpretation/lever/VerbatimWall |
| `src/components/thread/verbatim-wall.tsx` | ✓ VERIFIED | 130 lines, mounted in read block |
| `src/lib/engine/flash/who-not-for.ts` (CR-01) | ✓ VERIFIED | Temperature-cold selection |
| `src/lib/engine/flash/two-audience-read.ts` (CR-02) | ✓ VERIFIED | Identity dedupe + single-audience collapse |
| `src/lib/http/csrf-guard.ts` (WR-01) | ✓ VERIFIED | Shared guard, 6 routes |
| `src/app/api/tools/read/route.ts` | ✓ VERIFIED | auth+csrf, active-vs-General, persists block |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| discover/route.ts | apify-provider | scrapeVideos (apidojo) | ✓ WIRED | route:104 |
| discover/route.ts | outlier-compute | rankOutliers | ✓ WIRED | route:106 |
| discover/route.ts | discover-cache | get/set/checkUserCap | ✓ WIRED | route:81,96,116 |
| OutlierTile CTA | /api/tools/remix/run | CHAIN_HANDOFFS discover→remix | ✓ WIRED | chain-handoff entry + discover-client handoffsFor('discover') |
| 4 runners | runFlashTextMode | audienceRepaint steer | ✓ WIRED | remix-runner:122-133 + steer-closure tests |
| read/route.ts | two-audience-read | runTwoAudienceRead | ✓ WIRED | route:116 |
| read/route.ts | insertMessage | persist validated block | ✓ WIRED | route:120 |
| read block renderer | message-blocks | BLOCK_COMPONENTS["multi-audience-read"] | ✓ WIRED | message-blocks.tsx:37 |
| outlier-grid renderer | message-blocks | BLOCK_COMPONENTS["outlier-grid"] | ✓ WIRED | message-blocks.tsx:36 |
| all 6 POST routes | csrf-guard | csrfGuard(request) | ✓ WIRED | all 6 import + apply |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| who-not-for honest segment (CR-01) | vitest who-not-for.test.ts | 7 passed | ✓ PASS |
| two-audience-read dedupe (CR-02) | vitest two-audience-read.test.ts | 9 passed | ✓ PASS |
| csrf-guard 415/403 (WR-01) | vitest csrf-guard.test.ts | 7 passed | ✓ PASS |
| outlier-score arithmetic | vitest outlier-compute.test.ts | 9 passed | ✓ PASS |
| steer no-op vs calibrated (4 runners) | vitest steer-closure.test.ts | 11 passed | ✓ PASS |
| regression gate (ENGINE_VERSION + General no-op) | vitest audience-regression-gate.test.ts | 5 passed | ✓ PASS |
| persona-bias tuning | vitest goal-intent + temperature-disposition | 32 passed | ✓ PASS |

**Aggregate: 80/80 phase-critical tests pass.** (Full-suite per SUMMARY: 2723 passed / 27 skipped / 0 failed.)

### Requirements Coverage

> Per ROADMAP traceability note: DISC-*/READ-*/AUD-W0/AUD-STEER are provisional phase-local IDs NOT enumerated in REQUIREMENTS.md by design. Only REMIX-01 is a formal ID. Traced against ROADMAP Phase 8 success criteria + per-plan objectives.

| Requirement | Source Plan | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| AUD-W0 (persona-value tuning) | 08-01 | ✓ SATISFIED | Truth 1 |
| DISC-01 (apidojo swap) | 08-02 | ✓ SATISFIED | Truth 2 |
| DISC-03 (outlier-score compute) | 08-02 | ✓ SATISFIED | Truth 3 |
| DISC-04 (per-day cache) | 08-02 | ✓ SATISFIED | Truth 4 |
| DISC-02 (outlier grid view) | 08-03 | ✓ SATISFIED | Truths 5,6,7 |
| REMIX-01 + AUD-STEER (audience-steered remix + all-runner steer) | 08-04 | ✓ SATISFIED | Truth 8 |
| READ-01 (single-audience Read) | 08-05 | ✓ SATISFIED | Truth 9 |
| READ-03 (verbatim wall + who-it's-NOT-for) | 08-05, 08-06 | ✓ SATISFIED | Truths 10,11 |
| READ-02 (multi-audience compare) | 08-06 | ✓ SATISFIED | Truth 10 |
| D-04 (Comment seeding) | — | DEFERRED | Intentionally out of P8 — not a gap |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
| ---- | ------- | -------- | ------ |
| (none) | TBD/FIXME/XXX in P8 source files | — | 0 unreferenced debt markers found |

**Known WARNING-level deferrals (from 08-REVIEW, explicitly out-of-scope in 08-REVIEW-FIX — fixed only CR-01/CR-02/WR-01):**

| Finding | Severity | Goal Impact |
| ------- | -------- | ----------- |
| WR-02 Discover remix launch fire-and-forget (navigates before persistence) | ⚠️ Warning | UX race on chain handoff — chain still functions; may show empty thread on fast nav. Non-blocking; not a goal failure. |
| WR-04 profile mode calls scrapeVideos not scrapeProfile ("vs own" baseline assumption) | ⚠️ Warning | Profile mode still scrapes+ranks; "vs own" label correctness hinges on actor-input contract. Non-blocking for the chain. |
| WR-05 in-memory cap non-shared on serverless | ⚠️ Warning | Apify spend bound is per-instance. Open-Q2 in-memory decision documented. Non-blocking. |
| WR-06 read route returns raw err.message | ⚠️ Warning | `read/route.ts:125` leaks error text to client. Non-blocking for goal; security hardening. |
| WR-03/07/08/09, IN-01..06 | ⚠️/ℹ️ | Code-quality / latent traps — none block the moat chain. |

These were deliberately deferred in the review-fix pass and do not prevent goal achievement. They are documented here for milestone-audit visibility, not as Phase 8 gaps.

### Human Verification Required

None. All observable truths are programmatically verifiable via source inspection + the 80 passing phase-critical tests. The end-to-end live UX (paste handle → grid → Remix→Read → two-audience compare in the running app) would benefit from a live UAT, but every link in the chain is statically wired and unit-tested; no truth resolved to UNCERTAIN.

### Gaps Summary

No gaps. The Discover → audience-steered Remix → multi-audience Read moat chain is real and wired end-to-end:

- **Discover:** apidojo swap (Remix rehost preserved on clockworks), pure outlier-score compute, classify-input, per-(input,mode,day) cache + cap, auth+CSRF-gated `POST /api/discover`, `(app)/discover` grid with labelled-multiplier OutlierTiles and a single coral Remix→Read CTA that launches the chain via CHAIN_HANDOFFS.
- **Remix steer:** all four runners (remix/hooks/script/chat) steer on the active calibrated audience with the General→DEFAULT no-op preserved; the audience-regression-gate is green (ENGINE_VERSION 3.19.0).
- **Read:** single-audience + two-audience (active-vs-General) concept Read blocks, bands only (`.strict()` rejects any numeric 0-100 score — honesty spine intact), who-it's-NOT-for, and the verbatim quote wall.
- **Post-review fixes all landed correctly:** CR-01 (temperature-cold who-not-for selection), CR-02 (identity-dedupe single-audience collapse), WR-01 (shared csrf-guard on all 6 mutating POST routes) — each verified in source and covered by passing tests.

Comment seeding (D-04) is intentionally deferred and correctly absent.

---

_Verified: 2026-06-19T11:22:00Z_
_Verifier: Claude (gsd-verifier)_
