# Phase 1: Database Foundation - Research

**Researched:** 2026-02-13
**Domain:** Supabase PostgreSQL schema design, RLS policies, type generation, service client extraction, rule library seeding
**Confidence:** HIGH

## Summary

Phase 1 is pure database and infrastructure work with zero external dependencies. The existing codebase already has 2 migrations (v1.6 schema + Whop subscriptions), 7 tables, RLS policies using the `(SELECT auth.uid())` performance pattern, and a `createServiceClient()` function duplicated in 2 files. This phase adds 5 new tables (`scraped_videos`, `trending_sounds`, `analysis_results`, `outcomes`, `rule_library`), a usage tracking table for tier-gated analysis, extracts the service client to a shared module, regenerates TypeScript types, and seeds the rule library with 15+ expert rules.

The architecture reference (`session-640dc7c5-prediction-engine.md`) and the ARCHITECTURE.md research already contain complete SQL for all 5 tables with indexes and RLS policies. The decisions from CONTEXT.md add `archived_at` soft delete on scraped_videos, `deleted_at` on analysis_results and outcomes, `created_at`/`updated_at` timestamps on every table, platform-aware rule schema, and a usage tracking schema for tier limits (free: 3/month, starter: 15/day, pro: 50/day).

**Primary recommendation:** Use the ARCHITECTURE.md schema as the baseline, layer on CONTEXT.md decisions (soft deletes, timestamps, merged rule schema, usage tracking), write a single migration file, and seed via `supabase/seed.sql` for rule library data.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Seed rules stick to what's documented in the architecture reference (`session-640dc7c5-prediction-engine.md`): hook rules, retention rules, platform rules
- Do NOT expand into all 5 categories yet -- keep the seed lean, expand in later phases
- Rules use both cross-platform (null platform) and platform-specific (platform = "tiktok" etc.) entries as defined in the architecture reference
- **Scraped videos**: Soft delete with `archived_at` column. Cron archives old data rather than purging -- preserves ML training value
- **All tables**: `created_at` (default now()) + `updated_at` (trigger) on every table. Consistent, easy to audit
- **Analysis results & outcomes**: Soft delete with `deleted_at` column. User can "delete" from history but data stays for ML training and outcome tracking
- **Supabase is the auth source** -- users sign up via Supabase Auth, `auth.uid()` is the identity everywhere
- Whop handles payments separately, linked via `metadata.supabase_user_id` in the existing `user_subscriptions` table
- **Auth required for analysis** -- all `analysis_results` rows have a `user_id`. No anonymous analyses in v1
- All new tables reference `auth.uid()` for user-scoped RLS policies
- Service client pattern already exists in the Whop webhook handler (uses `SUPABASE_SERVICE_ROLE_KEY`) -- extract to shared `src/lib/supabase/service.ts`
- Add usage tracking schema in Phase 1 to support tier-gated analysis
- **Free: 3/month**, **Starter: 15/day**, **Pro: 50/day**

### Claude's Discretion
- Rule schema merges both sources (architecture ref: `score_modifier` + `pattern` + `platform`; REQUIREMENTS.md: `evaluation_prompt` + `weight` + `max_score` + `accuracy_rate`). Claude merges into the most practical schema for the engine
- Whether seed data includes production evaluation prompts or placeholders is at Claude's discretion (optimize for Phase 2 easiness)
- JSONB metadata columns: schemaless or defined shape -- pick based on how Apify data actually arrives

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `supabase` (CLI) | ^2.74.5 | Migrations, type generation, local dev | Already installed as devDependency. Handles migration creation, `db push`, `gen types typescript` |
| `@supabase/ssr` | ^0.8.0 | Server-side Supabase client creation | Already installed. Powers `createServerClient` for server components, middleware, and service client |
| `@supabase/supabase-js` | ^2.93.1 | Supabase client library | Already installed. Provides typed database operations via generated types |
| PostgreSQL 17 | 17.x | Database engine | Configured in `supabase/config.toml` (`major_version = 17`). Supabase-managed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^4.3.6 | Seed data validation | Already installed. Validate seed rule data shape before insertion |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SQL seed files | Supabase Edge Function seed | More complex; SQL seed is simpler, runs during `db reset`, already configured in `config.toml` |
| Manual migration files | `supabase db diff` | Diff is for capturing existing schema changes; writing explicit migration SQL is more precise and reviewable |
| Prisma/Drizzle ORM | Direct Supabase client | Already decided: no ORM. Supabase client with generated types provides type safety without an additional abstraction layer |

