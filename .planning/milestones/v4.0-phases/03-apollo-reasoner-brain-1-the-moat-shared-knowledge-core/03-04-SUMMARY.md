---
phase: 03-apollo-reasoner-brain-1-the-moat-shared-knowledge-core
plan: "04"
subsystem: engine/aggregator+route+pipeline
tags: [apollo-blend, d04, d05, r5-partial, r2-verbatim, engine-version, variants-apollo, tdd]
dependency_graph:
  requires:
    - Plan 03-02 (composite_score on DeepSeekResponseSchema, DeepSeekInput.verbatim)
    - Plan 03-01 (APOLLO_SYSTEM_PROMPT, apollo-core.ts)
  provides:
    - Live score blend: behavioral 40 + Apollo composite (renormalized, D-04)
    - verbatim hook threaded into reasonWithDeepSeek via pipeline.ts (R2 precondition)
    - variants.apollo persists rewrites/dimensions/composite_score on real run
    - ENGINE_VERSION 3.3.0 invalidates stale pre-Apollo cached scores (Pitfall 3)
    - R5-partial: overall_score = behavioral*0.533 + Apollo*0.467 (structurally unchanged)
  affects:
    - All aggregateScores callers (score_weights key renamed gemini→apollo)
    - route.ts score-mode persist paths (two new persistApolloToVariants calls)
    - UI breakdown (impact-score.tsx now shows Apollo instead of Gemini term)
tech_stack:
  added: []
  patterns:
    - Read-merge-write persist pattern (mirrors persistCraftToVariants / persistDecodeToVariants)
    - Apollo availability = behavioral (same deepseek source — simplifies selectWeights)
    - TDD RED → GREEN cycle (Wave 0 scaffold cases flipped from documented-red to GREEN)
key_files:
  created: []
  modified:
    - path: src/lib/engine/aggregator.ts
      change: "SCORE_WEIGHTS gemini→apollo, SCORE_WEIGHT_KEYS updated, selectWeights returns {behavioral,apollo}, blend math uses apollo_score=composite_score, calculateConfidence uses Apollo-vs-behavioral agreement, apollo_reasoning surfaced on PredictionResult"
    - path: src/lib/engine/types.ts
      change: "SignalAvailability.apollo added (optional); PredictionResult.score_weights apollo required+gemini optional; PredictionResult.apollo_reasoning added (optional)"
    - path: src/lib/engine/pipeline.ts
      change: "verbatim hook plucked from gemini_analysis and passed into reasonWithDeepSeek as DeepSeekInput.verbatim (R2 threading)"
    - path: src/lib/engine/version.ts
      change: "ENGINE_VERSION 3.2.0→3.3.0 + lineage doc comment noting P3 Apollo blend rewire"
    - path: src/app/api/analyze/route.ts
      change: "persistApolloToVariants() added (read-merge-write, .eq user_id preserved); called at JSON branch + SSE branch score-mode persist sites"
    - path: src/lib/engine/__tests__/aggregator.test.ts
      change: "Wave 0 R5/D-04 scaffold cases updated from documented-red to GREEN assertions; selectWeights tests updated for apollo key; score_weights tests updated; version test updated to 3.3.0"
    - path: src/lib/engine/__tests__/aggregator-audio.test.ts
      change: "SCORE_WEIGHT_KEYS and selectWeights assertions updated for apollo blend; Test 20 guard updated"
    - path: src/lib/engine/__tests__/aggregator-cta-penalty.test.ts
      change: "Test 18 updated: CTA penalty no longer affects overall_score (gemini left blend D-04)"
    - path: src/lib/engine/__tests__/aggregator-phase10.test.ts
      change: "All selectWeights assertions updated for behavioral+apollo; Test 2 corrected (behavioral=false → apollo=0 same source)"
    - path: src/lib/engine/__tests__/flop-warning.test.ts
      change: "score_weights fixture updated with apollo key"
    - path: src/lib/engine/__tests__/stage10-critique.test.ts
      change: "score_weights fixture updated with apollo key"
    - path: src/lib/engine/__tests__/version.test.ts
      change: "Expected version updated to 3.3.0"
    - path: src/components/app/simulation/impact-score.tsx
      change: "HeroScore SIGNALS array updated to apollo term; scoreMap updated; score_weights type updated"
    - path: src/components/board/verdict/__tests__/fixtures/prediction-result.ts
      change: "score_weights fixture updated with apollo key"
