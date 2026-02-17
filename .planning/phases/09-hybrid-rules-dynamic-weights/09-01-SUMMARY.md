---
phase: 09-hybrid-rules-dynamic-weights
plan: 01
subsystem: engine
tags: [deepseek, rules, semantic-evaluation, zod, openai-sdk]

# Dependency graph
requires:
  - phase: 04-types-schema-db-migration
    provides: "evaluation_tier column in rule_library table"
provides:
  - "Hybrid regex+semantic rule evaluation via evaluateSemanticRules()"
  - "Batched DeepSeek-chat calls for semantic tier (single call per analysis)"
  - "Tier classification documentation for all 25 rules"
affects: [09-02-dynamic-weights, 09-03-rule-contribution-tracking, pipeline]

# Tech tracking
tech-stack:
  added: [deepseek-chat model for semantic eval]
  patterns: [tiered-evaluation, batched-llm-calls, zod-response-validation, lazy-client-init]

key-files:
  modified:
    - src/lib/engine/rules.ts

key-decisions:
  - "Local OpenAI client in rules.ts (not imported from deepseek.ts) to avoid circular dependency"
  - "deepseek-chat model for semantic eval (cheaper and faster than deepseek-reasoner)"
  - "Single batched DeepSeek call for all semantic rules (not per-rule calls)"
  - "Cast DB data through unknown for evaluation_tier (Supabase types not regenerated yet)"
  - "15s timeout for semantic eval (simpler than 45s full reasoning timeout)"

patterns-established:
  - "Tiered evaluation: rules split by evaluation_tier column, processed by different engines"
  - "Semantic eval response validated with Zod schema before use"
  - "Graceful fallback: semantic failure returns empty array, regex results still included"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 9 Plan 1: Hybrid Rules Summary

**Hybrid regex+semantic rule evaluation with batched DeepSeek-chat calls and Zod-validated responses**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T17:39:14Z
- **Completed:** 2026-02-16T17:43:03Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Split rule evaluation into regex (deterministic, free) and semantic (DeepSeek, ~$0.001/batch) tiers
- Created `evaluateSemanticRules()` that batches all semantic rules into a single DeepSeek-chat API call
- Added Zod schema validation for semantic evaluation responses (rule_name, score 0-10, rationale)
- Documented tier classification for all 25 rules (12 regex, 13 semantic candidates)
- Graceful fallback: if semantic eval fails, regex-only results are returned with a warning

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement hybrid rule evaluation engine** - `4550bbe` (feat)
2. **Task 2: Classify broken rules as semantic tier** - `caa24db` (docs)

## Files Created/Modified
- `src/lib/engine/rules.ts` - Hybrid regex+semantic rule evaluation with tiered scoring, batched DeepSeek calls, Zod validation

## Decisions Made
- **Local OpenAI client:** Created a separate `getSemanticClient()` in rules.ts instead of importing from deepseek.ts to avoid circular dependencies. Both use the same DeepSeek API key.
- **deepseek-chat model:** Used the chat model (not reasoner) for semantic eval since it's simpler scoring, not chain-of-thought reasoning. Cheaper ($0.14/$0.28 per 1M tokens vs $0.28/$0.42).
- **Single batched call:** All semantic rules evaluated in one DeepSeek call to minimize API cost and latency. Individual rule evaluation would be 10x+ more expensive.
- **Cast through unknown:** Supabase-generated types don't include `evaluation_tier` yet (types not regenerated after Phase 4 migration). Used `as unknown as Rule[]` cast.
- **15s timeout:** Semantic eval prompt is simpler than full DeepSeek reasoning (45s), so a tighter timeout is appropriate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Supabase type mismatch for evaluation_tier column**
- **Found during:** Task 1 (type-check verification)
- **Issue:** Supabase auto-generated types don't include `evaluation_tier` column (types not regenerated after Phase 4 migration), causing TS2352 error on direct cast
- **Fix:** Changed `as Rule[]` to `as unknown as Rule[]` for the double cast pattern
- **Files modified:** src/lib/engine/rules.ts
- **Verification:** `npx tsc --noEmit` passes with zero new errors (14 pre-existing errors unchanged)
- **Committed in:** 4550bbe (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary type-safety fix for Supabase type lag. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors (14 total) in scripts/, validate-rules route, theme/variant sections, deal-utils, and trends.ts. None related to this plan's changes.

## User Setup Required
None - no external service configuration required. Uses existing DEEPSEEK_API_KEY.

## Next Phase Readiness
- Hybrid evaluation engine ready for Plan 2 (dynamic weights) and Plan 3 (rule contribution tracking)
- Semantic tier rules need their `evaluation_tier` column updated from 'regex' to 'semantic' in the database (documented in code comments, handled by Plan 2 or Plan 3)
- Export signatures unchanged — pipeline.ts needs zero modifications

## Self-Check: PASSED
- rules.ts: FOUND
- 09-01-SUMMARY.md: FOUND
- Commit 4550bbe (Task 1): FOUND
- Commit caa24db (Task 2): FOUND
- evaluateSemanticRules function: FOUND in rules.ts
- evaluation_tier field: FOUND in rules.ts
- SemanticEvaluationSchema: FOUND in rules.ts

---
*Phase: 09-hybrid-rules-dynamic-weights*
*Completed: 2026-02-16*
