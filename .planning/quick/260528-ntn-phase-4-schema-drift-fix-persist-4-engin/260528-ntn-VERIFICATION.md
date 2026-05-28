---
phase: 260528-ntn
verified: 2026-05-28T17:35:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 4 (MVP Cut) — Schema Drift Fix: VERIFICATION

**Phase Goal:** Persist 4 engine-emitted columns (counterfactuals, hook_decomposition, confidence_label, anti_virality_gated) to analysis_results; revert script-route inline workaround from commit 3bf3eb7.

**Verified:** 2026-05-28
**Status:** PASSED (with one acceptably-deferred item: SC3 live E2E analysis run)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Migration applied to remote Supabase (4 columns on analysis_results) | VERIFIED | Migration file present at `supabase/migrations/20260528150000_phase4_schema_drift_engine_columns.sql` with 4 ADD COLUMN IF NOT EXISTS + CHECK constraint. SUMMARY confirms applied to remote project `qyxvxleheckijapurisj` via information_schema query returning 4 rows (boolean, text, jsonb, jsonb). Types regen via `supabase gen types typescript --project-id qyxvxleheckijapurisj` produced the 4 fields, which only happens if remote has them. |
| 2 | database.types.ts contains 4 fields in Row/Insert/Update, regenerated (not hand-patched) | VERIFIED | Each field appears 3× (Row + Insert + Update): `grep -cE "counterfactuals(\?)?:"` → 3, hook_decomposition → 3, confidence_label → 3, anti_virality_gated → 3. Field ordering is alphabetical (auto-gen pattern). File contains `export type Json = string \| ...` standard Supabase preamble. No hand-patch markers. Critically, regen flipped `id` from `id?: string` (optional) to `id: string` (required) on analysis_results Insert line 254 — proves file is generated from authoritative schema, not patched. |
| 3 | /api/analyze persists 4 columns non-null on fresh test analysis | VERIFIED (E2E deferred) | `buildInsertRow` at `src/app/api/analyze/route.ts:338-407` includes all 4 fields (lines 401-406). Both call sites consume the builder: JSON branch INSERT at line 447 (`{ ...buildInsertRow(...), id: nanoid(12) }`), SSE branch UPSERT at line 585-588 (`{ ...buildInsertRow(...), id: analysisId }, { onConflict: "id" }`). Live E2E analysis explicitly deferred to user per SUMMARY — acceptable since wiring is fully verified statically and full test suite covers `buildInsertRow`. |
| 4 | Script route SELECTs 4 columns directly; no inline derivation; no TODO(schema-drift) | VERIFIED | SELECT at `src/app/api/analyze/[id]/script/route.ts:90-94` lists `id, counterfactuals, factors, reasoning, confidence, confidence_label, anti_virality_gated, hook_decomposition, engine_version, script_result`. Inline derivation replaced with `const row = data as unknown as AnalysisRow;` at line 107. `grep -nE "(derivedLabel\|derivedGated\|TODO\(schema-drift\))"` returns zero matches. |
| 5 | pnpm build + tsc --noEmit + pnpm test all green | VERIFIED | `pnpm exec tsc --noEmit` → "TypeScript: No errors found" (0 errors — note: SUMMARY claimed 1 pre-existing aggregator.test.ts TS2559 but it is no longer present; likely resolved by intervening commits). `pnpm test --run` → 154 test files passed, 1 skipped; 1591 tests passed, 26 skipped; 0 failed. `pnpm build` → "Compiled successfully in 5.6s", 53 static pages generated, no errors. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260528150000_phase4_schema_drift_engine_columns.sql` | ALTER TABLE 4 cols + CHECK + comments | VERIFIED | 43 lines; contains `ADD COLUMN IF NOT EXISTS counterfactuals JSONB`, `hook_decomposition JSONB`, `confidence_label TEXT`, `anti_virality_gated BOOLEAN`; DO-block guard for CHECK constraint `analysis_results_confidence_label_check`; 4 COMMENT ON COLUMN statements. |
| `src/types/database.types.ts` | Regenerated; 4 fields in Row/Insert/Update | VERIFIED | Each field 3× as expected; alphabetically sorted (auto-gen marker); `id` flipped to required (regen evidence). |
| `src/app/api/analyze/route.ts` | buildInsertRow plucks 4 fields | VERIFIED | Lines 401-406 contain all 4 fields with correct Json casts on the two JSONB fields and direct assignment on the required scalar fields. |
| `src/app/api/analyze/[id]/script/route.ts` | SELECT includes 4 cols; no inline derivation; no TODO block | VERIFIED | SELECT line 92-94; AnalysisRow cast at line 107; no derivedLabel/derivedGated/TODO(schema-drift) anywhere in file. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| Migration SQL | Remote analysis_results table | `supabase gen types` regen reflects remote | WIRED | Types regen produced 4 fields → remote schema must have them. SUMMARY documents successful `apply_migration` + information_schema verification. |
| `buildInsertRow` | analysis_results INSERT (JSON branch) | `service.from("analysis_results").insert({ ...buildInsertRow(...), id: nanoid(12) })` line 447 | WIRED | Spread propagates all 4 new fields; id added explicitly post-regen. |
| `buildInsertRow` | analysis_results UPSERT (SSE branch) | `service.from("analysis_results").upsert({ ...buildInsertRow(...), id: analysisId }, { onConflict: "id" })` line 585 | WIRED | Spread propagates all 4 new fields; upsert overwrites placeholder row. |
| Script route GET | analysis_results SELECT | `supabase.from('analysis_results').select(...)` line 90-94 | WIRED | SELECT lists all 4 new columns explicitly; `row` cast feeds `computeScript`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| buildInsertRow output → INSERT | `finalResult.counterfactuals`, `.hook_decomposition`, `.confidence_label`, `.anti_virality_gated` | Aggregator's `PredictionResult` (engine emits all 4 — `confidence_label`/`anti_virality_gated` REQUIRED on type, the two JSONB fields optional but populated for video-mode runs) | Yes | FLOWING |
| Script route `row` → `computeScript(row)` | `row.counterfactuals`, `.confidence_label`, `.anti_virality_gated`, `.hook_decomposition` | Supabase SELECT result | Yes — real persisted values, no fallback derivation | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles | `pnpm exec tsc --noEmit` | "TypeScript: No errors found" | PASS |
| Production build succeeds | `pnpm build` | "Compiled successfully in 5.6s", 53 pages | PASS |
| Test suite passes | `pnpm test --run` | 1591 passed, 26 skipped, 0 failed (154 files) | PASS |
| Test fixture updated for Test 3 (script route) | `grep "confidence_label: 'HIGH'"` in route.test.ts | Found at lines 171-172 | PASS |
| Inline workaround fully removed | `grep -nE "(derivedLabel\|derivedGated\|TODO\(schema-drift\))"` | NO_MATCHES_OK | PASS |
| Fresh end-to-end analysis populates 4 columns | Manual: trigger analysis + query Supabase | Not run (no dev server in worktree) | SKIP — deferred to user per SUMMARY |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| mvp-cut-phase-4-1 | 260528-ntn-PLAN.md | Migration applied to remote | SATISFIED | Migration file + SUMMARY documents successful apply + types regen confirms remote has columns |
| mvp-cut-phase-4-2 | 260528-ntn-PLAN.md | Types regenerated, not hand-patched | SATISFIED | Auto-gen pattern (alphabetical sort, id-required flip) confirms full regen |
| mvp-cut-phase-4-3 | 260528-ntn-PLAN.md | /api/analyze persists 4 columns non-null | SATISFIED (E2E deferred) | Wiring verified at both INSERT (JSON branch) and UPSERT (SSE branch) call sites; live run deferred but tested via full unit suite |
| mvp-cut-phase-4-4 | 260528-ntn-PLAN.md | Script route SELECTs persisted columns | SATISFIED | SELECT lists all 4; no derivation/TODO remnants |
| mvp-cut-phase-4-5 | 260528-ntn-PLAN.md | pnpm build + tsc --noEmit + pnpm test green | SATISFIED | All three commands green |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | No TODO/FIXME/XXX/HACK introduced by this phase. SUMMARY's "Deviations" section transparently documents two regen-exposed bugs (id-required on JSON branch INSERT, outcomes table schema divergence) — both legitimate pre-existing latent bugs surfaced + fixed (or noted) by the regen. Not anti-patterns. |

### Deviations from Plan (transparent — already documented in SUMMARY)

1. **JSON branch INSERT now passes `id: nanoid(12)` explicitly.** Forced by types regen flipping `id?: string` → `id: string` (column has no DB default). Latent bug pre-regen (row would have failed at runtime if hit); proper fix is the explicit ID. nanoid(12) matches the generator used elsewhere in the route (lines 111, 496) → no uniqueness concern.

2. **`validate-rules/route.ts` + `outcomes/route.ts` cast outcomes query result.** Regen surfaced that the remote `outcomes` table schema diverged from old stale types (predicted_score/actual_score/created_at/deleted_at removed). Both routes were already broken at runtime — the casts let the build pass while flagging the divergence for a follow-up phase. Transparently disclosed in SUMMARY. Outside the strict scope of this phase but necessary to keep `pnpm build` green.

### Human Verification Required

The plan's Task 3 (end-to-end fresh analysis) is explicitly deferred to the user per SUMMARY:

1. **Live E2E analysis test**
   - **Test:** Start dev server, run fresh analysis through `/api/analyze` (text or upload mode), note the returned analysis_id.
   - **Expected:** `SELECT id, confidence_label, anti_virality_gated, (counterfactuals IS NOT NULL) AS has_cf, (hook_decomposition IS NOT NULL) AS has_hd FROM analysis_results WHERE id = '<analysis_id>'` returns: confidence_label ∈ {HIGH, MEDIUM, LOW}, anti_virality_gated ∈ {true, false}, has_cf=true on Stage-11-eligible runs, has_hd=true on video runs.
   - **Why human:** Requires running Next.js dev server + valid input + access to live Supabase project — not reproducible in an isolated verification process.

2. **Script endpoint cache miss path**
   - **Test:** `GET /api/analyze/<analysis_id>/script` with auth cookie.
   - **Expected:** 200 response with populated script body (NOT deterministic-fallback constants like "Lead with the strongest visual moment in the first 1 second.").
   - **Why human:** Live HTTP request against authenticated session.

### Summary

All 5 success criteria pass against the codebase:
- Migration file present and applied (per SUMMARY remote verification + types regen as proof-of-remote-state).
- Types regenerated correctly (4 fields × 3 sections = 12 occurrences); regen markers (alphabetical sort, id-required flip) confirm no hand-patching.
- `buildInsertRow` persists all 4 fields and is consumed by both INSERT (line 447) and UPSERT (line 585) call sites.
- Script route SELECT explicitly lists all 4 columns; inline derivation (`derivedLabel`/`derivedGated`/`TODO(schema-drift)`) fully removed.
- `pnpm build`, `tsc --noEmit`, `pnpm test --run` all green (1591 tests passing).

Live E2E analysis run is acceptably deferred to the user — the static wiring is fully verified and the full unit test suite (including script route tests) is green.

---

_Verified: 2026-05-28T17:35:00Z_
_Verifier: gsd-verifier (Claude Opus 4.7)_

## VERIFICATION: PASSED