decisions:
  - "Apollo availability = behavioral (same deepseek source): selectWeights reads availability.apollo ?? availability.behavioral — when deepseek didn't run both are 0 (correct: no apollo term to blend)"
  - "applyCtaPenalty dropped from blend path (Open Q2): gemini left the blend; CTA surfaces as Apollo §2.4 critique evidence; Test 18 updated to assert equal scores"
  - "apollo_reasoning added to PredictionResult as optional field to carry rewrites/dims for variants.apollo persist without routing through DeepSeekReasoning directly from route.ts"
  - "verbatim threaded in pipeline.ts (not aggregator.ts): this is where reasonWithDeepSeek is called; aggregator.ts verbatim accept is pre-existing (Plan 02)"
  - "gemini key in score_weights set to 0 (not removed) for back-compat with persisted JSONB rows"
metrics:
  duration: ~25 minutes
  completed: "2026-06-05T10:51:53Z"
  checkpoint_verified: "2026-06-05T11:15:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 0
  files_modified: 14
---

# Phase 03 Plan 04: Apollo Blend Rewire + variants.apollo Persist Summary

Wired Apollo into the live score and persistence: `behavioral 40 + Apollo composite` (renormalized) replaces the gemini term in `raw_overall_score` (D-04), verbatim hook is now threaded into `reasonWithDeepSeek` via pipeline.ts (R2 precondition), Apollo's rewrites/dimensions/composite persist into `variants.apollo` (read-merge-write, T-03-09/T-03-10 safe), and `ENGINE_VERSION` bumped to 3.3.0 to invalidate stale pre-Apollo cached scores.

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 (RED) | Wave 0 R5/D-04 scaffold cases flipped to failing assertions | c599f1c4 | RED committed |
| 1 (GREEN) | Rewire blend behavioral+apollo, thread verbatim, update tests | 00cc8ceb | GREEN (1815 tests) |
| 2 | Persist variants.apollo + bump ENGINE_VERSION 3.2.0→3.3.0 | 5a179539 | GREEN (1815 tests) |
| 3 | Live verification on real video (R2/R8/R6) | b3b7bf2c | ✓ VERIFIED (orchestrator) — required a contract fix; see Checkpoint Resolution |

## What Was Built

**Task 1 — Aggregator blend rewire (D-04):**
- `SCORE_WEIGHTS = { behavioral: 0.40, apollo: 0.35 }` — 0.35 value preserved on apollo term so 53.3/46.7 renorm split is structurally unchanged (STATE.md determinism band holds)
- `SCORE_WEIGHT_KEYS = ["behavioral", "apollo"]` — gemini retired from blend key
- `selectWeights` returns `{ behavioral, apollo }` — reads `availability.apollo ?? availability.behavioral`
- `availability.apollo = deepseekResult !== null` — same source as behavioral (apollo and behavioral both sourced from deepseek; when deepseek fails, both 0)
- `apollo_score = deepseek?.composite_score ?? 0` replaces `ctaPenaltyApplied_gemini_score * weights.gemini`
- `applyCtaPenalty` on gemini dropped from blend path (Open Q2 recommendation — CTA surfaces as Apollo §2.4 critique evidence)
- `calculateConfidence` uses Apollo-composite-vs-behavioral direction agreement (replaces gemini-vs-behavioral)
- `apollo_reasoning` optional field added to `PredictionResult` to carry rewrites/dimensions/composite_score/confidence_scope for variants persist
- `score_weights.gemini = 0` on PredictionResult (back-compat for JSONB rows)

**Task 1 — Verbatim threading (R2):**
- `pipeline.ts`: plucks `hook_verbatim` from `geminiResult.analysis`, constructs `VerbatimPayload`, passes as `verbatim` into `reasonWithDeepSeek` — Apollo can now ground `rewrite.original` in the literal spoken/on-screen line

**Task 1 — Test fixes:**
- Wave 0 R5/D-04 cases GREEN (were documented-red since Plan 01)
- All selectWeights tests updated for `behavioral+apollo` keys
- Test 18 in aggregator-cta-penalty.test.ts: CTA penalty no longer affects overall_score (correct post-D-04 behavior)
- aggregator-phase10.test.ts: Test 2 corrected (behavioral=false → apollo=0, not apollo=1, since same deepseek source)
- impact-score.tsx UI breakdown shows Apollo term

**Task 2 — persist variants.apollo:**
- `persistApolloToVariants()` added to route.ts: read current variants → spread `{ ...current, apollo }` → write (T-03-09: no wholesale overwrite)
- `.eq("user_id", userId)` on both SELECT and UPDATE (T-03-10: V4 access control preserved)
- Called at JSON branch (~:703) and SSE branch (~:931) — score-mode only (not remix)
- Non-fatal: failure logs and returns; never throws up to caller

