---
phase: 08-benchmark-retrieval
plan: 04
subsystem: engine
tags: [retrieval-stage, pipeline, aggregator, wave-1, score-weights, pgvector, integration]

# Dependency graph
requires:
  - phase: 08-benchmark-retrieval/02
    provides: RetrievalEvidenceItem + BenchmarkRetrievalResult Zod schemas, SignalAvailability.retrieval, PredictionResult.retrieval_score + retrieval_evidence + score_weights.retrieval
  - phase: 08-benchmark-retrieval/03
    provides: buildSubjectText, embedQuery (embedder), matchTrainingCorpus/matchScrapedVideos (pgvector-client), softRerank (re-ranker), deriveBucket/bucketValue/CORPUS_NICHE_ALIASES (bucket-derivation), MatchRow + MatchOptions types
  - phase: 04-wave-0-content-type-niche-detection
    provides: NICHE_TREE.benchmark_filters.min_corpus_size (read by D-04b gate), wave0Result.niche.primary (read by retrieval-stage filter dimension)
  - phase: 03-pipeline-infrastructure
    provides: timed() wrapper + Wave 1 Promise.all + StageEventCallback + SignalAvailability forward-compat pattern (Phase 8 extends)
provides:
  - runBenchmarkRetrieval (Wave 1 orchestrator — D-04 3-tier hierarchical relaxation + D-04a soft hashtag re-ranker + D-04b min_corpus_size gate + D-09 niche-null guard + graceful degradation)
  - PipelineResult.retrievalResult (Wave 1 5-sibling output)
  - aggregator SCORE_WEIGHTS D-03b values (behavioral 0.33 / gemini 0.24 / ml 0.14 / rules 0.14 / trends 0.10 / retrieval 0.05)
  - aggregator SignalAvailability.retrieval population from pipelineResult.retrievalResult.availability (D-10)
  - aggregator overall_score retrieval term: ((retrievalResult.score ?? 0) * 100) * weights.retrieval (D-03)
  - aggregator PredictionResult.retrieval_score + retrieval_evidence assembly (D-11)
