---
phase: 09-hybrid-rules-dynamic-weights
verified: 2026-02-16T19:15:00Z
status: passed
score: 17/17 must-haves verified
re_verification: false
---

# Phase 9: Hybrid Rules & Dynamic Weights Verification Report

**Phase Goal:** Rules use hybrid regex+semantic evaluation with per-rule tracking and signal-adaptive weight selection

**Verified:** 2026-02-16T19:15:00Z

**Status:** passed

**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Rules with evaluation_tier='regex' are scored via deterministic pattern matching | ✓ VERIFIED | rules.ts:278-306 — regexRules filtered and evaluated via matchesPattern() |
| 2 | Rules with evaluation_tier='semantic' are scored via DeepSeek evaluation using their evaluation_prompt | ✓ VERIFIED | rules.ts:308-338 — semanticRules evaluated via evaluateSemanticRules() with DeepSeek-chat |
| 3 | Broken regex rules (loop_structure, emotional_arc, text_overlay) are classified as semantic tier | ✓ VERIFIED | rules.ts:1-30 — documentation classifies all 3 as SEMANTIC tier with rationale |
| 4 | Semantic evaluation returns a 0-10 score per rule with a brief rationale | ✓ VERIFIED | rules.ts:61-69 — SemanticEvaluationSchema enforces score (0-10) and rationale fields |
| 5 | Rules that cannot be evaluated score 0 with a skip reason | ✓ VERIFIED | rules.ts:183-189, 302-305 — logs skip reasons for missing prompts/patterns |
| 6 | Each analysis stores per-rule contributions (rule_id, score, max_score, tier) in DB alongside the result | ✓ VERIFIED | analyze/route.ts:152-159, 195 — ruleContributions mapped from matched_rules and persisted |
| 7 | Validate-rules cron computes per-rule accuracy from stored contributions vs actual outcomes | ✓ VERIFIED | validate-rules/route.ts:147-189 — ruleAccuracy computed from contributions |
| 8 | Per-rule accuracy uses exponential moving average (EMA) with alpha=0.3 | ✓ VERIFIED | validate-rules/route.ts:216-221 — EMA formula with alpha=0.3 applied |
| 9 | Rules with low accuracy get their weight reduced; high accuracy increases weight | ✓ VERIFIED | validate-rules/route.ts:224-227 — weight = max(0.5, min(2.0, 0.5 + accuracy*1.5)) |
| 10 | When all four signal sources are available, weights are behavioral=0.45, gemini=0.25, rules=0.20, trends=0.10 | ✓ VERIFIED | aggregator.ts:20-25, 52 — SCORE_WEIGHTS const + selectWeights returns base when all available |
| 11 | When a signal source is missing or degraded, its weight is redistributed proportionally to remaining sources | ✓ VERIFIED | aggregator.ts:54-79 — proportional redistribution math in selectWeights() |
| 12 | Confidence calculation reflects signal availability — fewer signals = lower confidence | ✓ VERIFIED | aggregator.ts:109-111 — confidence penalty -0.05 per missing rules/trends signal |
| 13 | Weight selection logic is deterministic and testable given a known signal availability state | ✓ VERIFIED | aggregator.ts:45 — selectWeights() exported as pure function |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/engine/rules.ts` | Hybrid regex+semantic rule evaluation with tiered scoring | ✓ VERIFIED | Exports loadActiveRules, scoreContentAgainstRules; includes evaluateSemanticRules() |
| `src/app/api/analyze/route.ts` | Persists rule_contributions JSONB to analysis_results on each analysis | ✓ VERIFIED | Lines 152-159, 195 — maps and persists ruleContributions |
| `src/app/api/cron/validate-rules/route.ts` | Per-rule accuracy tracking with rule_contributions-based computation | ✓ VERIFIED | Lines 147-255 — per-rule accuracy, EMA, weight adjustment |
| `src/lib/engine/aggregator.ts` | Dynamic weight selection based on signal availability | ✓ VERIFIED | Exports selectWeights, ENGINE_VERSION=2.1.0; integrates dynamic weights in aggregateScores |
| `src/lib/engine/types.ts` | RuleScoreResult.matched_rules.tier field | ✓ VERIFIED | Interface includes tier: 'regex' | 'semantic' field |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| rules.ts | deepseek.ts (OpenAI client pattern) | new OpenAI with deepseek baseURL | ✓ WIRED | rules.ts:80-85 — local client with same pattern, no circular import |
| analyze/route.ts | analysis_results.rule_contributions | DB insert with JSONB column | ✓ WIRED | route.ts:195 — rule_contributions field inserted |
| validate-rules/route.ts | analysis_results.rule_contributions | DB query for per-rule contribution data | ✓ WIRED | route.ts:115-121 — select with cast for stale types |
| aggregator.ts | pipeline.ts | PipelineResult stage outputs determine signal availability | ✓ WIRED | aggregator.ts:224-232 — availability derived from pipelineResult warnings + matched counts |

### Requirements Coverage

No explicit requirements mapped to Phase 9 in REQUIREMENTS.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| aggregator.ts | 181 | placeholder comment | ℹ️ Info | Audio feature documented as Phase 11 future work — intentional |

**No blocking anti-patterns found.**

### Human Verification Required

#### 1. Semantic Rule Evaluation End-to-End Test

**Test:** Create an analysis with content that triggers semantic-tier rules (e.g., loop_structure, emotional_arc, text_overlay). Inspect the returned PredictionResult.

**Expected:**
- `matched_rules` array includes entries with `tier: 'semantic'`
- Each semantic rule has a score between 0 and its max_score
- Cost tracking logs show DeepSeek-chat API call with token usage
- If semantic eval fails, rules.ts logs fallback warning and returns regex-only results

**Why human:** Requires live DeepSeek API call and inspection of runtime logs/responses. Can't verify LLM behavior programmatically without mocking.

#### 2. Per-Rule Accuracy Tracking After Outcome Data

**Test:**
1. Create 10+ analyses with varying content
2. Submit outcomes for each with actual_score values
3. Wait for validate-rules cron to run (or trigger manually via /api/cron/validate-rules with auth header)
4. Inspect rule_library table to verify accuracy_rate, sample_count, and weight columns are updated

**Expected:**
- Rules that gave high scores when actual > predicted show increasing accuracy_rate
- Rules that gave high scores when actual < predicted show decreasing accuracy_rate
- Weight values shift between 0.5 and 2.0 based on accuracy
- Rules with < 10 samples show no updates (skipped count in cron response)

**Why human:** Requires generating outcome data, waiting for cron execution, and querying DB to verify weight adjustments. Multi-step workflow can't be automated in verification script.

#### 3. Dynamic Weight Redistribution Visual Inspection

**Test:**
1. Trigger an analysis where rules or trends stage fails (e.g., by temporarily disabling trends API key)
2. Inspect the returned PredictionResult.score_weights
3. Verify warnings array includes "Weights redistributed — missing signals: rules, trends"

**Expected:**
- When rules missing: `score_weights.rules = 0`, other weights sum to ~1.0
- When trends missing: `score_weights.trends = 0`, other weights proportionally increased
- Warnings array explicitly lists which signals are missing
- Confidence value is lower than baseline (penalty applied)

**Why human:** Requires intentionally breaking pipeline stages to trigger missing signal scenarios. Can't safely automate failure injection in production code verification.

### Gaps Summary

No gaps found. All must-haves verified against actual codebase implementation.

**Code Quality:**
- All 3 sub-plans executed and committed atomically (6 commits total)
- TypeScript compiles with 0 new errors (10 pre-existing unrelated errors)
- Hybrid evaluation engine supports both regex and semantic tiers
- Per-rule accuracy tracking replaces global MAE approach
- Dynamic weights adapt to signal availability with proportional redistribution
- All exported function signatures unchanged — backward compatible

**Integration Verified:**
- rules.ts evaluates semantic tier via batched DeepSeek calls
- analyze/route.ts persists rule_contributions JSONB per analysis
- validate-rules cron computes per-rule accuracy from contributions
- aggregator.ts applies dynamic weights based on PipelineResult warnings
- ENGINE_VERSION bumped to 2.1.0 to distinguish new behavior

**Documentation:**
- Tier classification documented for all 25 rules (12 regex, 13 semantic candidates)
- Migration note added for updating evaluation_tier column in DB
- Export transparency: selectWeights() exported for Phase 12 testing
- Cost logging includes DeepSeek-chat token usage estimates

---

_Verified: 2026-02-16T19:15:00Z_

_Verifier: Claude (gsd-verifier)_
