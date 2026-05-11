---
phase: 01-training-corpus-eval-foundation
verified: 2026-05-11T15:10:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 1: Training Corpus & Eval Foundation — Verification Report

**Phase Goal:** Labeled 500-video training corpus exists and an eval harness measures engine accuracy against it. Current engine (v2.1) baseline measured. Target accuracy threshold set.
**Verified:** 2026-05-11T15:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### ROADMAP Success Criteria Assessment

The ROADMAP defines 5 success criteria for Phase 1. SC-1 contains a numerical target (500 videos) that the codebase does not meet — 225 rows are present. This is assessed in full below, then deferred per the milestone roadmap.

| # | Success Criterion | Status | Evidence |
|---|---|---|---|
| SC-1 | `training_corpus` contains exactly 500 videos (100 viral / 200 average / 200 under) across ≥5 niches | DEFERRED (see below) | 225 rows present; all 5 niches covered; shortfall is documented and deferred to Phase 4 corpus refresh |
| SC-2 | Outcome metadata per video: views, completion %, shares, comments, saves, creator follower tier | PARTIAL (documented gap) | views/likes/comments/shares/saves/follower_tier populated; completion_pct = null on all rows — documented KNOWN GAP in normalize-scrape.ts, v2.1-baseline.md, and pilot retrospective |
| SC-3 | Eval harness runs any engine version over corpus and produces report with prediction error per signal, calibration drift, overall accuracy metrics | VERIFIED | eval-harness.ts, eval-runner.ts, leave-one-out.ts, metrics/ all substantive; JSON + markdown reports generated; baseline-report-full.2026-05-11.json on disk |
| SC-4 | Baseline measurement of v2.1 persisted to `benchmark_results` | VERIFIED | Exactly 1 row confirmed in live DB: id=3f6e8e28-38b1-41fb-b439-80fe9de76654, engine_version=2.1.0, corpus_version=full.2026-05-11 |
| SC-5 | Target accuracy threshold documented in `.planning/research/` | VERIFIED | `.planning/research/v2.1-baseline.md` documents v3 must achieve macro_f1 ≥ 0.338 (D-18 sliding-scale, 15% relative improvement) |

**Score:** 4/4 must-haves verified (SC-1 corpus size gap deferred; SC-2 completion_pct gap documented)

---

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|---|---|---|
| 1 | `training_corpus` target of 500 videos not reached (225 actual) | Phase 4 | Phase 4 goal: "Wave 0 — Content Type + Niche Detection"; corpus refresh is planned at Phase 4+ per v2.1-baseline.md §Known Limitations §3 and pilot retrospective recommendations |

**Note on SC-1 shortfall:** The 225-row corpus was produced via the clockworks FREE-tier fallback (`APIFY_ACTOR_LEGACY=clockworks`) due to the Apify account being on the FREE plan. The apidojo migration code is complete and tested. The corpus size limitation does not invalidate the baseline measurement: the v2.1 benchmark is internally consistent (all future engine comparisons use the same `corpus_version=full.2026-05-11`). This is documented in `.planning/phases/01-training-corpus-eval-foundation/01-06-SUMMARY.md` and `v2.1-baseline.md §Corpus Distribution`. Per the verifier brief, this is a documented limitation, not an unmet requirement.

