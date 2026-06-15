---
phase: 02-hero-signature-moment
plan: 02
subsystem: marketing-hero
tags: [hero, product-shot, device-frame, placeholder, flat-warm, rsc, pivot, no-cls]

# Dependency graph
requires:
  - phase: 02-hero-signature-moment
    provides: "02-01 RSC <Hero> (serif H1 + subcopy + CTA cluster) + the centered hero column the showcase mounts into"
  - phase: 01-foundation-shell
    provides: "<Placeholder> swappable slot (FOUND-03), flat-warm @theme tokens (surface/-elevated, background/-elevated, border, foreground-muted), shadow-float"
provides:
  - "Hero product-shot SHOWCASE: a flat-warm desktop browser window (the Numen reading = OUTPUT) with a phone in front (the TikTok = INPUT), reading left→right as paste → prediction"
  - "Two swappable <Placeholder> slots (desktop 16/10 'Numen reading' · phone 9/16 'Your TikTok') — real desktop/mobile screenshots or video drop in via the one `src` prop later"
  - "Permanent device chrome + depth set-dressing: slim browser bar (dots + numen.app pill), layered float shadows, hairline phone ring, faint warm radial seat"
affects: [03-proof-and-how, 05-hardening-responsive-perf-a11y]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Product-shot hero (OpusClip/Vercel pattern): show the product itself in device chrome rather than an abstract effect"
    - "Device frames as set-dressing + <Placeholder> as the swappable screen slot — frames are permanent, screens swap to real assets via `src` (FOUND-03)"
    - "Depth via layered matte black shadows + a faint cream radial 'seat' (NO glow/colored bloom — flat-warm); window frame = lightest surface so it floats on the darker page"
    - "Phone is a SIBLING of the overflow-hidden window (not a child) so it overflows the corner cleanly; its own deeper shadow + ring read as 'in front'"

key-files:
  created: []
  modified:
    - "src/components/marketing/hero/hero.tsx"
    - "src/components/marketing/hero/__tests__/hero.test.tsx"
  deleted:
    - "src/components/marketing/hero/signature-canvas.tsx (the rejected canvas moment)"
    - "src/components/marketing/hero/signature-moment-client.tsx (ssr:false boundary — no longer needed)"
    - "src/components/marketing/hero/composed-still.tsx (the SVG still — superseded)"
    - "src/components/marketing/hero/hero-constants.ts (score/particle/timing — superseded)"
    - "src/components/marketing/hero/__tests__/{composed-still,signature-moment-client,hero-constants}.test.* (tests for deleted components)"

key-decisions:
  - "PIVOT: the bespoke canvas 'crowd → score' signature moment (02-02 Task 1, commit 7fc9ec77) was REJECTED at the blocking human craft-verify — it read as a screensaver/tech-demo (420-particle cloud, doubled rough ring, unbounded particles, text collision), not a premium product hero."
  - "New direction (user-chosen): SHOW THE PRODUCT, like OpusClip/Vercel/sandcastles — a desktop reading window with the TikTok phone in front. The phone (input) → desktop (output) tells the whole pitch in one frame and represents both surfaces."
  - "Screens stay swappable <Placeholder> slots (FOUND-03): real desktop + mobile screenshots/video drop in once numen-rework ships. The device chrome + depth is the permanent craft."
  - "Hero is now FULLY STATIC (pure RSC, no client island, no canvas) — so HERO-04's reduced-motion/lazy-fallback concern is satisfied by construction (nothing to fall back from; no-CLS via aspect-locked Placeholders)."
  - "Removed all canvas machinery (canvas, ssr:false boundary, ComposedStill, hero-constants) + their 02-00 Nyquist suites; re-scoped hero.test.tsx to gate the new showcase (slots + browser chrome render)."

patterns-established:
  - "Product-shot showcase over abstract hero animation (premium bar = show the real thing)"
  - "Swappable device-screen slots: permanent frame chrome + Placeholder `src` swap"

requirements-completed: [HERO-03, HERO-04]

# Metrics
duration: ~session (canvas build + live craft review + pivot + cleanup)
completed: 2026-06-15
---

# Phase 2 Plan 02: Hero Product-Shot Showcase (pivot from the canvas moment)

**The hero centerpiece is now the product, shown: a flat-warm desktop browser window (the Numen reading = the output) with a phone in front (the TikTok you paste = the input), reading left→right as paste → prediction. Both screens are swappable `<Placeholder>` slots for real desktop/mobile screenshots or video; the device chrome, layered shadows, and warm seat are the permanent craft. This replaced the bespoke canvas "crowd → score" moment, which was rejected at the blocking human craft-verify for reading as a tech-demo rather than a premium product hero.**

## What happened (the pivot)

