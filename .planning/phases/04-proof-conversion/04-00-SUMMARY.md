---
phase: 04-proof-conversion
plan: "00"
subsystem: marketing-tests
tags: [nyquist, tdd, wave-0, red-scaffold, marketing]
dependency_graph:
  requires: []
  provides:
    - PROOF-01 gate (social-proof-strip.test.tsx)
    - PROOF-02 gate (testimonials.test.tsx)
    - CONVERT-01 gate (pricing-teaser.test.tsx)
    - CONVERT-02 gate (final-cta-band.test.tsx)
    - CONVERT-03 gate (faq.test.tsx)
    - D-18 order + D-19 nav lock (page-order.test.tsx)
  affects:
    - src/components/marketing/proof/ (Wave 1 turns PROOF tests GREEN)
    - src/components/marketing/pricing/ (Wave 1 turns CONVERT-01 GREEN)
    - src/components/marketing/faq/ (Wave 1 turns CONVERT-03 GREEN)
    - src/components/marketing/cta/ (Wave 1 turns CONVERT-02 GREEN)
    - src/app/(marketing)/page.tsx (04-05 turns D-18 order block GREEN)
tech_stack:
  added: []
  patterns:
    - "happy-dom pragma on line 1 of every component test"
    - "RED-by-design module-not-found = Wave-0 success signal"
    - "data-testid anchors (testimonial-handle, testimonial-metric, cta-close-line, pricing-bullet) = Wave-1 integration contract"
    - "stable id/data-section markers (social-proof, testimonials, final-cta) = 04-05 integration contract"
key_files:
  created:
    - src/components/marketing/proof/__tests__/social-proof-strip.test.tsx
    - src/components/marketing/proof/__tests__/testimonials.test.tsx
    - src/components/marketing/pricing/__tests__/pricing-teaser.test.tsx
    - src/components/marketing/faq/__tests__/faq.test.tsx
    - src/components/marketing/cta/__tests__/final-cta-band.test.tsx
    - src/components/marketing/__tests__/page-order.test.tsx
  modified: []
decisions:
  - "page-order.test.tsx NAV-unchanged block passes immediately (D-19 holds); D-18 order block is RED until 04-05 mounts new sections"
  - "data-testid anchors on testimonial-handle, testimonial-metric, cta-close-line, pricing-bullet are the Wave-1 contract — components MUST emit them"
  - "stable section ids (social-proof, testimonials) and band marker (data-section=final-cta) named in tests are the 04-05 integration contract"
metrics:
  duration: "~4 minutes"
  completed: "2026-06-15T17:34:13Z"
  tasks: 2
  files: 6
---

# Phase 04 Plan 00: Wave-0 Nyquist RED Test Scaffold Summary

One-liner: Six RED-by-design test files (5 section gates + 1 cross gate) establishing the automated feedback contract before any Wave-1 production code.

## What Was Built

Laid the Nyquist Wave-0 RED test scaffold for Phase 4, mirroring the `03-00` pattern. Created exactly one failing test file per Phase-4 section plus a cross test, all RED-by-design until Wave 1 builds the components.

### Task 1: 5 Section RED Test Files (commit 0e45a04e)

| File | Requirement | Key Assertions |
|------|-------------|----------------|
| `proof/__tests__/social-proof-strip.test.tsx` | PROOF-01 | trust stat `/2,?000\+? creators/i` + ≥4 `[data-variant="logo"]` + aria-hidden marquee wrapper |
| `proof/__tests__/testimonials.test.tsx` | PROOF-02 | exactly 3 `[data-variant="avatar"]` + ≥3 `[data-testid="testimonial-handle"]` + ≥3 `[data-testid="testimonial-metric"]` |
| `pricing/__tests__/pricing-teaser.test.tsx` | CONVERT-01 | Starter/Pro names + "Most popular" + ≥2 `/signup` links + 6–8 `[data-testid="pricing-bullet"]` + no off-site links |
| `faq/__tests__/faq.test.tsx` | CONVERT-03 | exactly 6 `role="button"` triggers + ≥6 `[data-state]` panels |
| `cta/__tests__/final-cta-band.test.tsx` | CONVERT-02 | ≥1 `/signup` link + `[data-testid="cta-close-line"]` + `role="img" name=/virality score/i` |

All 5 files are RED with `Failed to resolve import` — module-not-found is the Wave-0 success signal. Verified via scoped `npx vitest run` (5 suites failed, 0 assertion failures inside resolved modules).

### Task 2: Page-Order / NAV-Unchanged Cross Test (commit 530a76b2)

`marketing/__tests__/page-order.test.tsx` — two describe blocks:

**Block 1 — NAV-unchanged (D-19):** Asserts `NAV_LINKS.length === 5` + exact href set `{#how-it-works, #the-simulation, #features, #pricing, #faq}`. **Passes NOW** (2 tests green). Guards against Wave 1 / 04-05 accidentally adding a 6th nav entry.

**Block 2 — D-18 section order:** Imports `HomePage` and asserts relative DOM order of 8 section ids/markers. **RED NOW** (sections not yet mounted). Turns GREEN after 04-05 wires the new sections. Names the integration contracts Wave-1 + 04-05 must satisfy:
- `id="social-proof"` on SocialProofStrip's section
- `id="testimonials"` on Testimonials' section
- `data-section="final-cta"` on FinalCtaBand's section

## Verification

- All 6 files have `/** @vitest-environment happy-dom */` on line 1 (verified `head -1`)
- 5 section tests → RED via module-not-found (`npx vitest run proof/ pricing/ faq/ cta/` — 5 suites failed, 0 tests run)
- page-order NAV block → 2 tests PASS immediately
- page-order D-18 block → 2 tests FAIL (RED — sections not mounted, assertion errors confirm the correct behavior)
- No production component files created (Wave 0 test-only)
- All assertions use stable tokens / `data-variant` counts / roles / hrefs / `data-testid`, never full drafted sentences

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. This plan creates test files only; no production code.

## Threat Flags

None. Wave 0 creates test files only — no runtime surface, no input, no network.

## Self-Check: PASSED

- [x] `src/components/marketing/proof/__tests__/social-proof-strip.test.tsx` exists
- [x] `src/components/marketing/proof/__tests__/testimonials.test.tsx` exists
- [x] `src/components/marketing/pricing/__tests__/pricing-teaser.test.tsx` exists
- [x] `src/components/marketing/faq/__tests__/faq.test.tsx` exists
- [x] `src/components/marketing/cta/__tests__/final-cta-band.test.tsx` exists
- [x] `src/components/marketing/__tests__/page-order.test.tsx` exists
- [x] commit 0e45a04e exists (5 section tests)
- [x] commit 530a76b2 exists (page-order test)
