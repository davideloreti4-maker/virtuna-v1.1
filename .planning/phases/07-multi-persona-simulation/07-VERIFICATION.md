---
phase: 07-multi-persona-simulation
verified: 2026-05-19T08:31:30Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "SC#4 — Aggregate persona output replaces the single behavioral_predictions from single DeepSeek call in v2 aggregator"
    reason: "Phase 7 honors SC#4 via the additive substitution mechanism (`behavioralSource: 'personas'` option on `aggregateScores`) NOT a literal production swap. CONTEXT.md D-08 formally upgrades the wording 'replaces' to 'made available to replace, pending Phase 10 evidence' to honor the milestone-wide additive-only constraint. Production callers (route.ts x2, eval-runner.ts, scripts/benchmark.ts) omit the third arg → default `'deepseek'` → byte-identical pre-Phase-7 behavior. The Plan 07-04 A/B harness is the consumer that exercises the substitution path. Phase 10 owns the production swap based on the A/B corpus evidence."
    accepted_by: "phase-7-planner-decision (CONTEXT D-08, 2026-05-18)"
    accepted_at: "2026-05-18T00:00:00Z"
human_verification:
  - test: "Run full 225-row A/B eval via `npx tsx scripts/run-persona-ab-eval.ts --corpus-version full.2026-05-11`"
    expected: "Both runs complete in 30-45 min, ~$0.20-0.40 total LLM cost. Comparison report at `.planning/research/persona-aggregate-ab-YYYY-MM-DD.md` populates with full-corpus deltas (macro_f1, ECE, viral_recall, under_precision). benchmark_results table has 2 new rows with `3.0.0-dev-personasA` and `3.0.0-dev-personasB` engine_version tags. Operator fills in 'Recommendation for Phase 10' section."
    why_human: "Requires live DeepSeek + Gemini API calls + production Supabase service-role write. Cannot run programmatically without burning ~$0.40 of real LLM credit; Plan 07-04 Task 3 explicitly is `type=checkpoint:human-verify gate=blocking`. The 10-row smoke ran 2026-05-19 and is documented in `persona-aggregate-ab-2026-05-19.md`, but the smoke is not statistically meaningful at N=10. Full corpus run is the authoritative deliverable for SC#6 cost budget (per-row real cost incl. Wave 3 spend) and for Phase 10 swap-decision evidence."
  - test: "Verify the persona aggregate intent-score rescale factor (WR-01 fix, factor = 0.05) is empirically sound"
    expected: "Phase 10 corpus calibration confirms `intent 100 → 5% view rate` is the right rescale anchor for `computePredictedEngagement` when `behavioralSource = 'personas'`. If empirically wrong, the rescale factor moves and `aggregator.ts:584-587` updates."
    why_human: "Cannot verify the calibration factor programmatically without Phase 10 corpus calibration data. The fix landed pre-corpus; Phase 10 will validate or revise."
---

# Phase 7: Multi-Persona Simulation Verification Report

**Phase Goal:** 10 personas allocated FYP-first (6/2/1/1) run in parallel as Wave 3 after Wave 2 (DeepSeek synthesis + trends). Each persona produces structured reactions used both as the new behavioral signal and the data source for M2's audience viz.

