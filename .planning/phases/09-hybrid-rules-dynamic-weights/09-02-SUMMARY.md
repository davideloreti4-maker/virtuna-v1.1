---
phase: 09-hybrid-rules-dynamic-weights
plan: 02
subsystem: api, engine
tags: [supabase, jsonb, ema, cron, rule-accuracy, per-rule-tracking]

# Dependency graph
requires:
  - phase: 04-type-system-migrations
    provides: "rule_contributions JSONB column in analysis_results table"
  - phase: 05-pipeline-aggregator
    provides: "Pipeline result with ruleResult.matched_rules array"
provides:
  - "rule_contributions JSONB persisted per analysis with per-rule scores and tier"
  - "Per-rule accuracy tracking via validate-rules cron (replaces global MAE)"
  - "EMA-smoothed weight adjustment per individual rule"
  - "RuleScoreResult.matched_rules.tier field for evaluation path tracking"
affects: [09-01 (semantic evaluation tier), 09-03 (dynamic weight tuning)]

# Tech tracking
tech-stack:
  added: []
  patterns: ["per-rule accuracy via direction agreement", "EMA smoothing for weight stability", "type assertion for stale Supabase types"]

key-files:
  created: []
  modified:
    - "src/app/api/analyze/route.ts"
    - "src/app/api/cron/validate-rules/route.ts"
    - "src/lib/engine/types.ts"
    - "src/lib/engine/rules.ts"

key-decisions:
  - "Direction-based accuracy: rule high score + actual >= predicted = correct, not correlation-based"
  - "Min 10 samples per rule before weight adjustment for statistical significance"
  - "Type assertion cast for rule_contributions query — Supabase generated types are stale"
  - "Task execution reordered (Task 2 before Task 1) because tier field needed in rule_contributions mapping"

patterns-established:
  - "Per-rule accuracy: direction agreement between rule score threshold and outcome vs prediction"
  - "EMA alpha=0.3 for rule accuracy updates — balances recency vs stability"
  - "Rule weight formula: max(0.5, min(2.0, 0.5 + accuracy * 1.5))"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 9 Plan 2: Per-Rule Accuracy Tracking Summary

**Per-rule accuracy tracking via rule_contributions JSONB storage and direction-based accuracy computation with EMA-smoothed weight adjustment**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T17:39:25Z
- **Completed:** 2026-02-16T17:43:14Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Each analysis now persists per-rule contribution data (rule_id, rule_name, score, max_score, tier) as JSONB
- Validate-rules cron rewritten to compute per-rule accuracy from stored contributions vs actual outcomes
- Direction-based accuracy: measures if each rule's score direction agrees with actual outcome direction
- Rules with < 10 data points skipped to prevent noisy weight adjustments
- RuleScoreResult interface extended with evaluation tier field for regex/semantic tracking

## Task Commits

Each task was committed atomically:

1. **Task 2: Add evaluation_tier to RuleScoreResult matched_rules** - `4f1b8cc` (feat)
2. **Task 1: Store rule_contributions and compute per-rule accuracy** - `f01f6a0` (feat)

## Files Created/Modified
- `src/lib/engine/types.ts` - Added `tier: 'regex' | 'semantic'` to RuleScoreResult.matched_rules
- `src/lib/engine/rules.ts` - Added `tier: 'regex'` to matched_rules push in scoreContentAgainstRules
- `src/app/api/analyze/route.ts` - Extract and persist rule_contributions JSONB on each analysis
- `src/app/api/cron/validate-rules/route.ts` - Full rewrite: per-rule accuracy from contributions, EMA smoothing, weight adjustment

## Decisions Made
- **Direction-based accuracy over correlation**: Simpler to compute and more interpretable. Rule gives high score (>50% max) AND actual >= predicted = correct direction. Avoids complex correlation math.
- **10-sample minimum**: Rules with fewer than 10 outcome pairs are skipped entirely (not updated with partial data). This prevents early volatile swings.
- **Type assertion for stale Supabase types**: The `rule_contributions` column exists in DB (Phase 4 migration) but isn't in generated TypeScript types. Used `as unknown` cast pattern consistent with existing v2 column handling in the API route.
- **Task reordering**: Executed Task 2 before Task 1 because Task 1 references `r.tier` from matched_rules which requires the type addition from Task 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task execution reordered (Task 2 before Task 1)**
- **Found during:** Pre-execution analysis
- **Issue:** Task 1 maps `r.tier` from `pipelineResult.ruleResult.matched_rules` but the `tier` field doesn't exist until Task 2 adds it to the type and rules.ts
- **Fix:** Executed Task 2 first to add the tier field, then Task 1 could reference it
- **Files modified:** All 4 files (same as plan, different order)
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 4f1b8cc (Task 2), then f01f6a0 (Task 1)

**2. [Rule 3 - Blocking] Type assertion for stale Supabase generated types**
- **Found during:** Task 1 (validate-rules cron rewrite)
- **Issue:** `rule_contributions` column not in generated `database.types.ts`, causing TS2339 errors when querying
- **Fix:** Cast Supabase query result via `as unknown as { data: AnalysisRow[] | null; error: ... }` — consistent with existing pattern in analyze route
- **Files modified:** `src/app/api/cron/validate-rules/route.ts`
- **Verification:** `tsc --noEmit` passes (no new errors beyond 11 pre-existing unrelated ones)
- **Committed in:** f01f6a0 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both were necessary for compilation. No scope creep. Same code, different execution order.

## Issues Encountered
- Pre-existing 11 TypeScript errors in unrelated files (scripts/, themes-section, variants-section, deal-utils, trends.ts) — not introduced by this plan

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Rule contributions now stored per analysis — ready for Plan 03 (dynamic weight tuning UI or further refinement)
- Plan 01 (semantic evaluation) can populate `tier: 'semantic'` when it adds that evaluation path
- The cron will automatically start computing per-rule accuracy once enough outcome data accumulates (10+ samples per rule)

---
*Phase: 09-hybrid-rules-dynamic-weights*
*Completed: 2026-02-16*
