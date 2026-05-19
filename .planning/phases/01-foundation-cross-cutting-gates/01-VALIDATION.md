---
phase: 1
slug: foundation-cross-cutting-gates
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `01-RESEARCH.md` §16 Validation Architecture (Nyquist Dimension 8).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (visual + functional), tsc --noEmit (type-check), grep-based CI guards |
| **Config file** | `playwright.config.ts` (root), `tsconfig.json` |
| **Quick run command** | `pnpm exec tsc --noEmit && pnpm exec playwright test verification/scripts/visual-comparison.spec.ts --reporter=line` |
| **Full suite command** | `pnpm install && pnpm build && pnpm exec playwright test verification/ --reporter=line && pnpm run analyze` |
| **Estimated runtime** | ~90 seconds (quick) / ~5 minutes (full incl. build + analyze) |

---

## Sampling Rate

- **After every task commit:** Run quick run command (tsc + visual-comparison spec)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green AND dashboard regression snapshot byte-identical to baseline
- **Max feedback latency:** ~90 seconds (quick), ~5 minutes (full)

---

## Per-Task Verification Map

> Task ID column filled 2026-05-19 by plan-checker remediation. Maps every FOUND-XX requirement to the owning plan(s) and task(s).

| Requirement | Task ID(s) | Validation Strategy | Automated Command | Manual? |
|-------------|-----------|--------------------|--------------------|---------|
| FOUND-01 (legacy deletion) | 01-11 Task 1 (atomic commit) | `git diff --name-only` shows 14 files in `src/components/landing/` deleted + `/pricing` route deleted | `git log -1 --stat \| grep -c "src/components/landing/" \| awk '$1==14'` | No |
| FOUND-02 (empty scaffold) | 01-11 Task 1 (page rewrite step) | `(marketing)/page.tsx` renders 7 `<section data-section="X">` placeholders | `grep -c 'data-section=' src/app/\(marketing\)/page.tsx \| awk '$1==7'` | No |
| FOUND-03 (token layer) | 01-01 Task 1 + 01-05 Tasks 1,2 | `landing.css` exists with `@layer landing`; imported ONLY from `(marketing)/layout.tsx` | `pnpm exec tsx scripts/check-landing-scope.ts` (returns 0) | No |
| FOUND-04 (Lenis scope) | 01-02 Task 1 + 01-11 Task 1 (wiring) | LenisProvider wraps `(marketing)/` only; no `lenis-*` class on `/app/dashboard` body | Playwright spec: `verification/scripts/dashboard-regression.spec.ts` | No |
| FOUND-05 (LazyMotion + m.*) | 01-03 Task 1 + 01-11 Task 1 (wiring) | `LandingMotionProvider` with `LazyMotion strict`; landing components use `m.*` not `motion.*` | `grep -rE "from \"motion/react\"" src/components/landing/ src/app/\(marketing\)/` returns empty (must use `motion/react-m`) | No |
| FOUND-06 (Inter opsz) | 01-04 Task 2 | `next/font/google` Inter has `axes: ['opsz']`; `font-optical-sizing: auto` applied | `grep -E "axes.*opsz" src/app/layout.tsx` AND Playwright computed-style assertion | No |
| FOUND-07 (image formats) | 01-06 Task 1 | `next.config.ts` has `images.formats: ['image/avif', 'image/webp']` | `grep -E "image/avif" next.config.ts` | No |
| FOUND-08 (bundle analyzer) | 01-00 Task 1 (rename + install) + 01-06 Task 2 (wrap) + 01-12 Task 4 (baseline) | `@next/bundle-analyzer` wired; `pnpm run analyze` produces report; hero critical path baseline captured | `pnpm run analyze` exits 0; `cat .planning/CRAFT-RUBRIC.md \| grep -E "Hero critical path:.*KB"` | No |
| FOUND-09 (web vitals — dev floor) | 01-04 Task 1 + 01-11 Task 1 (mount) | Dev: console.log of LCP/CLS/INP/TTFB on landing route; route-tag set on Sentry transaction. Prod Sentry capture is gated on `tracesSampleRate > 0` (Pitfall C, out of Phase 1 scope per CRAFT-RUBRIC.md). | Playwright dev-mode test asserts console events; Sentry config audit confirms route tag wiring | Sentry prod web vitals visibility is manual + requires `tracesSampleRate` raise post-deploy |
| FOUND-10 (MotionWrapper leaf) | 01-03 Task 2 + 01-11 Task 1 (verified-unmodified) | `src/components/MotionWrapper.tsx` exists with `"use client"`; never section-level | `head -1 src/components/MotionWrapper.tsx \| grep "use client"` | No |
| FOUND-11 (Playwright harness) | 01-09 Tasks 1,2 + 01-10 Tasks 1,2 + 01-12 Task 2 | `visual-comparison.spec.ts` extended with 7 new section selectors at 375/768/1280; baseline snapshots committed | `pnpm exec playwright test verification/scripts/visual-comparison.spec.ts` exits 0 | No |
| FOUND-12 (anti-slop discipline) | 01-07 Task 1 + 01-12 Task 4 (baseline insert) | `.planning/CRAFT-RUBRIC.md` exists; embeds AS-01..AS-15 with refined alternatives; 6-dimension scoring documented | `grep -c "^### AS-" .planning/CRAFT-RUBRIC.md \| awk '$1==15'` | No |
| FOUND-13 (phase-gate checklist) | 01-00 Task 2 (dashboard baseline) + 01-07 Task 1 (rubric) + 01-09 Tasks 1,2 (Playwright + dashboard regression) + 01-12 Task 5 (full suite) | Production build passes; backdrop-filter renders in prod; dashboard regression snapshot byte-identical; git diff scope guard | `pnpm build && pnpm start` smoke; `git diff --name-only` regex match against landing-only paths; pixelmatch dashboard diff < 0.5% | Davide visual sign-off required (01-12 Task 6 checkpoint) |
| FOUND-14 (section-brief template) | 01-08 Task 1 | `.planning/SECTION-BRIEF-TEMPLATE.md` exists with 7 subsections (D-04) | `grep -cE "^## (Purpose\|Audience\|Content\|Interaction\|Success\|Anti-slop\|Reference)" .planning/SECTION-BRIEF-TEMPLATE.md \| awk '$1==7'` | No |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pnpm install` — `node_modules/` does not yet exist in this worktree
- [ ] Add `lenis` (1.3.23) + `@next/bundle-analyzer` (16.2.6) to `package.json`
- [ ] Capture baseline `/app/dashboard` Playwright snapshot to `verification/baselines/dashboard-1280.png` BEFORE any landing changes (proves zero token leakage post-Phase 1)
- [ ] Verify `playwright.config.ts` viewport list includes 375/768/1280 (research §5 flagged change from 1440 → 1280)
- [ ] Verify Inter font already has `axes: ['opsz']` OR plan task adds it (FOUND-06)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Davide visual sign-off on day-1 empty scaffold | FOUND-13 (5-layer visual gate, D-05) | Subjective craft judgment, no automated alternative for "feels production-quality" | Run `pnpm build && pnpm start`; visit `/` at 375/768/1280 in Chrome + Safari; confirm: no derivative-feel placeholders, scaffolding feels intentional, sticky-nav SSR placeholder doesn't shift on hydrate |
| Sentry web vitals visible in Sentry dashboard | FOUND-09 (prod web vitals reporting, D-25) | Requires deployed env + traffic | Post-deploy: visit landing route 10x; check Sentry → Performance → Web Vitals; confirm LCP, CLS, INP captured with `route: landing` tag |
| Reference snapshot freshness check | D-07 | Manual policy — only refresh on visible Linear/Raycast redesign | Once per milestone: open `verification/reference/linear-desktop-1280.png` next to live linear.app; if meaningfully different, rerun `pnpm run capture:refs` |

---

## Validation Sign-Off

- [ ] All FOUND-XX requirements have automated verification commands (or documented manual fallback)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (pnpm install, package additions, dashboard baseline)
- [ ] No watch-mode flags (Playwright `--ui` excluded from CI commands)
- [ ] Feedback latency < 90s for quick run, < 5min for full suite
- [x] `nyquist_compliant: true` set in frontmatter — Task ID column filled 2026-05-19 by plan-checker remediation

**Approval:** approved 2026-05-19 — Task ID column complete, every FOUND-XX maps to ≥1 plan task, nyquist_compliant flipped to true.
