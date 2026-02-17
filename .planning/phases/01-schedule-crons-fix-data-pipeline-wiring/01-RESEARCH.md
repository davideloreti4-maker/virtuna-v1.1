# Phase 1: Schedule Crons & Fix Data Pipeline Wiring - Research

**Researched:** 2026-02-17
**Domain:** Vercel Cron Jobs, Apify Scraping Pipeline, Supabase Schema Migrations
**Confidence:** HIGH

## Summary

Phase 1 is primarily a wiring and configuration task, not a greenfield build. All 7 cron route handlers already exist with correct implementations (`src/app/api/cron/*/route.ts`). The problem is that only 1 of 7 (`refresh-competitors`) is actually scheduled in `vercel.json` -- the other 6 are orphaned. The data pipeline code (scrape-trending -> Apify webhook -> scraped_videos -> calculate-trends -> trending_sounds) is fully implemented and structurally correct. The `evaluation_tier` column migration already exists in `20260216000000_v2_schema_expansion.sql` -- the requirement is to verify it's applied and that the seed migration (`20260217100000_seed_semantic_rule_tiers.sql`) has run.

The scope is narrow: add 6 cron entries to `vercel.json`, verify schema migrations are applied, trace the data pipeline for correctness, and document environment variables.

**Primary recommendation:** This is a configuration and verification phase. No new code needs to be written for the route handlers -- the work is adding vercel.json entries, verifying DB migrations, tracing the pipeline chain for bugs, and documenting env vars.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.5 | API route handlers for cron endpoints | Already in use; cron routes are standard GET handlers |
| @supabase/supabase-js | ^2.93.1 | Database operations via service client | Already in use; service role client bypasses RLS for cron jobs |
| apify-client | ^2.22.1 | TikTok scraping actor trigger + dataset fetch | Already in use; handles actor start, webhook config, dataset retrieval |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.3.6 | Schema validation for webhook payloads | Already imported in rules.ts; use for any new validation |

### Alternatives Considered
None -- all libraries are already installed and in use. No new dependencies needed for this phase.

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Existing Project Structure (Relevant to Phase 1)
```
src/app/api/
  cron/
    scrape-trending/route.ts    # Triggers Apify actor, sends webhook URL
    calculate-trends/route.ts    # Aggregates scraped_videos -> trending_sounds
    calibration-audit/route.ts   # Monthly ECE measurement + Platt re-fit
    refresh-competitors/route.ts # Daily competitor profile re-scrape (ONLY ONE SCHEDULED)
    retrain-ml/route.ts          # Weekly ML model retraining
    sync-whop/route.ts           # Periodic Whop membership sync
    validate-rules/route.ts      # Daily per-rule accuracy validation
  webhooks/
    apify/route.ts               # Receives Apify actor completion webhook
    whop/route.ts                # Receives Whop subscription webhooks
vercel.json                      # Cron schedule config (currently only 1 of 7)
supabase/migrations/             # Schema migrations (evaluation_tier already exists)
```

### Pattern 1: Vercel Cron Job Configuration
**What:** Declarative cron scheduling via `vercel.json` `crons` array
**When to use:** For all periodic backend jobs
**Key facts (verified via Context7/Vercel docs):**
- Maximum 20 cron jobs per project (we need 7, well within limits)
- Hobby plan has hourly accuracy only; Pro plan has per-minute accuracy
- Timezone is always UTC
- No `MON`/`SUN`/`DEC` named expressions -- numbers only
- Cannot set both day-of-month and day-of-week (one must be `*`)
- Vercel auto-sends `Authorization: Bearer $CRON_SECRET` header

**Example (from Vercel docs):**
```json
{
  "crons": [
    {
      "path": "/api/every-hour",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/every-day",
      "schedule": "0 0 * * *"
    }
  ]
}
```

### Pattern 2: Cron Authentication
**What:** All cron routes verify `Authorization: Bearer $CRON_SECRET` header
**Already implemented:** `src/lib/cron-auth.ts` provides `verifyCronAuth(request)` returning null on success or a 401 NextResponse on failure.
**Exception:** `sync-whop/route.ts` implements its own inline auth check (same logic but not using `verifyCronAuth`). This is a minor inconsistency but not a blocker.

