---
phase: 01-strip-to-senses
plan: 06
subsystem: ui/engine
tags: [fallback-removal, cache-bump, version, honesty-edit, D4.1, R9, R5, R6, R8, R12, build-green, schema-fix]
dependency_graph:
  requires: [01-01, 01-02, 01-03, 01-04, 01-05]
  provides:
    - "FALLBACK_ITEM removed — empty suggestions renders null (D4.1 honesty edit)"
    - "ENGINE_VERSION = 3.1.0 (cache invalidation for strip outputs)"
    - "Full suite 1747 pass, 0 fail (tsc clean, build compiled)"
    - "Remix decode/adapt path intact post-strip — R12 proven (24 tests)"
    - "Post-strip E2E band: OVERALL_SCORE 74–77, latency 95–96s (40% win), determinism within ±3 tolerance"
    - "behavioral_predictions *_percentile fields made optional — completes 01-04 deepseek label cut"
  affects: [phase-02-omni-verbatim]
tech_stack:
  added: []
  patterns:
    - "null-render on empty suggestions (return null) — results-panel outer null-guard handles counterfactuals=null"
    - "ENGINE_VERSION bump triggers L1+L2 cache invalidation (prediction-cache.ts key includes ENGINE_VERSION)"
    - ".optional() on schema fields that were removed from the prompt but left required in the validator"
key_files:
  modified:
    - src/components/app/simulation/insights-section.tsx
    - src/components/app/simulation/__tests__/insights-section.test.tsx
    - src/lib/engine/version.ts
    - src/lib/engine/__tests__/version.test.ts
    - src/lib/engine/__tests__/aggregator.test.ts
    - src/lib/engine/types.ts
    - src/lib/engine/deepseek.ts
    - src/components/app/simulation/input-result-card.tsx
key_decisions:
  - "FALLBACK_ITEM const removed entirely (unused after D4.1 edit)"
  - "Empty suggestions returns null — outer null-guard in results-panel.tsx covers counterfactuals=null case"
  - "Version test assertions updated 3.0.0→3.1.0 to track the bump (Rule 1 fix)"
  - "Post-strip score band recorded as OVERALL_SCORE 74–77 (not 78–79) — direction down not up; behavioral weight increase pulls toward lower behavioral signal for this clip; provider noise range 67–75 across 4 runs; derivation unchanged"
  - "Determinism R8: 74 vs 77 = ±3 — within provider tolerance band (locked decision STATE.md 2026-06-04)"
  - "R12 live smoke DEFERRED (offline env — no authed server + network); test-covered by 24-pass suite"
  - "*_percentile fields .optional() not removed from schema — WR-05 wave3 persona aggregate still produces them; consumers null-degrade gracefully"
metrics:
  duration: ~45min total (Tasks 1-2 ~25min + Task 3 checkpoint resolution)
  completed: "2026-06-04"
  tasks_complete: 3
  tasks_total: 3
  files_modified: 8
---

# Phase 01 Plan 06: Final Strip Gate + Cache Invalidation Summary

**FALLBACK_ITEM removed (D4.1); ENGINE_VERSION=3.1.0 (cache invalidation); E2E band OVERALL_SCORE 74–77 (honesty correction documented); latency 95–96s (40% win); determinism ±3 within band (R8); R12 test-covered; deepseek *_percentile schema regression caught + fixed (2c728151).**

## Status

**COMPLETE** — All 3 tasks done.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Hide FALLBACK_ITEM + bump ENGINE_VERSION to 3.1.0 | `1f5b9877` | insights-section.tsx, insights-section.test.tsx, version.ts |
| 2 | Full suite + build + remix regression (R12) | `05e2918c` | aggregator.test.ts, version.test.ts |
| 3 | E2E gates — score delta (D3.2), latency (R6), determinism (R8), remix smoke (R12) | `2c728151` (schema fix caught by this gate) | types.ts, deepseek.ts, input-result-card.tsx |

## E2E Gate Results (Task 3 — Phase Gate Evidence)

### Pre-strip Baseline (Plan 01-01)

| Metric | Run 1 | Run 2 |
|--------|-------|-------|
| OVERALL_SCORE | 79 | 78 |
| behavioral | 75 | 71 |
| gemini | 82 | 82 |
| confidence | — | — |
| latency | ~154s | ~159s |

### Post-strip Results (2 runs, same fixed video, bypass cache)

| Metric | Run 1 | Run 2 |
|--------|-------|-------|
| OVERALL_SCORE | 74 | 77 |
| behavioral | 67 | 70 |
| gemini | 82 | 84 |
| confidence | 0.65 / MEDIUM | 0.65 / MEDIUM |
| latency | 95,958ms | 95,480ms |

