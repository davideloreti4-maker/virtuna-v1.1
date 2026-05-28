---
phase: 260528-ntn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260528150000_phase4_schema_drift_engine_columns.sql
  - src/types/database.types.ts
  - src/app/api/analyze/route.ts
  - src/app/api/analyze/[id]/script/route.ts
autonomous: true
requirements:
  - mvp-cut-phase-4-1  # migration applied to remote
  - mvp-cut-phase-4-2  # types regenerated, not hand-patched
  - mvp-cut-phase-4-3  # /api/analyze persists 4 columns non-null on fresh analysis
  - mvp-cut-phase-4-4  # script route SELECTs persisted columns (no inline derivation)
  - mvp-cut-phase-4-5  # pnpm build + tsc --noEmit + pnpm test all green

must_haves:
  truths:
    - "Migration applied to remote Supabase project (analysis_results has 4 new columns)"
    - "database.types.ts Row + Insert + Update include counterfactuals (Json|null), hook_decomposition (Json|null), confidence_label (string|null), anti_virality_gated (boolean|null) — regenerated, not hand-patched"
    - "/api/analyze inserts non-null values for all 4 columns on a fresh test analysis"
    - "Script route SELECTs the 4 columns directly; no inline confidence_label/anti_virality_gated derivation; no TODO(schema-drift) block"
    - "pnpm build, tsc --noEmit, pnpm test all green"
  artifacts:
    - path: "supabase/migrations/20260528150000_phase4_schema_drift_engine_columns.sql"
      provides: "ALTER TABLE adding 4 columns with correct types and comments"
      contains: "ADD COLUMN IF NOT EXISTS counterfactuals"
    - path: "src/types/database.types.ts"
      provides: "regenerated Supabase types containing 4 new fields in analysis_results Row/Insert/Update"
      contains: "counterfactuals: Json | null"
    - path: "src/app/api/analyze/route.ts"
      provides: "buildInsertRow plucking counterfactuals, hook_decomposition, confidence_label, anti_virality_gated from PredictionResult"
      contains: "counterfactuals:"
    - path: "src/app/api/analyze/[id]/script/route.ts"
      provides: "SELECT including 4 columns; AnalysisRow built directly from row; TODO(schema-drift) block removed"
      contains: "counterfactuals, confidence_label, anti_virality_gated, hook_decomposition"
  key_links:
    - from: "supabase/migrations/20260528150000_phase4_schema_drift_engine_columns.sql"
      to: "remote Supabase analysis_results table"
      via: "mcp__supabase__apply_migration"
      pattern: "ADD COLUMN IF NOT EXISTS (counterfactuals|hook_decomposition|confidence_label|anti_virality_gated)"
    - from: "src/app/api/analyze/route.ts buildInsertRow"
      to: "analysis_results INSERT"
      via: "service.from('analysis_results').insert / upsert"
      pattern: "counterfactuals:\\s*finalResult\\.counterfactuals"
    - from: "src/app/api/analyze/[id]/script/route.ts GET"
      to: "analysis_results SELECT"
      via: "supabase.from('analysis_results').select"
      pattern: "counterfactuals,\\s*hook_decomposition,\\s*confidence_label,\\s*anti_virality_gated"
---

<objective>
Persist the four engine-emitted columns the schema dropped on the floor, regenerate Supabase types, and revert the script-route inline derivation workaround (commit 3bf3eb7, landed 2026-05-28).

Purpose: Close schema drift so /api/analyze writes the full engine payload and the script endpoint reads real persisted values instead of computing them from `confidence` at request time. Unblocks downstream phases that depend on `counterfactuals` + `hook_decomposition` being on the row.

Output:
- New migration applied to remote Supabase (4 columns: `counterfactuals` JSONB, `hook_decomposition` JSONB, `confidence_label` TEXT with CHECK, `anti_virality_gated` BOOLEAN).
- Regenerated `src/types/database.types.ts`.
- `buildInsertRow` in `src/app/api/analyze/route.ts` plucking all 4 fields from `PredictionResult`.
- Script route restored to SELECT the 4 columns directly, inline-derivation block removed.
- No backfill (null is fine for historical rows — documented in migration comments).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@CLAUDE.md

