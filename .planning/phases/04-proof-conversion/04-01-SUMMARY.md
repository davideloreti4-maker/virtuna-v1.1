---
phase: 04-proof-conversion
plan: "01"
subsystem: marketing/proof
tags: [proof, social-proof, testimonials, rsc, flat-warm, tdd]
dependency_graph:
  requires: [04-00]
  provides: [SocialProofStrip, TestimonialCard, Testimonials]
  affects: [04-05]
tech_stack:
  added: []
  patterns:
    - Pure RSC composition (no use client)
    - Marquee aria-hidden wrapper for a11y (Pitfall 4 fix)
    - Named StaggerRevealItem import over StaggerReveal.Item (Pitfall 1 fix)
    - Bespoke flat-warm card surface (D-07 anatomy)
key_files:
  created:
    - src/components/marketing/proof/social-proof-strip.tsx
    - src/components/marketing/proof/testimonial-card.tsx
    - src/components/marketing/proof/testimonials.tsx
  modified: []
decisions:
  - "Marquee aria-hidden wrapper applied at the marquee container level — entire logo wall hidden from a11y tree, trust stat text carries accessible meaning"
  - "6 logo placeholder slots in marquee (not the minimum 4) for denser visual rhythm"
  - "testimonial-card uses article + blockquote semantics per HTML spec for quotation content"
  - "3 fictional testimonials with drafted quotes, @handles, and result metrics (T-04-01-01 accept — no real PII)"
metrics:
  duration: "~5min"
  completed: "2026-06-15T17:39:35Z"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 04 Plan 01: Social Proof + Testimonials — Summary

**One-liner:** Bespoke flat-warm SocialProofStrip (trust stat + aria-hidden marquee) and Testimonials 3-card grid (D-07 anatomy, data-testid conversion levers) as pure RSC; PROOF-01 + PROOF-02 RED tests turned GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Social-proof strip (PROOF-01) | 013f8076 | src/components/marketing/proof/social-proof-strip.tsx |
| 2 | Testimonial card + 3-card grid (PROOF-02) | 64e82b5e | src/components/marketing/proof/testimonial-card.tsx, testimonials.tsx |

## What Was Built

### SocialProofStrip (PROOF-01)

- Peer-count trust stat: "Join 2,000+ creators already running Numen Simulations" — the accessible name of the strip (swappable D-04).
- 6x `<Placeholder variant="logo" aspect="3/1">` slots in a `<Marquee pauseOnHover>` — neutral creator/brand swap placeholders, NOT real platform marks.
- Entire `<Marquee>` region wrapped in `aria-hidden="true"` — Pitfall 4 fix (Marquee repeats children 4 times; screen reader reads logo wall once).
- Pure RSC, flat-warm cream tokens, no coral, no glass/glow/blur, no serif.

### TestimonialCard (PROOF-02)

- D-07 bespoke anatomy: `<article>` outer card (rounded-[--radius-lg], border-border, bg-transparent, p-6, white-5% inset boxShadow).
- `<blockquote>` quote in text-foreground-secondary.
- Result metric in text-foreground font-medium with `data-testid="testimonial-metric"` — conversion lever (D-21).
- Identity row: `<Placeholder variant="avatar">` + name (text-foreground) + @handle (text-foreground-muted) with `data-testid="testimonial-handle"`.
- Zero import from `ui/testimonial-card` (cold-brand LANDMINE / Pitfall 2 avoided).

### Testimonials (PROOF-02)

- Static 3-card grid (grid-cols-1 md:grid-cols-3) — NOT a carousel (D-06).
- EXACTLY 3 fictional TESTIMONIALS entries (drafted copy, plausible metrics: "+2.3M views", "3× hook completion rate", "First 100k-view post").
- Named `StaggerRevealItem` import from `@/components/motion` — Pitfall 1 fix (StaggerReveal.Item undefined across RSC boundary).
- Sans-serif h2 "What creators say" (serif reserved to hero + band close-line, D-13).

## Verification Results

- PROOF-01: 3/3 tests green
- PROOF-02: 3/3 tests green
- Full PROOF suite: 6/6 tests green
- No `"use client"` in any of the 3 files (pure RSC)
- `aria-hidden="true"` wraps marquee region ✓
- Exactly 3 avatar placeholders, 3 testimonial-handle, 3 testimonial-metric nodes ✓
- Token violations grep: clean (no text-white, no hex, no text-accent, no backdrop-blur, no drop-shadow)
- page.tsx untouched (04-05 owns wiring) ✓
- marketing barrel untouched ✓

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

| File | Content | Reason |
|------|---------|--------|
| social-proof-strip.tsx | 6x logo Placeholder slots (no real logos) | D-03 / FOUND-03 — real brand logos swapped in post-launch via `src` prop |
| testimonials.tsx | 3 fictional testimonial entries with drafted copy | T-04-01-01 accept — no real PII; swapped for real creator testimonials post-launch |
| testimonial-card.tsx | Placeholder variant="avatar" (no real avatar photos) | FOUND-03 — real creator photos swapped in via `src` prop post-launch |

These stubs are intentional by design (FOUND-03 placeholder-slot system). They do not prevent the plan's goal: PROOF-01 + PROOF-02 components exist, are correctly structured, and tests pass.

## Threat Surface Scan

No new threat surface beyond what's in the plan's threat model. All three files are:
- Static presentational RSC (no input, no auth, no network, no data fetch)
- Use plain string children only (no dangerouslySetInnerHTML — T-04-01-02 mitigated by construction)
- Zero package installs (T-04-SC accept)

## Self-Check: PASSED

- [x] src/components/marketing/proof/social-proof-strip.tsx — exists
- [x] src/components/marketing/proof/testimonial-card.tsx — exists
- [x] src/components/marketing/proof/testimonials.tsx — exists
- [x] commit 013f8076 — exists
- [x] commit 64e82b5e — exists