### Pattern 3: Apify Actor -> Webhook -> Database Pipeline
**What:** Cron triggers Apify actor run with inline webhook registration; Apify calls back on completion; webhook handler fetches dataset and upserts into Supabase.
**Flow:**
1. `scrape-trending` cron starts Apify actor with `client.actor(APIFY_ACTOR_ID).start()` and registers a webhook pointing to `/api/webhooks/apify`
2. Apify runs the actor, scrapes TikTok videos
3. On `ACTOR.RUN.SUCCEEDED`, Apify POSTs to webhook URL with `resource.defaultDatasetId`
4. Webhook handler fetches dataset items via `client.dataset(datasetId).listItems()`
5. Items are mapped to `scraped_videos` schema and upserted in batches of 50
6. `calculate-trends` cron (separate schedule) reads from `scraped_videos` and aggregates into `trending_sounds`

### Anti-Patterns to Avoid
- **Coupling scrape and calculate in one handler:** The existing design correctly separates scraping (triggered by Apify completion webhook) from trend calculation (separate cron). Do not merge them.
- **Blocking on Apify completion:** `scrape-trending` correctly uses `.start()` (fire-and-forget with webhook), NOT `.call()` (blocks until completion). Vercel function timeout is 10-60s; Apify actors can run for minutes.
- **Hard-coded webhook URLs:** The webhook URL uses `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/apify`. This is correct -- it must be the production URL for Vercel cron invocations.

## Codebase Findings

### Finding 1: Current vercel.json State
**Confidence:** HIGH (direct file read)

Current `vercel.json` has only 1 cron entry:
```json
{
  "crons": [
    {
      "path": "/api/cron/refresh-competitors",
      "schedule": "0 6 * * *"
    }
  ]
}
```

**Missing 6 cron entries** (with documented schedules from route handler comments):

| Route | Documented Schedule | Cron Expression |
|-------|-------------------|-----------------|
| `/api/cron/scrape-trending` | Every 6 hours | `0 */6 * * *` |
| `/api/cron/calculate-trends` | Hourly | `0 * * * *` |
| `/api/cron/validate-rules` | Daily | `0 2 * * *` (pick a low-traffic hour) |
| `/api/cron/retrain-ml` | Weekly | `0 3 * * 1` (Monday 3 AM UTC) |
| `/api/cron/calibration-audit` | Monthly | `0 4 1 * *` (1st of month, 4 AM UTC) |
| `/api/cron/sync-whop` | Periodic (unspecified) | `0 */12 * * *` (every 12 hours is reasonable as webhook fallback) |

### Finding 2: evaluation_tier Column Already Exists in Migrations
**Confidence:** HIGH (direct file read)

Migration `20260216000000_v2_schema_expansion.sql` already contains:
```sql
ALTER TABLE rule_library ADD COLUMN IF NOT EXISTS evaluation_tier TEXT DEFAULT 'regex'
  CHECK (evaluation_tier IN ('regex', 'semantic'));
```

And `20260217100000_seed_semantic_rule_tiers.sql` updates 13 rules to `'semantic'`.

**However:** The generated TypeScript types (`src/types/database.types.ts`) do NOT include `evaluation_tier` in the `rule_library` type. The code in `src/lib/engine/rules.ts` works around this with a cast through `unknown`. This means:
- The migration exists but may not have been applied to the production database
- Even if applied, the TypeScript types are stale

**Action needed:** Verify migration is applied (check Supabase dashboard or run `supabase db push`). Optionally regenerate types with `supabase gen types typescript`.

### Finding 3: Data Pipeline Code is Structurally Complete
**Confidence:** HIGH (direct file reads of all route handlers)

The full chain `scrape-trending -> webhook/apify -> calculate-trends` is implemented:

