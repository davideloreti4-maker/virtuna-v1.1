# Technology Stack

**Project:** Virtuna Competitors Tool
**Researched:** 2026-02-16
**Scope:** Stack ADDITIONS for competitor tracking milestone. Existing stack (Next.js 16, React 19, TypeScript, Tailwind v4, Supabase, Recharts 3, Zustand 5, Zod 4) is validated and NOT re-researched.

## Critical Context: Backend Foundation Overlap

The `backend-foundation` worktree (shipped 2026-02-13) already includes:

| Capability | Status | Location |
|-----------|--------|----------|
| `apify-client` ^2.22.0 | Installed | `package.json` |
| Apify webhook handler | Built | `src/app/api/webhooks/apify/route.ts` |
| Trending scrape cron | Built | `src/app/api/cron/scrape-trending/route.ts` |
| `scraped_videos` table | Migrated | `20260213000000_content_intelligence.sql` |
| Vercel cron config | Configured | `vercel.json` (every 6h) |
| `@tanstack/react-query` | Installed | `package.json` |
| Service client | Built | `src/lib/supabase/service.ts` |
| Cron auth utility | Built | `src/lib/cron-auth.ts` |

**This milestone must NOT duplicate that infrastructure.** Instead, it extends it: new Apify actor calls (profile scraper vs. trending scraper), new database tables (competitor-specific), new cron jobs (competitor refresh), and new API routes.

---

## Recommended Stack Additions

### 1. TikTok Data Scraping

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Apify Clockworks TikTok Profile Scraper | Actor: `clockworks/tiktok-profile-scraper` | Scrape competitor profile stats (followers, likes, videos, bio) | Most maintained TikTok actor on Apify (125K+ users, daily updates). Clockworks already used in backend-foundation for trending. Consistent data format across actors. $0.005/result. |
| Apify Clockworks TikTok Video Scraper | Actor: `clockworks/tiktok-video-scraper` | Scrape recent videos for a competitor (views, likes, shares, comments, hashtags) | Same maintainer, compatible output schema. Needed for content analysis and engagement tracking. $0.005-0.01/result. |
| `apify-client` | ^2.22.0 | JavaScript API client for Apify | **Already installed** in backend-foundation. Reuse same client, same webhook pattern. Zero new dependencies for scraping. |

**Why Apify Clockworks over alternatives:**
- TikTok Research API is academic-only, explicitly prohibits commercial use, requires 30-day approval, rate-limited to 1000 req/day. Not viable.
- RapidAPI TikTok endpoints are fragile, inconsistent quality, no guaranteed maintenance.
- Bright Data/Decodo are enterprise-priced proxied scrapers -- overkill for profile-level data.
- Clockworks is already proven in the codebase (trending scraper uses it), actively maintained (daily updates to keep pace with TikTok changes), and pay-per-result pricing is predictable.

**Data fields returned by profile scraper** (MEDIUM confidence -- from Apify listing, not Context7):

```typescript
interface ApifyProfileResult {
  id: string;                    // TikTok user ID
  uniqueId: string;              // @handle
  nickname: string;              // Display name
  signature: string;             // Bio
  bioLink?: { link: string };    // Bio URL
  verified: boolean;
  avatarLarger: string;          // Profile pic URL
  followerCount: number;
  followingCount: number;
  heartCount: number;            // Total likes received
  videoCount: number;
  createTime: number;            // Account creation timestamp
}
```

**Data fields returned by video scraper** (MEDIUM confidence):

```typescript
interface ApifyVideoResult {
  id: string;                    // Video ID
  webVideoUrl: string;           // Full URL
  text: string;                  // Caption/description
  createTime: number;            // Post timestamp
  playCount: number;
  diggCount: number;             // Likes
  shareCount: number;
  commentCount: number;
  collectCount: number;          // Saves/bookmarks
  hashtags: Array<{ name: string }>;
  musicMeta: { musicName: string; musicAuthor: string };
  videoMeta: { duration: number };
  authorMeta: { name: string; fans: number };
}
```

**Confidence:** MEDIUM -- Data structures sourced from Apify docs and WebSearch, not verified via Context7. Apify actors can change output schemas; Zod validation at ingest is mandatory.

### 2. Database Schema (Supabase PostgreSQL)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL tables (Supabase) | N/A | Store competitor profiles, metric snapshots, tracked relationships | Native Supabase -- no new dependency. Extends existing migration pattern. |
| `tsvector` full-text search | Built into PostgreSQL | Search competitors by name, handle, bio, niche | No external search service needed. PostgreSQL FTS with GIN indexes handles the scale (hundreds to low thousands of competitors, not millions). Supabase has first-class `.textSearch()` support in the JS client. |