**Installation:**
```bash
# No new packages needed -- everything is already installed
# Just Supabase CLI for migration operations:
npx supabase migration new content_intelligence_schema
```

## Architecture Patterns

### Recommended Project Structure

```
supabase/
  migrations/
    20260202000000_v16_schema.sql          # Existing: creator profiles, deals, etc.
    20260212000000_add_whop_subscriptions.sql  # Existing: user_subscriptions
    20260213000000_content_intelligence.sql    # NEW: 5 tables + usage_tracking
  seed.sql                                  # NEW: Rule library seed data
src/
  lib/
    supabase/
      client.ts     # Existing: browser client (anon key)
      server.ts     # Existing: server client (anon key + cookies)
      middleware.ts  # Existing: session refresh
      service.ts    # NEW: service role client (bypasses RLS)
  types/
    database.types.ts  # REGENERATED after migration
```

### Pattern 1: Service Client Extraction

**What:** Extract `createServiceClient()` from duplicated inline definitions to a shared module.
**When:** Any server-side route that needs to bypass RLS (cron routes, webhook handlers, admin operations).
**Already established in:** `src/app/api/webhooks/whop/route.ts` (line 7-18) and `src/app/api/cron/sync-whop/route.ts` (line 6-12).

```typescript
// src/lib/supabase/service.ts
// Source: Extracted from existing webhook and cron route patterns
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

export function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );
}
```

**Why this pattern:** The `@supabase/ssr` `createServerClient` requires a cookies config even for service role usage. Empty getAll/setAll is the established pattern (no user session needed). This is already battle-tested in 2 existing routes.

### Pattern 2: `updated_at` Trigger Function

**What:** A reusable PostgreSQL trigger function that auto-updates `updated_at` on row modification.
**When:** Applied to every table that has an `updated_at` column.

```sql
-- Source: Standard Supabase pattern (verified via Context7)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to each table:
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON rule_library
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Why a shared trigger function:** DRY. One function, one trigger per table. The existing v1.6 migration does NOT have this trigger -- it relies on application-level `updated_at` updates (visible in `webhooks/whop/route.ts` line 79: `updated_at: new Date().toISOString()`). Adding the trigger makes it automatic and consistent, even for direct SQL operations.

### Pattern 3: TEXT + CHECK Over ENUMs

**What:** Use `TEXT NOT NULL CHECK (value IN ('a', 'b', 'c'))` instead of PostgreSQL ENUM types.
**When:** For all status/category/type fields.
**Already established:** Every existing table uses this pattern (e.g., `compensation_type TEXT NOT NULL CHECK (compensation_type IN ('fixed', 'rev_share', 'hybrid'))`).

```sql
-- Source: Existing v1.6 migration pattern
category TEXT NOT NULL CHECK (category IN ('hook', 'retention', 'platform', 'audio', 'text', 'timing', 'creator')),
```

**Why:** ENUMs require migrations to add values (`ALTER TYPE ... ADD VALUE` is not transactional). TEXT + CHECK is more flexible -- you can `DROP CONSTRAINT` and `ADD CONSTRAINT` in a single transaction. Already the established pattern in this codebase.

### Pattern 4: Merged Rule Schema (Claude's Discretion)

**What:** Merge the architecture reference's rule fields (`score_modifier`, `pattern`, `platform`) with REQUIREMENTS.md fields (`evaluation_prompt`, `weight`, `max_score`, `accuracy_rate`) into a single practical schema.

```sql
CREATE TABLE rule_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Rule identity
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'hook', 'retention', 'platform', 'audio', 'text', 'timing', 'creator'
  )),

  -- From architecture ref: pattern matching
  pattern TEXT,              -- e.g., "question_hook", "curiosity_gap", "negative_bias"
  score_modifier INTEGER,    -- e.g., +15, -20 (simple additive scoring)
  platform TEXT,             -- NULL = cross-platform, "tiktok" / "instagram" / "youtube" = specific

  -- From REQUIREMENTS.md: LLM evaluation
  evaluation_prompt TEXT,    -- The prompt template for DeepSeek to evaluate this rule
  weight NUMERIC(5,3) NOT NULL DEFAULT 1.0,
  max_score NUMERIC(5,2) NOT NULL DEFAULT 10.0,

  -- Validation tracking
  accuracy_rate NUMERIC(5,4),  -- Updated by rule validator cron
  sample_count INTEGER DEFAULT 0,

  -- Lifecycle
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Rationale:** Both schema sources serve different scoring paths:
- `score_modifier` + `pattern` = deterministic scoring (rule matches pattern -> apply modifier). Fast, no AI cost, works day 1.
- `evaluation_prompt` + `weight` + `max_score` = LLM-evaluated scoring (DeepSeek reads prompt, scores content). Richer, more nuanced, costs per analysis.

