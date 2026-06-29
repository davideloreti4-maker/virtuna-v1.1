---
phase: 02-trustworthy-sim-spike
reviewed: 2026-06-26T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/lib/audience/signature-equality.ts
  - src/lib/audience/__tests__/signature-determinism.test.ts
  - src/lib/audience/__tests__/fixtures/bake-input.fixture.json
  - src/lib/audience/__tests__/fixtures/bake-llm-outputs.fixture.json
  - src/lib/audience/enrich-signature.ts
  - src/lib/schemas/competitor.ts
  - src/lib/schemas/__tests__/competitor.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-06-26
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the surviving Phase-2 spike artifacts: the determinism KEEP module
(`signature-equality.ts` + test + two synthetic fixtures) and two latent
production fixes (`enrich-signature.ts` synth-timeout 60s→120s,
`competitor.ts` `subtitleLinks: null` acceptance + regression test).

Verdict: the core logic is **correct**. Both production fixes are minimal,
well-scoped, and verified against their context:

- **Secret-safety (PASS):** Both committed JSON fixtures are clean. No API
  tokens, no `?token=` query strings, no auth-bearing URLs. URLs are synthetic
  (`example.com`, `www.tiktok.com/...`, `v16.tiktokcdn.com/video-N.mp4`) with
  no credentials. `prepareWatchUrl`'s `APIFY_TOKEN` injection never touches the
  fixtures (token comes from `process.env`, not hardcoded).
- **`normalizeSignature`/`signatureEqual`/`stableStringify` (PASS):** The
  one-field strip + recursive key-sort + `JSON.stringify` compare is sound and
  pure. Arrays preserve order (load-bearing for personas); only object keys
  sort. The replay gate proves `scraped_at` is the sole volatile field.
- **`competitor.ts` null-acceptance (PASS, narrow):** `.nullable().optional()`
  on `subtitleLinks` is correctly scoped — it does not widen the inner element
  schema, and downstream `?? []` coalescing makes null/absent equivalent. Not
  over-permissive.
- **Synth timeout bump (PASS):** Verified `src/app/api/audiences/calibrate/route.ts`
  exports `maxDuration = 300`, which comfortably covers the new 120s synth
  ceiling plus the 60s omni-watch budget — the inner `AbortController` will fire
  before the platform kills the request.

No blockers. Findings below are robustness/maintainability concerns and test-
quality observations.

## Warnings

### WR-01: `normalizeSignature` JSDoc claims a clone but returns a shallow copy

**File:** `src/lib/audience/signature-equality.ts:51-63`
**Issue:** The doc comment states "Returns a clone — the input is not mutated,"
but the implementation only shallow-copies the top level and `provenance`. The
nested `audience` (with `personas[]`), `creator_persona`, and `summary` objects
are shared by reference with the input. The current callers (`signatureEqual`,
the test) only read/stringify the result, so there is no live bug. But the
function is `export`ed as a public utility; a future caller that mutates the
"normalized clone" (e.g. to redact a field before logging) would silently mutate
the original `AudienceSignature` — a frozen, load-bearing row object.
**Fix:** Either correct the contract wording to "shallow copy with `scraped_at`
zeroed (nested objects shared)," or deep-clone to honor the documented
guarantee:
```ts
export function normalizeSignature(sig: AudienceSignature): AudienceSignature {
  const clone = structuredClone(sig); // or JSON round-trip
  clone.provenance.scraped_at = FROZEN_TS;
  return clone;
}
```

### WR-02: Test bypasses `SynthSchema` validation via `as never`, weakening the assembly-determinism guarantee

**File:** `src/lib/audience/__tests__/signature-determinism.test.ts:31-35`
**Issue:** `synthesize: async () => recorded.synth as never` injects the raw
fixture straight into the orchestrator, skipping the production `SynthSchema`
parse that `defaultSynthesize` performs (enrich-signature.ts:360-364). The test
therefore proves *assembly + normalization* determinism but does NOT exercise
the schema/Zod-default leg of the real pipeline. If a future change to
`SynthSchema` (e.g. a new defaulted field, a `.transform`) introduced
non-determinism or altered shape, this gate would not catch it — the fixture is
hand-validated, not schema-validated. The fixture happens to be schema-valid
today (weights sum 1.0, 10 distinct valid archetype slugs, temperature_mix sums
1.0), but that is asserted nowhere.
**Fix:** Run the fixture through `SynthSchema.parse(recorded.synth)` inside the
replay dep so the test fails loudly if the recorded shape ever drifts from the
production schema:
```ts
synthesize: async () => SynthSchema.parse(recorded.synth),
```
(Requires exporting `SynthSchema` from enrich-signature.ts.)

## Info

### IN-01: First determinism test is near-tautological

**File:** `src/lib/audience/__tests__/signature-determinism.test.ts:38-42`
**Issue:** The test calls `enrichSignature` twice with the same pure deps and
asserts `signatureEqual(a, b)`. Because `signatureEqual` normalizes away
`scraped_at` — the only time-varying field — this passes regardless of whether
the two bakes crossed a millisecond boundary. It adds little over the second
test (lines 44-68), which explicitly pins distinct system times and is the real
proof. Harmless, but the comment "byte-identical post-normalization" overstates
what this first case independently demonstrates.
**Fix:** Optional — keep for documentation value, or fold into the stronger
second test.

### IN-02: `as never` casts on fixture imports erase compile-time type safety

**File:** `src/lib/audience/__tests__/signature-determinism.test.ts:32-34,39,49,51`
**Issue:** `recorded.watchNotes[0] as never`, `recorded.synth as never`, and
`input as never` discard all structural type checking against `WatchNote` /
`SynthSchema` / `EnrichInput`. A drift between the fixture JSON and the
interfaces would compile clean and surface only as a confusing runtime failure.
**Fix:** Type the imported fixtures (e.g. `input satisfies EnrichInput` after a
parse, or cast to the concrete interface rather than `never`) so the compiler
guards fixture/shape drift.

### IN-03: `MP4_HOST_SUFFIXES` allowlist match has a redundant exact-host clause

**File:** `src/lib/audience/enrich-signature.ts:270`
**Issue:** `host === s.slice(1) || host.endsWith(s)` — for a suffix like
`.tiktokcdn.com`, the `host === "tiktokcdn.com"` exact branch is already covered
by `host.endsWith(".tiktokcdn.com")` only when a leading dot is present, so the
`s.slice(1)` branch exists to also allow the bare apex `tiktokcdn.com`. This is
intentional but subtle; worth a one-line comment. Not a correctness defect (the
SSRF guard is sound: non-HTTPS and non-allowlisted hosts return null). Noting
only because it is the security-sensitive line in the changed file and reads as
accidental duplication.
**Fix:** Add a comment clarifying the apex-vs-subdomain intent, or use a single
`host === apex || host.endsWith("." + apex)` form built from a clean host list.

---

_Reviewed: 2026-06-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