1. **Task 1 built the canvas** (`7fc9ec77` — `feat(02-02): build canvas-2D signature moment`): the planned ~420-particle settle → coral reaction → coalesce → ring + count-up → drift, gated behind the 02-03 `ssr:false` client boundary. Build + tests passed.
2. **Task 2 (blocking `checkpoint:human-verify`) REJECTED it.** Live on `/` it read as a screensaver, not premium: a 420-particle cloud with no focal discipline, a doubled/rough ring (canvas ring stacked on `ComposedStill`'s ring at a different scale), particles spraying outside the stage, and the score number colliding with the phone-placeholder label. Even bug-free, the *concept* topped out at "tech-demo."
3. **Discussed direction with the user → product-shot.** Decision: show the product itself (OpusClip/Vercel/sandcastles pattern) rather than an abstract effect. Desktop = the reading (output), phone in front = the TikTok (input). Both surfaces represented; the empty grey placeholder stops being center-stage.
4. **Built + iterated the showcase live** (desktop width, screenshotted each pass): browser chrome (dots + `numen.app` pill) + 16/10 reading slot; phone moved to the lower-right, sized down, given its own shadow + ring to read "in front"; window lightened to the top surface + layered shadows + a faint warm radial seat so it floats off the page. Locked by the user.
5. **Cleaned up + re-scoped** (this plan's close-out).

## Accomplishments

- **HERO-03 (signature centerpiece) — reinterpreted + delivered:** the hero's signature visual is the product-shot showcase (desktop reading + phone TikTok in flat-warm device chrome), the approved replacement for the canvas crowd→score moment.
- **HERO-04 (no-blocking-paint / accessible fallback) — satisfied by construction:** the hero is now fully static (pure RSC, zero client JS, no canvas), with aspect-locked `<Placeholder>` slots → no CLS, nothing to "fall back" from, accessible by default.
- **Swappable real-asset slots:** desktop `16/10` "Numen reading" + phone `9/16` "Your TikTok" — a real screenshot/video swaps in via the single `src` prop (FOUND-03), no layout change.
- **Dead canvas machinery removed:** `signature-canvas.tsx`, `signature-moment-client.tsx`, `composed-still.tsx`, `hero-constants.ts` and their three 02-00 Nyquist suites deleted; `hero.test.tsx` re-scoped to gate the new showcase.

## Task Commits

1. **Task 1: canvas signature moment (later retired)** — `7fc9ec77` (feat) — built, then superseded by the pivot.
2. **Pivot: product-shot showcase + retire canvas** — `<this wave's feat commit>` (feat) — hero.tsx showcase, dead-code deletion, test re-scope.

**Close-out:** `<this wave's docs commit>` (docs) — SUMMARY + STATE + ROADMAP + REQUIREMENTS reconciliation.

## Files Created/Modified

- **`src/components/marketing/hero/hero.tsx`** (modified) — stage interior replaced with the desktop-window + phone showcase; pure RSC; doc comment rewritten to record the pivot.
- **`src/components/marketing/hero/__tests__/hero.test.tsx`** (modified) — added the HERO-03/04 showcase gate (reading slot + TikTok slot + browser chrome render); header refreshed. 8 tests.
- **Deleted:** `signature-canvas.tsx`, `signature-moment-client.tsx`, `composed-still.tsx`, `hero-constants.ts`, and `__tests__/{composed-still,signature-moment-client,hero-constants}.test.*`.

## Verification

- `npx vitest run src/components/marketing/hero/` → **8/8 GREEN**.
- `npx vitest run` (full suite) → **1949 passed, 26 skipped (184 files)** — green (down 13 tests = the removed canvas/still/constants suites, +3 new showcase tests).
- `npm run build` → **exit 0**, `┌ ○ /` (the home route stays statically prerendered).

## Deviations from Plan

This plan did NOT execute as written — it **pivoted**. The committed 02-02 plan (bespoke canvas moment) and the 02-03 plan (`ComposedStill` + `ssr:false` boundary) are **superseded**: the canvas was built, rejected at the human craft gate, and replaced with the product-shot showcase per explicit user direction. The phase GOAL — a premium hero centerpiece that makes a creator instantly *get* the product — is met by the new approach; the original HERO-03/04 acceptance criteria (animated coalesce, reduced-motion lazy fallback) no longer apply because there is no animation.

## Issues Encountered

- The canvas approach hit a hard craft ceiling (see "What happened"). Root cause was conceptual (an abstract particle effect can't read as a premium product hero) compounded by an architectural flaw (the client canvas stacked a second mis-scaled instrument over the SSR `ComposedStill`). Resolved by retiring the approach rather than patching it.

## User Setup Required

None — pure additive marketing markup + swappable placeholder slots. Real desktop/mobile screenshots or a screen-capture video will be supplied later (drop into the `src` prop of each `<Placeholder>`), once `numen-rework` ships.

## Next Phase Readiness

- **Asset follow-up (owner: product):** swap the two `<Placeholder>` slots to real desktop + mobile screenshots, then ideally a short silent looping screen-capture video, once the new reading is finished.
- **Phase 5 (hardening):** the showcase is desktop-tuned (absolute phone, lg shadows). Responsive restack at mobile widths + perf/a11y pass belong to the Phase-5 cross-cutting sweep (FOUND-05/06/07).
- Phase 2 hero requirements (HERO-01..04) are now all delivered.

## Self-Check: PASSED

- `hero.tsx` is a pure RSC (no "use client"), renders the desktop window + phone showcase with two swappable Placeholder slots; doc comment records the pivot.
- All canvas machinery + its tests are deleted; no dangling imports (grep clean).
- `hero.test.tsx` 8/8 GREEN; full suite 1949 green; `npm run build` exit 0 with `○ /` static.
- Commit `7fc9ec77` (retired canvas) referenced; pivot feat + docs commits recorded.

---
*Phase: 02-hero-signature-moment*
*Completed: 2026-06-15*
