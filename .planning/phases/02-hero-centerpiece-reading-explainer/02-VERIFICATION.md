---
phase: 02-hero-centerpiece-reading-explainer
verified: 2026-06-12T11:00:00Z
status: human_needed
score: 4/4 success-criteria verified (7/7 requirements delivered)
overrides_applied: 0
human_verification:
  - test: "Swap the placeholder comedy-skit keyframe for the final launch creator still"
    expected: "public/images/landing/hero/keyframe.webp is a final, rights-cleared creator-video still chosen for launch (current asset is a placeholder the user approved 'for now')"
    why_human: "Asset selection + rights clearance is a content/legal decision, not verifiable in code; the current still is functionally correct (real, non-stock, non-chrome, 720x1280) but flagged by the executor as a placeholder"
  - test: "Load the landing hero on a real mobile device and confirm the keyframe is the LCP element with a calm loop and no layout shift"
    expected: "Keyframe paints fast as LCP; stage-reveal loop is calm (no bounce/flicker); reduced-motion paints the static verdict end-state; no CLS"
    why_human: "Visual/perf feel + real-device LCP cannot be measured by unit tests (deeper LCP optimization is Phase 4 scope)"
---

# Phase 2: Hero Centerpiece & Reading Explainer Verification Report

**Phase Goal:** The above-fold hero leads with the product itself — a real Reading staged on a real creator video, full-bleed with minimal chrome, verdict shown as a calibrated band + one-line why (never a naked number); below it, a 3-step explainer (upload → engine reads → verdict + why) demonstrated with real content; the primary CTA is present in the hero.
**Verified:** 2026-06-12
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Mobile above-fold: verdict headline + subhead + CTA, with a real Reading on a real creator video as full-bleed centerpiece (NOT stock/fake chrome) | ✓ VERIFIED | `hero.tsx` renders single `<h1>` "Know if your content will land…" + subhead + `<Link href="#cta">Try Numen` + mounts full-bleed `<ReadingLoop className="w-full">`. ReadingLoop renders the real keyframe via `next/image`. Asset is a genuine 720x1280 WebP creator still (`file` → "Web/P image, VP8, 720x1280"), not stock/chrome. |
| 2 | Hero verdict reads as a calibrated band + one-line why — no naked number, no "X% accuracy" in the hero | ✓ VERIFIED | `verdict-throne.tsx`: `VerdictSwatch verdict="good"` + label "This will likely land." + why "Strong hook in the first 2 seconds — tighten the middle and it lands." Shipped-JSX scan for `\d+%` / `\d+/100` across all numen-landing components → NONE. `verdict-throne.test` asserts `not.toMatch(/\d+\/100|\d+%/)` → GREEN. |
| 3 | Hero animates with calm stage-reveal (StageBlock/`numen-ease-calm`) and degrades to static appear under `prefers-reduced-motion` | ✓ VERIFIED | `reading-loop.tsx` imports `StageBlock` + `useReducedMotion`; `useState(reduce ? OVERLAYS.length : 0)` + `if (reduce) return;` before any timer. `reading-loop.test` (mock `useReducedMotion=>true`) asserts end-state painted + no non-zero translate → 2 tests GREEN. |
| 4 | Three-step explainer (upload → reads → verdict + why), each step demonstrated with real content not an abstract diagram | ✓ VERIFIED | `how-it-works.tsx`: 3 `Surface` cards (`grid md:grid-cols-3`); step 1 = real keyframe `<img>`, step 2 = real stage-read line, step 3 = reused `<VerdictThrone />`. `how-it-works.test` asserts 3×`<h3>`, no h1/h2, `<img>` in step 1, band label in step 3 → 3 tests GREEN. Wired into `page.tsx` `#how-it-works` slot. |

**Score:** 4/4 success criteria verified