affects: [08-05-PLAN.md (live DB push + auto-embed paths + backfill CLI), 10-ml-audit-calibration (retrieval weight tuning per D-03b), M2 intelligence surface (consumes retrieval_evidence rich shape)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave-1 sibling stage that self-emits stage_start/stage_end events (pipeline.ts plain try/catch wrapper — NO timed() wrapping; matches niche-detector.ts pattern, NOT rule_scoring pattern)"
    - "vi.hoisted() for test mocks referenced from vi.mock factories (avoids 'Cannot access before initialization' from vitest hoisting)"
    - "SCORE_WEIGHT_KEYS as load-bearing constant — every weight-bearing key MUST be in the tuple OR the new weight is silently dropped by selectWeights filter (Critical Cross-File Constraint #1)"

key-files:
  created:
    - src/lib/engine/retrieval/retrieval-stage.ts
    - src/lib/engine/__tests__/retrieval/retrieval-stage.test.ts
  modified:
    - src/lib/engine/pipeline.ts
    - src/lib/engine/aggregator.ts
    - src/lib/engine/__tests__/pipeline.test.ts
    - src/lib/engine/__tests__/aggregator.test.ts
    - src/lib/engine/__tests__/factories.ts

key-decisions:
  - "D-03 score scaled by 100 in overall_score: ((retrievalResult.score ?? 0) * 100) * weights.retrieval — retrieval score is [0,1], other scores are [0,100]; multiplication preserves the magnitude relationship in the weighted sum"
  - "D-04b min_corpus_size gate operates on TOTAL pool size (collected.length), not on surviving K — a small candidate pool means low confidence regardless of how good top matches look"
  - "Persisted RetrievalEvidenceItem.similarity_score is RAW cosine (m.similarity), not softRerank's rerank_score — the +5% hashtag bonus is sort-key only; persisting it would pollute D-03's bucket-vote denominator"
  - "Education→edu alias applied ONLY to training_corpus RPC call; scraped_videos uses NICHE_TREE form ('education') because Plan 01 backfilled primary_niche column from category to NICHE_TREE slug"
  - "Per-tier try/catch around each RPC call — defense in depth on top of outer graceful-degradation try/catch (a single tier's failure doesn't abandon retrieval entirely; retrieval-stage continues to the next tier)"

patterns-established:
  - "Wave-1 sibling self-emit pattern: stage emits its own stage_start/stage_end via emitStageStart/emitStageEnd (matches niche-detector.ts); pipeline.ts wraps in plain try/catch, NOT timed() (would double-emit events and break event-count assertions in pipeline.test.ts)"
  - "Test mock pattern with vi.hoisted: define mock fns inside vi.hoisted() block, destructure them; vi.mock factories can reference them because they are themselves hoisted to the top of the file"
  - "Graceful-empty constant DEFAULT_RETRIEVAL_RESULT in pipeline.ts mirrors the GRACEFUL_EMPTY in retrieval-stage.ts (defense in depth — both layers return the same shape if anything escapes the inner catch)"

requirements-completed: [RETRIEVAL-04, RETRIEVAL-05]

# Metrics
duration: 13min
completed: 2026-05-18
---

# Phase 8 Plan 04: retrieval-stage orchestration + pipeline Wave-1 wiring + aggregator retrieval signal Summary

**runBenchmarkRetrieval Wave-1 sibling with D-04 3-tier hierarchical relaxation + D-04a soft hashtag re-ranker + D-04b min_corpus_size gate, wired into pipeline.ts and aggregator.ts (SCORE_WEIGHTS D-03b 0.33/0.24/0.14/0.14/0.10/0.05) with PredictionResult.retrieval_score + retrieval_evidence persistence.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-05-18T19:37:19Z
- **Completed:** 2026-05-18T19:50:01Z
- **Tasks:** 4 (3 TDD + 1 regression invariant)
- **Files created:** 2 (retrieval-stage.ts + retrieval-stage.test.ts)
- **Files modified:** 5 (pipeline.ts, aggregator.ts, pipeline.test.ts, aggregator.test.ts, factories.ts)

## Accomplishments

- `runBenchmarkRetrieval` orchestrator wires Plan 03 leaf modules into a Wave-1 stage with 3-tier hierarchical relaxation (strict / niche+platform / niche_only), corpus-first / scraped-fallback pool order (D-01), soft hashtag re-ranker, min_corpus_size pool-size gate, education→edu alias direction, raw-cosine persistence (sort-key bonus not leaked into evidence), graceful degradation, and self-emitted stage events
- `pipeline.ts` Wave-1 Promise.all now has 5 siblings (gemini / audio / creator / rules / retrieval); plain try/catch wrapper around `retrievalPromise` (NO timed() — would double-emit since retrieval-stage self-emits per Critical Cross-File Constraint #3); `PipelineResult.retrievalResult: BenchmarkRetrievalResult` field exposed
- `aggregator.ts` SCORE_WEIGHTS redistributed per D-03b (×0.95 of previous values; trends rounds back to 0.10 per locked matrix; sum = 1.00); SCORE_WEIGHT_KEYS tuple includes 'retrieval' (load-bearing per Critical Cross-File Constraint #1 — selectWeights filter would silently drop the new weight otherwise); selectWeights return type + result initializer extended with retrieval slot; SignalAvailability.retrieval populated from pipelineResult.retrievalResult.availability (D-10); overall_score formula adds null-safe `((retrievalResult.score ?? 0) * 100) * weights.retrieval` term (D-03 score is [0,1], × 100 matches other [0,100] terms); PredictionResult assembly adds retrieval_score + retrieval_evidence (D-11)
- All 13 cross-plan TypeScript errors flagged by Plan 03's SUMMARY closed: `aggregator.ts(330)` + `aggregator.ts(536)` + `pipeline.ts(132)` + 11 `aggregator.test.ts` SignalAvailability literal errors → 0 errors in scope
- BENCH-05 invariant satisfied: **842 tests pass** (vs. 820 baseline), 22 new tests added, zero regressions, all existing pipeline + aggregator + retrieval tests green

## Task Commits

Each task was committed atomically (TDD test → impl pattern):

1. **Task 1 RED: runBenchmarkRetrieval failing tests** — `c3ca8e9` (test)
2. **Task 1 GREEN: runBenchmarkRetrieval implementation** — `135705e` (feat)
3. **Task 2 RED: pipeline Wave-1 sibling failing tests** — `50aeea5` (test)
4. **Task 2 GREEN: runBenchmarkRetrieval wired into pipeline.ts** — `735cac1` (feat)
5. **Task 3 RED: aggregator retrieval-integration failing tests** — `fc9c292` (test)
6. **Task 3 GREEN: aggregator SCORE_WEIGHTS + SignalAvailability + overall_score + PredictionResult** — `8ade02b` (feat)
7. **Task 4: cross-plan CreatorContext shape closure** — `e8c5819` (fix)

_Note: Task 4 was scheduled as a no-file-changes regression check, but during verification one in-scope TS error remained on pipeline.ts(132) DEFAULT_CREATOR_CONTEXT — pre-existing gap from Phase 2 D-19 fields. Closed as a one-line fix since the spawn prompt flagged it as part of the 13 known cross-plan errors._

## Files Created/Modified

### Created

- `src/lib/engine/retrieval/retrieval-stage.ts` — `runBenchmarkRetrieval` Wave-1 sibling. 264 lines. Exports: `runBenchmarkRetrieval`, `RunBenchmarkRetrievalInput`. Logger namespace: `retrieval.stage`. Self-emits stage events. Never throws.
- `src/lib/engine/__tests__/retrieval/retrieval-stage.test.ts` — 12 behavior tests (happy path / mixed tiers / all-zero pool / scraped fills / min_corpus_size gate / niche-null guard / embedder throw / RPC throw / D-03 numeric assertion 1.9/2.6≈0.731 / event ordering / raw cosine persisted / education→edu alias direction).

### Modified

- `src/lib/engine/pipeline.ts` — Added `runBenchmarkRetrieval` import; extended `PipelineResult` with `retrievalResult: BenchmarkRetrievalResult`; added `DEFAULT_RETRIEVAL_RESULT` graceful-empty constant; added `retrievalPromise` as 5th Wave-1 sibling (plain try/catch wrapper — NO timed()); expanded Wave 1 `Promise.all` destructure to 5 slots; pushed "Retrieval unavailable: ..." warning on failure; added `retrievalResult` to final return object; updated Wave-1 Sentry breadcrumb stages list; closed pre-existing `DEFAULT_CREATOR_CONTEXT` shape gap (Phase 2 D-19 fields).
- `src/lib/engine/aggregator.ts` — SCORE_WEIGHTS replaced with D-03b values (behavioral 0.33 / gemini 0.24 / ml 0.14 / rules 0.14 / trends 0.10 / retrieval 0.05); SCORE_WEIGHT_KEYS tuple extended with 'retrieval' (LOAD-BEARING); selectWeights return type + result initializer extended; SignalAvailability assembly populates retrieval from `pipelineResult.retrievalResult.availability`; overall_score formula adds null-safe retrieval term scaled × 100; PredictionResult adds `retrieval_score` + `retrieval_evidence`.
- `src/lib/engine/__tests__/pipeline.test.ts` — Added `vi.hoisted` mock for `runBenchmarkRetrieval` + `vi.mock("@/lib/engine/retrieval/retrieval-stage")`. Added 3 new tests under "Phase 8 — Wave 1 retrieval sibling" describe (retrievalResult shape / invocation contract / failure-warning graceful path).
- `src/lib/engine/__tests__/aggregator.test.ts` — Added `retrieval: <bool>` field to every existing SignalAvailability literal (11 sites); switched base-weight expectations from 0.35/0.25/0.15/0.15/0.10 to D-03b 0.33/0.24/0.14/0.14/0.10/0.05; added 2 new selectWeights tests under "Phase 8 retrieval slot" describe; added 5 new aggregateScores tests under "Phase 8 — aggregator retrieval integration" describe.
- `src/lib/engine/__tests__/factories.ts` — Added Phase 2 D-19 fields to default creatorContext + Phase 8 retrievalResult graceful-empty default on makePipelineResult.

## Decisions Made

1. **D-03 score scaled × 100 in overall_score formula** — retrievalResult.score is in [0,1] (D-03 normalized similarity-weighted vote); other terms (behavioral_score, gemini_score, mlScore, ruleResult.rule_score, trendEnrichment.trend_score) are in [0,100]. Without the × 100 multiplier, retrieval would contribute only ~0.04 max instead of ~4 max, making the 0.05 weight effectively meaningless. The × 100 preserves D-03b's intent that retrieval is a low-but-real signal contribution (~4 / 100 max).

2. **`?? 0` null safety in the overall_score retrieval term** — when retrievalResult.score is null (D-04b gate fired OR zero matches survived OR graceful degradation), the term must contribute 0. JavaScript's `null * 100 * 0.05 = 0`, but `null * 100` is `0` in JS arithmetic (NaN coercion edge case for null is well-defined: `null` → 0 in numeric contexts). The `?? 0` is explicit defensive coding to make the intent unambiguous in code review.

3. **DEFAULT_RETRIEVAL_RESULT graceful-empty constant in pipeline.ts** — defense in depth. retrieval-stage.ts already has its own outer try/catch returning a graceful-empty shape, but per T-08-16's mitigation pattern ("pipeline.ts ALSO wraps in try/catch — if retrieval-stage's internal catch somehow fails"), the pipeline keeps its own fallback. Costs 6 lines of code; gains a guaranteed BENCH-05 invariant (retrieval failure NEVER breaks the prediction pipeline).

4. **vi.hoisted pattern for cross-mock referencing** — vi.mock factories run BEFORE module imports per vitest's hoisting model. Top-level `const mockX = vi.fn()` cannot be referenced from inside a vi.mock factory (ReferenceError: cannot access before initialization). vi.hoisted explicitly marks the mock-fn declarations for hoisting to the top alongside vi.mock. Same pattern can be applied to future test mocks that need cross-referencing.

5. **factories.ts CreatorContext + retrievalResult populated as defaults** — strictly speaking out of Plan 04's primary scope (it's a test factory, not a deliverable file), but closing it was necessary so `tsc --noEmit` could reach 0 errors in scope (the factory's CreatorContext was missing 13 Phase 2 fields per a pre-existing gap). Also future-proofs aggregator tests that override retrievalResult — without a default, every test would need to specify the full BenchmarkRetrievalResult shape inline.

6. **Education→edu alias direction** — per RESEARCH lines 1026-1028 + 1074, training_corpus stores 'edu' (migration CHECK constraint) but scraped_videos stores 'education' (NICHE_TREE form, per Plan 01's category→slug backfill). The alias is applied ONLY at the matchTrainingCorpus call site; matchScrapedVideos uses the primary directly. Test 12 explicitly asserts this direction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vi.mock hoisting incompatibility with top-level mock fn declarations**
- **Found during:** Task 1 GREEN verification (first test run after implementing retrieval-stage.ts)
- **Issue:** vitest hoists vi.mock factories to the top of the file, but the top-level `const mockBuildSubjectText = vi.fn(...)` could not be referenced from inside the vi.mock factory (ReferenceError: Cannot access 'mockBuildSubjectText' before initialization). The test file failed to load (0 tests run).
- **Fix:** Wrapped all four cross-referenced mock fns (mockEmbedQuery, mockBuildSubjectText, mockMatchCorpus, mockMatchScraped) in a single vi.hoisted() call. vi.hoisted explicitly marks declarations for hoisting alongside vi.mock factories.
- **Files modified:** `src/lib/engine/__tests__/retrieval/retrieval-stage.test.ts` (test file only — no production code change)
- **Verification:** `pnpm vitest run src/lib/engine/__tests__/retrieval/retrieval-stage.test.ts` exits 0 with 12/12 tests passing.
- **Committed in:** `135705e` (Task 1 GREEN commit, alongside the implementation)

**2. [Rule 3 - Blocking] pipeline.ts(132) DEFAULT_CREATOR_CONTEXT Phase 2 fields gap**
- **Found during:** Task 4 verification (running `pnpm tsc --noEmit` after Task 3 GREEN)
- **Issue:** One in-scope TS error remained: `DEFAULT_CREATOR_CONTEXT` was missing the 13 Phase 2 D-19 fields (target_platforms, niche_primary, niche_sub, target_audience, primary_goal, creator_stage, content_style, cuts_per_second, reference_creators, past_wins, past_flops, time_of_day_aware, pain_points). This is a pre-existing gap from a previous phase, but the spawn prompt explicitly flagged it as one of the "13 known TS errors flagged by Plan 02" that Plan 04 was supposed to close.
- **Fix:** Added the 13 Phase 2 fields to DEFAULT_CREATOR_CONTEXT (all null — same graceful-degradation default as factories.ts).
- **Files modified:** `src/lib/engine/pipeline.ts`
- **Verification:** `pnpm tsc --noEmit | grep '^src/lib/engine/(aggregator|pipeline)\.ts'` returns 0 lines; all 4 pipeline tests passing.
- **Committed in:** `e8c5819` (fix commit; Task 4 final closure)

---

**Total deviations:** 2 auto-fixed (2 blocking, both per Rule 3)
**Impact on plan:** Both auto-fixes essential for completion. Deviation 1 was a test-runner-API gotcha (vitest hoisting model) that could not be predicted from the plan; Deviation 2 was already flagged in the spawn prompt as in-scope but landed in an unrelated file. Zero scope creep beyond plan deliverables.

## Issues Encountered

Some `tsc --noEmit` errors persist after Plan 04, all pre-existing and out of scope per SCOPE BOUNDARY rule:

- **1203 `Cannot find name 'vi' / 'describe' / 'expect' / 'beforeEach'` errors** across `__tests__/*.test.ts` — pre-existing project-wide test-runtime-type gap (documented in Plan 03 SUMMARY). Vitest globals are wired at runtime via `globals: true` in `vitest.config.ts`, but the project's `tsconfig.json` `types` array doesn't include `vitest/globals`. Same condition existed before Plan 04 started. Fix is a one-line tsconfig change; deferred to a project hygiene phase since it's orthogonal to Phase 8.
- **78 `src/app/api/profile/*` + `src/app/api/team/*` route errors** referencing `user_settings` + `team_members` tables — completely unrelated to Phase 8; these tables exist in production Supabase but are absent from the local `src/types/database.types.ts` snapshot. Plan 05 (or a future schema-sync phase) will regen types.

All in-scope files (aggregator.ts, pipeline.ts, retrieval/*.ts, aggregator.test.ts, factories.ts) report **0 TypeScript errors** after Plan 04.

## Threat Surface Scan

No new threat surface introduced beyond the plan's existing `<threat_model>` block (T-08-16 through T-08-21). All mitigations applied as designed:

- **T-08-16 (retrieval-stage error inside Wave 1)** — defense in depth: retrieval-stage's outer try/catch returns GRACEFUL_EMPTY + pipeline.ts also wraps in try/catch returning DEFAULT_RETRIEVAL_RESULT. BENCH-05 invariant verified: retrieval failure never breaks the pipeline (Test 7 + Test 8 in retrieval-stage.test.ts + Test 3 "retrieval failure pushes warning" in pipeline.test.ts).
- **T-08-17 (niche slug spoofing)** — wave0Result.niche.primary is internally produced by Phase 4's V3 classifier (trusted source). Plan 04's retrieval-stage uses it as-is in RPC `filter_niche` (parameterized binding — no string interpolation). The NICHE_TREE.find() lookup returns undefined for unknown slugs → graceful 0-gate fallback (Test 5).
- **T-08-18 (retrieval_evidence PII)** — accepted risk per plan; no new PII introduced. All evidence fields (creator_handle, video_url, caption_snippet, engagement metrics) are PUBLIC TikTok content.
- **T-08-19 (SCORE_WEIGHT_KEYS extension drift)** — TypeScript-enforced. The new `retrieval` key is in the const tuple; selectWeights() return type expanded to include it; tests assert numeric values (0.33/0.24/0.14/0.14/0.10/0.05) at the type and runtime level.
- **T-08-20 (retrieval-stage timing inside Wave 1)** — accepted risk; performance budget intact (gemini_video_analysis dominates the wave).
- **T-08-21 (Sentry tags)** — `Sentry.captureException` calls in retrieval-stage.ts + pipeline.ts use only `stage`, `source`, `requestId` tags (no caption text, no filter values).

## User Setup Required

None — no external service configuration required. Plan 04 is purely a code wiring change. Plan 05 will need: live DB push of Plan 01's migration, Gemini API key (already configured), Supabase service role key (already configured).

## Next Phase Readiness

**Ready for Plan 05 (live DB push + auto-embed + backfill CLI):**

- `runBenchmarkRetrieval` is importable from `@/lib/engine/retrieval/retrieval-stage` — Plan 05's backfill CLI calls embedBatch + Plan 01's match_*_videos RPCs directly; runBenchmarkRetrieval itself is the predict-time path (no Plan 05 change needed).
- `BenchmarkRetrievalResult` shape is enforced by Zod (Plan 02) AND TypeScript (Plan 04 wiring). Plan 05's auto-embed paths (orchestrator.ts + apify webhook) compute embeddings at INSERT time and store them on the row — no impact on Plan 04's predict-time path.
- The 5 non-calibrated niches' `NON_CORPUS_ENGAGEMENT_PERCENTILES` placeholders remain at `{ p80: 0, p40: 0 }` — Plan 05's `--derive-percentiles` mode will overwrite with real P80/P40 after backfill completes.

**Blockers:** None.

**Phase 8 code-only deliverables COMPLETE.** Live DB push + Apify webhook embed wiring + backfill CLI runtime + percentile derivation = Plan 05.

## Self-Check: PASSED

**File existence:**

- `src/lib/engine/retrieval/retrieval-stage.ts` — FOUND
- `src/lib/engine/__tests__/retrieval/retrieval-stage.test.ts` — FOUND
- `src/lib/engine/pipeline.ts` — MODIFIED
- `src/lib/engine/aggregator.ts` — MODIFIED
- `src/lib/engine/__tests__/pipeline.test.ts` — MODIFIED
- `src/lib/engine/__tests__/aggregator.test.ts` — MODIFIED
- `src/lib/engine/__tests__/factories.ts` — MODIFIED

**Commit existence (verified via `git log --oneline`):**

- `c3ca8e9` test(08-04): add failing tests for runBenchmarkRetrieval — FOUND
- `135705e` feat(08-04): implement runBenchmarkRetrieval Wave-1 orchestrator — FOUND
- `50aeea5` test(08-04): add failing pipeline tests for Wave 1 retrieval sibling — FOUND
- `735cac1` feat(08-04): wire runBenchmarkRetrieval into pipeline.ts Wave 1 — FOUND
- `fc9c292` test(08-04): add failing aggregator tests for Phase 8 retrieval integration — FOUND
- `8ade02b` feat(08-04): extend aggregator.ts with retrieval signal (D-03b + D-10 + D-11) — FOUND
- `e8c5819` fix(08-04): close pre-existing CreatorContext shape gap in DEFAULT_CREATOR_CONTEXT — FOUND

**Test suite verification:** 842 passed, 4 skipped, 0 failed (vs. 820 baseline before Plan 04 — exactly 22 new tests added: 12 retrieval-stage + 3 pipeline + 7 aggregator-related).

**TypeScript verification:** All in-scope files (aggregator.ts, pipeline.ts, retrieval/*.ts, aggregator.test.ts, factories.ts) report 0 TS errors. Remaining 1281 errors are pre-existing project-wide test-globals + unrelated app route issues (documented above + in Plan 03's SUMMARY).

---

*Phase: 08-benchmark-retrieval*
*Completed: 2026-05-18*
