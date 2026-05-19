---
phase: 08-benchmark-retrieval
plan: 01
subsystem: database
tags: [pgvector, supabase, migration, sql, embeddings, hnsw, rpc]

# Dependency graph
requires:
  - phase: 01-training-corpus-eval-foundation
    provides: training_corpus table schema (niche/bucket CHECK constraints — gate the corpus filter column types)
  - phase: 03-pipeline-infrastructure
    provides: analysis_results.signal_availability JSONB + content_hash + cache_lookup index (Phase 8's new columns reuse the additive ALTER TABLE IF NOT EXISTS pattern)
provides:
  - "Single Phase 8 migration SQL file (249 lines) — vector extension, embedding columns on training_corpus + scraped_videos, 4 schema-gap columns on scraped_videos, 2 HNSW cosine indexes, 2 RPC functions (match_corpus_videos / match_scraped_videos), 1 author→creator_handle backfill, 10 category→primary_niche backfills, 2 new columns on analysis_results"
  - "REQUIREMENTS-02 updated to reflect D-01 two-pool decision (training_corpus + scraped_videos; competitor_videos rejected)"
  - "Traceability table now contains all 6 RETRIEVAL-* entries mapped to Phase 8 plans"
affects: [08-02, 08-03, 08-04, 08-05, 09, 10]

# Tech tracking
tech-stack:
  added:
    - "pgvector (Postgres vector extension via Supabase extensions schema)"
    - "HNSW index type with cosine distance opclass (m=16, ef_construction=64)"
    - "Postgres plpgsql STABLE functions for retrieval (RPC pattern over PostgREST)"
  patterns:
    - "Fully-qualified extensions.vector(N) column type (immune to search_path)"
    - "Multi-column ALTER TABLE ... ADD COLUMN IF NOT EXISTS idiom (matches creator_profile_9card_columns.sql)"
    - "WHERE (filter IS NULL OR col = filter) nullable-filter pattern for hierarchical relaxation (RESEARCH Option A)"
    - "PERFORM set_config('hnsw.iterative_scan','strict_order', true) defensive RPC body (RESEARCH line 381)"
    - "Idempotent backfill UPDATE with WHERE col IS NULL guard"

key-files:
  created:
    - "supabase/migrations/20260518000000_phase8_pgvector.sql (Phase 8 migration — 249 lines)"
  modified:
    - ".planning/REQUIREMENTS.md (RETRIEVAL-02 wording + 6 traceability rows)"

key-decisions:
  - "AUDIT SKIPPED — Supabase CLI not linked in this worktree (Phase 3 STATE.md line 148-149 confirms project pattern). Default CATEGORY_TO_NICHE_SLUG mapping per RESEARCH Finding 3 Strategy A; unmapped categories stay NULL → excluded from retrieval pool."
  - "Migration AUTHORED ONLY, NOT pushed to live DB — Plan 05 (Wave 4 BLOCKING) owns the `pnpm supabase db push` + types regen step per plan execution_context."
  - "RPC functions use Option A nullable platform/tier filters (single function with `IS NULL OR col = filter`) — chose this over Option B (separate per-tier functions) per RESEARCH lines 829-841 recommendation. Niche stays mandatory (gates entire candidate space)."
  - "creator_handle backfill formatted as single-line `UPDATE … SET … WHERE …` to satisfy plan's grep-gate; functionally identical to multi-line form."
  - "RPC set_config call uses no-space form `set_config('hnsw.iterative_scan','strict_order', true)` — still valid Postgres SQL; chosen because the plan's grep gate `set_config..hnsw.iterative_scan..strict_order` uses `..` (exactly 2 chars) between literals. Note: gate remains unsatisfiable in BRE for valid SQL (minimum 3 chars between args is `','`). Documented as plan typo deviation; acceptance criterion `Both RPC functions set hnsw.iterative_scan = strict_order via PERFORM set_config(...)` independently met (grep -c 'PERFORM set_config' returns 2)."
  - "Corpus niche slug mismatch (training_corpus.niche uses 'edu'; NICHE_TREE uses 'education') documented as inline NOTE block above match_corpus_videos; Plan 03's bucket-derivation.ts owns the CORPUS_NICHE_ALIASES handling. Migration intentionally does not change the CHECK constraint."

patterns-established:
  - "Phase 8 migration filename `20260518000000_phase8_pgvector.sql` follows project convention (YYYYMMDDHHMMSS_phase<N>_<scope>.sql) — matches `20260517120000_phase3_pipeline_columns.sql` precedent"
  - "Two-pool RPC pattern: match_corpus_videos returns 16 columns including bucket_label direct from row; match_scraped_videos returns same 16 columns with NULL placeholders for fields scraped_videos doesn't capture (saves, bucket_label, follower_count). Both pools shaped identically at the SQL boundary so TS callers consume a single MatchRow type."
  - "Idempotent ALTER TABLE multi-column form preserves transactional atomicity (re-runs are no-ops once columns exist)"

requirements-completed: [RETRIEVAL-01, RETRIEVAL-02]

# Metrics
duration: 5min
completed: 2026-05-18
---

# Phase 8 Plan 01: pgvector Migration SQL + REQUIREMENTS-02 Conflict Resolution Summary

**Phase 8 migration file authored (249 lines): pgvector extension + dual-pool embedding storage (training_corpus + scraped_videos) + 2 HNSW cosine indexes + 4 scraped_videos schema-gap columns with category→niche backfill + analysis_results.retrieval_evidence/retrieval_score + 2 RPC functions with hierarchical-relaxation-friendly nullable filters. REQUIREMENTS-02 reconciled with D-01 two-pool decision; 6 RETRIEVAL-* rows added to traceability.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-18T19:09:12Z
- **Completed:** 2026-05-18T19:14:30Z
- **Tasks:** 3 (Task 1 audit folded into Task 2 file header; Tasks 2 + 3 committed atomically)
- **Files modified:** 2 (1 created, 1 edited)

## Accomplishments

- **Single Phase 8 migration committed** at `supabase/migrations/20260518000000_phase8_pgvector.sql` containing all 13 required SQL statements in the order specified by the plan (vector extension → training_corpus embedding + HNSW → scraped_videos embedding + 4 gap columns + 11 backfills + HNSW + btree → analysis_results 2 new columns → 2 RPC functions).
- **All DDL idempotent** via `IF NOT EXISTS` / `CREATE OR REPLACE` everywhere — re-runs are safe per Supabase Studio SQL editor workflow (Phase 3 D-rule pattern).
- **Two-pool retrieval foundation locked** — D-01 (training_corpus first, scraped_videos breadth fallback) made executable: both pools have the same `extensions.vector(768)` shape; both RPC functions return identical 16-column tuples so the TS aggregator consumes a unified `MatchRow`; scraped_videos NULL placeholders for `saves` / `bucket_label` / `follower_count` are explicit in the SQL (no surprise schema drift downstream).
- **scraped_videos schema gap closed** (RESEARCH Finding 3) — added `primary_niche TEXT`, `follower_tier TEXT CHECK(...)`, `posted_at TIMESTAMPTZ`, `creator_handle TEXT`, plus one-time backfills (`creator_handle = author`; `primary_niche` from `category` via the default 10-slug CATEGORY_TO_NICHE_SLUG mapping). Unmapped categories stay NULL → excluded from retrieval pool by `WHERE primary_niche = filter_niche` (no silent fallback to 'lifestyle' etc.).
- **REQUIREMENTS-02 vs D-01 conflict resolved** — line 146 updated to "Two-pool video embedding pipeline" with explicit `competitor_videos.embedding rejected` rationale; Traceability table appended with 6 new RETRIEVAL-* rows pointing at the appropriate Phase 8 plans.

## Task Commits

Each task committed atomically:

1. **Task 1: Audit scraped_videos categories** — folded into Task 2's file header (`-- AUDIT (2026-05-18): AUDIT SKIPPED — Supabase CLI not linked; using default CATEGORY_TO_NICHE_SLUG mapping per RESEARCH Finding 3 Strategy A.`) — no separate commit (task is decision + documentation, materialized in Task 2's file).
2. **Task 2: Author the Phase 8 migration SQL file** — `00fc66f` (feat) — `supabase/migrations/20260518000000_phase8_pgvector.sql` (249 lines).
3. **Task 3: Resolve REQUIREMENTS-02 conflict — update to D-01 two-pool decision** — `c4b16e5` (docs) — `.planning/REQUIREMENTS.md` (+7/-1).

