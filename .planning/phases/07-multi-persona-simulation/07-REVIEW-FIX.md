---
phase: 07-multi-persona-simulation
fixed_at: 2026-05-19T10:21:00Z
review_path: .planning/phases/07-multi-persona-simulation/07-REVIEW.md
iteration: 1
findings_in_scope: 12
fixed: 12
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-05-19T10:21:00Z
**Source review:** `.planning/phases/07-multi-persona-simulation/07-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 12 (3 critical, 9 warning; 4 info findings deferred — out of scope per `fix_scope=critical_warning`)
- Fixed: 12
- Skipped: 0
- Test impact: 831/831 tests pass before and after; no regressions introduced.

## Fix Table

| ID | File:Line | What was wrong | What changed | Commit | Test impact |
|----|-----------|---------------|--------------|--------|-------------|
| CR-01 | `src/lib/engine/aggregator.ts:503-506` | Wave 3 multi-persona spend (~0.5-2.5 cents/row) was emitted via stage_end telemetry but never folded into `prediction.cost_cents`, so the eval-runner cost cap silently bypassed hidden Wave 3 spend. | Plumb `wave3CostCents` through `Wave3Outcome → PipelineResult → aggregator`; fold into the `cost_cents` roll-up in aggregator.ts. Also include Wave 3 cost in the pipeline-level log line so true spend is observable in production logs. | `9451272` | All 831 tests pass; `wave3-cost-budget.test.ts` Test 4 (per-call sum == wave-level total) still holds post-fix. |
| CR-02 | `src/lib/engine/wave3.ts:147-235` | `callCostCents` was overwritten on validation retry — first-attempt cost was lost from per-call telemetry AND wave-level total, breaking the D-18 invariant on the retry path. | Replace the overwritten scalar with a per-call accumulator `callCostAccum` that adds every attempt's cost; emit and credit the accumulator on the terminal path. Per-attempt cost is logged for retry-debugging visibility. | `9451272` | All 831 tests pass; Test 10 (validation-retry → 11 mockCreate calls) still works correctly with the new accumulator semantics. |
| CR-03 | `scripts/run-persona-ab-eval.ts:63-71` | `parseInt("abc", 10)` returns NaN; `!NaN === true` made `maxRows=NaN` silently fall back to full corpus; `?? 5000` only catches null/undefined, so `maxTotalCostCents=NaN` disabled cost cap. Smoke command with typo would burn a full-corpus run with no cap. | Introduce `parseIntStrict()` with `Number.isFinite` + positive-integer validation, hard-exit on bad input. Also defensively harden `runEvalOverCorpus` to treat non-finite `maxTotalCostCents`/`maxRows`/`rateLimitDelayMs` as undefined (fall back to defaults) so non-CLI callers can't accidentally disable caps. | `5975e1b` | All 831 tests pass; `eval-runner.test.ts` (5 tests) still pass. |
| WR-01 | `src/lib/engine/aggregator.ts:526-529` + `wave3/aggregator.ts:43-65` | `PersonaBehavioralAggregate.share_pct/comment_pct/save_pct` are top-3-weighted intent scores (0-100), but `BehavioralPredictions` equivalents are percentages of views (0.2-5% typical). When `behavioralSource="personas"`, the engagement math read `share_pct=75 / 100` as a view rate → 15-20× inflated engagement numbers. | Introduce `rescalePersonaIntentToViewRate()` helper that multiplies share/comment/save intent by 0.05 (intent 100 → 5% view rate, matches DeepSeek's empirical upper bound) before feeding `computePredictedEngagement`. Keep `behavioral_predictions` output unchanged (downstream consumers reading the persona aggregate continue to get intent semantics); only the engagement-math input is rescaled. Phase 10 may revise the factor after corpus calibration. | `6573f64` | All 831 tests pass; aggregator.test.ts Test 4 still passes (output behavioral_predictions equals samplePersonaAggregate); engagement math is no longer distorted. Requires human verification of the 0.05 conversion factor against Phase 10 corpus calibration. |
| WR-02 | `src/lib/engine/types.ts:211-217` | `signal_availability.personas` declared optional (`personas?: boolean`) but aggregator always sets it; downstream consumers treat it as guaranteed; a future regression eliding the flag would type-check. | Promote to required (`personas: boolean`). Backfilled `personas: false` on all SignalAvailability literals in aggregator.test.ts (10 occurrences) and `personas: false`/`content_type: false`/`niche: false` on route.test.ts fixture (lines 187-193). | `0d0a8fa` | All 831 tests pass; `tsc --noEmit` no longer flags missing-`personas` errors. |
| WR-03 | `src/lib/engine/__tests__/factories.ts:236-249` + `src/lib/engine/pipeline.ts:135-148` | `makePipelineResult` factory's `creatorContext` and `DEFAULT_CREATOR_CONTEXT` fallback were missing 14 nullable-but-required Phase 2 9-card fields (target_platforms, niche_primary, niche_sub, target_audience, primary_goal, creator_stage, content_style, cuts_per_second, reference_creators, past_wins, past_flops, time_of_day_aware, pain_points). `tsc --noEmit` reported `missing properties: ... and 9 more`. | Add all 14 fields with `null` defaults to both factory and DEFAULT_CREATOR_CONTEXT. The runtime contract is unchanged (Vitest's esbuild strips types), but `tsc --noEmit` now passes — unblocking future CI tsc-on-tests work. | `7c301d7` | All 831 tests pass; `tsc --noEmit` errors at factories.ts:236 and pipeline.ts:142 are cleared. |
| WR-04 | `src/lib/engine/wave3.ts:206-227` (failure branch) | Terminal failure paths (timeout, non-validation error, second-attempt fail) emitted `cost_cents` on per-call stage_end but never added it to `totalCostCents`. Failed-but-charged calls (validation-fail terminal, network error post-line-182) systematically under-reported wave-level spend. | Credit any non-zero `callCostAccum` to `totalCostCents` in the catch branch's terminal exit. AbortError typically aborts before usage is read, leaving the accumulator at 0; documented that provider-side billing reconciliation for AbortError is out of band. | `9451272` (folded into CR-01/CR-02 commit) | All 831 tests pass; wave3-cost-budget.test.ts Test 4 invariant still holds for the happy path. |
| WR-05 | `src/lib/engine/wave3/aggregator.ts:103-109` | `percentileLabel()` returned "top 10%" / "top 25%" / etc. for intent scores (0-100), but those values aren't corpus percentile ranks. Misleading labels propagated to `PredictionResult.behavioral_predictions.share_percentile` (consumer-readable). | Rename buckets to intent semantics: "very high intent" / "high intent" / "moderate intent" / "low intent" / "very low intent". DeepSeek-source percentile labels remain "top X%" (those ARE corpus percentiles by prompt design). | `5d0eb3c` | All 831 tests pass (no test asserts on persona-aggregate percentile label strings). |
| WR-06 | `src/lib/engine/types.ts:344-356` + `src/lib/engine/wave3/persona-registry.ts:22-34` | `ARCHETYPES` list duplicated between types.ts (`z.enum([...10 names...])`) and persona-registry.ts (`as const`). A future edit to one but not the other would silently drift the tie-break order (wave3/aggregator.ts uses `ARCHETYPES.indexOf(...)`) while existing tests would keep passing. | Make persona-registry.ts the canonical source; types.ts imports `ARCHETYPES` and derives the schema via `z.enum(ARCHETYPES)`. Circular import is safe (persona-registry only imports `type ContentTypeSlug`, erased at runtime). | `9aaa5d2` | All 831 tests pass; wave3-aggregator.test.ts tie-break tests (Test 8) still pass. |
| WR-07 | `src/lib/engine/corpus/eval-runner.ts:122-128` | Comment claimed "33% safety buffer ($50 cap vs $37.50 ceiling)" — but the math was wrong because Wave 3 cost was excluded (see CR-01). | Update comment to document that post-CR-01 the cap operates on true total spend (Wave 3 folded in) and the 33% buffer math is correct. | `ba93ffc` | No test impact (comment-only change). |
| WR-08 | `scripts/run-persona-ab-eval.ts:188-194` | Report path used `path.join(".planning", "research", ...)` which resolves against `process.cwd()`. Script run from non-repo-root directory would write report to wrong location or fail on `fs.mkdir`. Failure happens AFTER 200+ LLM-cost-burning run finishes. | Anchor to repo root via `resolve(__dirname, "..")` (script lives at `<repo>/scripts/`, so `..` is the repo root). | `4254878` | No test impact (path-resolution change, no test runs this script). |
| WR-09 | `scripts/run-persona-ab-eval.ts:25-41` | Code mixed `dotenv config()` + `tsconfig-paths register()` in a way that looked ordered but TypeScript/ESM hoists ALL imports before non-import statements. `register()` ran AFTER `runEvalHarness` was imported — register() was non-functional. tsx resolves tsconfig paths natively, making the machinery redundant. | Delete the `tsconfig-paths` block; consolidate all imports at top; document why `dotenv config()` legitimately runs after imports (none of the imported modules read env vars at top level). | `19eb753` | All 831 tests pass (script-only change; tsx CLI behavior unaffected). |

## Test Validation

Full Vitest suite ran clean after each commit:

```
Test Files  61 passed | 2 skipped (63)
     Tests  831 passed | 4 skipped (835)
