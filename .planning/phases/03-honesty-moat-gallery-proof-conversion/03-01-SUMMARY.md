---
phase: 03-honesty-moat-gallery-proof-conversion
plan: 01
subsystem: testing
tags: [vitest, testing-library, happy-dom, red-scaffold, voice-gate, nyquist]

# Dependency graph
requires:
  - phase: 01-foundation-shell
    provides: "voice.test.tsx voice gate + VOICE.md ban list; (marketing) page skeleton + SectionShell single-h1 structure"
  - phase: 02-hero-reading
    provides: "VerdictThrone, HowItWorks, vitest staticImageStub plugin, dynamic-import RED-scaffold idiom"
provides:
  - "7 new RED test scaffolds covering every Phase-3 requirement seam (CTA-02, PROOF-01/02, TRUST-01/02, GALLERY-01/02, single-h1)"
  - "Extended voice gate: bans rival strings in 4 new components, positively scopes them to honesty-comparison (D-05)"
  - "Component-level PROOF-02 'one source, two surfaces' guard + automated single-h1 invariant"
affects: [03-02-honesty-comparison, 03-03-reading-gallery, 03-04-waitlist-schema, 03-05-conversion-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RED Nyquist scaffold: dynamic await import() inside each it() so the file fails on the missing target module, not an assertion typo"
    - "Scoped voice gate: negative ban-scan on clean components + positive assertion on the one sanctioned rival-string home"
    - "Async-RSC RED gate: assert HomePage() returns a Promise to stay RED on the sync skeleton until Plan 05 wires the count read"

key-files:
  created:
    - "src/app/(marketing)/__tests__/actions.test.ts"
    - "src/lib/__tests__/waitlist-count.test.ts"
    - "src/components/numen-landing/__tests__/honesty-comparison.test.tsx"
    - "src/components/numen-landing/__tests__/reading-gallery.test.tsx"
    - "src/components/numen-landing/__tests__/social-proof.test.tsx"
    - "src/components/numen-landing/__tests__/proof-placement.test.tsx"
    - "src/app/(marketing)/__tests__/page-headings.test.tsx"
  modified:
    - "src/components/numen-landing/__tests__/voice.test.tsx"

key-decisions:
  - "page-headings RED gate asserts HomePage() returns a Promise (async-RSC marker) instead of a missing module — the page file already exists as a sync skeleton, so the true 'not yet wired' signal is its sync-vs-async state."

patterns-established:
  - "RED scaffold idiom: dynamic import inside it() → module-resolution RED, never assertion-typo RED"
  - "Voice gate scoping: ban list applies to all copy-bearing components EXCEPT the one section sanctioned to hold rival strings, which gets a positive presence assertion"

requirements-completed: [CTA-02, PROOF-01, PROOF-02, TRUST-01, TRUST-02, GALLERY-01, GALLERY-02, CONTENT-02]

# Metrics
duration: 5min
completed: 2026-06-12
---

# Phase 3 Plan 01: Wave-0 RED Test Scaffolds Summary

**Seven RED Nyquist scaffolds for every Phase-3 requirement seam plus an extended voice gate that scopes the sanctioned rival strings to honesty-comparison only — all failing on missing implementation, ready to go GREEN as Waves 2–3 ship.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-12T14:06:26Z
- **Completed:** 2026-06-12T14:10:55Z
- **Tasks:** 4
- **Files modified:** 8 (7 created, 1 extended)

## Accomplishments
- Data-seam scaffolds: `joinWaitlist` (honeypot drop, invalid-email, 23505 dup-as-success — T-03-01 no-enumeration-leak) and `getWaitlistCount` (RPC passthrough + error→0 fail-soft), both with mocked `@/lib/supabase/server` (no live trust boundary).
- Component scaffolds: honesty-comparison (single semantic `<table>` + caption + 2 scoped `<th scope="col">` + positive rival-string assert), reading-gallery (≥3 imgs w/ alts + good/mixed/bad verdict range), social-proof (D-09 threshold guard, never "0 creators", `toLocaleString` above THRESHOLD=50).
- Invariant scaffolds: proof-placement (ProofStrip + SocialProof both surface the SAME count=1234 — PROOF-02/D-10 one source, two surfaces) and page-headings (exactly one level-1 heading on the Plan-05 async-wired page).
- Voice gate extended: negative ban scan now covers reading-gallery + social-proof + proof-strip + cta-section; honesty-comparison excluded from the ban scan and positively asserted as the sole home of the rival strings (D-05).

## Task Commits

Each task was committed atomically:

1. **Task 1: Data-seam RED scaffolds (actions + count read)** - `4c25da8a` (test)
2. **Task 2: Component RED scaffolds (honesty / gallery / social-proof)** - `61b33abe` (test)
3. **Task 3: PROOF-02 + single-h1 invariant scaffolds (proof-placement, page-headings)** - `da205abd` (test)
4. **Task 4: Extend voice gate to four new components (scoped rival strings)** - `68421083` (test)

_Note: Task 4 is `tdd="true"` but RED-only by plan design (no GREEN this wave — the five components do not exist yet), so it has a single `test(...)` RED commit. GREEN/REFACTOR land in Waves 2–3._

## Files Created/Modified
- `src/app/(marketing)/__tests__/actions.test.ts` - CTA-02 server-action seam: honeypot, invalid-email, 23505→success
- `src/lib/__tests__/waitlist-count.test.ts` - PROOF-01 count read: RPC passthrough, error→0
- `src/components/numen-landing/__tests__/honesty-comparison.test.tsx` - TRUST-01/02 semantic table + scoped rival strings
- `src/components/numen-landing/__tests__/reading-gallery.test.tsx` - GALLERY-01/02 ≥3 cards, alts, verdict range
- `src/components/numen-landing/__tests__/social-proof.test.tsx` - PROOF-01/D-09 threshold guard
- `src/components/numen-landing/__tests__/proof-placement.test.tsx` - PROOF-02/D-10 one-source-two-surfaces
- `src/app/(marketing)/__tests__/page-headings.test.tsx` - single-h1 invariant on the wired async page
- `src/components/numen-landing/__tests__/voice.test.tsx` - EXTENDED: 4-component ban scan + honesty-comparison positive scope assertion

## Decisions Made
- **page-headings RED-gate via async-RSC marker.** The `@/app/(marketing)/page` module already exists as a *sync* heading-only skeleton, so a "missing module" RED was impossible. The genuine "not yet wired" signal is the page's sync→async transition (Plan 05 threads a single `getWaitlistCount()` read, making it `async`). The test asserts `HomePage()` returns a Promise before rendering — RED on real missing wiring, GREEN only once Plan 05 wires the count. This honors the plan's "RED until the wired async page exists" intent without a fake failure.

## Deviations from Plan

None — plan executed exactly as written. The single judgment call (page-headings RED mechanism) is documented under Decisions Made; it stays within the Task 3 contract (single-h1 invariant, RED until Plan 05) and the plan's automated verify command still returns RED-OK (proof-placement supplies the module-resolution match).

## Issues Encountered
- Initial page-headings scaffold (literal `render(await HomePage())` + single-h1 assert) went GREEN prematurely because the current skeleton already renders exactly one h1. Resolved by adding the async-RSC Promise gate so the test is RED until Plan 05 makes the page async — see Decisions Made.

## User Setup Required
None - no external service configuration required (scaffolds only; no installs — package.json unchanged, confirmed via `git diff --stat`).

## Next Phase Readiness
- All 8 Wave-0 files confirmed RED (`npx vitest run` over the eight files → 8 failed suites, all on missing implementation modules / not-yet-wired page).
- Every Phase-3 requirement (CTA-02, PROOF-01/02, TRUST-01/02, GALLERY-01/02, CONTENT-02) now has a sampling seam; PROOF-02 and single-h1 have explicit automated coverage.
- Waves 2–3 (Plans 02/03/05) implement against the exact seam signatures encoded here; each scaffold flips GREEN as its target module ships. 03-VALIDATION.md `wave_0_complete` is ready to flip to `true`.
- No production code touched; `npm run build` unaffected.

## Self-Check: PASSED

All 8 files exist on disk; all 4 task commits (`4c25da8a`, `61b33abe`, `da205abd`, `68421083`) present in git log. Full 8-file vitest run confirmed RED (8 failed suites on missing implementation). `git diff --stat package.json` → no change (zero new packages).

---
*Phase: 03-honesty-moat-gallery-proof-conversion*
*Completed: 2026-06-12*
