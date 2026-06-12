---
phase: 02-hero-centerpiece-reading-explainer
plan: 02
subsystem: numen-landing
tags: [hero, verdict-throne, HERO-02, HERO-03, voice-rule-3, apca]
requires:
  - "@/components/numen/verdict-swatch (VerdictSwatch — band base)"
  - "@/components/numen/surface (bg-panel plate reference)"
  - ".numen-surface token layer (text-text, text-text-muted, border-border, bg-panel, bg-verdict-good)"
provides:
  - "public/images/landing/hero/keyframe.webp — the ONE real creator keyframe (HERO-02 authenticity asset)"
  - "src/components/numen-landing/verdict-throne.tsx — VerdictThrone (HERO-03 band + label + why)"
affects:
  - "Wave 2 hero loop (reuses VerdictThrone + keyframe)"
  - "Wave 3 explainer step 3 (reuses VerdictThrone)"
tech-stack:
  added: []
  patterns:
    - "Presentational RSC-safe component (no use client)"
    - "Reuse VerdictSwatch literal classes — never bg-${verdict} interpolation"
    - "bg-panel solid plate for APCA legibility (not glass-over-photo)"
key-files:
  created:
    - public/images/landing/hero/keyframe.webp
    - src/components/numen-landing/verdict-throne.tsx
  modified: []
decisions:
  - "Plan 02-02: VerdictThrone label sits on a bg-panel/border-border plate (APCA gate FAIL: verdict-good label #f0ebe3 on band #7faf7a = Lc 41.8 < 60), not directly on the band, not glass-over-photo."
  - "Keyframe niche = relatable comedy skit (drives the verdict why register); rights = placeholder per user 'for now'."
metrics:
  duration: 6m
  completed: 2026-06-12
---

# Phase 02 Plan 02: Hero Keyframe + Verdict Throne Summary

Landed the ONE real creator keyframe (HERO-02 authenticity asset) and built the presentational `VerdictThrone` (HERO-03) — good band + confident label + specific one-line why on a `bg-panel` plate — reusable by Wave 2's hero loop and Wave 3's explainer step 3.

## What Shipped

- **Task 1 (checkpoint, satisfied):** `public/images/landing/hero/keyframe.webp` — a real, rights-clear creator-video still (720×1280, vertical 9:16, relatable comedy-skit niche). Human-supplied per the blocking human-verify checkpoint; NOT stock, NOT fake browser chrome, NOT a fabricated diagram.
- **Task 2 (auto):** `src/components/numen-landing/verdict-throne.tsx` — presentational `VerdictThrone`:
  - Renders `VerdictSwatch verdict="good" size="md"` + bold label `"This will likely land."` + muted why `"Strong hook in the first 2 seconds — tighten the middle and it lands."`
  - Backed on a SOLID `rounded-[12px] border border-border bg-panel p-4 md:p-6` plate (APCA gate forced it).
  - Optional `className` merged LAST via `cn()` so the hero/explainer can size/position.
  - Zero naked numbers/percentages (VOICE Rule 3); all color via token names, no hex in JSX.

## APCA Gate Result

`pnpm tsx scripts/check-apca.ts` ran. On-band pairing FAILED as expected:
`verdict-good-label #f0ebe3` on band `#7faf7a` = **Lc 41.8 < 60** → throne uses the `bg-panel` plate; the label sits on the opaque plate, never directly on the band. (All other base-on-#1a1714 pairings PASS.)

## Verification

- `pnpm exec vitest run src/components/numen-landing/__tests__/verdict-throne.test.tsx` → **3 PASS / 0 FAIL** (GREEN): label renders ("land"), why renders ("hook"), no naked number `\d+/100|\d+%`.
- `pnpm tsx scripts/check-apca.ts` runs; throne composition (plate-backed) matches its label-on-band FAIL result.

## Deviations from Plan

None — plan executed exactly as written. The APCA gate result and the plate decision were both pre-resolved in the prompt context and matched the live `check-apca.ts` run.

## Out-of-Scope Note (not a deviation)

The full `pnpm test` suite shows 4 failing test files — these are the **expected Wave-0 RED scaffolds** from Plan 02-01 (`hero.test`, `how-it-works.test`, `voice.test`, `stage-reveal.test`) that import not-yet-built Wave 2/3 components (`@/components/numen-landing/hero`, `how-it-works`). They are out of scope for Plan 02-02 (which builds only the throne) and will go GREEN when Waves 2–3 ship. This plan's own test (`verdict-throne.test`) is GREEN.

## Self-Check: PASSED

- FOUND: public/images/landing/hero/keyframe.webp
- FOUND: src/components/numen-landing/verdict-throne.tsx
- FOUND commit: 31b352ef (keyframe)
- FOUND commit: ee11b0c3 (verdict throne)
