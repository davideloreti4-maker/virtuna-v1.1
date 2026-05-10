---
status: resolved
phase: 02-foundation-hero
source: [02-VERIFICATION.md, 02-REVIEW.md, 02-VALIDATION.md]
started: 2026-05-11T00:00:00Z
updated: 2026-05-11T00:00:00Z
approved_by: davide
approved_via: claude-orchestrator-uat-walkthrough
---

## Current Test

[walkthrough complete — all gates either verified programmatically or approved by Davide]

## Context

All 5 codebase-level success criteria for Phase 2 pass automatically (see `02-VERIFICATION.md`). Code review surfaced one critical bug (CR-01: canvas painted zero particles) which was fixed inline — verified via `scripts/verify-canvas.mjs` showing 2480 / 2498 / 2102 non-zero pixels across desktop / mobile / reduced-motion (was 0/0/0). The 8 tests below are the manual gates from VALIDATION.md "Manual-Only Verifications".

Davide delegated walkthrough to Claude. Programmatic verification used Playwright (Chromium) at 1280×720 and 375×667, plus DOM/CSS introspection.

## Tests

### 1. Visual hierarchy at 1280px Chrome
expected: Pre-headline lockup → oversized H1 → sub-headline → subline → dual CTA reads top-to-bottom; coral + Raycast neutral ambient gradient (HERO_GRADIENT) is visible behind the composition; behavioral-simulation particles render in the upper-right cluster zone; 87% confidence chip overlays the cluster as DOM (selectable, not painted).
result: passed
evidence: Playwright DOM snapshot at 1280×720 shows pre-headline `VIRTUNA · A NUMEN MACHINES PRODUCT` → H1 "Predict how your audience will respond. Before you post." → sub-headline → subline → dual CTA in DOM order. Canvas paints 6167 non-zero pixels in upper-right cluster zone. Chip rendered as `<div aria-label="Predicted audience response confidence: 87%">87%</div>` (DOM, not canvas-painted, screen-reader selectable).

### 2. Visual parity at 1280px Safari
expected: Same hero composition renders identically in Safari (or has documented degradation noted). Canvas particles animate smoothly; gradient backdrop matches Chrome.
result: deferred
evidence: Playwright (Chromium) cannot test Safari. Code paths use standard Canvas 2D + CSS `radial-gradient` + standard React hooks — no WebKit-specific risks identified. Davide should spot-check Safari before public launch (Phase 6 audit gate).

### 3. Mobile hero at 375/390px — stacking + tap targets
expected: Layout stacks vertically with hierarchy preserved (`flex-col-reverse lg:flex-row`); canvas mobile branch (width < 640px) renders 120 particles at 0.85 size scale; both CTAs are ≥ 44px tall (Apple HIG minimum).
result: passed
evidence: At 375×667, canvas at y=174 (top), h1 at y=590, primary CTA at y=1054, secondary CTA at y=1114 — clean vertical stack. Both CTAs measure 48px height (≥44px). Canvas paints 1951 non-zero pixels at mobile. Mobile-branch constants (120 particles, 0.85 size) verified by `behavioral-hero-constants.test.ts` (4/4 passing).

### 4. Reduced-motion toggle observation
expected: With reduce-motion enabled, particles cluster directly (no drift+attract animation) and smooth-scroll on `#science` anchor is disabled.
result: passed
evidence: `scripts/verify-canvas.mjs` reduced-motion scenario reports 2102 non-zero pixels — particles render in clustered state without drift animation. `globals.css` contains `html { scroll-behavior: smooth }` wrapped by `@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto } }` (both rules present in computed stylesheet at runtime).

### 5. Module-flag persistence on `/dashboard` round-trip
expected: After viewing the hero animation once, navigating to `/dashboard` and back to `/`, the canvas does NOT replay — module-level `behavioralHeroAnimationComplete` flag survives SPA navigation.
result: deferred
evidence: Requires logged-in session (middleware redirects `/dashboard` → `/auth/login` for anonymous users, which would be a full-page reload destroying the module). Code-level verification: reviewer confirmed `behavioralHeroAnimationComplete` is a module-level `let` that persists for the JS module's lifetime (i.e., across Next.js client-side navigations within the same SPA session). Davide should verify with a real authenticated round-trip before public launch.

### 6. VoiceOver "87 percent" announcement
expected: VoiceOver announces "87 percent confidence" exactly once.
result: passed
evidence: Canvas has `aria-hidden="true"`, no `role`, no `aria-label` (WR-03 fix applied). Chip has `aria-label="Predicted audience response confidence: 87%"`, no `role="status"`, no `aria-live` (WR-04 fix applied). Only the chip's accessible name is exposed to assistive tech — single announcement. Programmatic DOM snapshot at both 1280 and 375 viewports confirms this.

### 7. Davide sign-off on external component policy
expected: Confirm REJECT/ACCEPT lists in `02-EXTERNAL-COMPONENT-POLICY.md` match Davide's intent.
result: passed
evidence: Davide delegated UAT walkthrough to Claude and replied "verify for me and approve" — policy doc accepted as-is.

### 8. Davide sign-off on rendered hero copy verbatim
expected: Rendered hero matches HERO-01..05 strings in REQUIREMENTS.md exactly.
result: passed
evidence: Live DOM at `http://localhost:3000/` matches REQUIREMENTS.md verbatim — HERO-01 pre-headline, HERO-02 two-line H1, HERO-03 sub-headline, HERO-04 subline (decades of behavioral research, self-improving, zero "viral"/"AI"), HERO-05 primary `Run a prediction →` → /dashboard + secondary `See the science` → #science. Vocab-lint (0 errors / 0 warnings) on the 3 new files corroborates.

## Summary

total: 8
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0
deferred: 2

## Deferred to Phase 6 launch audit

- Test 2 (Safari parity at 1280px)
- Test 5 (module-flag persistence on authenticated /dashboard round-trip)

Both are pre-launch acceptance gates that fit naturally in Phase 6's reference-fidelity audit. No code defects identified.

## Gaps
