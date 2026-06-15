---
phase: 02-hero-signature-moment
plan: 00
subsystem: testing
tags: [vitest, happy-dom, react-testing-library, nyquist, tdd-red, hero, svg, canvas-gating]

# Dependency graph
requires:
  - phase: 01-foundation-shell
    provides: "flat-warm @theme tokens, <Placeholder> slot, SIGNUP_URL route, vitest+happy-dom+RTL convention, usePrefersReducedMotion/useIsMobile hooks, perf-tier"
provides:
  - "Four Wave-0 RED test files encoding HERO-01..04 acceptance criteria as executable assertions"
  - "Concrete <automated> GREEN gates for downstream plans 02-01 (hero) and 02-03 (composed-still + signature-moment-client + hero-constants)"
  - "Geometry contract for the SVG arc ring (SIZE=240, STROKE=12, radius=114, strokeDashoffset = circumference·(1 − score/100))"
  - "Gating-correctness contract: canvas island must NOT mount when reduced-motion OR mobile"
affects: [02-01-hero, 02-03-composed-still, 02-02-signature-canvas]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-file happy-dom pragma on line 1 (no global vitest config in repo)"
    - "vi.mock hooks/perf-tier at module scope + flip per-case via vi.mocked().mockReturnValue() (mirrors use-audience-choreography.test.ts)"
    - "Resilient copy assertions: VERBATIM for locked H1 (D-09), stable-token regex for planner-flexible subcopy/scroll-cue"
    - "Token-driven assertions: stroke === var(--color-accent), threshold imported from verdict-constants (not literal 70/hex)"

key-files:
  created:
    - "src/components/marketing/hero/__tests__/hero.test.tsx"
    - "src/components/marketing/hero/__tests__/hero-constants.test.ts"
    - "src/components/marketing/hero/__tests__/composed-still.test.tsx"
    - "src/components/marketing/hero/__tests__/signature-moment-client.test.tsx"
  modified: []

key-decisions:
  - "Score fixture = 87 (>= BAND_THRESHOLDS.STRONG 70 → coral 'will pop' is honest); geometry computed in-test from SIZE/STROKE so the assertion verifies the score mapping, not a hardcoded offset"
  - "Subcopy/scroll-cue matched by stable token (/simulat.../, /how it works/i) not full sentence — keeps the gate resilient to copy tightening within D-11/D-12 intent"
  - "Gating tests assert container.querySelector('canvas') === null (the correctness property) rather than relying on dynamic(ssr:false) non-render in happy-dom"

patterns-established:
  - "Wave-0 Nyquist scaffold: author RED tests against PLANNED exports before any component exists; module-not-found IS the success signal"
  - "RED-reason discipline: every failure verified as 'Failed to resolve import' (missing module), never a syntax/path/pragma error"

requirements-completed: []  # Wave-0 scaffold authors the GATES for HERO-01..04; the requirements turn GREEN in 02-01/02-02/02-03, not here.

# Metrics
duration: ~10min
completed: 2026-06-15
---

# Phase 2 Plan 00: Hero Nyquist Test Scaffold Summary

**Four pragma-prefixed RED test files encoding HERO-01..04 as executable assertions (H1-verbatim + serif + CTA hrefs, SVG arc-ring geometry + coral token + role=img/aria-label + no-CLS lock, reduced-motion/mobile canvas-gating, score-honesty ≥70) — all four fail for the right reason (missing module), every pre-existing test stays green.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-15T02:20Z (CEST; first file read)
- **Completed:** 2026-06-15T02:35Z (CEST)
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- **HERO-01/02 gate** (`hero.test.tsx`): asserts an `<h1>` whose textContent is the LOCKED verbatim "Know if it'll pop before you post" (D-09) carrying a `/font-serif/` class (D-10), a non-empty Inter subcopy containing the product noun (`/simulat.../`, D-11/D-23), the primary CTA `href === SIGNUP_URL` (imported, not literal), and the scroll-cue `href === "#how-it-works"` (D-12).
- **HERO-03 honesty gate** (`hero-constants.test.ts`): asserts `HERO_SCORE >= BAND_THRESHOLDS.STRONG` (imported from `verdict-constants`, not literal 70) and `<= 100`.
- **HERO-03/04 still gate** (`composed-still.test.tsx`): asserts an `<svg>` with ≥2 `<circle>`s, the progress arc `strokeDashoffset` mapped from score=87 to within 1px (radius 114 / circumference re-derived in-test), the progress `stroke === "var(--color-accent)"`, the score number "87" rendered as text, `role="img"` with an `aria-label` matching `/87/`, and an inline `aspect-ratio` (or fixed height) no-CLS lock.
- **HERO-04 gating gate** (`signature-moment-client.test.tsx`): asserts NO `<canvas>` mounts when `usePrefersReducedMotion` is mocked true, and NO `<canvas>` when `useIsMobile` is mocked true — `perf-tier` stubbed benign so the gate, not the tier, is what's under test.
- **All four RED for the right reason** — verified via JSON reporter: each fails with `Failed to resolve import "../<module>"`, zero pragma/parse/path errors.
- **Full suite stays green** — 661 suites / 1967 tests: 1941 passed, the only 4 failing suites are exactly these intentional hero RED files (0 non-hero failures).

