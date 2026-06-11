---
phase: 1
slug: engine-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Brownfield audit→refine of the shipped Apollo 3-call pipeline (v3.13.0).
> ~38 engine test files already exist; this phase mostly REUSES them + live rigs (D-02).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`vitest run`) |
| **Config file** | project vitest config; engine tests in `src/lib/engine/__tests__/` |
| **Quick run command** | `npx vitest run src/lib/engine/__tests__/<file>.test.ts` |
| **Full suite command** | `npm test` (`vitest run`) |
| **Estimated runtime** | unit suite ~tens of seconds; live rigs ~70s/run on a real video |

---

## Sampling Rate

- **After every task commit:** Run the relevant engine unit test file (sub-30s).
- **After every plan wave:** Run `npm test` (full engine suite).
- **Before `/gsd:verify-work`:** Full suite green **+ at least one live rig run on a real video** (`measure-pipeline` / `smoke-tiktok-pipeline` / `apollo-core-smoke`, per D-02 adaptive testing).
- **Max feedback latency:** ~30s for unit; live rigs batched after a couple of fixes per D-02.

---

## Per-Requirement Verification Map

| Requirement | Behavior | Test Type | Automated Command | Exists | Status |
|-------------|----------|-----------|-------------------|--------|--------|
| ENG-01 | Pipeline E2E correctness + fallback paths (no silent single-signal swallow, no thrown frames) | integration + live | `npx vitest run src/lib/engine/__tests__/pipeline.test.ts`; live `scripts/smoke-tiktok-pipeline.ts` | ✅ | ⬜ pending |
| ENG-02 | Apollo §-cites resolve to real runtime KNOWLEDGE_CORE | live A/B | `pnpm tsx scripts/apollo-core-smoke.ts "<video>"` | ✅ rig / ❌ §-resolution unit test if remap chosen → Wave 0 | ⬜ pending |
| ENG-03 | Per-stage latency + parallelism (measure-first per D-02/D-08) | live | `npx tsx scripts/measure-pipeline.ts "<video>"` | ✅ | ⬜ pending |
| ENG-04 | Engagement-range grounding, honesty flags, ensemble blend | unit | `npx vitest run src/lib/engine/__tests__/aggregator.test.ts` | ✅ | ⬜ pending |
| ENG-05 | Read drift guards (emotion_arc.label, weakest_modality, hook_verbatim) | unit | `npx vitest run src/lib/engine/__tests__/omni-analysis-emotion-arc.test.ts omni-analysis-verbatim.test.ts` | ✅ / ❌ critical-field retry test if D-11 retry added → Wave 0 | ⬜ pending |
| ENG-06 | Apollo prompt contract / schema; consumed-vs-dead field map | unit | `npx vitest run src/lib/engine/__tests__/deepseek.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Conditional — created ONLY if the corresponding co-review decision lands that way:

- [ ] If ENG-02 **remap** chosen: a unit test asserting emitted §-cites resolve to a whitelist (new).
- [ ] If ENG-05 **D-11 critical-field retry** added: a unit test for "parsed-OK-but-empty-critical-field → retry" (new).

*If neither lands: **None — existing ~38 engine test files cover all current behavior.** Live rigs cover E2E per D-02.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| §-grounding option choice (restore/remap/redesign) | ENG-02 | D-06/D-07 — decision needs Davide's co-review off live `apollo-core-smoke` output, not an automated assert | Run `apollo-core-smoke.ts` on a real video, co-review emitted cites vs lean core, then decide |
| Read flash→plus flip | ENG-05 | D-10 — richness delta is a human quality judgment on real videos | Env-flip A/B: two smoke runs (flash vs plus), co-review verbatim/emotion_arc/segments richness |
| Qwen prompt I/O quality (all 3 calls) | ENG-06 | D-12 — step-by-step co-review WITH Davide, not an automated check | Walk each prompt's I/O together; per T3.x trim, decide restore-vs-keep from rationale |

---

## Validation Sign-Off

- [ ] All requirements have an automated verify path or an explicit manual-only justification
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (live rigs count per D-02)
- [ ] Wave 0 covers any MISSING references that the chosen options introduce
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (unit)
- [ ] `nyquist_compliant: true` set in frontmatter

**Note (D-04):** Score-determinism is DEPRIORITIZED this phase — do NOT add a determinism-band gate. Insight/output quality leads; measure-first if revisited.

**Approval:** pending