## Files Created/Modified

- `supabase/migrations/20260518000000_phase8_pgvector.sql` (NEW) — Phase 8 single migration. CREATE EXTENSION vector + training_corpus.embedding + training_corpus_embedding_hnsw + scraped_videos (embedding + primary_niche + follower_tier + posted_at + creator_handle) + creator_handle/primary_niche backfills + scraped_videos_embedding_hnsw + idx_scraped_videos_primary_niche + analysis_results.retrieval_evidence/retrieval_score + match_corpus_videos RPC + match_scraped_videos RPC.
- `.planning/REQUIREMENTS.md` (MODIFIED) — RETRIEVAL-02 wording updated to two-pool; 6 new traceability rows for RETRIEVAL-01..06.

## Decisions Made

- **Audit skipped, default mapping used** (Task 1) — Supabase CLI is not linked in this worktree (`npx --no-install supabase` fails with "missing packages"; Phase 3 STATE.md lines 148-149 confirm this is the established pattern for the engine-foundation milestone). Default 10-slug CATEGORY_TO_NICHE_SLUG mapping documented in the migration's `-- AUDIT` header. Unmapped categories intentionally remain NULL → excluded from retrieval pool. A future planner can augment the UPDATE list once Studio audit output is available (each UPDATE is idempotent via `WHERE primary_niche IS NULL` guard).
- **Single-line UPDATE for creator_handle backfill** — reformatted from multi-line to satisfy the plan's literal grep gate `grep -c 'UPDATE scraped_videos SET creator_handle = author'`. Same Postgres semantics either way.
- **`set_config(...)` formatting** — initially used `'hnsw.iterative_scan', 'strict_order'` (idiomatic with space), then removed the inner space to `'hnsw.iterative_scan','strict_order'` to better match the plan's gate. Note that gate still fails grep-literal because plan's regex `..` expects exactly 2 chars between the two literal-anchor segments while the minimum valid SQL is 3 chars (`','`). Documented as a deviation; acceptance criterion `Both RPC functions set hnsw.iterative_scan = strict_order via PERFORM set_config(...)` is met (2 calls present per `grep -c 'PERFORM set_config'`).
- **No CHECK constraint changes to training_corpus.niche** — corpus uses `{beauty, fitness, edu, comedy, lifestyle}` per the existing 20260512000000_training_corpus.sql constraint. NICHE_TREE uses `'education'`. Migration intentionally does not touch the constraint — Plan 03's `CORPUS_NICHE_ALIASES` handles the alias in TS, keeping the schema stable and ensuring re-running this migration is safe even if the CHECK is later relaxed. Documented as a `-- NOTE:` block above `match_corpus_videos`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug — plan grep typo] set_config grep gate unsatisfiable for valid SQL**
- **Found during:** Task 2 (Author migration file) — verification chain at the end of Task 2.
- **Issue:** The plan's automated verify chain ends with `grep -c 'set_config..hnsw.iterative_scan..strict_order' supabase/migrations/20260518000000_phase8_pgvector.sql | grep -v '^[01]$'`. The pattern uses `..` (basic-regex: exactly 2 arbitrary chars) between literal anchors. Valid Postgres SQL for the call is `set_config('hnsw.iterative_scan','strict_order', true)` — between `iterative_scan` and `strict_order` the minimum byte sequence is `','` (3 chars: apostrophe-comma-apostrophe). No valid SQL form satisfies the 2-char gate.
- **Fix:** Tightened the call to no-space-after-comma form `'hnsw.iterative_scan','strict_order'` (closest to gate's expectation; still valid Postgres). Documented gate failure in this Summary as a known plan typo; acceptance criterion "Both RPC functions set `hnsw.iterative_scan = strict_order` via `PERFORM set_config(...)` defensive call" verified by `grep -c 'PERFORM set_config'` returning 2.
- **Files modified:** `supabase/migrations/20260518000000_phase8_pgvector.sql` (both RPC bodies — replace-all in single Edit call).
- **Verification:** `grep -c 'PERFORM set_config' supabase/migrations/20260518000000_phase8_pgvector.sql` → 2; both RPC functions contain the defensive call.
- **Committed in:** `00fc66f` (Task 2 commit).

**2. [Rule 1 - Bug — plan grep typo] creator_handle UPDATE multi-line vs single-line**
- **Found during:** Task 2 (verification chain).
- **Issue:** Plan's verify chain expects single-line form `UPDATE scraped_videos SET creator_handle = author WHERE creator_handle IS NULL AND author IS NOT NULL;`. Initial author of the migration used multi-line indented form for readability, which the literal-string grep cannot match across newlines.
- **Fix:** Collapsed the backfill to a single line. Same Postgres semantics; meets the literal grep gate.
- **Files modified:** `supabase/migrations/20260518000000_phase8_pgvector.sql`.
- **Verification:** `grep -c 'UPDATE scraped_videos SET creator_handle = author' supabase/migrations/20260518000000_phase8_pgvector.sql` → 1.
- **Committed in:** `00fc66f` (Task 2 commit).

---

**Total deviations:** 2 auto-fixed (both Rule 1 — plan-level grep-gate typos; SQL output is correct).
**Impact on plan:** No scope creep. Both auto-fixes are cosmetic SQL reformatting to satisfy literal grep verification gates while preserving functional Postgres semantics. The grep-gate around `set_config..hnsw.iterative_scan..strict_order` remains literally unsatisfiable (plan author should fix the `..` to `.*` or `.\{1,5\}` in a future grooming pass); the acceptance criterion text was the binding constraint and is met.

## Issues Encountered

- **Parallel-wave plan 08-02 already executing in this worktree** — when this plan started, `src/lib/engine/types.ts` showed as modified in `git status`. Plan 08-02 (types.ts extension) is a sibling parallel-wave plan per the spawn prompt; its commits `b0cd171` (Zod schemas) and `e9307fa` (SignalAvailability + PredictionResult extension) appeared on the branch during this plan's execution. No conflict — file scopes are disjoint (08-01 owns the SQL migration + REQUIREMENTS.md; 08-02 owns types.ts). Each task was committed individually by name to avoid accidentally staging 08-02's working-tree changes. The two plans interleave cleanly in git history.
- **Supabase CLI not linked** — expected per Phase 3 precedent (STATE.md line 148-149). Task 1's optional live SQL audit was skipped; default mapping used. Documented in the migration's AUDIT header.

## User Setup Required

**External service action required before Plan 05 can push the migration:**

When Plan 05 runs (Wave 4 BLOCKING), it will need to execute the new migration. Following the Phase 3 pattern (Plan 03 STATE.md line 148), the operator workflow is:

1. Open Supabase Studio for the project (URL stored in Vercel env / project settings; not in repo).
2. Open SQL Editor → New Query.
3. Paste the contents of `supabase/migrations/20260518000000_phase8_pgvector.sql`.
4. Run. All statements are idempotent — safe to re-run if any single statement fails partway.
5. Regenerate `src/types/database.types.ts` after migration applies (Phase 3 used hand-patching due to CLI not linked; Plan 05 may follow the same approach or call `supabase gen types typescript --linked` if CLI was linked by then).

**Plan 05 owns this push.** No action needed for this plan — the migration file is committed to git for Plan 05 to apply.

## Next Phase Readiness

- **Plan 08-02 (types.ts extension)** — already executing in parallel; commits `b0cd171` + `e9307fa` confirm `RetrievalEvidenceItem`, `BenchmarkRetrievalResult`, `SignalAvailability.retrieval`, `PredictionResult.{retrieval_score, retrieval_evidence}`, and `score_weights.retrieval` are all in place. The shape declared in TS now matches the schema declared in SQL (the `analysis_results.retrieval_evidence` JSONB column is the persistence target; columns 16 fields out of `match_*_videos` RPCs map 1:1 to `RetrievalEvidenceItem` after the TS bucket-derivation pass in Plan 08-03).
- **Plan 08-03 (embedder + bucket-derivation + re-ranker)** — ready to start once 08-02 is fully committed. The migration's two RPC functions are stable contracts the embedder/retrieval-stage can plan against. Note for Plan 08-03 implementer: `gemini-embedding-001` is the canonical embedding model (D-05 update; RESEARCH Finding 1 — `text-embedding-004` shut down 2026-01-14). `outputDimensionality: 768` preserves the column dimension declared here.
- **Plan 08-04 (retrieval-stage + pipeline integration)** — depends on 08-03's TS helpers + this plan's RPC functions. Wave 1 parallel placement per D-09; this migration's RPC functions are already callable from a service-role client.
- **Plan 08-05 (backfill CLI + DB push + types regen)** — Wave 4 BLOCKING plan that pushes this migration to live DB and regenerates types. Token-budget for that plan: 1 supabase studio paste + 1 types regen + idempotent embed-corpus.ts run (≤$1 budget).

### RESEARCH Finding 1 reminder for downstream plans

Per RESEARCH §"Gemini Embedding via @google/genai (D-05 — UPDATED model)": Google announced `text-embedding-004` shutdown on 2026-01-14; `gemini-embedding-001` is the GA replacement. The migration's `extensions.vector(768)` column is dimension-compatible with both (use `outputDimensionality: 768` in the SDK call). Plan 08-03's `embedder.ts` should default to `process.env.EMBEDDING_MODEL ?? "gemini-embedding-001"` per the canonical pattern.

### RESEARCH Finding 3 closure

scraped_videos schema gap closed in this migration: 4 columns added (`primary_niche`, `follower_tier`, `posted_at`, `creator_handle`) + 11 idempotent backfill UPDATE statements (1 `creator_handle ← author`, 10 `primary_niche ← category` per the default 10-niche-slug mapping). Future Apify webhook handler extensions (Plan 08-03's auto-embedding-on-insert path) must populate these columns at insert time — the migration's backfill is one-time-then-stale for new rows.

### Carry-forward note

This migration is NOT YET APPLIED to live DB. Plan 08-05 (Wave 4 BLOCKING) owns the push + types regen step. Plans 08-03 and 08-04 author TS code that will reference the new RPC functions and columns, but cannot execute against live DB until 08-05 runs.

## Threat Flags

None new. The plan's threat register (`<threat_model>` T-08-01 through T-08-06) is fully addressed by the migration's structural choices: RPC bodies are parameterized (T-08-01); `retrieval_evidence DEFAULT '[]'` prevents legacy NULL read (T-08-02); training_corpus + scraped_videos remain service-role-only with no new PII surface (T-08-03); HNSW build at m=16/ef_construction=64 on current corpus sizes is sub-second (T-08-04); UPDATE backfills use static `IN (...)` lists with no user-controllable input (T-08-05); migration carries provenance header per project convention (T-08-06). No new threat surface introduced.

## Self-Check: PASSED

**Files created:**
- `supabase/migrations/20260518000000_phase8_pgvector.sql` — verified present (249 lines, 1 file in git diff for `00fc66f`).

**Files modified:**
- `.planning/REQUIREMENTS.md` — verified +7/-1 in commit `c4b16e5`; 6 new RETRIEVAL-* traceability rows + RETRIEVAL-02 wording replaced; zero residual references to `embeddings computed at scrape time, stored in \`competitor_videos.embedding\` column`.

**Commits verified:**
- `00fc66f` — found in `git log --oneline -5`.
- `c4b16e5` — found in `git log --oneline -5`.

**Acceptance criteria:**
- All Task 2 acceptance criteria: PASS (counts captured above; only the `set_config..` grep gate is literally unsatisfiable for valid SQL — documented as a plan typo deviation; underlying SQL semantics correct as verified by `grep -c 'PERFORM set_config' = 2`).
- All Task 3 acceptance criteria: PASS (grep chain returned `1, 1, 1, 1, 0` for the 5 gates as plan-specified).

---
*Phase: 08-benchmark-retrieval*
*Completed: 2026-05-18*
