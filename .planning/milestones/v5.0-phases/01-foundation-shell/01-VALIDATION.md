---
phase: 1
slug: foundation-shell
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-13
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `01-RESEARCH.md` § Validation Architecture (Vitest infra verified against `package.json` + `vitest.config.ts`). Task IDs are seeded at requirement level; the planner binds them to concrete `{N}-{plan}-{task}` IDs as plans are written.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 (`[VERIFIED: package.json]`) |
| **Config file** | `vitest.config.ts` (root) |
| **Component/hook env** | `node` default; component/hook tests opt into `happy-dom` via `/** @vitest-environment happy-dom */` pragma. Setup: `src/test/setup.ts` (jest-dom + vitest-axe matchers, ResizeObserver + matchMedia shims for Radix) |
| **Quick run command** | `npx vitest run src/components/sidebar src/components/app/home` (scoped) |
| **Full suite command** | `npm test` (= `vitest run`) |
| **Estimated runtime** | scoped ~5–10s · full suite measured at Wave 0 (existing suite; excludes `_dormant/**`) |

---

## Sampling Rate

- **After every task commit:** Run the scoped quick command for the touched area (`npx vitest run src/components/sidebar` or `…/app/home`)
- **After every plan wave:** Run `npm test` (full suite must be green)
- **Before `/gsd:verify-work`:** Full suite green **AND** `npm run build` succeeds (proves `globals.css` compiles after the token migration) — THEN the THEME-06 human gate
- **Max feedback latency:** ~10 seconds (scoped)

---

## Per-Task Verification Map

> Requirement-keyed seed (task IDs assigned by the planner). Threat refs filled from the planner's `<threat_model>`.

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| SHELL-01 | Home renders serif greeting + composer + NumenMark; **no starter chips** (D-18) | unit (happy-dom) | `npx vitest run src/components/app/home/__tests__/home.test.tsx` | ❌ W0 | ⬜ pending |
| SHELL-02 | TikTok URL paste → submit enabled; non-TikTok rejected with D-21 copy | unit | `npx vitest run src/components/app/home/__tests__/composer.test.tsx` | ❌ W0 | ⬜ pending |
| SHELL-03 | `+` upload accepts MP4/MOV, rejects oversize / wrong type | unit | reuse `src/components/app/__tests__/video-upload.test.tsx` + composer test | ✅ / ❌ W0 | ⬜ pending |
| SHELL-04 | Composer centered when no id → bottom-pinned when id present | unit | `npx vitest run src/components/app/home/__tests__/composer-layout.test.tsx` | ❌ W0 | ⬜ pending |
| SHELL-05 | Sidebar lists Simulations from `useAnalysisHistory`; score chips; no Pinned/Projects/Boards | unit | extend `src/components/sidebar/__tests__/Sidebar.recent.test.tsx` | ✅ extend | ⬜ pending |
| SHELL-05 | Desktop collapse via ⌘\ + persists; mobile = drawer | unit | `src/components/sidebar/__tests__/Sidebar.collapse.test.tsx` | ❌ W0 | ⬜ pending |
| SHELL-06 | `/analyze/[id]` permalink restores shell via `usePermalinkAnalysis` | integration | existing permalink hook coverage + shell-restore assertion | ⚠️ partial | ⬜ pending |
| SHELL-07 | Mobile (<768) drawer; desktop persistent (branch on `useIsMobile`) | unit | `Sidebar.collapse.test.tsx` (viewport-mocked) | ❌ W0 | ⬜ pending |
| THEME-02 | No `linear-gradient(137deg` / `backdropFilter` remains in `Sidebar.tsx` (Layer B regression guard) | unit (source-grep) | cheap source-assertion test | ❌ W0 | ⬜ pending |
| THEME-04 | `--font-serif` defined; greeting element uses `font-serif` | unit | `home.test.tsx` greeting-class assertion | ❌ W0 | ⬜ pending |
| THEME-05 | Calm motion respects `usePrefersReducedMotion` | unit | composer/sidebar transition tests with reduced-motion mock | ❌ W0 | ⬜ pending |
| THEME-01/03 | Tokens compile (no glass/glow tokens); charcoal surfaces; coral lone accent | build + manual | `npm run build` + UAT visual | manual-only | ⬜ pending |
| THEME-06 | Human-UAT sign-off on the built shell | **manual gate** | `checkpoint:human-verify` (see Manual-Only) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/app/home/__tests__/home.test.tsx` — SHELL-01, THEME-04 (greeting serif + NumenMark + no chips)
- [ ] `src/components/app/home/__tests__/composer.test.tsx` — SHELL-02/03 (TikTok-only reject, upload validation)
- [ ] `src/components/app/home/__tests__/composer-layout.test.tsx` — SHELL-04 (centered ↔ pinned)
- [ ] `src/components/sidebar/__tests__/Sidebar.collapse.test.tsx` — SHELL-05/07 (⌘\ collapse + persist + mobile drawer, viewport-mocked)
- [ ] Source-assertion test: `Sidebar.tsx` no longer contains `linear-gradient(137deg` or `backdropFilter` — THEME-02 Layer B regression guard
- [ ] Extend `src/components/sidebar/__tests__/Sidebar.recent.test.tsx` — assert "Simulations" label; no Pinned/Projects/Boards nodes
- [ ] No framework install needed — Vitest + happy-dom + testing-library + vitest-axe all present (`[VERIFIED]`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Exact charcoal hex ramp / coral hue / serif typeface / score-zone colors read correctly | THEME-01, THEME-03 | Color perception + taste are human-judgment; pixel values are `[UAT]` by design (D-07/D-08) | Run dev server; view the built home (empty + active) at desktop + phone widths; confirm flat-warm matte, no glass/glow, coral as lone accent |
| Flat-warm visual system signed off as locked-for-rollout | THEME-06 | Aesthetic sign-off gate — the phase exit gate, not a checkbox (D-07) | `checkpoint:human-verify` on the running shell: empty state (serif greeting + composer + stele) AND active layout (composer bottom-pinned, sidebar of Simulations with score chips), desktop + phone widths, glass fully stripped. Human types approval or lists changes. |

*Automated coverage asserts **structural** facts (token absence, font-var presence, no-glass-in-sidebar, composer position, sidebar composition). The **aesthetic** lock is the human gate.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`vitest run`, never `vitest --watch`)
- [ ] Feedback latency < 10s (scoped)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
