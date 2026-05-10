# Phase 02 — Deferred Items

Items discovered during execution that are out of scope for the current plan.

## From Plan 02-02 (BehavioralCanvas + constants + Vitest)

### Pre-existing lint-vocab violations (NOT introduced by Plan 02-02)

`pnpm lint:vocab` reports 57 errors and 3 warnings in baseline files that existed before the Phase 2 milestone began (commit e0fd76d). These are NOT touched by Plan 02-02 and are owned by a later plan in this phase / future phase.

Affected files:

- `src/app/opengraph-image.tsx` (lines 61, 72) — banned terms in OG image text
- `src/components/landing/comparison-chart.tsx:26` — banned term
- `src/components/landing/cta-section.tsx:11` — banned term
- `src/components/landing/faq-section.tsx` (lines 17, 19) — banned terms
- `src/components/landing/hero-section.tsx` (lines 37, 55) — banned terms (this file is being REPLACED by Plan 04 with `BehavioralHero.tsx`)
- `src/components/landing/social-proof-section.tsx:24` — banned term
- `src/components/landing/stats-section.tsx` (lines 15, 32) — banned terms
- `src/components/onboarding/goal-step.tsx` (lines 22, 23) — banned terms
- `src/components/onboarding/preview-step.tsx` (lines 19, 24) — banned terms

**Owner:** Plan 06 BUILD-09 ("Replace plagiarized Artificial Societies copy across all surfaces") explicitly tracks rewriting these files.

**Plan 02 contribution:** Zero violations introduced. New file `src/components/landing/behavioral-hero-constants.ts` and `src/components/landing/BehavioralCanvas.tsx` lint clean when checked individually.

**Verification command for new file isolation:**

```bash
node scripts/lint-vocab.mjs src/components/landing/behavioral-hero-constants.ts
node scripts/lint-vocab.mjs src/components/landing/BehavioralCanvas.tsx
```

Both should report `0 error(s), 0 warning(s)`.
