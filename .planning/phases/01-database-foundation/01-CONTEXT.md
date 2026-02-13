# Phase 1: Database Foundation - Context

**Gathered:** 2026-02-13
**Status:** Ready for planning

<domain>
## Phase Boundary

All persistent data structures exist with type-safe access and security policies: 5 tables (scraped_videos, trending_sounds, analysis_results, outcomes, rule_library), RLS policies, generated TypeScript types, service client, and rule library seed data. Enables every subsequent phase to read/write data immediately.

</domain>

<decisions>
## Implementation Decisions

### Rule Library Content
- Seed rules stick to what's documented in the architecture reference (`session-640dc7c5-prediction-engine.md`): hook rules, retention rules, platform rules
- Do NOT expand into all 5 categories yet — keep the seed lean, expand in later phases
- Rules use both cross-platform (null platform) and platform-specific (platform = "tiktok" etc.) entries as defined in the architecture reference

### Rule Schema (Claude's Discretion)
- Architecture reference has `score_modifier` + `pattern` + `platform`; REQUIREMENTS.md has `evaluation_prompt` + `weight` + `max_score` + `accuracy_rate`
- Claude merges both into the most practical schema for the engine — both sources inform the final design
- Whether seed data includes production evaluation prompts or placeholders is at Claude's discretion (optimize for Phase 2 easiness)

### Data Lifecycle
- **Scraped videos**: Soft delete with `archived_at` column. Cron archives old data rather than purging — preserves ML training value
- **All tables**: `created_at` (default now()) + `updated_at` (trigger) on every table. Consistent, easy to audit
- **Analysis results & outcomes**: Soft delete with `deleted_at` column. User can "delete" from history but data stays for ML training and outcome tracking
- **JSONB metadata columns**: Claude's discretion on whether schemaless or defined shape — pick based on how Apify data actually arrives

### Auth & User Model
- **Supabase is the auth source** — users sign up via Supabase Auth, `auth.uid()` is the identity everywhere
- Whop handles payments separately, linked via `metadata.supabase_user_id` in the existing `user_subscriptions` table
- **Auth required for analysis** — all `analysis_results` rows have a `user_id`. No anonymous analyses in v1
- All new tables reference `auth.uid()` for user-scoped RLS policies
- Service client pattern already exists in the Whop webhook handler (uses `SUPABASE_SERVICE_ROLE_KEY`) — extract to shared `src/lib/supabase/service.ts`

### Usage Tracking (Tier-Gated Analysis)
- Add usage tracking schema in Phase 1 to support tier-gated analysis
- **Free: 3/month** — trial-level, shows product value, forces upgrade
- **Starter: 15/day** — covers a content planning session for serious TikTok creators
- **Pro: 50/day** — effectively unlimited for individuals, hard cap prevents AI cost blowout ($0.65/day max)
- Schema needs a usage counter table or column to track daily/monthly analysis counts per user

</decisions>

<specifics>
## Specific Ideas

- Architecture reference (`session-640dc7c5-prediction-engine.md`) is the source of truth for rule library structure, factor categories, and score aggregation weights
- Existing Whop integration already has a `createServiceClient()` in the webhook handler — reuse that pattern for the shared service client
- The existing `database.types.ts` already has `creator_profiles`, `user_subscriptions`, `affiliate_clicks`, `affiliate_conversions` tables — new tables coexist with these

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-database-foundation*
*Context gathered: 2026-02-13*
