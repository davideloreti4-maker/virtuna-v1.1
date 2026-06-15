---
phase: 1
slug: foundation-shell
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-14
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Pure-visual/scaffold phase: dominant surface is **build + typecheck (via `next build`) + scoped vitest + one human visual-check** (D-08 — no new UAT gate). Package manager is **pnpm** (lockfile = `pnpm-lock.yaml`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`vitest run`) — component/hook tests opt into `happy-dom` via `/** @vitest-environment happy-dom */` file pragma |
| **Config file** | `vitest.config.ts` (present); setup `./src/test/setup.ts` |
| **Quick run command** | `pnpm vitest run src/components/marketing src/components/layout` |
| **Full suite command** | `pnpm test` (= `vitest run`) |
| **Build / typecheck gate** | `pnpm build` (= `next build`, includes type-check — no standalone `tsc` script in this worktree) |
| **Lint** | `pnpm lint` |
| **Estimated runtime** | scoped ~10–20s · full suite ~minutes (212 existing test files) |

> **Task-zero (hard blocker):** fresh worktree has **no `node_modules`**. `pnpm install` MUST run before any build/test/dev command.

---

## Sampling Rate

- **After every task commit:** `pnpm vitest run <scoped path>` for the touched component + `pnpm build` if `globals.css` or routes changed.
- **After every plan wave:** `pnpm test` (full vitest) + `pnpm build`.
- **Before `/gsd:verify-work`:** `pnpm build` green + `pnpm test` green + a single manual visual-check of `/` under the assembled flat-warm theme (D-08).
- **Max feedback latency:** ~20s (scoped run).

---

## Per-Task Verification Map

> Plan-level mapping (task IDs finalized by the planner/executor). Status pending until execution.

| Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01 (theme port + route mount + Newsreader + deletions) | 1 | FOUND-01, FOUND-02 | — | N/A (static marketing, no inputs) | build / smoke | `pnpm build` | n/a (build gate) | ⬜ pending |
| 01-02 (`<Placeholder>` slot) | 2 | FOUND-03 | — | N/A | unit (happy-dom) | `pnpm vitest run src/components/marketing/__tests__/placeholder.test.tsx` | ❌ W0 | ⬜ pending |
| 01-03 (MotionConfig + CSS reduced-motion) | 2 | FOUND-04 | — | N/A | unit (happy-dom) + visual | `pnpm vitest run src/components/marketing` + DevTools emulate prefers-reduced-motion | ❌ W0 | ⬜ pending |
| 01-04 (header chrome + mobile collapse) | 3 | NAV-01, NAV-03 | — | N/A (CTA = static `/signup` link, no auth call) | unit (happy-dom, user-event) | `pnpm vitest run src/components/layout/__tests__/header.test.tsx` | ❌ W0 | ⬜ pending |
| 01-05 (footer chrome) | 3 | NAV-02 | — | N/A | unit (happy-dom) | `pnpm vitest run src/components/layout/__tests__/footer.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/marketing/__tests__/placeholder.test.tsx` — FOUND-03: variant→icon resolution, `src`-present (real `<img>`/`<video>`) vs absent (labelled stand-in), `aspect-ratio` lock, reduced-motion breathe gate.
- [ ] `src/components/layout/__tests__/header.test.tsx` — NAV-01 + NAV-03: renders `NumenLogo`, "Try it free" CTA href = `/signup`, mobile menu toggles open/closed, closes on link tap.
- [ ] `src/components/layout/__tests__/footer.test.tsx` — NAV-02: brand, in-page anchor mirror, legal/social placeholder links.
- [ ] No framework install needed — vitest + happy-dom already configured; `@testing-library/react` + `user-event` present (existing `*.test.tsx` use them — confirm after `pnpm install`, assumption A1).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Assembled `/` reads as flat-warm Claude.ai-calm (charcoal `#262624` bg, cream text, terracotta CTA, no glass/glow) | FOUND-02 | No automated visual-regression tooling in this worktree; D-08 = single human sanity look, not a new UAT gate | `pnpm dev` → open `/`, confirm charcoal bg + cream text + terracotta CTA + flat-matte (no blur/shine/glow); confirm no double-header |
| Reduced-motion: animations halt under OS/DevTools "reduce" | FOUND-04 | Visual confirmation complements the unit assertions | DevTools → Rendering → "Emulate prefers-reduced-motion: reduce" → confirm skeleton-breathe / marquee / shimmer stop |

---

## Validation Sign-Off

- [ ] All tasks have an automated verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (3 test files above)
- [ ] No watch-mode flags (all commands use `vitest run`, not `vitest`)
- [ ] Feedback latency < 20s (scoped)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
