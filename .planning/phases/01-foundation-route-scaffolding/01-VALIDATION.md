---
phase: 1
slug: foundation-route-scaffolding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `01-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.0.18` + Playwright `^1.58.0` |
| **Config file** | `vitest.config.*`, `playwright.config.ts` under `e2e/` and `extraction/` |
| **Quick run command** | `pnpm test` (Vitest run) |
| **Full suite command** | `pnpm test && pnpm run e2e` |
| **Estimated runtime** | ~10s (quick), ~1-2 min (full + lint + build) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test`
- **After every plan wave:** Run `pnpm test && pnpm run lint && pnpm run build`
- **Before `/gsd-verify-work`:** Full build green + browser smoke check on `/`, `/pricing`, `/showcase`
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | SC-1 (route shell) | — | N/A | smoke | `pnpm run build` + manual `/` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-2 (Magic UI primitives) | — | N/A | unit | `pnpm test src/components/magic-ui/` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-2.tuning (Raycast tokens) | — | N/A | unit | grep-style assertion in test files | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-3 (vetting checklist) | — | N/A | smoke | `grep -c "External Library Vetting Checklist" BRAND-BIBLE.md` | n/a | ⬜ pending |
| TBD | TBD | TBD | SC-4 (no console errors) | — | N/A | manual | Browser DevTools on `/` + `/showcase` | manual | ⬜ pending |
| TBD | TBD | TBD | SC-cross (/pricing still renders) | — | N/A | smoke | `pnpm run build` + manual `/pricing` | covered | ⬜ pending |
| TBD | TBD | TBD | SC-build (clean build) | — | N/A | smoke | `pnpm run build` | covered | ⬜ pending |

*Task IDs to be filled by the planner. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/magic-ui/__tests__/magic-card.test.tsx` — assert MagicCard import works + default `gradientFrom === "#FF7F50"`
- [ ] `src/components/magic-ui/__tests__/border-beam.test.tsx` — assert BorderBeam import + default `colorFrom` includes coral rgba
- [ ] `src/components/magic-ui/__tests__/shine-border.test.tsx` — assert ShineBorder import + default `shineColor` is an array (coral palette)
- [ ] `tests/integration/marketing-shell.test.tsx` — render `<HomePage />`, assert empty `<main>` (no plagiarized AS text)
- [ ] No additional test runner install needed (Vitest is already present)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No console errors on `/` first load | SC-4 | DevTools-only signal; not unit-testable cheaply | Open `/` in Chrome, watch console for errors + React hydration warnings |
| No console errors on `/showcase` (Magic UI primitives mounted) | SC-4 | Same — DevTools-only | Open `/showcase`, scroll to Magic UI section, watch console |
| Raycast-native eyeball test | SC-2 (qualitative) | Visual judgment, not asserted by tokens alone | Compare side-by-side with existing 36-component showcase; confirm primitives don't read "Magic UI" (purple/violet bleed, glow burst) |
| `/pricing` page still renders after `src/components/landing/` deletion | SC-cross | Cross-route regression; build can pass without browser render | `pnpm dev` then open `/pricing` and confirm no console errors / blank state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (planner to fill TBD rows)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (4 test files + existing Vitest infrastructure)
- [ ] No watch-mode flags (Vitest `run` mode, not `dev`)
- [ ] Feedback latency < 15s for quick run
- [ ] `nyquist_compliant: true` set in frontmatter after plan approval

**Approval:** pending
