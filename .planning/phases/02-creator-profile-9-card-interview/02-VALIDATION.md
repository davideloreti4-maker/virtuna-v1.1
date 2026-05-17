---
phase: 02
slug: creator-profile-9-card-interview
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-17
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit) + playwright (e2e) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm test --run` (vitest non-watch) |
| **Full suite command** | `pnpm test --run && pnpm exec playwright test` |
| **Estimated runtime** | ~60s unit; ~3–5 min e2e |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --run` scoped to changed module
- **After every plan wave:** Run full vitest suite
- **Before `/gsd-verify-work`:** Full vitest + Playwright e2e must be green
- **Max feedback latency:** 60 seconds (unit)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| TBD | TBD | TBD | PROFILE-01..17, INT-02, INT-04 | unit + e2e | `pnpm test --run` / `pnpm exec playwright test` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Concrete per-task rows are populated by gsd-planner during plan generation.*

---

## Wave 0 Requirements

- [ ] `src/lib/niches/__tests__/taxonomy.test.ts` — unit stubs for niche-tree shape
- [ ] `src/lib/engine/__tests__/creator.test.ts` — unit stubs for `formatCreatorContext()` null-guarding
- [ ] `src/lib/__tests__/handle-parser.test.ts` — unit stubs for handle extraction (reuses `normalizeHandle` from `src/lib/schemas/competitor.ts`)
- [ ] `e2e/profile-interview.spec.ts` — Playwright spec stubs (happy path + skip-all + settings edit). Note: `e2e/playwright.config.ts` declares `testDir: '.'` so spec files MUST live inside `e2e/`.

*Wave 0 establishes empty test files so subsequent tasks land in green-first cycles.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reference creator scrape lands competitor data | PROFILE-09 | Apify async webhook (minutes-to-hours latency) | Add TikTok handle to Card 5, save, wait 30 min, verify `competitor_profiles` row has scrape fields populated |
| Modal renders with Raycast design tokens | PROFILE-04 | Visual fidelity check | Open modal in dev, screenshot, compare against UI-SPEC §"Visual" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (taxonomy, handle-parser, creator-context-merger, e2e)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
