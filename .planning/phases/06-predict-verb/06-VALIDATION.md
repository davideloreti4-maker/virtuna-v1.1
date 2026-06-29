---
phase: 6
slug: predict-verb
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-29
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `06-RESEARCH.md` § Validation Architecture (Nyquist ENABLED).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing — `node_modules/vitest`) |
| **Config file** | existing repo vitest config |
| **Quick run command** | `node ./node_modules/vitest/vitest.mjs run <touched test file>` |
| **Full suite command** | `node ./node_modules/vitest/vitest.mjs run` |
| **Estimated runtime** | ~full suite (zero-network unit tests; no live key needed) |

> ⚠️ **Runner gotcha:** use `node ./node_modules/vitest/vitest.mjs run` — `npm test` / `npx vitest` print fake PASS(0)/FAIL(0) (memory `vitest-rtk-shim`).
> ⚠️ **Env gotcha:** vitest does NOT load `.env.local`; live DashScope smoke silently 401s on a dummy key. **Predict unit tests must be ZERO-NETWORK via injected `deps.flash`**; gate any live smoke on a REAL key (memory `vitest-env-live-smoke-gotcha`).

---

## Sampling Rate

- **After every task commit:** Run the touched leaf's quick run (`predict-aggregate` / `predict-schema` / `predict-runner` / route).
- **After every plan wave:** Run `node ./node_modules/vitest/vitest.mjs run` (full suite) **+ `next build`** (client/server bundle-leak gate — Pitfall 4).
- **Before `/gsd-verify-work`:** Full suite green **+ a real-browser human-verify** of the end-to-end thread (P5 precedent — vitest cannot catch the gauge's visual honesty or a bundle leak).
- **Max feedback latency:** quick run (single file) — seconds.

---

## Per-Task Verification Map

> Task IDs are assigned by the planner. Rows below are the requirement → test seam contract from `06-RESEARCH.md`; the planner maps each to a concrete task ID + wave and the executor fills Status.

| Requirement | Must be TRUE | Threat Ref | Test Type | Automated Command (file) | File Exists | Status |
|-------------|--------------|------------|-----------|--------------------------|-------------|--------|
| PRED-01 | Range == aggregation of leans, never a model field (D-01) | — | unit | `predict-aggregate.test.ts`, `predict-schema.test.ts` | ❌ W0 | ⬜ pending |
| PRED-01 | Confidence == tightness, pure derivation (D-05) | — | unit | `predict-aggregate.test.ts` | ❌ W0 | ⬜ pending |
| PRED-01/03 | `.strict()` rejects a smuggled point-score / extra field | — | unit | `prediction-gauge-block.test.ts` | ❌ W0 | ⬜ pending |
| PRED-01/03 | Person SIM (+ non-General) → 400 not 500 (D-03/D-08) | T-6 (input-isolation/route) | unit (route) | `predict-route.test.ts` | ❌ W0 | ⬜ pending |
| PRED-03 | Directional + tier/model always present | — | unit | `predict-runner.test.ts` | ❌ W0 | ⬜ pending |
| PRED-01/02/03 | Deterministic, zero-network run (`deps.flash`) | — | unit | `predict-runner.test.ts` | ❌ W0 | ⬜ pending |
| PRED-01 | Default `template-analyst` NOT mis-rejected as person | — | unit (route) | `predict-route.test.ts` | ❌ W0 | ⬜ pending |
| PRED-02 | No coral / matte-only on the gauge card | — | guard | `components/reading/__tests__/reskin-matte.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/engine/flash/__tests__/predict-aggregate.test.ts` — D-01/D-05 derivation guards (range = min/max of leans; two distributions → different ranges; tight→High / wide→Low confidence)
- [ ] `src/lib/engine/flash/__tests__/predict-schema.test.ts` — `.strict()` rejects smuggled aggregate fields (`probability`/`range`)
- [ ] `src/lib/tools/runners/__tests__/predict-runner.test.ts` — `deps.flash` zero-network, tier/caveat always present, person reject
- [ ] `src/app/api/tools/predict/__tests__/route.test.ts` — 401 / 415 / 400(empty) / 400(non-general) / 400(person) / 500-generic (never echo `err.message`)
- [ ] `src/components/thread/__tests__/prediction-gauge-block.test.tsx` — single-point feather (F-01), readable-without-color
- [ ] `chain-handoff.test.ts` — assert the new `simulate → predict` handoff entry shape (existing test file covers handoff payloads)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Gauge visual honesty — feathered span, no needle/tick/dot, `~min–max%` (no decimal) | PRED-02 | vitest can't assert rendered visual feel / false-precision read | Run the end-to-end thread in a real browser; trigger Predict from the Simulate card's "Predict an outcome →"; confirm the gauge reads as a band+range, never an oracle dial |
| Client/server bundle integrity | PRED-02 | `tsc`+vitest pass even when a `'use client'` renderer pulls a server-only chain | `next build` per wave; judge on "compiles + no NEW errors on touched paths" (ignore pre-existing `earnings-chart.tsx:98` recharts baseline — Pitfall 6) |
| End-to-end thread wow | PRED-01/02/03 | The honesty + receipts + Directional caveat must read coherently together | Human-verify: scenario in → prediction-gauge card with band, panel-spread range, per-analyst factors, assumptions, always-on Directional caveat |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency acceptable (single-file quick run)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