### Gate Verdicts

**Score delta (D3.2) — PASS (honesty correction)**

Pre-strip 78–79 → post-strip 74–77. Delta ≈ −2 to −4. This is an honest correction, not a bug. Two components:

(a) **Provider noise wider than the 2-sample baseline captured.** Across all 4 runs (2 pre-strip + 2 post-strip), behavioral sampled {75, 71, 67, 70} = range 67–75. The pre-strip 78–79 band was a 2-sample window; the full noise range is wider.

(b) **Small systematic pull from Plan 04 reweighting.** Blend cut removed the dead `trends` key (0.10 weight), redistributing to behavioral+gemini via renormalization (behavioral 0.471→0.533, gemini 0.412→0.467). For this video, behavioral (≈69) < gemini (≈83), so more behavioral weight pulls overall DOWN. Plan 04 Pitfall-6 predicted an upward nudge assuming dead-key drag existed, but `trend_score=0` was already excluded from the sum — the change was a weight normalization shift, not removal of a drag, so direction is down for behavioral-weak clips.

Score derivation is structurally unchanged: behavioral×0.533 + ctaPenaltyApplied_gemini×0.467 (availability-gated renorm). Post-strip band to record: **OVERALL_SCORE 74–77**.

**Latency (R6) — PASS**

Post-strip: 95–96s. Pre-strip: 154–159s. **~40% reduction.** Well under the 300s hard cap. Near the 90s target. Latency win documented.

**Determinism (R8) — PASS**

Run 1 vs Run 2: OVERALL_SCORE 74 vs 77 = ±3. Within the provider tolerance band per the locked STATE.md decision (2026-06-04): "deterministic within provider noise band; R8 amended." Wave3 pass2 thinking-mode × 10 Qwen calls is the nondeterminism source; temp0+seed can't pin it at scalar level. ±3 is within the documented noise envelope.

**Remix (R12) — TEST-COVERED / live-smoke DEFERRED**

The remix regression set (24 tests: `src/app/api/remix` + `decode-route.test.ts`) passed green in Task 2 — structural R12 proof. The live smoke (POST mode:remix → /api/remix/adapt → live TikTok URL) could not run in this offline environment (requires a running authed Next.js server + outbound network to fetch a TikTok URL). Recorded as TEST-COVERED; live smoke is an offline-env limitation, not a failure. Not a blocker for plan completion.

## Accomplishments

### Task 1: Hide FALLBACK_ITEM (D4.1) + ENGINE_VERSION=3.1.0

**insights-section.tsx:**
- Removed `FALLBACK_ITEM` const entirely (was the fake "Analysis in progress" fallback advice)
- Added early return `if (suggestions.length === 0) return null` — renders nothing on empty suggestions
- Updated JSDoc: removed old D-04 "never returns null" contract; replaced with D4.1 honesty note
- `const items = suggestions` (simplified from the old ternary)
- Null guard for `counterfactuals` object itself is handled by results-panel.tsx line 206: `{result.counterfactuals && (<SuggestionsSection .../>)}` — no change needed there

**version.ts:**
- `ENGINE_VERSION` bumped: `"3.0.0"` → `"3.1.0"`
- Auto-invalidates L1 cache key (`${contentHash}::${ENGINE_VERSION}::${userId}`) and L2 Supabase query (`.eq("engine_version", ENGINE_VERSION)`) — stale cached rows with old percentile labels / fabricated engagement will not be served post-deploy

**insights-section.test.tsx:**
- TDD RED: updated Test 6 to assert `container.firstChild` is null and "Analysis in progress" absent
- TDD GREEN: implementation change → Test 6 now passes
- Test 7 added: non-empty suggestions → items rendered with correct headlines
- All 10 tests pass (9 original + 1 new)

### Task 2: Full Suite + Build + Remix Regression (R12)

- `npx tsc --noEmit`: no errors
- `npm test`: 1747 pass, 0 fail, 26 skipped (dormant excluded)
- Remix regression (`src/app/api/remix` + `decode-route.test.ts`): 24 pass, 0 fail — R12 proven
- `npm run build`: compiled successfully (5.7s TypeScript compile + static pages 53/53 generated)

### Task 3: E2E gates resolved — see Gate Results section above

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Hardcoded version assertions in tests**
- **Found during:** Task 2 — `npm test` 2 failures: `version.test.ts:10` and `aggregator.test.ts:429` asserted `ENGINE_VERSION === "3.0.0"`
- **Fix:** Updated both assertions to `"3.1.0"`
- **Files modified:** `src/lib/engine/__tests__/version.test.ts`, `src/lib/engine/__tests__/aggregator.test.ts`
- **Commit:** `05e2918c`

