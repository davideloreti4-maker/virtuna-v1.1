---
phase: 04-wave-0-content-type-niche-detection
plan: 05
subsystem: engine/wave0
tags: [cost-telemetry, bug-fix, tdd, gap-closure, GAP-04-02]
dependency_graph:
  requires: []
  provides: [GAP-04-02-closed, CONTENT-02-cost-accuracy]
  affects: [cost-budget-enforcement, CONTENT-04-ceiling]
tech_stack:
  added: []
  patterns: [hasCacheBreakdown-guard, prompt_tokens-fallback]
key_files:
  created: []
  modified:
    - src/lib/engine/wave0/niche-detector.ts
    - src/lib/engine/__tests__/wave0-niche-detector.test.ts
decisions:
  - "Use CACHE_MISS_PRICE (worst case) for fallback when cache breakdown is absent — conservative cost reporting, prevents under-reporting, matches deepseek.ts philosophy"
  - "toBeCloseTo precision reduced to 4 (from 6) in tests to account for .toFixed(4) truncation in stage_end event emission"
metrics:
  duration: ~12 minutes
  completed: "2026-05-18"
  tasks_completed: 1
  files_modified: 2
---

# Phase 04 Plan 05: Niche Detector Cost Fallback (GAP-04-02 Closure) Summary

**One-liner:** Added `hasCacheBreakdown` guard to niche-detector cost calc — falls back to `prompt_tokens × CACHE_MISS_PRICE` when DeepSeek omits cache fields, preventing ~80% cost under-reporting; 3 regression tests lock the behavior.

## What Was Built

Fixed VERIFICATION GAP-04-02 in `src/lib/engine/wave0/niche-detector.ts`. When DeepSeek returns `prompt_tokens` but omits `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens` (caching disabled, model variant doesn't report cache fields, transient infra events), the original code silently zeroed the input cost — only counting the small completion cost (~$0.0022/call vs correct ~$0.0092/call, an ~80% under-report).

The fix mirrors the canonical `calculateDeepSeekCost` fallback pattern in `deepseek.ts:338-362`. Wave 0 niche-detector is now consistent with Wave 2 reasoning on DeepSeek cost semantics.

## LOC Delta

**niche-detector.ts:** +12 lines / -2 lines (net +10). The 5-line cost block grew to 11 lines with comment, `prompt_tokens` type extension, `hasCacheBreakdown` guard, `inputCost` ternary.

**wave0-niche-detector.test.ts:** +131 lines. Added `describe("GAP-04-02 regression")` block with 3 tests (fallback absent, both-zero edge case, regression when breakdown present).

## Acceptance Criteria Verification

```
grep -c "hasCacheBreakdown" src/lib/engine/wave0/niche-detector.ts  → 2 (declaration + usage)
grep -c "prompt_tokens" src/lib/engine/wave0/niche-detector.ts      → 3 (comment + type cast + fallback expr)
grep -c "GAP-04-02 regression" src/lib/engine/__tests__/wave0-niche-detector.test.ts → 1 (describe block)
```

Note: Plan spec said `hasCacheBreakdown` grep returns 1, but correct implementation requires both declaration and usage (2 matches). The behavior is correct as specified.

## Test Results

| Gate | Result |
|------|--------|
| RED phase (before fix) | 1 test failing: "falls back to prompt_tokens" correctly fails |
| GREEN phase (after fix) | All 17 tests pass: 14 existing + 3 new |
| Full suite | 756 passed (753 pre-existing + 3 new), 2 pre-existing skips |
| Single-test sanity (`-t "falls back to prompt_tokens"`) | 1 passed |
| TypeScript (`tsc --noEmit`) on changed files | 0 errors in niche-detector.ts |

## TDD Gate Compliance

- RED commit: `4e3fc7b` — `test(04-05): add failing regression tests for GAP-04-02 cost fallback (RED)`
- GREEN commit: `9788020` — `feat(04-05): add prompt_tokens fallback to niche-detector cost calc (GREEN)`
- REFACTOR: not needed (implementation was clean on first pass)

## GAP-04-02 Closure Status

- **Unit level: CLOSED.** Three regression tests prove (a) fallback path fires when cache fields absent, (b) fallback fires when cache fields are zero, (c) cache breakdown math preserved when fields present.
- **HUMAN-UAT row #2 status:** Ready for live API validation. A human running an analysis with caching disabled (or against a model variant that omits cache fields) will now see `cost_cents > 0` in the niche-detector structured logs.

## Cross-Codebase Consistency

All DeepSeek call sites now apply the fallback pattern:
- `src/lib/engine/deepseek.ts:338-362` (`calculateDeepSeekCost`) — Wave 2 reasoning (pre-existing)
- `src/lib/engine/wave0/niche-detector.ts:97-101` (`hasCacheBreakdown` + `inputCost`) — Wave 0 niche detector (this plan)

No other DeepSeek call sites found in the codebase that need the same fix.

## Deviations from Plan

None — plan executed exactly as written. The only minor discrepancy is the `toBeCloseTo` precision adjusted from 6 to 4 for two test assertions to account for the `.toFixed(4)` truncation in `emitStageEnd` — this is a correctness fix to the test itself (not a behavior change), consistent with the plan's intent that `costCents` be "within floating-point tolerance."

## Self-Check

- [x] `src/lib/engine/wave0/niche-detector.ts` exists and contains `hasCacheBreakdown`
- [x] `src/lib/engine/__tests__/wave0-niche-detector.test.ts` exists and contains `GAP-04-02 regression`
- [x] RED commit `4e3fc7b` exists
- [x] GREEN commit `9788020` exists
- [x] Full suite 756 tests pass

## Self-Check: PASSED