**Why NOT TimescaleDB extension:** The `timescaledb` extension is available in Supabase but is overkill for this use case. We are storing daily snapshots for at most hundreds of competitors -- tens of thousands of rows per year. Standard PostgreSQL tables with proper indexes and partitioning (if ever needed) handle this trivially. TimescaleDB adds operational complexity (hypertable management, chunk intervals) with zero benefit at this scale.

**Why NOT a separate search service (Algolia, Typesense, Meilisearch):** At the scale of hundreds to low thousands of competitor profiles, PostgreSQL `tsvector` with GIN indexes provides sub-millisecond search. Adding a separate service adds cost, latency (network hop), sync complexity, and another failure point. If Virtuna grows to 100K+ competitors in the search index, revisit.

**Proposed tables:**

```sql
-- Tracked competitors (one row per TikTok profile we're monitoring)
competitor_profiles (
  id UUID PK,
  tiktok_id TEXT UNIQUE,           -- TikTok's internal user ID
  handle TEXT NOT NULL UNIQUE,     -- @handle (denormalized for search)
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  niche TEXT[],                    -- User-tagged categories
  last_scraped_at TIMESTAMPTZ,
  scrape_status TEXT CHECK (IN 'pending','active','failed','paused'),
  metadata JSONB DEFAULT '{}',
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(handle, '') || ' ' || coalesce(display_name, '') || ' ' || coalesce(bio, ''))
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- GIN index on search_vector for full-text search
-- Index on handle for exact lookups

-- Point-in-time metric snapshots (one row per competitor per scrape)
competitor_snapshots (
  id UUID PK,
  competitor_id UUID FK -> competitor_profiles,
  followers INTEGER NOT NULL,
  following INTEGER NOT NULL,
  total_likes BIGINT NOT NULL,     -- heartCount
  video_count INTEGER NOT NULL,
  engagement_rate NUMERIC(8,4),    -- Computed: avg(likes+comments+shares)/followers across recent videos
  avg_views BIGINT,                -- Average views on recent videos
  avg_likes BIGINT,
  avg_comments BIGINT,
  avg_shares BIGINT,
  top_hashtags TEXT[],             -- Most used hashtags in recent videos
  posting_frequency NUMERIC(6,2), -- Videos per week
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'      -- Raw Apify response stashed here
);
-- Index on (competitor_id, scraped_at DESC) for time-series queries
-- Partial index WHERE scraped_at > NOW() - INTERVAL '90 days' for dashboard queries

-- User-to-competitor tracking relationship
user_competitors (
  id UUID PK,
  user_id UUID FK -> auth.users,
  competitor_id UUID FK -> competitor_profiles,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,                      -- User's private notes
  tags TEXT[],                     -- User's private tags
  UNIQUE(user_id, competitor_id)
);

-- Competitor videos (recent videos per competitor, refreshed on scrape)
competitor_videos (
  id UUID PK,
  competitor_id UUID FK -> competitor_profiles,
  tiktok_video_id TEXT NOT NULL,
  video_url TEXT,
  caption TEXT,
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  saves BIGINT DEFAULT 0,
  duration_seconds INTEGER,
  hashtags TEXT[],
  sound_name TEXT,
  posted_at TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(competitor_id, tiktok_video_id)
);
```

**RLS strategy:**
- `competitor_profiles`: Public SELECT (shared resource -- multiple users may track the same competitor). INSERT/UPDATE via service role only (from scrape pipeline).
- `competitor_snapshots`: Public SELECT. INSERT via service role only.
- `user_competitors`: User-scoped SELECT/INSERT/DELETE via `auth.uid()`. This is the privacy boundary.
- `competitor_videos`: Public SELECT. INSERT/UPDATE via service role only.

### 3. Charting / Visualization

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Recharts | ^3.7.0 | Growth charts, comparison visualizations, engagement trend lines | **Already installed.** Recharts 3 has full support for multi-series LineChart, AreaChart, ComposedChart, and ResponsiveContainer. No new charting library needed. |

**Why NOT add Nivo or Tremor:**
- Recharts is already in the bundle, already styled to match the Raycast design system, already used in the earnings dashboard (AreaChart).
- Adding a second charting library bloats the bundle for zero benefit.
- Recharts multi-series LineChart directly supports the "compare follower growth across competitors" use case.
- ComposedChart supports mixing line + bar for engagement breakdowns.

**Specific Recharts components for competitor tracking:**

| Component | Use Case |
|-----------|----------|
| `LineChart` + multiple `<Line>` | Follower growth comparison (one line per competitor) |
| `AreaChart` | Single competitor engagement over time |
| `BarChart` | Side-by-side engagement metrics (views, likes, shares) |
| `ComposedChart` | Posting frequency (bars) overlaid with engagement rate (line) |
| `RadarChart` | Competitor profile comparison (followers, engagement, frequency, diversity) |
| `Tooltip`, `Legend` | Styled with Raycast design tokens (dark bg, 6% borders) |

