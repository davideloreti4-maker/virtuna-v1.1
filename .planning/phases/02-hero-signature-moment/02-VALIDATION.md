---
phase: 2
slug: hero-signature-moment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `02-RESEARCH.md` § Validation Architecture (all infra verified against live code).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 (`^4.0.18`) + `@testing-library/react ^16.3.2` + `@testing-library/jest-dom ^6.9.1`; DOM env = happy-dom `^20.9.0` |
| **Config file** | none — there is NO `vitest.config.*` in the repo. Each test file MUST begin with the pragma `/** @vitest-environment happy-dom */` (established convention — see `src/components/marketing/__tests__/placeholder.test.tsx:1`) |
| **Quick run command** | `npx vitest run src/components/marketing/hero/` |
| **Full suite command** | `npm test` (= `vitest run`; ~215 test files) |
| **Estimated runtime** | quick ~2–5s · full suite ~tens of seconds |

**Authoritative phase gate (beyond unit tests):** `npm run build` MUST succeed — a `dynamic({ ssr: false })` call left inside a Server Component fails the build (*"ssr: false is not allowed with next/dynamic in Server Components"*). The build is the real check for the landmine.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/marketing/hero/` (phase tests only — fast).
- **After every plan wave:** Run `npm test` (full suite — must stay green; phase is additive, should not perturb existing tests).
- **Before `/gsd:verify-work`:** Full suite green **and** `npm run build` succeeds.
- **Max feedback latency:** < 10s for the phase quick-run.

---

## Per-Task Verification Map

> Task IDs are assigned by the planner. Mapping below is by requirement → test surface (from RESEARCH § Phase Requirements → Test Map). The planner binds each `<task>` to its `<automated>` command + Wave-0 test file.

| Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01 | 1 | HERO-01 | N/A (static marketing) | unit (RTL) | `npx vitest run src/components/marketing/hero/__tests__/hero.test.tsx` | ❌ W0 | ⬜ pending |
| 02-01 | 1 | HERO-02 | CTA href === `SIGNUP_URL`; scroll-cue href === `#how-it-works` | unit (RTL) | `npx vitest run src/components/marketing/hero/__tests__/hero.test.tsx` | ❌ W0 | ⬜ pending |
| 02-03 | — | HERO-03 | SVG arc ring: `strokeDashoffset` from score, coral progress stroke, score number; score ≥ 70 | unit (RTL+DOM) | `npx vitest run src/components/marketing/hero/__tests__/composed-still.test.tsx` | ❌ W0 | ⬜ pending |
| 02-03 | — | HERO-03 | Score honesty: rendered score constant ≥ `BAND_THRESHOLDS.STRONG` (70) | unit (assert constant) | `npx vitest run src/components/marketing/hero/__tests__/hero-constants.test.ts` | ❌ W0 | ⬜ pending |
| 02-03 | — | HERO-04 | Stage container has `role="img"` + `aria-label` containing the score | unit (RTL) | composed-still test | ❌ W0 | ⬜ pending |
| 02-03 | — | HERO-04 | Reduced-motion (mock `usePrefersReducedMotion → true`) → canvas island does NOT mount; still stands | unit (RTL+mock) | `npx vitest run src/components/marketing/hero/__tests__/signature-moment-client.test.tsx` | ❌ W0 | ⬜ pending |
| 02-03 | — | HERO-04 | Mobile (mock `useIsMobile → true`) → canvas island does NOT mount | unit (RTL+mock) | signature-moment-client test | ❌ W0 | ⬜ pending |
| 02-03 | — | HERO-04 | `dynamic(ssr:false)` boundary correctness — `signature-moment-client.tsx` starts with `'use client'` | static / build | `npm run build` (+ optional grep test) | ❌ W0 | ⬜ pending |
| 02-03 | — | HERO-04 | No CLS: stage box is aspect/dimension-locked (still occupies the box the canvas mounts into) | unit (style assert) + optional Playwright | composed-still test | ❌ W0 | ⬜ pending |
| 02-02 | — | HERO-03 | FPS-drop → settle to still (graceful degrade) — *optional* | unit (mock `startFpsSampler` onDrop) | signature-moment-client test | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/marketing/hero/__tests__/hero.test.tsx` — HERO-01, HERO-02 (H1 verbatim + serif class + CTA href = `SIGNUP_URL` + scroll-cue href = `#how-it-works`).
- [ ] `src/components/marketing/hero/__tests__/composed-still.test.tsx` — HERO-03/HERO-04 (SVG ring geometry + coral stroke + score number + `role="img"`/`aria-label` + aspect-lock).
- [ ] `src/components/marketing/hero/__tests__/signature-moment-client.test.tsx` — HERO-04 gating (reduced-motion → no canvas; mobile → no canvas; optional FPS-drop → still). Mock the three hooks / `perf-tier`.
- [ ] `src/components/marketing/hero/__tests__/hero-constants.test.ts` — score ≥ 70 honesty.
- [ ] Every new `*.test.tsx`/`*.test.ts` MUST begin with `/** @vitest-environment happy-dom */` (no global vitest config to set the env).

*No framework install needed — Vitest + happy-dom + RTL all present. No `vitest.config` to create.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The coalesce choreography reads as "calm + refined" (the art) | HERO-03 | Subjective craft bar (sandcastles/Linear/Raycast); not unit-assertable | `npm run dev` → load `/` on desktop with motion enabled → watch the once-through play: settle → coral reaction → coalesce into ring → count-up → subtle rest drift (≤~3.5s total, no overshoot). |
| Real-browser lazy-mount + no visible CLS as the canvas swaps over the still | HERO-04 | Hydration/paint timing across a real engine | `npm run build && npm start` → throttle network → confirm the still paints first, the canvas mounts over it with no jump. Optional automated: `npm run e2e`. |
| Reduced-motion end-to-end (OS setting, not just the mock) | HERO-04 | OS-level `prefers-reduced-motion` | Enable OS reduce-motion → load `/` → confirm the resolved still shows with zero motion (no drift). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
