---
phase: 1
slug: engine-pack-seam
status: draft
nyquist_compliant: false
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
| **Config file** | none at worktree root — `node_modules` absent; Wave 0 runs `npm install` |
| **Quick run command** | `node ./node_modules/vitest/vitest.mjs run <path>` |
| **Full suite command** | `node ./node_modules/vitest/vitest.mjs run` |
| **Estimated runtime** | ~TBD (planner to fill from first green run) |

> ⚠️ Quirk (CONTEXT + RESEARCH): `npm test` / `npx vitest` print **fake PASS(0)/FAIL(0)** when `node_modules` is absent. Always run via `node ./node_modules/vitest/vitest.mjs run`.

---

## Sampling Rate

- **After every task commit:** Run quick command on touched engine test(s)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** TBD (planner to confirm post-install)

---

## Per-Task Verification Map

> Populated by the planner from PLAN task IDs. Each task that touches the seam,
> the wrap boundary, or the Socials pack maps to a structural/smoke assertion.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | — | — | N/A (deps install) | infra | `npm install` | ❌ W0 | ⬜ pending |
| 01-xx-xx | xx | x | PACK-01..04 | — | core holds zero scoring logic; Socials run completes; schema structurally valid; `overall_score` in sane band | unit/smoke | `node ./node_modules/vitest/vitest.mjs run <smoke>` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install` — `node_modules` is absent in this worktree (blocking; root cause of the fake-PASS quirk)
- [ ] Confirm `ENGINE_VERSION` stays pinned at `3.20.0` (cache key + `audience-regression-gate.test.ts` assert it)
- [ ] Smoke harness stub (D-03) — e.g. `src/lib/engine/__tests__/pack-seam-smoke.test.ts` modeled on the existing blocking regression gate

*Per CONTEXT D-02/D-03: byte-identical golden-master is SUPERSEDED — the gate is a light smoke + structural check, NOT exact values.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Core run path holds zero socials-specific scoring logic | PACK-01 | Structural/architectural assertion (absence of logic) — best confirmed by code review of the thin core + grep, plus the smoke test proving dispatch | Review `runPredictionPipeline` post-seam: scoring routes through `pack[mode]`; no `apollo`/`aggregate`/`overall_score` math inline on the core |

*Most phase behaviors have automated structural/smoke verification; the "absence of logic" criterion is review-assisted.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency confirmed post-install
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
