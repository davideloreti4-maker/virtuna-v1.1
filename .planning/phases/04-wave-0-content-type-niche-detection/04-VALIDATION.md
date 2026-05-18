---
phase: 4
slug: wave-0-content-type-niche-detection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-18
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `04-RESEARCH.md` §"Validation Architecture" (lines 1651-1713).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 (node environment) |
| **Config file** | `vitest.config.ts` (80% coverage threshold on `src/lib/engine/**`) |
| **Quick run command** | `pnpm test <single-test-file>` (~5-15s typical) |
| **Subdir command** | `pnpm test src/lib/engine` (~30-60s) |
| **Full suite command** | `pnpm test` (currently 549; Phase 4 target ~620 across ~43 files) |
| **Estimated runtime** | ~60s subdir; ~5min full suite |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test <task-touched-test-file>` (single file, ~5-15s)
- **After every plan wave:** Run `pnpm test src/lib/engine` (~30-60s)
- **Before `/gsd-verify-work`:** Full suite (`pnpm test`) must be green
- **Max feedback latency:** <60s subdir; <5min full

---

## Per-Task Verification Map

> Filled by planner during plan synthesis. The table below shows the requirement → test boundary derived from RESEARCH.md.

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| CONTENT-01 | Content-type detector returns 7-cat enum + confidence + mixed flag | unit | `pnpm test src/lib/engine/__tests__/wave0-content-type.test.ts` | ❌ Wave 0 — new | ⬜ pending |
| CONTENT-01 | Cost ≤ $0.005/call asserted defensively | unit | `pnpm test src/lib/engine/__tests__/wave0-content-type.test.ts -t "cost"` | ❌ Wave 0 — new | ⬜ pending |
| CONTENT-02 | Niche detector returns hierarchical `{primary, sub, micro, confidence}` | unit | `pnpm test src/lib/engine/__tests__/wave0-niche-detector.test.ts` | ❌ Wave 0 — new | ⬜ pending |
| CONTENT-02 | Card 1 fallback at confidence < 0.6 (D-05) | unit | `pnpm test src/lib/engine/__tests__/wave0-niche-detector.test.ts -t "Card 1 fallback"` | ❌ Wave 0 — new | ⬜ pending |
| CONTENT-02 | AI wins disagreement at confidence ≥ 0.6 (D-06) | unit | `pnpm test src/lib/engine/__tests__/wave0-niche-detector.test.ts -t "drift"` | ❌ Wave 0 — new | ⬜ pending |
| CONTENT-02 | Micro null at low micro_confidence (D-07) | unit | `pnpm test src/lib/engine/__tests__/wave0-niche-detector.test.ts -t "micro null"` | ❌ Wave 0 — new | ⬜ pending |
| CONTENT-03 | Taxonomy has personas + benchmark_filters per primary | unit | `pnpm test src/lib/niches/__tests__/taxonomy.test.ts` | ❌ Wave 0 — new | ⬜ pending |
| CONTENT-03 | Persona weights sum to 10 per primary | unit | `pnpm test src/lib/niches/__tests__/taxonomy.test.ts -t "weight sum"` | ❌ Wave 0 — new | ⬜ pending |
| CONTENT-04 | Weight matrix applies correct multipliers per content type (D-12) | unit | `pnpm test src/lib/engine/__tests__/content-type-weights.test.ts` | ❌ Wave 0 — new | ⬜ pending |
| CONTENT-04 | Multipliers capped at [0.5, 1.5] | unit | `pnpm test src/lib/engine/__tests__/content-type-weights.test.ts -t "cap"` | ❌ Wave 0 — new | ⬜ pending |
| CONTENT-04 | Aggregator integration — adjusted feature_vector flows to ML score | integration | `pnpm test src/lib/engine/__tests__/aggregator.test.ts -t "content_type weights"` | ✅ existing — extend | ⬜ pending |
| CONTENT-01..04 | Wave 0 fires BEFORE Wave 1 (D-22 ordering) | integration | `pnpm test src/lib/engine/__tests__/pipeline.test.ts -t "Wave 0 before Wave 1"` | ✅ existing — extend | ⬜ pending |
| D-16 | Promise.allSettled failure isolation | unit | `pnpm test src/lib/engine/__tests__/wave0-orchestration.test.ts -t "isolation"` | ❌ Wave 0 — new | ⬜ pending |
| D-17/D-18 | creatorContext pre-fetch + reuse | integration | `pnpm test src/lib/engine/__tests__/pipeline.test.ts -t "creator context reuse"` | ✅ existing — extend | ⬜ pending |
| D-20 | `signal_availability.content_type` + `.niche` flags set | unit | `pnpm test src/lib/engine/__tests__/aggregator.test.ts -t "signal_availability"` | ✅ existing — extend | ⬜ pending |
| Regression | All 549 existing tests still pass | smoke | `pnpm test` (full suite) | ✅ existing | ⬜ pending |
| D-22 (eval bypass) | Wave 0 runs fresh under `bypassCache` | unit | `pnpm test src/lib/engine/__tests__/wave0-orchestration.test.ts -t "bypassCache"` | ❌ Wave 0 — new | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/engine/__tests__/wave0-content-type.test.ts` — covers CONTENT-01, D-09, D-10, D-11
- [ ] `src/lib/engine/__tests__/wave0-niche-detector.test.ts` — covers CONTENT-02, D-05, D-06, D-07, D-08
- [ ] `src/lib/engine/__tests__/wave0-orchestration.test.ts` — covers D-16, D-22 bypass
- [ ] `src/lib/engine/__tests__/content-type-weights.test.ts` — covers CONTENT-04, D-12, D-19
- [ ] `src/lib/niches/__tests__/taxonomy.test.ts` — covers CONTENT-03, D-13, D-14
- [ ] Extension to `src/lib/engine/__tests__/aggregator.test.ts` — covers D-19, D-20
- [ ] Extension to `src/lib/engine/__tests__/pipeline.test.ts` — covers D-17, D-18

