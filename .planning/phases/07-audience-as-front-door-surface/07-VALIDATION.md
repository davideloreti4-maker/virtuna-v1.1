---
phase: 7
slug: audience-as-front-door-surface
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-29
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `07-RESEARCH.md` §"Validation Architecture". Task IDs (`7-NN-NN`) are
> assigned by the planner — this contract maps requirements → tests; the planner
> wires each task's `<automated>` verify to the matching command below.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (+ @testing-library/react for `.tsx`) |
| **Config file** | repo vitest config (existing; tests run today) |
| **Quick run command** | `node ./node_modules/vitest/vitest.mjs run <path>` |
| **Full suite command** | `node ./node_modules/vitest/vitest.mjs run` |
| **Estimated runtime** | quick <30s per component; full suite ~minutes |

> ⚠ **CRITICAL (MEMORY: vitest rtk shim):** `npm test` / `npx vitest` emit fake
> `PASS(0)/FAIL(0)` — they MUST NOT be used as the gate. Always use the
> `node ./node_modules/vitest/vitest.mjs run` form.

---

## Sampling Rate

- **After every task commit:** Run the touched component's unit test, e.g.
  `node ./node_modules/vitest/vitest.mjs run src/components/app/home/__tests__/composer-controls.test.tsx` (<30s).
- **After every plan wave:** Run
  `node ./node_modules/vitest/vitest.mjs run src/components/app/home src/components/audience-lens src/components/audience src/lib/audience src/lib/engine`.
- **Before `/gsd-verify-work`:** Full suite `node ./node_modules/vitest/vitest.mjs run` green
  **+ a real authed browser pass of `/home`** (picker sections, mode-scoped menu, Build chooser, demo) —
  vitest (node) cannot catch Next client/server bundle leaks (MEMORY: UI verify needs browser pass; caught a prior GSI bundle leak).
- **Max feedback latency:** <30 seconds (quick) per task.

---

## Per-Task Verification Map

> Requirement → test mapping from RESEARCH §"Phase Requirements → Test Map". The
> planner assigns the `Task ID` / `Plan` / `Wave` columns when it writes the plans;
> every task touching a requirement below must carry the matching command as its
> `<automated>` verify.

| Requirement | Behavior (observable signal) | Threat Ref | Test Type | Automated Command | File Exists |
|-------------|------------------------------|------------|-----------|-------------------|-------------|
| UX-01 | Switcher renders `── Socials ──` / `── General ──` sections + `+ Build an audience` row | — | unit (tsx) | `node ./node_modules/vitest/vitest.mjs run src/components/audience-lens/__tests__/audience-presence.test.tsx` | ⚠️ exists — extend |
| UX-02 | General audience → Profile/Simulate/Predict; Socials audience → creator skills only | T-7 input-val (inherited) | unit (tsx) | `node ./node_modules/vitest/vitest.mjs run src/components/app/home/__tests__/composer-controls.test.tsx` | ⚠️ exists — must UPDATE |
| UX-02 (guard) | No-audience default = Socials menu unchanged, same order (byte-identical creator path) | — | unit (tsx) | same file | ❌ W0 — add default-Socials assertion |
| UX-03 | Reactor renders for a General audience; `buildAudienceRepaint` stays `undefined` for General/empty (no-op) | — | unit | `node ./node_modules/vitest/vitest.mjs run src/lib/engine/flash/__tests__` + presence test | ⚠️ extend |
| UX-03 (guard) | Engine bytes unchanged: ENGINE_VERSION `3.20.0`; General injects no override | — | unit (BLOCKING) | `node ./node_modules/vitest/vitest.mjs run src/lib/engine/__tests__/audience-regression-gate.test.ts` | ✅ exists — keep green |
| UX-04 | Template clone → `createAudience` with `mode:'general'`, sentinel id stripped; all 3 Build paths save a named General SIM | T-7 IDOR/access (V4/V5) | unit | `node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/audience-repo.test.ts` | ⚠️ extend / new clone test |
| UX-05 | Home empty state renders 3 locked chips + one-tap demo; show-once hides on second mount | — | unit (tsx) | `node ./node_modules/vitest/vitest.mjs run src/components/app/home/__tests__/home.test.tsx` | ⚠️ exists — must UPDATE |
| Creator byte-identical (cross-cut) | No coral/glass regressions on transplanted surfaces | — | unit | `node ./node_modules/vitest/vitest.mjs run src/components/reading/__tests__/reskin-matte.test.ts` | ✅ exists — keep green |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Three existing tests encode now-obsolete pre-P7 assertions and WILL fail — updating
them is part of the feature, not an afterthought (RESEARCH Pitfall 3):

- [ ] `src/components/app/home/__tests__/composer-controls.test.tsx` — **UPDATE**: replace the
  Creator/Marketing-header assertions with mode-scoped assertions + a no-audience-default-Socials
  assertion (covers UX-02 + the byte-identical guard).
- [ ] `src/components/app/home/__tests__/home.test.tsx` — **UPDATE**: replace the NO-chips/NO-demo
  assertions with the 3-chips + one-tap-demo + show-once assertions (covers UX-05).
- [ ] `src/components/audience-lens/__tests__/audience-presence.test.tsx` — **EXTEND**: assert mode
  sections + `+ Build an audience` row (UX-01) and that a General audience drives the reactor (UX-03).
- [ ] `src/lib/audience/__tests__/audience-repo.test.ts` (or new `build-clone.test.ts`) — **ADD**:
  template-clone produces a `mode:'general'` owned SIM with the sentinel id stripped (UX-04).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real authed `/home` browser pass | UX-01..05 (cross-cut) | vitest (node) cannot catch Next client/server bundle leaks (BUILD-01 class) | Auth via `e2e/create-test-user.ts`; open `/home`; verify picker sections, mode-scoped menu, Build chooser, one-tap demo render and no console errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the 3 test updates + 1 add above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
