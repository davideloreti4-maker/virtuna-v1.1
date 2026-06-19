---
phase: 08-discover-remix-read-the-competitor-niche-moat-chain
fixed_at: 2026-06-19
review_path: .planning/phases/08-discover-remix-read-the-competitor-niche-moat-chain-draft-no/08-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 8: Code Review Fix Report

**Source review:** `08-REVIEW.md`
**Scope:** targeted pass — CR-01, CR-02, WR-01 only (other warnings/info deferred).

## Summary

- Findings in scope: 3
- Fixed: 3
- Skipped: 0
- Full suite after fixes: **2723 passed, 27 skipped, 0 failed** (267 test files).

## Fixed Issues

### CR-01 (BLOCKER): who-not-for mislabeled the warm purposeful_viewer as "scrolls past"

**Files:** `src/lib/engine/flash/who-not-for.ts`, `src/lib/engine/flash/__tests__/who-not-for.test.ts`
**Commit:** `34e66c35`

`deriveWhoNotFor` keyed the scrolls-past set on `disposition`, but `scanner` maps
to BOTH `purposeful_viewer` (temperature warm, engaged) and `cross_niche_curiosity`
(temperature cold) per `temperature-disposition.ts` — an honesty-spine violation
(P8 hard constraint). Now selects scroll-prone personas by
`TEMPERATURE_DISPOSITION[archetype].temperature === "cold"`, never by disposition
string. All-hot/warm panels still return `""`. Added tests asserting a warm
`purposeful_viewer` is NOT labeled scrolls-past, a cold `cross_niche_curiosity` IS,
and the mixed case excludes the warm scanner. who-not-for tests: 7 passing.

### CR-02 (BLOCKER): General-vs-General degenerate Read in the default (no calibrated audience) case

**Files:** `src/lib/engine/flash/two-audience-read.ts`, `src/app/api/tools/read/route.ts`, `src/lib/engine/flash/__tests__/two-audience-read.test.ts`
**Commit:** `a0a6f3cf`

The read route always passes a 2-element `[active, second]` array, so the runner's
length-based dedupe (length 0/1 only) never fired for the common default
`[General, General]`, rendering "General: Strong · General: Strong / Both General
and General land the same." `runTwoAudienceRead` now dedupes by audience IDENTITY
(`id`) BEFORE defaulting; when the resolved pair is the same identity it collapses
to a single-audience Read (one entry, no self-delta) instead of a degenerate
self-compare. The renderer + block schema already accept a 1-entry `audiences`
array. Added tests for the General-only single-audience path and the duplicate
calibrated → calibrated-vs-General default. two-audience-read tests: 9 passing.

### WR-01 (WARNING, security): CSRF guard inconsistency across mutating POST routes

**Files:** `src/lib/http/csrf-guard.ts` (new), `src/lib/http/__tests__/csrf-guard.test.ts` (new), `src/app/api/tools/read/route.ts`, `src/app/api/tools/chat/route.ts`, `src/app/api/tools/hooks/route.ts`, `src/app/api/tools/script/route.ts`, `src/app/api/discover/route.ts`, `src/app/api/tools/remix/run/route.ts`
**Commit:** `358cbe06`

`remix/run` applied a Content-Type 415 + cross-origin 403 CSRF guard; the
`read`/`chat`/`hooks`/`script`/`discover` POST routes had none, leaving cookie-auth
CSRF exposure on state-mutating routes. Factored the inlined guard into a shared
`csrfGuard(request)` helper (returns a 415/403 Response on violation, else null) and
called it immediately after the auth gate in all six routes — `remix/run` now reuses
the helper too (single source of truth). Added a unit test for the helper; existing
remix/run 415/403 route tests stay green.

## Verification

- Per-fix: relevant `vitest run` files green before each commit; `tsc --noEmit`
  reported no errors in the edited files.
- Full suite (`npm test`): 267 files / 2723 tests passed, 27 skipped, 0 failed.

---

_Fixer: Claude (gsd-code-fixer) — targeted CR-01 / CR-02 / WR-01 pass_
_Iteration: 1_