### 4. Background Job Scheduling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel Cron Jobs | Built-in | Trigger competitor data refresh on schedule | **Already proven** in backend-foundation (`vercel.json`). Free on all plans. Simple GET-based invocation of API routes. |
| Supabase pg_cron | Built-in extension | Alternative for database-level scheduled cleanup/aggregation | Already available in Supabase. Zero network latency for SQL operations. Good for retention policies (archive old snapshots). |

**Why NOT Inngest or Trigger.dev:**
- Vercel Cron + API routes already handles the use case (trigger Apify actor run -> webhook callback -> upsert data). This pattern is proven in backend-foundation.
- Adding Inngest/Trigger.dev introduces a third-party dependency, additional billing, SDK integration, and operational complexity for a problem already solved.
- If runs need to exceed Vercel's function timeout (60s on Pro), the Apify webhook pattern avoids this entirely: cron triggers a short API call to start the actor (< 1s), Apify runs asynchronously, webhook callback processes results (short bursts per batch).

**Vercel Cron plan constraints:**
- **Hobby plan:** Cron jobs limited to once per day. If Virtuna is on Hobby, competitor refresh is daily.
- **Pro plan ($20/mo):** Sub-daily cron intervals. Every 6-12 hours is reasonable for competitor tracking.
- The backend-foundation already uses `0 */6 * * *` (every 6 hours). Competitor scraping can use a similar or lower frequency (daily is fine for follower growth tracking).

**Proposed cron jobs:**

```json
{
  "path": "/api/cron/scrape-competitors",
  "schedule": "0 2 * * *"
}
```

One daily scrape at 2 AM UTC. Scrapes all active competitor profiles, then fetches recent videos. Webhook callback processes results into `competitor_snapshots` and `competitor_videos`.

### 5. Search and Filtering

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL Full-Text Search | Built-in | Search competitors by handle, name, bio keywords | Supabase JS client has `.textSearch()` method. GIN-indexed `tsvector` column on `competitor_profiles`. Zero new dependencies. |
| Supabase `.ilike()` | Built-in | Simple prefix/contains search for handles | For typeahead "add competitor" input, `.ilike('handle', '%query%')` is simpler and more intuitive than FTS for short handle searches. |

**Search strategy:**
- **Add competitor input** (typeahead): Use `.ilike()` on `handle` column for prefix matching against already-tracked competitors. For new competitors not yet in DB, call Apify profile scraper on-demand.
- **Competitor list filtering**: Use `.textSearch()` on the generated `search_vector` column for keyword-based filtering across handle + name + bio.
- **Niche/tag filtering**: PostgreSQL array operators (`@>`, `&&`) on `niche TEXT[]` column. Already supported by Supabase client.

### 6. State Management (Client-Side)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | ^5.0.10 | Client-side UI state (selected competitor, active filters, chart settings) | **Already installed.** Used for bookmarks on trending page. Same pattern for competitor selection state. |
| `@tanstack/react-query` | ^5.90.21 | Server data fetching, caching, background refresh | **Already installed** in backend-foundation. Use for all competitor data queries with stale-while-revalidate. |

**Why keep both Zustand and TanStack Query:**
- Zustand: ephemeral UI state (which competitor is selected, filter panel state, chart toggle). Not server data.
- TanStack Query: server data caching, refetching, optimistic updates. Competitor profiles, snapshots, videos.
- They solve different problems. No conflict.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| TikTok Data | Apify Clockworks actors | TikTok Research API | Academic-only, 30-day approval, commercial use prohibited, 1000 req/day limit |
| TikTok Data | Apify Clockworks actors | RapidAPI TikTok APIs | Inconsistent quality, poor maintenance guarantees, fragile endpoints |
| TikTok Data | Apify Clockworks actors | Bright Data / SociaVault | Enterprise pricing ($500+/mo), overkill for profile-level scraping |
| TikTok Data | Apify Clockworks actors | Direct scraping (Puppeteer/Playwright) | TikTok aggressive anti-bot, weekly countermeasure updates, proxy management burden, maintenance nightmare |
| Time-Series DB | Plain PostgreSQL tables | TimescaleDB extension | Overkill for hundreds of competitors. Adds hypertable complexity for trivial row counts |
| Search | PostgreSQL FTS + ilike | Algolia / Typesense / Meilisearch | External service for < 10K records adds cost + sync complexity for zero benefit |
| Background Jobs | Vercel Cron + Apify webhook | Inngest / Trigger.dev | Additional dependency + billing for a pattern already working in backend-foundation |
| Background Jobs | Vercel Cron + Apify webhook | Supabase Edge Functions + pg_cron | Edge Functions have 2s CPU limit, 150s wall clock. Fine for triggering Apify, but API routes already do this. No advantage over existing pattern. |
| Charting | Recharts 3 (existing) | Nivo / Tremor / Chart.js | Second charting library in bundle. Recharts already styled for Raycast theme. |