**Task 2 — ENGINE_VERSION 3.3.0:**
- Bumped from 3.2.0 in version.ts with lineage doc comment noting P3 Apollo blend rewire
- Invalidates all L1/L2 cached rows with 3.2.0 (prediction-cache.ts keys on ENGINE_VERSION)
- version.test.ts and PIPE-08 aggregator test updated to 3.3.0

## Verification Results

- `npm test` — 1815/1815 GREEN (169 files, 0 failures) after both tasks
- `npx tsc --noEmit` — 0 errors
- `grep -q "apollo: 0.35"` → PASS (weight value preserved)
- `grep -q '"3.3.0"' src/lib/engine/version.ts` → PASS
- `grep -q "variants.*apollo" src/app/api/analyze/route.ts` → PASS
- Wave 0 R5/D-04 cases: `blend uses behavioral + apollo` GREEN, `gemini retired from raw_overall_score` GREEN
- `grep -c '.eq("user_id"' route.ts` → 7 (V4 access control preserved)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wave 0 test cases had wrong assertion direction for "behavioral=false" case**
- **Found during:** Task 1 GREEN phase (tests failing)
- **Issue:** Original tests expected `apollo=1` when `behavioral=false, gemini=true`. But since apollo and behavioral are co-sourced (both from deepseekResult), when behavioral=false, apollo is also false → both 0
- **Fix:** Updated test to assert `apollo=0` when `behavioral=false`; also updated the "always sums to 1.0" combo loop to only test `behavioral=true` combos
- **Files modified:** aggregator.test.ts, aggregator-audio.test.ts, aggregator-phase10.test.ts
- **Commit:** 00cc8ceb

**2. [Rule 1 - Bug] aggregator-cta-penalty.test.ts Test 18 expected penalty-affected overall_score**
- **Found during:** Task 1 GREEN phase (CTA penalty test failing)
- **Issue:** Test 18 asserted `penaltyResult.overall_score < noPenaltyResult.overall_score`. With gemini retired from the blend (D-04), applyCtaPenalty on gemini no longer affects overall_score
- **Fix:** Updated Test 18 to assert `penaltyResult.overall_score === noPenaltyResult.overall_score` (correct post-D-04 behavior: CTA is Apollo §2.4 critique evidence, not a blend-math penalty)
- **Files modified:** aggregator-cta-penalty.test.ts
- **Commit:** 00cc8ceb

**3. [Rule 1 - Bug] version.test.ts + PIPE-08 aggregator test hardcoded "3.2.0"**
- **Found during:** Task 2 (ENGINE_VERSION bump to 3.3.0)
- **Issue:** Two tests expected literal `"3.2.0"` after bump
- **Fix:** Updated both to `"3.3.0"`
- **Files modified:** version.test.ts, aggregator.test.ts
- **Commit:** 5a179539

