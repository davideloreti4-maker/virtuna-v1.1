---
phase: 02-trustworthy-sim-spike
verified: 2026-06-26T17:40:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
re_verification:
  none: initial verification
---

# Phase 2: Trustworthy-SIM Spike Verification Report

**Phase Goal:** Prove that a user can build a *trustworthy* General SIM with NO calibration data — de-risking the vision's make-or-break open question (§7) before any General surface is invested in.
**Verified:** 2026-06-26T17:40:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Spike Framing (critical)

This is a **SPIKE** (de-risking experiment), not a feature build. Its goal is achieved by producing an **honest, evidence-backed GO/NO-GO verdict** on the trustworthy-SIM question. A NO-GO verdict with a written fallback plan is a **successful** spike outcome. The verifier therefore credits the determinism leg's genuine FAIL as an achieved-and-documented finding, because `SPIKE-VERDICT.md` honestly records the FAIL + mitigation + production blast-radius analysis.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | KEEP determinism module (`signature-equality.ts`) exists, substantive, wired, green | ✓ VERIFIED | 72-line pure module: `normalizeSignature`/`signatureEqual`/`stableStringify`. Imported by `signature-determinism.test.ts:22`. Test suite 5/5 GREEN, zero-network (368ms). |
| 2 | SPIKE-VERDICT.md records per-leg PASS/FAIL against the hard D-04 3-gate | ✓ VERIFIED | Verdict table (lines 17-22): Determinism FAIL, Provenance PASS, Tiering PASS — each leg has a dedicated section with verbatim probe evidence. |
| 3 | SPIKE-VERDICT.md carries an explicit GO or NO-GO line | ✓ VERIFIED | Line 13: "**OVERALL VERDICT: NO-GO** (conditional — clears to GO after the determinism mitigation below)". |
| 4 | NO-GO → written fallback plan for Phase 3 | ✓ VERIFIED | §Fallback (lines 98-106): 3 ranked mitigations (drop thinking-mode synth recommended; scope contract to frozen artifact; field-tolerance). GO confirmation path stated. |
| 5 | Provenance leg: every reactor carries evidence; ungrounded distinguishable; holds for scraped + source=user (SC2) | ✓ VERIFIED | Verdict §Gate 2: 40/40 reactors grounded across 4 bakes; empty-evidence predicate flags ungrounded; `source=user` custom_context surfaced + tagged. KEEP test asserts non-empty `evidence` post-normalization. |
| 6 | Tiering: no-calibration SIM → Directional by rule, never Validated (SC3) | ✓ VERIFIED | KEEP test `resolveTier` predicate (lines 108-124): Socials→Validated; `undefined`/`{}`/`{baselineRef:""}`→Directional, `.not.toBe("Validated")`. GREEN. |
| 7 | Determinism demonstrably verifiable; honest finding recorded (SC1) | ✓ VERIFIED | Spike rendered determinism verifiable (live double-bake harness + replay gate). Verifiable answer: assembly/normalization half GREEN by construction; LLM-synth half genuine FAIL (watch counts matched A=3/B=3 → not Pitfall-2 transport; qwen-3.7-plus thinking-mode jitter). Honestly captured with bake-once-freeze blast-radius analysis. |
| 8 | Throwaway scripts/spike scaffolding torn down (D-05) | ✓ VERIFIED | `scripts/spike/` absent. Correct per D-05. Recoverable in git history (commit 362ef8df teardown; 13d6e1fc original probe). `fold-vision-spike.ts` is a pre-existing unrelated fold spike. |
| 9 | The 2 production bug-fixes survive in src/ | ✓ VERIFIED | `enrich-signature.ts:57` `SYNTH_TIMEOUT_MS = 120_000` (commit aa783456); `competitor.ts:75` `subtitleLinks` nullable + regression test (commit dbbcf46c). Competitor test 12/12 GREEN. |
| 10 | TRUST-03 accounted for in REQUIREMENTS.md | ✓ VERIFIED | REQUIREMENTS.md:31 `[x] TRUST-03` with honest spike outcome (provenance+tiering PASS, determinism FAIL→NO-GO conditional); traceability table line 113 `TRUST-03 | Phase 2 | Complete`. |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/audience/signature-equality.ts` | KEEP normalization/equality module | ✓ VERIFIED | 72 lines, pure, type-only import, exports all 3 functions. Wired into test. |
| `src/lib/audience/__tests__/signature-determinism.test.ts` | KEEP replay gate | ✓ VERIFIED | 5/5 green, zero-network, scraped_at-only-delta proof + Directional-by-rule tiering. |
| `src/lib/audience/__tests__/fixtures/bake-input.fixture.json` | Frozen EnrichInput | ✓ VERIFIED | Present (1916B), secret-scrubbed (REVIEW PASS). |
| `src/lib/audience/__tests__/fixtures/bake-llm-outputs.fixture.json` | Recorded replay deps | ✓ VERIFIED | Present (2634B). |
| `SPIKE-VERDICT.md` | Primary deliverable: per-leg + GO/NO-GO + fallback | ✓ VERIFIED | 131 lines; all required sections present. |
| `scripts/spike/*` (throwaway) | Torn down (D-05) | ✓ VERIFIED (absent by design) | Correctly removed. Not a gap. |
| `src/lib/audience/enrich-signature.ts` (prod fix) | timeout 60→120s | ✓ VERIFIED | `SYNTH_TIMEOUT_MS = 120_000`. |
| `src/lib/schemas/competitor.ts` (prod fix) | subtitleLinks null accept | ✓ VERIFIED | nullable+optional, downstream `?? []`. Test green. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `signature-determinism.test.ts` | `signature-equality.ts` | import signatureEqual/normalizeSignature/stableStringify | ✓ WIRED | Import at line 22; functions exercised in both determinism + scraped_at-delta tests. |
| `SPIKE-VERDICT.md` | probe evidence (02-02) | quotes determinism/provenance/tiering verbatim | ✓ WIRED | Probe output blocks quoted; recoverable via git (13d6e1fc). |
| `SPIKE-VERDICT.md` | `signature-determinism.test.ts` | cites kept replay gate as green | ✓ WIRED | Lines 49-51, 114 reference the gate as P3 regression foundation. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| KEEP determinism gate green | `node ./node_modules/vitest/vitest.mjs run .../signature-determinism.test.ts` | 5 passed | ✓ PASS |
| Competitor prod-fix regression green | `node ./node_modules/vitest/vitest.mjs run .../competitor.test.ts` | 12 passed | ✓ PASS |
| scripts/spike torn down | `find scripts -iname '*spike*'` | only unrelated `fold-vision-spike.ts` | ✓ PASS |
| Production timeout fix present | grep SYNTH_TIMEOUT_MS | `120_000` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TRUST-03 | 02-01/02-02/02-03 | Trustworthy General SIM with no calibration data | ✓ SATISFIED | Spike closed with honest evidence-backed verdict; REQUIREMENTS.md:31 marked complete with FAIL/NO-GO finding recorded. No orphaned requirements. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None blocking | — | No TBD/FIXME/XXX in changed src/ files. REVIEW.md: 0 critical, 2 warnings (WR-01 JSDoc clone wording, WR-02 SynthSchema bypass — robustness/maintainability, non-blocking), 3 info. |

### Human Verification Required

None. The make-or-break live experiment already RAN under human-approved spend; all spike deliverables (verdict honesty, KEEP gate green, teardown, prod fixes, requirement traceability) are codebase- and test-verifiable. The fallback mitigation (drop thinking-mode synth) is a Phase 3 action, not a Phase 2 verification item.

### Gaps Summary

No gaps. All four spike deliverables are present and correct:
1. KEEP determinism module exists, substantive, wired, and its zero-network replay gate is GREEN (5/5) — Phase 3's free-by-construction regression foundation (TRUST-01 seed).
2. SPIKE-VERDICT.md carries per-leg PASS/FAIL against D-04, an explicit NO-GO line, and a written fallback plan, plus the source=user P3 recommendation and the Pitfall-2 INCONCLUSIVE caveat.
3. Throwaway `scripts/spike/*` scaffolding torn down (D-05) — absence is correct, recoverable via git history.
4. Both production bug-fixes survive in `src/` with green regression tests.

The determinism leg's verdict is a genuine FAIL — but per the spike framing this is the experiment's HONEST FINDING, not a verification failure. The spike achieved its goal: it de-risked the trustworthy-SIM question by producing an evidence-backed verdict (provenance + tiering GREEN, determinism RED with a one-line mitigation in hand) BEFORE the General-surface investment. That is a successful spike outcome.

---

_Verified: 2026-06-26T17:40:00Z_
_Verifier: Claude (gsd-verifier)_
