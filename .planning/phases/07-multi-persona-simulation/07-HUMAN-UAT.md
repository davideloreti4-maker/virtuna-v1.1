---
status: partial
phase: 07-multi-persona-simulation
source: [07-VERIFICATION.md]
started: 2026-05-19T08:35:00Z
updated: 2026-05-19T08:35:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Full 225-row A/B eval — operator-gated live LLM run

expected: Run `npx tsx scripts/run-persona-ab-eval.ts --corpus-version full.2026-05-11` from the project root. Both runs (deepseek baseline + personas substitution) complete in 30–45 min wall-clock at ~$0.20–0.40 total LLM cost. Comparison report at `.planning/research/persona-aggregate-ab-YYYY-MM-DD.md` populates with full-corpus deltas (macro_f1, ECE, viral_recall, under_precision). `benchmark_results` table has 2 new rows tagged `3.0.0-dev-personasA` and `3.0.0-dev-personasB`. Operator fills in the "Recommendation for Phase 10" section based on the deltas.

result: [pending]

### 2. Persona intent-score rescale factor (WR-01 fix) empirical validation

expected: Phase 10 corpus calibration confirms the `intent 100 → 5% view rate` rescale anchor at `src/lib/engine/aggregator.ts:584-587` is empirically sound for `computePredictedEngagement` when `behavioralSource = 'personas'`. If empirically wrong, the rescale factor moves and the aggregator updates.

result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
