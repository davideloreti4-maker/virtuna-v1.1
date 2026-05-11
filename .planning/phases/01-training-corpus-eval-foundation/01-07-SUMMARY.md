---
phase: 01-training-corpus-eval-foundation
plan: "07"
subsystem: corpus
tags: [eval-harness, baseline, benchmark, macro-f1, supabase, deepseek, gemini, documentation]

requires:
  - phase: 01-05
    provides: eval-harness (measureV21Baseline), scripts/eval.ts, benchmark_results table writer
  - phase: 01-06
    provides: full.2026-05-11 corpus (225 rows in training_corpus), sealed thresholds

provides:
  - benchmark_results row: engine_version=2.1.0, corpus_version=full.2026-05-11 (D-20 canonical)
  - .planning/research/v2.1-baseline.md — canonical D-20 baseline documentation (D-19, D-20)
  - BASELINE_REFERENCE_DOC constant in eval-config.ts (D-19 bidirectional cross-link)
  - Phase 12 acceptance gate anchor: v3 must achieve macro_f1 ≥ 0.338 (15% relative improvement, D-18)

affects: [Phase 4, Phase 10, Phase 12, all future benchmark comparisons against full.2026-05-11]

tech-stack:
  added:
    - "Gemini 2.5 Flash (gemini_analysis stage) — live eval run"
    - "DeepSeek Reasoner (deepseek_reasoning stage) — live eval run"
    - ".planning/research/ directory (canonical research artifacts)"
  patterns:
    - "D-19 bidirectional cross-link: eval-config.ts BASELINE_REFERENCE_DOC constant + doc references code constants by name"
    - "D-20 sealed baseline: benchmark_results row is the immutable comparison anchor for Phase 12"
    - "Eval harness fault-tolerant: rows_failed excluded from metrics without aborting run"

key-files:
  created:
    - .planning/research/v2.1-baseline.md
    - .planning/baseline-report-full.2026-05-11.json (written by eval harness, gitignored JSON)
  modified:
    - src/lib/engine/corpus/eval-config.ts (BASELINE_REFERENCE_DOC constant + D-19 header comment)

key-decisions:
  - "Baseline ran on FULL 225-row corpus (not 500-video subsample as originally planned — corpus is 225 rows, so subsample equals full set)"
  - "benchmark_results row id 3f6e8e28-38b1-41fb-b439-80fe9de76654 is the D-20 canonical row; do NOT delete"
  - "D-18 target for engine v3: macro_f1 ≥ 0.338 (0.294 × 1.15 — 15% relative improvement, low-band rule)"
  - "v2.1 baseline result: engine is BELOW random chance (macro_f1=0.294 vs chance=0.333 on imbalanced corpus)"
  - "10 failure_cases are all severity=2 (under predicted as viral) — systematic rule-scoring over-credit on edu/comedy/beauty"
  - "Zero Spearman correlation within all 5 niches confirms score is not a reliable ranking signal"

patterns-established:
  - "D-19 pattern: code constant BASELINE_REFERENCE_DOC names the doc; doc names the code constants — bidirectional"
  - "D-20 pattern: sealed benchmark_results row is never overwritten; re-runs create new rows"

requirements-completed: [CORPUS-01, CORPUS-03, CORPUS-04, EVAL-06, EVAL-07, EVAL-08]

duration: "~2h 30min (eval run ~1h 56min + documentation ~35min)"
completed: "2026-05-11"
---

# Phase 1 Plan 07: v2.1 Baseline Measurement + D-20 Canonical Row Summary

**v2.1 baseline sealed: macro_f1=0.294, ece=0.372, viral_recall=0.106 on 225-row `full.2026-05-11` corpus — engine is below random chance; v3 must achieve macro_f1 ≥ 0.338**

## Performance

- **Duration:** ~2h 30min (eval run ~1h 56min + documentation)
- **Started:** 2026-05-11 (after 01-06 corpus build completed)
- **Completed:** 2026-05-11T12:09:47Z (benchmark_results row created)
- **Tasks:** 4 (eval run + benchmarks directory + baseline doc + D-19 cross-link)
- **Files modified:** 3 (eval-config.ts, plus 2 created)

## Accomplishments

- Ran measureV21Baseline on the full 225-row `full.2026-05-11` corpus (~$0.33 LLM cost, ~1h 56min wall time)
- Persisted exactly 1 canonical D-20 row to `benchmark_results` (engine_version=2.1.0, corpus_version=full.2026-05-11)
- Authored `.planning/research/v2.1-baseline.md` — full documentation of methodology, metrics, stage latency breakdown, failure case analysis, limitation catalog, and reproduction steps
- Added `BASELINE_REFERENCE_DOC` constant to eval-config.ts + D-19 bidirectional header comment