```

The 2 skipped test files are `cost-benchmark.test.ts` (live LLM cost benchmark) and `video-e2e.test.ts` (live video pipeline) — both intentionally gated on env vars not present in the worktree.

## Notes on Critical Coupling

CR-01, CR-02, and WR-04 were committed atomically in `9451272` because:
- All three modify the same `callPersona` loop in wave3.ts and the `runWave3` outcome shape.
- The CR-02 accumulator (replacing the overwritten scalar) is the prerequisite for the WR-04 credit-on-failure-path math being correct.
- CR-01 (the `cost_cents` field on `Wave3Outcome`) reads the totalCostCents that CR-02/WR-04 fix.
- Splitting them across commits would have left an intermediate state where wave-level cost was correct but per-call telemetry was still broken (or vice versa).

WR-03 covered both the factory and the production `DEFAULT_CREATOR_CONTEXT` because the same shape-drift defect existed in both locations.

## Items Requiring Human Verification

- **WR-01** (intent-to-view-rate rescale factor 0.05): chosen as a sensible default anchored on intent=100 → 5% view rate, matching DeepSeek's empirical upper bound. Phase 10 corpus calibration should empirically verify this factor; mark for review when the D-14 A/B eval produces evidence.
- **WR-05** (intent semantic labels): the new labels ("very high intent", "high intent", etc.) replace corpus-percentile-shaped strings. If UI surfaces persona-source `share_percentile` directly to users, the wording should be confirmed.

---

_Fixed: 2026-05-19T10:21:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
