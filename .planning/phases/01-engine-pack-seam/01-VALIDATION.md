---
phase: 1
slug: engine-pack-seam
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-26
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` (restored after Wave 0 `npm install`) |
| **Quick run command** | `node ./node_modules/vitest/vitest.mjs run <path>` |
| **Full suite command** | `node ./node_modules/vitest/vitest.mjs run` |
| **Engine suite command** | `node ./node_modules/vitest/vitest.mjs run src/lib/engine` |
| **Estimated runtime** | TBD — Plan 01 Task 2 records the engine-suite runtime after install |

> ⚠️ Quirk (CONTEXT + RESEARCH): `npm test` / `npx vitest` print **fake PASS(0)/FAIL(0)** when `node_modules` is absent. Always run via `node ./node_modules/vitest/vitest.mjs run`.

---

## Sampling Rate

- **After every task commit:** Run quick command on touched engine test(s) + `tsc --noEmit` on touched files
- **After every plan wave:** Run `node ./node_modules/vitest/vitest.mjs run src/lib/engine`
- **Before `/gsd-verify-work`:** Full suite green + pack-seam smoke green
- **Max feedback latency:** TBD (Plan 01 Task 2 confirms post-install)

---

## Per-Task Verification Map

> Task IDs are `{phase}-{plan}-{task}`. Wave 3 plans (04/05/06) own disjoint files
> (smoke test / route.ts / harnesses) → parallel-safe.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | PACK-04 | T-01-SC | Restore vetted lockfile; lockfile byte-unchanged | infra | `npm install` | n/a | ⬜ pending |
| 01-01-02 | 01 | 0 | PACK-04 | T-01-CP | Green pre-seam baseline; ENGINE_VERSION 3.20.0 | baseline | `node ./node_modules/vitest/vitest.mjs run src/lib/engine` | ✅ exists | ⬜ pending |
| 01-02-01 | 02 | 1 | PACK-03 | T-01-RR | DomainPack 7-field contract; scoring shape = aggregateScores | type | `tsc --noEmit` | ❌ W2 | ⬜ pending |
| 01-02-02 | 02 | 1 | PACK-03 | T-01-RR | scoring sub-shape provably matches aggregateScores | type+unit | `node ./node_modules/vitest/vitest.mjs run src/lib/engine/__tests__/domain-pack.contract.test.ts` | ❌ W2 | ⬜ pending |
| 01-03-01 | 03 | 2 | PACK-02, PACK-03 | T-01-RR, T-01-CP | SOCIALS_PACK satisfies DomainPack; scoring.run = aggregateScores wrapped whole | type | `tsc --noEmit` | ❌ W2 | ⬜ pending |
| 01-03-02 | 03 | 2 | PACK-02 | T-01-RR | resolvePack returns SOCIALS_PACK; dispatcher holds zero scoring logic | unit+static | `node ./node_modules/vitest/vitest.mjs run src/lib/engine/__tests__/domain-pack.contract.test.ts` + import-grep | ❌ W2 | ⬜ pending |
| 01-04-01 | 04 | 3 | PACK-04 | T-01-RR, T-01-CP | Socials run completes; schema structurally valid; overall_score ∈ [0,100]; engine_version 3.20.0; dispatcher no-import static check | smoke (BLOCKING) | `node ./node_modules/vitest/vitest.mjs run src/lib/engine/__tests__/pack-seam-smoke.test.ts` | ❌ W3 | ⬜ pending |
| 01-05-01 | 05 | 3 | PACK-01 | T-01-RR | JSON branch dispatches via pack.run + pack.scoring.run | type | `tsc --noEmit` | ✅ exists | ⬜ pending |
| 01-05-02 | 05 | 3 | PACK-01 | T-01-RR, T-01-ID | SSE branch dispatched; no direct aggregateScores/runPredictionPipeline import; timing preserved | unit+static | `node ./node_modules/vitest/vitest.mjs run src/lib/engine/__tests__/pack-seam-smoke.test.ts src/app/api/analyze/__tests__` + import-grep | ✅ exists | ⬜ pending |
| 01-06-01 | 06 | 3 | PACK-01 | T-01-RR | eval-runner dispatched via pack; behavioralSource preserved; ENGINE_VERSION import kept | type+static | `tsc --noEmit` + import-grep | ✅ exists | ⬜ pending |
| 01-06-02 | 06 | 3 | PACK-01 | T-01-RR, T-01-CP | learning/predict dispatched via pack; full engine suite green (all 4 call sites migrated) | unit+static | `node ./node_modules/vitest/vitest.mjs run src/lib/engine` + import-grep | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install` — `node_modules` is absent in this worktree (blocking; root cause of the fake-PASS quirk) — Plan 01 Task 1
- [ ] Confirm `ENGINE_VERSION` stays pinned at `3.20.0` (cache key + `audience-regression-gate.test.ts` assert it) — Plan 01 Task 2 + asserted by the D-03 smoke (Plan 04)
- [ ] Smoke harness `src/lib/engine/__tests__/pack-seam-smoke.test.ts` (D-03) — Plan 04, modeled on `audience-regression-gate.test.ts`
- [ ] Confirm `factories.ts` `makePipelineResult` covers video + text/url `foldOutcome`/`personaBehavioralAggregate` shapes — Plan 04 Task 1 read_first

*Per CONTEXT D-02/D-03: byte-identical golden-master is SUPERSEDED — the gate is a light smoke + structural check, NOT exact values.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Core run path holds zero socials-specific scoring logic | PACK-01 | Structural/architectural assertion (absence of logic) — confirmed by the dispatcher no-import static check (Plan 04) + the per-call-site import-grep gates (Plans 05/06), plus a review of the thin dispatch surface | Review `packs/index.ts` + the 4 call sites post-seam: scoring routes through `pack.scoring.run`; no `aggregateScores`/`overall_score` math inline on the dispatch surface |

*Most phase behaviors have automated structural/smoke verification; the "absence of logic" criterion is review-assisted but backed by automated import-grep + static checks.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (`npm install` + smoke harness)
- [x] No watch-mode flags
- [ ] Feedback latency confirmed post-install (Plan 01 Task 2)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned
