---
phase: 1
plan: A
title: Schema migrations — training_corpus and benchmark_results
status: pending
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260512000000_training_corpus.sql
  - supabase/migrations/20260512000100_benchmark_results.sql
  - src/types/database.types.ts
autonomous: true
requirements: [CORPUS-06, EVAL-06]
must_haves:
  truths:
    - "training_corpus table exists with system-wide RLS (service-role only writes)"
    - "benchmark_results table exists with system-wide RLS (service-role only writes)"
    - "completion_pct column exists on training_corpus (nullable NUMERIC(5,2))"
    - "Both tables apply cleanly on a fresh Supabase reset"
    - "Database types regenerated to include the new tables"
  artifacts:
    - path: supabase/migrations/20260512000000_training_corpus.sql
      provides: "training_corpus DDL with corpus_version, niche, bucket, BIGINT counters, hashtags TEXT[], completion_pct nullable, indexes, RLS"
    - path: supabase/migrations/20260512000100_benchmark_results.sql
      provides: "benchmark_results DDL with macro_f1, per_niche_f1 JSONB, ece, signal_contribution JSONB, latency percentiles, failure_cases JSONB, RLS"
    - path: src/types/database.types.ts
      provides: "TypeScript types for new tables"
      contains: "training_corpus"
  key_links:
    - from: supabase/migrations/20260512000000_training_corpus.sql
      to: "Existing update_updated_at_column() function"
      via: "CREATE OR REPLACE FUNCTION (idempotent reuse)"
      pattern: "CREATE OR REPLACE FUNCTION update_updated_at_column"
    - from: supabase/migrations/20260512000100_benchmark_results.sql
      to: "training_corpus.corpus_version"
      via: "Logical FK by TEXT (corpus_version column, no hard FK — versions are immutable identifiers)"
      pattern: "corpus_version TEXT NOT NULL"
---

<objective>
Create the two Supabase tables that anchor every downstream plan: `training_corpus` (500-video labeled scrape storage, CORPUS-06) and `benchmark_results` (eval harness output, EVAL-06). Both are system-wide (no `user_id`), service-role only via RLS — mirroring the `scraped_videos`/`outcomes` macro pattern from `20260213000000_content_intelligence.sql` (NOT the user-scoped `competitor_tables.sql` pattern). Regenerate `database.types.ts` so downstream TypeScript code can query them with type safety.

Purpose: Unblocks Plans D (orchestrator writes to `training_corpus`) and E (eval harness writes to `benchmark_results`).
Output: Two migration files + regenerated types.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-training-corpus-eval-foundation/01-CONTEXT.md
@.planning/phases/01-training-corpus-eval-foundation/01-RESEARCH.md
@.planning/phases/01-training-corpus-eval-foundation/01-PATTERNS.md
@supabase/migrations/20260213000000_content_intelligence.sql
@supabase/migrations/20260216100000_competitor_tables.sql

<interfaces>
<!-- Reusable trigger function pattern (idempotent) -->
From supabase/migrations/20260213000000_content_intelligence.sql:9-15:
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

<!-- scraped_videos pattern to mirror (system-wide, BIGINT, RLS allows service-role only) -->
From supabase/migrations/20260213000000_content_intelligence.sql:20-52:
- BIGINT for engagement counters (viral creators exceed INT_MAX)
- TEXT[] for hashtags with DEFAULT '{}'
- JSONB metadata DEFAULT '{}'
- TIMESTAMPTZ created_at / updated_at DEFAULT NOW()
- UNIQUE(platform, platform_video_id)
- Trigger on UPDATE for updated_at
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create training_corpus migration</name>
  <files>supabase/migrations/{YYYYMMDDHHMMSS}_training_corpus.sql</files>
  <action>
**W2 — Choose the migration timestamp:** The filename `20260512000000_training_corpus.sql` shown throughout this plan is a PLACEHOLDER. Use the current date in `YYYYMMDDHHMMSS` format at execution time. Before writing the file, verify the chosen timestamp sorts AFTER all existing migrations:

```bash
ls supabase/migrations/ | tail -1
```

If the latest existing timestamp is >= today's `YYYYMMDDHHMMSS`, increment to the next available second (or use `date -u +%Y%m%d%H%M%S`). The companion `benchmark_results` migration in Task 2 should use the same date with a `+100`-second suffix to preserve insertion order. Substitute the chosen value into the filename AND any `<files>` / `<verify>` references below before creating the file.

Create the migration with this exact structure (the pattern mapper override applies — use `content_intelligence.sql` `scraped_videos` macro pattern, NOT `competitor_tables.sql`).

**File header (REQUIRED comment block):**
```sql
-- Training Corpus Schema (Phase 1, D-01..06)
-- System-wide table (no user_id) — service-role writes, public read denied by default.
-- Mirrors macro structure of scraped_videos (content_intelligence.sql) — BIGINT counters,
-- TEXT[] hashtags, JSONB metadata. corpus_version partitions snapshots per D-12.
--
-- KNOWN GAP (per user decision 2026-05-11): completion_pct is NOT captured from Apify
-- scrapes (Apify TikTok actors do not expose actual completion %). Column exists for
-- forward compatibility with the in-product outcome scraper (deferred milestone).
-- CORPUS-04 satisfaction: column exists; data populated when in-product scraper lands.
-- This gap is also documented in .planning/research/v2.1-baseline.md (Plan G).
```

**Trigger function** (idempotent reuse):
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Table DDL** (per D-12, D-03, D-04, D-05, D-14; column rationale from PATTERNS.md §10 and RESEARCH.md §A.3 enrichment matrix):
```sql
CREATE TABLE training_corpus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scrape provenance
  platform TEXT NOT NULL DEFAULT 'tiktok',
  platform_video_id TEXT NOT NULL,
  video_url TEXT,
  creator_handle TEXT,
  posted_at TIMESTAMPTZ,                          -- D-04 (7-day age filter at scrape time)
  scraped_at TIMESTAMPTZ DEFAULT NOW(),

  -- Engagement outcomes (BIGINT — viral exceeds INT_MAX, per competitor_tables.sql:3 rationale)
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  saves BIGINT DEFAULT 0,
  duration_seconds INTEGER,
  completion_pct NUMERIC(5,2),                    -- NULL until in-product scraper lands (see header gap note)

  -- Creator outcome context (RESEARCH §A.3)
  follower_count BIGINT,                          -- nullable — clockworks profile-scraper not always called
  follower_tier TEXT
    CHECK (follower_tier IS NULL OR follower_tier IN ('nano', 'micro', 'mid', 'large', 'mega')),

  -- Content for engine input
  caption TEXT,
  hashtags TEXT[] DEFAULT '{}',
  sound_name TEXT,

  -- Corpus labeling
  corpus_version TEXT NOT NULL,                   -- D-12: pilot.YYYY-MM-DD / full.YYYY-MM-DD
  niche TEXT NOT NULL
    CHECK (niche IN ('beauty', 'fitness', 'edu', 'comedy', 'lifestyle')),  -- D-03
  bucket TEXT NOT NULL
    CHECK (bucket IN ('viral', 'average', 'under')),                       -- D-14 three-class
  bucket_target TEXT
    CHECK (bucket_target IS NULL OR bucket_target IN ('viral', 'average', 'under')),

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(corpus_version, platform_video_id)       -- same video can appear across versions
);
```

**Indexes:**
```sql
CREATE INDEX idx_training_corpus_version_niche ON training_corpus(corpus_version, niche);
CREATE INDEX idx_training_corpus_version_bucket ON training_corpus(corpus_version, bucket);
CREATE INDEX idx_training_corpus_posted_at ON training_corpus(posted_at DESC);
CREATE INDEX idx_training_corpus_creator ON training_corpus(creator_handle);  -- D-05 dedupe
```

