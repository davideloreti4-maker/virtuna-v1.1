---
phase: 02-trustworthy-sim-spike
plan: 01
subsystem: testing
tags: [vitest, audience-signature, determinism, trust-tiering, regression-gate]

# Dependency graph
requires:
  - phase: 01-engine-pack-seam
    provides: "DomainPack contract + SOCIALS_PACK.calibration (the trust-tier basis the tiering predicate keys off)"
  - phase: "phase-0 substrate (on main)"
    provides: "enrichSignature bake (temp 0 + seed, dep-injectable) + AudienceSignature/SignaturePersona shapes"
provides:
  - "signature-equality.ts — normalizeSignature + signatureEqual + stableStringify (KEEP, P3 regression foundation)"
  - "signature-determinism.test.ts — zero-network replay determinism gate + scraped_at-only-delta proof + Directional-by-rule tiering assertion (KEEP)"
  - "Two hand-authored synthetic replay fixtures (frozen EnrichInput + recorded WatchNote[]/SynthSchema)"
affects: [phase-3-general-surface, TRUST-01, TRUST-02, trust-badge-resolver]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Replay determinism gate via injected EnrichDeps (zero network) — mirrors enrich-signature.test.ts dep-injection"
    - "One-field normalization rule (strip provenance.scraped_at) with self-proving Assumption-A1 assertion"
    - "Trust-tier as a pure local predicate over DomainPack.calibration (no src/ resolver — spike asserts the rule)"

key-files:
  created:
    - src/lib/audience/signature-equality.ts
    - src/lib/audience/__tests__/signature-determinism.test.ts
    - src/lib/audience/__tests__/fixtures/bake-input.fixture.json
    - src/lib/audience/__tests__/fixtures/bake-llm-outputs.fixture.json
  modified: []

key-decisions:
  - "scraped_at is the WHOLE normalization rule — proven (not assumed) via fake-timers double-bake + zero-everything-else diff"
  - "Tiering predicate stays test-local; the badge resolver is Phase 3 (TRUST-01) — over-building in src/ would breach D-05 scope"
  - "Fixtures hand-authored synthetic (mirror enrich-signature.test.ts builders) — no live scrape, no tokens, secret-free (T-02-01 mitigated)"

patterns-established:
  - "Zero-network replay gate: stub all three EnrichDeps with recorded fixtures so enrichSignature is byte-deterministic by construction"
  - "Self-proving normalization: the gate asserts scraped_at is the only pre-normalization delta, so the one-field rule cannot silently under-strip"

requirements-completed: [TRUST-03]

# Metrics
duration: 5min
completed: 2026-06-26
---

# Phase 02 Plan 01: Determinism Regression Gate Summary

**Zero-network Vitest replay gate (`signature-equality.ts` + `signature-determinism.test.ts`) proving the AudienceSignature assembly is byte-deterministic post-normalization, that `provenance.scraped_at` is the sole volatile field, and that a no-calibration SIM resolves Directional by rule.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-26T14:33:45Z
- **Completed:** 2026-06-26T14:37Z
- **Tasks:** 2
- **Files modified:** 4 (all created)

## Accomplishments
- `signature-equality.ts` (KEEP) — pure, dependency-free (type-only import): `normalizeSignature` zeroes the one volatile field, `signatureEqual` byte-compares via `stableStringify` (recursive key-sort).
- Zero-network replay determinism gate: two `enrichSignature` assemblies from identical inputs + recorded deps are byte-identical post-normalization.
- Assumption A1 proven (not assumed): `provenance.scraped_at` is the ONLY pre-normalization delta — verified by a fake-timers double-bake whose entire diff is scraped_at.
- Tiering leg asserted: Socials (calibration baseline present) → Validated; no-calibration SIM → Directional by rule, never Validated.
- Full `src/lib/audience` suite green (10 files / 135 tests) via `node ./node_modules/vitest/vitest.mjs run`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Determinism gate — signature-equality.ts + replay test + fixtures** - `af9e61f0` (test)
2. **Task 2: Tiering leg — Directional-by-rule predicate assertion** - `94ff42de` (test)

## Files Created/Modified
- `src/lib/audience/signature-equality.ts` - normalizeSignature / signatureEqual / stableStringify (KEEP — P3 regression foundation)
- `src/lib/audience/__tests__/signature-determinism.test.ts` - replay determinism gate + scraped_at-only-delta proof + resolveTier tiering assertion (KEEP)
- `src/lib/audience/__tests__/fixtures/bake-input.fixture.json` - frozen synthetic EnrichInput (3 videos, tiktokcdn mediaUrls — no Apify token, secret-free)
- `src/lib/audience/__tests__/fixtures/bake-llm-outputs.fixture.json` - recorded { watchNotes, synth, subtitle } replay payload (all 10 archetypes, shares/weights/temperature_mix Σ=1)

## Decisions Made
- Used `vi.useFakeTimers()` + two distinct `setSystemTime` values across the double-bake to guarantee `scraped_at` differs deterministically (no flakiness from same-millisecond collisions), making the "scraped_at is the only delta" proof robust.
- mediaUrls in the input fixture use `v16.tiktokcdn.com` (pass-through in `prepareWatchUrl`) rather than `api.apify.com` so `videos_watched` is env-independent (no APIFY_TOKEN append path) and the fixture never carries a token.
- `resolveTier` predicate reads only `{ baselineRef: SOCIALS_PACK.calibration?.baselineRef }` shape — keeps the test honest about D-04 (keys off DomainPack.calibration, never Audience.calibration) without depending on heavy pack internals.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. JSON fixture imports resolved natively under Vitest; both gate commands green on first run.

## Threat Surface
No new security-relevant surface introduced. Per the plan threat register: fixtures are hand-authored synthetic JSON with no real scrape, no tokens, no `mediaUrl` query strings (T-02-01 mitigated). No package installs (no supply-chain checkpoint required).

## User Setup Required
None - no external service configuration required. The kept gate runs zero-network in CI.

## Next Phase Readiness
- The determinism + normalization + tiering legs of TRUST-03 are now locked as automated, CI-safe assertions — Phase 3 inherits a green regression gate free by construction (TRUST-01).
- Still pending in this phase (Plan 02-02): the live double-bake probe that answers the make-or-break LLM-determinism question (does qwen3.7-plus thinking-mode honor the seed), plus the provenance leg over a real bake and the written `SPIKE-VERDICT.md` go/no-go.

## Self-Check: PASSED

All 5 created files present on disk; both task commits (`af9e61f0`, `94ff42de`) present in git history.

---
*Phase: 02-trustworthy-sim-spike*
*Completed: 2026-06-26*