The engine (Phase 2) can use EITHER path per rule. Simple rules (e.g., "video under 15 seconds on TikTok = +10") use `score_modifier`. Complex rules (e.g., "evaluate hook quality") use `evaluation_prompt`. Having both columns means the engine doesn't need a separate lookup strategy.

**Seed data recommendation:** Include production-quality `evaluation_prompt` values for complex rules (hook quality, text analysis, etc.) and use `score_modifier` for simple numeric rules (duration, platform fit). This optimizes for Phase 2 -- the engine can start using rules immediately without needing prompt engineering.

### Pattern 5: Usage Tracking for Tier-Gated Analysis

**What:** A table to track per-user analysis usage with daily/monthly counters.
**When:** Every analysis request checks usage before proceeding.

```sql
CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'monthly')),
  analysis_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period_start, period_type)
);
```

**Design decision:** Separate rows per period (daily for starter/pro, monthly for free) rather than a rolling window. The `UNIQUE(user_id, period_start, period_type)` constraint enables `INSERT ... ON CONFLICT DO UPDATE SET analysis_count = analysis_count + 1` as an atomic increment. No race conditions.

**Tier limits:**
| Tier | Period | Limit | Max cost/period |
|------|--------|-------|-----------------|
| Free | Monthly | 3 | ~$0.02/month |
| Starter | Daily | 15 | ~$0.10/day |
| Pro | Daily | 50 | ~$0.33/day |

### Anti-Patterns to Avoid

- **No RLS on new tables:** ALWAYS `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` immediately after `CREATE TABLE`. The existing codebase does this consistently -- maintain the pattern. RLS-disabled tables are publicly accessible via the Supabase REST API.
- **Forgetting INSERT policies need SELECT:** PostgreSQL returns newly inserted rows, which requires a SELECT policy. Without it, inserts fail with cryptic "new row violates policy" errors. Always pair INSERT (WITH CHECK) with SELECT (USING) policies.
- **Hardcoding `auth.uid()` without `SELECT` wrapper:** Always use `(SELECT auth.uid())` -- the subquery causes PostgreSQL to cache the auth function result per-statement, yielding 94%+ performance improvement on large tables. Already established in all existing RLS policies.
- **Manual `updated_at` in application code:** The existing Whop webhook handler manually sets `updated_at: new Date().toISOString()`. With database triggers, this becomes automatic. New code should NOT set `updated_at` manually -- the trigger handles it.
- **Creating service client per-query:** Create `createServiceClient()` once per request handler, pass the instance to helper functions. Each call creates a new HTTP client.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type-safe DB queries | Manual interface definitions | `supabase gen types typescript` | Auto-generates from actual schema, guaranteed in sync |
| `updated_at` timestamps | Application-level `new Date().toISOString()` | PostgreSQL trigger function | Automatic, works for all access paths (API, direct SQL, service client) |
| UUID primary keys | `uuid` npm package | `gen_random_uuid()` | PostgreSQL built-in, zero overhead, no dependency |
| Atomic usage counter increment | Read-modify-write pattern | `INSERT ... ON CONFLICT DO UPDATE SET count = count + 1` | Race-condition-free, single SQL statement |
| Migration timestamp format | Manual naming | `supabase migration new <name>` | CLI generates correct timestamp prefix |

**Key insight:** Supabase's generated types + PostgreSQL native features (triggers, gen_random_uuid, ON CONFLICT) handle most infrastructure concerns. The only custom code needed is the service client extraction (which is just moving existing code to a shared file) and the seed SQL.

## Common Pitfalls

### Pitfall 1: RLS Disabled on New Tables
**What goes wrong:** Creating tables without enabling RLS leaves them publicly accessible via the auto-generated REST API. 170+ Supabase apps were exposed due to this exact issue.
**Why it happens:** RLS is disabled by default. SQL Editor runs as `postgres` superuser and bypasses RLS, so queries "work" during development.
**How to avoid:** Enable RLS in every `CREATE TABLE` migration. Add a CI check: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;` should return zero rows.
**Warning signs:** Queries return data without authentication in client SDK tests.

### Pitfall 2: Type Generation Drift
**What goes wrong:** Database schema changes via migration but `database.types.ts` isn't regenerated. TypeScript types don't match actual DB columns. Queries succeed at runtime but types are wrong.
**Why it happens:** `supabase gen types typescript` must be run manually after every migration.
**How to avoid:** Run `supabase gen types typescript --local > src/types/database.types.ts` after every migration. Consider a `postmigrate` npm script.
**Warning signs:** TypeScript shows columns that don't exist, or doesn't show columns that do.

### Pitfall 3: Missing Indexes on RLS Policy Columns
**What goes wrong:** RLS policies with `user_id = (SELECT auth.uid())` cause sequential scans without an index on `user_id`. Fine at 100 rows, disastrous at 100K.
**Why it happens:** Developers test with small datasets. The performance hit only manifests at scale.
**How to avoid:** Create a B-tree index on every column referenced in an RLS policy. The existing migrations already do this (e.g., `CREATE INDEX idx_creator_profiles_user_id ON creator_profiles(user_id)`).
**Warning signs:** Slow dashboard loads, API route timeouts on authenticated queries.

### Pitfall 4: Soft Delete Without Filtering in Default Queries
**What goes wrong:** Adding `archived_at` / `deleted_at` columns but forgetting to filter them out in default queries. Users see "deleted" items in their results.
**Why it happens:** Soft delete adds a column but doesn't change query behavior. Every SELECT must explicitly filter `WHERE deleted_at IS NULL`.
**How to avoid:** (1) Add partial indexes: `CREATE INDEX ... WHERE deleted_at IS NULL` (only indexes non-deleted rows, smaller and faster). (2) Consider a PostgreSQL view that pre-filters soft-deleted rows. (3) Document in RESEARCH.md that all queries to these tables MUST filter soft-deleted rows.
**Warning signs:** Deleted items appearing in user-facing lists.

### Pitfall 5: Seed Data Running in Production
**What goes wrong:** Seed data (rule library) runs during `db reset` locally but could accidentally run against production during `db push --include-seed`.
**Why it happens:** `supabase/config.toml` has `[db.seed] enabled = true`. The `db push --include-seed` flag exists.
**How to avoid:** Never use `--include-seed` in production pushes. Seed data for production should use a separate migration with `INSERT ... ON CONFLICT DO NOTHING` to be idempotent. Keep `seed.sql` for local dev only.
**Warning signs:** Duplicate rule library entries in production.

## Code Examples

### Migration File Structure

```sql
-- Source: Existing migration pattern in this codebase
-- 20260213000000_content_intelligence.sql

-- =====================================================
-- SHARED: updated_at trigger function
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SCRAPED VIDEOS (Apify pipeline output)
-- =====================================================
CREATE TABLE scraped_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL DEFAULT 'tiktok',
  platform_video_id TEXT NOT NULL,
  -- ...columns...
  archived_at TIMESTAMPTZ,     -- Soft delete (cron archives, preserves ML value)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, platform_video_id)
);

