---
phase: 02-hero-centerpiece-reading-explainer
plan: 03
subsystem: numen-landing-hero
tags: [hero, reading-loop, stage-reveal, reduced-motion, cta, lcp]
requires:
  - "src/components/numen/stage-reveal.tsx (StageBlock — the one motion)"
  - "src/components/numen-landing/verdict-throne.tsx (Wave 1 — final stage)"
  - "public/images/landing/hero/keyframe.webp (Wave 1 — real keyframe)"
  - "src/components/numen-landing/nav.tsx (FOCUS_RING + CTA contract)"
provides:
  - "HERO-01 — single-h1 hero text column (h1 + subhead + Try Numen CTA)"
  - "HERO-02 — full-bleed real keyframe artifact (LCP base layer)"
  - "HERO-04 — calm stage-reveal loop + reduced-motion static end-state"
  - "CTA-01 — Try Numen → #cta (label + href locked across nav/footer/hero)"
affects:
  - "src/app/(marketing)/page.tsx (renders <Hero /> in SectionShell id=hero)"
  - "Plan 02-04 explainer reuses ReadingLoop's stage-read line + VerdictThrone"
tech-stack:
  added: []
  patterns:
    - "Always-present keyframe base layer (LCP) + sequenced StageBlock overlays"
    - "Reduced-motion controller gate: init revealed=full + return before timer"
    - "vitest staticImageStub plugin → StaticImageData for next/image under test"
key-files:
  created:
    - "src/components/numen-landing/reading-loop.tsx"
    - "src/components/numen-landing/hero.tsx"
  modified:
    - "src/app/(marketing)/page.tsx"
    - "vitest.config.ts"
decisions:
  - "Keyframe is the always-present LCP base layer, NOT a revealed stage — paints on first render (UI-SPEC LCP note); only the stage-read line + VerdictThrone reveal as overlays."
  - "Loop driven by recursive setTimeout (not setInterval) so the verdict stage can dwell longer (VERDICT_DWELL_MS 4.6s) than non-verdict steps (STEP_MS 2.2s)."
  - "Static-image import contract kept (key_links): added a vitest staticImageStub plugin mirroring Next's bundler StaticImageData rather than forking to a string src."
metrics:
  duration: ~14m
  completed: 2026-06-12
  tasks: 2
  files: 4
---

# Phase 02 Plan 03: Hero Centerpiece & Reading Loop Summary

The hero now renders a single-h1 text column with the locked **Try Numen → #cta** CTA above a full-bleed **ReadingLoop**: the real creator keyframe paints first (LCP base layer), then a real stage-read line and the **VerdictThrone** reveal in sequence via `StageBlock` as a calm auto-loop that dwells on the verdict; under `prefers-reduced-motion` the completed end-state paints at rest with no auto-cycle and no translate (HERO-01/HERO-02/HERO-04/CTA-01).

## What Was Built

**Task 1 — `reading-loop.tsx` (HERO-02 / HERO-04)** — commit `fc7e0cbe`
- `"use client"` controller importing `StageBlock` from `@/components/numen/stage-reveal` and `useReducedMotion` from `motion/react`.
- Static-imports the keyframe (`@/../public/images/landing/hero/keyframe.webp`), rendered via `next/image` with `preload` (NOT the deprecated `priority`) + `placeholder="blur"`.
- Two overlay stages (real stage-read line → `<VerdictThrone />`) reveal in sequence; the loop resets and replays, dwelling ~4.6s on the verdict.
- **HERO-04 HARD:** under reduced motion the controller `return`s before any timer AND inits `revealed = OVERLAYS.length`, so the end-state paints directly — no interval, no flicker, no translate. Asserted by `reading-loop.test.tsx` (mock `useReducedMotion => true`).

**Task 2 — `hero.tsx` (HERO-01 / CTA-01)** — commit `530192d9`
- `"use client"` column lifting the h1 / subhead / CTA from the inline `page.tsx` block; `FOCUS_RING` copied verbatim from `nav.tsx:30-31`.
- CTA `<Link href="#cta">Try Numen</Link>` with `h-11` (≥44px) + focus ring; label + href locked to match nav/footer. No `/analyze` deep-link.
- Mounts `<ReadingLoop />` as the one deliberate full-bleed break. `page.tsx` now renders `<Hero />` inside `SectionShell id="hero"` with no `heading=` prop (single-h1, D-10).

## Verification

- `pnpm test -- reading-loop hero` — **GREEN** (6 tests: 2 reading-loop + 4 hero).
- `pnpm exec tsc --noEmit` — no errors in the changed files.
- `pnpm exec eslint` on all changed files — no issues.
- Remaining repo-wide test failures (`how-it-works.test.tsx`, `voice.test.tsx`) are **out of scope** — they depend on `@/components/numen-landing/how-it-works`, the Plan 02-04 deliverable (READ-01/READ-02). Both were RED before this plan started.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] next/image static import had no dimensions under vitest**
- **Found during:** Task 1 (first GREEN run).
- **Issue:** Vite resolves a `.webp` import to a bare URL string with no width/height, so `next/image` threw "missing required width" in the test env. Next's bundler normally injects `StaticImageData` ({ src, width, height, blurDataURL }); vitest has no equivalent transform.
- **Fix:** Added a `staticImageStub` vite plugin in `vitest.config.ts` that returns a dimensioned `StaticImageData`-shaped module for `.png/.jpg/.webp/.avif/.gif` imports — mirroring the production bundler. Keeps the static-import contract (`key_links`) intact rather than forking to a string `src` + manual width/height.
- **Files modified:** `vitest.config.ts`
- **Commit:** `fc7e0cbe`

**2. [Rule 1 - Bug] Keyframe `<img>` not rendered on initial paint under live motion**
- **Found during:** Task 2 (hero.test.tsx, which intentionally does NOT mock `useReducedMotion`).
- **Issue:** Originally the keyframe was stage 0 inside a `StageBlock` gated by `revealed`. In motion mode `revealed` starts at 0, so `AnimatePresence` rendered no `<img>` on first paint — failing the HERO-02 asset assertion and, worse, meaning the LCP element would not paint until the loop hydrated.
- **Fix:** Promoted the keyframe to an always-present base layer (renders on first paint = fast LCP, reserves height = zero CLS, per UI-SPEC LCP note); only the stage-read line + verdict throne remain as sequenced `StageBlock` overlays. Reduced-motion semantics unchanged (verdict shown at rest, no translate).
- **Files modified:** `src/components/numen-landing/reading-loop.tsx`
- **Commit:** `530192d9`

## Threat Model Compliance

- **T-02-04** (reading-loop auto-cycle / vestibular harm) — mitigated: reduced-motion gate returns before any timer + paints the static end-state; asserted by `reading-loop.test.tsx`.
- **T-02-05** (hero copy tampering) — mitigated: all copy is static JSX literals via React escaping; no `dangerouslySetInnerHTML`.

## Known Stubs

None — both components render real content (real keyframe, real verdict band + why). The stage-read line copy is final-shaped VOICE-clean prose (refinable per D-08a), not a placeholder.

## Self-Check: PASSED

- FOUND: `src/components/numen-landing/reading-loop.tsx` (114 lines)
- FOUND: `src/components/numen-landing/hero.tsx` (56 lines)
- FOUND: commit `fc7e0cbe` (Task 1)
- FOUND: commit `530192d9` (Task 2)
- No unexpected file deletions in either commit.
