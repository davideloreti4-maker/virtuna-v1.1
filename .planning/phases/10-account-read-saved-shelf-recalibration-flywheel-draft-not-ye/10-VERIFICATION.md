---
phase: 10-account-read-saved-shelf-recalibration-flywheel
verified: 2026-06-19T00:00:00Z
status: human_needed
score: 16/17 must-have truths verified (1 partial — documented follow-up)
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
warnings:
  - truth: "Predicted disposition vector is pinned AT SIM run time (FLYWHEEL-02)"
    status: partial
    reason: >-
      pinPredictedSignature() is built, exported and unit-tested (predicted-pin.test.ts),
      and the capture route correctly reads the pinned row via findPinnedPrediction() and
      honestly bails when absent. BUT no tool runner invokes pinPredictedSignature() —
      runFlashRunner() returns without calling it. In the live system no predicted vector
      is ever pinned during a normal SIM run, so the capture/reconcile path can never fire
      end-to-end through the real user flow until a runner is wired to call the seam.
    artifacts:
      - path: "src/lib/tools/runners/flash-runner.ts"
        issue: "runFlashRunner() (lines 100-115) does not call pinPredictedSignature() (defined lines 144+). Seam dormant."
    missing:
      - "Wire pinPredictedSignature() into each tool runner's post-SIM point so predicted vectors are actually pinned at run time."
    note: >-
      Documented as an intentional carry-forward in 10-07-SUMMARY.md ("call into each tool
      runner's post-SIM point is a follow-up integration to validate in UAT"). Not a regression,
      not hidden, seam is correct + tested. Flagged for human decision: accept as deferred, or
      treat as a blocking gap requiring runner wiring before phase close.
human_verification:
  - test: "Capture outcome — paste a posted URL into the Capture-outcome form"
    expected: "Public metrics pull; optional private add; provenance tags ('from the post'/'you added'); blank field not counted as zero; success shows 'Outcome captured.'"
    why_human: "Requires a live APIFY_TOKEN + a real posted URL; asserts SSE interaction + provenance UI contract."
  - test: "Reconcile log — capture an outcome with a pinned prediction present"
    expected: "A reconciliations row is written with classification calibration/craft per capture."
    why_human: "Requires live DB write + an upstream pinned prediction; depends on the pin-wiring follow-up above."
  - test: "Propose -> confirm — accumulate >=N consistent calibration divergences"
    expected: "Nudge appears ('Your buyers ran warmer...') with honesty footnote; Confirm writes override (active audience persona_weights change, General does NOT); Decline does not re-nag."
    why_human: "Requires multi-post live data accumulation + visual nudge contract; the General-unchanged half is auto-verified by propose.test.ts but the live confirm write is not."
  - test: "Drift — trigger /api/cron/audience-drift (cron-authed)"
    expected: "Writes a source='drift_scrape' row that surfaces the SAME nudge with source='drift' copy."
    why_human: "Requires CRON_SECRET + live Apify own-account scrape."
  - test: "Shelf — Save a hook/idea/Read from a thread"
    expected: "Item appears flat on /saved with its type chip; 'Use in thread ->' launches via CHAIN_HANDOFFS; Remove confirms and does not delete the original."
    why_human: "Asserts interaction flow + CHAIN_HANDOFFS launch + flat-warm visual contract."
  - test: "Account Read — run 'Read my account' (populated and thin/private handle)"
    expected: "reading/-rendered card with patterns + accuracy track record on a real account; honest 'Not enough history to read yet' warning on thin/private — never fabricated."
    why_human: "Requires live Apify own-account scrape; asserts reading/-component reuse + honest fallback visual."
  - test: "Track-record EMPTY path (SELF-03) — fresh account, ZERO reconciliation rows"
    expected: "Account Read shows honest empty track-record state ('Not enough posted outcomes yet...') — NOT a fabricated/zero 'within X%' number. Verify BOTH empty and populated paths."
    why_human: "Asserts the SELF-03 honest-empty contract under live data conditions."
  - test: "Visual SSOT — flat-warm + cream-not-coral throughout"
    expected: "Chips/checks/provenance/track-record all flat-warm SSOT, cream-secondary, never coral."
    why_human: "Visual appearance assertion — cannot be verified programmatically."
---

# Phase 10: Account Read, Saved Shelf & Recalibration Flywheel — Verification Report

**Phase Goal:** Turn the studio inward and make the moat compound over time — self-optimizing Account Read over the creator's own history (SELF-01/02/03), a lean flat Saved shelf (SAVE-01/02), and the post->measure->reconcile->propose->confirm->correct outcome loop + drift recalibration (FLYWHEEL-01..06), with the SIM-1 engine regression-gate-protected.
**Verified:** 2026-06-19
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | Predicted signature is a deterministic pure function of FlashPersona[] | VERIFIED | `signature.ts` — no Date.now/Math.random/I/O; totalStops==0 -> all-zero (no NaN); unknown archetype skipped (never fabricates) |
| 2  | Realized signature excludes (never zero-fills) channels with no signal | VERIFIED | `realized-signature.ts` — absent channel dropped from vector; normalization across PRESENT channels only; per-channel provenance retained |
| 3  | Reconciliation classifies each divergence as calibration vs craft | VERIFIED | `reconcile.ts` — CALIBRATION=collector/connector/converter, CRAFT=scanner/lurker/skeptic; A1 split OWNER-CONFIRMED at 10-SPIKE gate; intersection-only divergence |
| 4  | Confidence gate fires only at >=N_MIN consistent same-direction divergences on a calibration disposition | VERIFIED | `confidence-gate.ts` — N_MIN=5, DIV_THRESHOLD=0.12, AGREE_THRESHOLD=0.7; iterates CALIBRATION_DISPOSITIONS only (craft can never propose) |
| 5  | Recalibration produces a clamped, re-normalized PersonaWeights that never sums off 1.0 | VERIFIED | `recalibration.ts` — clamp[0,1] + normalizeWeights(); copies caller object; only calibration dispositions map to slots |
| 6  | No flywheel math reads General/DEFAULT weights or mutates archetype defs | VERIFIED | grep across all 5 math files: only mention of DEFAULT/ARCHETYPE is a documentation comment in recalibration.ts asserting the invariant; zero code reads |
| 7  | Three sibling tables exist with RLS own-rows-only | VERIFIED | migrations 20260619100000/100100/100200 all ENABLE RLS + auth.uid()=user_id policies; live-applied per context (qyxvxleheckijapurisj) |
| 8  | The contested `outcomes` table is NOT touched | VERIFIED | grep: no ALTER/TABLE outcomes in any 100*.sql migration |
| 9  | A single posted URL can be scraped for public metrics | VERIFIED | `apify-provider.ts` scrapeSinglePostMetrics via apidojo/tiktok-scraper-api single-post tier (carry-forward: field names unverified vs live token) |
| 10 | saved_items is flat (no folder_id/tags) and typed (6 types) | VERIFIED | migration: CHECK item_type IN (read/idea/hook/script/outlier/format); no folder_id, no tags column; comment documents FLAT-by-construction |
| 11 | Predicted vector pinned AT SIM run time | PARTIAL (WARNING) | `pinPredictedSignature()` built+tested in flash-runner.ts but NOT called by runFlashRunner() or any runner — seam dormant; documented follow-up (10-07-SUMMARY) |
| 12 | Capturing an outcome runs reconcile() and writes a reconciliation row | VERIFIED | `outcomes/signature/route.ts` — findPinnedPrediction -> reconcile() -> updateOutcomeRealized + insertReconciliation; honestly bails if no pinned row |
| 13 | Every thread output exposes a Save affordance POSTing a typed snapshot | VERIFIED | `save-affordance.tsx` -> useSaveItem hook -> /api/saved; saved-checkmark cream, disabled-when-saved |
| 14 | Saved surface lists typed items flat under a nav item; shelf item launches back via CHAIN_HANDOFFS | VERIFIED | `(app)/saved/page.tsx` + `saved-shelf.tsx` (type chips, empty state); `saved-item-card.tsx` uses CHAIN_HANDOFFS (8 refs); sidebar Saved nav present |
| 15 | Account Read scrapes own history, surfaces hooks/format/drop-points/working-vs-fix; honest thin fallback; reuses reading/ components | VERIFIED | `account-read.ts` scrapeProfile+scrapeVideos(30); THIN_MIN_VIDEOS gate (23 refs); `account-read-block.tsx` reuses ReadingHero; dropPoints honest-empty [] v1 (documented) |
| 16 | Accuracy track record sourced from reconciliation rows; honest empty state | VERIFIED | `account-read.ts` reads listReconciliations (19 refs) for "within X% on last N"; SELF-03 empty path present (UAT must confirm live) |
| 17 | Recalibration only PROPOSED after gate; creator CONFIRMS; writes analysis_override on active non-general audience only; never changes General/DEFAULT/ENGINE_VERSION; drift feeds SAME path | VERIFIED | `propose.ts` canRecalibrate() refuses is_general/is_preset (short-circuits before any DB query); confirm -> updateAudience override; `audience-drift/route.ts` writes drift_scrape rows into same path; propose.test regression anchor green |

**Score:** 16/17 truths VERIFIED, 1 PARTIAL (truth #11, documented follow-up)

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `src/lib/flywheel/signature.ts` (69 L) | VERIFIED | predictedSignature pure/deterministic |
| `src/lib/flywheel/realized-signature.ts` (142 L) | VERIFIED | realizedSignature + provenance, honesty spine |
| `src/lib/flywheel/reconcile.ts` (98 L) | VERIFIED | calibration/craft classifier, A1 owner-confirmed |
| `src/lib/flywheel/confidence-gate.ts` (103 L) | VERIFIED | N_MIN/DIV/AGREE gate |
| `src/lib/flywheel/recalibration.ts` (83 L) | VERIFIED | buildOverride clamp + normalize |
| 3 migrations (outcome_signatures/reconciliations/saved_items) | VERIFIED | RLS, FKs, live-applied |
| `apify-provider.ts` scrapeSinglePostMetrics | VERIFIED | single-post actor (field names = live-UAT carry-forward) |
| `outcomes/signature/route.ts` (259 L) | VERIFIED | SSE capture -> reconcile -> log |
| `outcome-signature-form.tsx` (223 L) | VERIFIED | capture form + provenance |
| `flash-runner.ts` pinPredictedSignature (210 L) | ORPHANED/PARTIAL | seam built+tested, not called by any runner (truth #11) |
| `/api/saved/route.ts` (133 L) GET/POST/DELETE | VERIFIED | typed shelf CRUD |
| `(app)/saved/page.tsx` + saved-shelf/saved-item-card | VERIFIED | flat surface, type chips, CHAIN_HANDOFFS |
| `save-affordance.tsx` (91 L) | VERIFIED | useSaveItem -> /api/saved |
| `account-read.ts` (333 L) | VERIFIED | scrape + thin gate + track record |
| `/api/account-read/route.ts` (167 L) | VERIFIED | SSE own-account Read |
| `account-read-block.tsx` (218 L) | VERIFIED | reuses reading/ components |
| `/api/flywheel/proposals/route.ts` (130 L) | VERIFIED | GET/POST confirm/decline |
| `propose.ts` (202 L) | VERIFIED | gate -> override; General refused |
| `recalibration-nudge.tsx` (148 L) | VERIFIED | one component, outcome+drift triggers |
| `/api/cron/audience-drift/route.ts` (248 L) | VERIFIED | drift_scrape -> same propose path |
| `database.types.ts` | VERIFIED | all 3 tables present; (supabase as any) casts removed from repos |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| signature.ts | temperature-disposition.ts | TEMPERATURE_DISPOSITION import | WIRED |
| recalibration.ts | persona-weights.ts | normalizeWeights | WIRED |
| outcomes/signature route | apify-provider | scrapeSinglePostMetrics | WIRED |
| outcomes/signature route | reconcile.ts | reconcile + insert | WIRED |
| flash-runner | outcome-repo | insertOutcomeSignature (in seam) | WIRED (but seam uncalled — see #11) |
| save-affordance | /api/saved | useSaveItem hook | WIRED |
| saved-item-card | chain-handoff | CHAIN_HANDOFFS | WIRED |
| account-read-block | reading-hero | ReadingHero reuse | WIRED |
| account-read route | apify-provider | scrapeProfile+scrapeVideos | WIRED |
| account-read.ts | reconciliation-repo | listReconciliations track record | WIRED |
| propose.ts | audience-repo | updateAudience (override) | WIRED |
| audience-drift cron | proposals route | drift_scrape -> same path | WIRED |
| recalibration-nudge | /api/flywheel/proposals | useRecalibrationProposals/Action hooks | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Flywheel + account-read unit tests | `vitest run src/lib/flywheel src/lib/account-read` | PASS (63) FAIL (0) | PASS |
| ENGINE_VERSION unchanged | `grep version.ts` | 3.19.0 | PASS |
| Engine regression gate + version test | `vitest run audience-regression-gate + version` | PASS (8) FAIL (0) | PASS |
| General-weights regression anchor | `vitest run propose.test.ts` | PASS (8) FAIL (0) | PASS |
| TypeScript phase-10 production files | `tsc --noEmit` | 43 errors, ALL in __tests__/fixtures, ZERO in phase-10 production source | PASS (no phase-10 regression) |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| SELF-01 | 10-05 | SATISFIED | account-read.ts pattern extraction from own scrape |
| SELF-02 | 10-05 | SATISFIED | account-read-block reuses reading/; savable as 'read'; thin fallback |
| SELF-03 | 10-05 | SATISFIED (live UAT pending) | track record from reconciliations; honest empty state |
| SAVE-01 | 10-02/04/07 | SATISFIED | saved_items flat typed table + shelf-repo CRUD |
| SAVE-02 | 10-04 | SATISFIED | flat /saved surface + CHAIN_HANDOFFS use-in-thread |
| FLYWHEEL-01 | 10-02/03/07 | SATISFIED | scrapeSinglePostMetrics + capture route + provenance |
| FLYWHEEL-02 | 10-01/03 | PARTIAL | signature pin seam built+tested; runner wiring deferred (truth #11) |
| FLYWHEEL-03 | 10-01/03 | SATISFIED | reconcile calibration/craft classifier |
| FLYWHEEL-04 | 10-01/06 | SATISFIED | confidence-gated propose->confirm override write |
| FLYWHEEL-05 | 10-02/06 | SATISFIED | reconciliations cross-creator seed table logged (prior-fitting deferred by design) |
| FLYWHEEL-06 | 10-06 | SATISFIED | drift cron folds into same propose path |

All 11 declared requirement IDs accounted for in REQUIREMENTS.md (lines 94-114) and traceability table (lines 187-197). No orphaned requirements.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
| ---- | ------- | -------- | ------ |
| (none) | TBD/FIXME/XXX debt markers | — | NONE found in phase-10 modified files |
| flash-runner.ts | pinPredictedSignature exported but never called | WARNING | Truth #11 — documented follow-up, not a hidden stub |
| account-read.ts | dropPoints: [] (honest empty v1) | INFO | Documented honest-empty, populated when retention data available |

### Human Verification Required

8 items require a live driven UAT session (Plan 10-07 Task 3, deferred end-of-phase per workflow.human_verify_mode). They need a real APIFY_TOKEN + CRON_SECRET and assert live-data + visual contracts that grep cannot verify. See frontmatter `human_verification` for the full list: capture, reconcile log, propose->confirm, drift, shelf save/use, Account Read (populated + thin), SELF-03 empty track-record, and flat-warm/cream-not-coral visual SSOT.

### Gaps Summary

The phase goal is substantially achieved. All flywheel math is pure/deterministic and correct; the calibration-vs-craft split that protects the model from craft flops (D-03) is owner-confirmed and mechanically enforced; the General-weights regression anchor is provably green (propose.test + audience-regression-gate); ENGINE_VERSION is unchanged; the 3 tables are live + typed with RLS and the contested `outcomes` table untouched; the Saved shelf is flat/typed and wired thread<->shelf; the Account Read reuses reading/ components with honest thin/empty fallbacks; recalibration is propose->confirm gated with General/preset refused at the call site.

**One partial (WARNING, not blocker):** truth #11 — the predicted-vector pin seam (`pinPredictedSignature`) is built, exported, and unit-tested, and the capture route correctly consumes a pinned row, but no tool runner actually calls the seam yet (`runFlashRunner` returns without pinning). Consequence: in the live system no predicted vector gets pinned during a normal SIM run, so the capture->reconcile loop cannot fire end-to-end through the real user flow until a runner invokes the seam. This is explicitly documented as an intentional carry-forward in 10-07-SUMMARY.md and surfaced here for a human decision (accept as deferred to a follow-up, or require runner wiring before phase close). It does not affect the regression gate, the math correctness, or any other surface.

**Status human_needed** (not gaps_found): the BLOCKING engine regression gate is green and no must-have FAILED outright. The remaining work is (a) the 8-item live UAT that the planner deliberately deferred to end-of-phase, and (b) the human decision on the documented pin-wiring follow-up.

---

_Verified: 2026-06-19_
_Verifier: Claude (gsd-verifier)_
