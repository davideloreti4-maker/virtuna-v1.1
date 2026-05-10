---
phase: 2
slug: foundation-hero
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-10
updated: 2026-05-10
---

# Phase 2 — Validation Strategy

> Per-phase validation contract. Source: 02-RESEARCH.md §4. Phase 2 deliverables are visual/composition — heavy on automated linting + manual viewport observation, with Vitest tests on constants (orchestrator decision #2 — INCLUDED in Plan 02).

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

> One row per task in each PLAN.md. Columns: Task ID = `02-{plan-num}-{task-num}`. Threat Ref maps to entries in each plan's `<threat_model>` register. Test Type: `grep` (acceptance grep), `unit` (Vitest), `build` (pnpm build), `lint` (lint or lint:vocab), `manual` (Davide). File Exists: ✅ (file will exist after task) or ➖ (no new file). Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | BUILD-01 | T-2-04 | DoS-safe scroll behavior with prefers-reduced-motion fallback | grep | `grep -q "scroll-behavior: smooth" src/app/globals.css && grep -q "prefers-reduced-motion: reduce" src/app/globals.css` | ➖ | ⬜ pending |
| 02-01-02 | 01 | 1 | BUILD-01 | T-2-01 | Static import wiring — no untrusted route destinations introduced | grep | `grep -q "BehavioralHero" "src/app/(marketing)/page.tsx" && ! grep -q "HeroSection" "src/app/(marketing)/page.tsx" && grep -q "BehavioralHero" src/components/landing/index.ts && ! grep -q "HeroSection" src/components/landing/index.ts` | ➖ | ⬜ pending |
| 02-01-03 | 01 | 1 | BUILD-01 | T-2-02 | Plagiarized legacy code removed — supply-chain hygiene | grep | `! test -f src/components/landing/hero-section.tsx && [ "$(grep -r "hero-section" src/ --include="*.ts" --include="*.tsx" \| wc -l)" -eq 0 ]` | ➖ (deletion) | ⬜ pending |
| 02-02-01 | 02 | 1 | HERO-06, HERO-07 | T-2-05 | Constants immutability + drift catches via Vitest | grep | `test -f src/components/landing/behavioral-hero-constants.ts && grep -q "export const HERO_GRADIENT" src/components/landing/behavioral-hero-constants.ts && grep -q "1 - Math.pow(1 - t, 3)" src/components/landing/behavioral-hero-constants.ts && pnpm lint:vocab` | ✅ | ⬜ pending |
| 02-02-02 | 02 | 1 | HERO-06, HERO-08, HERO-10 | T-2-06, T-2-07 | Module-isolation of flag name; reduced-motion + RAF safety | grep | `test -f src/components/landing/BehavioralCanvas.tsx && grep -q "'use client'" src/components/landing/BehavioralCanvas.tsx && grep -q "let behavioralHeroAnimationComplete" src/components/landing/BehavioralCanvas.tsx && ! grep -q "globalAnimationPlayed" src/components/landing/BehavioralCanvas.tsx && grep -q "Audience particles aggregating into a confidence score of 87 percent" src/components/landing/BehavioralCanvas.tsx && ! grep -E "fillText\|strokeText" src/components/landing/BehavioralCanvas.tsx && pnpm lint:vocab` | ✅ | ⬜ pending |
| 02-02-03 | 02 | 1 | HERO-06 (invariants) | T-2-05 | Vitest enforces mobile<desktop, percentage range, animation window, easing boundaries | unit | `test -f src/components/landing/__tests__/behavioral-hero-constants.test.ts && [ "$(grep -c 'it(' src/components/landing/__tests__/behavioral-hero-constants.test.ts)" -eq 4 ] && pnpm test -- behavioral-hero-constants` | ✅ | ⬜ pending |
| 02-03-01 | 03 | 1 | BUILD-02 | T-2-09, T-2-10 | Policy doc encodes REJECT criteria — prevents future supply-chain ingress | grep | `test -f .planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md && grep -q "REJECT" .planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md && grep -q "ACCEPT" .planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md && [ "$(grep -c '^| R[0-9]' .planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md)" -eq 6 ] && [ "$(grep -c '^| A[0-9]' .planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md)" -eq 7 ]` | ✅ | ⬜ pending |
| 02-03-02 | 03 | 1 | BUILD-02 | T-2-11 | Policy discoverable from BRAND-BIBLE; PROJECT.md stability preserved | grep | `grep -q "external component policy" BRAND-BIBLE.md && grep -q "02-EXTERNAL-COMPONENT-POLICY" BRAND-BIBLE.md && ! grep -q "external component policy" PROJECT.md` | ➖ | ⬜ pending |
| 02-04-01 | 04 | 2 | HERO-01..05, HERO-07, HERO-09, HERO-10 | T-2-12 .. T-2-17 | Locked copy + DOM-accessible chip + zero external imports; full build + lint clean | grep + build | `test -f src/components/landing/BehavioralHero.tsx && ! grep -q "'use client'" src/components/landing/BehavioralHero.tsx && grep -q "Predict how your audience will respond" src/components/landing/BehavioralHero.tsx && grep -q "clamp(2.75rem, 6.5vw, 5rem)" src/components/landing/BehavioralHero.tsx && grep -q 'href="/dashboard"' src/components/landing/BehavioralHero.tsx && grep -q 'href="#science"' src/components/landing/BehavioralHero.tsx && grep -q 'role="status"' src/components/landing/BehavioralHero.tsx && pnpm lint:vocab && pnpm lint && pnpm build` | ✅ | ⬜ pending |

**Coverage summary:** 9 tasks total across 4 plans. Every task has an automated verification command. Wave 1 produces 4 new files (constants, canvas, test, policy) and modifies 4 (globals.css, page.tsx, barrel, BRAND-BIBLE.md) + deletes 1 (hero-section.tsx). Wave 2 produces 1 new file (BehavioralHero.tsx) and closes the build.

---

## Wave 0 Requirements

- [x] **Required (now in Plan 01 Task 1):** Add `html { scroll-behavior: smooth; }` (with `prefers-reduced-motion: reduce` fallback) block to `src/app/globals.css` — closes RESEARCH.md §1 drift item #2.
- [x] **Required (now in Plan 02 Task 3 per orchestrator decision #2):** `src/components/landing/__tests__/behavioral-hero-constants.test.ts` — 4-test Vitest suite for constants invariants (~30 LOC). Promoted from "optional" to "required" because the constants file's numeric tunables (particle counts, percentage, animation duration, easing) are the only Phase-2 deterministically-testable behavior.
- [x] **No new framework install** — Vitest + Playwright already configured.
- [x] **No new test fixtures** — hero is composition-only.

---

## Manual-Only Verifications

| Behavior | Requirement | Plan | Why Manual | Test Instructions |
|----------|-------------|------|------------|-------------------|
| Hero renders correctly above fold at 1280px desktop | HERO-01..05 (composition + copy) | 04 | Visual hierarchy, gradient luminance, two-column proportions | `pnpm dev` → open Chrome at 1280×720 → screenshot → verify hierarchy: pre-headline, H1, sub-headline, subline, dual CTA stacked left; canvas right; coral gradient peak upper-center; "87%" chip overlays canvas convergence point |
| Behavioral particle animation plays once and respects reduced-motion | HERO-06, HERO-08, BUILD-04 | 02 + 04 | Motion timing + reduced-motion toggle observation | DevTools Rendering panel → Emulate `prefers-reduced-motion: reduce` → reload → confirm canvas mounts directly into converged static state with chip still visible. Toggle off → reload → confirm 2.2s drift+attract animation, particles converge toward chip position |
| Mobile hero stacks vertically at 375px with no horizontal scroll | HERO-08 (mobile responsive) | 04 | Layout reflow, touch-target sizing | Chrome DevTools device emulation iPhone 14 (390×844) → confirm canvas above text → no horizontal scroll → CTAs ≥44px tap target |
| Module-level animation flag prevents replay on remount | HERO-06 (one-shot per session) | 02 | RSC boundary + module persistence behavior | Navigate to `/dashboard`, then back to `/` → confirm animation does NOT replay (canvas mounts directly into converged state) |
| Screen reader announces "87 percent" via DOM chip | HERO-06 (a11y), BUILD-05 (Phase 5 gate) | 04 | VoiceOver / NVDA observation only | VoiceOver (Cmd+F5 on Mac) → arrow through hero → confirm SR announces "Predicted audience response confidence: 87%" from chip aria-label, AND "Audience particles aggregating into a confidence score of 87 percent" from canvas role=img |
| External component policy applied | BUILD-02 (rejection criteria) | 03 | Subjective design judgment review | Davide reads `02-EXTERNAL-COMPONENT-POLICY.md` → confirms REJECT/ACCEPT criteria match brand restraint; ticks sign-off checkbox |
| Hero copy verbatim sign-off | HERO-01..05 + HERO-10 | 04 | Final human gate per Phase 1 SC2 | Davide reads rendered hero copy in browser, confirms verbatim match against REPLACEMENT-COPY.md hero block |
| `#science` anchor expectation acknowledged | HERO-05 (forward-compat) | 04 | Documentation gate — no test possible until Phase 4 | Davide confirms understanding that clicking "See the science" CTA in Phase 2-3 produces a no-op smooth-scroll until Phase 4 lands SCI-01..06 (orchestrator decision #3) |

---

## Validation Sign-Off

- [x] All 9 tasks have `<automated>` verify commands
- [x] Sampling continuity: every task has automated verification (no 3-task gap)
- [x] Wave 0 covers `globals.css` scroll-behavior add (Plan 01 Task 1) + constants test file (Plan 02 Task 3)
- [x] No watch-mode flags
- [x] Feedback latency < 60s (full suite estimated 30-60s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Per-Task Verification Map filled — ready for `/gsd-execute-phase 02-foundation-hero` after plan-checker review.