<interfaces>
<!-- Engine types the executor needs. Confirmed shapes from src/lib/engine/types.ts. -->

From `src/lib/engine/types.ts`:
```typescript
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export interface PredictionResult {
  // ...
  confidence_label: ConfidenceLevel;                    // REQUIRED — always set
  anti_virality_gated: boolean;                          // REQUIRED — always set
  counterfactuals?: CounterfactualResult | null;         // optional, may be null
  hook_decomposition?: HookDecomposition | null;         // optional, may be null
}

export interface CounterfactualResult {
  band: "low" | "mid" | "high";
  suggestions: CounterfactualSuggestionItem[];
}
// HookDecomposition is re-exported from ./gemini/schemas (Zod-validated, structural Json object).
```

From `src/types/database.types.ts` (analysis_results Insert — current shape, BEFORE this plan's regen):
```typescript
analysis_results: {
  Insert: {
    // ... existing fields ...
    confidence?: number | null
    factors?: Json | null
    // (no counterfactuals, no hook_decomposition, no confidence_label, no anti_virality_gated)
  }
}
```

From `src/app/api/analyze/route.ts:267-323` (current `buildInsertRow` — does NOT include the 4 fields).
Two call sites: line 353 (JSON branch INSERT) and line 502 (SSE branch UPSERT).

From `src/app/api/analyze/[id]/script/route.ts:90-135` (current workaround):
- SELECT omits the 4 columns (lines 95-99)
- AnalysisRow constructed with inline-derived `confidence_label`, `anti_virality_gated`, and forced-null `counterfactuals` + `hook_decomposition` (lines 112-135)
- `TODO(schema-drift)` block at lines 90-94 needs removal

From recent migration `supabase/migrations/20260528113615_add_heatmap_to_analysis_results.sql` — convention:
- Header comment with phase + summary
- `ALTER TABLE public.analysis_results ADD COLUMN IF NOT EXISTS <name> <type>;`
- `COMMENT ON COLUMN ...` for each new column
- No RLS changes (existing policies cover INSERT/SELECT/UPDATE by user_id)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Apply migration + regenerate database.types.ts</name>
  <files>
    supabase/migrations/20260528150000_phase4_schema_drift_engine_columns.sql,
    src/types/database.types.ts
  </files>
  <action>
1. Write the migration file `supabase/migrations/20260528150000_phase4_schema_drift_engine_columns.sql` with the following SQL (column types finalized from engine type inspection — `counterfactuals` and `hook_decomposition` are structural objects → JSONB; `confidence_label` is `"HIGH" | "MEDIUM" | "LOW"` → TEXT with CHECK; `anti_virality_gated` is `boolean` → BOOLEAN):

```sql
-- Phase 4 (MVP Cut) — Schema Drift Fix
-- Persist the four columns the engine has emitted since Phase 9/13 but the DB
-- never stored. Closes the workaround in /api/analyze/[id]/script/route.ts
-- (commit 3bf3eb7, 2026-05-28) which derived confidence_label / anti_virality_gated
-- inline and forced counterfactuals + hook_decomposition to null at request time.
--
-- No backfill: historical rows keep NULL. Script route already handles null
-- counterfactuals via its deterministic fallbacks (computeScript in
-- src/app/api/analyze/[id]/script/route.ts). Newly inserted rows (post-deploy)
-- will be populated by buildInsertRow in src/app/api/analyze/route.ts.

ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS counterfactuals JSONB,
  ADD COLUMN IF NOT EXISTS hook_decomposition JSONB,
  ADD COLUMN IF NOT EXISTS confidence_label TEXT,
  ADD COLUMN IF NOT EXISTS anti_virality_gated BOOLEAN;

-- Enforce the ConfidenceLevel domain at the DB layer.
-- IF NOT EXISTS guard via DO block (PostgreSQL lacks ADD CONSTRAINT IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'analysis_results_confidence_label_check'
  ) THEN
    ALTER TABLE public.analysis_results
      ADD CONSTRAINT analysis_results_confidence_label_check
      CHECK (confidence_label IS NULL OR confidence_label IN ('HIGH', 'MEDIUM', 'LOW'));
  END IF;
END $$;

COMMENT ON COLUMN public.analysis_results.counterfactuals IS
  'CounterfactualResult from Stage 11 (engine src/lib/engine/types.ts:CounterfactualResult): { band: "low"|"mid"|"high", suggestions: CounterfactualSuggestionItem[] }. Null on historical rows + when Stage 11 omitted by engine.';

COMMENT ON COLUMN public.analysis_results.hook_decomposition IS
  'HookDecomposition from Wave 1 hook-segment analysis (engine src/lib/engine/gemini/schemas.ts:HookDecompositionZodSchema). Includes weakest_modality + per-modality scores. Null on historical rows + non-video analyses.';

COMMENT ON COLUMN public.analysis_results.confidence_label IS
  'ConfidenceLevel for UI display: HIGH | MEDIUM | LOW. Derived in aggregator from numeric confidence. Required on every PredictionResult; null only on historical rows pre-Phase-4.';

COMMENT ON COLUMN public.analysis_results.anti_virality_gated IS
  'True when post-critique confidence < ANTI_VIRALITY_THRESHOLD. Surfaces "Don''t post yet" verdict in UI. Required on every PredictionResult; null only on historical rows pre-Phase-4.';
```

2. Apply migration to remote via Supabase MCP. The MCP tool reads the SQL string directly (not the file path):

```
mcp__supabase__apply_migration(
  name="phase4_schema_drift_engine_columns",
  query="<the full SQL above>"
)
```

3. Verify columns exist on the remote project:

```
mcp__supabase__list_tables(schemas=["public"])
```

Confirm `analysis_results` row includes `counterfactuals`, `hook_decomposition`, `confidence_label`, `anti_virality_gated`. If list_tables doesn't return columns, fall back to:

```
mcp__supabase__execute_sql(query="SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='analysis_results' AND column_name IN ('counterfactuals','hook_decomposition','confidence_label','anti_virality_gated') ORDER BY column_name")
```

Expect 4 rows back.

4. Regenerate types from the live remote schema (NOT from the local file — must reflect what the remote actually has post-migration):

```
mcp__supabase__generate_typescript_types()
```

Write the returned `types` string to `src/types/database.types.ts`, fully replacing the existing contents. Do NOT hand-edit the file after writing — the success criterion explicitly forbids hand-patched types.

5. Sanity-check the regenerated file by grepping for the 4 new fields:

```bash
grep -E "(counterfactuals|hook_decomposition|confidence_label|anti_virality_gated)" src/types/database.types.ts | wc -l
```

Expect ≥ 12 hits (each field appears in Row, Insert, Update → 4 fields × 3 = 12 minimum).
  </action>
  <verify>
    <automated>
    set -e
    # Migration file exists
    test -f supabase/migrations/20260528150000_phase4_schema_drift_engine_columns.sql
    grep -q "ADD COLUMN IF NOT EXISTS counterfactuals JSONB" supabase/migrations/20260528150000_phase4_schema_drift_engine_columns.sql
    grep -q "ADD COLUMN IF NOT EXISTS hook_decomposition JSONB" supabase/migrations/20260528150000_phase4_schema_drift_engine_columns.sql
    grep -q "ADD COLUMN IF NOT EXISTS confidence_label TEXT" supabase/migrations/20260528150000_phase4_schema_drift_engine_columns.sql
    grep -q "ADD COLUMN IF NOT EXISTS anti_virality_gated BOOLEAN" supabase/migrations/20260528150000_phase4_schema_drift_engine_columns.sql
    grep -q "analysis_results_confidence_label_check" supabase/migrations/20260528150000_phase4_schema_drift_engine_columns.sql
    # Types regenerated — 4 fields each in Row, Insert, Update
    test "$(grep -cE 'counterfactuals\?:|counterfactuals:' src/types/database.types.ts)" -ge 3
    test "$(grep -cE 'hook_decomposition\?:|hook_decomposition:' src/types/database.types.ts)" -ge 3
    test "$(grep -cE 'confidence_label\?:|confidence_label:' src/types/database.types.ts)" -ge 3
    test "$(grep -cE 'anti_virality_gated\?:|anti_virality_gated:' src/types/database.types.ts)" -ge 3
    # tsc still typechecks (no hand-patches broke anything)
    npx tsc --noEmit
    </automated>
  </verify>
  <done>
    - Migration file written with 4 ALTER TABLE adds + CHECK constraint + 4 column comments.
    - Migration applied successfully to remote (apply_migration returns no error).
    - information_schema query confirms 4 columns on remote analysis_results.
    - `src/types/database.types.ts` fully regenerated from remote schema; contains all 4 new field names in Row + Insert + Update.
    - `tsc --noEmit` is green (types compile cleanly).
  </done>
</task>

<task type="auto">
  <name>Task 2: Persist 4 columns in buildInsertRow + revert script-route workaround</name>
  <files>
    src/app/api/analyze/route.ts,
    src/app/api/analyze/[id]/script/route.ts
  </files>
  <action>
**Part A — `src/app/api/analyze/route.ts`:**

In the `buildInsertRow` arrow function (currently lines 267-323), append the 4 new fields to the returned object (place after the existing `heatmap:` line, before the closing `})`):

```typescript
// Phase 4 (MVP Cut) — Schema Drift Fix: persist the four engine-emitted fields
// the DB previously dropped on the floor. Reverts the inline workaround in
// /api/analyze/[id]/script/route.ts (commit 3bf3eb7).
// counterfactuals + hook_decomposition: structural Json — cast required because
// the engine types (CounterfactualResult, HookDecomposition) are typed narrowly
// while the DB column is Json. Pattern matches the existing
// `behavioral_predictions as unknown as null` casts above.
counterfactuals: (finalResult.counterfactuals ?? null) as unknown as Json,
hook_decomposition: (finalResult.hook_decomposition ?? null) as unknown as Json,
// confidence_label + anti_virality_gated are REQUIRED on PredictionResult
// (always populated by aggregator). No null coalesce needed.
confidence_label: finalResult.confidence_label,
anti_virality_gated: finalResult.anti_virality_gated,
```

Both call sites — `service.from("analysis_results").insert(buildInsertRow(...))` at line ~353 and `service.from("analysis_results").upsert({ ...buildInsertRow(...), id: analysisId }, ...)` at line ~502 — pick the new fields up automatically (no other changes in route.ts).

**Part B — `src/app/api/analyze/[id]/script/route.ts`:**

Revert commit 3bf3eb7's workaround. Three edits:

1. Delete the `TODO(schema-drift)` comment block at lines 90-94 (the "TODO(schema-drift): `counterfactuals` and `hook_decomposition` are produced by the engine but not persisted..." block).

2. Restore the SELECT to include the 4 columns. Change:
```typescript
.select(
  'id, factors, reasoning, confidence, engine_version, script_result',
)
```
to:
```typescript
.select(
  'id, counterfactuals, factors, reasoning, confidence, confidence_label, anti_virality_gated, hook_decomposition, engine_version, script_result',
)
```

3. Delete the inline-derivation block (lines 112-135 — the `derivedLabel`, `derivedGated`, and the spread-with-overrides construction of `row`). Replace with a direct cast:

```typescript
const row = data as unknown as AnalysisRow;
```

The `AnalysisRow` interface declaration at lines 58-69 stays as-is — its shape already matches the SELECT (no change needed; it was the contract all along).

Final code shape (the SELECT block through `row` assignment, ~30 lines becomes ~12):

```typescript
const { data, error } = await supabase
  .from('analysis_results')
  .select(
    'id, counterfactuals, factors, reasoning, confidence, confidence_label, anti_virality_gated, hook_decomposition, engine_version, script_result',
  )
  .eq('id', id)
  .eq('user_id', user.id)
  .maybeSingle();

if (error || !data) {
  log.warn('script_endpoint_select_failed', {
    analysis_id: id,
    error: error?.message ?? 'no row',
  });
  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}

const row = data as unknown as AnalysisRow;
```

No changes needed below this point — `computeScript(row)` already consumes the real columns.

**Part C — Test impact check (no edits expected):**

The existing test fixtures in `src/app/api/analyze/[id]/script/__tests__/route.test.ts` mock the Supabase chain directly (return `row` from `maybeSingle()`), and `baseRow` already includes all 4 fields set to defaults. The test comments at lines 165-168 and 202-203 (which reference the inline-derivation workaround) are now stale but their **assertions still hold**:
- Test 3 (high-confidence empty state): `confidence_label: 'LOW'` from baseRow gets overridden by test-specific row → but wait: test 3 only overrides `confidence: 0.85`, NOT `confidence_label`. Under the new behavior, the route reads `confidence_label` directly from the row, so `confidence_label` stays `'LOW'` and the empty-state branch (requires `'HIGH'`) does NOT fire. THIS TEST WILL BREAK.

Update test 3 to set `confidence_label: 'HIGH'` and `anti_virality_gated: false` explicitly:

```typescript
// in test 3, inside the row spread:
row: {
  ...baseRow,
  confidence: 0.85,
  confidence_label: 'HIGH',
  anti_virality_gated: false,
  factors: [ /* unchanged */ ],
},
```

Also tidy the now-stale comment at lines 165-168 — replace with a one-liner: `// counterfactuals null → opening_variants sourced from hook/opening factors (computeScript fallback path).`

Test 4 (low-confidence gating): currently sets `confidence: 0.3` only. The assertion is `is_empty_state).toBe(false)`. With baseRow's `confidence_label: 'LOW'` + `anti_virality_gated: false`, the empty-state branch still doesn't fire (needs HIGH). Assertion holds. Update stale comment at line 202-203 → `// low-confidence row: confidence_label 'LOW' inherently excludes the empty-state branch.`

Tests 1, 2, 5-10 are unaffected.
  </action>
  <verify>
    <automated>
    set -e
    # buildInsertRow now persists all 4 fields
    grep -E "counterfactuals:\s*\(finalResult" src/app/api/analyze/route.ts
    grep -E "hook_decomposition:\s*\(finalResult" src/app/api/analyze/route.ts
    grep -E "confidence_label:\s*finalResult\.confidence_label" src/app/api/analyze/route.ts
    grep -E "anti_virality_gated:\s*finalResult\.anti_virality_gated" src/app/api/analyze/route.ts
    # Script route workaround reverted
    grep -E "counterfactuals,\s*factors,\s*reasoning,\s*confidence,\s*confidence_label,\s*anti_virality_gated,\s*hook_decomposition" src/app/api/analyze/\[id\]/script/route.ts
    # Inline derivation block deleted
    ! grep -q "derivedLabel" src/app/api/analyze/\[id\]/script/route.ts
    ! grep -q "derivedGated" src/app/api/analyze/\[id\]/script/route.ts
    ! grep -q "TODO(schema-drift)" src/app/api/analyze/\[id\]/script/route.ts
    # Type + build + test all green
    npx tsc --noEmit
    pnpm test -- src/app/api/analyze/__tests__/route.test.ts src/app/api/analyze/\[id\]/script/__tests__/route.test.ts
    pnpm build
    </automated>
  </verify>
  <done>
    - `buildInsertRow` includes 4 new fields (counterfactuals, hook_decomposition, confidence_label, anti_virality_gated).
    - Both insert call sites (JSON branch line ~353, SSE branch line ~502) pick up the new fields via the shared builder (no per-site edits needed).
    - Script route SELECT lists the 4 columns explicitly.
    - Inline derivation block removed (no `derivedLabel`, no `derivedGated`, no `TODO(schema-drift)` block).
    - Script route tests updated (test 3 sets `confidence_label: 'HIGH'`; stale comments cleaned).
    - `tsc --noEmit` green, targeted tests green, `pnpm build` green.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: End-to-end verify on fresh analysis</name>
  <what-built>
    Migration applied to remote Supabase. /api/analyze now writes 4 previously-dropped columns (counterfactuals, hook_decomposition, confidence_label, anti_virality_gated). Script route reads them directly. Inline workaround from commit 3bf3eb7 reverted.
  </what-built>
  <how-to-verify>
    1. Run a fresh analysis end-to-end through the running app (any input mode — text or upload). Note the returned `analysis_id`.
    2. Verify the 4 columns are non-null on that row. Run via Supabase MCP:
       ```
       mcp__supabase__execute_sql(query="SELECT id, confidence_label, anti_virality_gated, (counterfactuals IS NOT NULL) AS has_cf, (hook_decomposition IS NOT NULL) AS has_hd FROM analysis_results WHERE id = '<analysis_id>'")
       ```
       Expect: `confidence_label` ∈ {HIGH, MEDIUM, LOW}, `anti_virality_gated` ∈ {true, false}.
       Expect: `has_cf` = true on Stage-11-eligible runs (counterfactuals is `optional?` on the engine — text-only analyses may legitimately leave it null; video runs should populate it).
       Expect: `has_hd` = true on video runs (null on text-only — also legitimate).
    3. Hit the script endpoint for that analysis: `GET /api/analyze/<analysis_id>/script` (via app or `curl` with the auth cookie). Confirm 200 response with a populated `script` body (NOT the deterministic-fallback constants like "Lead with the strongest visual moment in the first 1 second").
    4. Final guard — full suite + build:
       ```
       pnpm test
       pnpm build
       npx tsc --noEmit
       ```
       All three must be green.
    5. (Optional but recommended) Check Supabase MCP advisors for any new lint warnings introduced by the migration:
       ```
       mcp__supabase__get_advisors(type="lint")
       ```
  </how-to-verify>
  <resume-signal>Type "approved" once steps 1-4 pass, or describe what failed.</resume-signal>
</task>

</tasks>

<verification>
1. Migration file applied to remote (information_schema confirms 4 columns).
2. `database.types.ts` regenerated from remote, contains all 4 fields in Row/Insert/Update — no hand patches.
3. `buildInsertRow` plucks all 4 fields from `PredictionResult`.
4. Script route SELECTs the 4 columns; inline derivation + `TODO(schema-drift)` block deleted.
5. Fresh analysis run produces non-null values on the row.
6. `pnpm test` green, `pnpm build` green, `tsc --noEmit` 0 errors.
</verification>

<success_criteria>
1. Migration applied to remote Supabase project — confirmed via information_schema query.
2. `database.types.ts` regenerated from remote schema; no hand-patched types (file matches `mcp__supabase__generate_typescript_types()` output verbatim).
3. Fresh `/api/analyze` run persists non-null values for `confidence_label` + `anti_virality_gated` (always required on PredictionResult); `counterfactuals` + `hook_decomposition` non-null on video-mode runs (legitimate null on text-only).
4. Script route SELECTs `counterfactuals, hook_decomposition, confidence_label, anti_virality_gated` directly; no `derivedLabel` / `derivedGated` / `TODO(schema-drift)` strings remain in the file.
5. `pnpm build` + `tsc --noEmit` + `pnpm test` all green.
</success_criteria>

<output>
After completion, create `.planning/quick/260528-ntn-phase-4-schema-drift-fix-persist-4-engin/260528-ntn-SUMMARY.md` documenting:
- Migration filename + the 4 columns added (with types + CHECK constraint).
- Files modified: route.ts (buildInsertRow), script/route.ts (workaround revert), database.types.ts (regen), test file (1 test fixture updated).
- Backfill decision: NONE — historical rows keep NULL per success criteria + plan.
- Link back to commit 3bf3eb7 (the workaround being reverted).
</output>