**4. [Rule 2 - Missing critical] verbatim threaded in pipeline.ts (not aggregator.ts)**
- **Found during:** Task 1 — plan said "when calling reasonWithDeepSeek" but that call is in pipeline.ts not aggregator.ts
- **Issue:** Plan listed aggregator.ts as the file but reasonWithDeepSeek is called from pipeline.ts. Acceptance criteria `grep -q "verbatim" aggregator.ts` was already satisfied by the existing verbatim pluck
- **Fix:** Added verbatim threading to pipeline.ts (the actual call site). Imported VerbatimPayload in pipeline.ts
- **Files modified:** src/lib/engine/pipeline.ts (not in plan's files_modified list)
- **Commit:** 00cc8ceb

**5. [Rule 2 - Missing critical] apollo_reasoning field needed on PredictionResult for route.ts access**
- **Found during:** Task 2 — route.ts receives `finalResult: PredictionResult` and needed Apollo data (rewrites/dims/composite/scope) to persist to variants.apollo
- **Issue:** PredictionResult.reasoning was "" (string), not the structured Apollo output; route.ts had no access to raw deepseekResult.reasoning fields
- **Fix:** Added optional `apollo_reasoning` to PredictionResult in types.ts; aggregator.ts populates it from deepseek.rewrites/dimensions/composite_score/confidence_scope when deepseek is available
- **Files modified:** types.ts (apollo_reasoning field), aggregator.ts (populate it)
- **Commit:** 5a179539

## Known Stubs

None — all wiring is real (no hardcoded empty values or mock data flows). The `apollo_reasoning` field is null when deepseek is unavailable (circuit breaker) — this is the correct graceful degradation path, not a stub.

## Threat Flags

None — no new network endpoints or auth paths beyond what the plan's threat model covers. All mitigations implemented:
- T-03-09 (variants wholesale-overwrite): read-merge-write `{ ...current, apollo }` — craft/remix preserved. MITIGATED.
- T-03-10 (cross-user boundary): `.eq("user_id", userId)` on both SELECT and UPDATE in `persistApolloToVariants`. MITIGATED.
- T-03-11 (stale pre-Apollo score): ENGINE_VERSION 3.3.0 bump invalidates L1/L2 cache. MITIGATED.

## Checkpoint Resolution (Task 3 — live verify, by orchestrator 2026-06-05)

The blocking `checkpoint:human-verify` was run by the orchestrator on a real .mp4 (the
full `runPredictionPipeline` + `aggregateScores`, bypassCache, twice for the R8 band).
**It surfaced two real bugs the mocked unit tests could not — both now fixed (commit b3b7bf2c).**

**Bug 1 — Apollo §4 contract never elicited the strict JSON shape.** `APOLLO_INSTRUCTION`
is prose-only; the model omitted the legacy `behavioral_predictions`/`component_scores`/
`suggestions`/`confidence` fields, emitted `dimensions` as an object (not array), and never
produced `rewrites`. Zod validation failed all 3 retries → `reasonWithDeepSeek` returned
`null` → `overall_score` collapsed to **0** (behavioral shares the same call). Fix: an
explicit JSON OUTPUT CONTRACT enumerating every required key/type, added to the **volatile
user message** (`buildDeepSeekUserMessage`) so the cached `apollo-core.ts` prefix stays
byte-stable.

**Bug 2 — unbounded CoT timeout.** The Apollo call had no `max_tokens`/`thinking_budget`,
so the reasoning model emitted unbounded thinking on the full `KNOWLEDGE_CORE` prefix and
timed out (>90s). Fix: `max_tokens: 3000` + `enable_thinking: true` + `thinking_budget: 3000`
(mirrors pass2/decode/stage11); `TIMEOUT_MS` 90s → 120s.

**Live results (two runs on the same video):**

| Req | Result | Verdict |
|-----|--------|---------|
| R2 — `rewrites[].original` == verbatim hook | all 3 rewrites grounded both runs; 6 dimensions w/ §2 lever + quoted evidence; composite 0–100; distinct `lever_fixed` | ✅ PASS |
| R6 — latency under 300s cap | 117.7s / 119.2s (Apollo ~76s) | ✅ PASS (under cap w/ headroom; above ≤90s stretch target) |
| R8 — composite band on re-run | overall 72/68 (±4), apollo composite 76/71 (±5) | ✅ within **provider noise band** (STATE.md 2026-06-04 reframe; bounded thinking-mode CoT drift, user-approved) |

R8 note: the plan's optimistic ±1–2 was written before this thinking-mode Apollo call existed;
±5 on a holistic expert composite is the same class of drift STATE.md already accepted for the
wave3 pass2 thinking pass. User approved treating it as within-noise-band.

Persistence (step 4): `apollo_reasoning` shape verified live; `overall_score` reflects the new
behavioral+apollo blend (68–72, not 0, not stale). `persistApolloToVariants` read-merge-write +
user_id scoping + ENGINE_VERSION 3.3.0 invalidation are unit-tested; live authed row-write
through `/api/analyze` deferred as acceptable.

Post-fix gates: `tsc` clean · `vitest run src/lib/engine` 943 passed/18 skipped · `npm run build` success.

## Self-Check

- [x] `src/lib/engine/aggregator.ts` — SCORE_WEIGHTS, SCORE_WEIGHT_KEYS, selectWeights, blend math, confidence, apollo_reasoning all updated
- [x] `src/lib/engine/types.ts` — SignalAvailability.apollo, PredictionResult.score_weights.apollo, PredictionResult.apollo_reasoning all added
- [x] `src/lib/engine/pipeline.ts` — verbatim threaded into reasonWithDeepSeek
- [x] `src/lib/engine/version.ts` — ENGINE_VERSION "3.3.0"
- [x] `src/app/api/analyze/route.ts` — persistApolloToVariants() + two call sites
- [x] All aggregator test files updated for apollo blend
- [x] Commits exist: c599f1c4 (RED), 00cc8ceb (GREEN Task 1), 5a179539 (Task 2)
- [x] `npm test` — 1815/1815 GREEN (0 failures)
- [x] `npx tsc --noEmit` — 0 errors

## Self-Check: PASSED
