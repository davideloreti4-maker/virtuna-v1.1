---
phase: 02-view-model-data-contract-eng-06-d-12
verified: 2026-06-12T10:30:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
---

# Phase 2: View-Model + Data Contract (ENG-06 D-12) Verification Report

**Phase Goal:** One pure module maps the engine's ~40 fields to ~10 value-bearing Reading blocks plus a verdict (band + why), and both the live `complete` path and the persisted-row replay path funnel through it — so a Reading and its re-opened resting document are identical. This is the architectural crux; it ships before any UI consumes it.
**Verified:** 2026-06-12T10:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + DATA-01..04)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 (SC1 / DATA-01) | `lib/reading/view-model.ts` `toReadingBlocks()` is a PURE function (no React, no fetch) that, given a persisted `PredictionResult` fixture, returns ~10 value-bearing blocks — unit-tested against real fixtures | ✓ VERIFIED | `view-model.ts` purity grep CLEAN (no react/useState/fetch/fs/Math.random/Date.now/supabase/await). Consumes `CanonicalReading` ONLY (sig `toReadingBlocks(c: CanonicalReading): ReadingBlock[]`). Live spot-check on real fixture → 7 value-bearing blocks (`verdict, expert-insight, hook, retention, audience, fixes, persona-read`). `view-model.test.ts` 8 tests GREEN. |
| 2 (SC2 / DATA-02) | The live `complete` path and persisted-row replay path call the SAME view-model; the same fixture yields IDENTICAL blocks via both | ✓ VERIFIED | `identical-render.test.ts` deep-equals `toReadingBlocks(canonicalFromLive(live))` vs `toReadingBlocks(fromPersistedRow(persisted))` against REAL captured pair WEkihfOzJphv (score 71). Suite 31/31 GREEN, 0 failed, 0 pending. Independent spot-check confirms both paths emit 7 blocks with identical keys+values (only JSONB key-INSERTION-ORDER differs — `toEqual` is order-insensitive → correctly GREEN; key-order difference is itself proof the two sources are genuinely distinct, not a copy). |
| 3 (SC3 / DATA-03) | A consumed-vs-dead field map is documented (resolves F27/F28/F43), with no `lib/engine/` edits and ENGINE_VERSION unchanged | ✓ VERIFIED | `FIELD-MAP.md` present: 21-row KEEP table (field→canonical→block) + 22-row DROP table with per-field rationale. `ENGINE_VERSION = "3.19.0"` (`src/lib/engine/version.ts:127`) unchanged. No `lib/engine/` files in ANY phase-02 commit (`4350612f d604c424 06333768 …` → grep `lib/engine` empty). |
| 4 (SC4 / DATA-04) | Verdict derivation = band + one-line why grounded in a specific signal; the `/100` is demoted to supporting evidence (resolves F41/F45) | ✓ VERIFIED | `verdict` block = `{ band: VerdictBand; why: string; confidenceLanguage: string; score: number }`. Spot-check on WEkihfOzJphv: band="High potential" (label, not a number), why grounded in `hero.verdict_line`, confidence="Confident read" (LANGUAGE), `score:71` in-body only. `bandFor()` single source in `verdict-bands.ts`. `verdict.test.ts` 6 tests assert band-from-score, grounded-why-or-empty (never generic), confidence-in-language, /100-demoted. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/reading/view-model.ts` | Pure `toReadingBlocks` + `canonicalFromLive` live adapter | ✓ VERIFIED | 345 lines, pure, wired into route via `from-persisted-row`; emits 11 block kinds; live adapter reads TOP-LEVEL `hero`/`apollo_reasoning` |
| `src/lib/reading/from-persisted-row.ts` | Pure deterministic persisted-row normalizer | ✓ VERIFIED | 158 lines, pure, reads `variants.{hero,apollo,craft}`; no Math.random/Date.now/DB/await; imported by route + identical-render test |
| `src/lib/reading/block-types.ts` | `ReadingBlock` union (D-13) + narrow `CanonicalReading` (D-09) | ✓ VERIFIED | 151 lines; 11-member union, pure data, NO audio member; `CanonicalReading` excludes `predicted_engagement`/`audio_fingerprint`/`optimal_post_window` at the type boundary |
| `src/lib/reading/verdict-bands.ts` | Single `VERDICT_BANDS` + `bandFor` | ✓ VERIFIED | 50 lines; 3 bands (High potential ≥70 / Solid contender ≥40 / Needs work ≥0), total over finite scores |
| `src/lib/reading/FIELD-MAP.md` | Consumed-vs-dead field map | ✓ VERIFIED | KEEP + DROP tables, F27/F28/F43 resolution, ENGINE_VERSION-frozen note |
| `src/app/api/analysis/[id]/route.ts` | Thin caller of `fromPersistedRow`; reload shims dropped | ✓ VERIFIED | GET fetches ownership-scoped row then `fromPersistedRow(data)`; no Math.random / heatmap-synth / optimal_post_window recompute in GET path (only documented in comments as REMOVED) |
| `__tests__/fixtures/{live,persisted}-WEkihfOzJphv.json` | REAL captured pair, distinct shapes | ✓ VERIFIED | live=top-level `hero`+`apollo_reasoning` (PredictionResult shape, no DB cols); persisted=`hero`+`apollo` under `variants.*` + DB cols (id/user_id/created_at/variants); both `overall_score=71`, same id. NOT degenerate. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `[id]/route.ts` GET | `fromPersistedRow` | `Response.json(fromPersistedRow(data))` | ✓ WIRED | thin caller; ownership filter intact (`.eq("user_id", user.id)`) |
| `identical-render.test.ts` | `view-model` + `from-persisted-row` | `toReadingBlocks(canonicalFromLive(live))` ≡ `toReadingBlocks(fromPersistedRow(persisted))` | ✓ WIRED | deep-equal GREEN against real pair |
| `view-model.ts` | `verdict-bands.ts` | `bandFor(c.overallScore)` | ✓ WIRED | single band source |
| `canonicalFromLive` ∥ `fromPersistedRow` | `CanonicalReading` | both return same narrow type | ✓ WIRED | convergence proven by deep-equal + degeneracy guard |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `toReadingBlocks` output | `ReadingBlock[]` | real fixture WEkihfOzJphv via both adapters | Yes — 7 populated blocks, real verdict text/score, real hook decomposition, real retention segments | ✓ FLOWING |

**Degeneracy guard (independent verifier check):** Fed the persisted RAW row through the LIVE adapter (`canonicalFromLive(persisted)`) — `expert-insight` block correctly DROPS (live adapter reads top-level `hero`/`apollo_reasoning`, absent on the raw row), while the correct path keeps it. This proves the two adapters read genuinely different locations; the deep-equal is a real convergence proof, not a tautology on a shared source.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Reading suite passes | `vitest run src/lib/reading --reporter=json` | numTotalTests 31 / passed 31 / failed 0 / pending 0 | ✓ PASS |
| Identical-render deep-equal | tsx invoke both adapters on real fixture | blocks deeply equal (same keys+values; only JSONB key-order differs, `toEqual`-insensitive) | ✓ PASS |
| Verdict shape (DATA-04) | tsx inspect verdict block | band="High potential", why grounded, confidence="Confident read", score=71 in-body | ✓ PASS |
| No NEW tsc errors | `tsc --noEmit \| grep src/lib/reading` | NO errors in reading module or route | ✓ PASS |
| Engine frozen | `grep ENGINE_VERSION version.ts` + commit scan | 3.19.0 unchanged; zero `lib/engine/` edits in phase-02 commits | ✓ PASS |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` declared for this phase; verification driven by the vitest suite + direct adapter invocation (above). N/A.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DATA-01 | 02-04 | Pure `toReadingBlocks()` ~40 fields → ~10 blocks | ✓ SATISFIED | Truth 1 |
| DATA-02 | 02-01/02-03/02-04 | Both paths funnel same view-model; deep-equal GREEN vs real pair | ✓ SATISFIED | Truth 2 + degeneracy guard |
| DATA-03 | 02-04 | Consumed-vs-dead field map (F27/F28/F43) | ✓ SATISFIED | Truth 3 |
| DATA-04 | 02-04 | Verdict band + why; /100 demoted (F41/F45) | ✓ SATISFIED | Truth 4 |