---

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | `training_corpus` has rows under `corpus_version=full.2026-05-11` | VERIFIED | Live DB: 225 rows, no duplicates |
| 2 | All 5 niches represented (beauty, fitness, edu, comedy, lifestyle) | VERIFIED | Live DB: all 5 niches confirmed |
| 3 | `thresholds.ts` THRESHOLD_SNAPSHOTS contains `full.2026-05-11` entry with calibrated values | VERIFIED | Code: lines 34-40 of thresholds.ts — beauty/fitness/edu/comedy/lifestyle viralFloor + underCeiling present |
| 4 | `pilot.2026-05-12` entry unmodified (D-13 immutability) | VERIFIED | `"pilot.2026-05-12": NICHE_THRESHOLDS` — references NICHE_THRESHOLDS constant from eval-config.ts; unchanged |
| 5 | Pilot retrospective documents per-niche distributions + apidojo migration notes | VERIFIED | `01-F-PILOT-RETROSPECTIVE.md` covers: zero-row pilot (quota exhaustion), pipeline summary, infrastructure validation, apidojo asymmetries, per-niche config coverage |
| 6 | `benchmark_results` has exactly 1 row with engine_version=2.1.0 and corpus_version=full.2026-05-11 | VERIFIED | Live DB count: 1; full row confirmed with all metric fields |
| 7 | `.planning/research/v2.1-baseline.md` exists with measured numbers | VERIFIED | File on disk; macro_f1=0.2940, ece=0.3715, viral_recall=0.1064, mae=0.0959 |
| 8 | `eval-config.ts` exports `BASELINE_REFERENCE_DOC` constant (D-19) | VERIFIED | `grep` confirmed: `export const BASELINE_REFERENCE_DOC = ".planning/research/v2.1-baseline.md" as const` |
| 9 | macro_f1 / ece / viral_recall in doc match the persisted DB row | VERIFIED | DB row: macro_f1=0.294, ece=0.3715, viral_recall=0.1064 — doc states 0.2940 / 0.3715 / 0.1064; match confirmed |
| 10 | `apify-jobs.ts` defaults to apidojo with clockworks fallback via `APIFY_ACTOR_LEGACY` env | VERIFIED | Lines 92-94 and 148-150: isClockworksMode() reads env; default actorId = `apidojo/tiktok-scraper` |
| 11 | `normalize-scrape.ts` enforces ≥7-day MIN age (Pitfall 1) AND ≤180-day MAX age | VERIFIED | Lines 61, 72, 141-142 (clockworks path) and 204-205 (apidojo path): both filters applied |
| 12 | `orchestrator.ts` exports `scrapeRawToCache()` and `bucketAndPersist()` (split API) | VERIFIED | Both functions exported at lines 143 and 233 |
| 13 | `scripts/calibrate-thresholds.ts` exists and runs (D-09 CLI) | VERIFIED | File exists; reads JSONL cache, computes percentiles, prints TypeScript code block to paste |
| 14 | `build-corpus.ts` has 4 modes: `--smoke`, `--scrape`, `--calibrate`, `--build` | VERIFIED | cli/build-corpus-args.ts defines BuildMode = "smoke" \| "scrape" \| "calibrate" \| "build" |
| 15 | Full test suite passes (264 tests in corpus/) | VERIFIED | `npx vitest run src/lib/engine/corpus/` → 19 test files, 264 tests, all passing |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/lib/engine/corpus/thresholds.ts` | Threshold snapshots with full.2026-05-11 entry | VERIFIED | Substantive: 59 lines, both pilot and full snapshots present, D-13 immutability comment |
| `src/lib/engine/corpus/eval-config.ts` | BASELINE_REFERENCE_DOC constant, NICHES, threshold formula | VERIFIED | 101 lines; exports BASELINE_REFERENCE_DOC, NICHES, requiredImprovementFor(), eval constants |
| `src/lib/engine/corpus/normalize-scrape.ts` | Both age filters, dual-format parser | VERIFIED | 256 lines; SEVEN_DAYS_MS, MAX_AGE_MS defined; clockworks + apidojo normalization paths both present |
| `src/lib/engine/corpus/orchestrator.ts` | scrapeRawToCache + bucketAndPersist split API | VERIFIED | 639 lines; both functions exported, plus writeRawCache/readRawCache/defaultCachePath helpers |
| `src/lib/engine/corpus/apify-jobs.ts` | apidojo default, clockworks fallback | VERIFIED | 191 lines; isClockworksMode() dispatch, buildApifyJobs() builds both input formats |
| `src/lib/engine/corpus/eval-runner.ts` | runEvalOverCorpus(), corpus page-fetch loop | VERIFIED | 208 lines; batched corpus fetch, pipeline invocation, RawEvalResult struct |
| `src/lib/engine/corpus/eval-harness.ts` | BenchmarkReport generation, persist to benchmark_results, leaveOneOut support | VERIFIED | Substantive: computeMacroF1, ECE, stage latency, failure cases, persist function wired to Supabase |
| `src/lib/engine/corpus/baseline.ts` | measureV21Baseline() wrapping eval-harness | VERIFIED | 28 lines; wraps runEvalHarness with ENGINE_VERSION = "2.1.0" |
| `src/lib/engine/corpus/metrics/leave-one-out.ts` | Per-signal LOO score computation | VERIFIED | SCORE_WEIGHTS_BASE, scoreWithoutSignal(), scoreBaseline() all present |
| `scripts/calibrate-thresholds.ts` | Operator-facing CLI for D-09 threshold derivation | VERIFIED | File exists; reads JSONL, computes P-quantiles per niche, prints TS code block |
| `scripts/build-corpus.ts` | 4-mode corpus build CLI | VERIFIED | All 4 modes (smoke/scrape/calibrate/build) implemented and dispatched |
| `.planning/research/v2.1-baseline.md` | D-20 canonical baseline document | VERIFIED | Full document: headline numbers, per-class metrics, per-niche F1, stage latency, failure cases, limitations, methodology |
| `.planning/baseline-report-full.2026-05-11.json` | Full eval report JSON | VERIFIED | File on disk |
| `src/app/api/cron/refresh-corpus/route.ts` | CORPUS-02 cron stub | VERIFIED | File exists (stub with cron auth — full mechanism deferred to Phase 11/12 per plan) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| eval-config.ts | v2.1-baseline.md | BASELINE_REFERENCE_DOC constant | VERIFIED | `export const BASELINE_REFERENCE_DOC = ".planning/research/v2.1-baseline.md"` |
| eval-harness.ts | benchmark_results | supabase.from("benchmark_results").insert() | VERIFIED | persistBenchmarkRow() at line 187; confirmed 1 row in live DB |
| orchestrator.ts | training_corpus | supabase.from("training_corpus").upsert() | VERIFIED | bucketAndPersist() line 352; confirmed 225 rows in live DB |
| eval-harness.ts | eval-runner.ts | runEvalOverCorpus() import | VERIFIED | Import at top of eval-harness.ts |
| eval-harness.ts | leave-one-out.ts | scoreWithoutSignal(), SIGNALS | VERIFIED | Imported and used in LOO loop (lines 100-111) |
| thresholds.ts | eval-config.ts | NICHE_THRESHOLDS import | VERIFIED | `import { NICHE_THRESHOLDS } from "./eval-config"` line 2 |
| normalize-scrape.ts | apify-jobs.ts | ScrapeConfigKind, Niche types | VERIFIED | Import at top of normalize-scrape.ts |
| baseline.ts | aggregator.ts | ENGINE_VERSION constant | VERIFIED | `import { ENGINE_VERSION } from "@/lib/engine/aggregator"` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| eval-harness.ts BenchmarkReport | macro_f1, per_niche_f1, ece | computeMacroF1() over runEvalOverCorpus() results | Yes — live DB corpus rows evaluated via pipeline | FLOWING |
| benchmark_results (DB row) | All metrics | eval-harness.persistBenchmarkRow() | Yes — confirmed by live DB query returning row id 3f6e8e28 | FLOWING |
| training_corpus (DB table) | 225 rows | bucketAndPersist() → supabase.upsert() | Yes — confirmed by live DB query: 225 rows, 0 duplicates | FLOWING |
| v2.1-baseline.md | macro_f1=0.2940, ece=0.3715, viral_recall=0.1064 | Transcribed from live eval run results | Yes — DB row confirms matching values | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| training_corpus has full.2026-05-11 rows across 5 niches | Live Supabase query | total=225, niches: beauty,comedy,edu,fitness,lifestyle | PASS |
| benchmark_results has exactly 1 v2.1.0 row | Live Supabase query | count=1 | PASS |
| DB metrics match baseline doc | DB: macro_f1=0.294, ece=0.3715, viral_recall=0.1064 vs doc: 0.2940/0.3715/0.1064 | All match | PASS |
| No duplicate platform_video_ids | Live Supabase query | 225 total, 225 unique — 0 duplicates | PASS |
| Full corpus test suite | `npx vitest run src/lib/engine/corpus/` | 264/264 passing, 19 files | PASS |
| D-19 cross-link present | `grep BASELINE_REFERENCE_DOC eval-config.ts` | Found | PASS |
| D-13 threshold sealed | `grep "full.2026-05-11" thresholds.ts` | Found | PASS |
| 180-day recency filter | `grep MAX_AGE_MS normalize-scrape.ts` | Found | PASS |

---

### Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|---|---|---|---|---|
| CORPUS-01 | 01-04, 01-06, 01-07 | 500-video corpus stratified across buckets | PARTIAL (documented) | 225 rows present; shortfall documented in 01-06-SUMMARY, v2.1-baseline.md; deferred to Phase 4 corpus refresh |
| CORPUS-03 | 01-04, 01-06, 01-07 | ≥5 niches (beauty, fitness, edu, comedy, lifestyle) | VERIFIED | All 5 niches in DB; beauty/comedy/edu/fitness/lifestyle confirmed |
| CORPUS-04 | 01-03, 01-07 | Outcome metadata: views, completion %, shares, comments, saves, follower tier | PARTIAL (documented) | All fields present in schema; completion_pct = null (KNOWN GAP documented in normalize-scrape.ts line 24 and v2.1-baseline.md §Known Gap) |
| CORPUS-06 | 01-01 | training_corpus table in Supabase | VERIFIED | Table exists, 225 rows confirmed via live query |
| CORPUS-08 | 01-04, 01-06 | Corpus quality validation (no duplicates, valid outcomes, recent within window) | VERIFIED | 0 duplicates confirmed; CORPUS-08 filter in orchestrator.ts lines 197-203; MAX_AGE_MS filter in normalize-scrape.ts |
| EVAL-03 | 01-02, 01-05 | Per-signal contribution analysis | VERIFIED | leave-one-out.ts implements scoreWithoutSignal() + SCORE_WEIGHTS_BASE; wired in eval-harness.ts lines 100-111 behind leaveOneOut flag; substantive LOO math present |
| EVAL-06 | 01-01, 01-05, 01-07 | Benchmark report generation (markdown + JSON, persisted) | VERIFIED | eval-harness.ts generates BenchmarkReport; persistBenchmarkRow() writes to DB; baseline-report-full.2026-05-11.json on disk; v2.1-baseline.md markdown document committed |
| D-01 | 01-RESEARCH | Phased pilot → full build | VERIFIED | Pilot + full build both present; pilot.2026-05-12 sealed, full.2026-05-11 sealed |
| D-09 | 01-RESEARCH | Empirical threshold recalibration | VERIFIED | scripts/calibrate-thresholds.ts exists; full.2026-05-11 thresholds derived from P80/P40 of 238-row filtered cache |
| D-13 | 01-RESEARCH | Immutable threshold snapshots | VERIFIED | THRESHOLD_SNAPSHOTS["pilot.2026-05-12"] references NICHE_THRESHOLDS (unchanged); "full.2026-05-11" sealed with immutability comment in code |
| D-19 | 01-07 | Cross-link between code constant + baseline doc | VERIFIED | BASELINE_REFERENCE_DOC constant names the doc; doc names the constant — bidirectional link confirmed |
| D-20 | 01-07 | Sealed baseline: doc + threshold formula + benchmark_results row | VERIFIED | All 3 present: v2.1-baseline.md, BASELINE_REFERENCE_DOC in eval-config.ts, 1 row in benchmark_results |
| D-21 | 01-07 | Hardcoded "2.1.0" engine_version in benchmark_results rows | VERIFIED | ENGINE_VERSION = "2.1.0" in aggregator.ts line 17; used by baseline.ts and confirmed in live DB row |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| eval-harness.ts | 162 | `spearman_within_niche: NICHES.reduce(... 0 ...)` — placeholder comment "computed in Plan G if time permits" | Info | Spearman is hardcoded to 0.0 per niche in output; DB row confirms this (all zeros). Documented in v2.1-baseline.md §Zero Spearman. Not load-bearing for baseline accuracy measurement. |
| eval-harness.ts | 170 | `drift_metrics: {}` — Phase 1 explicit TODO | Info | Empty object persisted to DB. drift_metrics column is empty. Not required for Phase 1 — acknowledged as Phase 4+ concern. |

Both anti-patterns are explicitly documented as intentional Phase 1 deferrals. Neither blocks the phase goal.

---

### Human Verification Required

None. Phase 01 produces measurement infrastructure only (no UI). All checks are programmatic.

---

### Gaps Summary

No blocking gaps. The two known shortfalls are:

1. **Corpus size** (225 rows vs 500-row ROADMAP target): Documented in v2.1-baseline.md, 01-06-SUMMARY.md, and the pilot retrospective. Root cause is the Apify FREE-tier account quota. The apidojo migration is code-complete. The measurable baseline (the primary deliverable) is fully functional on the 225-row corpus. Deferred to Phase 4+ corpus refresh.

2. **completion_pct = null**: Documented KNOWN GAP in normalize-scrape.ts (line 24), v2.1-baseline.md §Known Gap, and the pilot retrospective. Not available from any Apify actor. Deferred to the in-product outcome scraper (future milestone).

Both shortfalls appear in the verifier brief's "Known limitations — DO NOT fail on these" list and are documented in the committed phase artifacts, not silently dropped.

**Phase goal achieved:** The measurement infrastructure is operational. The v2.1 baseline row is sealed in Supabase. The D-18 threshold rule establishes macro_f1 ≥ 0.338 as the v3 acceptance gate. All future phases (4-12) have a concrete, measurable benchmark to beat.

---

_Verified: 2026-05-11T15:10:00Z_
_Verifier: Claude (gsd-verifier)_