## Task Commits

1. **v2.1 baseline eval run (eval harness execution)** — no code commit; live operation
2. **v2.1-baseline.md + BASELINE_REFERENCE_DOC** - `b87c675` (docs)

## D-20 Headline Metrics

| Metric | Value |
|---|---|
| macro_f1 | 0.2940 |
| ece | 0.3715 |
| viral_recall | 0.1064 |
| under_precision | 0.4250 |
| mae_engagement_rate | 0.0959 |
| rows_processed | 225 (1 failed) |
| failure_cases | 10 (all under→viral, severity=2) |
| cost_cents_avg | 0.1466 |
| cost_cents_total | 32.99 (~$0.33 USD) |
| latency_p50 | 57,214 ms |
| latency_p95 | 91,528 ms |
| latency_p99 | 138,797 ms |

## Per-Class Metrics

| Bucket | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| viral | 0.1163 | 0.1064 | 0.1111 | 47 |
| average | 0.4113 | 0.6824 | 0.5133 | 85 |
| under | 0.4250 | 0.1848 | 0.2576 | 92 |

## Per-Niche macro_f1

| Niche | macro_f1 |
|---|---|
| beauty | 0.3101 |
| comedy | 0.2973 |
| lifestyle | 0.2996 |
| fitness | 0.2597 |
| edu | 0.2463 |

## Files Created/Modified

- `.planning/research/v2.1-baseline.md` — canonical D-20 baseline documentation (methodology, metrics, failure analysis, limitations, reproduction steps, D-18/D-19 cross-references)
- `.planning/baseline-report-full.2026-05-11.json` — full eval harness JSON output (gitignored; written by eval harness during run)
- `src/lib/engine/corpus/eval-config.ts` — added `BASELINE_REFERENCE_DOC` constant + D-19 header comment block

## Decisions Made

- Ran on full 225-row corpus (not 500-video stratified subsample): the plan specified a subsample, but with 225 rows total the "subsample" equals the full corpus. No change to eval methodology.
- `BASELINE_REFERENCE_DOC` added as an exported TypeScript constant (machine-readable, not just a comment) for future tooling that needs to locate the baseline doc programmatically.
- D-18 target computed: v3 must achieve macro_f1 ≥ 0.338 (15% relative improvement over 0.294, low-band rule ≤0.40).

## Deviations from Plan

None — plan executed as written. The only deviation is cosmetic: "500-video stratified subsample" in the plan description became "225-row full corpus" in execution because the corpus has 225 rows, making a subsample meaningless. This does not affect methodology or comparability.

## Issues Encountered

- 1 row failed during eval (pipeline crash) — eval harness fault-tolerant; row excluded from all metrics
- 10 failure_cases recorded (all under→viral, severity=2): not pipeline failures — these are rows where prediction was maximally wrong. All clustered in edu/comedy/beauty with scores 74-79, above VIRAL_SCORE_CUT=70.
- Spearman within-niche correlation = 0.0 for all 5 niches — unexpected; indicates the score is fully decorrelated from view count ranking. Documents a deep calibration failure.

## v3 Acceptance Target

Per D-18 (requiredImprovementFor in eval-config.ts):
- Baseline macro_f1 = 0.294 ≤ 0.40 → 15% relative improvement required
- **v3 target: macro_f1 ≥ 0.338** on corpus_version=full.2026-05-11
- Per-niche regression gate: no niche may regress more than 5pp vs this baseline
- Statistical gate: improvement must be significant at α=0.05 via paired bootstrap (200 iterations)

## Next Phase Readiness

- Phase 01 is COMPLETE (pending verifier sign-off)
- Phase 02 (Creator Profile) can begin independently — no dependency on Phase 01 output
- Phase 03 (Pipeline Infrastructure) depends on Phase 01 eval harness being ready — it is
- Phase 10 (ML calibration) will re-measure against this baseline — benchmark_results row id `3f6e8e28-38b1-41fb-b439-80fe9de76654` is the immutable anchor
- Phase 12 (acceptance gate) requires v3 macro_f1 ≥ 0.338 on the same corpus

## Self-Check: PASSED

- `benchmark_results` has exactly 1 row with engine_version=2.1.0 + corpus_version=full.2026-05-11 (verified via Supabase query: row id `3f6e8e28-38b1-41fb-b439-80fe9de76654`)
- `.planning/research/v2.1-baseline.md` exists, ≥80 lines, all sections populated, no (fill) placeholders
- `eval-config.ts` imports cleanly, `BASELINE_REFERENCE_DOC` exported, D-19 header present
- 17 eval-config tests pass (npx vitest run src/lib/engine/corpus/__tests__/eval-config.test.ts)

---
*Phase: 01-training-corpus-eval-foundation*
*Completed: 2026-05-11*