1. **scrape-trending** (line 61-80): Correctly calls `client.actor(APIFY_ACTOR_ID).start()` with inline webhook registration pointing to `/api/webhooks/apify`. Passes `scrape_hashtags` in webhook payload template.

2. **webhooks/apify** (lines 26-126): Correctly:
   - Verifies `payload.secret` against `APIFY_WEBHOOK_SECRET`
   - Extracts `resource.defaultDatasetId`
   - Fetches dataset items via `client.dataset().listItems()`
   - Maps Apify video schema to `scraped_videos` columns (platform_video_id, views, likes, shares, comments, sound_name, sound_url, hashtags, etc.)
   - Upserts with `onConflict: "platform,platform_video_id"`

3. **calculate-trends** (lines 11-177): Correctly:
   - Reads non-archived `scraped_videos` from last 48 hours
   - Aggregates by `sound_name` (video count, views, growth rate)
   - Computes velocity score and trend phase classification
   - Upserts into `trending_sounds` with `onConflict: "sound_name"`

**Potential issue in webhook:** The webhook payload template in `scrape-trending` uses string interpolation for the secret:
```typescript
payloadTemplate: `{
  "resource": {{resource}},
  "eventType": {{eventType}},
  "secret": "${process.env.APIFY_WEBHOOK_SECRET}",
  "scrape_hashtags": ${JSON.stringify(hashtags)}
}`,
```
This uses Apify's `{{resource}}` template syntax (double braces = Apify variables, single quotes = literal values). This is the correct Apify webhook template format -- `{{resource}}` and `{{eventType}}` are Apify template variables, while `"secret"` is a literal string set at actor start time.

### Finding 4: Environment Variables Inventory
**Confidence:** HIGH (grep across entire src/)

Complete list of environment variables used across the codebase:

| Variable | Used In | Required For Phase 1 |
|----------|---------|---------------------|
| `CRON_SECRET` | `cron-auth.ts`, `sync-whop/route.ts` | YES -- cron auth |
| `APIFY_TOKEN` | `scrape-trending/route.ts`, `webhooks/apify/route.ts`, `apify-provider.ts` | YES -- scraper pipeline |
| `APIFY_ACTOR_ID` | `scrape-trending/route.ts` (defaults to `clockworks~tiktok-scraper`) | YES (has default) |
| `APIFY_WEBHOOK_SECRET` | `scrape-trending/route.ts`, `webhooks/apify/route.ts` | YES -- webhook verification |
| `SCRAPER_HASHTAGS` | `scrape-trending/route.ts` (defaults to 15 hashtags) | YES (has default) |
| `NEXT_PUBLIC_APP_URL` | `scrape-trending/route.ts`, `whop/checkout/route.ts` | YES -- webhook callback URL |
| `NEXT_PUBLIC_SUPABASE_URL` | `supabase/client.ts`, `server.ts`, `service.ts`, `middleware.ts` | YES -- all DB access |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `supabase/client.ts`, `server.ts`, `middleware.ts` | YES -- client-side auth |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabase/service.ts` | YES -- cron/webhook DB writes |
| `GEMINI_API_KEY` | `engine/gemini.ts`, `ai/gemini.ts` | No (not Phase 1) |
| `GEMINI_MODEL` | `engine/gemini.ts` (defaults to `gemini-2.5-flash`) | No |
| `DEEPSEEK_API_KEY` | `engine/deepseek.ts`, `engine/rules.ts`, `ai/deepseek.ts` | No (not Phase 1) |
| `DEEPSEEK_MODEL` | `engine/deepseek.ts` (defaults to `deepseek-reasoner`) | No |
| `WHOP_API_KEY` | `sync-whop/route.ts`, `whop/checkout/route.ts` | No (sync-whop works independently) |
| `WHOP_WEBHOOK_SECRET` | `webhooks/whop/route.ts` | No |
| `WHOP_PRODUCT_ID_STARTER` | `whop/config.ts` | No |
| `WHOP_PRODUCT_ID_PRO` | `whop/config.ts` | No |

**Phase 1 required env vars for `.env.example`:** APIFY_TOKEN, APIFY_WEBHOOK_SECRET, APIFY_ACTOR_ID, SCRAPER_HASHTAGS (per requirements). But `.env.example` should document ALL env vars for developer onboarding.

### Finding 5: Database Schema for scraped_videos and trending_sounds
**Confidence:** HIGH (direct migration read)

`scraped_videos` table (from `20260213000000_content_intelligence.sql`):
- `platform` TEXT NOT NULL DEFAULT 'tiktok'
- `platform_video_id` TEXT NOT NULL
- `video_url`, `author`, `author_url`, `description` TEXT
- `views`, `likes`, `shares`, `comments` BIGINT
- `sound_name`, `sound_url` TEXT
- `hashtags` TEXT[]
- `category` TEXT
- `duration_seconds` INTEGER
- `metadata` JSONB
- `archived_at` TIMESTAMPTZ
- UNIQUE(platform, platform_video_id)

`trending_sounds` table:
- `sound_name` TEXT NOT NULL UNIQUE
- `sound_url` TEXT
- `video_count` INTEGER, `total_views` BIGINT
- `growth_rate`, `velocity_score` NUMERIC(10,4)
- `trend_phase` TEXT CHECK ('emerging', 'rising', 'peak', 'declining')
- `first_seen`, `last_seen` TIMESTAMPTZ
- `metadata` JSONB

Both tables have RLS enabled. `scraped_videos` allows public SELECT where `archived_at IS NULL`. Writes go through service role (bypasses RLS).

### Finding 6: sync-whop Auth Inconsistency
**Confidence:** HIGH (direct file read)

`sync-whop/route.ts` implements inline auth instead of using `verifyCronAuth()`:
```typescript
const authHeader = request.headers.get("authorization");
const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
if (authHeader !== expectedAuth) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

