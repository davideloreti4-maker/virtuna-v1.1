---
phase: 2
slug: hero-centerpiece-reading-explainer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-12
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `02-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.0.18` + Testing Library + happy-dom (per-file pragma) |
| **Config file** | `vitest.config.ts` (include `src/**/*.test.ts(x)`, `tests/**/*.test.ts`) |
| **Quick run command** | `pnpm test` (alias `vitest run`) |
| **Full suite command** | `pnpm test && pnpm tsx scripts/check-apca.ts && pnpm build` |
| **Estimated runtime** | ~15-40 seconds (unit) + APCA gate + build |

Reduced-motion pattern: mock `motion/react` `useReducedMotion: () => true` (see `tests/numen/stage-reveal.test.ts`).

---

## Sampling Rate

- **After every task commit:** Run `pnpm test` (relevant file)
- **After every plan wave:** Run `pnpm test && pnpm tsx scripts/check-apca.ts`
- **Before `/gsd:verify-work`:** `pnpm test && pnpm tsx scripts/check-apca.ts && pnpm build` green
- **Max feedback latency:** ~40 seconds (unit)

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| HERO-01 | hero renders single `<h1>` + subhead + CTA | unit (render) | `pnpm test -- hero` | ❌ W0 | ⬜ pending |
| HERO-02 | hero artifact is a real keyframe (asset in `public/`, `next/image`, no stock/chrome markers) | unit/asset | `pnpm test -- hero` | ❌ W0 | ⬜ pending |
| HERO-03 | verdict = `VerdictSwatch good` + label + why; NO naked number (assert no `/100`, no `%`) | unit (render) | `pnpm test -- verdict-throne` | ❌ W0 | ⬜ pending |
| HERO-04 | reduced-motion → end-state, no auto-cycle, no translate | unit (mock `useReducedMotion=>true`) | `pnpm test -- reading-loop` | ❌ W0 | ⬜ pending |
| READ-01 | 3 steps render (upload → reads → verdict) under `#how-it-works` | unit (render) | `pnpm test -- how-it-works` | ❌ W0 | ⬜ pending |
| READ-02 | each step shows real content (keyframe / stage-read / band), not icon-only | unit (render) | `pnpm test -- how-it-works` | ❌ W0 | ⬜ pending |
| CTA-01 | hero CTA `href="#cta"`, label "Try Numen", focus ring, ≥44px | unit (render) | `pnpm test -- hero` | ❌ W0 | ⬜ pending |
| (cross) | single `<h1>` on the page | unit (render page) | `pnpm test -- page` | ❌ W0 | ⬜ pending |
| (cross) | APCA: verdict-good label meets Lc target | script gate | `pnpm tsx scripts/check-apca.ts` | ✓ (extend for label-on-band) | ⬜ pending |
| (cross) | no forbidden VOICE copy (`%`, "viral", engine terms) in hero/explainer | unit (string scan) | `pnpm test -- voice` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/numen-landing/__tests__/hero.test.tsx` — HERO-01/02/CTA-01
- [ ] `src/components/numen-landing/__tests__/reading-loop.test.tsx` — HERO-04 (mock `useReducedMotion`)
- [ ] `src/components/numen-landing/__tests__/verdict-throne.test.tsx` — HERO-03 (assert NO naked number)
- [ ] `src/components/numen-landing/__tests__/how-it-works.test.tsx` — READ-01/02
- [ ] `src/components/numen-landing/__tests__/voice.test.tsx` — forbidden-copy scan (VOICE Rules 1–2)
- [ ] Extend `scripts/check-apca.ts` with a label-on-`#7faf7a` pairing (verdict-good throne, Open Q2)
- [ ] Framework install: none — Vitest already configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| One rights-clear real creator keyframe supplied | HERO-02 | Content/rights decision, not code | Confirm a real (non-stock, non-chrome) creator-video still lands in `public/`; flagged as `checkpoint:human-verify` |
| Full-bleed hero LCP/weight acceptable | (perf) | Visual/perf judgment | Load hero, confirm keyframe is the LCP element, no CLS, weight reasonable (deeper LCP optimization is Phase 4) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 40s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
