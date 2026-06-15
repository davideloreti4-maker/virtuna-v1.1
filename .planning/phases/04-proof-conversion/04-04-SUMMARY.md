---
phase: 04-proof-conversion
plan: "04"
subsystem: marketing/cta
tags: [cta, serif, conversion, skeleton, rsc]
dependency_graph:
  requires: [04-00]
  provides: [CONVERT-02]
  affects: [04-05]
tech_stack:
  added: []
  patterns:
    - FinalCtaBand pure RSC — no client directive
    - Button asChild → Link composition for CTA
    - ScoreGaugeSkeleton reuse (D-14 — no new bespoke visual)
    - Legal warm-seat radial (verbatim from hero/showcase precedent)
key_files:
  created:
    - src/components/marketing/cta/final-cta-band.tsx
  modified: []
decisions:
  - D-12: FinalCtaBand owns its own full-bleed surface; 04-05 mounts it in a bare <section>
  - D-13: Newsreader serif close-line is Phase 4's single serif moment (mirrors hero H1 font-serif token)
  - D-14: ScoreGaugeSkeleton echo (opacity-70 scale-75) reuses the Phase-3 primitive; no new bespoke visual
  - D-20: "Free to start — no credit card" microcopy under the dominant CTA
metrics:
  duration: ~4min
  completed: "2026-06-15"
  tasks_completed: 1
  files_changed: 1
---

# Phase 04 Plan 04: FinalCtaBand — CONVERT-02 Summary

**One-liner:** Full-bleed serif closing band with Newsreader close-line, coral /signup CTA, risk-reducer microcopy, and muted ScoreGaugeSkeleton echo on a flat-warm cream tone-step surface.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Final full-width CTA band — CONVERT-02 | f76bbb04 | src/components/marketing/cta/final-cta-band.tsx |

## Verification

- CONVERT-02: 3/3 tests GREEN (`npx vitest run src/components/marketing/cta/`)
- No `"use client"` — pure RSC confirmed
- `data-testid="cta-close-line"` present on the Newsreader serif h2
- `href="/signup"` CTA via `Button asChild` + `Link`
- `ScoreGaugeSkeleton` renders with `role="img" aria-label="Virality score (sample)"`
- Warm radial = low-alpha cream tone-step `rgba(236,231,222,0.07)` — no coral in the radial
- No `backdrop-blur`, `drop-shadow`, or glow in any className/style prop (comment-only mentions confirmed false-positive)
- Coral confined to the CTA Button (variant="primary")
- page.tsx and barrel UNTOUCHED (04-05 owns wiring)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — FinalCtaBand has no data source; it is pure static marketing copy + the ScoreGaugeSkeleton (intentional fixed-87 skeleton). No dynamic data paths.

## Threat Flags

No new security surface. The CTA target is the hardcoded internal `SIGNUP_URL = "/signup"` — no user-controlled redirect. T-04-04-01 mitigated by construction. T-04-04-03 mitigated — plain string children, React escapes by default.

## Self-Check: PASSED

- `src/components/marketing/cta/final-cta-band.tsx` exists: FOUND
- Commit f76bbb04 exists: FOUND
- CONVERT-02 3/3 GREEN: CONFIRMED