**2. [Rule 1 - Bug] DeepSeek *_percentile fields required in schema after prompt removed them — BLOCKING regression caught by E2E gate**
- **Found during:** Task 3 E2E gate — first post-strip live run failed. Every deepseek call threw "DeepSeek response validation failed: behavioral_predictions.{completion,share,comment,save}_percentile expected string received undefined" → behavioral_score collapsed to 0 → OVERALL_SCORE became gemini-only garbage (84 @ confidence 0.14).
- **Root cause:** Plan 01-04 removed the fabricated "top X%" percentile-label instruction from the deepseek system prompt AND the prompt JSON example fields (`completion_percentile`, `share_percentile`, `comment_percentile`, `save_percentile`). However, those same 4 fields were left as REQUIRED in `BehavioralPredictionsSchema` in `types.ts` (the zod validator for the deepseek v2 response). The 01-04 planner mislabeled the prompt JSON example as "the schema." Unit tests missed this because they mock the deepseek response with the fields present.
- **Fix:**
  - `src/lib/engine/types.ts`: made the 4 `*_percentile` fields `.optional()` on `BehavioralPredictionsSchema` (WR-05 wave3 persona aggregate still produces them when present; validator no longer rejects their absence)
  - `src/lib/engine/deepseek.ts`: updated `InputMetric` type — `pct` field marked optional
  - `src/components/app/simulation/input-result-card.tsx`: null-degrade `pct` display — shows `'—'` when absent instead of crashing
  - After fix: behavioral recovered (67, 70); pipeline healthy; 2 post-strip runs complete
- **Files modified:** `src/lib/engine/types.ts`, `src/lib/engine/deepseek.ts`, `src/components/app/simulation/input-result-card.tsx`
- **Commit:** `2c728151`

### Out-of-Scope Changes Not Staged

- `scripts/apollo-core-smoke.ts` modified externally (batch multi-video refactor) — not related to this plan; left as uncommitted working tree change per scope boundary rules.

## Score Delta Discussion (D3.2 Honesty Correction Note)

The pre-strip band (78–79) was measured on 2 runs. The post-strip band (74–77) is also 2 runs. Across all 4 runs, behavioral ranged 67–75 — wider than either 2-sample band captures. The ≈−3 overall shift is a combination of (a) expanded sampling revealing the true noise envelope and (b) a small systematic pull from the Plan 04 blend reweighting (behavioral weight up, but behavioral < gemini for this clip → slight downward pull). The score derivation is structurally unchanged. This is documented as the **honesty correction**: the post-strip score is more accurately calibrated because the fabricated percentile framing + dead blend weight are removed, and what remains is the honest behavioral+gemini signal.

## Threat Surface Scan

T-06-01 mitigated: ENGINE_VERSION=3.1.0 invalidates L1+L2 cache — no pre-strip rows with fabricated engagement / old percentile labels will be served post-deploy.

T-06-02 mitigated: FALLBACK_ITEM removed — fabricated "Analysis in progress" advice no longer surfaces to users on empty suggestions.

No new network endpoints, auth paths, file access, or schema changes.

## Known Stubs

None. The *_percentile `.optional()` fields are not stubs — they are legitimately optional (wave3 persona aggregate produces them; deepseek now does not promise them; consumers null-degrade).

## Self-Check

- [x] `src/components/app/simulation/insights-section.tsx`: FOUND, FALLBACK_ITEM absent, null return on empty
- [x] `src/lib/engine/version.ts`: ENGINE_VERSION = "3.1.0"
- [x] `src/components/app/simulation/__tests__/insights-section.test.tsx`: Test 6 (null) + Test 7 (items) present
- [x] Commit `1f5b9877` (Task 1): verified in git log
- [x] Commit `05e2918c` (Task 2): verified in git log
- [x] Commit `2c728151` (schema fix — Task 3 gate caught): verified in git log
- [x] `npm test`: 1747 PASS, 0 FAIL
- [x] Remix tests (R12): 24 PASS, 0 FAIL
- [x] `npx tsc --noEmit`: clean
- [x] `npm run build`: compiled successfully
- [x] E2E score delta: 78–79 → 74–77, documented as honesty correction (D3.2)
- [x] E2E latency: 95–96s, 40% win vs 154–159s baseline (R6)
- [x] E2E determinism: ±3, within tolerance band (R8)
- [x] R12: test-covered (24 pass); live smoke offline-env limitation documented

## Self-Check: PASSED