## Task Commits

Each task was committed atomically:

1. **Task 1: hero.test.tsx + hero-constants.test.ts (HERO-01/02/03)** — `578793de` (test)
2. **Task 2: composed-still.test.tsx + signature-moment-client.test.tsx (HERO-03/04)** — `a3bfb19f` (test)

**Plan metadata:** (this commit — docs: complete plan)

## Files Created/Modified
- `src/components/marketing/hero/__tests__/hero.test.tsx` — RED tests for HERO-01 (verbatim H1 + serif class + subcopy noun) and HERO-02 (CTA href === SIGNUP_URL, scroll-cue href === #how-it-works).
- `src/components/marketing/hero/__tests__/hero-constants.test.ts` — RED test for HERO-03 score honesty (HERO_SCORE in [BAND_THRESHOLDS.STRONG, 100]).
- `src/components/marketing/hero/__tests__/composed-still.test.tsx` — RED tests for HERO-03 (SVG ring geometry + coral token stroke + score number) and HERO-04 (role=img + aria-label + aspect-lock).
- `src/components/marketing/hero/__tests__/signature-moment-client.test.tsx` — RED tests for HERO-04 gating (reduced-motion → no canvas; mobile → no canvas).

## Decisions Made
- **Geometry re-derived in-test, not hardcoded.** `composed-still.test.tsx` computes `EXPECTED_OFFSET` from `SIZE=240`, `STROKE=12`, `radius=114` and asserts the rendered `strokeDashoffset` within 1px — so the gate verifies the *score→arc mapping*, catching a component that hardcodes a full or empty ring. Matches RESEARCH §"Re-derived clean SVG arc ring".
- **Token + SSOT assertions over literals.** Progress stroke asserted as `var(--color-accent)` (catches a hardcoded hex or white per the flat-warm token rule); honesty threshold imported from `verdict-constants` (moves with the product if it re-bands). CTA target imported as `SIGNUP_URL`.
- **Locked-vs-flexible copy split.** H1 matched verbatim (D-09 LOCKED); subcopy and scroll-cue matched by stable token regex so copy tightening within D-11/D-12 does not falsely break the gate.
- **Gate-not-render for the canvas.** The `dynamic(ssr:false)` island would not synchronously render in happy-dom anyway; the tests assert `querySelector("canvas") === null` under each gate so they verify the *correctness property* (gate prevents mount) independent of the lazy-import mechanics.
- **No component stubs created.** Per the plan's RED mandate, the imported modules (`hero`, `hero-constants`, `composed-still`, `signature-moment-client`) were deliberately left absent — 02-01/02-03 turn them GREEN.

## Deviations from Plan

None - plan executed exactly as written. (Both `<automated>` grep-based verify commands were satisfied; additionally confirmed the precise RED reason and full-suite isolation via the JSON reporter for stronger evidence than the grep alone.)

## Issues Encountered
- The Bash tool's tee wrapper truncated `vitest` stdout (showed "PASS (0) FAIL (0)" only). Resolved by routing the JSON reporter to a file (`--outputFile`) and parsing with `node` — yielded exact per-suite status + failure messages. Did not affect the work, only the inspection method.

## User Setup Required
None - no external service configuration required. Test-only plan; no runtime, network, secrets, or dependencies added.

## Next Phase Readiness
- **02-01 (hero)** can cite `hero.test.tsx` as its GREEN gate: build the RSC `Hero` exporting `{ Hero }` from `src/components/marketing/hero/hero.tsx` (serif H1 verbatim, Inter subcopy naming "Simulation", primary CTA → `SIGNUP_URL`, scroll-cue → `#how-it-works`), and own the aspect-locked stage container.
- **02-03 (composed-still + boundary + constants)** can cite `composed-still.test.tsx`, `signature-moment-client.test.tsx`, and `hero-constants.test.ts`: export `HERO_SCORE` (87) from `hero-constants.ts`; `ComposedStill({score})` with the SVG ring (track + `var(--color-accent)` progress at the derived offset), score text, `role="img"`+`aria-label`, aspect-lock; `SignatureMomentClient({score})` as the `"use client"` `dynamic(ssr:false)` boundary that does NOT mount the canvas under reduced-motion/mobile.
- **Landmine reminder for 02-03:** the `dynamic(ssr:false)` call MUST live in `signature-moment-client.tsx` (`"use client"`), never in the RSC `Hero` — Next.js 16 forbids `ssr:false` in Server Components (RESEARCH Pitfall 1).
- No blockers. The four files are the keystone `<automated>` gates for the rest of Phase 2.

## Self-Check: PASSED

- 4/4 test files exist at the planned paths, each with `/** @vitest-environment happy-dom */` on line 1.
- 02-00-SUMMARY.md exists.
- Both task commits present: `578793de` (Task 1), `a3bfb19f` (Task 2).
- All 4 suites RED via `Failed to resolve import` (missing module), 0 non-hero failures across the 661-suite / 1967-test full run.

---
*Phase: 02-hero-signature-moment*
*Completed: 2026-06-15*