No orphaned requirements — REQUIREMENTS.md maps only DATA-01..04 to Phase 2; all claimed by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | none | — | No TBD/FIXME/XXX, no TODO/HACK/PLACEHOLDER, no stub returns, no fabricated empty data in `src/lib/reading/` or the route |

### Human Verification Required

None. Every truth is programmatically verifiable: pure functions (no UI/visual/real-time/external dependency at this layer), deep-equal contract, real on-disk fixtures, tsc, and a verifier-run degeneracy guard. The phase explicitly "ships before any UI consumes it" — UI/visual checks belong to Phase 4.

### Gaps Summary

No gaps. The architectural crux is genuinely achieved:

- The view-model is pure and consumes only the narrow `CanonicalReading` intersection, so live-only fields physically cannot reach a block (D-09 compile-time enforcement; tsc clean).
- The identical-render contract is GREEN against a REAL captured pair (WEkihfOzJphv, score 71) whose two halves carry genuinely different shapes (live top-level `hero`/`apollo_reasoning` vs persisted `variants.*`). The verifier independently confirmed non-degeneracy via a degeneracy guard and a deep value comparison.
- The route was rewired to a thin caller; non-deterministic load-time reconstruction (Math.random persona ids, heatmap synthesis, optimal_post_window/creator_profiles recompute) was dropped — present only in comments documenting the removal.
- ENGINE_VERSION 3.19.0 is frozen; zero `lib/engine/` edits in phase-02 commits.
- FIELD-MAP documents every engine field as KEEP→block or DROP→rationale (F27/F28/F43 resolved).

---

_Verified: 2026-06-12T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
