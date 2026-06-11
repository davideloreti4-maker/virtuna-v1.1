---
phase: 01-strip-to-senses
plan: 03
subsystem: engine/pipeline
tags: [strip, pipeline, wave1, wave2, audio, rules, trends, platform_fit]
dependency_graph:
  requires: [01-01]
  provides: [pipeline.ts free of audio/rules/trends/platform_fit callers; ready for Plan 05 dormant move]
  affects: [aggregator.ts, analyze/route.ts, pipeline.test.ts]
tech_stack:
  added: []
  patterns: [call-site removal before module dormant move]
key_files:
  modified:
    - src/lib/engine/pipeline.ts
    - src/lib/engine/aggregator.ts
    - src/app/api/analyze/route.ts
    - src/lib/engine/__tests__/pipeline.test.ts
    - src/lib/engine/__tests__/factories.ts
    - src/lib/engine/__tests__/aggregator.test.ts
    - src/lib/engine/__tests__/aggregator-anti-virality.test.ts
    - src/lib/engine/__tests__/aggregator-audio.test.ts
decisions:
  - aggregator.ts uses inline fallback defaults (ruleResult + trendEnrichment + audioFingerprintResult=null) since those fields are no longer in PipelineResult; this avoids requiring aggregator changes in a later plan to compile cleanly
  - route.ts ruleContributions replaced with empty array (no rule data available)
  - aggregator-audio.test.ts updated to reflect always-null audio fingerprint + empty trendEnrichment (tests still exercise the aggregator code paths, just with null/empty inputs)
metrics:
  duration: "~60 min"
  completed: "2026-06-04T09:31:59Z"
  tasks: 3
  files: 8
---

# Phase 01 Plan 03: Remove pipeline.ts call sites (audio/rules/trends/platform_fit) Summary

Pipeline.ts call sites for audio-fingerprint, rules, trends, and platform_fit removed. All four modules remain on disk for Plan 05 dormant move. Omni, deepseek, wave3, creator, and remix logic untouched.

## What Was Built

Wave1 + Wave2 in pipeline.ts stripped to their essential callers:
- **Wave1** `Promise.all` reduced from `[gemini, audioFingerprint, creator, rules]` → `[gemini, creator]`
- **Wave2** `Promise.all` reduced from `[deepseek, trends]` → `[deepseek]` only
- `platformFitPromise` chain off wave2Promise fully removed
- `PipelineResult` interface drops: `ruleResult`, `audioFingerprintResult`, `trendEnrichment`, `platformFitResult`
- All four module imports removed from pipeline.ts
- pipeline.test.ts asserts the post-strip behavior (stage events, no platform_fit calls, no removed result fields)

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Remove audio + rules call sites from pipeline.ts Wave1 | b690c357 (auto), c691750c (auto), ab66bdbe |
| 2 | Remove trends + platform_fit call sites from pipeline.ts Wave2 | 169b8732 (auto), be272994 |
| 3 | Update pipeline.test.ts to post-strip awaited set | 61b6a922 |

Note: The `.githooks/post-commit` auto-push hook triggered incremental auto-commits (`feat(ui): changes`, `test: changes`) mid-execution. These capture the same changes as the plan-committed tasks; documented per the project's known auto-commit behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing correctness] aggregator.ts + route.ts broken by PipelineResult interface shrink**
- **Found during:** Task 1 / Task 2 (tsc --noEmit runs)
- **Issue:** Removing `ruleResult`, `audioFingerprintResult`, `trendEnrichment`, `platformFitResult` from PipelineResult broke aggregator.ts (destructures all four), route.ts (accesses `pipelineResult.ruleResult.matched_rules`), and all test files that pass these as makePipelineResult overrides.
- **Fix:** aggregator.ts now declares local fallback constants (`ruleResult = {rule_score:50, matched_rules:[]}`, `trendEnrichment = empty`, `audioFingerprintResult = null as AudioFingerprintResult | null`) so the existing scoring math continues to compile with its dead-path null values. route.ts `ruleContributions` replaced with empty array literal. Test files updated to remove invalid overrides.
- **Files modified:** aggregator.ts, route.ts, factories.ts, aggregator.test.ts, aggregator-anti-virality.test.ts, aggregator-audio.test.ts, pipeline.test.ts
- **Commits:** included in b690c357, c691750c, ab66bdbe, 169b8732, be272994

**2. [Rule 2 - Missing correctness] deepseek.ts `rule_result` parameter**
- **Found during:** Task 1
- **Issue:** `reasonWithDeepSeek` interface expects `rule_result: RuleScoreResult`. After removing `ruleResult` from PipelineResult, the call site in pipeline.ts had no value to pass.
- **Fix:** Inline empty fallback `{ rule_score: 50, matched_rules: [] }` at the call site.
- **Files modified:** pipeline.ts
- **Commit:** b690c357

**3. [Rule 2 - Correctness] aggregator-audio.test.ts: assertions updated to always-null state**
- **Found during:** Task 2
- **Issue:** 12 tests in aggregator-audio.test.ts directly asserted fingerprint-based behavior (boost, synthesis, audioTrendingMatch from fingerprint). Since aggregator now always receives null for audioFingerprintResult + empty trendEnrichment, these assertions required updating.
- **Fix:** Updated all 12 tests to reflect the always-null/always-empty state. Test coverage of the aggregator code paths is maintained (tests exercise the null branches of the fingerprint/trend logic).
- **Files modified:** aggregator-audio.test.ts

## Known Stubs

None — no UI components or data sources involved. Pipeline still produces a valid PredictionResult; the removed stages contribute 0 weight in the scoring blend (already redistributed by selectWeights).

## Threat Flags

None. Only call-site removal within the server-side pipeline; no new network endpoints, auth paths, or schema changes. T-03-01 verified: none of the removed promise blocks (audioFingerprintPromise, rulePromise, trendPromise, platformFitPromise) contained input-sanitization or rate-limit guards — all were pure scoring/enrichment stages.

## Self-Check: PASSED

- pipeline.ts: FOUND
- SUMMARY.md: FOUND
- Task 1 commit ab66bdbe: FOUND
- Task 2 commit be272994: FOUND
- Task 3 commit 61b6a922: FOUND
- tsc --noEmit: 0 errors
- pipeline.test.ts: 27/27 PASS