---

## Nyquist 8-Dimension Coverage

| Dimension | Coverage | Files / Strategy |
|-----------|----------|------------------|
| **1. Unit / pure-function** | All deterministic logic — weight matrix lookup, slug validation, schema parsing | `content-type-weights.test.ts`, `taxonomy.test.ts`, schema-validation cases in detector tests |
| **2. Integration / multi-stage** | Wave 0 ⟷ pipeline.ts, aggregator widening, `signal_availability` persistence | `pipeline.test.ts` + `aggregator.test.ts` extensions |
| **3. Boundary / edge cases** | Confidence at exactly 0.59 / 0.60, mixed_content boundary, slug not in tree, empty Card 1 | Confidence-threshold tests in detector files |
| **4. Error / failure paths** | Gemini upload timeout, file processing FAILED, DeepSeek API rejection, schema validation failure, slug-validation throw | `wave0-content-type.test.ts` failure-mode group + `wave0-niche-detector.test.ts` failure group |
| **5. Concurrency / parallel** | Promise.allSettled isolation (one fails, other succeeds), event-emission ordering under parallel execution | `wave0-orchestration.test.ts` |
| **6. State / mutation** | creatorContext pre-fetch caching, `signal_availability` mutation, weight-matrix non-mutation of input | `pipeline.test.ts` + `aggregator.test.ts` (verifies original `geminiResult.analysis.video_signals` is unchanged after matrix application) |
| **7. Regression** | All 549 existing tests pass; `stubs.test.ts` compatibility preserved | `pnpm test` full suite + explicit stubs.test.ts run |
| **8. Performance / cost** | Wave 0 total cost < $0.005/call asserted defensively; latency < 5s p95 in eval harness | Cost-assertion case in detector tests; latency monitored in eval harness output |

---

## Eval-Harness Integration

The Phase 1 eval harness (`src/lib/engine/corpus/eval-harness.ts`) already records `signal_contribution` JSONB on `benchmark_results`. Phase 4 outputs (`content_type`, `niche`) flow via `signal_availability` into `PredictionResult`, which the eval harness reads to populate `signal_contribution`.

**No eval-harness changes needed in Phase 4.** Phase 10/12 reads the persisted `signal_contribution` data to assess content_type/niche signal value.

---

## Schema Migration Check

**Confirmed:** Phase 4 requires NO Supabase migration. `signal_availability` JSONB schemaless additions handled by Phase 3's forward-compat design (per Phase 3 D-07 + Phase 3 SUMMARY note: "Phase 4 (Wave 0 content type + niche): signal_availability JSONB column ready for new keys"). All Phase 4 outputs flow through existing columns. Confirmed safe per CONTEXT D-15 + Claude's Discretion "Migration scope" item.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live Gemini 3 Flash API call against real 5s video | CONTENT-01 | Requires real API key + uploaded video; integration test mocks responses | After deploy: run a single video through `/api/analyze` and inspect `wave0Result.content_type` in Network tab |
| Live DeepSeek V4 Flash niche detector against real creator profile | CONTENT-02 | Requires real API key + populated creator profile; integration test mocks responses | After deploy: run a video for a creator with Card 1/4/5/6 filled and verify `wave0Result.niche` returns non-null hierarchical result |
| Cost telemetry validation in production | D-21 | Requires real LLM calls; unit test asserts cost cap defensively | After 24h prod traffic: query `stage_events` table for Wave 0 stage_end cost_cents; verify p95 ≤ 0.5¢ |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (7 new test files + 2 extensions)
- [ ] No watch-mode flags
- [ ] Feedback latency <60s subdir
- [ ] `nyquist_compliant: true` set in frontmatter after planner integration

**Approval:** pending