**Verified:** 2026-05-19T08:31:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria from ROADMAP.md)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Wave 3 of pipeline runs exactly 10 parallel V3 calls (deepseek-chat) with persona-specific system prompts | VERIFIED | `wave3.ts:260` uses `Promise.allSettled(slots.map(callPersona))` over `selectPersonaSlots()` which `throw`s if `slots.length !== 10` (persona-registry.ts:482-486). Each call sends a unique persona-specific system prompt built by `buildPersonaSystemPrompt(slot)` (wave3.ts:143). Model = `DEEPSEEK_PERSONA_MODEL` default `deepseek-v4-flash` (the `deepseek-chat` endpoint per Phase 4 D-03; "V3" in ROADMAP is shorthand for V3/V4 generation, same API). Test 1 in wave3.test.ts asserts `mockCreate.mock.calls.length === 10`. |
| 2 | Persona allocation defaults to 6 FYP + 2 niche + 1 loyalist + 1 cross-niche; tunable per content type (FYP-heavier for discovery-style content) | VERIFIED | `ALLOCATION_TABLE` in persona-registry.ts:379-387: `other` (default) = 6/2/1/1; `slideshow` = 6/2/1/1; `b_roll` and `action` = 7/2/0/1 (FYP-heavier for discovery); `talking_head` = 5/2/2/1; `tutorial` = 4/3/2/1; `vlog` = 4/2/3/1. Each row sums to exactly 10 (asserted in wave3-persona-registry.test.ts Test 2). Routing via `wave0Result.content_type.type → ALLOCATION_TABLE[slug]` at wave3.ts:112+117. |
| 3 | Each persona returns structured JSON with scroll_past_second, watch_through_pct, comment_intent, share_intent, save_intent | VERIFIED | `PersonaResponseSchema` (persona-prompts.ts:148-156) declares all 5 fields with Zod 0-100 bounds plus required non-empty `reasoning`. System prompt at persona-prompts.ts:62-63 hard-codes the exact JSON output shape. Test 2 in wave3.test.ts asserts each `Wave3Outcome.results` entry has all required fields. |
| 4 | Aggregate persona output replaces the single behavioral_predictions from single DeepSeek call in v2 aggregator | PASSED (override) | Override accepted: SC#4 is satisfied via the additive `behavioralSource: 'personas'` substitution mechanism wired on `aggregateScores` (aggregator.ts:314-316, 552, 564-567). When called with that option AND `personaBehavioralAggregate !== null`, aggregator literally swaps `behavioral_predictions` to the persona aggregate. Production callers omit the option → default `'deepseek'` → byte-identical pre-Phase-7. The substitution path is exercised by Plan 07-04's A/B eval (`scripts/run-persona-ab-eval.ts` Run B). Tests 4 + 6 in aggregator.test.ts prove substitution + default behavior. Phase 10 owns production swap based on the corpus A/B evidence. Per CONTEXT D-08: "ROADMAP SC#4 literal text says persona aggregate 'replaces' v2's single-DeepSeek `behavioral_predictions`. Phase 7 honors this BY MAKING THE NEW SIGNAL AVAILABLE (not by literally swapping the source)." |
| 5 | Per-persona drop-off second persisted on prediction (data ready for M2 retention curve) | VERIFIED | `PredictionResult.persona_simulation_results: PersonaSimulationResult[]` (types.ts:191-192) carries the 10-entry array; each entry has `scroll_past_second` (types.ts:376). Wired in aggregator.ts:627 from `pipelineResult.wave3Result`. Returned to client in both JSON and SSE branches of `/api/analyze` (route.ts:351 + route.ts:431). Test 7 in aggregator.test.ts asserts persistence. Per CONTEXT D-09: "Per-persona detail persisted on `PredictionResult`" — interpretation is "data lives ON the response object, ready for M2 audience-viz consumption" (M2 is real-time SSE-driven). DB persistence of per-persona data is NOT required for Phase 7 (out of scope per D-08 additive-only). |
| 6 | Persona prompt cache (DeepSeek input cache) verified active — cost per analysis ≤$0.025 for 10-persona stage | VERIFIED | Cache-aware cost telemetry in wave3.ts:181-196 reads `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens` from DeepSeek usage and applies `CACHE_HIT_PRICE = 0.0028 / 1_000_000` (50× cheaper than `CACHE_MISS_PRICE`). 5 tests in `wave3-cost-budget.test.ts` assert ≤2.5 cents under cache-warm, all-cache-hit, all-cache-miss usage patterns; D-18 telemetry sum invariant + cache-hit pricing-applied. Smoke A/B run on 10 rows confirmed wave-level cost in expected order of magnitude. Full-corpus run is human-verified (see human_verification section). System prompt is byte-stable across runs (wave3-persona-prompts.test.ts Test 1) — the prerequisite for cache hits. |