**RLS (system-wide, service-role only, NO user-scoped policies)** — explicitly DENY anon/authenticated per RESEARCH.md §Security Domain V4:
```sql
ALTER TABLE training_corpus ENABLE ROW LEVEL SECURITY;
-- No policies created → all non-service-role access denied by default.
-- Service role bypasses RLS via createServiceClient(). System-wide table, never user-scoped.
```

**Trigger:**
```sql
CREATE TRIGGER training_corpus_updated_at
  BEFORE UPDATE ON training_corpus
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

CRITICAL: Do NOT copy `competitor_tables.sql:113-127` RLS — those use `(SELECT auth.uid())` and require `user_id`. The corpus has no user owner.
  </action>
  <verify>
    <automated>test -f supabase/migrations/20260512000000_training_corpus.sql && grep -q "completion_pct NUMERIC" supabase/migrations/20260512000000_training_corpus.sql && grep -q "ENABLE ROW LEVEL SECURITY" supabase/migrations/20260512000000_training_corpus.sql && grep -v '^--' supabase/migrations/20260512000000_training_corpus.sql | grep -c "auth.uid()" | grep -q "^0$"</automated>
  </verify>
  <done>File exists, contains completion_pct column, has RLS enabled, contains NO references to auth.uid() in non-comment lines (system-wide table).</done>
</task>

<task type="auto">
  <name>Task 2: Create benchmark_results migration</name>
  <files>supabase/migrations/{YYYYMMDDHHMMSS_+100s}_benchmark_results.sql</files>
  <action>
**W2 — Choose the migration timestamp:** Use the same date as Task 1's chosen `{YYYYMMDDHHMMSS}` plus a `+100`-second offset (e.g., `20260512000000` -> `20260512000100`), so this migration sorts AFTER training_corpus when Supabase replays migrations alphabetically. Substitute the chosen value into the filename AND any `<files>` / `<verify>` references below.

Create the migration storing eval harness output (D-20 + EVAL-06). Pattern mapper override: mirror `outcomes` + `analysis_results` shape from `content_intelligence.sql`, NOT competitor_tables.

**File header:**
```sql
-- Engine Eval Harness Output Schema (Phase 1, D-14..20)
-- System-wide table (no user_id) — eval harness service-role inserts.
-- Mirrors outcomes/analysis_results from content_intelligence.sql.
-- One row per eval run. Tagged with (corpus_version, engine_version) per D-12 + D-21.
-- failure_cases JSONB column holds top-10 mispredictions (per Claude's discretion §C.5 —
-- single-column JSONB chosen over separate table for simplicity; 10 cases × ~200 bytes
-- well within JSONB limits).
```

**Migration body** (trigger function CREATE OR REPLACE for idempotency; PATTERNS.md §11 + RESEARCH.md §F.2):
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE benchmark_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Version tagging (D-12, D-21) — corpus_version is logical FK to training_corpus.corpus_version
  corpus_version TEXT NOT NULL,
  engine_version TEXT NOT NULL,                               -- "2.1.0" for baseline (D-21)

  -- Primary gate metric (D-14)
  macro_f1 NUMERIC(5,4) NOT NULL,
  per_niche_f1 JSONB NOT NULL,                                -- D-15: { "beauty": 0.42, ... }

  -- Secondary metrics (D-16)
  ece NUMERIC(5,4),
  per_class_metrics JSONB DEFAULT '{}',                       -- precision/recall per bucket
  signal_contribution JSONB DEFAULT '{}',                     -- EVAL-03 LOO per signal
  spearman_within_niche JSONB DEFAULT '{}',                   -- per-niche rank correlation
  mae_engagement_rate NUMERIC(8,6),                           -- EVAL-02 continuous error

  -- Cost / latency
  cost_cents_avg NUMERIC(10,4),                               -- BENCH-03 target ≤ 0.075
  cost_cents_total NUMERIC(12,4),                             -- audit trail for $50 cap
  latency_p50 INTEGER,
  latency_p95 INTEGER,
  latency_p99 INTEGER,
  stage_timings JSONB DEFAULT '{}',                           -- per-stage p50/p95/p99
  drift_metrics JSONB DEFAULT '{}',                           -- bucket-distribution drift vs prior version
  failure_cases JSONB DEFAULT '[]',                           -- top-10 mispredictions

  -- Bucket-specific metrics (D-16)
  viral_recall NUMERIC(5,4),
  under_precision NUMERIC(5,4),

  -- Run context
  notes TEXT,
  run_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ                                      -- soft delete (mirror outcomes:137)
);

CREATE INDEX idx_benchmark_results_corpus_engine ON benchmark_results(corpus_version, engine_version);
CREATE INDEX idx_benchmark_results_run_at ON benchmark_results(run_at DESC);

ALTER TABLE benchmark_results ENABLE ROW LEVEL SECURITY;
-- System-wide: service role bypasses RLS. No user-scoped policies.

CREATE TRIGGER benchmark_results_updated_at
  BEFORE UPDATE ON benchmark_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

Do NOT add a UNIQUE constraint on `(corpus_version, engine_version)` — multiple runs per pair are legitimate for regression testing (see PATTERNS.md §11 pitfall).
Do NOT seed data here — `measureV21Baseline()` (Plan E/G) writes the first row at runtime.
  </action>
  <verify>
    <automated>test -f supabase/migrations/20260512000100_benchmark_results.sql && grep -q "macro_f1 NUMERIC(5,4) NOT NULL" supabase/migrations/20260512000100_benchmark_results.sql && grep -q "failure_cases JSONB" supabase/migrations/20260512000100_benchmark_results.sql && grep -v '^--' supabase/migrations/20260512000100_benchmark_results.sql | grep -c "auth.uid()" | grep -q "^0$"</automated>
  </verify>
  <done>File exists, contains macro_f1 + failure_cases JSONB + soft delete, no auth.uid() in non-comment lines.</done>
</task>

<task type="auto">
  <name>Task 3: Apply migrations and regenerate database types</name>
  <files>src/types/database.types.ts</files>
  <action>
Apply both migrations against the local Supabase instance and regenerate `database.types.ts` so downstream TypeScript can reference `training_corpus` and `benchmark_results` with full type safety.

**Step 1 — Apply migrations locally:**
```bash
# Reset and apply all migrations (idempotent — works on fresh or existing DB)
supabase db reset
# OR (if reset is too aggressive)
supabase db push
```

If `supabase` CLI is unavailable, document the manual steps in the commit message and run the migrations against the linked project directly via the dashboard SQL editor. The DDL is idempotent (CREATE OR REPLACE FUNCTION, CREATE TABLE without IF EXISTS — fail-fast on re-apply, which is the correct behavior for net-new tables).

**Step 2 — Regenerate types:**
```bash
# Standard project pattern — uses supabase gen types from the local project
supabase gen types typescript --local > src/types/database.types.ts
```

If `--local` isn't configured, use the project's standard regen flow (whatever's documented in `package.json` scripts or CLAUDE.md). The goal: `src/types/database.types.ts` MUST contain new `training_corpus` and `benchmark_results` table entries under the `Database['public']['Tables']` interface.

**Step 3 — Verify types compile:**
After regen, run a quick type-check to confirm types are valid:
```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | head -50
```
If type errors surface from existing files referencing OLD generated types in a way that breaks now (unlikely — schema is purely additive), investigate before proceeding.

Do NOT hand-edit `database.types.ts` — it is generator output. If regen fails, document the failure in the SUMMARY and surface to the user before continuing to Plans D/E (they will fail typecheck without these types).
  </action>
  <verify>
    <automated>grep -q "training_corpus" src/types/database.types.ts &amp;&amp; grep -q "benchmark_results" src/types/database.types.ts &amp;&amp; npx tsc --noEmit --project tsconfig.json &gt; /tmp/typecheck.log 2&gt;&amp;1 &amp;&amp; ! grep -E "training_corpus|benchmark_results" /tmp/typecheck.log</automated>
  </verify>
  <done>database.types.ts contains both new tables; tsc --noEmit passes (or only fails on pre-existing unrelated issues).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Application service-role → database | Eval harness + corpus orchestrator write to both tables via service role; all other clients (anon, authenticated) explicitly denied via no-policy RLS |
| Migration apply → schema | Migration runs once at deploy; subsequent re-applies via `CREATE TABLE` will fail-fast (intentional for net-new tables) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-A-01 | Tampering | training_corpus rows via anon/authenticated Supabase client | mitigate | RLS enabled with NO policies — anon and authenticated roles are denied all operations. Only `createServiceClient()` (server-side, never in client bundles) bypasses RLS. |
| T-01-A-02 | Tampering | benchmark_results rows via anon/authenticated client | mitigate | Same RLS posture as training_corpus. |
| T-01-A-03 | Tampering | SQL injection via niche/bucket strings | mitigate | DB-level CHECK constraints on `niche` (5-value enum) and `bucket` (3-value enum) — invalid values rejected at DB regardless of caller. |
| T-01-A-04 | Information disclosure | TikTok handles in training_corpus considered PII | accept | TikTok handles are public. No internal user identifiers stored. Per RESEARCH §Security V3: no GDPR surface in this phase. |
| T-01-A-05 | Tampering | corpus_version mismatch on benchmark_results queries | mitigate | Index on `(corpus_version, engine_version)` plus enforce-same-version guard in eval CLI (Plan E task 3) prevents apples-to-oranges comparison (Pitfall 6). |
</threat_model>

<verification>
- `supabase/migrations/20260512000000_training_corpus.sql` exists, has RLS enabled with no policies, contains `completion_pct NUMERIC(5,2)` and all D-03/D-04/D-05/D-14 constraints
- `supabase/migrations/20260512000100_benchmark_results.sql` exists, has RLS enabled, contains `macro_f1 NUMERIC(5,4) NOT NULL` and `failure_cases JSONB`
- `src/types/database.types.ts` includes both new tables
- `npx tsc --noEmit` passes (no new type errors)
- Migrations apply cleanly via `supabase db reset` (or equivalent)
</verification>

<success_criteria>
1. Both migration files exist with the exact column shapes specified
2. RLS is enabled on both tables with NO user-scoped policies
3. `database.types.ts` regenerated; TypeScript compilation passes
4. `completion_pct` column documented as a known gap in the migration header (per user decision)
</success_criteria>

<requirement_coverage>
| Requirement | Cross-link | Task |
|---|---|---|
| CORPUS-06 | REQUIREMENTS.md §Training Corpus | T1 (training_corpus DDL) |
| EVAL-06 | REQUIREMENTS.md §Evaluation Framework | T2 (benchmark_results DDL) |
</requirement_coverage>

<out_of_scope>
- Seed data inserts (Plan E writes the first benchmark_results row via measureV21Baseline())
- pgvector extension (Phase 8)
- benchmark_failure_cases as a separate table (researcher §C.5 recommended; folded into JSONB column per simplicity reasoning in PATTERNS.md §11)
- Foreign-key constraint between benchmark_results.corpus_version → training_corpus.corpus_version (logical FK only; corpus_version is an immutable string identifier, not a row PK)
- Any changes to existing tables (`scraped_videos`, `competitor_*`, etc.) — phase is additive-only
</out_of_scope>

<output>
After completion, create `.planning/phases/01-training-corpus-eval-foundation/01-A-SUMMARY.md` per `@$HOME/.claude/get-shit-done/templates/summary.md`.
</output>
