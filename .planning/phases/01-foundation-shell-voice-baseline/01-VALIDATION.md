---
phase: 1
slug: foundation-shell-voice-baseline
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from 01-RESEARCH.md §Validation Architecture. Scaffold/markup phase — no unit-test framework is introduced (proportional: `tsc` + `next build` + lint + manual render + anti-snake-oil grep).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None for app code (no jest/vitest config; Playwright exists only under `extraction/` for an unrelated capture pipeline) |
| **Config file** | none for unit tests — see Wave 0 (intentionally none) |
| **Quick run command** | `npx tsc --noEmit && npm run lint` |
| **Full suite command** | `npm run build` (Next build = the real compile/type/route gate) |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit && npm run lint`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** `npm run build` green + manual dev-server render (desktop + 375px) + anti-snake-oil grep clean
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Planner refines per-task rows. Requirement-level map seeded from research:

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| DS-01 / DS-02 | Page renders under `.numen-surface` (mounted on the marketing wrapper div, Option B); bridged tokens resolve; NO forked tokens | manual + build + grep | `grep -q 'numen-surface' "src/app/(marketing)/layout.tsx"` matches AND `grep -q 'numen-surface' src/app/layout.tsx` does NOT; `npm run build` then load `/` on `npm run dev` (warm-neutral bg, readable text) | ✅ build+grep | ⬜ pending |
| NAV-01 | Nav + footer visible all viewports; mobile menu toggles | manual | `npm run dev` → desktop + 375px viewport check | ❌ W0 (manual) | ⬜ pending |
| CONTENT-01 | Copy in voice, no "X% accuracy" / engine jargon | static grep + review | `grep -riE "accuracy\|predict viral\|[0-9]+%" "src/app/(marketing)"` returns nothing | ✅ grep | ⬜ pending |
| MOT-02 | Ordered `<section id>` slots in kero order with correct rhythm; exactly one hero `<h1>` | static + build | grep section ids present + order; `grep -c '<h1' "src/app/(marketing)/page.tsx"` == 1; `npm run build` passes | ✅ grep+build | ⬜ pending |
| PERF-02 | `<title>` + `<meta description>` render | build + manual | `npm run build` + inspect rendered head (or curl dev `/`) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] No unit-test framework for app components — **do NOT introduce one** for this scaffold phase. `tsc --noEmit` + `next build` + lint + manual render is proportional for shell/markup work. (Intentionally no Wave 0 scaffold — there is no MISSING test reference to create; the toolchain already exists.)
- [x] Anti-snake-oil guard: the CONTENT-01 grep check (above) is wired into every plan's `<verify>` + phase verification — cheap, high-value.

*Optional: a render smoke test via the existing Playwright install — not required.*

*Wave 0 status: COMPLETE. For a markup/scaffold phase the correct Wave 0 outcome is "no test framework introduced" — every code-producing task already carries an `<automated>` verify (`tsc` + `lint` + targeted grep gates), so there is no MISSING reference to scaffold. `wave_0_complete: true`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Page mounts under `.numen-surface` (via the marketing wrapper div) and tokens visibly resolve (warm-neutral bg, readable text) — guards the "@theme inline resolves at usage site, empty without ancestor" pitfall | DS-01 / DS-02 | No framework asserts computed CSS; visual confirmation needed on a live server | `npm run dev` → load `/`, confirm bg + text colors render (not transparent/black) |
| Nav + footer + mobile menu (slide-down, body-scroll-lock, outside-click) | NAV-01 | Interaction + responsive behavior | `npm run dev` → desktop + 375px; open/close hamburger, click outside, confirm scroll lock |
| Copy reads in the calm confident-mentor voice | CONTENT-01 | Voice/register is a human judgment vs VOICE.md | Review hero/section/nav/footer copy against `.planning/VOICE.md` do/don't lists |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — markup phase introduces no test framework by design)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved — strategy is proportional for a markup/scaffold phase (`tsc` + `next build` + lint + targeted grep gates + manual render). No test framework is the correct call; every code-producing task carries an automated verify.
