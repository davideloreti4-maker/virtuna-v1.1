---
phase: 04-proof-conversion
plan: "05"
subsystem: marketing/page
tags: [integration, page-assembly, D-18, rsc, static, barrel]
dependency_graph:
  requires: [04-00, 04-01, 04-02, 04-03, 04-04]
  provides: [PROOF-01, PROOF-02, CONVERT-01, CONVERT-02, CONVERT-03]
  affects: []
tech_stack:
  added: []
  patterns:
    - RSC barrel extension (named export appends)
    - RSC page assembly — pure server component, D-18 section order
    - Full-bleed section pattern (no max-w-5xl, D-12)
    - Thin trust-strip padding override (py-8/py-10 for social-proof)
key_files:
  created: []
  modified:
    - src/components/marketing/index.ts
    - src/app/(marketing)/page.tsx
decisions:
  - "Social-proof strip uses tighter vertical padding (py-8 md:py-10) — it is a thin trust bar, not a full-measure section"
  - "FinalCtaBand section carries NO max-w-5xl inner measure per D-12 — bare <section data-section=final-cta> wraps it"
  - "NAV_LINKS unchanged at exactly 5 entries (D-19); #social-proof, #testimonials, and final-cta carry no nav anchors"
  - "page.tsx pure RSC — FAQ accordion is the only client island (nested under RSC Faq wrapper), / stays ○ static"
metrics:
  duration: ~5min
  completed: "2026-06-15T19:00:00Z"
  tasks_completed: 2
  files_created: 0
  files_modified: 2
---

# Phase 04 Plan 05: Integration Assembly — Summary

**One-liner:** Marketing barrel extended with 5 Phase-4 sections; page.tsx wired in locked D-18 order (social-proof strip + testimonials inserted, pricing/FAQ stubs filled, full-bleed CTA band before footer) — page-order RED block GREEN, / stays ○ static.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend marketing barrel with 5 new section exports | 39561620 | src/components/marketing/index.ts |
| 2 | Wire 5 sections into page.tsx in D-18 order + static-build gate | 3b32295c | src/app/(marketing)/page.tsx |

## What Was Built

### Task 1 — Barrel extension

Appended 5 named exports to `src/components/marketing/index.ts` after the existing story exports:

- `SocialProofStrip` from `./proof/social-proof-strip`
- `Testimonials` from `./proof/testimonials`
- `PricingTeaser` from `./pricing/pricing-teaser`
- `Faq` from `./faq/faq`
- `FinalCtaBand` from `./cta/final-cta-band`

No leaf-primitive re-exports added. Existing exports (Hero, HowItWorks, SimulationShowcase, FeatureBlocks, Placeholder, MotionConfigShell) unchanged.

### Task 2 — page.tsx assembly

D-18 section order (locked, now fully assembled):

```
#hero → #social-proof (SocialProofStrip, py-8/py-10 strip) →
#how-it-works → #the-simulation → #features →
#testimonials (Testimonials, full locked rhythm) →
#pricing (PricingTeaser, stub filled) →
#faq (Faq, stub filled — FaqAccordion client island) →
data-section="final-cta" (FinalCtaBand, full-bleed, no max-w-5xl)
→ Footer
```

Page docblock refreshed to describe the complete Phase-4 scroll and D-18 order.

## Verification Results

- `page-order.test.tsx`: **4/4 GREEN** — D-18 order + D-19 NAV-lock both pass
- Full test suite: **2005 PASS / 0 FAIL** (26 skipped pre-existing)
- `npm run build`: **exits 0**, route table shows `○ /` (static prerender held)
- page.tsx `"use client"` directive: **0** (comment mention only — build confirms pure RSC)
- NAV_LINKS: **exactly 5 entries** (asserted by page-order test)
- `#pricing` and `#faq` stubs filled in place; full-bleed band has no `max-w-5xl` (D-12)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

Stubs inherited from Wave-1 plans (documented in 04-01 through 04-04 SUMMARYs):

| File | Content | Reason |
|------|---------|--------|
| social-proof-strip.tsx | 6x logo Placeholder slots | D-03 / FOUND-03 — swap real logos post-launch |
| testimonials.tsx | 3 fictional testimonial entries | T-04-01-01 accept — swap real creator testimonials post-launch |
| pricing-teaser.tsx | $19 Pro price placeholder | D-09 — one-prop change post-pricing confirmation |

These stubs are pre-existing (from 04-01/04-02) and do not prevent the plan's goal: all 5 sections render correctly on `/` in the locked D-18 order.

## Threat Surface Scan

No new threat surface. This plan is assembly-only (2 file edits, 0 installs):
- T-04-05-01 (client leak): mitigated — `○ /` build gate held; FAQ accordion nested as island under RSC Faq wrapper
- T-04-05-02 (NAV tampering): mitigated — `src/lib/nav.ts` untouched, page-order test asserts `NAV_LINKS.length === 5`
- T-04-05-03 (CTA redirect): mitigated — all CTAs route to hardcoded internal `SIGNUP_URL = "/signup"`

## Self-Check: PASSED

- [x] `src/components/marketing/index.ts` modified — exports all 5 new sections
- [x] `src/app/(marketing)/page.tsx` modified — D-18 order, all stubs filled
- [x] Commit `39561620` — exists
- [x] Commit `3b32295c` — exists
- [x] page-order test 4/4 GREEN
- [x] Full suite 2005 PASS
- [x] Build gate `○ /` confirmed