### Per-Requirement Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| HERO-01 | Above-fold hero: intelligence/verdict headline + subhead + primary CTA, mobile-first | ✓ PASS | `hero.tsx` single h1 + subhead + CTA; `hero.test` GREEN (1 h1, focus-ring, `h-11` ≥44px). |
| HERO-02 | Hero centerpiece is a real Reading on a real creator video, full-bleed, chrome-minimal | ✓ PASS (with residual) | Real 720x1280 WebP via `next/image` in `reading-loop.tsx`; full-bleed `w-full` artifact. **Residual:** asset is a placeholder still (user "for now") — see Human Verification #1. |
| HERO-03 | Verdict = calibrated band + one-line why (no naked number, no "X% accuracy") | ✓ PASS | `verdict-throne.tsx` band + label + why; no naked number (JSX scan + test). Label on `bg-panel` plate (APCA-gated). |
| HERO-04 | Calm stage-reveal motion (StageBlock/`numen-ease-calm`) + reduced-motion fallback | ✓ PASS | `reading-loop.tsx` controller `if (reduce) return` + full-revealed initial state; `reading-loop.test` GREEN. |
| READ-01 | Three-step explainer (upload → reads → verdict + why) | ✓ PASS | `how-it-works.tsx` 3 steps; `how-it-works.test` GREEN; wired in `page.tsx`. |
| READ-02 | Each step shows real content (content is demo) | ✓ PASS | Step 1 real keyframe img, step 2 real read line, step 3 real VerdictThrone — no icon-only/diagram. |
| CTA-01 | Primary CTA (Try / waitlist) in hero | ✓ PASS | `hero.tsx` `<Link href="#cta">Try Numen</Link>` with focus ring + `h-11`. (Footer-repeat is Phase 1 + Phase 3 scope; hero CTA present.) |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `public/images/landing/hero/keyframe.webp` | Real creator keyframe (HERO-02) | ✓ VERIFIED | 720x1280 VP8 WebP, 72KB, real creator still (placeholder pending final-asset swap). |
| `src/components/numen-landing/verdict-throne.tsx` | HERO-03 band + label + why | ✓ VERIFIED | 51 lines; uses `VerdictSwatch verdict="good"`; plate-backed; no naked number. |
| `src/components/numen-landing/reading-loop.tsx` | HERO-02/04 stage-reveal loop | ✓ VERIFIED | 114 lines; StageBlock + useReducedMotion controller; next/image keyframe. |
| `src/components/numen-landing/hero.tsx` | HERO-01/CTA-01 column | ✓ VERIFIED | Single h1 + subhead + locked CTA; mounts ReadingLoop. |
| `src/components/numen-landing/how-it-works.tsx` | READ-01/02 explainer | ✓ VERIFIED | 80 lines; 3 Surface cards, real content per step. |
| `src/app/(marketing)/page.tsx` | Wired hero + explainer slots | ✓ VERIFIED | Imports + renders `<Hero />` and `<HowItWorks />`; single h1 preserved; 4 Phase-3 slots untouched. |
| 5 test files + `scripts/check-apca.ts` | Nyquist scaffolds + APCA gate | ✓ VERIFIED | 13 tests GREEN; APCA gate exit 0. |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `reading-loop.tsx` | `@/components/numen/stage-reveal` | `import { StageBlock }` + `useReducedMotion` | ✓ WIRED |
| `reading-loop.tsx` | `verdict-throne.tsx` | final overlay renders `<VerdictThrone />` | ✓ WIRED |
| `reading-loop.tsx` | `keyframe.webp` | `next/image` static import | ✓ WIRED |
| `hero.tsx` | `reading-loop.tsx` | `<ReadingLoop className="w-full" />` | ✓ WIRED |
| `hero.tsx` | `#cta` anchor | `<Link href="#cta">` | ✓ WIRED |
| `verdict-throne.tsx` | `@/components/numen/verdict-swatch` | `import { VerdictSwatch }` verdict="good" | ✓ WIRED |
| `how-it-works.tsx` | `verdict-throne.tsx` + `keyframe.webp` | step 3 VerdictThrone, step 1 next/image | ✓ WIRED |
| `page.tsx` | `hero.tsx` + `how-it-works.tsx` | imports + SectionShell slot fill | ✓ WIRED |
| `(marketing)/layout.tsx` | `.numen-surface` token scope | wrapper `<div className="numen-surface …">` | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase-2 component suites GREEN | `pnpm exec vitest run src/components/numen-landing/__tests__/` | PASS (13) FAIL (0) | ✓ PASS |
| APCA gate exit 0, 6 real pairings PASS | `pnpm tsx scripts/check-apca.ts` | All 6 role pairings PASS; on-band = PLATE-REQUIRED diagnostic (non-fatal); EXIT=0 | ✓ PASS |
| Production build succeeds | `pnpm build` | BUILD_EXIT=0; root `/` route prerendered static (`○ /`) | ✓ PASS |
| No naked number / `%` in shipped JSX | grep `\d+%`/`\d+/100` across numen-landing | NONE FOUND | ✓ PASS |
| No banned VOICE token in rendered copy (incl alt) | grep viral/guaranteed/Apollo/Omni/pipeline/accuracy/predict/fold | Only JSDoc-comment mentions (not rendered) | ✓ PASS |