ALTER TABLE scraped_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view non-archived scraped videos"
  ON scraped_videos FOR SELECT
  USING (archived_at IS NULL);
-- Writes: service_role only (cron routes)

CREATE TRIGGER set_scraped_videos_updated_at
  BEFORE UPDATE ON scraped_videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Service Client Extraction

```typescript
// src/lib/supabase/service.ts
// Source: Extracted from src/app/api/webhooks/whop/route.ts (lines 7-18)
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

/**
 * Creates a Supabase client using the service role key.
 * Bypasses RLS -- use ONLY in server-side routes (cron, webhooks, admin).
 * NEVER import this in client components.
 */
export function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );
}
```

After extraction, update the 2 existing files to import from the shared module:

```typescript
// src/app/api/webhooks/whop/route.ts
// src/app/api/cron/sync-whop/route.ts
import { createServiceClient } from "@/lib/supabase/service";
// Remove local createServiceClient() function
```

### Type Generation Command

```bash
# After migration, regenerate types:
npx supabase gen types typescript --local > src/types/database.types.ts

# Verify types compile:
npx tsc --noEmit
```

### Seed Data Pattern (rule_library)

```sql
-- supabase/seed.sql
-- Rule library seed data
-- Idempotent: uses ON CONFLICT DO NOTHING

INSERT INTO rule_library (name, description, category, pattern, score_modifier, platform, evaluation_prompt, weight, max_score, is_active)
VALUES
  -- Hook rules (cross-platform)
  ('Question Hook', 'Content opens with a direct question to the viewer', 'hook', 'question_hook', 15, NULL,
   'Evaluate if the content opens with a compelling question that creates curiosity. Score 0-10 where 10 means an irresistible question hook that demands engagement.',
   1.0, 10.0, true),
  ('Curiosity Gap', 'Content creates an information gap that compels viewing', 'hook', 'curiosity_gap', 12, NULL,
   'Evaluate if the content creates a curiosity gap — an incomplete piece of information that makes the viewer need to keep watching/reading. Score 0-10.',
   1.0, 10.0, true),
  -- ...more rules...
ON CONFLICT DO NOTHING;
```

### Usage Tracking: Atomic Increment

```sql
-- Increment daily counter atomically (no race conditions)
INSERT INTO usage_tracking (user_id, period_start, period_type, analysis_count)
VALUES ($1, CURRENT_DATE, 'daily', 1)
ON CONFLICT (user_id, period_start, period_type)
DO UPDATE SET
  analysis_count = usage_tracking.analysis_count + 1,
  updated_at = NOW();
```

### RLS Policy Examples (Performance-Optimized)