This is functionally equivalent but inconsistent. The planner may want to normalize this.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron scheduling | Custom scheduler or external service | Vercel `vercel.json` crons | Already supported, auto-sends CRON_SECRET, managed infrastructure |
| Webhook secret verification | Custom crypto | Compare `payload.secret` against env var | Already implemented correctly in apify webhook handler |
| Database migrations | Manual ALTER TABLE | Supabase migrations in `supabase/migrations/` | Idempotent, version-controlled, already the project pattern |
| Dataset fetching from Apify | Raw HTTP requests | `apify-client` `dataset().listItems()` | Handles pagination, retries, auth automatically |

**Key insight:** Everything is already built. This phase is about connecting existing pieces (scheduling crons) and verifying existing implementations (pipeline trace, migration verification).

## Common Pitfalls

### Pitfall 1: Vercel Cron Expressions with Named Days
**What goes wrong:** Using `MON`, `SUN` etc. in cron expressions
**Why it happens:** Standard cron supports named days, Vercel doesn't
**How to avoid:** Use numeric only: `0-6` for day-of-week (0=Sunday), `1-12` for months
**Warning signs:** Cron job never fires on Vercel

### Pitfall 2: Hobby Plan Timing Inaccuracy
**What goes wrong:** Cron scheduled for `0 */6 * * *` fires at random minute within the hour
**Why it happens:** Hobby plan distributes cron invocations across the hour
**How to avoid:** Use Pro plan if precise timing matters. For this project's use case (scraping every ~6 hours), hourly accuracy is fine.
**Warning signs:** Logs show invocations at :23, :47 instead of :00

### Pitfall 3: NEXT_PUBLIC_APP_URL Must Be Production URL
**What goes wrong:** Apify webhook calls back to localhost or wrong URL
**Why it happens:** `scrape-trending` uses `process.env.NEXT_PUBLIC_APP_URL` in the webhook callback URL. If this is not set to the production Vercel URL, Apify cannot reach the webhook.
**How to avoid:** Ensure `NEXT_PUBLIC_APP_URL` is set to `https://your-app.vercel.app` in Vercel environment variables
**Warning signs:** Scraper runs succeed in Apify dashboard but no data appears in scraped_videos