### APCA Gate Deviation (reviewed — acceptable)

The 02-04 reclassification of the on-band-label check from fatal `process.exit(1)` to a non-fatal `PLATE-REQUIRED` diagnostic is **correct and intended**:
- The 6 real role pairings (body/muted/accent/verdict-good/mixed/bad) remain hard pass/fail — all PASS at exit 0.
- The on-band-label measurement (`#f0ebe3` on `#7faf7a` = Lc 41.8 < 60) is a composition *signal* that the throne must back its label with a `bg-panel` plate. That mitigation IS shipped in `verdict-throne.tsx` (label on `rounded-[12px] border border-border bg-panel` plate, never on the band). Keeping it fatal would make the gate permanently unpassable while the correct fix is in place. No target was relaxed (`ON_BAND_TARGET` still 60). This is sound, not a gap.

### VOICE Rule 3 Confirmation

Holds in shipped JSX. The verdict is always band + specific one-line why; no `%`, no `/100`, no bare score anywhere in the hero or explainer. The "first 2 seconds" reference in the why line is a specific reason (the WHY Rule 3 mandates), not a naked verdict number.

### Anti-Patterns Found

None blocking. No TODO/FIXME/XXX/PLACEHOLDER debt markers in the shipped components. No empty-data stubs — every step/overlay renders a real artifact. (One known residual: the keyframe is a placeholder asset by user choice — content swap, not a code stub.)

### Human Verification Required

1. **Final keyframe swap** — replace the placeholder comedy-skit still with the launch creator still (rights-cleared). Current asset is functionally correct (real, 720x1280, non-stock, non-chrome) but flagged as placeholder by the executor.
2. **Mobile LCP + calm-loop feel** — load the hero on a real device, confirm the keyframe is the LCP element, the loop is calm, reduced-motion paints the static end-state, no CLS. (Deeper LCP optimization is Phase 4.)

### Gaps Summary

No blocking gaps. All 4 ROADMAP success criteria and all 7 phase requirements (HERO-01..04, READ-01, READ-02, CTA-01) are delivered in code and verified by GREEN tests + a clean APCA gate + a successful build. The phase goal is achieved. Two residual items require human sign-off (placeholder-asset swap, mobile LCP/feel) — neither blocks goal achievement; both are surfaced under Human Verification. Status is `human_needed` (not `passed`) solely because those human items exist.

**Overall verdict: PASS-WITH-NOTES** — goal achieved in the codebase; residual final-asset swap + mobile LCP/feel pending human confirmation.

---
*Verified: 2026-06-12*
*Verifier: Claude (gsd-verifier)*
