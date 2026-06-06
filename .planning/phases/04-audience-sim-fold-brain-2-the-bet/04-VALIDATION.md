---
phase: 04
slug: audience-sim-fold-brain-2-the-bet
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-05
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> This phase IS a validation phase — the A/B referee is the deliverable's proof (R10).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (engine unit tests) + standalone `tsx` script for the real-API referee (D-04 — NOT a unit test) |
| **Config file** | existing repo vitest config; referee bootstraps via `tsx` + `tsconfig-paths` (mirror `scripts/measure-pipeline.ts:14-21`) |
| **Quick run command** | `npx vitest run src/lib/engine/wave3/__tests__/fold*.test.ts` |
| **Full suite command** | `npx tsx scripts/ab-fold-referee.ts` (real API, 6 videos × 2 paths × 2 runs) |
| **Estimated runtime** | unit ~30s (no API) · referee ~several min (48 real calls) |

---

## Sampling Rate

- **After every task commit:** Run the relevant `vitest run` for the unit file touched (schema, adapter, guard) — < 30s, no API.
- **After every plan wave:** Full `vitest run` on `wave3/__tests__/fold*` + a single-video referee smoke (1 video × both paths) to catch shape breaks cheaply.
- **Before `/gsd:verify-work` / phase gate:** Full `npx tsx scripts/ab-fold-referee.ts` (6 videos × 2 paths × 2 runs) — D-03 composite GREEN/advisory-pass + user sign-off (D-05).
- **Max feedback latency:** ~30s for the unit loop (the referee is the gate, not the inner loop).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-*-** | TBD | 0 | R3 | — | `FoldResponseSchema` validates 10-archetype × N-segment shape (attention∈[0,1], monotonic swipe), segment-count guard | unit | `npx vitest run src/lib/engine/wave3/__tests__/fold-schema.test.ts` | ❌ W0 | ⬜ pending |
| 04-*-** | TBD | 0 | R3 | — | fold→`PersonaSimulationResult[]`+`Pass2PersonaResult[]` lossless adapter; `assembleHeatmapPayload` builds non-null heatmap | unit | `npx vitest run src/lib/engine/wave3/__tests__/fold-adapter.test.ts` | ❌ W0 | ⬜ pending |
| 04-*-** | TBD | 0 | D-07 | V5 | post-parse diversity guard warns when fold avgRange < floor | unit | `npx vitest run src/lib/engine/wave3/__tests__/fold-diversity-guard.test.ts` | ❌ W0 | ⬜ pending |
| 04-*-** | TBD | N | R7 | DoS | fold path issues exactly 1 audience-sim LLM call vs 20 | integration (referee call-count) | `npx tsx scripts/ab-fold-referee.ts` | ❌ W0 | ⬜ pending |
| 04-*-** | TBD | N | R10.1 | — | behavioral parity: \|fold − 10-pass\| ≤ 5 | real-API referee | `npx tsx scripts/ab-fold-referee.ts` | ❌ W0 | ⬜ pending |
| 04-*-** | TBD | N | R10.2 | — | diversity: fold avgRange ≥ 0.8 × 10-pass avgRange (shared metric) | real-API referee | same | ❌ W0 | ⬜ pending |
| 04-*-** | TBD | N | R10.3 | — | drop-point agreement: fold swipe segment within ±1 for ≥6/10 archetypes | real-API referee | same | ❌ W0 | ⬜ pending |
| 04-*-** | TBD | N | R8 | — | provider-noise tolerance: 2 runs/video, compare within band (not byte-identity) | real-API referee | same (2-run loop) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · Task IDs finalize when plans are written.*

---

## Wave 0 Requirements

- [ ] `src/lib/engine/wave3/__tests__/fold-schema.test.ts` — `FoldResponseSchema` cases (R3)
- [ ] `src/lib/engine/wave3/__tests__/fold-adapter.test.ts` — fold→two-array lossless mapping (R3)
- [ ] `src/lib/engine/wave3/__tests__/fold-diversity-guard.test.ts` — D-07 floor warn
- [ ] `scripts/ab-fold-referee.ts` — real-API A/B (R7/R10), modeled on `measure-pipeline.ts` NOT `eval-harness.ts`
- [ ] Stage the 6 referee video files (RESEARCH Open Question 1) before the referee task

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Final production flip decision (`behavioralSource: "fold"` default ON) | R10 / D-05 / D-10 | Gate is advisory — if fold misses on 1 video but curves are clearly good, human judgment makes the call | Review the referee per-video table + overall verdict; user signs off; flip is a separately-revertable task |
| Curve-quality "beat vs reproduce" qualitative read | R10 / D-05 | Composite is gating-but-advisory; qualitative curve shape matters beyond the 3 numbers | Inspect per-archetype curves from referee output against the 10-pass baseline |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (4 unit/script files + staged videos)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (unit loop)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