### Pitfall 4: Migration Ordering and Idempotency
**What goes wrong:** Running migrations out of order or re-running causes errors
**Why it happens:** Supabase migrations run in timestamp order. If content_intelligence (20260213) hasn't run, v2_schema_expansion (20260216) fails because `rule_library` doesn't exist.
**How to avoid:** All ALTER statements use `IF NOT EXISTS`. Check migration status via `supabase migration list` before applying.
**Warning signs:** `relation "rule_library" does not exist` errors

### Pitfall 5: Stale TypeScript Types After Migration
**What goes wrong:** TypeScript types don't include `evaluation_tier`, causing type errors in strict mode
**Why it happens:** `database.types.ts` is generated from the DB schema at a point in time. After adding columns via migration, types must be regenerated.
**How to avoid:** Run `supabase gen types typescript --local > src/types/database.types.ts` after applying migrations
**Warning signs:** Code uses `as unknown as` casts to access new columns (already happening in `rules.ts` line 118)

### Pitfall 6: Webhook Payload Template Syntax
**What goes wrong:** Apify webhook sends wrong or empty payload
**Why it happens:** Confusing Apify template variables (`{{resource}}`) with JavaScript template literals (`${variable}`)
**How to avoid:** In the `payloadTemplate` string: `{{resource}}` and `{{eventType}}` are Apify server-side variables (double braces). `${process.env.APIFY_WEBHOOK_SECRET}` is a JS template literal evaluated at function runtime. Both are used correctly in the current code.
**Warning signs:** Webhook receives `null` for resource or undefined secret

## Code Examples

### Correct vercel.json with All 7 Crons
```json
{
  "crons": [
    {
      "path": "/api/cron/scrape-trending",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/calculate-trends",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/refresh-competitors",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/cron/validate-rules",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/retrain-ml",
      "schedule": "0 3 * * 1"
    },
    {
      "path": "/api/cron/calibration-audit",
      "schedule": "0 4 1 * *"
    },
    {
      "path": "/api/cron/sync-whop",
      "schedule": "0 */12 * * *"
    }
  ]
}
```

### Cron Schedule Rationale
| Cron | Schedule | Rationale |
|------|----------|-----------|
| scrape-trending | `0 */6 * * *` | Route comment: "Runs every 6 hours"; keeps scraped data fresh for calculate-trends |
| calculate-trends | `0 * * * *` | Route comment: "Runs hourly"; frequent aggregation for near-real-time trending data |
| refresh-competitors | `0 6 * * *` | Route comment: "Triggered at 6:00 AM UTC"; already scheduled, keep as-is |
| validate-rules | `0 2 * * *` | Route comment: "Runs daily"; 2 AM UTC avoids peak hours |
| retrain-ml | `0 3 * * 1` | Route comment: "Weekly cron"; Monday 3 AM UTC, after a week of fresh data |
| calibration-audit | `0 4 1 * *` | Route comment: "Monthly cron"; 1st of month, 4 AM UTC, uses 90-day lookback |
| sync-whop | `0 */12 * * *` | Route comment: "Periodic sync (webhook fallback)"; twice daily is sufficient as a fallback |

