---
phase: 03-honesty-moat-gallery-proof-conversion
plan: 03
subsystem: numen-landing
tags: [gallery, verdict-throne, luma, honesty-moat, GALLERY-01, GALLERY-02, CONTENT-02]
requires:
  - "VerdictThrone (Plan 02-02) — parametrized here"
  - "VerdictSwatch / Surface / PillChip (Numen kit primitives)"
  - "public/images/landing/hero/keyframe.webp (Plan 02-02 real still)"
  - "reading-gallery.test.tsx (Plan 03-01 RED scaffold)"
provides:
  - "ReadingGallery — #gallery luma grid, >=3 Surface cards, verdict RANGE + niche tags"
  - "VerdictThrone parametrized (verdict/label/why) — band+why+plate contract in one place"
affects:
  - "page.tsx #gallery slot (Wave-3 wiring — not done here)"
  - "voice.test.tsx gallery slice (now VOICE-clean; gate stays RED until Plan 03-05 ships social-proof/proof-strip/cta-section)"
tech-stack:
  added: []
  patterns:
    - "parametrized presentational component with Phase-2 copy as defaults (no-props output preserved)"
    - "typed card-data array .map over >=3 entries to span the verdict range"
    - "opaque Surface plate + next/image (placeholder=blur) — never glass-over-photo"
key-files:
  created:
    - src/components/numen-landing/reading-gallery.tsx
  modified:
    - src/components/numen-landing/verdict-throne.tsx
decisions:
  - "D-07 placeholder posture (user-resolved checkpoint): user chose 'proceed with placeholders' — no new image files created; all 4 gallery cards reuse the real hero/keyframe.webp, varied per card via distinct niche/verdict/why. Rights-cleared >=3-niche asset set deferred to Phase 4 (D-L4)."
  - "VerdictThrone parametrized via option (a) — verdict/label/why props default to Phase-2 good copy, keeping the band+why+plate contract in ONE place (UI-SPEC §Color reuse caveat preferred path)."
  - "4 cards (UI-SPEC recommended default) across 4 niches (Comedy/Fitness/Cooking/Beauty) spanning good/mixed/bad — honesty by breadth, not all-good."
metrics:
  duration: ~3m
  completed: 2026-06-12
  tasks: 3
  files: 2
---

# Phase 03 Plan 03: Reading Gallery + Parametrized VerdictThrone Summary

Built the `#gallery` luma real-Readings grid (4 Surface cards across 4 niches spanning a good/mixed/bad verdict RANGE for honesty by breadth) and parametrized `VerdictThrone` so the band+why+plate contract lives in one place while cards vary.

## What Shipped

- **Task 1 — VerdictThrone parametrized** (`c19330a3`): added optional `verdict` / `label` / `why` props defaulting to the Phase-2 good-band copy. `verdict` forwards to `VerdictSwatch verdict={verdict}` (literal classes, no `bg-${verdict}` interpolation). No-props output is byte-identical in intent, so the hero loop, how-it-works step 3, and the voice gate render unchanged. The SOLID `bg-panel`/`border-border` plate + APCA doc rationale preserved for all three bands.
- **Task 2 — niche stills checkpoint (D-07, NON-BLOCKING)**: pre-resolved by the user as **"proceed with placeholders."** No image files created; Task 3 reuses the existing real `hero/keyframe.webp` across all cards. Rights-cleared >=3-niche asset set deferred to Phase 4 (D-L4).
- **Task 3 — reading-gallery.tsx** (`aa141e61`): static RSC `ReadingGallery()` — a `mt-6 md:mt-8` honest-breadth lead `<p>` + a `mt-8 grid gap-6 md:grid-cols-3 md:gap-8` grid of 4 `Surface` cards. Each card = opaque Surface plate → `next/image` still (placeholder=blur) → `VerdictThrone` band+label+why → `PillChip` niche tag. Verdict range: Comedy=good, Fitness=mixed, Cooking=bad, Beauty=good (one of each minimum satisfied). Emits no heading (the `#gallery` h2 is on the SectionShell slot).

## Verification

- `reading-gallery.test.tsx` GREEN 2/2 (>=3 imgs, every img non-empty alt, all three `bg-verdict-good/mixed/bad` tokens present).
- `verdict-throne.test.tsx` GREEN 3/3 (no-props "land" + "hook" + no naked number — unchanged).
- `hero.test.tsx` GREEN (no-props VerdictThrone call site unaffected).
- `tsc --noEmit` — no errors in gallery/throne.
- Gallery copy banned-token scan: CLEAN (no `%`/viral/guaranteed/engine jargon — VOICE Rules 1-3).
- Acceptance greps: VerdictThrone usage x4, no empty alts, no glass/backdrop in markup, no hex, no h1/h2 in markup (the 3 stray grep hits are doc-comment references only, confirmed).

## Deviations from Plan

None — plan executed as written. The Task 2 checkpoint was pre-resolved (placeholders) per the orchestrator; no autonomous deviation rules triggered.

## Out of Scope / Expected RED

- **voice.test.tsx** fails at module-resolution because it imports `social-proof`, `proof-strip`, and `cta-section` — those components ship in **Plan 03-05** (per the Plan 02-04 / 03-02 notes, the voice gate is expected RED until Plans 03/05 ship all five copy-bearing components). The gallery's own copy is VOICE-clean; the gallery slice will pass once the missing modules exist. Not in this plan's scope.
- `#gallery` page.tsx slot wiring is a Wave-3 step, not this plan.

## Known Stubs

- **D-07 placeholder stills** (intentional, user-approved): all 4 gallery cards reuse `hero/keyframe.webp` rather than 4 distinct real stills. Resolved by Phase 4 (D-L4 rights-cleared asset set). The gallery is structurally complete and never renders an empty state.

## Self-Check: PASSED

- FOUND: src/components/numen-landing/reading-gallery.tsx
- FOUND: src/components/numen-landing/verdict-throne.tsx (modified)
- FOUND commit: c19330a3 (Task 1)
- FOUND commit: aa141e61 (Task 3)
