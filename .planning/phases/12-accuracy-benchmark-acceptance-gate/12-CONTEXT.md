# Phase 12: Accuracy Benchmark + Acceptance Gate - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Final acceptance gate for the Engine Foundation milestone. Run the full benchmark of engine v3 against corpus, determine go/no-go, and prepare milestone for merge. This is the last phase — the milestone ships when this passes.

**Three sequential sub-phases:**

1. **Re-baseline** — Re-measure v2.1 on the current (full) corpus to get an apples-to-apples comparison point. The Phase 1 baseline was measured on 225 rows; the corpus may have grown since.
2. **Smoke run** — Run a small subset (20-25 rows, full metrics preview) to validate cost, latency, and get early accuracy signal before committing to a full $30-40 run.
3. **Full benchmark (conditional)** — Run the full corpus. User decides after seeing smoke results.

**Deliverables:**
- Benchmark report (BenchmarkReport JSON + summary markdown)
- ENGINE_VERSION flip from `3.0.0-dev` to `3.0.0` (only after benchmark passes)
- Milestone sign-off with user review

**Out of scope this phase:**
- Any engine pipeline changes or signal tuning — Phase 10 owns this
- New UI features — Phase 11 / M2 (Intelligence Surface) territory
- CHANGELOG or release notes — no ceremony needed
</domain>

<decisions>
## Implementation Decisions

### Benchmark Execution Flow
- **D-01: Staged approach.** Smoke run first (20-25 rows, 5 per niche per bucket, full metrics preview). User decides whether to proceed to full run based on smoke results. The v2.1 baseline was a single-shot run with no staging — we're adding a smoke stage for safety.
- **D-02: Smoke validates full metrics.** Macro-F1, per-signal contribution (leave-one-out), calibration (ECE), cost per analysis, latency, and crash-free completion. Not just a "did it crash" check.

### Version Flip Timing
- **D-03: Flip AFTER benchmark passes.** ENGINE_VERSION stays at `3.0.0-dev` throughout the benchmark run(s). Only flip to `3.0.0` in `version.ts` if the acceptance gate passes. This avoids having to revert a version tag if the benchmark fails.

### Failure & Gate Decisions
- **D-04: User is the gate for near-miss.** If benchmark narrowly misses target (e.g., macro_f1 = 0.330 vs required 0.338), the user decides — soft gate (accept with note) or hard gate (block milestone). Not automated.
- **D-05: Hard gate on negative signal contribution (BENCH-06).** If per-signal analysis shows any signal subtracting from accuracy, the milestone blocks. The offending signal must be disabled or fixed before shipping. This is a non-negotiable requirement.

### Sign-Off Process
- **D-06: Minimal sign-off artifacts.** Only the benchmark report (BenchmarkReport JSON) + a summary markdown file. No CHANGELOG, no release notes.
- **D-07: User reviews before merge.** The benchmark report is presented for user review. User gives explicit go-ahead before miletsone/engine-foundation merges.

### Baseline Comparison
- **D-08: Re-measure v2.1 on current corpus.** Before running any v3 benchmark, re-run the baseline benchmark on the current corpus snapshot. This ensures an apples-to-apples comparison. The re-baseline run uses the same eval-harness as the Phase 1 baseline, just on the updated corpus.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase & Requirements
- `.planning/ROADMAP.md` §280 — Phase 12 definition, success criteria, `Depends on: Phase 11`
- `.planning/REQUIREMENTS.md` §215-220 — BENCH-01 through BENCH-06 requirements

### Baseline & Threshold
- `.planning/research/v2.1-baseline.md` — Sealed v2.1 baseline measurement, target threshold (macro_f1 ≥ 0.338), D-18 sliding-scale rule, per-niche regression gate (±5pp), statistical gate (α=0.05 bootstrap)

### Eval Infrastructure
- `src/lib/engine/corpus/eval-config.ts` — D-19 threshold formula (`requiredImprovementFor`), `BASELINE_REFERENCE_DOC`
- `src/lib/engine/corpus/eval-harness.ts` — `BenchmarkReport` type, `runEvalHarness` options (leaveOneOut, persist, maxTotalCostCents)
- `src/lib/engine/corpus/eval-runner.ts` — `EvalRunnerOptions` (maxTotalCostCents default $50, rateLimitDelayMs default 2000), `CostCapExceededError`
- `src/lib/engine/corpus/thresholds.ts` — Sealed niche thresholds (D-13 immutable)
- `src/lib/engine/corpus/metrics/` — macro-f1, ECE/calibration, leave-one-out per-signal, score-to-bucket, stage-latency, bootstrap significance
- `src/lib/engine/corpus/cli/` — eval-args.ts, build-corpus-args.ts

### Prior Phase Decisions
- `.planning/phases/11-existing-ui-integration-privacy-policy/11-CONTEXT.md` §D-06 — Version flip is Phase 12 territory
- `.planning/phases/10-ml-audit-calibration-aggregator-extension/10-CONTEXT.md` — Phase 10 produces trained Platt parameters and tuned signal weights

### Benchmarks
- `.planning/research/v2.1-baseline.md` — Full baseline report (immutable D-20 reference)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `eval-harness.ts` — Complete benchmark harness producing `BenchmarkReport` with all required metrics (macro_f1, ECE, per-signal contribution, latency, cost). Already threaded with `persist`, `maxTotalCostCents`, `leaveOneOut` options.
- `eval-runner.ts` — Corpus prediction runner with cost cap enforcement, rate limiting, and error collection. Default max cost $50 (configurable).
- `metrics/leave-one-out.ts` — Per-signal contribution analysis via `scoreWithoutSignal()`. Already wired in eval-harness when `leaveOneOut: true`.
- `metrics/bootstrap.ts` — Significance testing for paired bootstrap comparisons.
- `failure-cases.ts` — Top-10 misprediction curation for the report.

### Established Patterns
- Baseline reports are persisted to `benchmark_results` table in Supabase and referenced by UUID.
- Corpus version is sealed in `thresholds.ts` `THRESHOLD_SNAPSHOTS` — new versions get new entries, never modify existing ones (D-13).

### Integration Points
- `ENGINE_VERSION` constant in `src/lib/engine/version.ts` — needs flip from `3.0.0-dev` to `3.0.0`
- `benchmark_results` table — new row per benchmark run, keyed by engine_version + corpus_version
</code_context>

<specifics>
## Specific Ideas

No specific requirements from discussion — open to standard benchmark execution approach following existing eval harness patterns.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 12-Accuracy Benchmark + Acceptance Gate*
*Context gathered: 2026-05-20*