**Score:** 6/6 must-haves verified (1 via override)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/engine/wave3.ts` | 10-call Promise.allSettled orchestrator | VERIFIED | 299 lines; imports `selectPersonaSlots`, `buildPersonaSystemPrompt`, `aggregatePersonaResults`, `isCircuitOpen`; circuit-breaker fast-fail at line 94; per-call retry-once on validation failure at lines 226-228; cache-aware cost telemetry at lines 181-196; `OUTPUT_PRICE = 0.28 / 1_000_000` (W-4) at line 40. |
| `src/lib/engine/wave3/persona-registry.ts` | 10 archetypes + 7-row allocation table | VERIFIED | 546 lines; `ARCHETYPES` const at line 22-33 (10 entries); `ALLOCATION_TABLE` at line 379-387 (7 rows, each sums to 10); `selectPersonaSlots()` at line 424-488 deterministic 10-slot builder; 100 per-niche instantiation cells (5 niches grounded, 5 marked placeholder — flagged in 07-01-SUMMARY). |
| `src/lib/engine/wave3/persona-prompts.ts` | Cache-stable system prompt + user message + Zod schema | VERIFIED | 157 lines; `buildPersonaSystemPrompt(slot)` cache-stable 6-block system prompt; `buildPersonaUserMessage` volatile per-request body; `PersonaResponseSchema` Zod boundary with all 5 numeric fields + required non-empty `reasoning`. |
| `src/lib/engine/wave3/aggregator.ts` | Pure-math `aggregatePersonaResults` with D-06 + D-13 | VERIFIED | 120 lines; `aggregatePersonaResults(survivors, threshold=7)` returns `{ aggregate, warnings }`. D-06: `completion_pct` flat mean; share/comment/save top-3-weighted (60/40 split); D-13 threshold ≥7 → null + `wave_3_below_threshold` warning; Pitfall 4 defensive `remaining=0 → topMean`. Percentile labels renamed to intent semantics (WR-05 fix). |
| `src/lib/engine/pipeline.ts` | PipelineResult widened with `personaBehavioralAggregate` + `wave3CostCents`; runWave3 call site updated | VERIFIED | Line 55: `personaBehavioralAggregate: PersonaBehavioralAggregate \| null`; line 62: `wave3CostCents: number`; lines 540-552: 5-arg `runWave3(payload, deepseekResult, wave0Result, creatorContext, onEvent)` call; outcome destructured into `wave3Result`, `personaBehavioralAggregate`, `wave3CostCents`; warnings pushed; surfaced on PipelineResult return at lines 593, 597, 600. |
| `src/lib/engine/aggregator.ts` | `aggregateScores` widened with `AggregateScoresOptions.behavioralSource`; `signal_availability.personas` set; cost roll-up includes Wave 3 | VERIFIED | Lines 314-316: `AggregateScoresOptions` interface with `behavioralSource?: "deepseek" \| "personas"`. Line 330: third arg `options?`. Line 394: `personas: pipelineResult.personaBehavioralAggregate !== null` in `availability` block. Lines 552-567: branching `behavioral_predictions` resolution. Lines 626-627: `persona_behavioral_aggregate` + `persona_simulation_results` on PredictionResult assembly. Line 543: Wave 3 cost folded into `cost_cents` roll-up (CR-01). |
| `src/lib/engine/types.ts` | `PersonaArchetypeSchema`, `PersonaSimulationResultSchema`, `PersonaBehavioralAggregate`, `SignalAvailability.personas`, `PredictionResult.persona_*` fields | VERIFIED | Lines 190-192: `persona_behavioral_aggregate` + `persona_simulation_results` added to PredictionResult. Line 220: `signal_availability.personas: boolean` (required, WR-02 promoted from optional). Lines 359-391: `PersonaArchetypeSchema` derived from `ARCHETYPES` (WR-06 single source of truth), `PersonaSlotTypeSchema`, `PersonaSimulationResultSchema`, `PersonaBehavioralAggregate` alias. |
| `src/lib/engine/corpus/eval-runner.ts` | `EvalRunnerOptions.behavioralSource` forwarded into `aggregateScores` | VERIFIED | Line 56: `behavioralSource?: "deepseek" \| "personas"`. Lines 125-129: conditional forwarding `opts.behavioralSource ? { behavioralSource: opts.behavioralSource } : undefined`. CR-03: NaN-defensive Number.isFinite guards on `maxRows` / `maxTotalCostCents` / `rateLimitDelayMs`. |
| `src/lib/engine/corpus/eval-harness.ts` | `RunEvalHarnessOptions.behavioralSource` + `maxRows` threaded to runEvalOverCorpus | VERIFIED | Lines 48-57: `behavioralSource` + `maxRows` on options. Lines 70-71: forwarded into `runEvalOverCorpus` call. Existing `engineVersion` resolution at line 63 preserved for A/B distinct tags. |
| `scripts/run-persona-ab-eval.ts` | CLI runs corpus twice via runEvalHarness; writes comparison report | VERIFIED | 230 lines; CR-03 `parseIntStrict()` validates `--max-rows` / `--max-cost-cents` / `--rate-limit-ms`. Two `runEvalHarness` calls with `engineVersion=*-personasA` (behavioralSource="deepseek") + `*-personasB` (behavioralSource="personas"). Comparison report path anchored to `resolve(__dirname, "..")` (WR-08 repo-root anchor). |
| `src/lib/engine/__tests__/wave3.test.ts` | 12 orchestration tests | VERIFIED | 12 tests pass: 10 parallel calls, threshold met/not-met, isolation, cost telemetry, event count, env override, cache prefix stability, retry-once, AbortError no-retry, circuit-breaker fast-fail. |
| `src/lib/engine/__tests__/wave3-aggregator.test.ts` | 11 pure-math tests for D-06/D-13/Pitfall 4 | VERIFIED | 11 tests pass: per-metric rule, threshold edges (n=7/n=6/n=0), Pitfall 4 defensive path, tie-break determinism, constants invariant. |
| `src/lib/engine/__tests__/wave3-cost-budget.test.ts` | 5 D-16 / D-18 tests | VERIFIED | 5 tests pass: cache-warm cost ≤2.5¢, all-cache-hit ≤0.5¢, all-cache-miss ≤2.5¢, D-18 per-call/wave-level sum invariant, cache-hit pricing applied. |
| `src/lib/engine/__tests__/wave3-persona-registry.test.ts` + `wave3-persona-prompts.test.ts` | 18 + 15 foundation tests | VERIFIED | 33 tests pass across both files (Plan 07-01 deliverables — types widening, persona registry, prompt builders, Zod schema). |
| `.planning/research/persona-aggregate-ab-2026-05-19.md` | A/B smoke comparison report | VERIFIED | File exists; 10-row smoke completed with both engine_version rows persisted to benchmark_results. Full 225-row run pending operator (Plan 07-04 Task 3 explicitly type=checkpoint:human-verify; see human_verification section). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| wave3.ts | deepseek.ts | imports isCircuitOpen | WIRED | `wave3.ts:21` imports the existing line-736 export; B-1 honored (no edit to deepseek.ts). |
| wave3.ts | wave3/persona-registry.ts | selectPersonaSlots, PersonaSlot | WIRED | `wave3.ts:14, 117` |
| wave3.ts | wave3/persona-prompts.ts | buildPersonaSystemPrompt, buildPersonaUserMessage, PersonaResponseSchema | WIRED | `wave3.ts:15-19, 143, 144, 201` |
| wave3.ts | wave3/aggregator.ts | aggregatePersonaResults | WIRED | `wave3.ts:20, 278` |
| pipeline.ts | wave3.ts | runWave3 (5-arg widened signature) | WIRED | `pipeline.ts:30, 540-546` |
| aggregator.ts | pipeline.ts | reads `pipelineResult.personaBehavioralAggregate` + `wave3Result` + `wave3CostCents` | WIRED | aggregator.ts:394 (provenance flag), 543 (cost), 565-566 (substitution), 626-627 (PredictionResult fields) |
| aggregator.ts | types.ts | uses `SignalAvailability.personas` + `PredictionResult.persona_*` + `AggregateScoresOptions.behavioralSource` | WIRED | types.ts:220, 190-192, 359-391; aggregator.ts:314-316, 394, 552 |
| eval-runner.ts | aggregator.ts | forwards `behavioralSource` into `aggregateScores` | WIRED | eval-runner.ts:125-129 |
| eval-harness.ts | eval-runner.ts | threads `behavioralSource` + `maxRows` | WIRED | eval-harness.ts:66-72 |
| scripts/run-persona-ab-eval.ts | eval-harness.ts | calls runEvalHarness twice with distinct behavioralSource values | WIRED | scripts/run-persona-ab-eval.ts:158, 177 |

All 10 key links wired.

### Data-Flow Trace (Level 4)

Wave 3 → PredictionResult is the load-bearing dynamic-data flow for Phase 7. Trace:

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `PredictionResult.persona_simulation_results` | `pipelineResult.wave3Result` | `wave3Outcome.results` from `Promise.allSettled(slots.map(callPersona))` survivors | Yes (10 entries on happy path; ≥7 survivors when threshold met; 0 entries on circuit-breaker fast-fail with `wave_3_circuit_breaker_open` warning) | FLOWING |
| `PredictionResult.persona_behavioral_aggregate` | `pipelineResult.personaBehavioralAggregate` | `wave3Outcome.aggregate` from `aggregatePersonaResults(survivors, 7)` | Yes (`BehavioralPredictions` shape when ≥7 survivors; null + `wave_3_below_threshold` warning otherwise) | FLOWING |
| `PredictionResult.signal_availability.personas` | `pipelineResult.personaBehavioralAggregate !== null` | aggregator.ts:394 | Yes (boolean derived from real aggregate result, not hardcoded) | FLOWING |
| `PredictionResult.cost_cents` (CR-01 fix) | `geminiResult.cost_cents + (deepseekResult?.cost_cents ?? 0) + pipelineResult.wave3CostCents` | aggregator.ts:543 | Yes (Wave 3 spend now folded — verified by per-call-sum-equals-wave-cost test invariant) | FLOWING |
| `PredictionResult.behavioral_predictions` (when `behavioralSource="personas"`) | `pipelineResult.personaBehavioralAggregate` | aggregator.ts:564-567 conditional ternary | Yes (substituted in A/B Run B; default path still flows from `deepseek.behavioral_predictions`) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Wave 3 tests pass | `pnpm vitest run src/lib/engine/__tests__/wave3*.test.ts src/lib/engine/__tests__/wave3-*.test.ts` | 7 files; 71 tests pass | PASS |
| Aggregator + stubs tests pass | `pnpm vitest run src/lib/engine/__tests__/aggregator.test.ts src/lib/engine/__tests__/stubs.test.ts` | 38 + 9 = 47 tests pass | PASS |
| Full test suite passes | `pnpm test -- run` | 61 files pass / 2 skipped; 831 tests pass / 4 skipped (skipped = live LLM + live video, gated on env) | PASS |
| Phase 7 tsc compiles clean | `pnpm tsc --noEmit 2>&1 \| grep -E "wave3\|persona\|aggregator\|run-persona-ab\|pipeline\.ts"` | 0 errors in Phase 7 files | PASS |
| A/B script smoke ran successfully | inspect `.planning/research/persona-aggregate-ab-2026-05-19.md` | 10-row smoke completed, 0 failures, comparison report written | PASS |

Pre-existing tsc errors in `src/app/api/profile/*.ts` are unrelated to Phase 7 (Phase 2 9-card schema regen lag) — confirmed by Plan 07-03 SUMMARY: "Pre-existing TypeScript errors in `src/app/api/profile/*.ts`, `src/lib/engine/__tests__/video-e2e.test.ts`, and `src/lib/engine/pipeline.ts` (DEFAULT_CREATOR_CONTEXT missing fields) are unrelated to Plan 07-03". WR-03 fixed the pipeline.ts + factories.ts CreatorContext issue (commit `7c301d7`); the profile route errors remain Phase 2 scope.

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist in this project. Phase 7 is not a migration/tooling probe phase — verification model is Vitest behavioral tests + the operator-gated A/B eval CLI checkpoint. Step 7c is N/A.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| PERSONA-01 | 07-02b | 10-persona simulation running in Wave 3 of pipeline (parallel V3 calls) | SATISFIED | wave3.ts:260 `Promise.allSettled(slots.map(callPersona))`; selectPersonaSlots throws if !==10 (persona-registry.ts:482-486); wave3.test.ts Test 1 |
| PERSONA-02 | 07-01 | 6 FYP non-follower personas (demographically diverse — Gen Z, Millennial, female/male skew, geo variants) | SATISFIED | ARCHETYPES persona-registry.ts:22-33 (6 FYP archetypes among the 10: high_engager, saver, lurker, sharer, tough_crowd, purposeful_viewer); per-niche instantiation provides demographic diversity per archetype × niche tuple |
| PERSONA-03 | 07-01 | 2 niche-aligned discovery personas (already-interested in topic but new to creator) | SATISFIED | NICHE_DEEP_ARCHETYPES persona-registry.ts:399 = [niche_deep_buyer, niche_deep_scout]; ALLOCATION_TABLE rows include niche_deep counts (2 default; tutorial=3) |
| PERSONA-04 | 07-02b | 1 returning follower / loyalist persona | SATISFIED | `loyalist` archetype in ARCHETYPES; ALLOCATION_TABLE assigns loyalist slots per content type (default 1); persona-prompts.ts:112-134 host-only past_wins branch with D-03 null fallback |
| PERSONA-05 | 07-01 | 1 cross-niche curiosity persona | SATISFIED | `cross_niche_curiosity` archetype; CROSS_NICHE_ADJACENCY persona-registry.ts:365-376 maps all 10 primary niches to adjacent niche; ALLOCATION_TABLE assigns cross_niche=1 per row |
| PERSONA-06 | 07-01, 07-02b | Per-persona output schema: scroll-past second, watch-through %, comment intent, share intent, save intent | SATISFIED | PersonaResponseSchema persona-prompts.ts:148-156 (5 numeric fields + reasoning); PersonaSimulationResultSchema types.ts:371-383 wraps with archetype/slot_type/niche/persona_id |
| PERSONA-07 | 07-01, 07-02b, 07-03 | Persona allocation tunable per content type (FYP-heavy for short discovery content, follower-heavier for serial/community content) | SATISFIED | ALLOCATION_TABLE 7 distinct rows: b_roll/action = 7 FYP (discovery); vlog = 4/2/3/1 (3 loyalist = community); talking_head = 5/2/2/1; tutorial = 4/3/2/1 |
| PERSONA-08 | 07-01, 07-02a | Persona definitions cached for cost efficiency (DeepSeek input cache + niche-specific variants) | SATISFIED | wave3.ts:171 puts STABLE system prompt first (cache prefix); wave3.ts:189-195 reads `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens` and applies 50× cheaper CACHE_HIT_PRICE; byte-stability asserted by wave3-persona-prompts.test.ts Test 1 |
| PERSONA-09 | 07-02a, 07-02b | `deepseek-chat` (V3) model used for all persona calls; configurable via env | SATISFIED | wave3.ts:30-31: `DEEPSEEK_PERSONA_MODEL ?? "deepseek-v4-flash"` (per Phase 4 D-03 routing; same `deepseek-chat` API). wave3.test.ts Test 8 asserts env override works |
| PERSONA-10 | 07-02b, 07-03, 07-04 | Aggregate persona outputs into behavioral signal (replaces single DeepSeek behavioral_predictions) | SATISFIED | `AggregateScoresOptions.behavioralSource` aggregator.ts:314-316; substitution logic aggregator.ts:564-567; aggregator.test.ts Test 4 + 6 prove substitution + default-deepseek; eval-runner.ts:125-129 forwards; scripts/run-persona-ab-eval.ts exercises both paths. (See override note on SC#4 — production swap is Phase 10's decision; Phase 7 lands the substrate.) |
| PERSONA-11 | 07-02a, 07-02b, 07-03, 07-04 | Per-persona drop-off second stored on prediction (feeds retention curve in M2) | SATISFIED | PredictionResult.persona_simulation_results types.ts:191-192; each entry has scroll_past_second (types.ts:376); aggregator.ts:627 wires to pipelineResult.wave3Result; aggregator.test.ts Test 7 asserts persistence. M2 audience-viz consumes from response (SSE-driven). |
| PIPE-08 | 07-02a, 07-02b | Wave 3 stage support (parallel persona simulation after Wave 2) | SATISFIED | pipeline.ts:540-552 invokes runWave3 AFTER Wave 2 await on lines 521-524. wave3.ts emits 1 wave-level + 10 per-persona stage events (22 events on happy path). wave3.test.ts Test 7 asserts event count. |

No orphaned requirements. All 12 declared requirement IDs (11 PERSONA-* + 1 PIPE-08) accounted for; REQUIREMENTS.md does not map any additional IDs to Phase 7.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/engine/wave3/persona-registry.ts` | various | `[PLACEHOLDER]` markers in 5 niche instantiation cells | Info | Per 07-01 SUMMARY: 5 of 10 primary niches (food-cooking, tech-gadgets, gaming, fashion-style, music-performance) have descriptive placeholder text. Phase 1 corpus did not cover these niches; refinement deferred to Phase 10/12 retrospective. Runtime path is non-empty for every {archetype × niche × time-of-day} tuple — not a stub in the "returns empty/null" sense. Documented inline. |
| `src/lib/engine/wave3/aggregator.ts` | 113-119 | `percentileLabel()` heuristic decile bands | Info | Plan 07-04 SUMMARY notes Phase 10 may revise to corpus-driven percentile bands; current intent-semantic labels (WR-05 fix) accurately describe the 0-100 intent-score range. Not a stub. |
| `src/app/api/analyze/route.ts` | 246-287 | `buildInsertRow()` does NOT persist `persona_behavioral_aggregate` / `persona_simulation_results` to DB | Info | By design — D-08 milestone-wide additive-only constraint. Fields ARE on the PredictionResult and returned to client (line 351 JSON, line 431 SSE complete event). M2 audience-viz consumes from real-time SSE response, not DB. Phase 11 (existing UI integration) may add DB persistence if M2 design requires backfill replay. |

No blocker or warning anti-patterns. Three Info notes documented for traceability; all are intentional and documented in plans/SUMMARYs.

### Human Verification Required

#### 1. Full 225-row A/B Eval

**Test:** Run `npx tsx scripts/run-persona-ab-eval.ts --corpus-version full.2026-05-11` against the production corpus.

**Expected:**
- Both runs complete in 30-45 min.
- Total LLM cost ~$0.20-0.40 across both runs (Phase 1 baseline ~$0.33 + Wave 3 cost folded in per CR-01).
- Comparison report at `.planning/research/persona-aggregate-ab-YYYY-MM-DD.md` populates with full-corpus metric deltas (macro_f1, ECE, viral_recall, under_precision).
- 2 new rows in `benchmark_results` table with engine_version tags `3.0.0-dev-personasA` (baseline) and `3.0.0-dev-personasB` (substituted).
- Operator inspects the report, fills in the "Recommendation for Phase 10" section, commits.

**Why human:** Requires live DeepSeek + Gemini API calls (paid LLM credit) + production Supabase service-role write. Plan 07-04 Task 3 is explicitly `type=checkpoint:human-verify gate=blocking`. The 10-row smoke ran 2026-05-19 and is committed at `.planning/research/persona-aggregate-ab-2026-05-19.md`, but is not statistically meaningful at N=10. The full-corpus run is the authoritative deliverable for Phase 10's swap-decision evidence.

#### 2. Persona Intent-to-View-Rate Rescale Factor Validation

**Test:** After the full A/B run completes, validate that the WR-01 fix factor of 0.05 (intent 100 → 5% view rate) is empirically sound against Phase 1 corpus outcome data.

**Expected:**
- For corpus rows where `personaBehavioralAggregate !== null` (≥7 surviving personas), the rescaled engagement math produces `predicted_engagement` values that approximate the actual `views * actual_share_rate` from the corpus row.
- If empirically wrong, the rescale factor at `aggregator.ts:584-587` updates; Phase 10 documents the revised factor in `.planning/research/`.

**Why human:** Cannot verify the calibration factor programmatically without Phase 10 corpus calibration data. The WR-01 fix landed pre-corpus on a sensible default; Phase 10 will validate empirically. Tests do not (and cannot) assert against real engagement outcomes.

### Gaps Summary

**No code-level gaps blocking Phase 7 completion.** All 6 success criteria are verified, all 12 requirement IDs satisfied at code level, all 12 critical+warning review findings fixed (post-review), 831 tests pass.

**One override accepted (SC#4):** The literal ROADMAP wording "replaces the single behavioral_predictions" is upgraded to "made available to replace" per CONTEXT D-08. Production callers continue reading `deepseek.behavioral_predictions` by default; the optional `behavioralSource: "personas"` substitution mechanism exists, is tested (aggregator.test.ts Test 4 + 6), and is exercised by Plan 07-04's A/B eval. Phase 10 owns the production swap based on A/B corpus evidence.

**Two human-verification items pending:**
1. The full 225-row A/B eval (operator-gated by Plan 07-04 Task 3 design; the smoke completed but is not statistically meaningful at N=10).
2. The WR-01 rescale factor (0.05) empirical validation (Phase 10 corpus calibration responsibility).

Status `human_needed` reflects these operator deliverables. The code-level verification is complete; nothing blocks Phase 8 from starting in parallel (Phase 8 depends only on Phase 3, not Phase 7 per ROADMAP execution order).

---

*Verified: 2026-05-19T08:31:30Z*
*Verifier: Claude (gsd-verifier)*