```sql
-- Source: Supabase RLS Performance docs (verified via Context7)
-- Pattern: (SELECT auth.uid()) wrapper caches the function result per-statement

-- analysis_results: User owns their results, soft-delete filtered
CREATE POLICY "Users can view own non-deleted analysis results"
  ON analysis_results FOR SELECT
  USING (user_id = (SELECT auth.uid()) AND deleted_at IS NULL);

CREATE POLICY "Users can create analysis results"
  ON analysis_results FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Users "soft delete" by setting deleted_at (cannot hard delete)
CREATE POLICY "Users can soft-delete own analysis results"
  ON analysis_results FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- rule_library: Public read for active rules only
CREATE POLICY "Anyone can view active rules"
  ON rule_library FOR SELECT
  USING (is_active = true);

-- usage_tracking: User can read own usage
CREATE POLICY "Users can view own usage"
  ON usage_tracking FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- usage_tracking: Service role increments (no user INSERT policy)
-- Writes happen through service client in analysis API route
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `auth.uid()` direct in RLS | `(SELECT auth.uid())` wrapped | Supabase documented 2024 | 94%+ performance improvement by caching auth result per-statement |
| PostgreSQL ENUM types | TEXT + CHECK constraint | Long-standing PostgreSQL pattern | Easier migrations, no `ALTER TYPE` headaches |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | Unified SSR/SSG/client support for all frameworks |
| Supabase CLI v1 | Supabase CLI v2 | 2024 | `supabase gen types` (not `supabase gen types typescript` only) |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Replaced by `@supabase/ssr` (already using the correct package)
- PostgreSQL ENUMs for status fields: Still valid but TEXT + CHECK is preferred in this codebase

## Open Questions

1. **JSONB Metadata Column Shape (Claude's Discretion)**
   - What we know: Apify actors return varying fields depending on the scraper and TikTok page changes. The architecture reference uses `metadata JSONB` as a catch-all.
   - What's unclear: Whether to add a Zod schema for JSONB validation at the application layer or keep it fully schemaless.
   - Recommendation: Keep JSONB columns schemaless in the database (no CHECK constraints on JSONB structure). Validate at the application layer with Zod when reading/writing. This matches the scraped data reality -- Apify output evolves and we don't want migrations for every field change. The `metadata` column absorbs platform-specific fields that don't warrant dedicated columns.

2. **Seed Data: Production Prompts vs Placeholders (Claude's Discretion)**
   - What we know: Rules need `evaluation_prompt` for DeepSeek to score content against in Phase 2. Simple rules also need `score_modifier` for deterministic scoring.
   - What's unclear: Whether to invest time writing production-quality evaluation prompts now or use placeholder text.
   - Recommendation: **Write production-quality prompts for seed data.** The prompts are the core IP of the prediction engine. Having them ready means Phase 2 can immediately test the full pipeline without a prompt-engineering detour. Placeholders would require revisiting every rule in Phase 2, doubling the work.

3. **scraped_videos RLS: Filter archived_at in SELECT policy or leave to application?**
   - What we know: Context decision says soft delete with `archived_at`. Public read access for trending page.
   - What's unclear: Whether the RLS policy itself should filter `WHERE archived_at IS NULL` or whether that's an application concern.
   - Recommendation: Filter in RLS policy (`USING (archived_at IS NULL)`). This provides defense-in-depth -- even if application code forgets the filter, deleted data won't leak. Service role client (used by cron routes) bypasses RLS and can still access archived data for ML training.

4. **updated_at trigger on wallet_transactions?**
   - What we know: `wallet_transactions` has an immutability trigger that prevents UPDATE/DELETE. Adding an `updated_at` trigger would conflict.
   - Recommendation: Skip the `updated_at` trigger on `wallet_transactions` (it already has the immutability trigger). Apply to all other tables including existing ones that currently lack it.

## Sources

### Primary (HIGH confidence)
- Context7 `/supabase/supabase` - RLS policy patterns, `(SELECT auth.uid())` performance optimization, index recommendations
- Context7 `/supabase/cli` - Migration commands (`supabase migration new`, `db push`, `db reset`), type generation (`gen types typescript --local`)
- Existing codebase migrations: `/Users/davideloreti/virtuna-backend-foundation/supabase/migrations/20260202000000_v16_schema.sql` and `20260212000000_add_whop_subscriptions.sql`
- Existing service client pattern: `/Users/davideloreti/virtuna-backend-foundation/src/app/api/webhooks/whop/route.ts` (lines 7-18)
- Architecture reference: `/Users/davideloreti/virtuna-v1.1/.planning/reference/session-640dc7c5-prediction-engine.md`
- Milestone research: `/Users/davideloreti/virtuna-backend-foundation/.planning/research/ARCHITECTURE.md` (complete SQL for all 5 tables)

### Secondary (MEDIUM confidence)
- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) - `(SELECT auth.uid())` caching pattern
- [Supabase Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) - Policy syntax and examples
- Pitfalls research: `/Users/davideloreti/virtuna-backend-foundation/.planning/research/PITFALLS.md` - Phase 1 pitfalls (#4, #8, #12, #16)

### Tertiary (LOW confidence)
- None -- all findings verified against official docs or existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools already installed and configured in the codebase. Zero new dependencies.
- Architecture: HIGH - Schema design is well-documented in ARCHITECTURE.md research and architecture reference. Patterns are established in existing migrations.
- Pitfalls: HIGH - RLS, indexes, type generation drift are all documented Supabase issues with verified mitigations.

**Research date:** 2026-02-13
**Valid until:** 2026-03-13 (stable domain -- Supabase PostgreSQL patterns don't change rapidly)