### Complete .env.example Template
```bash
# ==========================================
# Supabase
# ==========================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ==========================================
# App URL (used for webhook callbacks)
# ==========================================
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# ==========================================
# Vercel Cron Authentication
# ==========================================
# Random string (16+ chars) — Vercel auto-sends as Authorization: Bearer header
CRON_SECRET=your-random-secret-string

# ==========================================
# Apify (TikTok Scraping Pipeline)
# ==========================================
# API token from https://console.apify.com/account/integrations
APIFY_TOKEN=your-apify-api-token
# Shared secret for webhook payload verification
APIFY_WEBHOOK_SECRET=your-webhook-secret
# Actor ID (default: clockworks~tiktok-scraper)
APIFY_ACTOR_ID=clockworks~tiktok-scraper
# Comma-separated hashtags to scrape (default: trending,viral,fyp,comedy,dance,...)
SCRAPER_HASHTAGS=trending,viral,fyp,comedy,dance,cooking,fitness,fashion,beauty,tech,education,storytelling,lifehack,motivation

# ==========================================
# AI / LLM (not required for Phase 1)
# ==========================================
GEMINI_API_KEY=your-gemini-api-key
# GEMINI_MODEL=gemini-2.5-flash  # optional, defaults to gemini-2.5-flash
DEEPSEEK_API_KEY=your-deepseek-api-key
# DEEPSEEK_MODEL=deepseek-reasoner  # optional, defaults to deepseek-reasoner

# ==========================================
# Whop (Subscription Management)
# ==========================================
WHOP_API_KEY=your-whop-api-key
WHOP_WEBHOOK_SECRET=your-whop-webhook-secret
WHOP_PRODUCT_ID_STARTER=your-starter-product-id
WHOP_PRODUCT_ID_PRO=your-pro-product-id
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| External cron services (cron-job.org, EasyCron) | Vercel native cron in vercel.json | Vercel Cron GA ~2023 | No external dependency, auto CRON_SECRET, dashboard visibility |
| Polling-based scrape + process | Event-driven: actor start + webhook callback | Already implemented | Non-blocking, respects Vercel function timeout limits |

**Deprecated/outdated:**
- None relevant -- the existing patterns are current and correct.

## Open Questions

1. **Is the Vercel project on Hobby or Pro plan?**
   - What we know: Route comments mention "Vercel Pro plan (60s timeout) recommended" for retrain-ml. The function sets `maxDuration = 60` in refresh-competitors.
   - What's unclear: Which plan is actually active. Hobby plan has 10s default timeout and hourly cron accuracy.
   - Recommendation: Verify plan tier. If Hobby, `retrain-ml` may time out. For Phase 1, this is informational only -- cron scheduling works on both plans.

2. **Have the evaluation_tier migrations been applied to production?**
   - What we know: Migration files exist (`20260216000000_v2_schema_expansion.sql`, `20260217100000_seed_semantic_rule_tiers.sql`). TypeScript types don't include `evaluation_tier`.
   - What's unclear: Whether `supabase db push` has been run against production.
   - Recommendation: Check via Supabase dashboard (table inspector) or `supabase migration list`. If not applied, run `supabase db push`.

3. **Does `.env.local.example` already document some vars?**
   - What we know: A file `.env.local.example` exists at the repo root but its contents could not be read (permission denied for .env files).
   - What's unclear: Whether it already documents Apify vars, or just Supabase/basic vars.
   - Recommendation: Read the file to avoid duplicating existing documentation. If it exists and has content, either extend it or create a separate `.env.example` (the requirement says `.env.example`).

4. **Is the Apify webhook reachable from Apify's servers?**
   - What we know: The webhook URL is `${NEXT_PUBLIC_APP_URL}/api/webhooks/apify`. The webhook handler exists and has no middleware blocking POST requests.
   - What's unclear: Whether Vercel's deployment exposes this route publicly (it should by default for API routes).
   - Recommendation: After deployment with crons, trigger a manual scrape and watch Apify run logs to confirm webhook delivery.

## Sources

### Primary (HIGH confidence)
- Vercel Cron Jobs Documentation (Context7 `/llmstxt/vercel_llms_txt`) - cron configuration format, limits (max 20 per project), authentication via CRON_SECRET, scheduling accuracy per plan
- Apify Client JS SDK (Context7 `/apify/apify-client-js`) - actor start with webhooks, dataset item listing, webhook payload structure
- Direct codebase file reads - all 7 cron route handlers, webhook handler, supabase migrations, database types, lib utilities

### Secondary (MEDIUM confidence)
- Vercel pricing/plan limits for cron accuracy (Hobby vs Pro timing guarantees)

### Tertiary (LOW confidence)
- None -- all findings are from direct codebase inspection or official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, verified versions from package.json
- Architecture: HIGH - Direct file reads of all route handlers, migrations, and supporting code
- Pitfalls: HIGH - All pitfalls derived from Vercel official docs or direct code inspection

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable -- Vercel cron format and Apify SDK are mature)