---

## What NOT to Add

These were considered and explicitly rejected to keep the stack lean:

| Dependency | Reason to Skip |
|-----------|---------------|
| Any new charting library | Recharts 3 covers all comparison/growth chart needs |
| Any external search service | PostgreSQL FTS sufficient at this scale |
| `date-fns` or `dayjs` | Native `Intl.DateTimeFormat` and `Date` sufficient for chart axis labels and "last scraped" displays |
| `lodash` | ES2024+ has `Object.groupBy`, `Array.prototype.toSorted`, structuredClone. No need. |
| `axios` | `fetch` is native in Next.js and handles all API calls |
| New state management | Zustand + TanStack Query already cover UI state + server state |
| `nanoid` for IDs | Already installed, but use PostgreSQL `gen_random_uuid()` for all database IDs. nanoid only for client-side ephemeral keys |

---

## New Dependencies Summary

```bash
# ZERO new npm packages needed for this milestone
# All required libraries are already in the existing stack or backend-foundation

# The only "new" things are:
# 1. New Supabase migration files (SQL, no npm package)
# 2. New API routes (TypeScript, no npm package)
# 3. New vercel.json cron entry (config, no npm package)
# 4. New Apify actor IDs referenced in env vars (config, no npm package)
```

**If backend-foundation has not yet been merged into main when this milestone starts:**

```bash
# These packages from backend-foundation will need to be added to this worktree:
pnpm add apify-client@^2.22.0
pnpm add @tanstack/react-query@^5.90.21
```

---

## Environment Variables (New)

```bash
# Already defined in backend-foundation (reuse):
APIFY_TOKEN=                         # Apify API token
APIFY_WEBHOOK_SECRET=                # Shared secret for webhook auth

# New for competitor scraping:
APIFY_COMPETITOR_PROFILE_ACTOR=clockworks/tiktok-profile-scraper
APIFY_COMPETITOR_VIDEO_ACTOR=clockworks/tiktok-video-scraper
```

---

## Sources

- [Apify TikTok Scraper (Clockworks)](https://apify.com/clockworks/tiktok-scraper) -- Actor listing, pricing
- [Apify TikTok Profile Scraper](https://apify.com/clockworks/tiktok-profile-scraper) -- Profile data fields
- [Apify TikTok Video Scraper](https://apify.com/clockworks/tiktok-video-scraper) -- Video data fields
- [Apify JS Client Documentation](https://docs.apify.com/api/client/js) -- `apify-client` npm usage
- [Apify Run Actor and Retrieve Data](https://docs.apify.com/academy/api/run-actor-and-retrieve-data-via-api) -- Sync/async patterns, webhook callbacks
- [Supabase Full Text Search](https://supabase.com/docs/guides/database/full-text-search) -- tsvector, GIN indexes
- [Supabase Cron](https://supabase.com/docs/guides/cron) -- pg_cron extension, Edge Function scheduling
- [Supabase Edge Functions Limits](https://supabase.com/docs/guides/functions/limits) -- 2s CPU, 150s wall clock
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) -- Configuration, pricing
- [Vercel Cron Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) -- Hobby (daily) vs Pro (sub-daily)
- [Recharts Multi-Series LineChart](https://recharts.github.io/en-US/examples/LineChartHasMultiSeries/) -- Multi-line comparison charts
- [TikTok Research API](https://developers.tiktok.com/products/research-api/) -- Academic-only restriction confirmed
- [TikTok Research API FAQ](https://developers.tiktok.com/doc/research-api-faq) -- Commercial use prohibition
- [Best TikTok Scrapers 2026](https://use-apify.com/docs/best-apify-actors/best-tiktok-scrapers) -- Clockworks as market leader

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Apify Clockworks actors | MEDIUM | Data field schemas from Apify docs + WebSearch, not Context7. Fields may change. Zod validation mandatory at ingest boundary. |
| Database schema design | HIGH | Standard PostgreSQL patterns, existing Supabase migration workflow proven in 6 prior migrations. |
| Recharts sufficiency | HIGH | Already installed, multi-series LineChart documented and verified. Earnings dashboard already uses AreaChart. |
| Vercel Cron for scheduling | HIGH | Already working in backend-foundation. Proven pattern. |
| PostgreSQL FTS for search | MEDIUM | Supabase docs confirm `.textSearch()` support. Not battle-tested in this codebase yet. |
| TanStack Query for data fetching | HIGH | Already installed and integrated in backend-foundation with query hooks. |
| Zero new dependencies claim | HIGH | Verified against existing package.json in both worktrees. |
