---
phase: 3
slug: pipeline-infrastructure
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-17
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 (node environment) |
| **Config file** | `vitest.config.ts` (80% coverage threshold on `src/lib/engine/**`) |
| **Quick run command** | `npm test -- <task-touched-test-file>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5-15s per engine test file; ~30-60s for `src/lib/engine` subdir; full suite scales with all 465 tests |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- <task-touched-test-file>` (single file, ~5-15s typical for engine tests)
- **After every plan wave:** Run `npm test -- src/lib/engine` (subdirectory scope, ~30-60s)
- **Before `/gsd-verify-work`:** Full `npm test` suite must be green
- **Max feedback latency:** ~60 seconds per wave

---

## Per-Task Verification Map

> Filled in by planner during PLAN.md generation. Source: RESEARCH.md "Phase Requirements → Test Map" (lines 712-731). Each row maps a task to its requirement, threat ref, test type, and automated verification command.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD-by-planner | TBD | TBD | PIPE-01 | — | onStageEvent optional; existing callers unchanged | unit | `npm test -- src/lib/engine/__tests__/pipeline.test.ts` | ✅ existing | ⬜ pending |
| TBD-by-planner | TBD | TBD | PIPE-02 | — | StageEvent discriminated-union shape | unit | `npm test -- src/lib/engine/__tests__/events.test.ts` | ❌ W0 | ⬜ pending |
| TBD-by-planner | TBD | TBD | PIPE-03 | — | timed() emits start+end pair | unit | `npm test -- src/lib/engine/__tests__/events.test.ts` | ❌ W0 | ⬜ pending |
| TBD-by-planner | TBD | TBD | PIPE-04 | — | /api/analyze emits SSE; Accept negotiation | integration | `npm test -- src/app/api/analyze/__tests__/route.test.ts` | ❌ W0 | ⬜ pending |
| TBD-by-planner | TBD | TBD | PIPE-05 | — | Every row has engine_version = "3.0.0-dev" | unit | `npm test -- src/lib/engine/__tests__/version.test.ts` | ❌ W0 | ⬜ pending |
| TBD-by-planner | TBD | TBD | PIPE-06 | — | signal_availability JSONB populated by aggregator | unit | `npm test -- src/lib/engine/__tests__/aggregator.test.ts` | ✅ existing | ⬜ pending |
| TBD-by-planner | TBD | TBD | PIPE-07 | — | wave0() stub called before Wave 1 | unit | `npm test -- src/lib/engine/__tests__/stubs.test.ts` | ❌ W0 | ⬜ pending |
| TBD-by-planner | TBD | TBD | PIPE-08 | — | wave3() stub called after Wave 2 | unit | `npm test -- src/lib/engine/__tests__/stubs.test.ts` | ❌ W0 | ⬜ pending |
| TBD-by-planner | TBD | TBD | PIPE-09 | — | stage10/stage11 stubs called after aggregator | unit | `npm test -- src/lib/engine/__tests__/stubs.test.ts` | ❌ W0 | ⬜ pending |
| TBD-by-planner | TBD | TBD | CACHE-01 | — | computeContentHash() deterministic SHA-256 | unit | `npm test -- src/lib/engine/__tests__/prediction-cache.test.ts` | ❌ W0 | ⬜ pending |
| TBD-by-planner | TBD | TBD | CACHE-02 | — | Cache hit returns in <2s; L1 faster than L2 | unit (timing) | `npm test -- src/lib/engine/__tests__/prediction-cache.test.ts` | ❌ W0 | ⬜ pending |
| TBD-by-planner | TBD | TBD | CACHE-03 | — | DeepSeek prompt_cache_hit_tokens read from usage | unit + manual smoke | `npm test -- src/lib/engine/__tests__/deepseek.test.ts` + manual `curl` twice | ✅ existing | ⬜ pending |
| TBD-by-planner | TBD | TBD | CACHE-04 | — | NO-OP — satisfied by Phase 2 D-10 (niche taxonomy is TS module) | n/a | n/a | ✅ documented | ⬜ pending |
| TBD-by-planner | TBD | TBD | CACHE-05 | — | Cache key contains engine_version; bump → miss | unit | `npm test -- src/lib/engine/__tests__/prediction-cache.test.ts` | ❌ W0 | ⬜ pending |
| TBD-by-planner | TBD | TBD | CACHE-06 | — | Cache invalidation automatic via key, no clear() | unit | `npm test -- src/lib/engine/__tests__/prediction-cache.test.ts` | ❌ W0 | ⬜ pending |
| TBD-by-planner | TBD | TBD | SC#6 | — | All existing 465 tests pass without modification | smoke | `npm test` (full suite) | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/engine/__tests__/events.test.ts` — stubs for PIPE-02, PIPE-03
- [ ] `src/lib/engine/__tests__/version.test.ts` — stubs for PIPE-05 + version-module re-export wiring
- [ ] `src/lib/engine/__tests__/stubs.test.ts` — stubs for PIPE-07, PIPE-08, PIPE-09
- [ ] `src/lib/engine/__tests__/prediction-cache.test.ts` — stubs for CACHE-01, CACHE-02, CACHE-05, CACHE-06 (mocked Supabase L2)
- [ ] `src/app/api/analyze/__tests__/route.test.ts` — stubs for PIPE-04 (mocked pipeline; assert SSE event sequence + Accept-header branching)
- [ ] (Optional) `src/lib/engine/__tests__/deepseek-cache.test.ts` — extends existing `deepseek.test.ts` with prompt_cache_hit_tokens reading

Existing infrastructure (`pipeline.test.ts`, `aggregator.test.ts`, `deepseek.test.ts`) covers PIPE-01, PIPE-06, CACHE-03 via extension.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DeepSeek prompt cache verified hitting in production (>0 cached tokens on second identical call) | CACHE-03 | Requires live DeepSeek API call; unit tests mock the client | After deploy: `curl -X POST /api/analyze` with same `tiktok_url` twice; check Sentry breadcrumb or DB log shows `prompt_cache_hit_tokens > 0` on second call |
| SSE stream renders incrementally in browser (no buffering) | PIPE-04 | Vercel deploy-only behavior — local Node runtime cannot reproduce Fluid Compute buffering | After deploy: open browser DevTools Network tab → request `/api/analyze` with `Accept: text/event-stream`; verify each `event: stage` arrives independently, not in one chunk |
| Fluid Compute project setting is active (vs legacy serverless) | PIPE-04 | Vercel dashboard config — not visible to code | One-time check: Vercel project → Settings → Functions → confirm "Fluid Compute" enabled. If legacy, planner adds migration task. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 new test files)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s per wave
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-17 (plan-checker VERIFICATION PASSED)
