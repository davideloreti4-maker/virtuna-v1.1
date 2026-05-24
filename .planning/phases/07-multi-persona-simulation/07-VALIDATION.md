---
phase: 7
slug: multi-persona-simulation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-18
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `pnpm vitest run src/lib/engine/wave3` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~30s quick, ~90s full |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run src/lib/engine/wave3`
- **After every plan wave:** Run `pnpm vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | PERSONA-01..11, PIPE-08 | — | DeepSeek API key never logged; persona output validated via Zod boundary | unit + integration | `pnpm vitest run` | — | ⬜ pending |

*Planner will populate this table with concrete Task IDs after PLAN.md files are written.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/engine/wave3/__tests__/wave3.test.ts` — Promise.allSettled orchestration, partial-failure tolerance (PERSONA-04, PIPE-08)
- [ ] `src/lib/engine/wave3/__tests__/persona-registry.test.ts` — 6 archetype definitions present; per-niche instantiation byte-stable (PERSONA-01, PERSONA-02)
- [ ] `src/lib/engine/wave3/__tests__/persona-prompts.test.ts` — cache-friendly system prompt prefix is byte-identical across runs (PERSONA-06)
- [ ] `src/lib/engine/wave3/__tests__/aggregator.test.ts` — top-3-enthusiast-weighted math correctness; tie-break stability; n<10 surviving subset handling (PERSONA-08, PERSONA-09)
- [ ] Extend `src/lib/engine/__tests__/aggregator.test.ts` — `signal_availability.personas` flag; optional `behavioralSource` param (D-14 A/B)
- [ ] Extend `src/lib/engine/__tests__/pipeline.test.ts` — Wave 3 sequencing after Wave 2; PipelineResult shape widening
- [ ] Extend `src/lib/engine/__tests__/stubs.test.ts` — wave3 no-op stub replaced; type contract preserved
- [ ] Extend `src/lib/engine/__tests__/factories.ts` — PersonaSimulationResult + PersonaBehavioralAggregate factories

*Vitest already installed; no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DeepSeek input cache hit rate ≥ 80% in production | PERSONA-10 (cost target $0.025/analysis) | Cache behavior is API-side; only observable via DeepSeek dashboard or response metadata over time | Run 5 analyses on the same niche back-to-back. Inspect `prompt_cache_hit_tokens` in response metadata. Compute hit rate over 50 calls; expect ≥80% after warmup. |
| Persona reasoning prose is semantically distinct per archetype | PERSONA-01 (persona behavioral distinctness) | Reasoning quality is subjective; requires human reading | Run 1 analysis. Inspect each persona's `reasoning` field. Verify "tough crowd" sounds skeptical, "high engager" sounds excited, etc. |
| A/B eval results read sensibly | PERSONA-11 (eval harness sanity) | Calibration delta requires domain judgment | Run eval harness on Phase 1 corpus with `--behavioralSource=personas`. Inspect macro_f1 / ECE / viral_recall vs v2 baseline. Flag if persona variant is materially worse. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
