---
status: partial
phase: 02-foundation-hero
source: [02-VERIFICATION.md, 02-REVIEW.md, 02-VALIDATION.md]
started: 2026-05-11T00:00:00Z
updated: 2026-05-11T00:00:00Z
---

## Current Test

[awaiting human testing — start dev server with `pnpm dev`, walk through Tests 1–8]

## Context

All 5 codebase-level success criteria for Phase 2 pass automatically (see `02-VERIFICATION.md`). Code review surfaced one critical bug (CR-01: canvas painted zero particles) which has been fixed inline — verified via `scripts/verify-canvas.mjs` showing 2478 / 2485 / 2149 non-zero pixels across desktop / mobile / reduced-motion (was 0/0/0). The 8 tests below are the manual gates from VALIDATION.md "Manual-Only Verifications" — they are intentional non-automatable acceptance criteria, not phase failures.

## Tests

### 1. Visual hierarchy at 1280px Chrome
expected: Pre-headline lockup → oversized H1 → sub-headline → subline → dual CTA reads top-to-bottom; coral + Raycast neutral ambient gradient (HERO_GRADIENT) is visible behind the composition; behavioral-simulation particles render in the upper-right cluster zone; 87% confidence chip overlays the cluster as DOM (selectable, not painted).
result: [pending]

### 2. Visual parity at 1280px Safari
expected: Same hero composition renders identically in Safari (or has documented degradation noted). Canvas particles animate smoothly; gradient backdrop matches Chrome.
result: [pending]

### 3. Mobile hero at 375/390px — stacking + tap targets
expected: Layout stacks vertically with hierarchy preserved (`flex-col-reverse lg:flex-row`); canvas mobile branch (width < 640px) renders 120 particles at 0.85 size scale; both CTAs are ≥ 44px tall (Apple HIG minimum).
result: [pending]

### 4. Reduced-motion toggle observation
expected: With macOS System Settings → Accessibility → Display → Reduce motion enabled (or Chrome DevTools "Emulate CSS prefers-reduced-motion: reduce"), particles cluster directly (no drift+attract animation) and smooth-scroll on `#science` anchor is disabled.
result: [pending]

### 5. Module-flag persistence on `/dashboard` round-trip
expected: After viewing the hero animation once, navigating to `/dashboard` and back to `/`, the canvas does NOT replay the animation — module-level `behavioralHeroAnimationComplete` flag survives the SPA navigation.
result: [pending]

### 6. VoiceOver "87 percent" announcement
expected: With macOS VoiceOver enabled (Cmd+F5), navigating the hero region announces "87 percent confidence" exactly once (canvas is `aria-hidden`, chip provides the single accessible name).
result: [pending]

### 7. Davide sign-off on external component policy
expected: Read `.planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md`. Confirm the REJECT list (Magic UI / Aceternity / Origin UI / Cult UI + others) and ACCEPT list match Davide's intent.
result: [pending]

### 8. Davide sign-off on rendered hero copy verbatim
expected: Compare the rendered hero (live in browser) against the locked copy in `REQUIREMENTS.md` HERO-01 through HERO-05. Every string must match verbatim, including punctuation and casing.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
