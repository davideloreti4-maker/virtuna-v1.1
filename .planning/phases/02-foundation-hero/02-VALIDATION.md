---
phase: 2
slug: foundation-hero
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-10
---

# Phase 2 — Validation Strategy

> Per-phase validation contract. Source: 02-RESEARCH.md §4. Phase 2 deliverables are visual/composition — heavy on automated linting + manual viewport observation, with optional Vitest tests on constants.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 (existing); Playwright 1.58.0 (existing, optional this phase) |
| **Config file** | `vitest.config.ts` (existing); `e2e/playwright.config.ts` (existing) |
| **Quick run command** | `pnpm lint && pnpm lint:vocab` |
| **Full suite command** | `pnpm test && pnpm lint && pnpm lint:vocab && pnpm build` |
| **Estimated runtime** | Quick: ~5s · Full: ~30-60s |

---

## Sampling Rate

- **After every task commit:** `pnpm lint && pnpm lint:vocab` (~5s)
- **After every plan wave:** `pnpm test && pnpm lint && pnpm lint:vocab && pnpm build` (~30-60s)
- **Before `/gsd-verify-work`:** Full suite green + manual viewport observation by Davide (Chrome + Safari at 1280px + 375px)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Filled in by planner. Each task in each PLAN.md gets a row here keyed by Task ID, with the automated command from RESEARCH.md §4 SC1-SC5 tables.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | BUILD-01 | — | N/A | grep | `grep -q "BehavioralHero" src/app/\(marketing\)/page.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Planner expands this table during plan creation — every task that produces a file or string-level acceptance criterion gets an automated grep/test command.*

---

## Wave 0 Requirements

- [ ] **Required:** Add `html { scroll-behavior: smooth; }` (with `prefers-reduced-motion: reduce` fallback) block to `src/app/globals.css`. CONTEXT.md D-28 incorrectly assumed this was already present — research drift item §1.2. Belongs in Plan 1 (scaffold).
- [ ] **Optional:** `src/components/landing/__tests__/behavioral-hero-constants.test.ts` — 4-test Vitest suite for constants invariants (~30 LOC). Recommended; not blocking.
- [ ] **No new framework install** — Vitest + Playwright already configured.
- [ ] **No new test fixtures** — hero is composition-only.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hero renders correctly above fold at 1280px desktop | HERO-01..05 (composition + copy) | Visual hierarchy, gradient luminance, two-column proportions | `pnpm dev` → open Chrome at 1280×720 → screenshot → verify hierarchy: pre-headline, H1, sub-headline, subline, dual CTA stacked left; canvas right; coral gradient peak upper-center |
| Behavioral particle animation plays once and respects reduced-motion | HERO-06, HERO-08, BUILD-04 | Motion timing + reduced-motion toggle observation | DevTools Rendering panel → Emulate `prefers-reduced-motion: reduce` → reload → confirm static converged state. Toggle off → reload → confirm 2.2s drift+attract animation, particles converge into coral chip with "87%" |
| Mobile hero stacks vertically at 375px with no horizontal scroll | HERO-08 (mobile responsive) | Layout reflow, touch-target sizing | Chrome DevTools device emulation iPhone 14 (390×844) → confirm canvas above text → no horizontal scroll → CTAs ≥44px tap target |
| Module-level animation flag prevents replay on remount | HERO-06 (one-shot per session) | RSC boundary + module persistence behavior | Navigate to `/dashboard`, then back to `/` → confirm animation does NOT replay (canvas mounts directly into converged state) |
| External component policy applied | BUILD-02 (rejection criteria) | Subjective design judgment review | Davide reads `02-EXTERNAL-COMPONENT-POLICY.md` → confirms REJECT/ACCEPT criteria match brand restraint |
| Hero copy verbatim sign-off | HERO-01..05 + HERO-10 | Final human gate per Phase 1 SC2 | Davide reads rendered hero copy in browser, confirms verbatim match against REPLACEMENT-COPY.md |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers `globals.css` scroll-behavior add + (optional) constants test file
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner fills Per-Task Verification Map)

**Approval:** pending
